/**
 * Anchor App - Authentication Middleware
 *
 * JWT verification and user authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import { getFirebaseAdmin } from '../../config/firebase';

/**
 * Developer master account constants — mirrors the mobile-side values in
 * `anchor/mobile/src/utils/developerMasterAccount.ts`.
 * Recognised in non-production environments only.
 */
export const DEV_MASTER_TOKEN = 'mock-dev-master-token';
export const DEV_MASTER_UID = 'dev-master-account';
const DEV_MASTER_EMAIL = 'dev+master@anchor.local';

/** Returns true when the token matches the dev-master bypass (non-prod only). */
function isDevMasterToken(token: string): boolean {
  return process.env.NODE_ENV !== 'production' && token === DEV_MASTER_TOKEN;
}

/**
 * Extended Request interface with user information
 */
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
  /** DB-resolved user record — populated by the resolveDbUser middleware in routers */
  dbUser?: { id: string };
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

    // Dev master account bypass — non-production only
    if (isDevMasterToken(token)) {
      req.user = { uid: DEV_MASTER_UID, email: DEV_MASTER_EMAIL };
      next();
      return;
    }

    // Mock auth is ONLY permitted in explicit development/test environments.
    // A hard check on NODE_ENV !== 'production' ensures this path is
    // unreachable in production even if ENABLE_MOCK_AUTH is mistakenly set.
    // The token value must be supplied via MOCK_AUTH_TOKEN env var — there is
    // no hardcoded fallback, so mock auth is inert unless deliberately configured.
    const mockToken = process.env.MOCK_AUTH_TOKEN;
    const allowMockAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_MOCK_AUTH === 'true' &&
      !!mockToken;

    if (allowMockAuth && mockToken && token === mockToken) {
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
  } catch (error: unknown) {
    const code: string = (error as { code?: string })?.code ?? '';

    if (code === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired' },
      });
      return;
    }

    if (code.startsWith('auth/')) {
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

      // Dev master account bypass — non-production only
      if (isDevMasterToken(token)) {
        req.user = { uid: DEV_MASTER_UID, email: DEV_MASTER_EMAIL };
        next();
        return;
      }

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
