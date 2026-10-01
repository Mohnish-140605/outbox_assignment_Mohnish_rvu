import { Router, Request, Response } from 'express';
import { getAuthenticatedUser, requireAuth } from '../middleware/requireAuth';
import {
  acknowledgeSlackNotifications,
  getUnreadSlackNotifications,
} from '../services/slackNotificationService';

const router = Router();
const MAX_NOTIFICATION_LIMIT = 50;
const MAX_ACKNOWLEDGEMENT_IDS = 50;

router.use(requireAuth);
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get('/notifications/slack', async (req: Request, res: Response) => {
  const limit = Number(req.query['limit'] ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_NOTIFICATION_LIMIT) {
    res.status(400).json({ error: `limit must be between 1 and ${MAX_NOTIFICATION_LIMIT}.` });
    return;
  }

  try {
    const notifications = await getUnreadSlackNotifications(
      getAuthenticatedUser(req).id,
      limit
    );
    res.json({ notifications, limit });
  } catch (err) {
    console.error('Failed to fetch Slack notifications:', err);
    res.status(500).json({ error: 'Failed to fetch Slack notifications.' });
  }
});

router.post('/notifications/slack/acknowledge', async (req: Request, res: Response) => {
  const ids: unknown = req.body?.ids;
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > MAX_ACKNOWLEDGEMENT_IDS ||
    ids.some((id) => typeof id !== 'string' || id.length > 128)
  ) {
    res.status(400).json({
      error: `ids must contain between 1 and ${MAX_ACKNOWLEDGEMENT_IDS} notification IDs.`,
    });
    return;
  }

  try {
    const acknowledged = await acknowledgeSlackNotifications(
      getAuthenticatedUser(req).id,
      ids
    );
    res.json({ acknowledged });
  } catch (err) {
    console.error('Failed to acknowledge Slack notifications:', err);
    res.status(500).json({ error: 'Failed to acknowledge Slack notifications.' });
  }
});

export default router;