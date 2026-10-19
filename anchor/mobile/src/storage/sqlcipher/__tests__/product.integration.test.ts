jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { sqlCipherLab: true }, version: 'test' } } }));
jest.mock('@/storage/sqlcipher/runtime', () => {
  const f = require('./sqliteTestDriver').fixture();
  return { recordDatabase: () => f.db, testFixture: f };
});
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { loadSessionSnapshot } from '@/services/UserLocalStateService';
import { useSessionStore, createInitialSessionState } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/ApiClient';
import { saveSessionSnapshot } from '@/services/UserLocalStateService';
import { useAnchorStore } from '@/stores/anchorStore';
import { useReflectionDraftStore } from '@/stores/reflectionDraftStore';
import { createMockUser, createMockAnchor } from '@/__tests__/utils/testUtils';
import type { PracticeSessionRecord } from '@/types/practice';

const db = () => (require('../runtime') as any).testFixture.db;
const record = (id: string, accountId: string, practiceMode: 'focus' | 'deep_prime' | 'visualize' = 'focus'): PracticeSessionRecord => ({
  id, accountId, practiceMode, anchorId: null, anchorLocalId: 'synthetic-anchor',
  plannedDurationSeconds: 60, completedDurationSeconds: 60, completionStatus: 'completed',
  startedAt: new Date(Date.now() - 60_000).toISOString(), completedAt: new Date().toISOString(),
  guidanceVoice: 'none', backgroundAudio: 'off', syncState: 'pending',
} as PracticeSessionRecord);

