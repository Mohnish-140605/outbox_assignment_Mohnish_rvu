import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function readString(name: string, fallback?: string): string | undefined {
  const value = process.env[name]?.trim();
  if (value && value.length > 0) {
    return value;
  }

  return fallback;
}

export const backendConfig = {
  nodeEnv: readString('NODE_ENV', 'development') ?? 'development',
  port: Number(readString('PORT', '4000') ?? '4000'),
  frontendOrigin: (readString('FRONTEND_ORIGIN', 'http://localhost:5173') ?? 'http://localhost:5173').replace(/\/$/, ''),
  trustProxy: readString('TRUST_PROXY', '0') === '1',
  redisUrl: readString('REDIS_URL', 'redis://localhost:6379') ?? 'redis://localhost:6379',
  elasticsearchUrl: readString('ELASTICSEARCH_URL', 'http://localhost:9200') ?? 'http://localhost:9200',
  elasticsearchApiKey: readString('ELASTICSEARCH_API_KEY'),
  etherealHost: readString('ETHEREAL_HOST', 'smtp.ethereal.email') ?? 'smtp.ethereal.email',
  etherealPort: Number(readString('ETHEREAL_PORT', '587') ?? '587'),
  etherealUser: readString('ETHEREAL_USER'),
  etherealPassword: readString('ETHEREAL_PASSWORD'),
  emailWorkerConcurrencyRaw: readString('EMAIL_WORKER_CONCURRENCY'),
};

export function getEmailWorkerConcurrency(): number {
  const value = backendConfig.emailWorkerConcurrencyRaw;
  const parsed = value !== undefined ? Number(value) : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return 5;
}

export function isSecureSessionCookie(): boolean {
  return backendConfig.nodeEnv === 'production';
}
