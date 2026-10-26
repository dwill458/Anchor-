import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { useSessionStore } from '@/stores/sessionStore';
import type { V2RecommendationContext } from './recommendationClient';

/**
 * Account-scoped stale-while-revalidate cache for the server-owned Today read
 * model. Persisted entries only support first paint; Home still requests the
 * authoritative context on every mount/focus.
 */
export const V2_RECOMMENDATION_FRESH_MS = 30_000;

type Entry = { value: V2RecommendationContext; fetchedAt: number; practiceMarker: string };

const entries = new Map<string, Entry>();
const persistedReads = new Map<string, Promise<Entry | null>>();
const listeners = new Set<() => void>();
let revision = 0;

/** Home's five mounted heroes observe cache arrivals before selection changes. */
export function subscribeV2RecommendationContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getV2RecommendationCacheRevision(): number { return revision; }

function publish(): void {
  revision += 1;
  listeners.forEach(listener => listener());
}

function currentAccountId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

function scopedKey(anchorId: string, accountId = currentAccountId()): string {
  return `${accountId ?? 'anonymous'}:${anchorId}`;
}

function storageKey(anchorId: string, accountId: string): string {
  return `anchor:v2:recommendation-context:${encodeURIComponent(accountId)}:${encodeURIComponent(anchorId)}`;
}

function currentPracticeMarker(): string {
  try {
    const state = useSessionStore.getState();
    return `${state.lastSession?.id ?? ''}:${state.practiceHistory?.length ?? 0}`;
  } catch {
    return '';
  }
}

function isEntry(value: unknown, anchorId: string): value is Entry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<Entry>;
  return Boolean(
    entry.value &&
      typeof entry.value === 'object' &&
      entry.value.anchorId === anchorId &&
      typeof entry.fetchedAt === 'number' &&
      typeof entry.practiceMarker === 'string',
  );
}

export function rememberV2RecommendationContext(
  anchorId: string,
  value: V2RecommendationContext,
  accountId = currentAccountId(),
): void {
  const previous = entries.get(scopedKey(anchorId, accountId));
  const changed = JSON.stringify(previous?.value) !== JSON.stringify(value);
  const entry = { value, fetchedAt: Date.now(), practiceMarker: currentPracticeMarker() };
  entries.set(scopedKey(anchorId, accountId), entry);
  if (value.anchorId && value.anchorId !== anchorId) {
    entries.set(scopedKey(value.anchorId, accountId), entry);
  }
  if (changed) publish();

  // Recommendation data is private account data; keep the presentation copy
  // in the same encrypted store used for persisted Anchors and session state.
  if (accountId) {
    void Promise.resolve(
      encryptedPersistStorage.setItem(storageKey(anchorId, accountId), JSON.stringify(entry)),
    ).catch(() => undefined);
    if (value.anchorId && value.anchorId !== anchorId) {
      void Promise.resolve(
        encryptedPersistStorage.setItem(storageKey(value.anchorId, accountId), JSON.stringify(entry)),
      ).catch(() => undefined);
    }
  }
}

/** Restore a presentation fallback while the server read proceeds independently. */
export async function hydrateV2RecommendationContext(
  anchorId: string | null | undefined,
  accountId = currentAccountId(),
): Promise<V2RecommendationContext | null> {
  if (!anchorId) return null;
  const key = scopedKey(anchorId, accountId);
  const current = entries.get(key);
  if (current) return current.value;
  if (!accountId) return null;

  let pending = persistedReads.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const raw = await encryptedPersistStorage.getItem(storageKey(anchorId, accountId));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isEntry(parsed, anchorId) ? parsed : null;
      } catch {
        return null;
      }
    })();
    persistedReads.set(key, pending);
    void pending.finally(() => {
      if (persistedReads.get(key) === pending) persistedReads.delete(key);
    });
  }

  const restored = await pending;
  const newer = entries.get(key);
  if (newer) return newer.value;
  if (!restored) return null;
  entries.set(key, restored);
  publish();
  return restored.value;
}

/** The last context seen for this Anchor, at any age. */
export function peekV2RecommendationContext(anchorId: string | null | undefined): V2RecommendationContext | null {
  if (!anchorId) return null;
  return entries.get(scopedKey(anchorId))?.value ?? null;
}

/** True when the cached context can be shown without asking the server again. */
export function isV2RecommendationContextFresh(anchorId: string | null | undefined): boolean {
  if (!anchorId) return false;
  const entry = entries.get(scopedKey(anchorId));
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < V2_RECOMMENDATION_FRESH_MS && entry.practiceMarker === currentPracticeMarker();
}

export function invalidateV2RecommendationContext(anchorId?: string): void {
  const accountId = currentAccountId();
  if (anchorId) {
    if (entries.delete(scopedKey(anchorId, accountId))) publish();
    if (accountId) {
      void Promise.resolve(encryptedPersistStorage.removeItem(storageKey(anchorId, accountId))).catch(() => undefined);
    }
  } else {
    const hadEntries = entries.size > 0;
    entries.clear();
    persistedReads.clear();
    if (hadEntries) publish();
  }
}
