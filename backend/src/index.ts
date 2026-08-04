/**
 * Anchor App - Backend API Server
 *
 * Main entry point for the Express server.
 */

import express, { Application, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './api/routes/auth';
import usersRoutes from './api/routes/users';
import anchorRoutes from './api/routes/anchors';
import aiRoutes from './api/routes/ai';
import practiceRoutes from './api/routes/practice';
import visualizationSceneRoutes from './api/routes/visualizationScenes';
import orderRoutes from './api/routes/orders';
import contentRoutes from './api/routes/content';
import billingRoutes from './api/routes/billing';
import courseRoutes from './api/routes/courses';
import coursePlanRoutes from './api/routes/coursePlans';
import reflectionRoutes from './api/routes/reflections';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';
import { logger } from './utils/logger';
import { scrubSentryEvent } from './utils/sentryPrivacy';
import { env } from './config/env';
import { prisma } from './lib/prisma';

// Load environment variables
dotenv.config();

// Validate environment variables (imported env.ts automatically validates)

const sentryEnabled = Boolean(env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    integrations: [Sentry.expressIntegration()],
    beforeSend: scrubSentryEvent,
  });
}

// ============================================================================
// Process-level error handlers — must be registered before any async work
// ============================================================================

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception — shutting down', error);
  if (sentryEnabled) {
    Sentry.captureException(error);
    void Sentry.close(2_000).finally(() => process.exit(1));
    return;
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('Unhandled promise rejection — shutting down', error);
  if (sentryEnabled) {
    Sentry.captureException(error);
    void Sentry.close(2_000).finally(() => process.exit(1));
    return;
  }
  process.exit(1);
});

const app: Application = express();
const PORT = env.PORT;

// Trust Railway's proxy so req.ip reflects the real client and
// express-rate-limit can read X-Forwarded-For safely.
app.set('trust proxy', 1);

const legacyRequestHandler = sentryEnabled
  ? (
      Sentry as typeof Sentry & {
        Handlers?: { requestHandler?: () => express.RequestHandler };
      }
    ).Handlers?.requestHandler?.()
  : undefined;

// ============================================================================
// Middleware
// ============================================================================

if (legacyRequestHandler) {
  app.use(legacyRequestHandler);
}

// High-level security headers
app.use(helmet());

// CORS configuration — restricted in production; no wildcard default.
// In development/test with no ALLOWED_ORIGINS set, allow localhost only.
const rawAllowedOrigins = env.ALLOWED_ORIGINS;
const allowedOrigins: string[] = rawAllowedOrigins
  ? rawAllowedOrigins
      .split(',')
      .map(o => o.trim())
      .filter(Boolean)
  : env.NODE_ENV === 'production'
    ? [] // No origins allowed until explicitly configured — fail safe
    : ['http://localhost:3000', 'http://localhost:8081'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (React Native, server-to-server,
      // curl) are not browser cross-origin requests — CORS does not apply.
      // Blocking them here would break the primary mobile client in production.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Profile-picture uploads send base64 image bodies (validated up to 5MB raw in
// StorageService). Base64 inflates payloads by ~33%, so this route needs a larger
// body limit than the global parser. Registered first so it consumes the body
// before the 1mb parser below — body-parser skips once req._body is set.
app.use('/api/users', express.json({ limit: '8mb' }));

// Limit request body size to prevent memory exhaustion attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes',
    },
  },
});

// Apply rate limiter to all api routes
app.use('/api/', limiter);

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  logger.request(req.method, req.path);
  next();
});

// Development/test only: expose local upload fallback paths.
if (env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Database connectivity check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const healthy = Object.values(checks).every(v => v === 'ok');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    service: 'anchor-api',
    version: '0.1.0',
    checks,
  });
});

// ============================================================================
// API Routes
// ============================================================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Anchor API Server',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      docs: '/api/docs',
    },
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Billing access is confirmed server-side against RevenueCat after store purchase.
app.use('/api/billing', billingRoutes);

// User routes
app.use('/api/users', usersRoutes);

// Anchor routes
app.use('/api/anchors', visualizationSceneRoutes);
app.use('/api/anchors', anchorRoutes);

// Practice routes
app.use('/api/practice', practiceRoutes);

// Chart / Workstream A routes. The route handlers remain protected by auth and
// server-side default-off feature flags.
app.use('/api/courses', courseRoutes);
app.use('/api/course-plans', coursePlanRoutes);
app.use('/api/reflections', reflectionRoutes);

// AI Enhancement routes (Phase 2)
app.use('/api/ai', aiRoutes);

// Order routes (Phase 4)
if (env.ENABLE_MERCH) {
  app.use('/api/orders', orderRoutes);
}

// Content moderation routes
app.use('/api/content', contentRoutes);

// Note: Additional routes (users, discover) will be added in future phases

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler - must come after all routes
app.use(notFoundHandler);

if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler - must be last
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Anchor API running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
      if (sentryEnabled) {
        await Sentry.close(2_000);
      }
      logger.info('Database connections closed');
    } catch (err) {
      logger.error(
        'Error closing database connections',
        err instanceof Error ? err : new Error(String(err))
      );
    }
    process.exit(0);
  });

  // Force exit if shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
