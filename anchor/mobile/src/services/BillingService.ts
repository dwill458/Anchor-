import { apiClient } from '@/services/ApiClient';
import type { ApiResponse } from '@/types';

export interface ServerEntitlementSnapshot {
  hasActiveEntitlement: boolean;
  subscriptionStatus: 'free' | 'pro';
  productIdentifier: string | null;
  source: 'revenuecat' | 'comped';
}

/**
 * Confirms a completed store purchase with the backend before the UI unlocks.
 * The authenticated API client supplies the Firebase ID token; no client-side
 * plan, price, receipt, or user identifier is treated as authoritative.
 */
export async function refreshServerEntitlement(): Promise<ServerEntitlementSnapshot> {
  const response = await apiClient.post<ApiResponse<ServerEntitlementSnapshot>>(
    '/api/billing/refresh',
    {}
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error?.message ?? 'Unable to confirm billing access.');
  }

  return response.data.data;
}
