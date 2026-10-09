import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

/** Presentation-only, per-account memory of whether the Chart intro was seen. */
const seenByKey = new Map<string, boolean>();
const keyForAccount = (accountId: string) => `anchor:v2:chart2:introSeen:${encodeURIComponent(accountId)}`;
const guestKey = 'guest:chart-intro-seen';

function resolveAccount(accountId?: string | null): string | null {
  return accountId === undefined ? useAuthStore.getState().user?.id ?? null : accountId;
}

function memoryKey(accountId: string | null): string {
  return accountId ? keyForAccount(accountId) : guestKey;
}

/** Read once per process. A storage error is treated as unseen and cached to avoid retry loops. */
export async function getChartIntroSeen(accountId?: string | null): Promise<boolean> {
  const account = resolveAccount(accountId);
  const memory = memoryKey(account);
  if (seenByKey.has(memory)) return seenByKey.get(memory) ?? false;
  if (!account) {
    seenByKey.set(memory, false);
    return false;
  }

  let seen = false;
  try {
    seen = (await encryptedPersistStorage.getItem(memory)) === '1';
  } catch {
    // A failed read must play the full intro and must not block presentation.
  }
  seenByKey.set(memory, seen);
  return seen;
}

/**
 * Synchronous read of what is already known for this process: null until something has primed or read the flag.
 * The Create Chart row primes it, so the intro can decide its audio on its first committed frame.
 */
export function peekChartIntroSeen(accountId?: string | null): boolean | null {
  const memory = memoryKey(resolveAccount(accountId));
  return seenByKey.has(memory) ? seenByKey.get(memory) ?? false : null;
}

/** Mark the presentation seen; persistence is best-effort and never blocks the sequence. */
export async function setChartIntroSeen(accountId?: string | null): Promise<void> {
  const account = resolveAccount(accountId);
  const memory = memoryKey(account);
  seenByKey.set(memory, true);
  if (!account) return;
  try {
    await encryptedPersistStorage.setItem(memory, '1');
  } catch {
    // Keep the in-memory mark for this process; do not retry in a loop.
  }
}

/** Dev-lab reset for the active account (or guest session). */
export async function resetChartIntroSeen(accountId?: string | null): Promise<void> {
  const account = resolveAccount(accountId);
  const memory = memoryKey(account);
  seenByKey.delete(memory);
  if (!account) return;
  try {
    await encryptedPersistStorage.removeItem(memory);
  } catch {
    // A dev-lab reset should not crash the host if secure storage is unavailable.
  }
}

/** Test helper for isolating account and guest cases. */
export function resetChartIntroSeenCache(): void {
  seenByKey.clear();
}
