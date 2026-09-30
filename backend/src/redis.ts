import { createClient } from 'redis';

// Create a single shared Redis client instance using the REDIS_URL from env.
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redisClient;
