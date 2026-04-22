import type { User } from '@/types';
import AnchorSyncService from '@/services/AnchorSyncService';
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
    // Keep the full local collection during account transition so we do not
    // discard user progress before the sync layer can reconcile it.
    const migratedAnchors = await AnchorSyncService.migrateAnchors(anchorStore.anchors, patchedUser.id);
    anchorStore.setAnchors(migratedAnchors);
    await anchorStore.flushPendingSync();

    return {
      hasActiveEntitlement: trialStatus.hasActiveEntitlement,
      trialStatus,
    };
  }
}

export default new PostAuthFlowService();
