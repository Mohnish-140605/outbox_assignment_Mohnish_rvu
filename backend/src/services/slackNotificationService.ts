import prisma from '../db';

export async function getUnreadSlackNotifications(userId: string, limit: number) {
  const [notifications, user] = await Promise.all([
    prisma.slackNotification.findMany({
      where: { userId, acknowledgedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        createdAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { slackTeamId: true, slackChannelId: true },
    }),
  ]);

  const destinationUrl = user?.slackTeamId && user.slackChannelId
    ? createSlackChannelUrl(user.slackTeamId, user.slackChannelId)
    : null;

  return notifications.map((notification) => ({
    ...notification,
    destinationUrl,
  }));
}

export async function acknowledgeSlackNotifications(userId: string, ids: string[]) {
  const result = await prisma.slackNotification.updateMany({
    where: { userId, id: { in: ids }, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });

  return result.count;
}

function createSlackChannelUrl(teamId: string, channelId: string): string {
  const url = new URL('https://slack.com/app_redirect');
  url.searchParams.set('channel', channelId);
  url.searchParams.set('team', teamId);
  return url.toString();
}