import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redisConnection';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import prisma from '../db';
import { EmailJobStatus } from '@prisma/client';
import { sendEmail, SmtpConfig } from '../services/emailService';

// Read concurrency from env; validate it is a usable positive integer.
const rawConcurrency = process.env.EMAIL_WORKER_CONCURRENCY;
const parsedConcurrency = rawConcurrency !== undefined ? Number(rawConcurrency) : NaN;
const CONCURRENCY = Number.isInteger(parsedConcurrency) && parsedConcurrency > 0
  ? parsedConcurrency
  : 5;

if (rawConcurrency !== undefined && (isNaN(parsedConcurrency) || parsedConcurrency < 1)) {
  console.warn(
    `EMAIL_WORKER_CONCURRENCY "${rawConcurrency}" is invalid. Using default: ${CONCURRENCY}`
  );
}

interface EmailJobPayload {
  emailJobId: string;
}

// Validates that an unknown JSON value has the SmtpConfig shape.
// Returns the typed value or throws a descriptive error.
function parseSmtpConfig(raw: unknown): SmtpConfig {
  if (
    raw === null ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  ) {
    throw new Error('smtpConfig is not an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj['host'] !== 'string' || obj['host'] === '') {
    throw new Error('smtpConfig.host is missing or not a string');
  }
  if (typeof obj['port'] !== 'number') {
    throw new Error('smtpConfig.port is missing or not a number');
  }
  if (typeof obj['user'] !== 'string' || obj['user'] === '') {
    throw new Error('smtpConfig.user is missing or not a string');
  }
  if (typeof obj['pass'] !== 'string') {
    throw new Error('smtpConfig.pass is missing or not a string');
  }

  return {
    host: obj['host'],
    port: obj['port'],
    user: obj['user'],
    pass: obj['pass'],
  };
}

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailJobId } = job.data;

  if (!emailJobId || typeof emailJobId !== 'string') {
    console.error(`Worker: BullMQ job ${job.id} has invalid payload — no emailJobId.`);
    throw new Error('Invalid BullMQ job payload: missing emailJobId');
  }

  // ── Step 1: Load EmailJob + Campaign + Sender from PostgreSQL ────────────
  // The database record is the source of truth — never blindly trust the payload.
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: {
      campaign: {
        include: {
          sender: true,
        },
      },
    },
  });

  if (!emailJob) {
    console.error(`Worker: EmailJob ${emailJobId} not found in database. Skipping.`);
    // No point retrying — the row is gone.
    return;
  }

  if (emailJob.status === EmailJobStatus.SENT) {
    console.log(`Worker: EmailJob ${emailJobId} already SENT. Skipping.`);
    return;
  }

  if (emailJob.status === EmailJobStatus.FAILED) {
    console.log(`Worker: EmailJob ${emailJobId} is FAILED. Skipping.`);
    return;
  }

  // ── Step 2: Atomic PENDING → PROCESSING transition ───────────────────────
  // Use a WHERE clause on status so only ONE worker wins this transition.
  // prisma.emailJob.updateMany returns a count of rows updated.
  // If count === 0, another worker already owns this job.
  //
  // Limitation: there is still a narrow crash window after SMTP accepts the
  // message but before the DB is updated to SENT. In that case the job stays
  // PROCESSING after restart. The reconciler does not re-send PROCESSING jobs,
  // so the email may never be marked SENT. This trade-off avoids duplicate sends.
  if (emailJob.status === EmailJobStatus.PENDING) {
    const { count } = await prisma.emailJob.updateMany({
      where: {
        id: emailJobId,
        status: EmailJobStatus.PENDING,
      },
      data: { status: EmailJobStatus.PROCESSING, processingAt: new Date() },
    });

    if (count === 0) {
      // Another worker already transitioned this job.
      console.log(`Worker: EmailJob ${emailJobId} was claimed by another worker. Skipping.`);
      return;
    }
  } else {
    // status is PROCESSING — a previous attempt started but did not finish
    // (e.g. crash after SMTP but before DB update). We allow one more attempt
    // rather than leaving it stuck forever. We do NOT transition again.
    console.warn(
      `Worker: EmailJob ${emailJobId} is PROCESSING (previous attempt did not finish). Retrying send.`
    );
  }

  // ── Step 3: Parse Sender SMTP configuration ──────────────────────────────
  let smtpConfig: SmtpConfig;
  try {
    smtpConfig = parseSmtpConfig(emailJob.campaign.sender.smtpConfig);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Invalid smtpConfig';
    console.error(`Worker: EmailJob ${emailJobId} has invalid smtpConfig: ${reason}`);
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: EmailJobStatus.FAILED, failureReason: `Invalid SMTP configuration: ${reason}` },
    });
    // Do not retry — this is a configuration error, not a transient failure.
    return;
  }

  // ── Step 4: Send the email ────────────────────────────────────────────────
  try {
    const result = await sendEmail({
      smtpConfig,
      from: emailJob.campaign.sender.email,
      to: emailJob.recipient,
      subject: emailJob.campaign.subject,
      text: emailJob.campaign.body,
    });

    // ── Step 5: Mark SENT ─────────────────────────────────────────────────
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.SENT,
        sentAt: new Date(),
        failureReason: null,
      },
    });

    console.log(`Email sent: ${emailJobId}`);
    if (result.previewUrl !== undefined) {
      console.log(`Preview URL: ${result.previewUrl}`);
    }
  } catch (err) {
    // ── Step 6: Handle delivery failure ──────────────────────────────────
    // Extract a safe error message — never log the SMTP password.
    const reason = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`Worker: EmailJob ${emailJobId} send failed: ${reason}`);

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: EmailJobStatus.FAILED,
        failureReason: reason,
      },
    });

    // Re-throw so BullMQ can apply its retry policy for transient failures.
    throw err;
  }
}

export function startEmailWorker(): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Worker: job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Worker: job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker: unexpected error:', err);
  });

  console.log(
    `BullMQ email scheduler started. Queue: "${EMAIL_QUEUE_NAME}", concurrency: ${CONCURRENCY}`
  );

  return worker;
}

/**
 * Gracefully shuts down the worker, waiting for in-progress jobs to finish.
 */
export async function stopEmailWorker(worker: Worker): Promise<void> {
  console.log('Worker: shutting down gracefully…');
  await worker.close();
  console.log('Worker: shutdown complete.');
}
