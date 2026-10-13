jest.mock('expo-application', () => ({
  get applicationId() {
    return (globalThis as typeof globalThis & { __ANCHOR_TEST_APP_ID__?: string }).__ANCHOR_TEST_APP_ID__;
  },
}), { virtual: true });
jest.mock('@/config', () => ({
  get API_URL() {
    return (globalThis as typeof globalThis & { __ANCHOR_TEST_API_URL__?: string }).__ANCHOR_TEST_API_URL__;
  },
}));
jest.mock('@/utils/perfFixtureLinking', () => ({
  getInitialPerfFixtureUrl: jest.fn(async () => null),
}), { virtual: true });

jest.mock('@/stores/encryptedPersistStorage', () => {
  const secure = new Map<string, string>();
  const clock = { getItemStep: 0, secureReadStep: 0, now: 0 };
  const storage = {
    getItem: jest.fn(async (name: string) => {
      clock.now += clock.getItemStep;
      return secure.get(name) ?? null;
    }),
    setItem: jest.fn(async (name: string, value: string) => { secure.set(name, value); }),
    removeItem: jest.fn(async (name: string) => { secure.delete(name); }),
  };
  return {
    encryptedPersistStorage: storage,
    readSecureValue: jest.fn(async (name: string) => {
      clock.now += clock.secureReadStep;
      return secure.get(name) ?? null;
    }),
    __secure: secure,
    __storage: storage,
    __clock: clock,
  };
});

jest.mock('@/stores/authStore', () => {
  const state: any = {
    user: null,
    isGuest: false,
    hasCompletedOnboarding: false,
    setIsGuest(value: boolean) {
      state.isGuest = value;
      persist();
    },
    setHasCompletedOnboarding(value: boolean) {
      state.hasCompletedOnboarding = value;
      persist();
    },
  };
  let secure: Map<string, string> | null = null;
  function persist() {
    secure?.set('anchor-auth-storage', JSON.stringify({ state: {
      user: state.user,
      isGuest: state.isGuest,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
    } }));
  }
  const adapter = {
    getState: () => state,
    __reset(map: Map<string, string>) {
      state.user = null;
      state.isGuest = false;
      state.hasCompletedOnboarding = false;
      secure = map;
    },
  };
  return {
    useAuthStore: adapter,
    writeSyntheticPerfAuthValue: jest.fn(async () => 11),
  };
});

jest.mock('@/stores/anchorStore', () => {
  const state: any = { anchors: [], persistedHydrated: true };
  const store: any = {
    getState: () => state,
    persist: {
      rehydrate: jest.fn(async () => {
        const { __secure } = jest.requireMock('@/stores/encryptedPersistStorage');
        const raw = __secure.get('anchor-vault-storage');
        state.anchors = raw == null ? [] : (JSON.parse(raw)?.state?.anchors ?? []);
      }),
    },
    __state: state,
  };
  return { useAnchorStore: store };
});

jest.mock('@/stores/v2/firstRunStore', () => {
  const state: any = { hydrated: true, draft: { currentStep: 'welcome', lifeChanges: [] } };
  return { useFirstRunStore: { getState: () => state, __state: state } };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null) },
}), { virtual: true });

jest.mock('@/utils/perfDiagnostics', () => ({
  perfDiag: jest.fn(),
  resetAdapterDiagnosticCounters: jest.fn(),
  getAdapterDiagnosticCounters: jest.fn(() => ({
    secureReadEventCount: 14,
    secureWriteEventCount: 4,
    nativeCallCount: 40,
    nativeFailureCount: 0,
    fallbackCount: 0,
  })),
}));

import { advanceReleaseFixtureSequence } from './ReleaseStorageBenchmark';

