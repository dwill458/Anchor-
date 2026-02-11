/**
 * Anchor App - ApiClient Tests
 *
 * Unit tests for HTTP client and API helpers
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, get, post, put, del } from '../ApiClient';
import { AuthService } from '../AuthService';
import { API_URL } from '@/config';

// Mock AuthService
jest.mock('../AuthService', () => ({
  AuthService: {
    getIdToken: jest.fn(),
  },
}));

describe('ApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    jest.clearAllMocks();
    (AuthService.getIdToken as jest.Mock).mockResolvedValue('test-token');
  });

  afterEach(() => {
    mock.reset();
  });

  describe('Configuration', () => {
    it('should be configured with correct base URL', () => {
      expect(apiClient.defaults.baseURL).toBe(API_URL);
    });

    it('should have correct timeout', () => {
      expect(apiClient.defaults.timeout).toBe(30000);
    });

    it('should have JSON content type header', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header with token', async () => {
      (AuthService.getIdToken as jest.Mock).mockResolvedValue('test-token-123');

      mock.onGet('/test').reply((config) => {
        expect(config.headers?.Authorization).toBe('Bearer test-token-123');
        return [200, { success: true }];
      });

      await get('/test');
    });

    it('should not add Authorization header when no token', async () => {
      (AuthService.getIdToken as jest.Mock).mockResolvedValue(null);

      mock.onGet('/test').reply((config) => {
        expect(config.headers?.Authorization).toBeUndefined();
        return [200, { success: true }];
      });

      await get('/test');
    });

    it('should continue without token if AuthService throws', async () => {
      (AuthService.getIdToken as jest.Mock).mockRejectedValue(
        new Error('No user signed in')
      );

      mock.onGet('/test').reply((config) => {
        expect(config.headers?.Authorization).toBeUndefined();
        return [200, { success: true }];
      });

      await get('/test');
    });
  });

  describe('Response Interceptor - Error Handling', () => {
    it('should handle network errors', async () => {
      mock.onGet('/test').networkError();

      await expect(get('/test')).rejects.toThrow(
        'Network error. Please check your connection.'
      );
    });

    it('should handle 401 Unauthorized', async () => {
      mock.onGet('/test').reply(401);

      await expect(get('/test')).rejects.toThrow(
        'Session expired. Please sign in again.'
      );
    });

    it('should handle 403 Forbidden', async () => {
      mock.onGet('/test').reply(403);

      await expect(get('/test')).rejects.toThrow('Access denied.');
    });

    it('should handle 404 Not Found', async () => {
      mock.onGet('/test').reply(404);

      await expect(get('/test')).rejects.toThrow('Resource not found.');
    });

    it('should handle 429 Too Many Requests', async () => {
      mock.onGet('/test').reply(429);

      await expect(get('/test')).rejects.toThrow(
        'Too many requests. Please try again later.'
      );
    });

    it('should handle 500 Server Error', async () => {
      mock.onGet('/test').reply(500);

      await expect(get('/test')).rejects.toThrow(
        'Server error. Please try again later.'
      );
    });

    it('should handle 502 Bad Gateway', async () => {
      mock.onGet('/test').reply(502);

      await expect(get('/test')).rejects.toThrow(
        'Server error. Please try again later.'
      );
    });

    it('should handle 503 Service Unavailable', async () => {
      mock.onGet('/test').reply(503);

      await expect(get('/test')).rejects.toThrow(
        'Server error. Please try again later.'
      );
    });

    it('should handle API error with string message', async () => {
      mock.onGet('/test').reply(400, {
        error: 'Invalid request',
      });

      await expect(get('/test')).rejects.toThrow('Invalid request');
    });

    it('should handle API error with object message', async () => {
      mock.onGet('/test').reply(400, {
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      });

      await expect(get('/test')).rejects.toThrow('Validation failed');
    });

    it('should handle unknown status codes', async () => {
      mock.onGet('/test').reply(418); // I'm a teapot

      await expect(get('/test')).rejects.toThrow('An unexpected error occurred.');
    });
  });

  describe('get() helper', () => {
    it('should make GET request and return data', async () => {
      const responseData = { id: 1, name: 'Test' };
      mock.onGet('/users/1').reply(200, responseData);

      const result = await get('/users/1');

      expect(result).toEqual(responseData);
    });

    it('should handle typed responses', async () => {
      interface User {
        id: number;
        name: string;
      }

      const responseData: User = { id: 1, name: 'Test' };
      mock.onGet('/users/1').reply(200, responseData);

      const result = await get<User>('/users/1');

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test');
    });
  });

  describe('post() helper', () => {
    it('should make POST request and return data', async () => {
      const requestData = { name: 'New User' };
      const responseData = { id: 2, name: 'New User' };

      mock.onPost('/users', requestData).reply(201, responseData);

      const result = await post('/users', requestData);

      expect(result).toEqual(responseData);
    });

    it('should handle POST without body', async () => {
      const responseData = { success: true };
      mock.onPost('/action').reply(200, responseData);

      const result = await post('/action');

      expect(result).toEqual(responseData);
    });

    it('should handle typed POST requests', async () => {
      interface CreateUser {
        name: string;
        email: string;
      }

      interface UserResponse {
        id: number;
        name: string;
        email: string;
      }

      const requestData: CreateUser = {
        name: 'Test',
        email: 'test@example.com',
      };

      const responseData: UserResponse = {
        id: 1,
        ...requestData,
      };

      mock.onPost('/users', requestData).reply(201, responseData);

      const result = await post<UserResponse>('/users', requestData);

      expect(result.id).toBe(1);
      expect(result.email).toBe('test@example.com');
    });
  });

  describe('put() helper', () => {
    it('should make PUT request and return data', async () => {
      const requestData = { name: 'Updated User' };
      const responseData = { id: 1, name: 'Updated User' };

      mock.onPut('/users/1', requestData).reply(200, responseData);

      const result = await put('/users/1', requestData);

      expect(result).toEqual(responseData);
    });

    it('should handle PUT without body', async () => {
      const responseData = { success: true };
      mock.onPut('/activate').reply(200, responseData);

      const result = await put('/activate');

      expect(result).toEqual(responseData);
    });

    it('should handle typed PUT requests', async () => {
      interface UpdateUser {
        name?: string;
        email?: string;
      }

      interface UserResponse {
        id: number;
        name: string;
        email: string;
      }

      const requestData: UpdateUser = { name: 'Updated' };
      const responseData: UserResponse = {
        id: 1,
        name: 'Updated',
        email: 'test@example.com',
      };

      mock.onPut('/users/1', requestData).reply(200, responseData);

      const result = await put<UserResponse>('/users/1', requestData);

      expect(result.name).toBe('Updated');
    });
  });

  describe('del() helper', () => {
    it('should make DELETE request and return data', async () => {
      const responseData = { success: true };
      mock.onDelete('/users/1').reply(200, responseData);

      const result = await del('/users/1');

      expect(result).toEqual(responseData);
    });

    it('should handle DELETE with no response body', async () => {
      mock.onDelete('/users/1').reply(204);

      const result = await del('/users/1');

      expect(result).toBeUndefined();
    });

    it('should handle typed DELETE requests', async () => {
      interface DeleteResponse {
        deleted: boolean;
        id: string;
      }

      const responseData: DeleteResponse = {
        deleted: true,
        id: 'user-1',
      };

      mock.onDelete('/users/1').reply(200, responseData);

      const result = await del<DeleteResponse>('/users/1');

      expect(result.deleted).toBe(true);
      expect(result.id).toBe('user-1');
    });
  });

  describe('Real-world API scenarios', () => {
    it('should handle anchor creation flow', async () => {
      const anchorData = {
        intentionText: 'I am confident',
        category: 'personal_growth',
      };

      const responseData = {
        id: 'anchor-123',
        ...anchorData,
        createdAt: new Date().toISOString(),
      };

      mock.onPost('/api/anchors', anchorData).reply(201, responseData);

      const result = await post('/api/anchors', anchorData);

      expect(result).toEqual(responseData);
    });

    it('should handle anchor charging flow', async () => {
      const chargeData = {
        chargeType: 'initial_quick',
        durationSeconds: 30,
      };

      const responseData = {
        isCharged: true,
        chargedAt: new Date().toISOString(),
      };

      mock.onPost('/api/anchors/anchor-123/charge', chargeData).reply(200, responseData);

      const result = await post('/api/anchors/anchor-123/charge', chargeData);

      expect(result).toEqual(responseData);
    });

    it('should handle anchor activation flow', async () => {
      const activationData = {
        activationType: 'visual',
        durationSeconds: 10,
      };

      const responseData = {
        data: {
          activationCount: 5,
          lastActivatedAt: new Date().toISOString(),
        },
      };

      mock.onPost('/api/anchors/anchor-123/activate', activationData).reply(200, responseData);

      const result = await post('/api/anchors/anchor-123/activate', activationData);

      expect(result).toEqual(responseData);
    });

    it('should handle anchor deletion/burning flow', async () => {
      const responseData = {
        success: true,
        archived: true,
      };

      mock.onDelete('/api/anchors/anchor-123').reply(200, responseData);

      const result = await del('/api/anchors/anchor-123');

      expect(result).toEqual(responseData);
    });

    it('should surface API-provided 401 error message', async () => {
      let callCount = 0;

      mock.onGet('/api/anchors').reply(() => {
        callCount++;
        if (callCount === 1) {
          return [401, { error: 'Token expired' }];
        }
        return [200, { anchors: [] }];
      });

      // First call will fail with 401
      await expect(get('/api/anchors')).rejects.toThrow(
        'Token expired'
      );

      expect(callCount).toBe(1);
    });
  });
});
