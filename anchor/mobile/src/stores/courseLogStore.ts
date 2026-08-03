import { create } from 'zustand';
import { chartApiClient, getChartErrorCode } from '@/services/ChartApiClient';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import { chartLogCacheKey } from './courseStore';
import type { CourseLogEntry } from '@/types/chart';

type LogCache = { schemaVersion: 1; accountId: string; courseId: string; entries: CourseLogEntry[]; nextCursor: string | null; lastSyncedAt: number };
type CourseLogState = {
  accountId: string | null;
  courseId: string | null;
  entries: CourseLogEntry[];
  nextCursor: string | null;
  loading: boolean;
  refreshing: boolean;
  offline: boolean;
  errorCode: string | null;
  bind: (accountId: string | null, courseId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markReflectionDeleted: (reflectionId: string) => void;
  findReflection: (reflectionId: string) => CourseLogEntry['reflection'] | null;
};

function validCache(value: unknown, accountId: string, courseId: string): LogCache | null {
  if (!value || typeof value !== 'object') return null;
  const cache = value as Partial<LogCache>;
  if (cache.schemaVersion !== 1 || cache.accountId !== accountId || cache.courseId !== courseId || !Array.isArray(cache.entries)) return null;
  return { schemaVersion: 1, accountId, courseId, entries: cache.entries, nextCursor: cache.nextCursor ?? null, lastSyncedAt: cache.lastSyncedAt ?? 0 };
}

async function persist(accountId: string, courseId: string, entries: CourseLogEntry[], nextCursor: string | null): Promise<void> {
  // This encrypted cache is intentionally bounded. It can contain private Reflection text.
  const cache: LogCache = { schemaVersion: 1, accountId, courseId, entries: entries.slice(0, 50), nextCursor, lastSyncedAt: Date.now() };
  await encryptedPersistStorage.setItem(chartLogCacheKey(accountId, courseId), JSON.stringify(cache));
}

export const useCourseLogStore = create<CourseLogState>((set, get) => ({
  accountId: null, courseId: null, entries: [], nextCursor: null, loading: false, refreshing: false, offline: false, errorCode: null,
  bind: async (accountId, courseId) => {
    set({ accountId, courseId, entries: [], nextCursor: null, loading: true, errorCode: null, offline: false });
    if (!accountId) { set({ loading: false }); return; }
    try {
      const raw = await encryptedPersistStorage.getItem(chartLogCacheKey(accountId, courseId));
      if (get().accountId !== accountId || get().courseId !== courseId) return;
      const cache = validCache(raw ? JSON.parse(raw) : null, accountId, courseId);
      if (cache) set({ entries: cache.entries, nextCursor: cache.nextCursor, loading: false });
    } catch { /* cache is optional; do not expose its contents through logs */ }
    await get().refresh();
  },
  refresh: async () => {
    const { accountId, courseId } = get();
    if (!accountId || !courseId) return;
    set({ refreshing: true, loading: get().entries.length === 0, errorCode: null });
    try {
      const result = await chartApiClient.getCourseLog(courseId, { limit: 25 });
      if (get().accountId !== accountId || get().courseId !== courseId) return;
      set({ entries: result.data, nextCursor: result.pagination?.nextCursor ?? null, offline: false, errorCode: null });
      await persist(accountId, courseId, result.data, result.pagination?.nextCursor ?? null);
    } catch (error) {
      if (get().accountId === accountId && get().courseId === courseId) set({ offline: get().entries.length > 0, errorCode: getChartErrorCode(error) ?? 'NETWORK' });
    } finally { if (get().accountId === accountId && get().courseId === courseId) set({ loading: false, refreshing: false }); }
  },
  loadMore: async () => {
    const { accountId, courseId, nextCursor, loading, refreshing } = get();
    if (!accountId || !courseId || !nextCursor || loading || refreshing) return;
    set({ loading: true });
    try {
      const result = await chartApiClient.getCourseLog(courseId, { cursor: nextCursor, limit: 25 });
      if (get().accountId !== accountId || get().courseId !== courseId) return;
      const known = new Set(get().entries.map((entry) => entry.id));
      const entries = [...get().entries, ...result.data.filter((entry) => !known.has(entry.id))];
      set({ entries, nextCursor: result.pagination?.nextCursor ?? null, offline: false });
      await persist(accountId, courseId, entries, result.pagination?.nextCursor ?? null);
    } catch (error) { set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' }); }
    finally { set({ loading: false }); }
  },
  markReflectionDeleted: (reflectionId) => set((state) => ({
    entries: state.entries.map((entry) => entry.reflection?.id === reflectionId ? { ...entry, reflection: null } : entry),
  })),
  findReflection: (reflectionId) => get().entries.find((entry) => entry.reflection?.id === reflectionId)?.reflection ?? null,
}));
