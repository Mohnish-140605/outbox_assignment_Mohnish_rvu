import { randomBytes } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { getFrontendOrigin, getSlackOAuthConfig } from '../config/auth';
import { requireAuth, getAuthenticatedUser } from '../middleware/requireAuth';
import {
  clearSlackConnection,
  exchangeSlackCode,
  saveSlackConnection,
} from '../services/slackService';

const router = Router();

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_SCOPES = 'incoming-webhook';

function redirectToFrontend(res: Response, pathname = '/', query?: string): void {
  const origin = getFrontendOrigin();
  const url = query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
  res.redirect(url);
}

function requireLoggedInRedirect(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    redirectToFrontend(res, '/', 'error=auth_failed');
    return;
  }
  next();
}

// GET /auth/slack — start Slack OAuth (incoming webhook).
router.get('/slack', requireLoggedInRedirect, (req: Request, res: Response) => {
  let config;
  try {
    config = getSlackOAuthConfig();
  } catch {
    console.error('Slack OAuth is not configured on the server');
    redirectToFrontend(res, '/compose', 'error=slack_not_configured');
    return;
  }

  const state = randomBytes(32).toString('hex');
  req.session.slackOauthState = state;

  const params = new URLSearchParams({
    client_id: config.slackClientId,
    scope: SLACK_SCOPES,
    redirect_uri: config.slackCallbackUrl,
    state,
  });

  const url = `${SLACK_AUTHORIZE_URL}?${params.toString()}`;

  req.session.save((err) => {
    if (err) {
      console.error('Failed to persist Slack OAuth state in session');
      redirectToFrontend(res, '/compose', 'error=slack_failed');
      return;
    }
    res.redirect(url);
  });
});

// GET /auth/slack/callback
router.get('/slack/callback', async (req: Request, res: Response) => {
  const userId = req.session.userId;
  if (!userId) {
    redirectToFrontend(res, '/', 'error=auth_failed');
    return;
  }

  const slackError = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (slackError) {
    delete req.session.slackOauthState;
    redirectToFrontend(res, '/compose', 'error=slack_denied');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const expectedState = req.session.slackOauthState;

  delete req.session.slackOauthState;

  if (!code || !state || !expectedState || state !== expectedState) {
    redirectToFrontend(res, '/compose', 'error=slack_failed');
    return;
  }

  try {
    const config = getSlackOAuthConfig();
    const connection = await exchangeSlackCode(
      code,
      config.slackClientId,
      config.slackClientSecret,
      config.slackCallbackUrl
    );
    await saveSlackConnection(userId, connection);
    redirectToFrontend(res, '/compose', 'slack=connected');
  } catch (err) {
    console.error('Slack OAuth callback failed');
    if (err instanceof Error) {
      console.error(err.message);
    }
    redirectToFrontend(res, '/compose', 'error=slack_failed');
  }
});

// POST /auth/slack/disconnect
router.post('/slack/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    await clearSlackConnection(getAuthenticatedUser(req).id);
    res.status(204).end();
  } catch (err) {
    console.error('Failed to disconnect Slack:', err);
    res.status(500).json({ error: 'Failed to disconnect Slack.' });
  }
});

export default router;
