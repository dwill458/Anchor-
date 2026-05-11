import { createClient } from 'redis';
import { logger } from '../utils/logger';

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', err => logger.error('Redis Client Error', err));

// Connect automatically when imported, but catch errors to prevent app crash if Redis is down
if (process.env.NODE_ENV !== 'test') {
  redisClient.connect().catch(console.error);
}
