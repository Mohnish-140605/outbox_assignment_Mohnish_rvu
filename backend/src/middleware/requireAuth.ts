import { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import type { AuthUser } from '../auth/authUser';

export function getAuthenticatedUser(req: Request): AuthUser {
  if (!req.user) {
    throw new Error('Request is not authenticated');
  }
  return req.user;
}

/**
 * Resolves the application User from the server-side session.
 * The session userId is authoritative — client-supplied IDs are ignored.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        slackWebhookUrl: true,
        slackTeamName: true,
      },
    });

    if (!row) {
      req.session.destroy(() => {
        res.status(401).json({ error: 'Unauthorized' });
      });
      return;
    }

    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatarUrl,
      slackConnected: Boolean(row.slackWebhookUrl),
      slackTeamName: row.slackTeamName,
    };
    next();
  } catch (err) {
    console.error('Failed to resolve authenticated user:', err);
    res.status(500).json({ error: 'Failed to authenticate request.' });
  }
}
