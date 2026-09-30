import { Queue } from 'bullmq';
import { redisConnection } from '../redisConnection';

export const EMAIL_QUEUE_NAME = 'email-scheduler';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Retry up to 3 times on transient SMTP failures with exponential backoff.
    // Initial delay: 5 s → 10 s → 20 s. After 3 attempts the job is FAILED.
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    // Completed jobs are kept for 24 h for debugging.
    removeOnComplete: { age: 86400 },
    // Failed jobs are kept for 7 days for inspection.
    removeOnFail: { age: 604800 },
  },
});
