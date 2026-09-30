import esClient from '../elasticsearch';
import prisma from '../db';

// The name of the Elasticsearch index for email jobs.
export const EMAIL_INDEX = 'reachinbox-emails';

// The shape of a document stored in Elasticsearch.
// This is intentionally minimal — only fields needed for search and display.
// SMTP passwords, OAuth tokens, and smtpConfig are never indexed.
export interface EmailDocument {
  id: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

/**
 * Creates the reachinbox-emails index with an explicit mapping if it does not
 * already exist. Safe to call on every startup — it is a no-op when the index
 * is already present.
 */
export async function ensureEmailIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
  if (exists) {
    return;
  }

  await esClient.indices.create({
    index: EMAIL_INDEX,
    mappings: {
      properties: {
        // Keyword fields for exact match and filtering.
        id:         { type: 'keyword' },
        userId:     { type: 'keyword' },
        campaignId: { type: 'keyword' },
        senderId:   { type: 'keyword' },
        status:     { type: 'keyword' },

        // recipient is searchable as both text (partial) and keyword (exact).
        recipient: {
          type: 'text',
          fields: { keyword: { type: 'keyword' } },
        },

        // subject and body are full-text searchable.
        subject: { type: 'text' },
        body:    { type: 'text' },

        // Timestamp fields.
        scheduledAt: { type: 'date' },
        sentAt:      { type: 'date' },
        createdAt:   { type: 'date' },
      },
    },
  });

  console.log(`Elasticsearch: created index "${EMAIL_INDEX}".`);
}

/**
 * Upserts one EmailJob document into Elasticsearch using the EmailJob.id as
 * the document _id. Running this twice for the same job does NOT create a
 * duplicate — it updates the existing document.
 */
export async function indexEmailJob(doc: EmailDocument): Promise<void> {
  await esClient.index({
    index: EMAIL_INDEX,
    id: doc.id,
    document: doc,
  });
}

/**
 * Builds an EmailDocument from the fields that Prisma returns.
 * This is the only place we translate from DB shape to ES shape.
 */
export function buildEmailDocument(emailJob: {
  id: string;
  recipient: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  createdAt: Date;
  campaign: {
    userId: string;
    id: string;
    senderId: string;
    subject: string;
    body: string;
  };
}): EmailDocument {
  return {
    id: emailJob.id,
    userId: emailJob.campaign.userId,
    campaignId: emailJob.campaign.id,
    senderId: emailJob.campaign.senderId,
    recipient: emailJob.recipient,
    subject: emailJob.campaign.subject,
    body: emailJob.campaign.body,
    status: emailJob.status,
    scheduledAt: emailJob.scheduledAt.toISOString(),
    sentAt: emailJob.sentAt != null ? emailJob.sentAt.toISOString() : null,
    createdAt: emailJob.createdAt.toISOString(),
  };
}

/**
 * Startup reconciliation: reads all relevant EmailJobs from PostgreSQL
 * and upserts them into Elasticsearch.
 *
 * "Relevant" means any job that is not permanently gone — i.e., everything
 * except there is nothing to skip here; all statuses are useful for search.
 *
 * Safe to run repeatedly: document IDs are deterministic (EmailJob.id),
 * so re-indexing never creates duplicate Elasticsearch documents.
 */
export async function reconcileEmailSearchIndex(): Promise<void> {
  await ensureEmailIndex();

  const emailJobs = await prisma.emailJob.findMany({
    select: {
      id: true,
      recipient: true,
      status: true,
      scheduledAt: true,
      sentAt: true,
      createdAt: true,
      campaign: {
        select: {
          id: true,
          userId: true,
          senderId: true,
          subject: true,
          body: true,
        },
      },
    },
  });

  if (emailJobs.length === 0) {
    console.log('Elasticsearch reconciliation: no EmailJobs found.');
    return;
  }

  console.log(`Elasticsearch reconciliation: indexing ${emailJobs.length} EmailJob(s)…`);

  // Build bulk operations: each doc gets an index (upsert) operation.
  const operations = emailJobs.flatMap((job) => [
    { index: { _index: EMAIL_INDEX, _id: job.id } },
    buildEmailDocument(job),
  ]);

  const response = await esClient.bulk({ operations });

  if (response.errors) {
    // Log the first failure for visibility without crashing.
    const failed = response.items.filter((item) => item.index?.error != null);
    console.error(`Elasticsearch reconciliation: ${failed.length} document(s) failed to index.`, failed[0]?.index?.error);
  } else {
    console.log(`Elasticsearch reconciliation: indexed ${emailJobs.length} EmailJob(s) successfully.`);
  }
}

// Allowed status values for search filtering.
const VALID_STATUSES = new Set(['PENDING', 'PROCESSING', 'SENT', 'FAILED']);

/**
 * Searches EmailJobs in Elasticsearch.
 *
 * Always filters by userId — callers must supply the authenticated user's ID.
 * Optionally filters by status.
 * Searches recipient, subject, and body when q is provided.
 * When q is empty, returns recent jobs sorted by scheduledAt descending.
 */
export async function searchEmails(params: {
  userId: string;
  q: string;
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ items: EmailDocument[]; total: number }> {
  const { userId, q, status, limit, offset } = params;

  // Build the filter array — userId is always required.
  const filter: object[] = [{ term: { userId } }];

  // Optional status filter — only accept known statuses to prevent injection.
  if (status !== undefined) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status filter: "${status}". Must be one of PENDING, PROCESSING, SENT, FAILED.`);
    }
    filter.push({ term: { status } });
  }

  // Build the query: full-text search when q is given, match_all otherwise.
  const must: object =
    q.trim() !== ''
      ? {
          multi_match: {
            query: q,
            fields: ['recipient', 'subject', 'body'],
          },
        }
      : { match_all: {} };

  const response = await esClient.search<EmailDocument>({
    index: EMAIL_INDEX,
    from: offset,
    size: limit,
    sort: [{ scheduledAt: { order: 'desc' } }],
    query: {
      bool: {
        must,
        filter,
      },
    },
  });

  const total =
    typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value ?? 0;

  const items = response.hits.hits
    .map((hit) => hit._source)
    .filter((source): source is EmailDocument => source !== undefined);

  return { items, total };
}
