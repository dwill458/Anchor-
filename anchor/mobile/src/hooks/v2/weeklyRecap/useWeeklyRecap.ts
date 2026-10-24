import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';
import { useAuthStore } from '@/stores/authStore';
import { createRecapCache, loadRecap, type LoadRecapResult } from '@/adapters/v2/weeklyRecap/recapRepository';
import { fetchLatestRecap, fetchRecapForWeek, fetchRecapList, postRecapFeedback, type RecapListItem } from '@/adapters/v2/weeklyRecap/weeklyRecapApi';
import { buildRecapViewModel, type RecapViewModel } from '@/adapters/v2/weeklyRecap/recapViewModel';

export interface UseWeeklyRecapResult {
  loading: boolean;
  /** Server flag is off: the host should render the classic screen. */
  featureDisabled: boolean;
  error: string | null;
  /** Network was unreachable; a saved copy is shown. */
  offline: boolean;
  unavailable: { availableAt: string } | null;
  viewModel: RecapViewModel | null;
  feedback: WeeklyInsightFeedbackRating | null;
  feedbackError: string | null;
  submitFeedback: (rating: WeeklyInsightFeedbackRating) => void;
  history: RecapListItem[];
  loadHistory: () => Promise<void>;
  selectWeek: (weekKey: string | null) => void;
  refresh: () => Promise<void>;
}

export function useWeeklyRecap(): UseWeeklyRecapResult {
  const userId = useAuthStore((s) => (s as any).user?.id) ?? 'anon';
  const cache = useMemo(() => createRecapCache(AsyncStorage, String(userId)), [userId]);
  const [weekKey, setWeekKey] = useState<string | null>(null);
  const [result, setResult] = useState<LoadRecapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [feedback, setFeedback] = useState<WeeklyInsightFeedbackRating | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [history, setHistory] = useState<RecapListItem[]>([]);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await loadRecap({ cache, weekKey: weekKey ?? undefined, fetch: () => (weekKey ? fetchRecapForWeek(weekKey) : fetchLatestRecap()) });
      if (mine !== seq.current) return;
      setResult(r);
      setFeedback(r.view.available ? ((r.view.feedback as WeeklyInsightFeedbackRating | null) ?? null) : null);
    } catch (e: any) {
      if (mine !== seq.current) return;
      if (e?.code === 'FEATURE_DISABLED') setFeatureDisabled(true);
      else setError(e?.message ?? 'Weekly Insight is unavailable.');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [cache, weekKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  const view = result?.view ?? null;
  const viewModel = useMemo(() => (view && view.available ? buildRecapViewModel(view) : null), [view]);

  const submitFeedback = useCallback((rating: WeeklyInsightFeedbackRating) => {
    if (!viewModel?.feedbackEnabled) return;
    const previous = feedback;
    setFeedback(rating);
    setFeedbackError(null);
    postRecapFeedback(viewModel.weekKey, rating).catch(() => {
      setFeedback(previous);
      setFeedbackError('Feedback could not be saved.');
    });
  }, [feedback, viewModel]);

  const loadHistory = useCallback(async () => {
    try { setHistory(await fetchRecapList()); } catch { /* history is optional */ }
  }, []);

  return {
    loading,
    featureDisabled,
    error,
    offline: result?.stale ?? false,
    unavailable: view && !view.available ? { availableAt: view.availableAt } : null,
    viewModel,
    feedback,
    feedbackError,
    submitFeedback,
    history,
    loadHistory,
    selectWeek: setWeekKey,
    refresh,
  };
}
