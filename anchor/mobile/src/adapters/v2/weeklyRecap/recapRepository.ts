import type { AvailableRecapView, RecapView } from './recapTypes';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface RecapCache {
  load(weekKey: string): Promise<AvailableRecapView | null>;
  loadLatest(): Promise<AvailableRecapView | null>;
  save(view: AvailableRecapView): Promise<void>;
}

/** Per-account cache. A FINAL recap is never replaced by a provisional one. */
export function createRecapCache(storage: KeyValueStorage, namespace: string): RecapCache {
  const key = (weekKey: string) => `weeklyRecap:v1:${namespace}:${weekKey}`;
  const latestKey = `weeklyRecap:v1:${namespace}:latest`;
  const parse = (raw: string | null): AvailableRecapView | null => {
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      return v && v.available === true && typeof v.weekKey === 'string' ? (v as AvailableRecapView) : null;
    } catch {
      return null;
    }
  };
  const load = async (weekKey: string) => {
    try { return parse(await storage.getItem(key(weekKey))); } catch { return null; }
  };
  return {
    load,
    async loadLatest() {
      try {
        const wk = await storage.getItem(latestKey);
        return wk ? await load(wk) : null;
      } catch { return null; }
    },
    async save(view) {
      try {
        const existing = await load(view.weekKey);
        if (existing?.status === 'FINAL' && view.status !== 'FINAL') return;
        await storage.setItem(key(view.weekKey), JSON.stringify(view));
        await storage.setItem(latestKey, view.weekKey);
      } catch { /* cache is best-effort */ }
    },
  };
}

export interface LoadRecapResult {
  view: RecapView;
  source: 'NETWORK' | 'CACHE';
  /** True when the network was unreachable and a saved copy is being shown. */
  stale: boolean;
}

export async function loadRecap(opts: {
  fetch: () => Promise<RecapView>;
  cache: RecapCache;
  weekKey?: string;
}): Promise<LoadRecapResult> {
  try {
    const view = await opts.fetch();
    if (view.available) await opts.cache.save(view);
    return { view, source: 'NETWORK', stale: false };
  } catch (error: any) {
    // A disabled feature must surface so the caller can fall back to the legacy screen.
    if (error?.code === 'FEATURE_DISABLED') throw error;
    const cached = opts.weekKey ? await opts.cache.load(opts.weekKey) : await opts.cache.loadLatest();
    if (cached) return { view: cached, source: 'CACHE', stale: true };
    throw error;
  }
}
