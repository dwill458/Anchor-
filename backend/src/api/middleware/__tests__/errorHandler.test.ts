/**
 * Unit tests for errorHandler middleware
 */

import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, AppError } from '../errorHandler';

jest.mock('../../../utils/logger');

describe('AppError', () => {
  it('should create an AppError with message, statusCode, and code', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('AppError');
  });

  it('should default to statusCode 500 and code ERROR', () => {
    const err = new AppError('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('ERROR');
  });

  it('should be an instance of Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();
    mockReq = { path: '/test', method: 'GET' };
    mockRes = { status: statusMock, json: jsonMock } as any;
    mockNext = jest.fn();
    process.env.NODE_ENV = 'test';
  });

  it('should handle AppError with its status code and code', () => {
    const err = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
        }),
      })
    );
  });

  it('should handle generic Error with 500 status', () => {
    const err = new Error('Unexpected crash');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        }),
      })
    );
  });

  it('should include stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.any(String),
        }),
      })
    );
  });

  it('should not include stack trace in non-development mode', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('Prod error');
    errorHandler(err, mockReq as Request, mockRes as Response, mockNext);

    const call = jsonMock.mock.calls[0][0];
    expect(call.error.stack).toBeUndefined();
  });
});

describe('notFoundHandler', () => {
  it('should return 404 with path info', () => {
    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn();
    const mockReq = { path: '/missing', method: 'GET' } as Request;
    const mockRes = { status: statusMock, json: jsonMock } as any;

    notFoundHandler(mockReq, mockRes);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /missing',
      },
    });
  });

  it('should include the HTTP method in the message', () => {
    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn();
    const mockReq = { path: '/api/anchors', method: 'DELETE' } as Request;
    const mockRes = { status: statusMock, json: jsonMock } as any;

    notFoundHandler(mockReq, mockRes);

    const response = jsonMock.mock.calls[0][0];
    expect(response.error.message).toBe('Cannot DELETE /api/anchors');
  });
});
