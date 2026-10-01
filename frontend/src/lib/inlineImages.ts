export const MAX_INLINE_IMAGE_BYTES = 2 * 1024 * 1024;

const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/i;
const EMBEDDED_IMAGE = /<img\b[^>]*\bsrc=["'](data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2}))["'][^>]*>/gi;

export function getImageDataUrlBytes(value: string): number | null {
  const match = IMAGE_DATA_URL.exec(value);
  if (!match || match[1].length % 4 !== 0) {
    return null;
  }

  const padding = match[1].endsWith('==') ? 2 : match[1].endsWith('=') ? 1 : 0;
  return Math.floor((match[1].length * 3) / 4) - padding;
}

export function getInlineImageBytes(html: string): number {
  let total = 0;
  for (const match of html.matchAll(EMBEDDED_IMAGE)) {
    const bytes = getImageDataUrlBytes(match[1]);
    if (bytes !== null) total += bytes;
  }
  return total;
}