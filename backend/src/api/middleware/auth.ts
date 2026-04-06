/**
 * Anchor App - Authentication Middleware
 *
 * JWT verification and user authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin } from '../../config/firebase';

/**
 * Extended Request interface with user information
 */
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

/**
 * Authentication middleware
 * Verifies JWT token from Firebase and attaches user info to request
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Mock auth is ONLY permitted in explicit development/test environments.
    // A hard check on NODE_ENV !== 'production' ensures this path is
    // unreachable in production even if ENABLE_MOCK_AUTH is mistakenly set.
    const allowMockAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== undefined &&
      process.env.ENABLE_MOCK_AUTH === 'true';

    if (allowMockAuth && token === 'mock-jwt-token') {
      req.user = { uid: 'mock-uid-123', email: 'guest@example.com' };
      next();
      return;
    }

    // Verify Firebase ID token
    const firebaseAdmin = getFirebaseAdmin();
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);

    // Attach user info to request
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };

    next();
  } catch (error: any) {
    const code: string = error?.code ?? '';

    if (code === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' },
      });
      return;
    }

    if (
      code.startsWith('auth/') ||
      code === 'auth/argument-error' ||
      code === 'auth/invalid-id-token'
    ) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: 'Authentication failed' },
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const firebaseAdmin = getFirebaseAdmin();
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);

      req.user = {
        uid: decoded.uid,
        email: decoded.email,
      };
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};
