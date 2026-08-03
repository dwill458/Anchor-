/**
 * Anchor App - Error Handler Middleware
 *
 * Global error handling middleware for Express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  meta?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'ERROR',
    meta?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.meta = meta;
    this.name = 'AppError';
  }
}

/**
 * Global error handler middleware
 *
 * @param err - Error object
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // Express error handlers must have 4 parameters, even if unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  // Keep request-error telemetry structural. Error messages and stacks can
  // contain user-authored Chart text through validation/database errors.
  logger.error('Request error', undefined, {
    path: req.path,
    method: req.method,
    code: err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR',
  });

  // Default to 500 server error
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  }

  // In development, include stack trace
  const response: {
    success: boolean;
    error: {
      code: string;
      message: string;
      stack?: string;
      details?: Record<string, unknown>;
    };
  } = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (err instanceof AppError && err.meta) {
    response.error.details = err.meta;
  }

  if (process.env.EXPOSE_ERROR_STACK === 'true' || process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 *
 * @param req - Express request
 * @param res - Express response
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
};
