import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import type { HighWaterMap } from '@/components/v2/chart/map/chartMapContracts';

/**
 * Presentation-only high-water marks so the drawn route never retreats (for
 * example when a metric is lowered). Never touches server data. Persisted
 * encrypted under `anchor:v2:chart2:hw:{acct}:{courseId}`; never throws.
 *
 * Guests (no account) keep an in-memory map per course for the session only.
 * A mark is never lowered: commits and the persisted copy are merged by max.
 */

const cache = new Map<string, HighWaterMap>();
/** Persist keys whose stored copy has been read; commits before that stay in memory so they cannot overwrite a higher stored mark. */
const loadedPersistKeys = new Set<string>();
const EMPTY: HighWaterMap = {};

const storageKey = (accountId: string, courseId: string) =>
  `anchor:v2:chart2:hw:${encodeURIComponent(accountId)}:${encodeURIComponent(courseId)}`;
const guestKey = (courseId: string) => `guest:${encodeURIComponent(courseId)}`;

const sameMap = (a: HighWaterMap, b: HighWaterMap): boolean => {
  const ak = Object.keys(a);
  if (ak.length !== Object.keys(b).length) return false;
  return ak.every((k) => a[k] === b[k]);
};

const sanitize = (value: unknown): HighWaterMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: HighWaterMap = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.min(1, Math.max(0, v));
  }
  return out;
};

const mergeMax = (a: HighWaterMap, b: HighWaterMap): HighWaterMap => {
  const out: HighWaterMap = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};

const persist = (key: string, value: HighWaterMap): void => {
  try {
    Promise.resolve(encryptedPersistStorage.setItem(key, JSON.stringify(value))).catch(() => undefined);
  } catch {
    /* ignore */
  }
};

/** Test helper: forget the in-memory copy. */
export function resetChartHighWaterCache(): void {
  cache.clear();
  loadedPersistKeys.clear();
}

export function useChartHighWater(
  accountId?: string | null,
  courseId?: string | null
): { map: HighWaterMap; commit: (next: HighWaterMap) => void; loaded: boolean } {
  const storeAccount = useAuthStore((state) => state.user?.id ?? null);
  const acct = accountId ?? storeAccount;
  /** Key for the in-memory cache (guests included); null without a course. */
  const memKey = courseId ? (acct ? storageKey(acct, courseId) : guestKey(courseId)) : null;
  /** Key for persistence; null for guests. */
  const persistKey = acct && courseId ? storageKey(acct, courseId) : null;

  const [map, setMap] = useState<HighWaterMap>(() => (memKey ? cache.get(memKey) ?? EMPTY : EMPTY));
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const keyRef = useRef(memKey);
  const persistRef = useRef(persistKey);
  const mapRef = useRef(map);
  mapRef.current = map;

  if (keyRef.current !== memKey) {
    keyRef.current = memKey;
    persistRef.current = persistKey;
    const next = memKey ? cache.get(memKey) ?? EMPTY : EMPTY;
    mapRef.current = next;
    setMap(next);
  }

  useEffect(() => {
    if (!memKey || !persistKey) return undefined;
    let alive = true;
    (async () => {
      try {
        const raw = await encryptedPersistStorage.getItem(persistKey);
        const stored = raw ? sanitize(JSON.parse(raw)) : EMPTY;
        // Merge with anything committed while loading; never lower a mark.
        const current = cache.get(memKey) ?? EMPTY;
        const merged = mergeMax(stored, current);
        if (!sameMap(merged, current)) {
          cache.set(memKey, merged);
          if (keyRef.current === memKey) {
            mapRef.current = merged;
            if (alive) setMap(merged);
          }
        }
        // Persist the merged marks so a raw commit made during load cannot overwrite a higher stored mark.
        if (!sameMap(merged, stored)) persist(persistKey, merged);
      } catch {
        /* persisted marks are a nicety; ignore */
      } finally {
        loadedPersistKeys.add(persistKey);
        if (alive) setLoadedKey(persistKey);
      }
    })();
    return () => {
      alive = false;
    };
  }, [memKey, persistKey]);

  const commit = useCallback((next: HighWaterMap) => {
    const activeKey = keyRef.current;
    if (!activeKey) return;
    const merged = mergeMax(mapRef.current, next);
    if (sameMap(merged, mapRef.current)) return;
    cache.set(activeKey, merged);
    mapRef.current = merged;
    setMap(merged);
    const pKey = persistRef.current;
    if (pKey && loadedPersistKeys.has(pKey)) persist(pKey, merged);
  }, []);

  const loaded = !persistKey || loadedKey === persistKey;
  return { map, commit, loaded };
}
