/**
 * Anchor App - Backend API Server
 *
 * Main entry point for the Express server.
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './api/routes/auth';
import anchorRoutes from './api/routes/anchors';
import aiRoutes from './api/routes/ai';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';
import { logger } from './utils/logger';
import { env } from './config/env';

// Load environment variables
dotenv.config();

// Validate environment variables (imported env.ts automatically validates)

const app: Application = express();
const PORT = env.PORT;

// ============================================================================
// Middleware
// ============================================================================

// High-level security headers
app.use(helmet());

// CORS configuration - restricted in production
const allowedOrigins = env.ALLOWED_ORIGINS?.split(',') || ['*'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Serve uploaded files statically (fallback storage)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'anchor-api',
    version: '0.1.0',
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

// Anchor routes
app.use('/api/anchors', anchorRoutes);

// AI Enhancement routes (Phase 2)
app.use('/api/ai', aiRoutes);

// Note: Additional routes (users, discover, shop) will be added in future phases

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler - must come after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  logger.info(`🚀 Anchor API running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
