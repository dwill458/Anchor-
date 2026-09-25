import { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { randomUUID } from 'crypto';
import { AuthRequest, DEV_MASTER_UID } from './auth';
import { redisClient } from '../../lib/redis';
import { logger } from '../../utils/logger';

export type AiFeature =
  | 'chart'
  | 'chart_adjust'
  | 'vision'
  | 'vision_ref'
  | 'anchor'
  | 'planning'
  | 'global';

export const DEFAULT_AI_DEV_ALLOWLIST = ['deontrezwilliams@gmail.com'];

/**
 * Returns the configured set of developer account emails entitled to elevated AI limits.
 * Authenticated server-side identity (verified email) is required; client-supplied
 * parameters or bypass headers are never trusted.
 */
export function getAiDevAllowlist(): Set<string> {
  const envVal = process.env.AI_DEV_ALLOWLIST;
  const list = new Set<string>(DEFAULT_AI_DEV_ALLOWLIST.map(e => e.toLowerCase().trim()));
  if (envVal) {
    envVal
      .split(/[,\s]+/)
      .map(e => e.toLowerCase().trim())
      .filter(Boolean)
      .forEach(e => list.add(e));
  }
  return list;
}

/**
 * Check if the request belongs to an authorized developer account.
 * Uses authenticated server-side user email only (e.g. from verified Firebase JWT).
 */
export function isAiDeveloper(req: Request): boolean {
  const authReq = req as AuthRequest;
  if (authReq.user?.uid === DEV_MASTER_UID) {
    return true;
  }
  const email = authReq.user?.email?.toLowerCase().trim();
  if (!email) {
    return false;
  }
  return getAiDevAllowlist().has(email);
}

export interface AiLimiterOptions {
  feature: AiFeature;
  windowMs: number;
  prodLimit: number;
  devLimit: number;
  keyPrefix: string;
  message: string;
}

export function createAiRateLimiter(options: AiLimiterOptions): RateLimitRequestHandler {
  const { feature, windowMs, prodLimit, devLimit, keyPrefix, message } = options;

  const isTest = process.env.NODE_ENV === 'test';
  const hasRedis = Boolean(process.env.REDIS_URL);

  const store =
    isTest || !hasRedis
      ? undefined
      : new RedisStore({
          prefix: keyPrefix,
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        });

  return rateLimit({
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    max: (req: Request) => {
      return isAiDeveloper(req) ? devLimit : prodLimit;
    },
    keyGenerator: (req: Request) => {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.uid || authReq.dbUser?.id;
      if (userId) {
        return `${keyPrefix}${userId}`;
      }
      return `${keyPrefix}ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
    handler: (req: Request, res: Response) => {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.uid || authReq.dbUser?.id;
      const isDev = isAiDeveloper(req);
      const reqWithRateLimit = req as Request & {
        rateLimit?: { resetTime?: Date; current?: number; limit?: number; remaining?: number };
      };
      const resetTime = reqWithRateLimit.rateLimit?.resetTime;
      const retryAfterSeconds = Math.max(
        1,
        resetTime
          ? Math.ceil((resetTime.getTime() - Date.now()) / 1000)
          : Math.ceil(windowMs / 1000)
      );

      res.setHeader('Retry-After', String(retryAfterSeconds));

      const requestId = (req.headers['x-request-id'] as string) || randomUUID();
      logger.warn('[RateLimit] AI rate limit exceeded', {
        feature,
        userId: userId ?? 'anonymous',
        email: authReq.user?.email,
        isDeveloper: isDev,
        limiter: `${feature}_limiter`,
        retryAfterSeconds,
        requestId,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'AI_RATE_LIMITED',
          message,
          feature,
          retryAfterSeconds,
        },
      });
    },
  });
}

// ============================================================================
// Concrete Feature Rate Limiters
// ============================================================================

// 1. Chart generation:
// Prod: 20 per 10 minutes | Dev: 150 per 15 minutes (~100-150 / 10 min)
export const chartPlanLimiter = createAiRateLimiter({
  feature: 'chart',
  windowMs: 10 * 60 * 1000,
  prodLimit: 20,
  devLimit: 150,
  keyPrefix: 'rl:ai:chart:',
  message: "We couldn't build your route right now. Your progress is saved, so you can try again shortly.",
});

// 2. Chart regeneration / adjustment / suggest-moves:
// Prod: 10 per 10 minutes | Dev: 100 per 10 minutes
export const chartAdjustLimiter = createAiRateLimiter({
  feature: 'chart_adjust',
  windowMs: 10 * 60 * 1000,
  prodLimit: 10,
  devLimit: 100,
  keyPrefix: 'rl:ai:chart_adjust:',
  message: 'Chart route adjustment limit reached. Please try again shortly.',
});

// 3. Vision image generation (more conservative due to cost):
// Prod: 8 per 10 minutes | Dev: 60 per 10 minutes
export const visionGenerationLimiter = createAiRateLimiter({
  feature: 'vision',
  windowMs: 10 * 60 * 1000,
  prodLimit: 8,
  devLimit: 60,
  keyPrefix: 'rl:ai:vision:',
  message: 'Image creation limit reached. Please try again shortly.',
});

// 4. Vision appearance reference:
// Prod: 10 per 10 minutes | Dev: 100 per 10 minutes
export const visionAppearanceLimiter = createAiRateLimiter({
  feature: 'vision_ref',
  windowMs: 10 * 60 * 1000,
  prodLimit: 10,
  devLimit: 100,
  keyPrefix: 'rl:ai:vision_ref:',
  message: 'Appearance reference limit reached. Please try again shortly.',
});

// 5. Anchor AI enhancement / generation:
// Prod: 15 per 10 minutes | Dev: 120 per 10 minutes
export const anchorEnhanceLimiter = createAiRateLimiter({
  feature: 'anchor',
  windowMs: 10 * 60 * 1000,
  prodLimit: 15,
  devLimit: 120,
  keyPrefix: 'rl:ai:anchor:',
  message: 'Anchor AI enhancement limit reached. Please try again shortly.',
});

// 6. Lightweight AI planning / text / scene planning:
// Prod: 40 per 10 minutes | Dev: 200 per 10 minutes
export const aiPlanningLimiter = createAiRateLimiter({
  feature: 'planning',
  windowMs: 10 * 60 * 1000,
  prodLimit: 40,
  devLimit: 200,
  keyPrefix: 'rl:ai:planning:',
  message: 'AI planning limit reached. Please try again shortly.',
});

// 7. Global safety ceiling across all AI features:
// Prod: 100 per 15 minutes | Dev: 250 per 15 minutes
export const globalAiCeilingLimiter = createAiRateLimiter({
  feature: 'global',
  windowMs: 15 * 60 * 1000,
  prodLimit: 100,
  devLimit: 250,
  keyPrefix: 'rl:ai:global:',
  message: 'Overall AI request ceiling reached. Please try again shortly.',
});

// ============================================================================
// Concurrency Protection
// ============================================================================

/**
 * Creates in-flight concurrency protection middleware for expensive generations.
 * If a request is already running for the same user/key, rejects duplicate submission cleanly
 * with HTTP 409 and machine-readable code.
 */
export function createConcurrencyGuard(
  feature: AiFeature,
  errorCode: string,
  errorMessage: string,
  keyResolver: (req: Request) => string | null
) {
  const activeKeys = new Set<string>();

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = keyResolver(req);
    if (!key) {
      next();
      return;
    }

    if (activeKeys.has(key)) {
      logger.info(`[Concurrency] Rejected duplicate generation for key: ${key}`, {
        feature,
        key,
      });
      res.status(409).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
          feature,
        },
      });
      return;
    }

    activeKeys.add(key);

    const cleanup = () => {
      activeKeys.delete(key);
      res.removeListener('finish', cleanup);
      res.removeListener('close', cleanup);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };

  middleware._activeKeys = activeKeys;
  return middleware;
}

export const chartPlanConcurrencyGuard = createConcurrencyGuard(
  'chart',
  'CHART_PLAN_IN_PROGRESS',
  'A route plan is currently being generated. Please wait for it to complete.',
  req => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.uid || authReq.dbUser?.id;
    const anchorId = req.params?.anchorId;
    return userId ? `chart:${userId}:${anchorId || 'any'}` : null;
  }
);

export const anchorEnhanceConcurrencyGuard = createConcurrencyGuard(
  'anchor',
  'AI_ENHANCE_IN_PROGRESS',
  'An AI enhancement is already in progress. Please wait for it to complete.',
  req => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.uid || authReq.dbUser?.id;
    if (userId) return `enhance:${userId}`;
    const ip = ipKeyGenerator(req.ip ?? '');
    return ip ? `enhance:ip:${ip}` : null;
  }
);
