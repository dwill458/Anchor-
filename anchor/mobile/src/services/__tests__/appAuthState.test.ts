import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { useTeachingStore } from '@/stores/teachingStore';
import * as UserLocalStateService from '@/services/UserLocalStateService';
import { AuthService } from '@/services/AuthService';
import { subscribeToAppAuthState } from '../AppAuthBootstrap';
import * as SecureStore from 'expo-secure-store';

const syntheticSecureDisk = new Map<string, string>();

const mockAuthCallbacks: Array<(user: unknown) => Promise<void>> = [];

jest.mock('@/services/AuthService', () => ({
  AuthService: {
    initialize: jest.fn(),
    onAuthStateChanged: jest.fn((callback) => {
      mockAuthCallbacks.push(callback);
      return jest.fn();
    }),
    syncCurrentUser: jest.fn(),
    getCachedUser: jest.fn(),
    getIdToken: jest.fn(),
    hasAuthenticatedSession: jest.fn(() => false),
  },
}));

jest.mock('@/services/AuthHydrationService', () => ({
  __esModule: true,
  default: { hydrateAuthenticatedData: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/services/v2/homeStartupPrefetch', () => ({ prefetchHomeStartupData: jest.fn() }));

jest.mock('@/services/UserLocalStateService', () => ({
  saveAnchorSnapshot: jest.fn().mockResolvedValue(undefined),
  saveProfileSnapshot: jest.fn().mockResolvedValue(undefined),
  saveSessionSnapshot: jest.fn().mockResolvedValue(undefined),
  loadAnchorSnapshot: jest.fn().mockResolvedValue(null),
  loadProfileSnapshot: jest.fn().mockResolvedValue(null),
  loadSessionSnapshot: jest.fn().mockResolvedValue(null),
}));

const makeAnchor = (id: string, userId = 'guest-user') => ({
  id,
  userId,
  intentionText: 'I move with focus',
  category: 'career',
  distilledLetters: ['M', 'V', 'F'],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

const makeUser = (id: string) => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  hasCompletedOnboarding: true,
  isComped: false,
  subscriptionStatus: 'free' as const,
  totalAnchorsCreated: 0,
  totalActivations: 0,
  currentStreak: 0,
  longestStreak: 0,
  stabilizesTotal: 0,
  stabilizeStreakDays: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

const resetStores = () => {
  jest.resetAllMocks();
  // Keep one synthetic native disk across pending operations. Resetting its
  // bytes while async writes are being verified models corruption, not startup.
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key) => syntheticSecureDisk.get(key) ?? null);
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { syntheticSecureDisk.set(key, value); });
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => { syntheticSecureDisk.delete(key); });
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    hasCompletedOnboarding: false,
    isGuest: false,
    pendingFirstAnchorDraft: null,
    pendingFirstAnchorMutations: [],
  } as never);
  useAnchorStore.setState({ anchors: [], partitions: {}, guestTransfers: {}, activeScope: 'guest',
    persistedHydrated: true, persistenceRecoveryRequired: false, currentAnchorId: undefined } as never);
  useFirstRunStore.getState().reset();
  mockAuthCallbacks.length = 0;
  (AuthService.onAuthStateChanged as jest.Mock).mockImplementation((callback) => {
    mockAuthCallbacks.push(callback);
    return jest.fn();
  });
  (AuthService.syncCurrentUser as jest.Mock).mockResolvedValue(null);
  (AuthService.getCachedUser as jest.Mock).mockResolvedValue(null);
  (AuthService.getIdToken as jest.Mock).mockResolvedValue('');
  (AuthService.hasAuthenticatedSession as jest.Mock).mockReturnValue(false);
  (UserLocalStateService.saveAnchorSnapshot as jest.Mock).mockResolvedValue(undefined);
  (UserLocalStateService.saveProfileSnapshot as jest.Mock).mockResolvedValue(undefined);
  (UserLocalStateService.saveSessionSnapshot as jest.Mock).mockResolvedValue(undefined);
};

