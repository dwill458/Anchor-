import jwt from 'jsonwebtoken';
import { authMiddleware, optionalAuthMiddleware } from '../auth';

jest.mock('jsonwebtoken');

describe('authMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when no auth header is present', async () => {
    const req = { headers: {} } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new (jwt as any).JsonWebTokenError('invalid');
    });

    const req = { headers: { authorization: 'Bearer bad' } } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_TOKEN' }),
      })
    );
  });

  it('returns 401 when token is expired', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new (jwt as any).TokenExpiredError('expired', new Date());
    });

    const req = { headers: { authorization: 'Bearer expired' } } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
      })
    );
  });

  it('attaches user and calls next when token is valid', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ uid: 'user-1', email: 'user@example.com' });

    const req = { headers: { authorization: 'Bearer good' } } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    await authMiddleware(req, res, next);

    expect(req.user).toEqual({ uid: 'user-1', email: 'user@example.com' });
    expect(next).toHaveBeenCalled();
  });
});

describe('optionalAuthMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('attaches user when token is present', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({ uid: 'user-1', email: 'user@example.com' });

    const req = { headers: { authorization: 'Bearer good' } } as any;

    await optionalAuthMiddleware(req, {} as any, next);

    expect(req.user).toEqual({ uid: 'user-1', email: 'user@example.com' });
    expect(next).toHaveBeenCalled();
  });

  it('silently continues when token is invalid', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new (jwt as any).JsonWebTokenError('invalid');
    });

    const req = { headers: { authorization: 'Bearer bad' } } as any;

    await optionalAuthMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });
});
