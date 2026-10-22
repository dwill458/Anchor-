/**
 * Diagnostic-build-only entry for synthetic SecureStore measurements. Keep
 * this module outside the product tree unless the diagnostic patch is
 * approved for the isolated build.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config';
import * as Application from 'expo-application';
import { useAuthStore, writeSyntheticPerfAuthValue } from '@/stores/authStore';
import { encryptedPersistStorage, readSecureValue } from '@/stores/encryptedPersistStorage';
import { useAnchorStore } from '@/stores/anchorStore';
import { useFirstRunStore } from '@/stores/v2/firstRunStore';
import { getAdapterDiagnosticCounters, perfDiag, resetAdapterDiagnosticCounters } from '@/utils/perfDiagnostics';
import { getInitialPerfFixtureUrl } from '@/utils/perfFixtureLinking';
import { makePersistedFixture } from './SyntheticAnchorFixture';

const SYNTHETIC_MARKER_KEY = 'anchor:perf:fixture-marker-v1';
const SYNTHETIC_STORAGE_KEY = 'anchor:perf:synthetic-anchor-v1';
const CANONICAL_EMPTY_ANCHOR_STORAGE = '{"state":{"anchors":[],"totalPrimes":0,"primeStreak":0,"lastPrimedDate":null,"lastSyncedAt":null},"version":0}';
const FIXTURE_ACTION_URLS = new Map<string, 'seed-small' | 'seed-large' | 'measure-adapter'>([
  ['anchor-perflab20261012://perf/seed-small', 'seed-small'],
  ['anchor-perflab20261012://perf/seed-large', 'seed-large'],
  ['anchor-perflab20261012://perf/measure-adapter', 'measure-adapter'],
]);

function isFixtureAction(value: string | undefined): value is 'seed-small' | 'seed-large' | 'measure-adapter' {
  return value === 'seed-small' || value === 'seed-large' || value === 'measure-adapter';
}

function isPristineFirstRunDraft(): boolean {
  const { draft } = useFirstRunStore.getState();
  if (draft.currentStep !== 'welcome' || !Array.isArray(draft.lifeChanges) || draft.lifeChanges.length !== 0) {
    return false;
  }
  return Object.keys(draft).every((key) => key === 'currentStep' || key === 'lifeChanges');
}

async function waitForPristineFirstRunDraft(): Promise<boolean> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = useFirstRunStore.getState();
    if (state.hydrated) return isPristineFirstRunDraft();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

async function seedCanonicalGuestStore(count: 1 | 72): Promise<void> {
  const fixture = makePersistedFixture(count);
  const writeStarted = now();
  await encryptedPersistStorage.setItem('anchor-vault-storage', fixture.value);
  const writeDurationMs = now() - writeStarted;

  // Reuse Zustand's real persisted-store hydration path. This is synthetic
  // guest store data in the isolated package; it does not call onboarding UI.
  await useAnchorStore.persist.rehydrate();
  const hydratedCount = useAnchorStore.getState().anchors.length;
  if (hydratedCount !== count) throw new Error('canonical synthetic store hydration count mismatch');
  useAuthStore.getState().setIsGuest(true);
  useAuthStore.getState().setHasCompletedOnboarding(true);
  await waitForPersistedSyntheticGuest();
  await encryptedPersistStorage.setItem(SYNTHETIC_MARKER_KEY, count === 1 ? 'seeded-small' : 'seeded-large');
  perfDiag('fixture-seed', {
    anchorCount: count,
    payloadChars: fixture.payloadChars,
    writeDurationMs,
    hydratedCount,
  });
}

async function waitForPersistedSyntheticGuest(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const raw = await encryptedPersistStorage.getItem('anchor-auth-storage');
    const state = raw == null ? null : JSON.parse(raw)?.state;
    if (state?.user == null && state?.isGuest === true && state?.hasCompletedOnboarding === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('synthetic Guest auth state did not settle durably');
}

async function runSyntheticAdapterContention(): Promise<void> {
  resetAdapterDiagnosticCounters();
  const fixtures = [makePersistedFixture(1), makePersistedFixture(72)];
  const secureChunkChars = 1_800;
  const authControlDurationsMs: number[] = [];
  const authControlSettlementDurationsMs: number[] = [];
  const controlValue = JSON.stringify({ state: { synthetic: true }, version: 0 });
  // Independent auth-adapter control: at least three repeats without a bulk
  // Anchor write, so the contention result has a same-device comparison.
  for (let trial = 0; trial < 3; trial++) {
    const controlStarted = now();
    authControlDurationsMs.push(await writeSyntheticPerfAuthValue(controlValue));
    authControlSettlementDurationsMs.push(now() - controlStarted);
  }
  perfDiag('auth-adapter-control', {
    trials: authControlDurationsMs.length,
    maxDurationMs: Math.ceil(Math.max(...authControlDurationsMs)),
    minDurationMs: Math.floor(Math.min(...authControlDurationsMs)),
  });

  for (let index = 0; index < fixtures.length; index++) {
    const fixture = fixtures[index];
    const count = index === 0 ? 1 : 72;
    const trialCount = count === 72 ? 3 : 1;
    for (let trial = 0; trial < trialCount; trial++) {
      const storageKey = count === 1 ? SYNTHETIC_STORAGE_KEY : `${SYNTHETIC_STORAGE_KEY}-${trial + 1}`;
      const writeStarted = now();
      const writePromise = (async () => {
        await encryptedPersistStorage.setItem(storageKey, fixture.value);
      })();
      let writeDurationMs = 0;
      const writeOutcome = writePromise.then(() => {
        writeDurationMs = now() - writeStarted;
        return null;
      }, (error: unknown) => error);
      let authAdapterWriteDurationMs = 0;
      let authHelperSettlementDurationMs = 0;
      if (count === 72) {
        // setItem is debounced 400 ms. Issue a synthetic auth-adapter write
        // just after that timer starts the large write. Settlement is timed
        // independently, then both operations are awaited.
        await new Promise((resolve) => setTimeout(resolve, 425));
        const authStarted = now();
        const authSettled = writeSyntheticPerfAuthValue(controlValue).then((writeDurationMs) => {
          authAdapterWriteDurationMs = writeDurationMs;
          authHelperSettlementDurationMs = now() - authStarted;
        });
        const [writeError] = await Promise.all([writeOutcome, authSettled]);
        if (writeError != null) throw writeError;
      } else {
        const writeError = await writeOutcome;
        if (writeError != null) throw writeError;
      }
      const combinedDurationMs = now() - writeStarted;

      const readStarted = now();
      const raw = await encryptedPersistStorage.getItem(storageKey);
      const persisted = raw == null ? null : JSON.parse(raw);
      const readParseDurationMs = now() - readStarted;
      // Bypass encryptedPersistStorage's AsyncStorage recovery path when
      // validating native SecureStore usage.
      const verifyStarted = now();
      const secureRaw = await readSecureValue(storageKey);
      const secureVerifyDurationMs = now() - verifyStarted;
      const hydratedCount = Array.isArray(persisted?.state?.anchors)
        ? persisted.state.anchors.length
        : 0;
      if (raw !== fixture.value || secureRaw !== fixture.value || hydratedCount !== count) {
        throw new Error('synthetic SecureStore adapter round-trip validation failed');
      }
      perfDiag('fixture-roundtrip', {
        anchorCount: count,
        trial: trial + 1,
        payloadChars: fixture.payloadChars,
        secureChunkCount: Math.ceil(fixture.payloadChars / secureChunkChars),
        writeDurationMs,
        combinedDurationMs,
        readParseDurationMs,
        secureVerifyDurationMs,
        authAdapterWriteDurationMs,
        authHelperSettlementDurationMs,
        authControlMaxDurationMs: Math.ceil(Math.max(...authControlDurationsMs)),
        authControlSettlementMaxDurationMs: Math.ceil(Math.max(...authControlSettlementDurationsMs)),
        authWriteControlDeltaMs: Math.ceil(authAdapterWriteDurationMs - Math.max(...authControlDurationsMs)),
        hydratedCount,
      });
      await encryptedPersistStorage.removeItem(storageKey);
    }
  }
  const adapterCounters = getAdapterDiagnosticCounters();
  if (adapterCounters.secureWriteEventCount < 4 || adapterCounters.secureReadEventCount < 8 ||
      adapterCounters.nativeCallCount <= 0 || adapterCounters.nativeFailureCount !== 0 || adapterCounters.fallbackCount !== 0) {
    throw new Error('Synthetic benchmark did not complete with native SecureStore only.');
  }
  perfDiag('benchmark-complete', adapterCounters);
}

/** Called once after app-ready by the separately built diagnostic package. */
export async function advanceReleaseFixtureSequence(): Promise<void> {
  if (process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS !== '1') return;
  if (Application.applicationId !== 'com.anchorintentions.perflab20261012') {
    perfDiag('benchmark-skip', { reasonCode: 6 });
    return;
  }
  if (API_URL !== 'http://127.0.0.1:39999') {
    perfDiag('benchmark-skip', { reasonCode: 7 });
    return;
  }
  if (process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED !== 'true') {
    perfDiag('benchmark-skip', { reasonCode: 4 }); // V2 Home is required for the release route.
    return;
  }
  let initialUrl: string | null;
  try {
    initialUrl = await getInitialPerfFixtureUrl();
  } catch {
    perfDiag('benchmark-skip', { reasonCode: 8 });
    return;
  }
  if (initialUrl === 'anchor-perflab20261012://perf/prepare-motion') {
    const motionFixture = require('./ReleaseMotionFixture') as typeof import('./ReleaseMotionFixture');
    await motionFixture.prepareReleaseMotionFixture(initialUrl);
    return;
  }
  const startupFault = require('./startupFaultDiagnostic') as typeof import('./startupFaultDiagnostic');
  if (startupFault.startupFaultActionForUrl(initialUrl)) {
    const motionFixture = require('./ReleaseMotionFixture') as typeof import('./ReleaseMotionFixture');
    await motionFixture.armReleaseStartupFault(initialUrl);
    return;
  }
  if (useAuthStore.getState().user != null) {
    perfDiag('benchmark-skip', { reasonCode: 1 }); // Existing storage actions remain signed-out only.
    return;
  }
  let action: 'seed-small' | 'seed-large' | 'measure-adapter' | undefined;
  if (initialUrl === null) {
    action = isFixtureAction(process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION)
      ? process.env.EXPO_PUBLIC_ANCHOR_PERF_FIXTURE_ACTION
      : undefined;
    if (!action) {
      perfDiag('benchmark-skip', { reasonCode: 10 }); // no fixture action requested.
      return;
    }
  } else {
    action = FIXTURE_ACTION_URLS.get(initialUrl);
    // A non-null unknown URL is a no-op; never use the environment fallback or log the URL.
    if (!action) {
      perfDiag('benchmark-skip', { reasonCode: 11 }); // unknown URL; no storage access.
      return;
    }
  }

  // Seed only a genuinely pristine onboarding draft. Wait for its ordinary
  // hydration to settle, then inspect in-memory state before any marker read.
  if (!await waitForPristineFirstRunDraft()) {
    perfDiag('benchmark-skip', { reasonCode: 9 });
    return;
  }

  const marker = await encryptedPersistStorage.getItem(SYNTHETIC_MARKER_KEY);
  const anchorState = useAnchorStore.getState();
  const currentCount = anchorState.anchors.length;
  if (!anchorState.persistedHydrated) {
    perfDiag('benchmark-skip', { reasonCode: 5 }); // never seed before local hydration settles.
    return;
  }
  if (action === 'seed-small') {
    const existingSecureFixture = await readSecureValue('anchor-vault-storage');
    const existingPlainFixture = await AsyncStorage.getItem('anchor-vault-storage');
    const authState = useAuthStore.getState();
    const secureFixtureIsPristine = existingSecureFixture === null ||
      existingSecureFixture === CANONICAL_EMPTY_ANCHOR_STORAGE;
    if (marker !== null || currentCount !== 0 || !secureFixtureIsPristine ||
        existingPlainFixture !== null || authState.user != null ||
        authState.isGuest !== false || authState.hasCompletedOnboarding !== false) {
      perfDiag('benchmark-skip', { reasonCode: 2 }); // existing state; never overwrite.
      return;
    }
    await seedCanonicalGuestStore(1);
    return;
  }
  if (action === 'seed-large') {
    const currentSynthetic = await readSecureValue('anchor-vault-storage');
    const currentPlain = await AsyncStorage.getItem('anchor-vault-storage');
    if (marker !== 'seeded-small' || currentCount !== 1 ||
        currentSynthetic !== makePersistedFixture(1).value ||
        currentPlain != null ||
        useAuthStore.getState().isGuest !== true ||
        useAuthStore.getState().hasCompletedOnboarding !== true) {
      perfDiag('benchmark-skip', { reasonCode: 3 }); // wrong stage/count; never overwrite.
      return;
    }
    await seedCanonicalGuestStore(72);
    return;
  }
  if (action === 'measure-adapter') {
    const currentSynthetic = await readSecureValue('anchor-vault-storage');
    const currentPlain = await AsyncStorage.getItem('anchor-vault-storage');
    if (marker !== 'seeded-large' || currentCount !== 72 ||
        currentSynthetic !== makePersistedFixture(72).value ||
        currentPlain != null ||
        useAuthStore.getState().isGuest !== true ||
        useAuthStore.getState().hasCompletedOnboarding !== true) {
      perfDiag('benchmark-skip', { reasonCode: 3 });
      return;
    }
    await runSyntheticAdapterContention();
    await encryptedPersistStorage.setItem(SYNTHETIC_MARKER_KEY, 'complete');
    // Adapter completion is emitted only after native/fallback counters pass.
  }
}