describe('SQLCipher product completion recovery', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await useSessionStore.persist.rehydrate();
    useSessionStore.setState(createInitialSessionState());
  });

  it('retains exactly 20 controlled Focus completions across duplicates and reopening', async () => {
    const owner = 'stabilization-repeat-owner';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    for (let index = 0; index < 20; index++) {
      const event = record(`stabilization-focus-${index}`, owner);
      const input = { sessionId: event.id, accountId: owner, anchorId: null, anchorLocalId: 'synthetic-anchor',
        mode: 'focus' as const, plannedDurationSeconds: 60, actualDurationSeconds: 60,
        startedAt: event.startedAt, completedAt: event.completedAt, source: 'practice_screen' as const,
        guidanceVoice: 'none' as const, backgroundAudio: 'off' as const };
      const first = await PracticeCompletionService.completePracticeSession(input, { mirrorLegacySession: true, flushImmediately: false });
      const strength = useSessionStore.getState().threadStrength;
      const duplicate = await PracticeCompletionService.completePracticeSession(input, { mirrorLegacySession: true, flushImmediately: false });
      expect(first.duplicate).toBe(false);
      expect(duplicate.duplicate).toBe(true);
      expect(useSessionStore.getState().threadStrength).toBe(strength);
      expect(useSessionStore.getState().practiceHistory).toHaveLength(index + 1);
    }
    await db().close();
    const restored = await loadSessionSnapshot(owner);
    expect(restored?.practiceHistory).toHaveLength(20);
    expect(new Set(restored?.practiceHistory?.map(event => event.id)).size).toBe(20);
    expect(restored?.totalSessionsCount).toBe(20);
    expect(restored?.todayPractice.totalSeconds).toBe(1200);
    expect((await db().read(`anchor:practice-write-queue:${owner}`))).toHaveLength(20);
    expect(restored?.threadStrength).toBe(useSessionStore.getState().threadStrength);
  });

  it('rejects a failed Focus transaction without projection and permits a durable retry', async () => {
    const owner = 'stabilization-failure-owner';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const event = record('stabilization-retry-focus', owner);
    const input = { sessionId: event.id, accountId: owner, anchorId: null, mode: 'focus' as const,
      plannedDurationSeconds: 60, actualDurationSeconds: 60, startedAt: event.startedAt,
      completedAt: event.completedAt, source: 'practice_screen' as const,
      guidanceVoice: 'none' as const, backgroundAudio: 'off' as const };
    const fixture = (require('../runtime') as any).testFixture;
    const run = fixture.driver.runAsync;
    fixture.driver.runAsync = async (sql: string, ...params: any[]) => {
      if (params.includes(`anchor:practice-write-queue:${owner}`)) throw new Error('synthetic disk failure');
      return run(sql, ...params);
    };
    try {
      await expect(PracticeCompletionService.completePracticeSession(input, { mirrorLegacySession: true, flushImmediately: false })).rejects.toThrow('synthetic disk failure');
      expect(useSessionStore.getState().practiceHistory).toEqual([]);
    } finally { fixture.driver.runAsync = run; }
    expect(await db().read(`anchor:practice-history:${owner}`)).toBeNull();
    const retry = await PracticeCompletionService.completePracticeSession(input, { mirrorLegacySession: true, flushImmediately: false });
    expect(retry.duplicate).toBe(false);
    await db().close();
    expect((await loadSessionSnapshot(owner))?.practiceHistory?.map(event => event.id)).toEqual([event.id]);
  });

  it.each(['focus', 'deep_prime', 'visualize'] as const)('recovers %s progress after the event commit but before middleware projection', async (mode) => {
    const owner = `projection-${mode}`;
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const event = record(`earned-${mode}`, owner, mode);
    jest.spyOn(useSessionStore.getState(), 'recordPracticeSession').mockImplementation(() => { throw new Error('synthetic process termination'); });
    await PracticeCompletionService.queueCanonicalCompletion(event, true, false).catch(() => undefined);
    await db().close();
    const restored = await loadSessionSnapshot(owner);
    expect(restored?.practiceHistory?.map((entry) => entry.id)).toEqual([event.id]);
    expect(restored?.totalSessionsCount).toBe(1);
    expect(restored?.todayPractice.totalSeconds).toBe(60);
    expect(restored?.primingHistory.map((entry) => entry.id)).toEqual([event.id]);
    expect(restored?.threadStrength).toBeGreaterThan(0);
    expect((await db().read(`anchor:practice-write-queue:${owner}`)).map((entry: any) => entry.id)).toEqual([event.id]);
  });

  it('retains an offline next action in canonical history across restart', async () => {
    const owner = 'next-action-owner';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const event = record('action-session', owner);
    await PracticeCompletionService.queueCanonicalCompletion(event, false, false);
    jest.spyOn(apiClient, 'patch').mockRejectedValue(new Error('synthetic offline'));
    await PracticeCompletionService.saveNextAction({ accountId: owner, sessionId: event.id, nextAction: 'SYNTHETIC PRIVATE NEXT ACTION' });
    await db().close();
    const restored = await loadSessionSnapshot(owner);
    expect(restored?.practiceHistory?.find((entry) => entry.id === event.id)?.nextAction).toBe('SYNTHETIC PRIVATE NEXT ACTION');
    expect(await db().read(`anchor:practice-next-action-queue:${owner}`)).toEqual([{ sessionId: event.id, nextAction: 'SYNTHETIC PRIVATE NEXT ACTION' }]);
  });

  it('preserves the existing missed-day decay when committing a mirrored completion', async () => {
    const owner = 'decay-owner';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const initial = { ...createInitialSessionState(), threadStrength: 80, lastPrimedAt: '2026-10-01', lastDecayDate: '2026-10-01' };
    const event = record('after-missed-days', owner);
    useSessionStore.setState(initial);
    useSessionStore.getState().recordPracticeSession(event);
    const expected = useSessionStore.getState().threadStrength;
    useSessionStore.setState(initial);
    await saveSessionSnapshot(owner, initial);
    await PracticeCompletionService.queueCanonicalCompletion(event, true, false);
    expect((await loadSessionSnapshot(owner))?.threadStrength).toBe(expected);
  });
  it('preserves the actual legacy recordSession then queueLegacyCompletion ordering without a double gain', async () => {
    const owner = 'legacy-route-owner';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const completedAt = new Date().toISOString();
    useSessionStore.getState().recordSession({ idempotencyKey: 'legacy-route-earned', anchorId: 'legacy-route-anchor', type: 'activate', durationSeconds: 60, mode: 'silent', completedAt });
    const expected = useSessionStore.getState();
    await PracticeCompletionService.queueLegacyCompletion({ id: 'legacy-route-earned', anchorId: 'legacy-route-anchor', practiceMode: 'focus', durationSeconds: 60, completedAt, guidanceVoice: 'none', backgroundAudio: 'off' });
    const restored = await loadSessionSnapshot(owner);
    expect(restored?.totalSessionsCount).toBe(1);
    expect(restored?.threadStrength).toBe(expected.threadStrength);
    expect(restored?.todayPractice.totalSeconds).toBe(60);
    expect(restored?.practiceHistory?.map((entry) => entry.id)).toEqual(['legacy-route-earned']);
  });

  it('stops an in-flight practice flush after A changes to B and retains unattempted A events', async () => {
    const owner = 'flush-owner-A';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    await PracticeCompletionService.queueCanonicalCompletion(record('flush-1', owner), false, false);
    await PracticeCompletionService.queueCanonicalCompletion(record('flush-2', owner), false, false);
    let respond!: (value: any) => void;
    const post = jest.spyOn(apiClient, 'post').mockImplementation(() => new Promise((resolve) => { respond = resolve; }));
    const flushing = PracticeCompletionService.flush(owner);
    while (!respond) await new Promise((resolve) => setTimeout(resolve, 1));
    useAuthStore.setState({ user: createMockUser({ id: 'flush-owner-B' }), accountRevision: useAuthStore.getState().accountRevision + 1 });
    useSessionStore.setState({ ...createInitialSessionState(), practiceHistory: [{ ...record('flush-1', 'flush-owner-B'), nextAction: 'B PRIVATE' }] });
    respond({ data: { success: true, data: { threadStrength: 99 } } });
    // A flawed loop would issue a second request under B; let it settle so the assertion is bounded.
    post.mockResolvedValue({ data: { success: true } } as any);
    await flushing;
    expect(post).toHaveBeenCalledTimes(1);
    expect((post.mock.calls[0][2] as any)?.anchorAuthGuard?.()).toBe(false);
    expect(useSessionStore.getState().practiceHistory[0].syncState).toBe('pending');
    expect((await db().read(`anchor:practice-write-queue:${owner}`)).map((entry: any) => entry.id)).toContain('flush-2');
  });

  it('hides A practice history immediately on a real auth-store switch to B', async () => {
    useAuthStore.getState().setUser(createMockUser({ id: 'switch-practice-A' }));
    useSessionStore.setState({ practiceHistory: [record('A-private-practice', 'switch-practice-A')] });
    useAuthStore.getState().setUser(createMockUser({ id: 'switch-practice-B' }));
    expect(useSessionStore.getState().practiceHistory).toEqual([]);
  });
  it('does not return B history to a duplicate A callback waiting on durability', async () => {
    const owner = 'duplicate-callback-A';
    useAuthStore.setState({ user: createMockUser({ id: owner }) });
    const event = record('shared-callback-id', owner);
    const f = (require('../runtime') as any).testFixture;
    const run = f.driver.runAsync;
    let release!: () => void;
    let paused!: () => void;
    const ready = new Promise<void>((resolve) => { paused = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let held = false;
    f.driver.runAsync = async (sql: string, ...params: any[]) => {
      if (!held && params.includes(`anchor:practice-write-queue:${owner}`)) { held = true; paused(); await gate; }
      return run(sql, ...params);
    };
    const input = { sessionId: event.id, accountId: owner, anchorId: null, mode: 'focus' as const, plannedDurationSeconds: 60, actualDurationSeconds: 60, startedAt: event.startedAt, completedAt: event.completedAt, source: 'practice_screen' as const, guidanceVoice: 'none' as const, backgroundAudio: 'off' as const };
    const first = PracticeCompletionService.completePracticeSession(input, { flushImmediately: false });
    await ready;
    const duplicate = PracticeCompletionService.completePracticeSession(input, { flushImmediately: false });
    const outcomes = Promise.allSettled([first, duplicate]);
    useAuthStore.setState({ user: createMockUser({ id: 'duplicate-callback-B' }), accountRevision: useAuthStore.getState().accountRevision + 1 });
    useSessionStore.setState({ practiceHistory: [record(event.id, 'duplicate-callback-B')] });
    release();
    expect((await outcomes).map((result) => result.status)).toEqual(['rejected', 'rejected']);
    f.driver.runAsync = run;
    expect((await db().read(`anchor:practice-history:${owner}`))[0].accountId).toBe(owner);
  });
  it('does not expose device-wide A history during B startup hydration', async () => {
    await db().write('anchor-session-storage', { state: { ...createInitialSessionState(), practiceHistory: [record('retained-global-A', 'global-A')] }, version: 5 });
    useAuthStore.setState({ user: createMockUser({ id: 'global-B' }) });
    await useSessionStore.persist.rehydrate();
    expect(useSessionStore.getState().practiceHistory).toEqual([]);
    expect((await db().read('anchor-session-storage')).state.practiceHistory[0].accountId).toBe('global-A');
  });
  it('does not assign unresolved legacy practice history to the next login', async () => {
    useSessionStore.setState({ ...createInitialSessionState(), practiceHistory: [record('unresolved', 'legacy')] });
    useSessionStore.getState().hydrateFromBackend({ accountId: 'new-login', totalActivations: 1, currentStreak: 0, anchors: [], practiceHistory: [] });
    expect(useSessionStore.getState().practiceHistory.some((event) => event.id === 'unresolved')).toBe(false);
    expect(useSessionStore.getState().practiceHistory.some((event) => event.accountId === 'new-login')).toBe(false);
  });
  it('preserves guest ownership and an authorized transfer ledger across database reopen', async () => {
    await useAnchorStore.persist.rehydrate();
    useAuthStore.setState({ user: null, pendingFirstAnchorDraft: null });
    useAnchorStore.getState().bindAccount(null);
    useAnchorStore.getState().addAnchor(createMockAnchor({ id: 'synthetic-guest-transfer', userId: 'guest' }));
    await useAnchorStore.getState().flushPersistence();
    useAuthStore.setState({ user: createMockUser({ id: 'transfer-A' }) });
    useAnchorStore.getState().bindAccount('transfer-A');
    expect(useAnchorStore.getState().anchors.some((entry) => entry.id === 'synthetic-guest-transfer')).toBe(false);
    useAnchorStore.getState().bindAccount('transfer-A', 'synthetic-guest-transfer');
    await useAnchorStore.getState().flushPersistence();
    useAuthStore.setState({ user: createMockUser({ id: 'transfer-B' }) });
    useAnchorStore.getState().bindAccount('transfer-B', 'synthetic-guest-transfer');
    await useAnchorStore.getState().flushPersistence();
    expect(useAnchorStore.getState().anchors).toEqual([]);
    await db().close();
    expect((await db().read('anchor-vault-storage')).state.guestTransfers['synthetic-guest-transfer']).toBe('transfer-A');
  });
  it('retains Release and Evolve linkage with media references after store rehydration', async () => {
    useAuthStore.setState({ user: createMockUser({ id: 'release-evolve-owner' }) });
    useAnchorStore.getState().bindAccount('release-evolve-owner');
    useAnchorStore.getState().setAnchors([
      createMockAnchor({ id: 'synthetic-release', userId: 'release-evolve-owner' }),
      createMockAnchor({ id: 'synthetic-successor', userId: 'release-evolve-owner', enhancedImageUrl: 'file:///synthetic-owned-media.png' }),
    ]);
    useAnchorStore.getState().releaseAnchor('synthetic-release');
    useAnchorStore.getState().linkEvolvedFrom('synthetic-successor', { anchorId: 'synthetic-release', intention: 'SYNTHETIC SOURCE' });
    await useAnchorStore.getState().flushPersistence();
    await db().close();
    useAnchorStore.setState({ persistedHydrated: false, partitions: {}, anchors: [] });
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().getAnchorById('synthetic-release')?.isReleased).toBe(true);
    expect(useAnchorStore.getState().getAnchorById('synthetic-successor')).toEqual(expect.objectContaining({ enhancedImageUrl: 'file:///synthetic-owned-media.png', evolvedFrom: { anchorId: 'synthetic-release', intention: 'SYNTHETIC SOURCE' } }));
  });
  it('rejects a failed product Anchor durability receipt and retains the prior commit', async () => {
    useAuthStore.setState({ user: createMockUser({ id: 'failure-owner' }) });
    useAnchorStore.getState().bindAccount('failure-owner');
    useAnchorStore.getState().addAnchor(createMockAnchor({ id: 'synthetic-create-good', userId: 'failure-owner' }));
    await useAnchorStore.getState().flushPersistence();
    const f = (require('../runtime') as any).testFixture;
    const run = f.driver.runAsync;
    f.driver.runAsync = async (sql: string, ...params: any[]) => {
      if (params.some((value) => typeof value === 'string' && value.includes('synthetic-create-failed'))) throw new Error('synthetic disk full');
      return run(sql, ...params);
    };
    useAnchorStore.getState().addAnchor(createMockAnchor({ id: 'synthetic-create-failed', userId: 'failure-owner' }));
    await expect(useAnchorStore.getState().flushPersistence()).rejects.toThrow('disk full');
    f.driver.runAsync = run;
    await db().close();
    const saved = (await db().read('anchor-vault-storage')).state.anchors;
    expect(saved.some((entry: any) => entry.id === 'synthetic-create-good')).toBe(true);
    expect(saved.some((entry: any) => entry.id === 'synthetic-create-failed')).toBe(false);
    expect(useAnchorStore.getState().anchors.some((entry) => entry.id === 'synthetic-create-failed')).toBe(true);
  });
  it('restores an offline private Chart reflection only for its owner', async () => {
    const store = useReflectionDraftStore.getState();
    await store.bindAccount('reflection-A');
    await store.upsert({ accountId: 'reflection-A', draftKey: 'synthetic-reflection', body: 'SYNTHETIC PRIVATE CHART WRITING', source: 'POST_PRACTICE', promptType: 'WHAT_CAME_UP', promptVersion: 1, updatedAt: new Date().toISOString(), saveState: 'queued', retryCount: 0, idempotencyKey: 'synthetic-reflection' } as any);
    await store.bindAccount('reflection-B');
    expect(useReflectionDraftStore.getState().drafts).toEqual({});
    await db().close();
    await store.bindAccount('reflection-A');
    expect(useReflectionDraftStore.getState().drafts['synthetic-reflection']?.body).toBe('SYNTHETIC PRIVATE CHART WRITING');
  });
});
