import { Router, Request, Response } from 'express';
import prisma from '../db';
import { DEV_USER_ID } from '../devUser';
import {
  createCampaign,
  getScheduledEmails,
  getSentEmails,
} from '../services/campaignService';
import { searchEmails } from '../services/emailSearchService';

const router = Router();

// Simple regex for syntactic email validation.
// It is intentionally basic — full RFC 5321 validation is out of scope.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_REGEX.test(value);
}

// POST /api/campaigns
// Creates a campaign and one scheduled EmailJob per recipient.
router.post('/campaigns', async (req: Request, res: Response) => {
  const { senderId, subject, body, recipients, startTime, delayBetweenEmails, hourlyLimit } = req.body;

  // --- Validation ---
  if (!senderId || typeof senderId !== 'string') {
    res.status(400).json({ error: 'senderId is required.' });
    return;
  }
  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    res.status(400).json({ error: 'subject is required and must not be empty.' });
    return;
  }
  if (!body || typeof body !== 'string' || body.trim() === '') {
    res.status(400).json({ error: 'body is required and must not be empty.' });
    return;
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'recipients must be a non-empty array.' });
    return;
  }
  const invalidEmails = recipients.filter((r) => !isValidEmail(r));
  if (invalidEmails.length > 0) {
    res.status(400).json({
      error: 'Some recipients are not valid email addresses.',
      invalid: invalidEmails,
    });
    return;
  }
  // Check existence first, then parse, then validate the parsed result.
  if (!startTime) {
    res.status(400).json({ error: 'startTime is required.' });
    return;
  }
  const parsedStart = new Date(startTime);
  if (isNaN(parsedStart.getTime())) {
    res.status(400).json({ error: 'startTime must be a valid ISO date string.' });
    return;
  }
  const delay = Number(delayBetweenEmails);
  if (isNaN(delay) || delay < 0) {
    res.status(400).json({ error: 'delayBetweenEmails must be a non-negative number.' });
    return;
  }
  const limit = Number(hourlyLimit);
  if (isNaN(limit) || !Number.isInteger(limit) || limit < 1) {
    res.status(400).json({ error: 'hourlyLimit must be a positive integer.' });
    return;
  }

  // --- Sender ownership check ---
  // Verify the sender exists and belongs to the current user.
  // This will be replaced with the authenticated user ID once OAuth is implemented.
  let sender;
  try {
    sender = await prisma.sender.findUnique({ where: { id: senderId } });
  } catch (err) {
    console.error('Sender lookup failed:', err);
    res.status(500).json({ error: 'Failed to verify sender.' });
    return;
  }

  if (!sender) {
    res.status(404).json({ error: 'Sender not found.' });
    return;
  }
  if (sender.userId !== DEV_USER_ID) {
    res.status(403).json({ error: 'Sender does not belong to the current user.' });
    return;
  }

  // --- Create campaign + jobs ---
  try {
    const { campaign, emailJobs } = await createCampaign({
      senderId,
      subject,
      body,
      recipients,
      startTime: parsedStart,
      delayBetweenEmails: delay,
      hourlyLimit: limit,
    });

    res.status(201).json({
      campaignId: campaign.id,
      subject: campaign.subject,
      startTime: campaign.startTime,
      delayBetweenEmails: campaign.delayBetweenEmails,
      hourlyLimit: campaign.hourlyLimit,
      totalRecipients: emailJobs.length,
      emailJobs: emailJobs.map((job) => ({
        id: job.id,
        recipient: job.recipient,
        scheduledAt: job.scheduledAt,
        status: job.status,
      })),
    });
  } catch (err) {
    console.error('Failed to create campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign. Please try again.' });
  }
});

// GET /api/emails/scheduled
// Returns PENDING email jobs for the current user, sorted by scheduledAt ascending.
router.get('/emails/scheduled', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query['limit']) || 50, 200);
  const offset = Number(req.query['offset']) || 0;

  if (isNaN(limit) || isNaN(offset) || limit < 1 || offset < 0) {
    res.status(400).json({ error: 'limit must be >= 1 and offset must be >= 0.' });
    return;
  }

  try {
    const jobs = await getScheduledEmails(limit, offset);
    res.json({ jobs, limit, offset });
  } catch (err) {
    console.error('Failed to fetch scheduled emails:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled emails.' });
  }
});

// GET /api/emails/sent
// Returns SENT email jobs for the current user, sorted by sentAt descending.
router.get('/emails/sent', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query['limit']) || 50, 200);
  const offset = Number(req.query['offset']) || 0;

  if (isNaN(limit) || isNaN(offset) || limit < 1 || offset < 0) {
    res.status(400).json({ error: 'limit must be >= 1 and offset must be >= 0.' });
    return;
  }

  try {
    const jobs = await getSentEmails(limit, offset);
    res.json({ jobs, limit, offset });
  } catch (err) {
    console.error('Failed to fetch sent emails:', err);
    res.status(500).json({ error: 'Failed to fetch sent emails.' });
  }
});

// GET /api/emails/search?q=<query>&status=<SENT|PENDING|...>
// Full-text search over the authenticated user's email jobs using Elasticsearch.
// - q: search term (optional; empty returns recent emails)
// - status: filter by EmailJob status (optional; must be a valid status)
// - limit: page size (default 20, max 100)
// - offset: pagination offset (default 0)
router.get('/emails/search', async (req: Request, res: Response) => {
  const q = typeof req.query['q'] === 'string' ? req.query['q'] : '';
  const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
  const limit = Math.min(Number(req.query['limit']) || 20, 100);
  const offset = Number(req.query['offset']) || 0;

  if (isNaN(limit) || isNaN(offset) || limit < 1 || offset < 0) {
    res.status(400).json({ error: 'limit must be >= 1 and offset must be >= 0.' });
    return;
  }

  try {
    const { items, total } = await searchEmails({
      userId: DEV_USER_ID,
      q,
      status,
      limit,
      offset,
    });
    res.json({ items, total });
  } catch (err) {
    // Surface validation errors (bad status value) as 400; everything else as 500.
    if (err instanceof Error && err.message.startsWith('Invalid status filter')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Failed to search emails:', err);
    res.status(500).json({ error: 'Failed to search emails.' });
  }
});

export default router;
