import { randomUUID } from 'crypto';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { htmlToText } from 'html-to-text';

const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;
const HTML_MARKUP_PATTERN = /<\/?(?:p|h[1-6]|strong|b|em|i|u|s|ul|ol|li|a|blockquote|br|img)\b[^>]*>/i;
const INLINE_IMAGE_PATTERN = /(<img\b[^>]*?\bsrc=["'])(data:image\/([^;]+);base64,([^"']+))(["'][^>]*>)/gi;
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

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

function prepareEmailContent(body: string): {
  text: string;
  html?: string;
  attachments?: SendMailOptions['attachments'];
} {
  if (!HTML_MARKUP_PATTERN.test(body)) {
    return { text: body };
  }

  const attachments: NonNullable<SendMailOptions['attachments']> = [];
  let totalImageBytes = 0;
  let html = body.replace(
    INLINE_IMAGE_PATTERN,
    (imageTag, prefix: string, dataUrl: string, subtype: string, encoded: string, suffix: string) => {
      const contentType = `image/${subtype.toLowerCase()}`;
      const extension = IMAGE_TYPES[contentType];
      if (!extension || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
        throw new Error('Embedded images must be valid PNG, JPEG, GIF, or WebP files.');
      }

      const content = Buffer.from(encoded, 'base64');
      totalImageBytes += content.byteLength;
      if (totalImageBytes > MAX_INLINE_IMAGE_BYTES) {
        throw new Error('Embedded images cannot exceed 2 MB per email.');
      }

      const contentId = randomUUID();
      attachments.push({
        filename: `inline-image.${extension}`,
        content,
        contentType,
        cid: contentId,
      });
      return `${prefix}cid:${contentId}${suffix}`;
    }
  );

  if (/<img\b[^>]*\bsrc=["']data:image\//i.test(html)) {
    throw new Error('Embedded images must be valid PNG, JPEG, GIF, or WebP files.');
  }

  const text = htmlToText(html, { wordwrap: 100 });
  return {
    text,
    html,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

/**
 * Sends one email through the given SMTP configuration.
 *
 * Returns the message ID and, for Ethereal, a preview URL.
 * Never logs or returns the SMTP password.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { smtpConfig, from, to, subject, text } = input;
  const content = prepareEmailContent(text);

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
    ...content,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl === false ? undefined : previewUrl,
  };
}
