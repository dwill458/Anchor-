import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { TEACHING_BEAT_IDS, type BeatId } from '@/constants/v2/teachingCopy';

const cache = new Map<string, boolean>();
const generations = new Map<string, number>();
const writes = new Map<string, Promise<void>>();
const keyFor = (accountId: string | null, beat: BeatId) => accountId
  ? `anchor:v2:teach:${beat}:${encodeURIComponent(accountId)}` : `guest:teach:${beat}`;

// Serialize writes and resets to the same key, including secure storage's multi-call writes.
function write(key: string, action: () => unknown): Promise<void> {
  const next = (writes.get(key) ?? Promise.resolve()).then(action).then(() => undefined).catch(() => undefined);
  writes.set(key, next);
  void next.then(() => { if (writes.get(key) === next) writes.delete(key); });
  return next;
}

export async function getTeachingSeen(accountId: string | null, beat: BeatId): Promise<boolean> {
  const key = keyFor(accountId, beat);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (!accountId) return false;
  const generation = generations.get(key) ?? 0;
  try {
    const value = await encryptedPersistStorage.getItem(key);
    if ((generations.get(key) ?? 0) !== generation) return cache.get(key) ?? false;
    cache.set(key, value === '1');
    return value === '1';
  } catch { return false; }
}

export function setTeachingSeen(accountId: string | null, beat: BeatId): void {
  const key = keyFor(accountId, beat);
  generations.set(key, (generations.get(key) ?? 0) + 1);
  cache.set(key, true);
  if (accountId) void write(key, () => encryptedPersistStorage.setItem(key, '1'));
}

export async function resetAllTeachingSeen(accountId: string | null): Promise<void> {
  await Promise.all(TEACHING_BEAT_IDS.map(beat => {
    const key = keyFor(accountId, beat);
    generations.set(key, (generations.get(key) ?? 0) + 1);
    cache.set(key, false);
    return accountId ? write(key, () => encryptedPersistStorage.removeItem(key)) : Promise.resolve();
  }));
}

export function resetTeachingSeenCache(): void {
  cache.clear();
  // Invalidate pending reads as well as settled cache entries.
  generations.forEach((generation, key) => generations.set(key, generation + 1));
}
