import { AppError, errorHandler, notFoundHandler } from '../errorHandler';

describe('errorHandler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('handles AppError with provided status and code', () => {
    const err = new AppError('Bad request', 400, 'VALIDATION_ERROR');
    const req = { path: '/test', method: 'GET' } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    errorHandler(err, req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Bad request',
        }),
      })
    );
  });

  it('includes stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Boom');
    const req = { path: '/test', method: 'GET' } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    errorHandler(err, req, res, jest.fn());

    const payload = (res.json as jest.Mock).mock.calls[0][0];
    expect(payload.error.stack).toBeDefined();
  });
});

describe('notFoundHandler', () => {
  it('returns 404 for unknown routes', () => {
    const req = { path: '/missing', method: 'GET' } as any;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      })
    );
  });
});
