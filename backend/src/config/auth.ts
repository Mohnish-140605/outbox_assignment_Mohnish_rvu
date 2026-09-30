export interface SessionConfig {
  sessionSecret: string;
  frontendOrigin: string;
}

export interface GoogleOAuthConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set in backend/.env`);
  }
  return value;
}

export function getFrontendOrigin(): string {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
}

export function getSessionConfig(): SessionConfig {
  const sessionSecret = required('SESSION_SECRET');
  if (sessionSecret.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters');
  }

  return {
    sessionSecret,
    frontendOrigin: getFrontendOrigin(),
  };
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    googleClientId: required('GOOGLE_CLIENT_ID'),
    googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
    googleCallbackUrl: required('GOOGLE_CALLBACK_URL'),
  };
}

export interface SlackOAuthConfig {
  slackClientId: string;
  slackClientSecret: string;
  slackCallbackUrl: string;
}

export function getSlackOAuthConfig(): SlackOAuthConfig {
  return {
    slackClientId: required('SLACK_CLIENT_ID'),
    slackClientSecret: required('SLACK_CLIENT_SECRET'),
    slackCallbackUrl: required('SLACK_CALLBACK_URL'),
  };
}
