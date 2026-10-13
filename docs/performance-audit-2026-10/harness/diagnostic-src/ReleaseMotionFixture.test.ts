const mockShared = globalThis as typeof globalThis & {
  __MOTION_APP_ID__?: string;
  __MOTION_API_URL__?: string;
  __MOTION_AUTH__?: unknown;
  __MOTION_AUTH_STATE__?: unknown;
  __MOTION_ANCHOR_STATE__?: unknown;
};

const mockSecureValues = new Map<string, string>();
const mockSecureRead = jest.fn(async (key: string) => mockSecureValues.get(key) ?? null);
const mockPlainRead = jest.fn(async () => null as string | null);
const mockSecureSet = jest.fn(async (key: string, value: string) => { mockSecureValues.set(key, value); });
const mockPerfDiag = jest.fn();
const mockAnchorStateRead = jest.fn(() => mockShared.__MOTION_ANCHOR_STATE__);
const mockAuthStateRead = jest.fn(() => mockShared.__MOTION_AUTH_STATE__);
const mockVisionCache = new Map<string, unknown>();
const mockChartCache = new Map<string, unknown>();
const mockPrimeVision = jest.fn((anchorId: string, value: unknown, accountId: string) => {
  mockVisionCache.set(`${accountId}:${anchorId}`, value);
  mockSecureValues.set(`anchor:v2:vision-read:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`,
    JSON.stringify({ schemaVersion: 1, accountId, anchorId, value }));
});
const mockPrimeChart = jest.fn((anchorId: string, value: unknown) => {
  const accountId = (mockShared.__MOTION_AUTH_STATE__ as any)?.user?.id;
  mockChartCache.set(`${accountId}:${anchorId}`, value);
  mockSecureValues.set(`anchor:v2:chart2:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`, JSON.stringify(value));
});

jest.mock('expo-application', () => ({ get applicationId() { return (globalThis as any).__MOTION_APP_ID__; } }), { virtual: true });
jest.mock('react-native', () => ({ Image: { resolveAssetSource: jest.fn(() => ({ uri: 'file:///bundled.jpg', width: 1920, height: 1280 })) } }));
jest.mock('@/config', () => ({ get API_URL() { return (globalThis as any).__MOTION_API_URL__; } }));
jest.mock('@react-native-firebase/auth', () => ({ __esModule: true, default: () => (globalThis as any).__MOTION_AUTH__ }), { virtual: true });
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: (...args: unknown[]) => (globalThis as any).__MOTION_PLAIN_READ__(...args) } }), { virtual: true });
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => (globalThis as any).__MOTION_AUTH_STATE_READ__() } }));
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: { getState: () => (globalThis as any).__MOTION_ANCHOR_STATE_READ__() } }));
jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: { setItem: (...args: [string, string]) => (globalThis as any).__MOTION_SECURE_SET__(...args) },
  writeSecureValue: (...args: [string, string]) => (globalThis as any).__MOTION_SECURE_SET__(...args),
  readSecureValue: (...args: unknown[]) => (globalThis as any).__MOTION_SECURE_READ__(...args),
}));
jest.mock('@/hooks/v2/vision/useV2Vision', () => ({
  primeVisionRead: (...args: [string, unknown, string]) => (globalThis as any).__MOTION_PRIME_VISION__(...args),
  peekV2Vision: (anchorId: string, accountId: string) => (globalThis as any).__MOTION_VISION_CACHE__.get(`${accountId}:${anchorId}`),
}));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({
  primeAnchorChart: (...args: [string, unknown]) => (globalThis as any).__MOTION_PRIME_CHART__(...args),
  peekAnchorChart: (anchorId: string) => (globalThis as any).__MOTION_CHART_CACHE__.get(`${(globalThis as any).__MOTION_AUTH_STATE_READ__()?.user?.id}:${anchorId}`) ?? null,
}));
jest.mock('@/utils/perfDiagnostics', () => ({ perfDiag: (...args: unknown[]) => (globalThis as any).__MOTION_PERF_DIAG__(...args) }));

