const mockPost = jest.fn();

jest.mock('@/services/ApiClient', () => {
  class ApiClientError extends Error {
    code?: string;
    status?: number;
    constructor(message: string, code?: string, status?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.code = code;
      this.status = status;
    }
  }
  return {
    __esModule: true,
    apiClient: { post: (...args: unknown[]) => mockPost(...args) },
    ApiClientError,
  };
});

import { activateV2Trial } from '../trialActivation';
import { ApiClientError } from '@/services/ApiClient';

beforeEach(() => mockPost.mockReset());

describe('activateV2Trial', () => {
  it('hits the V2 billing endpoint and maps an activated trial', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          trialState: 'ACTIVE',
          trialStartedAt: '2026-09-08T12:00:00.000Z',
          entitlement: { hasProAccess: true, isTrialPeriod: true, isComped: false, source: 'revenuecat', expiresAt: null },
        },
      },
    });

    const outcome = await activateV2Trial();

    expect(mockPost).toHaveBeenCalledWith('/api/v2/billing/trial/activate', {});
    expect(outcome).toEqual({
      status: 'activated',
      trialState: 'TRIAL_ACTIVE',
      trialStartedAt: '2026-09-08T12:00:00.000Z',
      hasProAccess: true,
      isTrialPeriod: true,
    });
  });

  it('reports already_used on a spent trial (409 TRIAL_ALREADY_USED) — never a fresh trial', async () => {
    mockPost.mockRejectedValueOnce(new ApiClientError('This trial has already been used.', 'TRIAL_ALREADY_USED', 409));
    await expect(activateV2Trial()).resolves.toEqual({ status: 'already_used' });
  });

  it('reports a recoverable error on any other failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error. Please check your connection.'));
    const outcome = await activateV2Trial();
    expect(outcome.status).toBe('error');
  });
});
