import { AuthService } from '@/services/AuthService';
import AuthHydrationService from '@/services/AuthHydrationService';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { prefetchHomeStartupData } from '@/services/v2/homeStartupPrefetch';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { HomeStartupProfiler } from '@/utils/homeStartupProfiler';
import { logger } from '@/utils/logger';
import { isAnchorV2Enabled } from '@/config/v2FeatureFlag';
import { handleUnauthenticatedAuthRestore, subscribeToSignOutStoresHydration } from './appAuthState';
import type { FirebaseUser } from '@/types';

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout') ||
    msg.includes('failed to connect') ||
    msg.includes('network request failed')
  );
}

type AppAuthBootstrapOptions = {
  developerMasterAccountEnabled: () => boolean;
  onInitialAuthRestoreSettled: () => void;
  onStartupSafeFailure: () => void;
  onStartupUnsafeFailure: () => void;
};

/** Owns the app-level Firebase restore listener and its async lifecycle. */
export function subscribeToAppAuthState({
  developerMasterAccountEnabled,
  onInitialAuthRestoreSettled,
  onStartupSafeFailure,
  onStartupUnsafeFailure,
}: AppAuthBootstrapOptions): () => void {
  HomeStartupProfiler.mark('auth_bootstrap_started');
  AuthService.initialize();

  let isActive = true;
  let authStateVersion = 0;
  let restoreCoalesceKey = Symbol('auth-restore-generation');
  let lastCallbackWasUnauthenticated: boolean | undefined;
  let initialRestoreSettled = false;
  let initialAuthCallbackReceived = false;
  let initialRestoreTimeout: ReturnType<typeof setTimeout> | undefined;
  const pendingHydrationWaits = new Map<number, { promise: Promise<boolean>; cancel: () => void }>();
  const lateHydrationWaits = new Map<number, () => void>();
  if (useAuthStore.persist.hasHydrated()) useAuthStore.getState().setLoading(true);

  const isCurrent = (version: number) => isActive && version === authStateVersion;
  const settleInitialRestore = (version: number) => {
    if (initialRestoreSettled || !isCurrent(version)) return;
    initialRestoreSettled = true;
    if (initialRestoreTimeout) clearTimeout(initialRestoreTimeout);
    onInitialAuthRestoreSettled();
  };
  const cancelSupersededHydrationWaits = (version: number) => {
    for (const [pendingVersion, wait] of pendingHydrationWaits) {
      if (pendingVersion !== version) wait.cancel();
    }
    for (const [pendingVersion, cancel] of lateHydrationWaits) {
      if (pendingVersion !== version) {
        cancel();
        lateHydrationWaits.delete(pendingVersion);
      }
    }
  };
  const watchLateHydration = (version: number, firebaseUser: FirebaseUser | null, authOnly: boolean) => {
    lateHydrationWaits.get(version)?.();
    const expected = useAuthStore.getState();
    const stillCurrent = () => isCurrent(version) && (authOnly || (
      useAuthStore.getState().user?.id === expected.user?.id &&
      useAuthStore.getState().isAuthenticated === expected.isAuthenticated
    ));
    let recoveryReady = false;
    // Queue the retry after the timed-out restore unwinds its coalesced cleanup.
    const retry = () => {
      recoveryReady = true;
      lateHydrationWaits.delete(version);
      void Promise.resolve().then(() => {
        if (stillCurrent()) return restoreAuthState(firebaseUser, version);
      }).catch((error) => {
        if (!stillCurrent()) return;
        logger.error('Failed to resume auth restore after late hydration', error);
        onStartupUnsafeFailure();
      });
    };
    let cancel: () => void;
    if (authOnly) {
      let active = true;
      let unsubscribe = () => {};
      const check = () => {
        if (!active || !stillCurrent() || !useAuthStore.persist.hasHydrated()) return;
        active = false;
        unsubscribe();
        retry();
      };
      unsubscribe = useAuthStore.persist.onFinishHydration(check);
      cancel = () => { active = false; unsubscribe(); };
      lateHydrationWaits.set(version, cancel);
      check();
    } else {
      cancel = subscribeToSignOutStoresHydration(stillCurrent, retry);
      if (!recoveryReady) lateHydrationWaits.set(version, cancel);
    }
  };
  const waitForAuthStoreHydration = (version: number, firebaseUser: FirebaseUser | null): Promise<boolean> => {
    if (useAuthStore.persist.hasHydrated()) return Promise.resolve(isCurrent(version));
    const existingWait = pendingHydrationWaits.get(version);
    if (existingWait) return existingWait.promise;

    let cancel = () => {};
    let finishHydration = () => {};
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const promise = new Promise<boolean>((resolve) => {
      let settled = false;
      let unsubscribe = () => {};
      const finish = (restorationCurrent = isCurrent(version)) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        unsubscribe();
        pendingHydrationWaits.delete(version);
        if (restorationCurrent) useAuthStore.getState().setLoading(true);
        resolve(restorationCurrent);
      };
      finishHydration = finish;

      unsubscribe = useAuthStore.persist.onFinishHydration(() => finish());
      cancel = () => {
        unsubscribe();
        if (timeout) clearTimeout(timeout);
        if (!settled) {
          settled = true;
          pendingHydrationWaits.delete(version);
          resolve(false);
        }
      };
      timeout = setTimeout(() => {
        const current = isCurrent(version);
        finish(false);
        if (current) {
          onStartupUnsafeFailure();
          watchLateHydration(version, firebaseUser, true);
        }
      }, 10000);
    });
    pendingHydrationWaits.set(version, { promise, cancel });
    // Hydration may finish between the first check and listener registration.
    if (useAuthStore.persist.hasHydrated()) finishHydration();
    return promise;
  };

  const restoreLocalAccount = async (firebaseUser: FirebaseUser | null, version: number) => {
    const expected = useAuthStore.getState();
    let hydrationTimedOut = false;
    const restored = await handleUnauthenticatedAuthRestore(
      () => isCurrent(version),
      restoreCoalesceKey,
      () => { hydrationTimedOut = true; onStartupUnsafeFailure(); },
    );
    if (!restored && hydrationTimedOut && isCurrent(version) &&
      useAuthStore.getState().user?.id === expected.user?.id &&
      useAuthStore.getState().isAuthenticated === expected.isAuthenticated) {
      watchLateHydration(version, firebaseUser, false);
    }
    return restored;
  };

  const restoreAuthState = async (firebaseUser: FirebaseUser | null, currentVersion: number) => {
    if (!await waitForAuthStoreHydration(currentVersion, firebaseUser)) return;

    if (!firebaseUser) {
      const store = useAuthStore.getState();
      if (__DEV__ && developerMasterAccountEnabled()) {
        store.enableDeveloperMasterAccount();
        settleInitialRestore(currentVersion);
      } else {
        try {
          const restored = await restoreLocalAccount(firebaseUser, currentVersion);
          if (restored) settleInitialRestore(currentVersion);
        } catch (error) {
          if (isCurrent(currentVersion)) {
            logger.error('Failed to safely restore local state for a signed-out account', error);
            onStartupUnsafeFailure();
          }
        }
      }
      return;
    }

    try {
      const session = await AuthService.syncCurrentUser();
      if (!isCurrent(currentVersion)) return;

      const store = useAuthStore.getState();
      if (!session) {
        try {
          const restored = await restoreLocalAccount(firebaseUser, currentVersion);
          if (restored) settleInitialRestore(currentVersion);
        } catch (restoreError) {
          if (isCurrent(currentVersion)) {
            logger.error('Failed to safely restore local state without an authenticated session', restoreError);
            onStartupUnsafeFailure();
          }
        }
        return;
      }

      store.setSession(session.user, session.token);
      store.setOfflineMode(false);
      store.setLoading(false);
      settleInitialRestore(currentVersion);
      HomeStartupProfiler.mark('auth_session_ready', { accountId: session.user.id });

      const prewarmSelectedAnchor = () => {
        if (
          !isCurrent(currentVersion) ||
          useAuthStore.getState().user?.id !== session.user.id
        ) return;
        const anchorState = useAnchorStore.getState();
        const activeAnchors = anchorState.anchors.filter((anchor) =>
          (!anchor.userId || anchor.userId === session.user.id) &&
          !anchor.isReleased && !anchor.releasedAt && !anchor.archivedAt
        );
        const selectedAnchor = activeAnchors.find((anchor) =>
          anchor.id === anchorState.currentAnchorId || anchor.localId === anchorState.currentAnchorId
        ) ?? activeAnchors[0];
        if (selectedAnchor) prefetchHomeStartupData(selectedAnchor.id);
      };

      if (isAnchorV2Enabled(
        process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
        __DEV__,
        process.env.EXPO_PUBLIC_APP_ENV,
      )) {
        if (useAnchorStore.getState().persistedHydrated) {
          prewarmSelectedAnchor();
        } else {
          let stopWaiting: (() => void) | null = null;
          stopWaiting = useAnchorStore.persist.onFinishHydration(() => {
            stopWaiting?.();
            prewarmSelectedAnchor();
          });
        }
      }

      const hydrationSpan = HomeStartupProfiler.start('authenticated_data_hydration', { accountId: session.user.id });
      try {
        await AuthHydrationService.hydrateAuthenticatedData({
          skipAnchorRefresh: Boolean(useAuthStore.getState().pendingFirstAnchorDraft),
        });
        if (!isCurrent(currentVersion)) return;
        hydrationSpan({ ok: true });
        // The server answered, so retry any practice completions that were committed locally while it
        // was unreachable. Each carries a stable id, so a retry cannot duplicate the session.
        void PracticeCompletionService.flush(session.user.id).catch((flushError) => {
          logger.warn('Deferred practice upload retry failed', flushError);
        });
      } catch (hydrationError) {
        if (!isCurrent(currentVersion)) return;
        hydrationSpan({ ok: false });
        logger.warn('Authenticated session restored, but data hydration failed', hydrationError);
        onStartupSafeFailure();
      }
    } catch (error) {
      if (!isCurrent(currentVersion)) return;
      const store = useAuthStore.getState();
      if (isNetworkError(error)) {
        const cached = await AuthService.getCachedUser().catch(() => null);
        if (!isCurrent(currentVersion)) return;
        if (cached) {
          const token = await AuthService.getIdToken().catch(() => '') ?? '';
          if (!isCurrent(currentVersion)) return;
          store.setSession(cached, token);
          store.setOfflineMode(true);
          store.setLoading(false);
          settleInitialRestore(currentVersion);
          logger.warn('Network unreachable — restored session from cache (offline mode)');
          // Restore this account's locally committed Anchors, practice history and progress. Hydration's
          // remote calls fail while the API is unreachable and it then falls back to the account-scoped
          // device snapshots; it only leaves offline mode when the profile request actually succeeds.
          try {
            await AuthHydrationService.hydrateAuthenticatedData({
              skipAnchorRefresh: Boolean(useAuthStore.getState().pendingFirstAnchorDraft),
            });
          } catch (hydrationError) {
            if (!isCurrent(currentVersion)) return;
            logger.warn('Offline session restored, but local data hydration failed', hydrationError);
            onStartupSafeFailure();
          }
          return;
        }
      }

      logger.error('Failed to restore authenticated session', error);
      let restored = false;
      try {
        restored = await restoreLocalAccount(firebaseUser, currentVersion);
      } catch (restoreError) {
        if (isCurrent(currentVersion)) {
          logger.error('Failed to safely restore local state after auth failure', restoreError);
          onStartupUnsafeFailure();
        }
      }
      if (isCurrent(currentVersion)) {
        onStartupSafeFailure();
        if (restored) settleInitialRestore(currentVersion);
      }
    }
  };

  const unsubscribe = AuthService.onAuthStateChanged(async (firebaseUser) => {
    initialAuthCallbackReceived = true;
    if (initialRestoreTimeout) {
      clearTimeout(initialRestoreTimeout);
      initialRestoreTimeout = undefined;
    }
    const unauthenticated = !firebaseUser;
    if (!unauthenticated || lastCallbackWasUnauthenticated !== true) {
      authStateVersion += 1;
      restoreCoalesceKey = Symbol('auth-restore-generation');
    }
    lastCallbackWasUnauthenticated = unauthenticated;
    const currentVersion = authStateVersion;
    cancelSupersededHydrationWaits(currentVersion);
    await restoreAuthState(firebaseUser, currentVersion);
  });

  if (!initialAuthCallbackReceived && !initialRestoreSettled) {
    initialRestoreTimeout = setTimeout(() => {
      if (isActive && !initialAuthCallbackReceived) onStartupUnsafeFailure();
    }, 15000);
  }

  return () => {
    isActive = false;
    authStateVersion += 1;
    if (initialRestoreTimeout) clearTimeout(initialRestoreTimeout);
    Array.from(pendingHydrationWaits.values()).forEach(({ cancel }) => cancel());
    Array.from(lateHydrationWaits.values()).forEach((cancel) => cancel());
    lateHydrationWaits.clear();
    unsubscribe();
  };
}
