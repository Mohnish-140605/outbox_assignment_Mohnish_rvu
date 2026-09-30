import prisma from '../db';
import type { AuthUser } from '../auth/authUser';

export interface GoogleProfile {
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Find or create the application User for a Google account.
 * googleId is unique — the same Google account never gets two rows.
 * Name, email, and avatar are refreshed on each successful login.
 */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<AuthUser> {
  const user = await prisma.user.upsert({
    where: { googleId: profile.googleId },
    create: {
      googleId: profile.googleId,
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    },
    update: {
      name: profile.name,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      slackWebhookUrl: true,
      slackTeamName: true,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    slackConnected: Boolean(user.slackWebhookUrl),
    slackTeamName: user.slackTeamName,
  };
}