import { armReleaseStartupFault, buildMotionChart, buildMotionVision, MOTION_ASSET_URLS, prepareReleaseMotionFixture, PREPARE_MOTION_URL } from './ReleaseMotionFixture';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';
import { makePersistedFixture } from './SyntheticAnchorFixture';
import { Image } from 'react-native';

function configureValidMotionContext(selectedAnchorId = 'synthetic-anchor-001') {
  const payload = JSON.parse(makePersistedFixture(72).value);
  payload.state.currentAnchorId = selectedAnchorId;
  const raw = JSON.stringify(payload);
  mockSecureValues.set('anchor-vault-storage', raw);
  mockShared.__MOTION_AUTH__ = {
    app: { options: { projectId: 'demo-anchor-perf' } },
    currentUser: { uid: 'synthetic-account-c', getIdTokenResult: async () => ({ claims: { anchorPerfOnboarded: true, anchorPerfComped: true } }) },
  };
  (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__;
  mockShared.__MOTION_AUTH_STATE__ = { user: { id: 'synthetic-account-c', isComped: true } };
  mockShared.__MOTION_ANCHOR_STATE__ = {
    anchors: payload.state.anchors,
    totalPrimes: payload.state.totalPrimes,
    primeStreak: payload.state.primeStreak,
    lastPrimedDate: payload.state.lastPrimedDate,
    lastSyncedAt: payload.state.lastSyncedAt,
    currentAnchorId: selectedAnchorId,
    persistedHydrated: true,
  };
  return payload;
}

describe('motion fixture builders and guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecureValues.clear();
    mockVisionCache.clear();
    mockChartCache.clear();
    mockShared.__MOTION_APP_ID__ = 'com.anchorintentions.perflab20261012';
    mockShared.__MOTION_API_URL__ = 'http://127.0.0.1:39999';
    (globalThis as any).__MOTION_APP_ID__ = mockShared.__MOTION_APP_ID__;
    (globalThis as any).__MOTION_API_URL__ = mockShared.__MOTION_API_URL__;
    (globalThis as any).__MOTION_SECURE_READ__ = mockSecureRead;
    (globalThis as any).__MOTION_SECURE_SET__ = mockSecureSet;
    (globalThis as any).__MOTION_PLAIN_READ__ = mockPlainRead;
    (globalThis as any).__MOTION_AUTH_STATE_READ__ = mockAuthStateRead;
    (globalThis as any).__MOTION_ANCHOR_STATE_READ__ = mockAnchorStateRead;
    (globalThis as any).__MOTION_PERF_DIAG__ = mockPerfDiag;
    (globalThis as any).__MOTION_PRIME_VISION__ = mockPrimeVision;
    (globalThis as any).__MOTION_PRIME_CHART__ = mockPrimeChart;
    (globalThis as any).__MOTION_VISION_CACHE__ = mockVisionCache;
    (globalThis as any).__MOTION_CHART_CACHE__ = mockChartCache;
    process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS = '1';
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS;
    delete process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED;
  });

  it('accepts only the exact prepare-motion literal', () => {
    expect(PREPARE_MOTION_URL).toBe('anchor-perflab20261012://perf/prepare-motion');
    expect(PREPARE_MOTION_URL.endsWith('?stage=1')).toBe(false);
  });

  it('builds a three-scene GET-only Vision model from exact full-resolution loopback asset routes', () => {
    const assets = MOTION_ASSET_URLS.map((uri) => ({ uri, width: 1920, height: 1280 }));
    const vision = buildMotionVision('synthetic-anchor-001', assets);
    expect(vision).toMatchObject({ anchorId: 'synthetic-anchor-001', seenToday: true, status: 'ACTIVE' });
    expect(vision?.scenes).toHaveLength(3);
    expect(vision?.scenes.map((scene) => scene.resolvedImageUrl)).toEqual(MOTION_ASSET_URLS);
    expect(buildMotionVision('synthetic-anchor-001', [{ ...assets[0], uri: 'https://public.example/image.jpg' }, ...assets.slice(1)])).toBeNull();
    expect(buildMotionVision('synthetic-anchor-001', [{ ...assets[0], width: 640 }, ...assets.slice(1)])).toBeNull();
  });

  it('builds an account-neutral five-waypoint Chart based on the existing normal course fixture', () => {
    const anchor = { id: 'synthetic-anchor-001', intentionText: 'Synthetic intention fixture 001; no real user writing.', category: 'desire' };
    const chart = buildMotionChart(anchor);
    expect(chartPreviewCourses.normal?.waypoints).toHaveLength(5);
    expect(chart?.chart?.waypoints).toHaveLength(5);
    expect(chart?.anchor).toMatchObject({ ...anchor, enhancedImageUrl: null, released: false });
    expect(chart?.chart?.currentWaypointId).toBe(chart?.chart?.waypoints[0].id);
    expect(chart?.chart?.waypoints.every((waypoint) => waypoint.courseId === chart.chart?.id)).toBe(true);
    expect(buildMotionChart({ ...anchor, intentionText: 'owner writing' })).toBeNull();
    const template = require('./motion-read-fixtures.json').chart;
    const expected = JSON.parse(JSON.stringify(template)
      .split('__ANCHOR_ID__').join(anchor.id)
      .split('__INTENTION_TEXT__').join(anchor.intentionText)
      .split('__CATEGORY__').join(anchor.category));
    expect(chart).toEqual(expected);
  });

  it('unknown URLs and a non-lab package return before Firebase, store, or persistence access', async () => {
    await prepareReleaseMotionFixture(`${PREPARE_MOTION_URL}?owner=1`);
    expect(mockSecureRead).not.toHaveBeenCalled();
    expect(mockPlainRead).not.toHaveBeenCalled();
    expect(mockAnchorStateRead).not.toHaveBeenCalled();
    expect(mockAuthStateRead).not.toHaveBeenCalled();
    jest.clearAllMocks();
    mockShared.__MOTION_APP_ID__ = 'com.anchorintentions.app';
    (globalThis as any).__MOTION_APP_ID__ = mockShared.__MOTION_APP_ID__;
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockSecureRead).not.toHaveBeenCalled();
    expect(mockPlainRead).not.toHaveBeenCalled();
    expect(mockAnchorStateRead).not.toHaveBeenCalled();
    expect(mockAuthStateRead).not.toHaveBeenCalled();
  });

  it('wrong Firebase project or Account C identity refuses before local fixture reads', async () => {
    mockShared.__MOTION_AUTH__ = {
      app: { options: { projectId: 'demo-anchor-perf' } },
      currentUser: { uid: 'synthetic-account-a', getIdTokenResult: jest.fn() },
    };
    (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__;
    mockShared.__MOTION_AUTH_STATE__ = { user: { id: 'synthetic-account-c', isComped: true } };
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockSecureRead).not.toHaveBeenCalled();
    expect(mockPlainRead).not.toHaveBeenCalled();
    expect(mockAnchorStateRead).not.toHaveBeenCalled();
  });

  it('primes exactly two selected-Anchor Account C caches and verifies their persisted models', async () => {
    configureValidMotionContext('synthetic-anchor-022');
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockPrimeVision).toHaveBeenCalledTimes(1);
    expect(mockPrimeChart).toHaveBeenCalledTimes(1);
    expect(mockPrimeVision.mock.calls[0][0]).toBe('synthetic-anchor-022');
    expect(mockPrimeVision.mock.calls[0][2]).toBe('synthetic-account-c');
    expect(mockPrimeChart.mock.calls[0][0]).toBe('synthetic-anchor-022');
    const visionKey = 'anchor:v2:vision-read:synthetic-account-c:synthetic-anchor-022';
    const chartKey = 'anchor:v2:chart2:synthetic-account-c:synthetic-anchor-022';
    const visionRaw = mockSecureValues.get(visionKey);
    const chartRaw = mockSecureValues.get(chartKey);
    expect(visionRaw).toBe(JSON.stringify({ schemaVersion: 1, accountId: 'synthetic-account-c', anchorId: 'synthetic-anchor-022', value: mockPrimeVision.mock.calls[0][1] }));
    expect(chartRaw).toBe(JSON.stringify(mockPrimeChart.mock.calls[0][1]));
    expect(mockVisionCache.size).toBe(1);
    expect(mockChartCache.size).toBe(1);
    expect(mockSecureSet).not.toHaveBeenCalled();
    expect(mockPerfDiag).toHaveBeenCalledWith('motion-fixture-seed', expect.objectContaining({ anchorCount: 72, sceneCount: 3, waypointCount: 5, cacheCount: 2, okCode: 1 }));
  });

  it('refuses a conflicting existing cache before either cache prime can run', async () => {
    configureValidMotionContext();
    mockSecureValues.set('anchor:v2:vision-read:synthetic-account-c:synthetic-anchor-001', '{"state":"unrelated"}');
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockPrimeVision).not.toHaveBeenCalled();
    expect(mockPrimeChart).not.toHaveBeenCalled();
    expect(mockSecureValues.get('anchor:v2:vision-read:synthetic-account-c:synthetic-anchor-001')).toBe('{"state":"unrelated"}');
    expect(mockSecureSet).not.toHaveBeenCalled();
  });

  it.each([
    ['diagnostic flag', () => { process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS = '0'; }],
    ['V2 flag', () => { process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED = '1'; }],
    ['API URL', () => { mockShared.__MOTION_API_URL__ = 'https://api.example'; (globalThis as any).__MOTION_API_URL__ = mockShared.__MOTION_API_URL__; }],
    ['Firebase project', () => { mockShared.__MOTION_AUTH__ = { app: { options: { projectId: 'anchor-prod' } }, currentUser: { uid: 'synthetic-account-c' } }; (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__; }],
    ['Firebase UID', () => { mockShared.__MOTION_AUTH__ = { app: { options: { projectId: 'demo-anchor-perf' } }, currentUser: { uid: 'synthetic-account-a', getIdTokenResult: jest.fn() } }; (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__; }],
    ['verified onboarding claim', () => { mockShared.__MOTION_AUTH__ = { app: { options: { projectId: 'demo-anchor-perf' } }, currentUser: { uid: 'synthetic-account-c', getIdTokenResult: async () => ({ claims: { anchorPerfComped: true } }) } }; (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__; }],
    ['verified comped claim', () => { mockShared.__MOTION_AUTH__ = { app: { options: { projectId: 'demo-anchor-perf' } }, currentUser: { uid: 'synthetic-account-c', getIdTokenResult: async () => ({ claims: { anchorPerfOnboarded: true } }) } }; (globalThis as any).__MOTION_AUTH__ = mockShared.__MOTION_AUTH__; }],
  ])('refuses before durable or Anchor reads for a wrong %s', async (_name, breakGuard) => {
    configureValidMotionContext();
    breakGuard();
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockSecureRead).not.toHaveBeenCalled();
    expect(mockPlainRead).not.toHaveBeenCalled();
    expect(mockAnchorStateRead).not.toHaveBeenCalled();
    expect(mockPrimeVision).not.toHaveBeenCalled();
    expect(mockPrimeChart).not.toHaveBeenCalled();
    expect(mockSecureSet).not.toHaveBeenCalled();
  });

  it.each([
    ['noncanonical durable Anchor field', (payload: any) => { payload.state.anchors[13].intentionText += ' modified'; }],
    ['deleted durable Anchor record', (payload: any) => { payload.state.anchors.pop(); }],
    ['noncanonical in-memory SVG', (_payload: any, store: any) => { store.anchors[22].baseSigilSvg += 'x'; }],
    ['extra private Anchor field', (payload: any) => { payload.state.anchors[5].imageUrl = 'private'; }],
  ])('refuses before cache writes for a %s', async (_name, mutate) => {
    const payload = configureValidMotionContext();
    mutate(payload, mockShared.__MOTION_ANCHOR_STATE__);
    if (_name === 'noncanonical durable Anchor field' || _name === 'deleted durable Anchor record' || _name === 'extra private Anchor field') {
      mockSecureValues.set('anchor-vault-storage', JSON.stringify(payload));
    }
    await prepareReleaseMotionFixture(PREPARE_MOTION_URL);
    expect(mockPrimeVision).not.toHaveBeenCalled();
    expect(mockPrimeChart).not.toHaveBeenCalled();
    expect(mockSecureSet).not.toHaveBeenCalled();
  });

  it('arms one fixed marker only after Account C claims and the complete Account A dataset validate', async () => {
    configureValidMotionContext();
    await armReleaseStartupFault('anchor-perflab20261012://perf/arm-startup-anchor-12s');
    expect(mockSecureSet).toHaveBeenCalledTimes(1);
    expect(mockSecureSet).toHaveBeenCalledWith('anchor:perf:startup-fault-v1', 'anchor-12s');
    expect(mockSecureValues.get('anchor:perf:startup-fault-v1')).toBe('anchor-12s');
    expect(mockPerfDiag).toHaveBeenCalledWith('startup-fault', expect.objectContaining({ phaseCode: 1, resultCode: 1 }));
  });

  it('refuses to overwrite an existing fault marker', async () => {
    configureValidMotionContext();
    mockSecureValues.set('anchor:perf:startup-fault-v1', 'auth-14s');
    await armReleaseStartupFault('anchor-perflab20261012://perf/arm-startup-anchor-12s');
    expect(mockSecureSet).not.toHaveBeenCalled();
    expect(mockSecureValues.get('anchor:perf:startup-fault-v1')).toBe('auth-14s');
    expect(mockPerfDiag).toHaveBeenCalledWith('startup-fault', expect.objectContaining({ phaseCode: 1, resultCode: 3 }));
  });

  it('rearms only the exact consumed sentinel after the full fixture gate passes', async () => {
    configureValidMotionContext();
    mockSecureValues.set('anchor:perf:startup-fault-v1', 'consumed');
    await armReleaseStartupFault('anchor-perflab20261012://perf/arm-startup-auth-16s');
    expect(mockSecureSet).toHaveBeenCalledTimes(1);
    expect(mockSecureSet).toHaveBeenCalledWith('anchor:perf:startup-fault-v1', 'auth-16s');
    expect(mockSecureValues.get('anchor:perf:startup-fault-v1')).toBe('auth-16s');
    expect(mockPerfDiag).toHaveBeenCalledWith('startup-fault', expect.objectContaining({ phaseCode: 2, resultCode: 1 }));
  });

  it('refuses to replace an unknown startup-fault marker', async () => {
    configureValidMotionContext();
    mockSecureValues.set('anchor:perf:startup-fault-v1', 'unexpected-value');
    await armReleaseStartupFault('anchor-perflab20261012://perf/arm-startup-auth-14s');
    expect(mockSecureSet).not.toHaveBeenCalled();
    expect(mockSecureValues.get('anchor:perf:startup-fault-v1')).toBe('unexpected-value');
    expect(mockPerfDiag).toHaveBeenCalledWith('startup-fault', expect.objectContaining({ phaseCode: 3, resultCode: 3 }));
  });

  it('reports native marker write failure without exposing an error or attempting fallback', async () => {
    configureValidMotionContext();
    mockSecureSet.mockRejectedValueOnce(new Error('private native error'));
    await expect(armReleaseStartupFault('anchor-perflab20261012://perf/arm-startup-auth-16s')).resolves.toBeUndefined();
    expect(mockSecureSet).toHaveBeenCalledTimes(1);
    expect(mockSecureValues.has('anchor:perf:startup-fault-v1')).toBe(false);
    expect(mockPlainRead).toHaveBeenCalledWith('anchor:perf:startup-fault-v1');
    expect(mockPerfDiag).toHaveBeenCalledWith('startup-fault', expect.objectContaining({ phaseCode: 2, resultCode: 3 }));
  });
});
