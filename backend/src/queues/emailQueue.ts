import { Queue } from 'bullmq';
import { redisConnection } from '../redisConnection';

// The single BullMQ Queue instance for email scheduling.
// Business logic (delays, job IDs) lives in the scheduling service, not here.
export const EMAIL_QUEUE_NAME = 'email-scheduler';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Jobs are removed from the completed set after 24 h to keep Redis lean.
    removeOnComplete: { age: 86400 },
    // Failed jobs are kept for 7 days for inspection.
    removeOnFail: { age: 604800 },
  },
});
