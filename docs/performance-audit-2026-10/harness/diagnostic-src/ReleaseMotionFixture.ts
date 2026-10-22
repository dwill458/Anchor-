import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import * as Application from 'expo-application';
import { Image } from 'react-native';
import { API_URL } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
import { primeVisionRead, peekV2Vision } from '@/hooks/v2/vision/useV2Vision';
import { primeAnchorChart, peekAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { chartPreviewCourses } from '@/components/chart/__fixtures__/chartPreviewStates';
import type { ChartForAnchor } from '@/services/v2/chartV2Api';
import type { VisionReadModel } from '@/adapters/v2/vision';
import { perfDiag } from '@/utils/perfDiagnostics';
import { validateCanonicalSynthetic72 } from './SyntheticAnchorFixture';
import { STARTUP_FAULT_CONSUMED, STARTUP_FAULT_MARKER_KEY, startupFaultActionForUrl } from './startupFaultDiagnostic';

export const PREPARE_MOTION_URL = 'anchor-perflab20261012://perf/prepare-motion';
export const MOTION_ACCOUNT_ID = 'synthetic-account-c';
const MOTION_PROJECT_ID = 'demo-anchor-perf';
export const MOTION_ASSET_URLS = [
  'http://127.0.0.1:39999/perf-assets/vision-future-desk.jpg',
  'http://127.0.0.1:39999/perf-assets/vision-future-window.jpg',
  'http://127.0.0.1:39999/perf-assets/vision-future-family.jpg',
] as const;
const MOTION_FIXTURE_ASSETS = [
  require('@/assets/vision/vision-future-desk.jpg'),
  require('@/assets/vision/vision-future-window.jpg'),
  require('@/assets/vision/vision-future-family.jpg'),
];

type LocalAsset = { uri: string; width: number; height: number };
const sharedMotionReadFixtures = require('./motion-read-fixtures.json') as {
  vision: VisionReadModel;
  chart: ChartForAnchor;
};

export function isExactPrepareMotionUrl(url: string | null): boolean {
  return url === PREPARE_MOTION_URL;
}

export function buildMotionVision(anchorId: string, assets: LocalAsset[], timestamp = '2026-01-03T00:00:00.000Z'): VisionReadModel | null {
  if (!/^synthetic-anchor-\d{3}$/.test(anchorId) || assets.length !== MOTION_ASSET_URLS.length || assets.some((asset, index) =>
    !asset || asset.uri !== MOTION_ASSET_URLS[index] ||
    !Number.isFinite(asset.width) || asset.width < 1280 || !Number.isFinite(asset.height) || asset.height < 720)) return null;
  const value = JSON.parse(JSON.stringify(sharedMotionReadFixtures.vision)) as VisionReadModel;
  const serialized = replaceLiteral(replaceLiteral(JSON.stringify(value), '__ANCHOR_ID__', anchorId), '2026-01-03T00:00:00.000Z', timestamp);
  return JSON.parse(serialized) as VisionReadModel;
}

export function buildMotionChart(anchor: { id: string; intentionText: string; category: string }, timestamp = '2026-01-03T00:00:00.000Z'): ChartForAnchor | null {
  const base = chartPreviewCourses.normal;
  const idMatch = /^synthetic-anchor-(\d{3})$/.exec(anchor.id);
  if (!base || !Array.isArray(base.moves) || !idMatch ||
      anchor.intentionText !== `Synthetic intention fixture ${idMatch[1]}; no real user writing.`) return null;
  const courseId = `motion-course-${anchor.id}`;
  const chart = {
    ...base,
    id: courseId,
    currentWaypointId: `motion-waypoint-1-${anchor.id}`,
    currentMoveId: `motion-move-1-${anchor.id}`,
    plottedAt: timestamp,
    waypoints: base.waypoints.map((waypoint, index) => ({
      ...waypoint,
      id: `motion-waypoint-${index + 1}-${anchor.id}`,
      courseId,
      title: index === 0 ? 'First synthetic milestone' : `Synthetic waypoint ${index + 1}`,
      reachedAt: null,
      skippedAt: null,
      cancelledAt: null,
    })),
    moves: base.moves.map((move, index) => ({
      ...move,
      id: `motion-move-${index + 1}-${anchor.id}`,
      courseId,
      waypointId: `motion-waypoint-1-${anchor.id}`,
      title: 'Complete one synthetic practice action',
      createdAt: timestamp,
    })),
  };
  const value = { ...sharedMotionReadFixtures.chart, anchor: { ...sharedMotionReadFixtures.chart.anchor,
    id: anchor.id, intentionText: anchor.intentionText, category: anchor.category }, chart };
  return JSON.parse(replaceLiteral(replaceLiteral(replaceLiteral(replaceLiteral(JSON.stringify(value), '__ANCHOR_ID__', anchor.id),
    '__INTENTION_TEXT__', anchor.intentionText), '__CATEGORY__', anchor.category),
    '2026-01-03T00:00:00.000Z', timestamp)) as ChartForAnchor;
}

function replaceLiteral(value: string, search: string, replacement: string): string {
  return value.split(search).join(replacement);
}

function asCanonicalRaw(store: ReturnType<typeof useAnchorStore.getState>): string {
  return JSON.stringify({
    state: {
      anchors: store.anchors,
      totalPrimes: store.totalPrimes,
      primeStreak: store.primeStreak,
      lastPrimedDate: store.lastPrimedDate,
      lastSyncedAt: store.lastSyncedAt,
      currentAnchorId: store.currentAnchorId,
    },
    version: 0,
  });
}

async function waitForSecureValue(key: string, expected: string): Promise<boolean> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await readSecureValue(key) === expected) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function sameNullableJson(current: unknown, expected: unknown): boolean {
  return JSON.stringify(current) === JSON.stringify(expected);
}

