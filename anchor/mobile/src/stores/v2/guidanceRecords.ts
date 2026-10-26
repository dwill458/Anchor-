import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { GUIDANCE_REGISTRY } from '@/constants/v2/guidanceRegistry';
import { emptyGuidanceRecord, type GuidanceData } from './guidanceCoordinator';

type Blob = GuidanceData & { schema: 1; bootedAt: string };
type Storage = { getItem: (key: string) => unknown; setItem: (key: string, value: string) => unknown; removeItem: (key: string) => unknown };
export const guidanceStorageKey = (account: string) => account === 'guest' ? 'guest:guidance' : `anchor:v2:guidance:${encodeURIComponent(account)}`;

export function mergeGuidanceRecords(account: GuidanceData, guest: GuidanceData): GuidanceData {
  const records = { ...account.records };
  Object.entries(guest.records).forEach(([id, incoming]) => {
    const current = records[id];
    if (!current) { records[id] = { ...incoming }; return; }
    const winner = current.outcome ? current : incoming.outcome ? incoming : current;
    const dates = [current.firstDisplayedAt, incoming.firstDisplayedAt].filter((date): date is string => Boolean(date)).sort();
    records[id] = { ...winner, firstDisplayedAt: dates[0], displayCount: Math.max(current.displayCount, incoming.displayCount), presentAttempts: Math.max(current.presentAttempts, incoming.presentAttempts) };
  });
  return { records, discovery: { ...guest.discovery, ...account.discovery } };
}

/** One account blob extends the existing encrypted teaching persistence, with old
 * keys kept only as migration inputs. They are never updated after cutover. */
export function createGuidanceRecords(storage: Storage) {
  const cache = new Map<string, Blob>();
  const loading = new Map<string, Promise<Blob>>();
  const writes = new Map<string, Promise<void>>();
  let promotion: Promise<unknown> = Promise.resolve();
  const queue = (account: string, action: () => unknown) => {
    const next = (writes.get(account) ?? Promise.resolve()).catch(() => undefined).then(action).then(() => undefined);
    writes.set(account, next);
    return next;
  };
  const read = async (account: string): Promise<Blob> => {
    const cached = cache.get(account);
    if (cached) return cached;
    const raw = await storage.getItem(guidanceStorageKey(account));
    let blob: Blob;
    if (raw !== null && raw !== undefined) {
      blob = JSON.parse(String(raw));
      if (blob.schema !== 1 || !blob.records || !blob.discovery || !blob.bootedAt) throw new Error('Unreadable guidance records');
      for (const value of Object.values(blob.records)) {
        if (!Number.isFinite(value.displayCount) || !Number.isFinite(value.presentAttempts) || !Number.isFinite(value.interruptCount)) throw new Error('Invalid guidance record');
      }
    } else {
      blob = { schema: 1, bootedAt: new Date().toISOString(), records: {}, discovery: {} };
      await Promise.all(GUIDANCE_REGISTRY.map(async def => {
        const beats = def.id === 'today.recommended' ? ['home.today', 'practice.today'] : def.beat ? [def.beat] : [];
        const keys = beats.map(beat => account === 'guest' ? `guest:teach:${beat}` : `anchor:v2:teach:${beat}:${encodeURIComponent(account)}`);
        if (def.id === 'chart.next_move') keys.push(account === 'guest' ? 'guest:chart-taught' : `anchor:v2:chart2:taught:${encodeURIComponent(account)}`);
        const values = await Promise.all(keys.map(key => storage.getItem(key)));
        if (values.includes('1')) blob.records[def.id] = { ...emptyGuidanceRecord(), ...(def.surface === 'whisper' ? { displayCount: 1 } : { outcome: 'acknowledged' as const, outcomeDetail: 'migrated' }) };
      }));
    }
    cache.set(account, blob);
    return blob;
  };
  const load = (account: string): Promise<Blob> => {
    const pending = loading.get(account);
    if (pending) return pending;
    const task = promotion.catch(() => undefined).then(async () => {
      const blob = await read(account);
      if (account !== 'guest') {
        const guest = await read('guest');
        Object.assign(blob, mergeGuidanceRecords(blob, guest));
        // Delete only after successful promotion. A failed write must retain the guest history.
        await queue(account, () => storage.setItem(guidanceStorageKey(account), JSON.stringify(blob)));
        // Legacy guest keys must also be consumed, otherwise the next account
        // could re-import already-promoted history from the rollback keys.
        const guestKeys = GUIDANCE_REGISTRY.flatMap(def => def.beat ? [`guest:teach:${def.beat}`] : []);
        guestKeys.push('guest:teach:practice.today', 'guest:chart-taught');
        await queue('guest', async () => {
          await Promise.all(guestKeys.map(key => storage.removeItem(key)));
          await storage.removeItem(guidanceStorageKey('guest'));
        });
        cache.set('guest', { schema: 1, bootedAt: new Date().toISOString(), records: {}, discovery: {} });
      }
      return blob;
    });
    promotion = task;
    loading.set(account, task);
    void task.finally(() => { loading.delete(account); }).catch(() => undefined);
    return task;
  };
  return {
    load,
    save: (account: string, data: GuidanceData) => {
      const previous = cache.get(account);
      if (!previous) return;
      const blob: Blob = { ...previous, records: { ...data.records }, discovery: { ...data.discovery } };
      cache.set(account, blob);
      const payload = JSON.stringify(blob);
      void queue(account, () => storage.setItem(guidanceStorageKey(account), payload)).catch(() => undefined);
    },
    flush: async () => { await Promise.all([...writes.values()].map(write => write.catch(() => undefined))); },
  };
}
export const guidanceRecords = createGuidanceRecords(encryptedPersistStorage);
