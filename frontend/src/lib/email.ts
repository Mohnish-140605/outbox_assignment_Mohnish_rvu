export const EMAIL_REGEX = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}
