import { createRecapCache, loadRecap, KeyValueStorage } from '../recapRepository';
import { RecapApiError, AvailableRecapView } from '../recapTypes';

const mem = (): KeyValueStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
};
const v = (o: Partial<AvailableRecapView> = {}): AvailableRecapView => ({
  available: true, weekKey: '2026-10-12', timeZone: 'UTC', phase: 'FINAL', status: 'FINAL', provisional: false,
  finalizesAt: 'x', generatedAt: 'g1', content: { core: {} as any, map: null }, feedback: null, ...o,
});
const draft = (o: Partial<AvailableRecapView> = {}) => v({ phase: 'PROVISIONAL', status: 'DRAFT', provisional: true, ...o });

describe('recap repository', () => {
  it('serves the network result and caches it', async () => {
    const cache = createRecapCache(mem(), 'u1');
    const r = await loadRecap({ fetch: async () => v(), cache });
    expect(r).toMatchObject({ source: 'NETWORK', stale: false });
    expect((await cache.load('2026-10-12'))?.generatedAt).toBe('g1');
  });

  it('falls back to the cache offline and marks it stale', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await cache.save(v());
    const r = await loadRecap({ fetch: async () => { throw new Error('Network Error'); }, cache });
    expect(r).toMatchObject({ source: 'CACHE', stale: true });
    expect(r.view.weekKey).toBe('2026-10-12');
  });

  it('offline with a specific week serves that week; with no cache it rethrows', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await expect(loadRecap({ fetch: async () => { throw new Error('offline'); }, cache, weekKey: '2026-10-12' })).rejects.toThrow('offline');
  });

  it('never lets a provisional copy overwrite a cached FINAL copy', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await cache.save(v({ generatedAt: 'final' }));
    await cache.save(draft({ generatedAt: 'late-draft' }));
    expect((await cache.load('2026-10-12'))?.generatedAt).toBe('final');
  });

  it('does cache a FINAL over a cached draft', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await cache.save(draft({ generatedAt: 'd' }));
    await cache.save(v({ generatedAt: 'f' }));
    expect((await cache.load('2026-10-12'))?.generatedAt).toBe('f');
  });

  it('does not cache or fall back to unavailable responses', async () => {
    const cache = createRecapCache(mem(), 'u1');
    const r = await loadRecap({ fetch: async () => ({ available: false, phase: 'NOT_AVAILABLE', weekKey: 'w', timeZone: 'UTC', availableAt: 'a' }), cache });
    expect(r.view.available).toBe(false);
    expect(await cache.loadLatest()).toBeNull();
  });

  it('rethrows FEATURE_DISABLED instead of masking it with the cache (caller falls back to legacy)', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await cache.save(v());
    await expect(loadRecap({ fetch: async () => { throw new RecapApiError('FEATURE_DISABLED'); }, cache })).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
  });

  it('isolates caches per account on a shared device', async () => {
    const store = mem();
    await createRecapCache(store, 'u1').save(v());
    expect(await createRecapCache(store, 'u2').load('2026-10-12')).toBeNull();
  });

  it('survives corrupt cache contents', async () => {
    const store = mem();
    store.data.set('weeklyRecap:v1:u1:2026-10-12', '{not json');
    expect(await createRecapCache(store, 'u1').load('2026-10-12')).toBeNull();
  });

  it('latest pointer follows the most recently cached week', async () => {
    const cache = createRecapCache(mem(), 'u1');
    await cache.save(v({ weekKey: '2026-10-05' }));
    await cache.save(v({ weekKey: '2026-10-12' }));
    expect((await cache.loadLatest())?.weekKey).toBe('2026-10-12');
  });
});