let stopAuthBootstrap: (() => void) | undefined;
let startupUnsafeFailure: jest.Mock;
let initialAuthRestoreSettled: jest.Mock;
const startAuthBootstrap = () => {
  startupUnsafeFailure = jest.fn();
  initialAuthRestoreSettled = jest.fn();
  stopAuthBootstrap = subscribeToAppAuthState({
    developerMasterAccountEnabled: () => false,
    onInitialAuthRestoreSettled: initialAuthRestoreSettled,
    onStartupSafeFailure: jest.fn(),
    onStartupUnsafeFailure: startupUnsafeFailure,
  });
};
const emitAuthState = (user: unknown) => mockAuthCallbacks[0](user);
const flushMicrotasks = async () => {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
};

describe('App auth restore and local account data', () => {
  beforeEach(() => {
    resetStores();
    startAuthBootstrap();
  });
  afterEach(() => stopAuthBootstrap?.());

  it('preserves a returning guest Anchor and completed first-run state on a null Firebase session', async () => {
    const anchor = makeAnchor('guest-anchor');
    useAnchorStore.setState({ anchors: [anchor], currentAnchorId: anchor.id } as never);
    useFirstRunStore.getState().setStep('complete');
    useAuthStore.setState({ isGuest: true, hasCompletedOnboarding: true, isLoading: true });

    await emitAuthState(null);

    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(useAnchorStore.getState().currentAnchorId).toBe(anchor.id);
    expect(useAuthStore.getState()).toMatchObject({ isGuest: true, hasCompletedOnboarding: true, isLoading: false });
    expect(useFirstRunStore.getState().draft.currentStep).toBe('complete');
    expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
  });

  it('waits for the first Firebase callback and preserves a returning account Anchor', async () => {
    const account = makeUser('returning-account');
    const anchor = makeAnchor('returning-account-anchor', account.id);
    useAuthStore.getState().setSession(account as never, 'cached-token');
    useAnchorStore.setState({ anchors: [anchor] } as never);
    expect(useAuthStore.persist.hasHydrated()).toBe(true);
    expect(initialAuthRestoreSettled).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user?.id).toBe(account.id);
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();

    (AuthService.syncCurrentUser as jest.Mock).mockResolvedValue({ user: account, token: 'restored-token' });
    await emitAuthState({ uid: account.id });

    expect(initialAuthRestoreSettled).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user?.id).toBe(account.id);
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
  });

  it('does not apply the missing-callback timeout while an authenticated restore is processing', async () => {
    jest.useFakeTimers();
    const account = makeUser('returning-account');
    const anchor = makeAnchor('returning-account-anchor', account.id);
    useAuthStore.getState().setSession(account as never, 'cached-token');
    useAnchorStore.setState({ anchors: [anchor] } as never);
    let finishSync!: (session: { user: typeof account; token: string }) => void;
    (AuthService.syncCurrentUser as jest.Mock).mockImplementation(
      () => new Promise((resolve) => { finishSync = resolve; }),
    );

    try {
      const restoring = emitAuthState({ uid: account.id });
      await flushMicrotasks();
      expect(initialAuthRestoreSettled).not.toHaveBeenCalled();

      jest.advanceTimersByTime(16000);

      expect(startupUnsafeFailure).not.toHaveBeenCalled();
      expect(initialAuthRestoreSettled).not.toHaveBeenCalled();
      finishSync({ user: account, token: 'restored-token' });
      await restoring;

      expect(initialAuthRestoreSettled).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.id).toBe(account.id);
      expect(useAnchorStore.getState().anchors).toEqual([anchor]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('preserves an interrupted pre-account onboarding draft when Firebase has no session', async () => {
    useFirstRunStore.getState().setStep('creation');
    useFirstRunStore.getState().setIntention('I finish what matters');
    useAuthStore.setState({ hasCompletedOnboarding: false, isLoading: true });

    await emitAuthState(null);

    expect(useFirstRunStore.getState().draft).toMatchObject({
      currentStep: 'intention',
      intention: 'I finish what matters',
    });
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('clears an authenticated account whose Firebase session did not restore', async () => {
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'cached-token');
    useAnchorStore.setState({ anchors: [makeAnchor('account-a-anchor', 'account-a')] } as never);

    await emitAuthState(null);

    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, isAuthenticated: false, isLoading: false });
    expect(useAnchorStore.getState().anchors).toEqual([]);
  });

  it('fails closed if account cleanup throws instead of leaking a rejected auth callback', async () => {
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'token-a');
    const signOut = useAuthStore.getState().signOut;
    useAuthStore.setState({
      signOut: async () => { throw new Error('cleanup failed'); },
    } as never);

    try {
      await expect(emitAuthState(null)).resolves.toBeUndefined();

      expect(startupUnsafeFailure).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.id).toBe('account-a');
    } finally {
      useAuthStore.setState({ signOut } as never);
    }
  });

  it('does not clear state if the auth initialization callback has already been superseded', async () => {
    const anchor = makeAnchor('account-a-anchor', 'account-a');
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'cached-token');
    useAnchorStore.setState({ anchors: [anchor] } as never);

    const interrupted = emitAuthState(null);
    stopAuthBootstrap?.();
    await interrupted;

    expect(useAuthStore.getState().user?.id).toBe('account-a');
    expect(useAnchorStore.getState().anchors).toEqual([anchor]);
  });

  it('waits for the persisted Anchor store before snapshotting and clearing a signed-out account', async () => {
    const account = makeUser('account-a');
    const anchor = makeAnchor('persisted-account-a-anchor', account.id);
    useAuthStore.getState().setSession(account as never, 'token-a');
    useAnchorStore.setState({ anchors: [anchor] } as never);
    let finishAnchorHydration!: (state: any) => void;
    const hasHydrated = useAnchorStore.persist.hasHydrated;
    const onFinishHydration = useAnchorStore.persist.onFinishHydration;
    useAnchorStore.persist.hasHydrated = () => false;
    useAnchorStore.persist.onFinishHydration = (callback) => {
      finishAnchorHydration = callback;
      return () => {};
    };

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user?.id).toBe(account.id);

      useAnchorStore.persist.hasHydrated = () => true;
      finishAnchorHydration(useAnchorStore.getState());
      await restoring;

      expect(UserLocalStateService.saveAnchorSnapshot).toHaveBeenCalledWith(account.id, expect.objectContaining({ anchors: [anchor] }));
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAnchorStore.getState().anchors).toEqual([]);
    } finally {
      useAnchorStore.persist.hasHydrated = hasHydrated;
      useAnchorStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('waits for teaching-store persistence before clearing account-owned teaching state', async () => {
    const account = makeUser('account-a');
    useAuthStore.getState().setSession(account as never, 'token-a');
    useTeachingStore.getState().setUserFlag('hasCreatedFirstAnchor', true);
    const hasHydrated = useTeachingStore.persist.hasHydrated;
    const onFinishHydration = useTeachingStore.persist.onFinishHydration;
    let finishTeachingHydration!: (state: any) => void;
    useTeachingStore.persist.hasHydrated = () => false;
    useTeachingStore.persist.onFinishHydration = (callback) => {
      finishTeachingHydration = callback;
      return () => {};
    };

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      expect(useTeachingStore.getState().userFlags.hasCreatedFirstAnchor).toBe(true);
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();

      useTeachingStore.persist.hasHydrated = () => true;
      finishTeachingHydration(useTeachingStore.getState());
      await restoring;

      expect(useTeachingStore.getState().userFlags.hasCreatedFirstAnchor).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    } finally {
      useTeachingStore.persist.hasHydrated = hasHydrated;
      useTeachingStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('waits for auth persistence before applying the initial Firebase callback', async () => {
    const account = makeUser('persisted-account-a');
    useAuthStore.getState().setSession(account as never, 'cached-token');
    const hasHydrated = useAuthStore.persist.hasHydrated;
    const onFinishHydration = useAuthStore.persist.onFinishHydration;
    let finishAuthHydration!: (state: any) => void;
    useAuthStore.persist.hasHydrated = () => false;
    useAuthStore.persist.onFinishHydration = (callback) => {
      finishAuthHydration = callback;
      return () => {};
    };

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      expect(useAuthStore.getState()).toMatchObject({ user: account, isLoading: false });
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();

      useAuthStore.persist.hasHydrated = () => true;
      finishAuthHydration(useAuthStore.getState());
      await restoring;
      expect(useAuthStore.getState()).toMatchObject({ user: null, isLoading: false });
    } finally {
      useAuthStore.persist.hasHydrated = hasHydrated;
      useAuthStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('cancels a hydration-pending null callback when a newer account callback arrives', async () => {
    const account = makeUser('account-a');
    const hasHydrated = useAuthStore.persist.hasHydrated;
    const onFinishHydration = useAuthStore.persist.onFinishHydration;
    const hydrationCallbacks: Array<(state: any) => void> = [];
    useAuthStore.persist.hasHydrated = () => false;
    useAuthStore.persist.onFinishHydration = (callback) => {
      hydrationCallbacks.push(callback);
      return () => {};
    };
    (AuthService.syncCurrentUser as jest.Mock).mockResolvedValue({ user: account, token: 'token-a' });

    try {
      const staleNullCallback = emitAuthState(null);
      await flushMicrotasks();
      const latestAuthCallback = emitAuthState({ uid: account.id });
      await flushMicrotasks();
      useAuthStore.persist.hasHydrated = () => true;
      hydrationCallbacks.forEach((callback) => callback(useAuthStore.getState()));

      await Promise.all([staleNullCallback, latestAuthCallback]);

      expect(useAuthStore.getState().user?.id).toBe(account.id);
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
    } finally {
      useAuthStore.persist.hasHydrated = hasHydrated;
      useAuthStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('cancels pending auth hydration listeners on bootstrap unmount', async () => {
    const account = makeUser('account-a');
    useAuthStore.getState().setSession(account as never, 'cached-token');
    const hasHydrated = useAuthStore.persist.hasHydrated;
    const onFinishHydration = useAuthStore.persist.onFinishHydration;
    let unsubscribeHydration = jest.fn();
    useAuthStore.persist.hasHydrated = () => false;
    useAuthStore.persist.onFinishHydration = () => unsubscribeHydration;

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      stopAuthBootstrap?.();
      await restoring;

      expect(unsubscribeHydration).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.id).toBe(account.id);
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
    } finally {
      useAuthStore.persist.hasHydrated = hasHydrated;
      useAuthStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('fails closed when auth persistence never reports hydration completion', async () => {
    jest.useFakeTimers();
    const account = makeUser('account-a');
    useAuthStore.getState().setSession(account as never, 'cached-token');
    const hasHydrated = useAuthStore.persist.hasHydrated;
    const onFinishHydration = useAuthStore.persist.onFinishHydration;
    useAuthStore.persist.hasHydrated = () => false;
    useAuthStore.persist.onFinishHydration = () => () => {};

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      jest.advanceTimersByTime(10001);
      await flushMicrotasks();
      await restoring;

      expect(startupUnsafeFailure).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().user?.id).toBe(account.id);
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      useAuthStore.persist.hasHydrated = hasHydrated;
      useAuthStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('fails closed without clearing an account when a snapshot store never hydrates', async () => {
    jest.useFakeTimers();
    const account = makeUser('persisted-account-a');
    useAuthStore.getState().setSession(account as never, 'cached-token');
    const hasHydrated = useAnchorStore.persist.hasHydrated;
    const onFinishHydration = useAnchorStore.persist.onFinishHydration;
    useAnchorStore.persist.hasHydrated = () => false;
    useAnchorStore.persist.onFinishHydration = () => () => {};

    try {
      const restoring = emitAuthState(null);
      await flushMicrotasks();
      jest.advanceTimersByTime(10001);
      await flushMicrotasks();
      await restoring;

      expect(startupUnsafeFailure).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState()).toMatchObject({ user: account, isAuthenticated: true });
      expect(UserLocalStateService.saveAnchorSnapshot).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      useAnchorStore.persist.hasHydrated = hasHydrated;
      useAnchorStore.persist.onFinishHydration = onFinishHydration;
    }
  });

  it('does not let an in-flight stale account cleanup clear a newly authenticated account', async () => {
    let finishSnapshot!: () => void;
    (UserLocalStateService.saveAnchorSnapshot as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { finishSnapshot = resolve; }),
    );
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'token-a');
    useAnchorStore.setState({ anchors: [makeAnchor('account-a-anchor', 'account-a')] } as never);

    const restoring = emitAuthState(null);
    await flushMicrotasks();
    useAuthStore.getState().setSession(makeUser('account-b') as never, 'token-b');
    const accountBAnchor = makeAnchor('account-b-anchor', 'account-b');
    useAnchorStore.setState({ anchors: [accountBAnchor] } as never);
    finishSnapshot();
    await restoring;

    expect(useAuthStore.getState().user?.id).toBe('account-b');
    expect(useAnchorStore.getState().anchors).toEqual([accountBAnchor]);
  });

  it('coalesces repeated null-session callbacks while account cleanup is pending', async () => {
    let finishSnapshot!: () => void;
    (UserLocalStateService.saveAnchorSnapshot as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { finishSnapshot = resolve; }),
    );
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'token-a');

    const firstCallback = emitAuthState(null);
    await flushMicrotasks();
    const secondCallback = emitAuthState(null);

    expect(UserLocalStateService.saveAnchorSnapshot).toHaveBeenCalledTimes(1);
    finishSnapshot();
    await Promise.all([firstCallback, secondCallback]);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('retries a same-account cleanup after null to same-ID sign-in to null', async () => {
    const account = makeUser('account-a');
    (AuthService.syncCurrentUser as jest.Mock).mockResolvedValue({ user: account, token: 'token-a' });
    const initialSignIn = emitAuthState({ uid: account.id });
    await initialSignIn;

    const snapshotResolvers: Array<() => void> = [];
    (UserLocalStateService.saveAnchorSnapshot as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => { snapshotResolvers.push(resolve); }),
    );

    const staleNullRestore = emitAuthState(null);
    await flushMicrotasks();
    expect(snapshotResolvers).toHaveLength(1);

    const sameAccountSignIn = emitAuthState({ uid: account.id });
    await sameAccountSignIn;
    expect(useAuthStore.getState().user?.id).toBe(account.id);

    const currentNullRestore = emitAuthState(null);
    await flushMicrotasks();
    expect(snapshotResolvers).toHaveLength(2);

    snapshotResolvers[1]();
    await currentNullRestore;
    expect(useAuthStore.getState().user).toBeNull();
    snapshotResolvers[0]();
    await staleNullRestore;
  });

  it('keeps guest data durable and isolated when the next auth callback establishes an account', async () => {
    const anchor = makeAnchor('guest-anchor');
    useAnchorStore.setState({ anchors: [anchor] } as never);
    useAuthStore.setState({ isGuest: true, hasCompletedOnboarding: true });

    await emitAuthState(null);
    useAuthStore.getState().setSession(makeUser('new-account') as never, 'new-token');

    expect(useAuthStore.getState().user?.id).toBe('new-account');
    expect(useAnchorStore.getState().anchors).toEqual([]);
    expect(useAnchorStore.getState().partitions.guest.anchors).toEqual([anchor]);
  });

  it('still honors an intentional sign out of an authenticated account', async () => {
    useAuthStore.getState().setSession(makeUser('account-a') as never, 'token-a');
    useAnchorStore.setState({ anchors: [makeAnchor('account-a-anchor', 'account-a')] } as never);

    await useAuthStore.getState().signOut();
    await emitAuthState(null);

    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false, hasCompletedOnboarding: false });
    expect(useAnchorStore.getState().anchors).toEqual([]);
  });

  it('does not reset resumable first-run data during auth-store hydration', () => {
    useFirstRunStore.getState().setStep('creation');
    useFirstRunStore.getState().setIntention('I finish what matters');
    const options = useAuthStore.persist.getOptions() as any;

    options.onRehydrateStorage()(useAuthStore.getState(), undefined);

    expect(useFirstRunStore.getState().draft).toMatchObject({
      currentStep: 'intention',
      intention: 'I finish what matters',
    });
  });
});
