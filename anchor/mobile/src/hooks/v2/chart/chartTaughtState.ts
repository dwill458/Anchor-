import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

const cache = new Map<string, boolean>();
const generations = new Map<string, number>();

const storageKey = (accountId: string) =>
  `anchor:v2:chart2:taught:${encodeURIComponent(accountId)}`;
const guestKey = () => `guest:chart-taught`;

function persist(key: string, value: string): void {
  try {
    Promise.resolve(encryptedPersistStorage.setItem(key, value)).catch(() => undefined);
  } catch {
    // Teaching is presentation-only; an unavailable keystore must never block the Chart.
  }
}

export async function getChartTaughtState(accountId: string | null, courseId?: string): Promise<boolean> {
  const memoryKey = accountId ? storageKey(accountId) : guestKey();
  const cached = cache.get(memoryKey);
  if (cached !== undefined) return cached;
  const generation = generations.get(memoryKey) ?? 0;

  try {
    const value = await encryptedPersistStorage.getItem(memoryKey);
    if ((generations.get(memoryKey) ?? 0) !== generation) return cache.get(memoryKey) ?? false;
    let taught = value === '1';
    if (!taught && courseId && accountId) {
      // Backwards-compatibility: migrate legacy per-course mark if it was already taught
      try {
        const legacyKey = `anchor:v2:chart2:taught:${encodeURIComponent(accountId)}:${encodeURIComponent(courseId)}`;
        const legacyValue = await encryptedPersistStorage.getItem(legacyKey);
        if (legacyValue === '1') {
          taught = true;
          persist(memoryKey, '1');
        }
      } catch {
        // ignore legacy read error
      }
    }
    if (!taught && accountId) {
      try {
        const gKey = guestKey();
        const guestValue = await encryptedPersistStorage.getItem(gKey);
        if (guestValue === '1') {
          taught = true;
          generations.set(gKey, (generations.get(gKey) ?? 0) + 1);
          cache.delete(gKey);
          persist(memoryKey, '1');
          try {
            Promise.resolve(encryptedPersistStorage.removeItem(gKey)).catch(() => undefined);
          } catch {
            // ignore guest cleanup error
          }
        }
      } catch {
        // ignore guest read error
      }
    }
    cache.set(memoryKey, taught);
    return taught;
  } catch {
    return false;
  }
}

export function setChartTaughtState(accountId: string | null, _courseId?: string): void {
  const memoryKey = accountId ? storageKey(accountId) : guestKey();
  generations.set(memoryKey, (generations.get(memoryKey) ?? 0) + 1);
  cache.set(memoryKey, true);
  persist(memoryKey, '1');
}

/** Clears both the session cache and encrypted mark for the development Chart lab or settings reset. */
export async function resetChartTaughtState(accountId: string | null, courseId?: string): Promise<void> {
  const memoryKey = accountId ? storageKey(accountId) : guestKey();
  generations.set(memoryKey, (generations.get(memoryKey) ?? 0) + 1);
  generations.set(guestKey(), (generations.get(guestKey()) ?? 0) + 1);
  cache.delete(memoryKey);
  cache.delete(guestKey());
  try {
    await encryptedPersistStorage.removeItem(memoryKey);
    await encryptedPersistStorage.removeItem(guestKey());
    if (courseId && accountId) {
      const legacyKey = `anchor:v2:chart2:taught:${encodeURIComponent(accountId)}:${encodeURIComponent(courseId)}`;
      await encryptedPersistStorage.removeItem(legacyKey);
    }
  } catch {
    // The next session will retry the teaching if storage cannot be cleared.
  }
}

/** Test helper for cases that need to model a fresh process. */
export function resetChartTaughtStateCache(): void {
  cache.clear();
  generations.forEach((generation, key) => generations.set(key, generation + 1));
}
