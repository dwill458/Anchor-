import type { User } from '@/types';
import AnchorSyncService from '@/services/AnchorSyncService';
import AuthHydrationService from '@/services/AuthHydrationService';
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

/**
 * Outcome of the optional store free-trial purchase.
 *  - 'purchased'   — the store trial started (RevenueCat has an entitlement)
 *  - 'dismissed'   — the user backed out of the native store sheet
 *  - 'unavailable' — billing threw (misconfigured / offline / no offering)
 *  - 'skipped'     — launchTrialPurchase was false; no purchase attempted
 *
 * Callers should block only on 'dismissed'. Treating 'unavailable' as a hard
 * block would brick onboarding whenever the store/offering isn't wired yet.
 */
export type TrialPurchaseOutcome = 'purchased' | 'dismissed' | 'unavailable' | 'skipped';

interface PostAuthFlowResult {
  hasActiveEntitlement: boolean;
  trialStatus: TrialStatusSnapshot;
  trialOutcome: TrialPurchaseOutcome;
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

    // setSession syncs the account-bound trial clock + server expiry centrally.
    authStore.setSession(patchedUser, token);
    if (preserveCompletedOnboarding) {
      authStore.setHasCompletedOnboarding(true);
    }

    let trialStatus = await RevenueCatService.logIn(patchedUser.id);
    let trialOutcome: TrialPurchaseOutcome = 'skipped';

    if (launchTrialPurchase && trialStatus.hasActiveEntitlement) {
      // Already entitled (returning subscriber or active store trial): never
      // re-prompt a purchase. Treat as already-purchased.
      trialOutcome = 'purchased';
    } else if (launchTrialPurchase) {
      try {
        const purchaseResult = await RevenueCatService.purchaseDefaultTrialPackage();
        trialStatus = purchaseResult.status;
        trialOutcome = purchaseResult.dismissed ? 'dismissed' : 'purchased';
      } catch (error) {
        logger.warn('[PostAuthFlowService] Trial purchase failed, refreshing entitlement state', error);
        trialStatus = await RevenueCatService.refreshTrialStatus();
        trialOutcome = 'unavailable';
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

    const hydrateAuthenticatedData = async (skipAnchorRefresh: boolean) => {
      try {
        await AuthHydrationService.hydrateAuthenticatedData({
          skipAnchorRefresh,
        });
      } catch (error) {
        logger.warn('[PostAuthFlowService] Failed to hydrate authenticated data', error);
      }
    };

    const { pendingFirstAnchorDraft } = useAuthStore.getState();
    const hasPendingFirstAnchorDraft = Boolean(pendingFirstAnchorDraft);

    await hydrateAuthenticatedData(hasPendingFirstAnchorDraft);

    if (hasPendingFirstAnchorDraft) {
      const didFinalizePendingFirstAnchor =
        await useAuthStore.getState().finalizePendingFirstAnchorDraft();

      if (didFinalizePendingFirstAnchor) {
        await hydrateAuthenticatedData(false);
      }
    }

    return {
      hasActiveEntitlement: trialStatus.hasActiveEntitlement,
      trialStatus,
      trialOutcome,
    };
  }
}

export default new PostAuthFlowService();
