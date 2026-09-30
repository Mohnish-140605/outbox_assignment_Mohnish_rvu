import nodemailer from 'nodemailer';

// The exact fields stored in Sender.smtpConfig (server-side only).
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SendEmailInput {
  smtpConfig: SmtpConfig;
  from: string;
  to: string;
  subject: string;
  text: string;
}

export interface SendEmailResult {
  messageId: string;
  // Ethereal returns a preview URL; undefined when using a real SMTP provider.
  previewUrl: string | undefined;
}

/**
 * Sends one email through the given SMTP configuration.
 *
 * Returns the message ID and, for Ethereal, a preview URL.
 * Never logs or returns the SMTP password.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { smtpConfig, from, to, subject, text } = input;

  const transport = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    // Ethereal uses STARTTLS on port 587 with secure: false.
    // Real providers using TLS on port 465 would need secure: true.
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl === false ? undefined : previewUrl,
  };
}
