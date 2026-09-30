import { emailQueue } from '../queues/emailQueue';
import prisma from '../db';
import { EmailJobStatus } from '@prisma/client';

// The data shape stored in every BullMQ job payload.
// The worker reads this to look up the database record.
interface EmailJobPayload {
  emailJobId: string;
}

/**
 * Schedules a single PENDING EmailJob into BullMQ.
 *
 * Guarantees:
 * - The BullMQ job ID is always the EmailJob.id (deterministic).
 * - Calling this twice for the same job is safe — BullMQ deduplicates by jobId.
 * - The BullMQ job is added OUTSIDE any Prisma transaction because Redis and
 *   PostgreSQL cannot share a transaction. Recovery is handled by reconciliation.
 */
export async function scheduleEmailJob(emailJobId: string, scheduledAt: Date): Promise<void> {
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);

  const job = await emailQueue.add(
    'send-email',
    { emailJobId } satisfies EmailJobPayload,
    {
      // Using the EmailJob.id as the BullMQ job ID prevents duplicates.
      // If a job with this ID already exists in the queue, BullMQ returns
      // the existing job rather than creating a second one.
      jobId: emailJobId,
      delay,
    }
  );

  // Persist the BullMQ job ID back to PostgreSQL.
  // If the process crashes between queue.add and this update, the reconciler
  // will re-add the job on next startup (safe because jobId is deterministic).
  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { bullmqJobId: job.id },
  });

  console.log(`Email job scheduled: ${emailJobId} (delay ${delay}ms)`);
}

/**
 * Startup reconciliation.
 *
 * Finds every PENDING EmailJob and ensures a corresponding BullMQ job exists.
 *
 * Two cases handled:
 * 1. bullmqJobId IS NULL  → PostgreSQL was written but BullMQ insertion crashed.
 * 2. bullmqJobId IS SET   → BullMQ job may have been lost if Redis was flushed
 *    or the job expired. We re-add it using the same deterministic jobId;
 *    BullMQ deduplicates so a still-existing job is unaffected.
 *
 * This runs once on startup. It does NOT use cron, setInterval, or setTimeout.
 */
export async function reconcilePendingJobs(): Promise<void> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Find PENDING jobs, or PROCESSING jobs older than 10 minutes (stranded).
  const jobsToReconcile = await prisma.emailJob.findMany({
    where: { 
      OR: [
        { status: EmailJobStatus.PENDING },
        { 
          status: EmailJobStatus.PROCESSING, 
          processingAt: { lt: tenMinutesAgo } 
        }
      ]
    },
    select: { id: true, scheduledAt: true, bullmqJobId: true, status: true },
  });

  if (jobsToReconcile.length === 0) {
    console.log('Reconciliation: no PENDING or stranded PROCESSING jobs found.');
    return;
  }

  console.log(`Reconciliation: found ${jobsToReconcile.length} job(s) requiring attention. Ensuring BullMQ entries…`);

  for (const job of jobsToReconcile) {
    try {
      // If the job was stranded in PROCESSING, we must transition it back to PENDING
      // so the worker can claim it cleanly.
      if (job.status === EmailJobStatus.PROCESSING) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: EmailJobStatus.PENDING, processingAt: null }
        });
        console.log(`Reset stranded job ${job.id} to PENDING.`);
      }

      await scheduleEmailJob(job.id, job.scheduledAt);

      if (job.bullmqJobId === null) {
        console.log(`Reconciled email job: ${job.id}`);
      } else {
        console.log(`Email job already scheduled: ${job.id}`);
      }
    } catch (err) {
      // Log and continue — one failed job must not block reconciliation of others.
      console.error(`Reconciliation failed for job ${job.id}:`, err);
    }
  }

  console.log('Reconciliation complete.');
}
