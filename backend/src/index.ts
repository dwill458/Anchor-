/**
 * Anchor App - Backend API Server
 *
 * Main entry point for the Express server.
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './api/routes/auth';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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

// TODO: Add additional route handlers
// app.use('/api/anchors', anchorRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/discover', discoverRoutes);
// app.use('/api/shop', shopRoutes);

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
  console.log(`🚀 Anchor API running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
