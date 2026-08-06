/**
 * Anchor App - Authentication Middleware
 *
 * JWT verification and user authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { getFirebaseAdmin } from '../../config/firebase';

/**
 * Developer master account constants — mirrors the mobile-side values in
 * `anchor/mobile/src/utils/developerMasterAccount.ts`.
 * Recognised in non-production environments only.
 */
export const DEV_MASTER_TOKEN = process.env.DEV_MASTER_TOKEN ?? '';
export const DEV_MASTER_UID = 'dev-master-account';
const DEV_MASTER_EMAIL = 'dev+master@anchor.local';

/** Returns true when the token matches the dev-master bypass (non-prod only). */
function isDevMasterToken(token: string): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    DEV_MASTER_TOKEN.length > 0 &&
    token === DEV_MASTER_TOKEN
  );
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
  dbUser?: {
    id: string;
    subscriptionStatus?: string;
    isComped?: boolean;
    trialStartedAt?: Date;
  };
}

type AuthenticatedUser = NonNullable<AuthRequest['user']>;

interface ParsedAuthorizationHeader {
  hasHeader: boolean;
  isBearer: boolean;
  token?: string;
}

const authError = (
  code: string,
  message: string
): {
  success: false;
  error: { code: string; message: string };
} => ({
  success: false,
  error: { code, message },
});

function parseAuthorizationHeader(req: AuthRequest): ParsedAuthorizationHeader {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return { hasHeader: false, isBearer: false };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { hasHeader: true, isBearer: false };
  }

  return {
    hasHeader: true,
    isBearer: true,
    token: authHeader.substring(7),
  };
}

function setAuthenticatedUser(req: AuthRequest, user: AuthenticatedUser): void {
  req.user = user;
  Sentry.setUser({ id: user.uid });
}

function getFirebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return '';
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function respondToAuthFailure(res: Response, error: unknown): void {
  const code = getFirebaseErrorCode(error);

  if (code === 'auth/id-token-expired') {
    res.status(401).json(authError('TOKEN_EXPIRED', 'Authentication token has expired'));
    return;
  }

  if (code.startsWith('auth/')) {
    res.status(401).json(authError('INVALID_TOKEN', 'Invalid authentication token'));
    return;
  }

  res.status(500).json(authError('AUTH_ERROR', 'Authentication failed'));
}

async function verifyToken(token: string, allowMockAuth: boolean): Promise<AuthenticatedUser> {
  if (isDevMasterToken(token)) {
    return { uid: DEV_MASTER_UID, email: DEV_MASTER_EMAIL };
  }

  const mockToken = process.env.MOCK_AUTH_TOKEN;
  const mockAuthEnabled =
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_MOCK_AUTH === 'true' &&
    Boolean(mockToken);

  if (allowMockAuth && mockAuthEnabled && mockToken === token) {
    return { uid: 'mock-uid-123', email: 'guest@example.com' };
  }

  const decoded = await getFirebaseAdmin().auth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email };
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
    const authorization = parseAuthorizationHeader(req);
    if (!authorization.isBearer || authorization.token === undefined) {
      res.status(401).json(authError('UNAUTHORIZED', 'No authentication token provided'));
      return;
    }

    // Mock auth is ONLY permitted in explicit development/test environments.
    // A hard check on NODE_ENV !== 'production' ensures this path is
    // unreachable in production even if ENABLE_MOCK_AUTH is mistakenly set.
    // The token value must be supplied via MOCK_AUTH_TOKEN env var — there is
    // no hardcoded fallback, so mock auth is inert unless deliberately configured.
    const user = await verifyToken(authorization.token, true);
    setAuthenticatedUser(req, user);
    next();
  } catch (error: unknown) {
    respondToAuthFailure(res, error);
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
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = parseAuthorizationHeader(req);
    if (!authorization.hasHeader) {
      next();
      return;
    }

    if (!authorization.isBearer || authorization.token === undefined) {
      res.status(401).json(authError('INVALID_TOKEN', 'Invalid authentication token'));
      return;
    }

    const user = await verifyToken(authorization.token, false);
    setAuthenticatedUser(req, user);
    next();
  } catch (error: unknown) {
    respondToAuthFailure(res, error);
  }
};