type MotionFixtureContext =
  | { ok: true; accountId: string; anchor: ReturnType<typeof useAnchorStore.getState>['anchors'][number] }
  | { ok: false; reasonCode: number };

/** All native, API, identity, and full-fixture checks shared by motion and startup arming. */
async function validateMotionFixtureContext(): Promise<MotionFixtureContext> {
  if (process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS !== '1' || process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED !== 'true') return { ok: false, reasonCode: 4 };
  if (Application.applicationId !== 'com.anchorintentions.perflab20261012') return { ok: false, reasonCode: 6 };
  if (API_URL !== 'http://127.0.0.1:39999') return { ok: false, reasonCode: 7 };

  const firebase = auth();
  const firebaseUser = firebase.currentUser;
  if (firebase.app.options.projectId !== MOTION_PROJECT_ID || firebaseUser?.uid !== MOTION_ACCOUNT_ID) return { ok: false, reasonCode: 20 };
  let claims: Record<string, unknown>;
  try {
    claims = (await firebaseUser.getIdTokenResult()).claims;
  } catch {
    return { ok: false, reasonCode: 20 };
  }
  const appUser = useAuthStore.getState().user;
  if (claims.anchorPerfOnboarded !== true || claims.anchorPerfComped !== true ||
      appUser?.id !== MOTION_ACCOUNT_ID || appUser.isComped !== true) return { ok: false, reasonCode: 20 };

  // The app identity and authenticated demo account have passed before local
  // data reads. Validate both encrypted bytes and hydrated in-memory records.
  let secureVault: string | null;
  try {
    secureVault = await readSecureValue('anchor-vault-storage');
  } catch {
    return { ok: false, reasonCode: 21 };
  }
  const vaultValidation = validateCanonicalSynthetic72(secureVault);
  const store = useAnchorStore.getState();
  const hydratedValidation = validateCanonicalSynthetic72(asCanonicalRaw(store));
  if (!store.persistedHydrated || !vaultValidation.ok || !hydratedValidation.ok || !vaultValidation.selectedSynthetic ||
      !hydratedValidation.selectedSynthetic) return { ok: false, reasonCode: 21 };
  try {
    if (await AsyncStorage.getItem('anchor-vault-storage') !== null) return { ok: false, reasonCode: 21 };
  } catch {
    return { ok: false, reasonCode: 21 };
  }

  const anchorId = store.currentAnchorId;
  const anchor = store.anchors.find((candidate) => candidate.id === anchorId);
  if (!anchor || !/^synthetic-anchor-\d{3}$/.test(anchor.id) || anchor.userId !== 'synthetic-account') return { ok: false, reasonCode: 22 };
  return { ok: true, accountId: appUser.id, anchor };
}

