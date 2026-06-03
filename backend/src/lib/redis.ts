import { createClient } from 'redis';
import { logger } from '../utils/logger';

type RedisClient = ReturnType<typeof createClient>;

// Create client only if REDIS_URL is provided, otherwise stub out to avoid undefined errors during imports
const noopClient = {
  on: () => {},
  connect: async () => {},
  sendCommand: async () => '',
} as unknown as RedisClient;

export const redisClient: RedisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : noopClient;

if (process.env.REDIS_URL) {
  redisClient.on('error', (err: Error) => logger.error('Redis Client Error', err));

  // Connect automatically when imported, but catch errors to prevent app crash if Redis is down
  if (process.env.NODE_ENV !== 'test') {
    redisClient.connect().catch(console.error);
  }
}
