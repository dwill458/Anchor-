import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';

/**
 * Presentation-only "opened today" marker per Chart, so the first open of the
 * day plays the full arrival and later opens the short one. Never touches
 * server data and never throws. Persisted encrypted under
 * `anchor:v2:chart2:opened:{acct}:{courseId}` as the device-local date
 * `YYYY-MM-DD`; guests (no account) keep it in memory for the session.
 * Modeled on chartHighWater.
 */

const cache = new Map<string, string>();

const storageKey = (accountId: string, courseId: string) =>
  `anchor:v2:chart2:opened:${encodeURIComponent(accountId)}:${encodeURIComponent(courseId)}`;
const guestKey = (courseId: string) => `guest:opened:${encodeURIComponent(courseId)}`;

/** Dev lab only: shifts this marker's clock (e.g. +1 day to check a Chart's first open of the next day). */
let devClockOffsetMs = 0;
export function setChartOpenedClockOffsetForDev(ms: number): void {
  if (__DEV__) devClockOffsetMs = ms;
}
const deviceNow = () => new Date(Date.now() + devClockOffsetMs);

/** Device-local calendar day, `YYYY-MM-DD`. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const persist = (key: string, value: string): void => {
  try {
    Promise.resolve(encryptedPersistStorage.setItem(key, value)).catch(() => undefined);
  } catch {
    /* ignore */
  }
};

/** Test helper: forget the in-memory copy. */
export function resetChartLastOpenedCache(): void {
  cache.clear();
}

export type ChartOpenedToday = {
  /** The stored day has been read (always true for guests and once memory knows the course). */
  loaded: boolean;
  /** This Chart was already opened earlier today, as of the first read on this mount. */
  openedToday: boolean;
  /** Record today as opened. Idempotent; never changes `openedToday` for the current mount. */
  markOpened: () => void;
};

export function useChartOpenedToday(
  courseId?: string | null,
  options: { accountId?: string | null; now?: () => Date } = {}
): ChartOpenedToday {
  const storeAccount = useAuthStore((state) => state.user?.id ?? null);
  const acct = options.accountId !== undefined ? options.accountId : storeAccount;
  const nowRef = useRef(options.now ?? deviceNow);
  nowRef.current = options.now ?? deviceNow;
  const memKey = courseId ? (acct ? storageKey(acct, courseId) : guestKey(courseId)) : null;
  const persistKey = acct && courseId ? storageKey(acct, courseId) : null;

  const today = () => localDay(nowRef.current());
  const fromMemory = memKey ? cache.get(memKey) : undefined;
  // Snapshot at first read: marking today during this mount must not turn this open into a "later" one.
  const [state, setState] = useState<{ key: string | null; loaded: boolean; openedToday: boolean }>(() => ({
    key: memKey,
    loaded: !persistKey || fromMemory !== undefined,
    openedToday: fromMemory !== undefined && fromMemory === today(),
  }));

  useEffect(() => {
    if (!persistKey || !memKey) return undefined;
    if (state.key === memKey && state.loaded) return undefined;
    let alive = true;
    (async () => {
      let stored: string | null = null;
      try {
        const raw = await encryptedPersistStorage.getItem(persistKey);
        stored = isDay(raw) ? raw : null;
      } catch {
        stored = null;
      }
      // Memory was empty when this mount started, so anything in it now is this mount's own mark: it keeps
      // the newer value, but only the stored day decides whether this open is a later one.
      if (stored && !cache.has(memKey)) cache.set(memKey, stored);
      if (alive) setState({ key: memKey, loaded: true, openedToday: stored !== null && stored === localDay(nowRef.current()) });
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memKey, persistKey]);

  const markOpened = useCallback(() => {
    if (!memKey) return;
    const day = localDay(nowRef.current());
    if (cache.get(memKey) === day) return;
    cache.set(memKey, day);
    if (persistKey) persist(persistKey, day);
  }, [memKey, persistKey]);

  const current = state.key === memKey;
  return {
    loaded: current ? state.loaded : !persistKey,
    openedToday: current ? state.openedToday : false,
    markOpened,
  };
}
