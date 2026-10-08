import type { User } from '@/types';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
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
  launchTrialPurchase?: boolean;
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

    // setSession syncs the account-bound trial clock + server expiry centrally.
    authStore.setSession(patchedUser, token);
    if (preserveCompletedOnboarding) {
      authStore.setHasCompletedOnboarding(true);
    }

    await RevenueCatService.logIn(patchedUser.id);
    const trialStatus = await RevenueCatService.refreshTrialStatus();

    const isLockedFreeUser = !trialStatus.hasActiveEntitlement &&
      Boolean(patchedUser.freeAnchorConsumed || (patchedUser.totalAnchorsCreated ?? 0) >= 1);

    const anchorStore = useAnchorStore.getState();
    if (AnchorSyncService.isConfigured()) {
      // Keep the full local collection during account transition so we do not
      // discard user progress before the sync layer can reconcile it.
      // Exception: If this is an unentitled free user who has already consumed their free Anchor,
      // unconfirmed local drafts must NOT be migrated into their account library!
      const anchorsToMigrate = isLockedFreeUser
        ? anchorStore.anchors.filter((a) => isBackendAnchorId(a.id))
        : anchorStore.anchors;

      const migratedAnchors = await AnchorSyncService.migrateAnchors(
        anchorsToMigrate,
        patchedUser.id
      );
      const unconfirmedAnchors = isLockedFreeUser
        ? anchorStore.anchors.filter((a) => !isBackendAnchorId(a.id))
        : [];
      anchorStore.setAnchors([...migratedAnchors, ...unconfirmedAnchors]);
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
      if (isLockedFreeUser) {
        throw new Error('CREATE_ANCHOR_FREE_LOCKED');
      }

      const didFinalizePendingFirstAnchor =
        await useAuthStore.getState().finalizePendingFirstAnchorDraft();

      if (didFinalizePendingFirstAnchor) {
        await hydrateAuthenticatedData(false);
      } else {
        const error = useAuthStore.getState().pendingFirstAnchorError;
        throw new Error(error ?? 'Your first Anchor could not be saved yet. Try again.');
      }
    }

    return {
      hasActiveEntitlement: trialStatus.hasActiveEntitlement,
      trialStatus,
    };
  }
}

export default new PostAuthFlowService();
