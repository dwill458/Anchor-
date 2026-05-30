import { createClient } from 'redis';
import { logger } from '../utils/logger';

// Create client only if REDIS_URL is provided, otherwise mock a basic client structure to avoid undefined/null TS errors during imports
export const redisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : {
      on: () => {},
      connect: async () => {},
      sendCommand: async () => { return '' as any; }
    } as any;

if (process.env.REDIS_URL) {
  redisClient.on('error', (err: any) => logger.error('Redis Client Error', err));

  // Connect automatically when imported, but catch errors to prevent app crash if Redis is down
  if (process.env.NODE_ENV !== 'test') {
    redisClient.connect().catch(console.error);
  }
}

