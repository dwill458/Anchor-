import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';

const noUserId = Symbol('authenticated-without-user-id');
const signOutsInFlight = new Map<string | symbol, Map<symbol, Promise<boolean>>>();

type PersistApi = {
  hasHydrated: () => boolean;
  onFinishHydration: (callback: () => void) => () => void;
};

const storesSignOutSnapshotsOrClears: PersistApi[] = [
  useAnchorStore.persist,
  useFirstRunStore.persist,
  useSessionStore.persist,
  useProfileStore.persist,
  useTeachingStore.persist,
  useVisualizationSceneStore.persist,
  useSettingsStore.persist,
  useSubscriptionStore.persist,
];

/** Watches a timed-out cleanup without clearing data before every store is ready. */
export function subscribeToSignOutStoresHydration(
  isCurrent: () => boolean,
  onReady: () => void,
): () => void {
  let active = true;
  const subscriptions: Array<() => void> = [];
  const cancel = () => {
    active = false;
    subscriptions.forEach((unsubscribe) => unsubscribe());
  };
  const check = () => {
    if (!active) return;
    if (!isCurrent()) { cancel(); return; }
    if (!storesSignOutSnapshotsOrClears.every((store) => store.hasHydrated())) return;
    cancel();
    onReady();
  };
  storesSignOutSnapshotsOrClears.forEach((store) => {
    subscriptions.push(store.onFinishHydration(check));
  });
  check();
  return cancel;
}

function waitForHydration(store: PersistApi, isCurrent: () => boolean): Promise<boolean> {
  if (store.hasHydrated()) return Promise.resolve(isCurrent());

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => {};
    let poll: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timeout);
      unsubscribe();
      resolve(ready);
    };
    unsubscribe = store.onFinishHydration(() => finish(isCurrent()));
    poll = setInterval(() => {
      if (!isCurrent()) finish(false);
      else if (store.hasHydrated()) finish(true);
    }, 50);
    // If storage fails without firing onFinishHydration, preserve local data and
    // move startup to its recoverable unsafe-failure path instead of waiting forever.
    timeout = setTimeout(() => finish(false), 10000);
    if (store.hasHydrated()) finish(isCurrent());
  });
}

async function waitForSignOutStores(isCurrent: () => boolean): Promise<boolean> {
  const results = await Promise.all(storesSignOutSnapshotsOrClears.map((store) => waitForHydration(store, isCurrent)));
  return isCurrent() && results.every(Boolean);
}

/** Resolves an unauthenticated Firebase restore without treating guests as signed-out accounts. */
export async function handleUnauthenticatedAuthRestore(
  isCurrent: () => boolean = () => true,
  coalesceKey: symbol = Symbol('auth-restore'),
  onHydrationFailure: () => void = () => {},
): Promise<boolean> {
  if (!isCurrent()) return false;

  const store = useAuthStore.getState();
  const accountId = store.user?.id ?? (store.isAuthenticated ? noUserId : undefined);

  if (accountId === undefined) {
    store.setLoading(false);
    return true;
  }

  const expectedUserId = store.user?.id;
  const expectedAuthenticated = store.isAuthenticated;
  const shouldContinue = () => {
    if (!isCurrent()) return false;
    const current = useAuthStore.getState();
    return current.user?.id === expectedUserId && current.isAuthenticated === expectedAuthenticated;
  };

  let accountSignOuts = signOutsInFlight.get(accountId);
  if (!accountSignOuts) {
    accountSignOuts = new Map();
    signOutsInFlight.set(accountId, accountSignOuts);
  }

  let signOut = accountSignOuts.get(coalesceKey);
  if (!signOut) {
    signOut = (async () => {
      if (!await waitForSignOutStores(shouldContinue)) {
        if (shouldContinue()) onHydrationFailure();
        return false;
      }
      if (!shouldContinue()) return false;
      await store.signOut(shouldContinue);
      return true;
    })();
    accountSignOuts.set(coalesceKey, signOut);
  }

  let didSignOut = false;
  try {
    didSignOut = await signOut;
  } finally {
    if (accountSignOuts.get(coalesceKey) === signOut) {
      accountSignOuts.delete(coalesceKey);
      if (accountSignOuts.size === 0) signOutsInFlight.delete(accountId);
    }
    if (didSignOut && isCurrent()) useAuthStore.getState().setLoading(false);
  }
  return didSignOut;
}
