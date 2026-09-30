import { randomBytes } from 'crypto';
import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { getFrontendOrigin, getGoogleOAuthConfig } from '../config/auth';
import { requireAuth } from '../middleware/requireAuth';
import { upsertGoogleUser } from '../services/userService';

const router = Router();

const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

function oauthClient(): OAuth2Client {
  const config = getGoogleOAuthConfig();
  return new OAuth2Client(
    config.googleClientId,
    config.googleClientSecret,
    config.googleCallbackUrl
  );
}

function redirectToFrontend(res: Response, pathname = '/', query?: string): void {
  const origin = getFrontendOrigin();
  const url = query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
  res.redirect(url);
}

function clearOauthState(req: Request): void {
  delete req.session.oauthState;
}

// GET /auth/google — start the authorization-code flow.
router.get('/google', (req: Request, res: Response) => {
  let client: OAuth2Client;
  try {
    client = oauthClient();
  } catch {
    console.error('Google OAuth is not configured on the server');
    redirectToFrontend(res, '/', 'error=auth_not_configured');
    return;
  }

  const state = randomBytes(32).toString('hex');
  req.session.oauthState = state;

  const url = client.generateAuthUrl({
    access_type: 'online',
    prompt: 'select_account',
    scope: GOOGLE_SCOPES,
    state,
  });

  req.session.save((err) => {
    if (err) {
      console.error('Failed to persist OAuth state in session');
      redirectToFrontend(res, '/', 'error=auth_failed');
      return;
    }
    res.redirect(url);
  });
});

// GET /auth/google/callback — Google redirects here with ?code=
router.get('/google/callback', async (req: Request, res: Response) => {
  const googleError = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (googleError) {
    clearOauthState(req);
    redirectToFrontend(res, '/', 'error=auth_denied');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const expectedState = req.session.oauthState;

  if (!code || !state || !expectedState || state !== expectedState) {
    clearOauthState(req);
    redirectToFrontend(res, '/', 'error=auth_failed');
    return;
  }

  clearOauthState(req);

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      redirectToFrontend(res, '/', 'error=auth_failed');
      return;
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: getGoogleOAuthConfig().googleClientId,
    });
    const payload = ticket.getPayload();

    const googleId = payload?.sub;
    const email = payload?.email;
    if (!googleId || !email) {
      redirectToFrontend(res, '/', 'error=auth_failed');
      return;
    }

    const user = await upsertGoogleUser({
      googleId,
      email,
      name: payload.name?.trim() || email,
      avatarUrl: payload.picture ?? null,
    });

    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Failed to regenerate session after login');
        redirectToFrontend(res, '/', 'error=auth_failed');
        return;
      }

      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Failed to save authenticated session');
          redirectToFrontend(res, '/', 'error=auth_failed');
          return;
        }
        redirectToFrontend(res, '/');
      });
    });
  } catch (err) {
    console.error('Google OAuth callback failed');
    if (err instanceof Error) {
      console.error(err.message);
    }
    redirectToFrontend(res, '/', 'error=auth_failed');
  }
});

function destroySession(req: Request, res: Response, redirect: boolean): void {
  req.session.destroy((err) => {
    res.clearCookie('reachinbox.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    if (err) {
      console.error('Failed to destroy session on logout');
      if (redirect) {
        redirectToFrontend(res, '/', 'error=logout_failed');
        return;
      }
      res.status(500).json({ error: 'Failed to log out.' });
      return;
    }

    if (redirect) {
      redirectToFrontend(res, '/');
      return;
    }
    res.status(204).end();
  });
}

// POST /auth/logout — SPA logout; invalidates the server session.
router.post('/logout', (req: Request, res: Response) => {
  destroySession(req, res, false);
});

// GET /auth/logout — full-page logout (clears session, returns to the app).
router.get('/logout', (req: Request, res: Response) => {
  destroySession(req, res, true);
});

// GET /auth/me — current application user (no secrets, no OAuth tokens).
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(req.user);
});

export default router;
