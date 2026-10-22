import type { User } from '@/types';
import { isBackendAnchorId } from '@/services/BackendAnchorService';
import AnchorSyncService from '@/services/AnchorSyncService';
import AuthHydrationService from '@/services/AuthHydrationService';
import RevenueCatService, { TrialStatusSnapshot } from '@/services/RevenueCatService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
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
    const accountRevision = useAuthStore.getState().accountRevision;
    const assertCurrentAccount = () => {
      const current = useAuthStore.getState();
      if (current.user?.id !== patchedUser.id || current.token !== token || current.accountRevision !== accountRevision) {
        throw new Error('Authentication context changed.');
      }
    };
    if (preserveCompletedOnboarding) {
      authStore.setHasCompletedOnboarding(true);
    }

    await RevenueCatService.logIn(patchedUser.id);
    assertCurrentAccount();
    const trialStatus = await RevenueCatService.refreshTrialStatus();
    assertCurrentAccount();
    const subscriptionState = useSubscriptionStore.getState();
    const hasEntitlementAccess = Boolean(
      trialStatus.hasActiveEntitlement ||
        subscriptionState.hasActiveEntitlement ||
        subscriptionState.remoteCompedAccess ||
        subscriptionState.legacyMigrationAccess ||
        patchedUser.isComped === true ||
        patchedUser.legacyMigrationAccess === true ||
        (patchedUser.subscriptionStatus && patchedUser.subscriptionStatus !== 'free'),
    );

    const isLockedFreeUser = !hasEntitlementAccess &&
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
      assertCurrentAccount();
      const sameAnchor = (left: typeof anchorsToMigrate[number], right: typeof anchorsToMigrate[number]) =>
        left.id === right.id || left.localId === right.id || right.localId === left.id ||
        Boolean(left.localId && left.localId === right.localId);
      // Reconcile against live state: migration cannot undo edits, additions, or deletions.
      const latestStore = useAnchorStore.getState();
      latestStore.setAnchors(latestStore.anchors.map((local) => {
        const original = anchorsToMigrate.find((candidate) => sameAnchor(local, candidate));
        const migrated = migratedAnchors.find((candidate) => sameAnchor(local, candidate));
        if (!original || !migrated) return local;
        if (original === local) return migrated;
        return { ...migrated, ...local, id: migrated.id,
          localId: migrated.localId ?? local.localId ?? local.id, userId: migrated.userId };
      }));
      await anchorStore.flushPendingSync();
      assertCurrentAccount();
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
    assertCurrentAccount();

    if (hasPendingFirstAnchorDraft) {
      if (isLockedFreeUser && !pendingFirstAnchorDraft?.createAttempted && !pendingFirstAnchorDraft?.backendAnchorId) {
        throw new Error('CREATE_ANCHOR_FREE_LOCKED');
      }

      const didFinalizePendingFirstAnchor =
        await useAuthStore.getState().finalizePendingFirstAnchorDraft();
      assertCurrentAccount();

      if (didFinalizePendingFirstAnchor) {
        await hydrateAuthenticatedData(false);
      } else {
        const error = useAuthStore.getState().pendingFirstAnchorError;
        throw new Error(error ?? 'Your first Anchor could not be saved yet. Try again.');
      }
    }

    return {
      hasActiveEntitlement: hasEntitlementAccess,
      trialStatus,
    };
  }
}

export default new PostAuthFlowService();
