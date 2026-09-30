import prisma from '../db';
import { DEV_USER_ID } from '../devUser';
import { EmailJobStatus } from '@prisma/client';

// Shape of the validated input coming from the route handler
interface CreateCampaignInput {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

/**
 * Creates one Campaign and one EmailJob per recipient inside a single
 * database transaction. If any insert fails, all inserts are rolled back.
 */
export async function createCampaign(input: CreateCampaignInput) {
  const {
    senderId,
    subject,
    body,
    recipients,
    startTime,
    delayBetweenEmails,
    hourlyLimit,
  } = input;

  // Calculate the scheduledAt time for every recipient.
  // Recipient 0 → startTime + (0 × delay)
  // Recipient 1 → startTime + (1 × delay)
  // etc.
  const jobs = recipients.map((recipient, index) => {
    const scheduledAt = new Date(
      startTime.getTime() + index * delayBetweenEmails * 1000
    );
    return { recipient, scheduledAt };
  });

  // Run everything inside one transaction so a partial failure leaves
  // no orphaned Campaign or EmailJob rows in the database.
  const result = await prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        userId: DEV_USER_ID,
        senderId,
        subject,
        body,
        startTime,
        delayBetweenEmails,
        hourlyLimit,
      },
    });

    const emailJobs = await Promise.all(
      jobs.map((job) =>
        tx.emailJob.create({
          data: {
            campaignId: campaign.id,
            recipient: job.recipient,
            scheduledAt: job.scheduledAt,
            status: EmailJobStatus.PENDING,
          },
        })
      )
    );

    return { campaign, emailJobs };
  });

  return result;
}

/**
 * Returns EmailJobs currently in PENDING status, ordered soonest first.
 * Scoped to the current user's campaigns.
 */
export async function getScheduledEmails(limit: number, offset: number) {
  return prisma.emailJob.findMany({
    where: {
      status: EmailJobStatus.PENDING,
      campaign: {
        userId: DEV_USER_ID,
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      recipient: true,
      scheduledAt: true,
      status: true,
      createdAt: true,
      campaign: {
        select: {
          id: true,
          subject: true,
        },
      },
    },
  });
}

/**
 * Returns EmailJobs that were successfully sent, ordered most recent first.
 * Scoped to the current user's campaigns.
 */
export async function getSentEmails(limit: number, offset: number) {
  return prisma.emailJob.findMany({
    where: {
      status: EmailJobStatus.SENT,
      campaign: {
        userId: DEV_USER_ID,
      },
    },
    orderBy: { sentAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      recipient: true,
      sentAt: true,
      status: true,
      campaign: {
        select: {
          id: true,
          subject: true,
        },
      },
    },
  });
}
