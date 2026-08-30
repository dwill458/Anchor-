import { apiClient } from '@/services/ApiClient';
import type { ApiResponse } from '@/types';

export interface ServerEntitlementSnapshot {
  hasActiveEntitlement: boolean;
  subscriptionStatus: 'free' | 'pro';
  productIdentifier: string | null;
  source: 'revenuecat' | 'revenuecat_cache' | 'comped' | 'legacy_migration' | 'free';
}

/**
 * Reconciles a completed store purchase with the backend. The store result
 * unlocks the local UI immediately; this endpoint confirms the server view.
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

/** Best-effort bounded reconciliation after the store has already succeeded. */
export function scheduleServerEntitlementRetry(): void {
  const delays = [1_000, 5_000, 15_000];
  delays.forEach((delay) => {
    setTimeout(() => {
      void refreshServerEntitlement().catch(() => {
        // The next bounded attempt, or the next app hydration, can reconcile it.
      });
    }, delay);
  });
}
