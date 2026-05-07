import type { Anchor, ApiResponse, User } from '@/types';
import AnchorSyncService from '@/services/AnchorSyncService';
import { apiClient } from '@/services/ApiClient';
import RevenueCatService, { TrialStatusSnapshot } from '@/services/RevenueCatService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

interface RunPostAuthFlowOptions {
  user: User;
  token: string;
  preserveCompletedOnboarding: boolean;
  launchTrialPurchase: boolean;
}

interface PostAuthFlowResult {
  hasActiveEntitlement: boolean;
  trialStatus: TrialStatusSnapshot;
}

class PostAuthFlowService {
  async run({
    user,
    token,
    preserveCompletedOnboarding,
    launchTrialPurchase,
  }: RunPostAuthFlowOptions): Promise<PostAuthFlowResult> {
    const authStore = useAuthStore.getState();
    const patchedUser = preserveCompletedOnboarding
      ? { ...user, hasCompletedOnboarding: true }
      : user;

    authStore.setSession(patchedUser, token);
    if (preserveCompletedOnboarding) {
      authStore.setHasCompletedOnboarding(true);
    }

    let trialStatus = await RevenueCatService.logIn(patchedUser.id);

    if (launchTrialPurchase) {
      try {
        const purchaseResult = await RevenueCatService.purchaseDefaultTrialPackage();
        trialStatus = purchaseResult.status;
      } catch (error) {
        logger.warn('[PostAuthFlowService] Trial purchase failed, refreshing entitlement state', error);
        trialStatus = await RevenueCatService.refreshTrialStatus();
      }
    } else {
      trialStatus = await RevenueCatService.refreshTrialStatus();
    }

    const anchorStore = useAnchorStore.getState();
    if (AnchorSyncService.isConfigured()) {
      // Keep the full local collection during account transition so we do not
      // discard user progress before the sync layer can reconcile it.
      const migratedAnchors = await AnchorSyncService.migrateAnchors(
        anchorStore.anchors,
        patchedUser.id
      );
      anchorStore.setAnchors(migratedAnchors);
      await anchorStore.flushPendingSync();
    }

    // Pull the user's anchors from the Railway backend to enable cross-device sync.
    // Skip if there is a pending first-anchor draft: it will be finalized via
    // FirstAnchorAccountGateScreen and would be wiped from the local store if we
    // overwrote anchors here before finalization completes.
    const { pendingFirstAnchorDraft } = useAuthStore.getState();
    if (!pendingFirstAnchorDraft) {
      try {
        const response = await apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
          params: { limit: 100, orderBy: 'updatedAt', order: 'desc' },
        });
        if (response.data?.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
          anchorStore.setAnchors(response.data.data as Anchor[]);
        }
      } catch (error) {
        logger.warn('[PostAuthFlowService] Failed to fetch anchors from backend', error);
      }
    }

    return {
      hasActiveEntitlement: trialStatus.hasActiveEntitlement,
      trialStatus,
    };
  }
}

export default new PostAuthFlowService();
