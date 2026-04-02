/**
 * Unit tests for auth middleware
 */

import { Response, NextFunction } from 'express';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../auth';

jest.mock('../../../config/firebase');

import { getFirebaseAdmin } from '../../../config/firebase';

describe('authMiddleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();
    mockReq = { headers: {} };
    mockRes = { status: statusMock, json: jsonMock } as any;
    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 401 when no Authorization header is provided', async () => {
    mockReq.headers = {};
    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is not Bearer', async () => {
    mockReq.headers = { authorization: 'Basic abc123' };
    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow mock token when ENABLE_MOCK_AUTH=true', async () => {
    process.env.ENABLE_MOCK_AUTH = 'true';
    mockReq.headers = { authorization: 'Bearer mock-jwt-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({ uid: 'mock-uid-123', email: 'guest@example.com' });
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('should not allow mock token when ENABLE_MOCK_AUTH is not set', async () => {
    delete process.env.ENABLE_MOCK_AUTH;
    const mockVerify = jest.fn().mockResolvedValue({ uid: 'real-uid', email: 'real@example.com' });
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: mockVerify }),
    });
    mockReq.headers = { authorization: 'Bearer mock-jwt-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    // Should call Firebase, not use mock shortcut
    expect(mockVerify).toHaveBeenCalledWith('mock-jwt-token');
  });

  it('should attach user and call next on valid Firebase token', async () => {
    const mockVerify = jest.fn().mockResolvedValue({ uid: 'firebase-uid', email: 'user@example.com' });
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: mockVerify }),
    });
    mockReq.headers = { authorization: 'Bearer valid-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({ uid: 'firebase-uid', email: 'user@example.com' });
  });

  it('should return 401 with TOKEN_EXPIRED for expired tokens', async () => {
    const expiredError = { code: 'auth/id-token-expired', message: 'Token expired' };
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: jest.fn().mockRejectedValue(expiredError) }),
    });
    mockReq.headers = { authorization: 'Bearer expired-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 with INVALID_TOKEN for invalid tokens', async () => {
    const invalidError = { code: 'auth/invalid-id-token', message: 'Invalid token' };
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: jest.fn().mockRejectedValue(invalidError) }),
    });
    mockReq.headers = { authorization: 'Bearer bad-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
      })
    );
  });

  it('should return 500 on unexpected errors', async () => {
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: jest.fn().mockRejectedValue(new Error('Network error')) }),
    });
    mockReq.headers = { authorization: 'Bearer some-token' };

    await authMiddleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'AUTH_ERROR' }),
      })
    );
  });
});

describe('optionalAuthMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should call next without setting user when no token provided', async () => {
    const mockNext = jest.fn();
    const mockReq: Partial<AuthRequest> = { headers: {} };
    const mockRes = {} as Response;

    await optionalAuthMiddleware(mockReq as AuthRequest, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeUndefined();
  });

  it('should attach user when valid token is provided', async () => {
    const mockNext = jest.fn();
    const mockReq: Partial<AuthRequest> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const mockRes = {} as Response;
    const mockVerify = jest.fn().mockResolvedValue({ uid: 'opt-uid', email: 'opt@example.com' });
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: mockVerify }),
    });

    await optionalAuthMiddleware(mockReq as AuthRequest, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toEqual({ uid: 'opt-uid', email: 'opt@example.com' });
  });

  it('should call next silently even when token verification fails', async () => {
    const mockNext = jest.fn();
    const mockReq: Partial<AuthRequest> = {
      headers: { authorization: 'Bearer bad-token' },
    };
    const mockRes = {} as Response;
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({ verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid')) }),
    });

    await optionalAuthMiddleware(mockReq as AuthRequest, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeUndefined();
  });
});