const secureModule = jest.requireMock('@/stores/encryptedPersistStorage');
const authModule = jest.requireMock('@/stores/authStore');
const anchorModule = jest.requireMock('@/stores/anchorStore');
const firstRunModule = jest.requireMock('@/stores/v2/firstRunStore');
const asyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default;
const { perfDiag, resetAdapterDiagnosticCounters, getAdapterDiagnosticCounters } = jest.requireMock('@/utils/perfDiagnostics');
const { getInitialPerfFixtureUrl } = jest.requireMock('@/utils/perfFixtureLinking');

describe('ReleaseStorageBenchmark diagnostic control flow (stubbed adapters)', () => {
  const oldEnv = {
    diagnostics: process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS,
    v2: process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
    action: process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION,
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { __ANCHOR_TEST_APP_ID__?: string }).__ANCHOR_TEST_APP_ID__ = 'com.anchorintentions.perflab20261012';
    (globalThis as typeof globalThis & { __ANCHOR_TEST_API_URL__?: string }).__ANCHOR_TEST_API_URL__ = 'http://127.0.0.1:39999';
    secureModule.__secure.clear();
    secureModule.__storage.getItem.mockClear();
    secureModule.__storage.setItem.mockClear();
    secureModule.__storage.removeItem.mockClear();
    secureModule.readSecureValue.mockClear();
    secureModule.__clock.getItemStep = 0;
    secureModule.__clock.secureReadStep = 0;
    secureModule.__clock.now = 0;
    authModule.useAuthStore.__reset(secureModule.__secure);
    authModule.writeSyntheticPerfAuthValue.mockClear();
    anchorModule.useAnchorStore.__state.anchors = [];
    anchorModule.useAnchorStore.__state.persistedHydrated = true;
    firstRunModule.useFirstRunStore.__state.hydrated = true;
    firstRunModule.useFirstRunStore.__state.draft = { currentStep: 'welcome', lifeChanges: [] };
    anchorModule.useAnchorStore.persist.rehydrate.mockClear();
    asyncStorage.getItem.mockResolvedValue(null);
    perfDiag.mockClear();
    getInitialPerfFixtureUrl.mockReset();
    getInitialPerfFixtureUrl.mockResolvedValue(null);
    resetAdapterDiagnosticCounters.mockClear();
    getAdapterDiagnosticCounters.mockClear();
    process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS = '1';
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = 'true';
    delete process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS = oldEnv.diagnostics;
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = oldEnv.v2;
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = oldEnv.action;
  });

  it.each(['com.anchorintentions.app', 'com.anchorintentions.perfbaseline'])('refuses protected application ID %s before any storage access', async (applicationId: string) => {
    (globalThis as typeof globalThis & { __ANCHOR_TEST_APP_ID__?: string }).__ANCHOR_TEST_APP_ID__ = applicationId;
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'measure-adapter';
    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.removeItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 6 });
  });

  it('refuses a non-loopback API before any fixture marker read', async () => {
    (globalThis as typeof globalThis & { __ANCHOR_TEST_API_URL__?: string }).__ANCHOR_TEST_API_URL__ = 'https://anchor-production.invalid';
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'measure-adapter';
    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 7 });
  });

  it('refuses an in-progress first-run draft before any marker read or mutation', async () => {
    firstRunModule.useFirstRunStore.__state.draft = {
      currentStep: 'intention',
      lifeChanges: [],
      intention: 'PRIVATE synthetic test string',
    };
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.removeItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(JSON.stringify(perfDiag.mock.calls)).not.toContain('PRIVATE synthetic test string');
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 9 });
  });

  it.each([
    'anchor-perflab20261012://owner/account?token=never-log',
    'anchor-perflab20261012://perf/seed-small?unexpected=1',
    'anchor-perfbaseline://perf/seed-small',
  ])('ignores unknown initial URLs without storage access or URL logging, even with an env action', async (url: string) => {
    getInitialPerfFixtureUrl.mockResolvedValue(url);
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.removeItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 11 });
    expect(JSON.stringify(perfDiag.mock.calls)).not.toContain('token=never-log');
  });

  it('leaves a normal cold launch mutation-free when no URL or fallback action exists', async () => {
    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.removeItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 10 });
  });

  it('uses only an exact allowlisted initial URL to seed without a compile-time action', async () => {
    getInitialPerfFixtureUrl.mockResolvedValue('anchor-perflab20261012://perf/seed-small');
    await advanceReleaseFixtureSequence();

    const raw = secureModule.__secure.get('anchor-vault-storage');
    expect(JSON.parse(raw).state.anchors).toHaveLength(1);
    expect(secureModule.__secure.get('anchor:perf:fixture-marker-v1')).toBe('seeded-small');
  });

  it('accepts only the exact canonical empty persisted Anchor default for seed-small', async () => {
    const canonicalEmpty = '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}';
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    secureModule.__secure.set('anchor-vault-storage', canonicalEmpty);

    await advanceReleaseFixtureSequence();

    const seeded = JSON.parse(secureModule.__secure.get('anchor-vault-storage'));
    expect(seeded.state.anchors).toHaveLength(1);
    expect(secureModule.__secure.get('anchor:perf:fixture-marker-v1')).toBe('seeded-small');
    expect(perfDiag).not.toHaveBeenCalledWith('benchmark-skip', { reasonCode: 2 });
  });

  it.each([
    ['non-empty progress', '{"state":{"anchors":[],"totalPrimes":1,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}'],
    ['extra current-anchor ID', '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null,"currentAnchorId":"synthetic-existing-001"},"version":0}'],
    ['extra persisted field', '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null,"privateDraft":"must-remain-untouched"},"version":0}'],
  ])('refuses altered empty-store payloads with %s without overwriting them', async (_label: string, persisted: string) => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    secureModule.__secure.set('anchor-vault-storage', persisted);
    const writesBefore = secureModule.__storage.setItem.mock.calls.length;

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.setItem.mock.calls).toHaveLength(writesBefore);
    expect(secureModule.__secure.get('anchor-vault-storage')).toBe(persisted);
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 2 });
  });

  it('refuses a present user before inspecting the canonical empty persisted store', async () => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    const canonicalEmpty = '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}';
    secureModule.__secure.set('anchor-vault-storage', canonicalEmpty);
    authModule.useAuthStore.getState().user = { uid: 'synthetic-non-owner' };

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__storage.getItem).not.toHaveBeenCalled();
    expect(secureModule.readSecureValue).not.toHaveBeenCalled();
    expect(secureModule.__secure.get('anchor-vault-storage')).toBe(canonicalEmpty);
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 1 });
  });

  it.each([
    ['guest mode', { isGuest: true }],
    ['completed-onboarding mode', { hasCompletedOnboarding: true }],
  ])('refuses canonical empty storage when auth flag indicates %s', async (_label: string, flags: Record<string, boolean>) => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    const canonicalEmpty = '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}';
    secureModule.__secure.set('anchor-vault-storage', canonicalEmpty);
    Object.assign(authModule.useAuthStore.getState(), flags);

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__secure.get('anchor-vault-storage')).toBe(canonicalEmpty);
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 2 });
  });

  it('refuses the canonical empty SecureStore value when a plaintext legacy value exists', async () => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    const canonicalEmpty = '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}';
    secureModule.__secure.set('anchor-vault-storage', canonicalEmpty);
    asyncStorage.getItem.mockResolvedValueOnce('synthetic-legacy-state');

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.setItem).not.toHaveBeenCalled();
    expect(secureModule.__secure.get('anchor-vault-storage')).toBe(canonicalEmpty);
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 2 });
  });

  it('seeds only an empty synthetic namespace and persists Guest flags before the marker', async () => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    await advanceReleaseFixtureSequence();

    const raw = secureModule.__secure.get('anchor-vault-storage');
    const payload = JSON.parse(raw);
    expect(raw).toHaveLength(10_000);
    expect(payload.state.anchors).toHaveLength(1);
    expect(payload.state.anchors[0].id).toBe('synthetic-anchor-001');
    expect(secureModule.__secure.get('anchor-auth-storage')).toContain('"hasCompletedOnboarding":true');
    expect(secureModule.__secure.get('anchor:perf:fixture-marker-v1')).toBe('seeded-small');
    const writes = secureModule.__storage.setItem.mock.calls;
    expect(writes[writes.length - 1]?.[0]).toBe('anchor:perf:fixture-marker-v1');
    expect(secureModule.__secure.has('anchor:v2:first-run')).toBe(false);
  });

  it('refuses to replace a same-count Guest fixture whose complete stored value changed', async () => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    await advanceReleaseFixtureSequence();
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-large';
    const before = secureModule.__storage.setItem.mock.calls.length;
    secureModule.__secure.set('anchor-vault-storage', 'unexpected-but-still-one-anchor');
    anchorModule.useAnchorStore.__state.anchors = [{ id: 'synthetic-anchor-001' }];

    await advanceReleaseFixtureSequence();

    expect(secureModule.__storage.setItem.mock.calls).toHaveLength(before);
    expect(secureModule.__secure.get('anchor-vault-storage')).toBe('unexpected-but-still-one-anchor');
    expect(perfDiag).toHaveBeenCalledWith('benchmark-skip', { reasonCode: 3 });
  });

  it('keeps SecureStore verification time outside the adapter read/parse duration', async () => {
    const originalNow = performance.now;
    performance.now = () => secureModule.__clock.now;
    try {
      process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
      await advanceReleaseFixtureSequence();
      process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-large';
      await advanceReleaseFixtureSequence();

      secureModule.__clock.getItemStep = 13;
      secureModule.__clock.secureReadStep = 71;
      authModule.writeSyntheticPerfAuthValue.mockImplementation(async () => {
        secureModule.__clock.now += 11;
        return 11;
      });
      process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'measure-adapter';
      await advanceReleaseFixtureSequence();

      const roundTrips: Array<Record<string, number>> = perfDiag.mock.calls
        .filter(([event]: [string]) => event === 'fixture-roundtrip')
        .map(([, fields]: [string, Record<string, number>]) => fields);
      expect(roundTrips).toHaveLength(4); // one 1-anchor, three 72-anchor repeats
      expect(roundTrips.every((item) => item.readParseDurationMs === 13)).toBe(true);
      expect(roundTrips.every((item) => item.secureVerifyDurationMs === 71)).toBe(true);
      expect(roundTrips.filter((item) => item.anchorCount === 72).every((item) => item.authAdapterWriteDurationMs === 11)).toBe(true);
      expect(roundTrips.filter((item) => item.anchorCount === 72).every((item) => item.authWriteControlDeltaMs === 0)).toBe(true);
      expect(roundTrips.filter((item) => item.anchorCount === 72).every((item) => item.authHelperSettlementDurationMs >= item.authAdapterWriteDurationMs)).toBe(true);
      expect(authModule.writeSyntheticPerfAuthValue).toHaveBeenCalledTimes(6); // 3 controls + 3 overlaps
      expect(resetAdapterDiagnosticCounters).toHaveBeenCalledTimes(1);
      expect(secureModule.__secure.get('anchor:perf:fixture-marker-v1')).toBe('complete');
    } finally {
      performance.now = originalNow;
    }
  });

  it('rejects a trial summary with AsyncStorage fallback or native SecureStore errors', async () => {
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-small';
    await advanceReleaseFixtureSequence();
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'seed-large';
    await advanceReleaseFixtureSequence();
    getAdapterDiagnosticCounters.mockReturnValueOnce({
      secureReadEventCount: 14,
      secureWriteEventCount: 4,
      nativeCallCount: 40,
      nativeFailureCount: 1,
      fallbackCount: 1,
    });
    process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION = 'measure-adapter';

    await expect(advanceReleaseFixtureSequence()).rejects.toThrow('native SecureStore only');
    expect(secureModule.__secure.get('anchor:perf:fixture-marker-v1')).toBe('seeded-large');
  });
});
