import prisma from '../db';
import { backendConfig } from '../config/runtime';

export interface PublicSender {
  id: string;
  email: string;
  label: string | null;
}

/**
 * Ensures the authenticated user has one Ethereal-backed sender.
 * SMTP credentials stay on the server and are never returned to the client.
 */
export async function ensureEtherealSender(userId: string): Promise<PublicSender> {
  const etherealUser = backendConfig.etherealUser;
  const etherealPass = backendConfig.etherealPassword;
  const etherealHost = backendConfig.etherealHost;
  const etherealPort = backendConfig.etherealPort;

  if (!etherealUser || !etherealPass) {
    throw new Error('ETHEREAL_NOT_CONFIGURED');
  }

  const smtpConfig = {
    host: etherealHost,
    port: etherealPort,
    user: etherealUser,
    pass: etherealPass,
  };

  const existing = await prisma.sender.findFirst({ where: { userId } });
  if (existing) {
    const updated = await prisma.sender.update({
      where: { id: existing.id },
      data: { email: etherealUser, smtpConfig },
      select: { id: true, email: true, label: true },
    });
    return updated;
  }

  return prisma.sender.create({
    data: {
      userId,
      email: etherealUser,
      label: 'Ethereal SMTP',
      smtpConfig,
    },
    select: { id: true, email: true, label: true },
  });
}
