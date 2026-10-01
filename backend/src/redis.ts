import { createClient } from 'redis';
import { backendConfig } from './config/runtime';

// Create a single shared Redis client instance using the validated runtime config.
const redisClient = createClient({
  url: backendConfig.redisUrl,
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redisClient;
