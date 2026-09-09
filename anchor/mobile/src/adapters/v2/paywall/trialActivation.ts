/**
 * The single client entry point for *starting* the Anchor 2.0 trial.
 *
 * It calls the existing authenticated V2 billing endpoint
 * (`POST /api/v2/billing/trial/activate`). The server stamps `trialStartedAt`
 * (idempotently) and returns the authoritative trial state and entitlement.
 * The client never writes the timestamp itself.
 */

import { apiClient, ApiClientError } from '@/services/ApiClient';
import type { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import { resolveV2TrialState, type V2TrialState } from './trialState';

const TRIAL_ACTIVATE_PATH = '/api/v2/billing/trial/activate';

/** Shape returned by the V2 billing endpoint. */
interface TrialActivateResponse {
  trialState: 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED';
  trialStartedAt: string | null;
  entitlement: {
    hasProAccess: boolean;
    isTrialPeriod: boolean;
    isComped: boolean;
    source: string;
    expiresAt: string | null;
  };
}

export type V2TrialActivationOutcome =
  | {
      status: 'activated';
      trialState: V2TrialState;
      trialStartedAt: string | null;
      hasProAccess: boolean;
      isTrialPeriod: boolean;
    }
  | { status: 'already_used' }
  | { status: 'error'; message: string };

const SERVER_STATE_MAP: Record<TrialActivateResponse['trialState'], V2TrialState> = {
  NOT_STARTED: 'TRIAL_NOT_STARTED',
  ACTIVE: 'TRIAL_ACTIVE',
  EXPIRED: 'TRIAL_ENDED',
};

/**
 * Activate the trial. Safe to call more than once — the server treats a repeat
 * call as a no-op and returns the current state. A spent trial resolves to
 * `already_used` (HTTP 409 `TRIAL_ALREADY_USED`) and must never be retried into
 * a fresh trial.
 */
export async function activateV2Trial(): Promise<V2TrialActivationOutcome> {
  try {
    const response = await apiClient.post<ApiResponse<TrialActivateResponse>>(TRIAL_ACTIVATE_PATH, {});
    const data = response.data?.data;
    if (!response.data?.success || !data) {
      return { status: 'error', message: response.data?.error?.message ?? 'Could not start your trial.' };
    }
    return {
      status: 'activated',
      trialState: SERVER_STATE_MAP[data.trialState] ?? resolveV2TrialState(data.trialStartedAt),
      trialStartedAt: data.trialStartedAt,
      hasProAccess: data.entitlement.hasProAccess,
      isTrialPeriod: data.entitlement.isTrialPeriod,
    };
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'TRIAL_ALREADY_USED') {
      return { status: 'already_used' };
    }
    logger.warn('[v2/paywall] trial activation failed', error);
    const message =
      error instanceof Error && error.message ? error.message : 'Could not start your trial. Please try again.';
    return { status: 'error', message };
  }
}
