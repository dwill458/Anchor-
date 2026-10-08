import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

const cache = new Map<string, boolean>();
const generations = new Map<string, number>();

const storageKey = (accountId: string, courseId: string) =>
  `anchor:v2:chart2:taught:${encodeURIComponent(accountId)}:${encodeURIComponent(courseId)}`;
const guestKey = (courseId: string) => `guest:chart-taught:${encodeURIComponent(courseId)}`;

function persist(key: string, value: string): void {
  try {
    Promise.resolve(encryptedPersistStorage.setItem(key, value)).catch(() => undefined);
  } catch {
    // Teaching is presentation-only; an unavailable keystore must never block the Chart.
  }
}

export async function getChartTaughtState(accountId: string | null, courseId: string): Promise<boolean> {
  const memoryKey = accountId ? storageKey(accountId, courseId) : guestKey(courseId);
  const cached = cache.get(memoryKey);
  if (cached !== undefined) return cached;
  if (!accountId) return false;
  const generation = generations.get(memoryKey) ?? 0;

  try {
    const value = await encryptedPersistStorage.getItem(memoryKey);
    if ((generations.get(memoryKey) ?? 0) !== generation) return cache.get(memoryKey) ?? false;
    const taught = value === '1';
    cache.set(memoryKey, taught);
    return taught;
  } catch {
    return false;
  }
}

export function setChartTaughtState(accountId: string | null, courseId: string): void {
  const memoryKey = accountId ? storageKey(accountId, courseId) : guestKey(courseId);
  generations.set(memoryKey, (generations.get(memoryKey) ?? 0) + 1);
  cache.set(memoryKey, true);
  if (accountId) persist(memoryKey, '1');
}

/** Clears both the session cache and encrypted mark for the development Chart lab. */
export async function resetChartTaughtState(accountId: string | null, courseId: string): Promise<void> {
  const memoryKey = accountId ? storageKey(accountId, courseId) : guestKey(courseId);
  generations.set(memoryKey, (generations.get(memoryKey) ?? 0) + 1);
  cache.delete(memoryKey);
  if (!accountId) return;
  try {
    await encryptedPersistStorage.removeItem(memoryKey);
  } catch {
    // The next session will retry the teaching if storage cannot be cleared.
  }
}

/** Test helper for cases that need to model a fresh process. */
export function resetChartTaughtStateCache(): void {
  cache.clear();
  generations.clear();
}
