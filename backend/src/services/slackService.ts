import prisma from '../db';
import redisClient from '../redis';

export interface RateLimitSlackPayload {
  userId: string;
  senderId: string;
  senderEmail: string;
  hourlyLimit: number;
}

interface SlackOAuthAccessResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  incoming_webhook?: {
    url?: string;
    channel?: string;
  };
  team?: {
    name?: string;
  };
}

export async function exchangeSlackCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  webhookUrl: string;
  teamName: string | null;
  channel: string | null;
}> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await response.json()) as SlackOAuthAccessResponse;
  if (!data.ok || !data.access_token) {
    throw new Error(data.error ?? 'slack_oauth_failed');
  }

  const webhookUrl = data.incoming_webhook?.url;
  if (!webhookUrl) {
    throw new Error('missing_incoming_webhook');
  }

  return {
    accessToken: data.access_token,
    webhookUrl,
    teamName: data.team?.name ?? null,
    channel: data.incoming_webhook?.channel ?? null,
  };
}

export async function saveSlackConnection(
  userId: string,
  connection: {
    accessToken: string;
    webhookUrl: string;
    teamName: string | null;
    channel: string | null;
  }
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      slackAccessToken: connection.accessToken,
      slackWebhookUrl: connection.webhookUrl,
      slackTeamName: connection.teamName,
      slackChannel: connection.channel,
    },
  });
}

export async function clearSlackConnection(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      slackAccessToken: null,
      slackWebhookUrl: null,
      slackTeamName: null,
      slackChannel: null,
    },
  });
}

/**
 * Posts a Slack message the first time a sender hits their hourly cap in the
 * current UTC hour. Later blocked jobs in the same window are silent.
 * Missing Slack connections and Slack API errors never throw.
 */
export async function notifySenderHourlyLimitReached(
  payload: RateLimitSlackPayload
): Promise<void> {
  const hourStr = new Date().toISOString().substring(0, 13);
  const dedupeKey = `reachinbox:slack:rl:${payload.senderId}:${hourStr}`;

  try {
    const claimed = await redisClient.set(dedupeKey, '1', { NX: true, EX: 3600 });
    if (claimed !== 'OK') {
      return;
    }
  } catch (err) {
    console.error('Slack rate-limit notify: Redis dedupe failed:', err);
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { slackWebhookUrl: true },
    });

    const webhookUrl = user?.slackWebhookUrl;
    if (!webhookUrl) {
      return;
    }

    const text =
      `ReachInbox hourly send limit reached for ${payload.senderEmail}. ` +
      `Cap is ${payload.hourlyLimit} emails/hour. Remaining jobs for this sender ` +
      `are delayed into the next hour window (UTC ${hourStr}).`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error(
        `Slack rate-limit notify: webhook returned HTTP ${response.status}`
      );
    }
  } catch (err) {
    console.error('Slack rate-limit notify failed:', err);
  }
}
