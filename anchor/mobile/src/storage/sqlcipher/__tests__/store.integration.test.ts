jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { sqlCipherLab: true }, version: 'test' } } }));
jest.mock('@/storage/sqlcipher/runtime', () => {
  const f = require('./sqliteTestDriver').fixture();
  return { recordDatabase: () => f.db, testFixture: f };
});
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useVisualizationSceneStore } from '@/stores/visualizationSceneStore';
import { createMockAnchor, createMockUser } from '@/__tests__/utils/testUtils';
import { readPersistedSceneOwner } from '../persistence';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { useSessionStore } from '@/stores/sessionStore';
import type { PracticeSessionRecord } from '@/types/practice';

const db = () => (require('../runtime') as any).testFixture.db;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('real stores through record persistence (synthetic SQLite driver)', () => {
  it('retains A unsynced content across B, memory reset and authorized offline A', async () => {
    await useAnchorStore.persist.rehydrate();
    useAuthStore.setState({ user: createMockUser({ id: 'A' }), isAuthenticated: true });
    useAnchorStore.getState().bindAccount('A');
    useAnchorStore.getState().setAnchors([createMockAnchor({ id: 'only-A', userId: 'A', intentionText: 'SYNTHETIC A PRIVATE' })]);
    await useAnchorStore.getState().flushPersistence();
    useAuthStore.setState({ user: createMockUser({ id: 'B' }) });
    useAnchorStore.getState().bindAccount('B');
    expect(useAnchorStore.getState().anchors).toHaveLength(0);
    await db().close();
    useAnchorStore.setState({ persistedHydrated: false, partitions: {}, anchors: [], activeScope: 'account:B' });
    await useAnchorStore.persist.rehydrate();
    expect(useAnchorStore.getState().anchors).toHaveLength(0);
    useAuthStore.setState({ user: createMockUser({ id: 'A' }) });
    useAnchorStore.getState().bindAccount('A');
    expect(useAnchorStore.getState().anchors[0].intentionText).toBe('SYNTHETIC A PRIVATE');
    expect((await db().ownerRecords('anchor-vault-storage', 'account:B')).every((row: { payload: string }) => !row.payload.includes('SYNTHETIC A PRIVATE'))).toBe(true);
  });
  it('retains A scene batches when B signs in and restores A', async () => {
    const scene = useVisualizationSceneStore.getState();
    scene.bindAccount('A'); await settle();
    useVisualizationSceneStore.getState().setSuggestions('anchor-A', ['SYNTHETIC A SCENE'], 'gemini');
    await readPersistedSceneOwner('A'); // fence confirms previous queued save
    useVisualizationSceneStore.getState().bindAccount('B'); await settle();
    expect(useVisualizationSceneStore.getState().suggestions['anchor-A']).toBeUndefined();
    await db().close();
    useVisualizationSceneStore.getState().bindAccount('A'); await settle();
    expect(useVisualizationSceneStore.getState().suggestions['anchor-A']).toEqual(['SYNTHETIC A SCENE']);
  });
  it('commits practice history and pending event together and rejects failed completion', async () => {
    useAuthStore.setState({ user: createMockUser({ id: 'A' }) });
    const record = { id: 'synthetic-earned', accountId: 'A', completedAt: '2026-10-13T12:00:00.000Z', startedAt: '2026-10-13T11:59:00.000Z', practiceMode: 'focus', syncState: 'pending', anchorId: 'only-A', plannedDurationSeconds: 60, completedDurationSeconds: 60 } as PracticeSessionRecord;
    await PracticeCompletionService.queueCanonicalCompletion(record, false, false);
    await db().close();
    expect(await db().read('anchor:practice-write-queue:A')).toEqual([record]);
    const durable = await db().read('anchor-session-storage');
    expect(durable.state.practiceHistory.some((entry: PracticeSessionRecord) => entry.id === record.id)).toBe(true);
    const f = (require('../runtime') as any).testFixture;
    const run = f.driver.runAsync;
    f.driver.runAsync = async (sql: string, ...params: any[]) => {
      if (params.some((p) => typeof p === 'string' && p.includes('synthetic-failed-practice'))) throw new Error('synthetic practice IO failure');
      return run(sql, ...params);
    };
    await expect(PracticeCompletionService.queueCanonicalCompletion({ ...record, id: 'synthetic-failed-practice' }, false, false)).rejects.toThrow('IO failure');
    expect(useSessionStore.getState().practiceHistory.some((event) => event.id === 'synthetic-failed-practice')).toBe(false);
    expect(await db().read('anchor:practice-write-queue:A')).toEqual([record]);
    f.driver.runAsync = run;
  });
  it('does not smuggle a failed rapid completion into the next committed history', async () => {
    const f = (require('../runtime') as any).testFixture;
    const run = f.driver.runAsync;
    f.driver.runAsync = async (sql: string, ...params: any[]) => {
      if (params.some((p) => typeof p === 'string' && p.includes('synthetic-rapid-failed'))) throw new Error('rapid failure');
      return run(sql, ...params);
    };
    const base = { accountId: 'A', completedAt: '2026-10-13T13:00:00.000Z', practiceMode: 'focus', syncState: 'pending' } as PracticeSessionRecord;
    const results = await Promise.allSettled([
      PracticeCompletionService.queueCanonicalCompletion({ ...base, id: 'synthetic-rapid-failed' }, false, false),
      PracticeCompletionService.queueCanonicalCompletion({ ...base, id: 'synthetic-rapid-success' }, false, false),
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    const durable = await db().read('anchor-session-storage');
    expect(durable.state.practiceHistory.some((event: PracticeSessionRecord) => event.id === 'synthetic-rapid-failed')).toBe(false);
    expect(durable.state.practiceHistory.some((event: PracticeSessionRecord) => event.id === 'synthetic-rapid-success')).toBe(true);
    expect((await db().read('anchor:practice-write-queue:A')).some((event: PracticeSessionRecord) => event.id === 'synthetic-rapid-success')).toBe(true);
    f.driver.runAsync = run;
  });
});
