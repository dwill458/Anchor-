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
  }: RunPostAuthFlowOptions): Promise<PostAuthFlowResult> {
    const authStore = useAuthStore.getState();
    const patchedUser = preserveCompletedOnboarding
      ? { ...user, hasCompletedOnboarding: true }
      : user;

    authStore.setSession(patchedUser, token);
    if (preserveCompletedOnboarding) {
      authStore.setHasCompletedOnboarding(true);
    }

    await RevenueCatService.logIn(patchedUser.id);
    const trialStatus = await RevenueCatService.refreshTrialStatus();

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
    };
  }
}

export default new PostAuthFlowService();