/** Exact-URL-only, local cache preparation. It never changes Anchor/auth state or calls a write API. */
export async function prepareReleaseMotionFixture(url: string | null): Promise<void> {
  const startedAt = Date.now();
  const skip = (reasonCode: number) => perfDiag('benchmark-skip', { reasonCode, phaseCode: 2 });
  if (!isExactPrepareMotionUrl(url)) { skip(url == null ? 10 : 11); return; }
  const context = await validateMotionFixtureContext();
  if (!context.ok) { skip(context.reasonCode); return; }
  const { anchor, accountId } = context;

  const assets = MOTION_FIXTURE_ASSETS.map((source, index) => {
    const dimensions = Image.resolveAssetSource(source) as LocalAsset;
    return { ...dimensions, uri: MOTION_ASSET_URLS[index] };
  });
  const vision = buildMotionVision(anchor.id, assets);
  const chart = buildMotionChart(anchor);
  if (!vision || vision.scenes.length !== 3 || !chart || chart.chart?.waypoints.length !== 5) { skip(23); return; }

  const visionKey = `anchor:v2:vision-read:${encodeURIComponent(accountId)}:${encodeURIComponent(anchor.id)}`;
  const chartKey = `anchor:v2:chart2:${encodeURIComponent(accountId)}:${encodeURIComponent(anchor.id)}`;
  const expectedVision = JSON.stringify({ schemaVersion: 1, accountId, anchorId: anchor.id, value: vision });
  const expectedChart = JSON.stringify(chart);
  const existingVision = await readSecureValue(visionKey);
  const existingChart = await readSecureValue(chartKey);
  if ((existingVision !== null && existingVision !== expectedVision) ||
      (existingChart !== null && existingChart !== expectedChart) ||
      await AsyncStorage.getItem(visionKey) !== null || await AsyncStorage.getItem(chartKey) !== null ||
      ((peekV2Vision(anchor.id, accountId) ?? undefined) !== undefined && !sameNullableJson(peekV2Vision(anchor.id, accountId), vision)) ||
      (peekAnchorChart(anchor.id) !== null && !sameNullableJson(peekAnchorChart(anchor.id), chart))) {
    skip(24);
    return;
  }

  primeVisionRead(anchor.id, vision, accountId);
  primeAnchorChart(anchor.id, chart);
  const [visionPersisted, chartPersisted] = await Promise.all([
    waitForSecureValue(visionKey, expectedVision),
    waitForSecureValue(chartKey, expectedChart),
  ]);
  if (!visionPersisted || !chartPersisted || await AsyncStorage.getItem(visionKey) !== null || await AsyncStorage.getItem(chartKey) !== null) {
    skip(25);
    return;
  }
  perfDiag('motion-fixture-seed', {
    phaseCode: 1,
    okCode: 1,
    durationMs: Date.now() - startedAt,
    anchorCount: 72,
    sceneCount: vision.scenes.length,
    waypointCount: chart.chart?.waypoints.length ?? 0,
    cacheCount: 2,
  });
}

/** Exact arm URL + same full-72 identity gate; marker write is the sole durable mutation. */
export async function armReleaseStartupFault(url: string | null): Promise<void> {
  const action = startupFaultActionForUrl(url);
  if (!action) return;
  const startedAt = Date.now();
  const context = await validateMotionFixtureContext();
  if (!context.ok) {
    perfDiag('startup-fault', { phaseCode: action.phaseCode, elapsedMs: Date.now() - startedAt, resultCode: 3 });
    return;
  }
  try {
    const existingMarker = await readSecureValue(STARTUP_FAULT_MARKER_KEY);
    const plainMarker = await AsyncStorage.getItem(STARTUP_FAULT_MARKER_KEY);
    if ((existingMarker !== null && existingMarker !== STARTUP_FAULT_CONSUMED) || plainMarker !== null) {
      perfDiag('startup-fault', { phaseCode: action.phaseCode, elapsedMs: Date.now() - startedAt, resultCode: 3 });
      return;
    }
    await writeSecureValue(STARTUP_FAULT_MARKER_KEY, action.marker);
    const saved = await readSecureValue(STARTUP_FAULT_MARKER_KEY);
    if (saved !== action.marker || await AsyncStorage.getItem(STARTUP_FAULT_MARKER_KEY) !== null) {
      perfDiag('startup-fault', { phaseCode: action.phaseCode, elapsedMs: Date.now() - startedAt, resultCode: 3 });
      return;
    }
  } catch {
    perfDiag('startup-fault', { phaseCode: action.phaseCode, elapsedMs: Date.now() - startedAt, resultCode: 3 });
    return;
  }
  perfDiag('startup-fault', { phaseCode: action.phaseCode, elapsedMs: Date.now() - startedAt, resultCode: 1 });
}
