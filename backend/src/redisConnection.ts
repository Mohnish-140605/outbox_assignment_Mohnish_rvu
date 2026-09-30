// BullMQ (>=5) supports node-redis clients directly via an adapter.
// We import the already-configured node-redis client and export it for
// use as the `connection` option in the BullMQ Queue and Worker.
// This avoids maintaining two separate Redis connections.
import redisClient from './redis';

export const redisConnection = redisClient;
