import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';
import { persistWeeklyInsightFeedback } from '@/adapters/v2/weeklyInsight/weeklyInsightApiAdapter';
import { fetchWeeklyRecap, fetchWeeklyRecapHistory, WeeklyRecapRequestError, type RecapErrorKind } from '@/adapters/v2/weeklyRecap/weeklyRecapApi';
import { readCachedRecap, writeCachedRecap } from '@/adapters/v2/weeklyRecap/weeklyRecapCache';
import type { WeeklyRecap, WeeklyRecapHistoryItem } from '@/adapters/v2/weeklyRecap/types';

export type WeeklyRecapState =
  | { status: 'loading'; recap: null }
  | { status: 'ready'; recap: WeeklyRecap; id: string; feedback: string | null; offline: boolean; refreshing: boolean }
  | { status: 'empty'; recap: null }
  | { status: 'disabled'; recap: null }
  | { status: 'error'; recap: null; kind: RecapErrorKind };

/**
 * The server is the only calculation engine; this hook fetches, caches and submits feedback.
 * A saved copy shows immediately while the network is consulted, and is kept (marked offline) if it cannot be reached.
 * Feedback is only possible against a FINAL recap.
 */
export function useWeeklyRecap(weekKey: 'latest' | string = 'latest') {
  const [state, setState] = useState<WeeklyRecapState>({ status: 'loading', recap: null });
  const [history, setHistory] = useState<WeeklyRecapHistoryItem[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(weekKey);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = useCallback(async (target: string, mode: 'initial' | 'refresh') => {
    const cached = await readCachedRecap(target);
    if (!live.current) return;
    if (cached) setState({ status: 'ready', recap: cached.recap, id: cached.id, feedback: cached.feedback, offline: false, refreshing: true });
    else if (mode === 'initial') setState({ status: 'loading', recap: null });
    try {
      const fresh = await fetchWeeklyRecap(target);
      if (!live.current) return;
      if (!fresh) { setState({ status: 'empty', recap: null }); return; }
      setState({ status: 'ready', recap: fresh.recap, id: fresh.id, feedback: fresh.feedback, offline: false, refreshing: false });
      void writeCachedRecap(fresh, target === 'latest');
    } catch (error) {
      if (!live.current) return;
      const kind = error instanceof WeeklyRecapRequestError ? error.kind : 'unknown';
      if (kind === 'disabled') { setState({ status: 'disabled', recap: null }); return; }
      if (cached) setState({ status: 'ready', recap: cached.recap, id: cached.id, feedback: cached.feedback, offline: true, refreshing: false });
      else setState({ status: 'error', recap: null, kind });
    }
  }, []);

  useEffect(() => { void load(selectedWeek, 'initial'); }, [load, selectedWeek]);

  const refresh = useCallback(() => load(selectedWeek, 'refresh'), [load, selectedWeek]);
  const loadHistory = useCallback(async () => {
    try { const page = await fetchWeeklyRecapHistory(); if (live.current) setHistory(page.items); } catch { /* history is optional */ }
  }, []);

  const submitFeedback = useCallback(async (rating: WeeklyInsightFeedbackRating) => {
    if (state.status !== 'ready' || state.recap.status !== 'FINAL') return false;
    const previous = state.feedback;
    setState({ ...state, feedback: rating });
    try { await persistWeeklyInsightFeedback(state.id, rating); return true; }
    catch { if (live.current) setState(s => (s.status === 'ready' ? { ...s, feedback: previous } : s)); return false; }
  }, [state]);

  return { state, history, selectedWeek, selectWeek: setSelectedWeek, refresh, loadHistory, submitFeedback };
}
