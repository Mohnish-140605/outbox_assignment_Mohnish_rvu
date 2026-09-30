import { Worker, Job } from 'bullmq';
import { redisConnection } from '../redisConnection';
import { EMAIL_QUEUE_NAME } from '../queues/emailQueue';
import prisma from '../db';
import { EmailJobStatus } from '@prisma/client';

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

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailJobId } = job.data;

  if (!emailJobId || typeof emailJobId !== 'string') {
    console.error(`Worker: BullMQ job ${job.id} has invalid payload — no emailJobId.`);
    // Throw so BullMQ marks this as failed rather than silently swallowing it.
    throw new Error(`Invalid BullMQ job payload: missing emailJobId`);
  }

  // The database record is the source of truth — never blindly trust the payload.
  const emailJob = await prisma.emailJob.findUnique({ where: { id: emailJobId } });

  if (!emailJob) {
    console.error(`Worker: EmailJob ${emailJobId} not found in database. Skipping.`);
    // Return without throwing; the job is removed from BullMQ as completed
    // since there is nothing to retry.
    return;
  }

  if (emailJob.status === EmailJobStatus.SENT) {
    console.log(`Worker: EmailJob ${emailJobId} already SENT. Skipping.`);
    return;
  }

  if (emailJob.status === EmailJobStatus.FAILED) {
    console.log(`Worker: EmailJob ${emailJobId} is FAILED. Skipping for now.`);
    return;
  }

  if (emailJob.status === EmailJobStatus.PROCESSING) {
    // A previous worker run started but did not finish. Log and continue.
    console.warn(`Worker: EmailJob ${emailJobId} is already PROCESSING (possible duplicate delivery).`);
  }

  // Mark as PROCESSING in the database.
  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: EmailJobStatus.PROCESSING },
  });

  // Email sending is NOT implemented in this milestone.
  // The Ethereal SMTP integration will replace this log line.
  console.log(`Email job reached worker: ${emailJobId} (recipient: ${emailJob.recipient})`);
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
