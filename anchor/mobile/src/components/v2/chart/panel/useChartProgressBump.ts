import { useCallback, useEffect, useRef, useState } from 'react';

/** Rapid taps are summed and sent once, this long after the last tap. */
export const CHART_PROGRESS_DEBOUNCE_MS = 400;
/** If the server version never changes after a successful write, stop showing the optimistic number. */
const SETTLE_FALLBACK_MS = 1500;

type Args = {
  waypointId: string;
  /** Server value (metric.current, or the baseline while none is recorded). */
  currentValue: number;
  /** Changes whenever new server data arrives. */
  version: number;
  updateProgress: (waypointId: string, value: number | null) => Promise<boolean>;
};

/**
 * Coalesces the -10 / +10 / +50 / +100 chips into ONE updateProgress call:
 * taps add to a pending delta, the write fires 400 ms after the last tap with
 * max(0, current + delta). The optimistic number is for the value row text
 * ONLY: it never reaches the route, which waits for the new server data.
 */
export function useChartProgressBump({ waypointId, currentValue, version, updateProgress }: Args) {
  const [pending, setPending] = useState(0);
  const [sent, setSent] = useState(0);
  const pendingRef = useRef(0);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef(currentValue);
  currentRef.current = currentValue;
  const mounted = useRef(true);
  const flushRef = useRef<() => void>(() => undefined);

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    timer.current = null;
    settleTimer.current = null;
  };

  const flush = useCallback(async () => {
    timer.current = null;
    const delta = pendingRef.current;
    if (delta === 0 || inflight.current) return;
    inflight.current = true;
    pendingRef.current = 0;
    setPending(0);
    setSent(delta);
    const target = Math.max(0, currentRef.current + delta);
    let ok = false;
    try {
      ok = await updateProgress(waypointId, target);
    } catch {
      ok = false;
    }
    inflight.current = false;
    if (!mounted.current) return;
    if (!ok) {
      setSent(0);
    } else {
      // Wait for the new server version; fall back so a replay cannot pin the number.
      settleTimer.current = setTimeout(() => setSent(0), SETTLE_FALLBACK_MS);
    }
    if (pendingRef.current !== 0) timer.current = setTimeout(() => flushRef.current(), CHART_PROGRESS_DEBOUNCE_MS);
  }, [updateProgress, waypointId]);
  flushRef.current = () => void flush();

  const bump = useCallback((delta: number) => {
    pendingRef.current += delta;
    setPending(pendingRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), CHART_PROGRESS_DEBOUNCE_MS);
  }, []);

  // New server data supersedes the optimistic number.
  useEffect(() => {
    if (inflight.current) return;
    setSent(0);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  }, [version]);

  // A different waypoint starts clean.
  useEffect(() => {
    pendingRef.current = 0;
    setPending(0);
    setSent(0);
    return () => clearTimers();
  }, [waypointId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, []);

  const shown = Math.max(0, currentValue + sent + pending);
  return { bump, shownValue: shown, hasOptimistic: sent !== 0 || pending !== 0 };
}
