/**
 * useWeeklyReview — offset-aware weekly review data hook.
 *
 * Similar to `useWeeklyStats` but supports paging backward in time.
 * weekOffset = 0  → current week (not yet a "review" but allowed)
 * weekOffset = 1  → last completed week (default for the review screen)
 * weekOffset = 50 → oldest allowed (MAX_WEEK_OFFSET)
 *
 * Thread Strength: the screen reads `threadStrength` from the session store
 * (current scalar).  For past weeks the spec requires `change = end − start`
 * from a persisted per-week history series; that series does not yet exist in
 * the store, so we approximate the delta from that week's session gains — this
 * is the same approach the existing WeeklySummaryModal uses and is explicitly
 * noted as a known limitation.  A TODO comment marks where a real series should
 * be wired.
 */

import { useMemo } from 'react';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { Anchor } from '@/types';
import { PRACTICE_THREAD_STRENGTH_GAINS, type PracticeMode } from '@/types/practice';
import {
  addDays,
  localDateString,
  parseLocalDateString,
  type PrimingHistoryEntry,
} from '@/utils/primingAnalytics';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_WEEK_OFFSET = 50;

// The Weave uses Mon-start weeks (ISO). The existing stats hook uses Sun-start
// (legacy).  The Weekly Review spec uses Mon-start.
const MON_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
type MonLabel = (typeof MON_LABELS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyReviewDayNode {
  date: string;
  label: MonLabel;
  sessionCount: number;
  durationSeconds: number;
  byMode: Record<PracticeMode, number>;
  byModeDuration: Record<PracticeMode, number>;
}

export interface WeeklyReviewAnchorRow {
  id: string;
  intention: string;
  baseSigilSvg: string;
  enhancedImageUrl?: string | null;
  returnCount: number;
  threadStrength: number;
  threadDelta: number; // approx; see file-level note
}

export type MomentumLabel =
  | { kind: 'strengthened'; change: number }
  | { kind: 'softened'; change: number }
  | { kind: 'held' };

export interface WeeklyReviewData {
  // Navigation
  weekOffset: number;
  maxOffset: typeof MAX_WEEK_OFFSET;
  canGoBack: boolean;
  canGoForward: boolean;

  // Week bounds (Mon–Sun, ISO)
  weekStart: string; // YYYY-MM-DD Monday
  weekEnd: string;   // YYYY-MM-DD Sunday
  weekLabel: string; // e.g. "Aug 4 – 10"

  // Screen state
  state: 'loading' | 'none' | 'first' | 'live';

  // Thread Strength (account-level)
  threadStrength: number;
  momentum: MomentumLabel;
  threadDelta: number; // approx weekly change

  // Summary stats
  returnCount: number;     // total sessions this week
  practiceDays: number;    // distinct days with ≥1 session
  minutesInPractice: number;
  anchorCount: number;     // distinct anchors touched

  // 7-day chart data (Mon–Sun)
  days: WeeklyReviewDayNode[];

  // Mode mix (0-1)
  modeMix: Record<PracticeMode, number>;

  // Anchor rows (max 5 shown, total available)
  anchorRows: WeeklyReviewAnchorRow[];
  totalAnchorCount: number;

  // Pattern insight line
  patternLine: string;

  // Reflection header line
  reflectionLine: string;

  // Is this the user's very first week?
  isFirstWeek: boolean;
  journeyWeekStart: string | null;

  // Recommended anchor for Carry It Forward
  recommendedAnchor: {
    id: string;
    intention: string;
    baseSigilSvg: string;
    enhancedImageUrl?: string | null;
    threadStrength: number;
    returnCount: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Return the Monday of the ISO week containing `date`. */
function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Sun, 1=Mon …
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

function emptyByMode(): Record<PracticeMode, number> {
  return { deep_prime: 0, visualize: 0, focus: 0, release: 0 };
}

function sessionTypeToMode(entry: PrimingHistoryEntry): PracticeMode {
  if (entry.type === 'reinforce') return 'deep_prime';
  if (entry.type === 'visualize') return 'visualize';
  return 'focus';
}

function buildAnchorLookup(anchors: Anchor[]): Map<string, Anchor> {
  const map = new Map<string, Anchor>();
  for (const a of anchors) {
    map.set(a.id, a);
    if (a.localId) map.set(a.localId, a);
  }
  return map;
}

function formatWeekLabel(start: Date, end: Date): string {
  const sMonth = start.toLocaleDateString(undefined, { month: 'short' });
  const eMonth = end.toLocaleDateString(undefined, { month: 'short' });
  const sDay = start.getDate();
  const eDay = end.getDate();
  if (sMonth === eMonth) return `${sMonth} ${sDay} – ${eDay}`;
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}

function buildPatternLine(
  days: WeeklyReviewDayNode[],
  mix: Record<PracticeMode, number>,
  returnCount: number,
): string {
  if (returnCount < 3) {
    return 'Keep returning. Patterns will become visible here as your Practice grows.';
  }

  const modeEntries = (Object.entries(mix) as [PracticeMode, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (modeEntries.length === 0) {
    return 'Keep returning. Patterns will become visible here as your Practice grows.';
  }

  const [topMode, topPct] = modeEntries[0];
  const modeLabels: Record<PracticeMode, string> = {
    deep_prime: 'Deep Prime',
    visualize: 'Visualize',
    focus: 'Focus',
    release: 'Release',
  };

  const topLabel = modeLabels[topMode];
  const pctStr = `${Math.round(topPct * 100)}%`;

  // Check for consistency (5+ days)
  const activeDays = days.filter((d) => d.sessionCount > 0).length;
  if (activeDays >= 5) {
    return `${topLabel} was your primary mode this week at ${pctStr}. Your consistency this week was exceptional — you showed up ${activeDays} out of 7 days.`;
  }

  if (modeEntries.length >= 2) {
    const [secondMode] = modeEntries[1];
    return `${topLabel} was your most-used mode this week at ${pctStr}, followed by ${modeLabels[secondMode]}. Returning across multiple modes deepens your Practice.`;
  }

  return `${topLabel} was your most-used mode this week at ${pctStr}.`;
}

function buildReflectionLine(returnCount: number, practiceDays: number): string {
  if (returnCount === 0) return '';
  if (returnCount === 1) return 'You returned once this week. Every return matters.';
  if (practiceDays === 7) return `You returned ${returnCount} times this week, showing up every single day. That kind of constancy builds something real.`;
  if (returnCount >= 7) return `You returned ${returnCount} times this week across ${practiceDays} days. A strong week of Practice.`;
  return `You returned ${returnCount} time${returnCount !== 1 ? 's' : ''} this week across ${practiceDays} day${practiceDays !== 1 ? 's' : ''}.`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeeklyReview(weekOffset: number): WeeklyReviewData {
  const anchors = useAnchorStore((s) => s.anchors);
  const primingHistory = useSessionStore((s) => s.primingHistory);
  const threadStrength = useSessionStore((s) => s.threadStrength);
  const journeyWeekStart = useSessionStore((s) => s.journeyWeekStart);

  return useMemo<WeeklyReviewData>(() => {
    const offset = clamp(Math.round(weekOffset), 0, MAX_WEEK_OFFSET);
    const now = new Date();

    // Compute the Mon-start week we're reviewing
    const thisMonday = mondayOf(now);
    const reviewMonday = addDays(thisMonday, -(offset * 7));
    const reviewSunday = addDays(reviewMonday, 6);

    const weekStart = localDateString(reviewMonday);
    const weekEnd = localDateString(reviewSunday);
    const weekLabel = formatWeekLabel(reviewMonday, reviewSunday);

    const canGoForward = offset > 0;
    const canGoBack = offset < MAX_WEEK_OFFSET;

    // ── Determine "first week" ───────────────────────────────────────────────
    const journeyStart = journeyWeekStart
      ? parseLocalDateString(journeyWeekStart)
      : primingHistory.length > 0
        ? parseLocalDateString(primingHistory[primingHistory.length - 1]?.localDate ?? '')
        : null;

    const journeyMondayStr = journeyStart
      ? localDateString(mondayOf(journeyStart))
      : weekStart;

    const isFirstWeek = weekStart <= journeyMondayStr;

    // ── Filter sessions for this week ────────────────────────────────────────
    const weekSessions = primingHistory.filter(
      (e) => e.localDate >= weekStart && e.localDate <= weekEnd,
    );

    const anchorLookup = buildAnchorLookup(anchors);
    const activeAnchors = anchors.filter((a) => !a.isReleased && !a.archivedAt);

    // ── Build 7-day nodes (Mon–Sun) ──────────────────────────────────────────
    const days: WeeklyReviewDayNode[] = MON_LABELS.map((label, i) => {
      const dayDate = addDays(reviewMonday, i);
      const dateKey = localDateString(dayDate);
      const daySessions = weekSessions.filter((e) => e.localDate === dateKey);
      const byMode = emptyByMode();
      const byModeDuration = emptyByMode();

      for (const s of daySessions) {
        const mode = sessionTypeToMode(s);
        byMode[mode] += 1;
        // TODO: surface completedDurationSeconds when PrimingHistoryEntry exposes it
      }

      return {
        date: dateKey,
        label,
        sessionCount: daySessions.length,
        durationSeconds: 0, // TODO: sum from session records when available on history entries
        byMode,
        byModeDuration,
      };
    });

    const returnCount = weekSessions.length;
    const practiceDays = new Set(weekSessions.map((e) => e.localDate)).size;

    // ── Total minutes — source from the sessionLog which has durationSeconds ─
    // The primingHistory entries don't carry duration; the sessionLog does but
    // is capped at 50 entries.  Use it for recent weeks; fall back to 0 for
    // older offsets until a proper history table is available.
    // TODO: surface duration on PrimingHistoryEntry in sessionStore
    const minutesInPractice = 0;

    // ── Mode mix ─────────────────────────────────────────────────────────────
    const rawMix = emptyByMode();
    for (const s of weekSessions) rawMix[sessionTypeToMode(s)] += 1;
    const modeMix: Record<PracticeMode, number> = emptyByMode();
    if (returnCount > 0) {
      for (const mode of Object.keys(rawMix) as PracticeMode[]) {
        modeMix[mode] = rawMix[mode] / returnCount;
      }
    }

    // ── Per-anchor rows ───────────────────────────────────────────────────────
    const sessionsByAnchor = new Map<string, PrimingHistoryEntry[]>();
    for (const s of weekSessions) {
      const anchor = anchorLookup.get(s.anchorId);
      const canonId = anchor?.id ?? s.anchorId;
      const existing = sessionsByAnchor.get(canonId) ?? [];
      existing.push(s);
      sessionsByAnchor.set(canonId, existing);
    }

    const gainPerSession = PRACTICE_THREAD_STRENGTH_GAINS.deep_prime; // max gain; approx
    const allAnchorRows: WeeklyReviewAnchorRow[] = [...sessionsByAnchor.entries()]
      .map(([anchorId, sessions]) => {
        const anchor = anchorLookup.get(anchorId);
        const storedStrength =
          typeof anchor?.threadStrength === 'number' && Number.isFinite(anchor.threadStrength)
            ? clamp(Math.round(anchor.threadStrength), 0, 100)
            : 50;
        // Approx delta: sessions * average gain, clamped. Not from a history series.
        const approxDelta = clamp(
          sessions.reduce(
            (acc, s) => acc + (PRACTICE_THREAD_STRENGTH_GAINS[sessionTypeToMode(s)] ?? gainPerSession),
            0,
          ),
          0,
          100,
        );
        return {
          id: anchorId,
          intention: anchor?.intentionText ?? '',
          baseSigilSvg: anchor?.baseSigilSvg ?? '',
          enhancedImageUrl: anchor?.enhancedImageUrl ?? null,
          returnCount: sessions.length,
          threadStrength: storedStrength,
          threadDelta: approxDelta,
        };
      })
      .filter((r) => r.intention !== '')
      .sort((a, b) => b.returnCount - a.returnCount || b.threadStrength - a.threadStrength);

    const anchorRows = allAnchorRows.slice(0, 5);
    const anchorCount = sessionsByAnchor.size;

    // ── Thread Strength snapshot ──────────────────────────────────────────────
    // TODO: replace with persisted per-week series when available server-side.
    // For now, display the current account-level scalar for the current week,
    // and an approximate delta for all weeks.
    const displayThreadStrength = clamp(Math.round(threadStrength), 0, 100);
    const weekThreadDelta = weekSessions.reduce(
      (acc, s) => acc + (PRACTICE_THREAD_STRENGTH_GAINS[sessionTypeToMode(s)] ?? 0),
      0,
    );
    const momentum: MomentumLabel =
      weekThreadDelta > 0
        ? { kind: 'strengthened', change: Math.round(weekThreadDelta) }
        : weekThreadDelta < 0
          ? { kind: 'softened', change: Math.round(Math.abs(weekThreadDelta)) }
          : { kind: 'held' };

    // ── Recommended anchor (Carry It Forward) ─────────────────────────────────
    // Priority: most-returned-this-week anchor, else most-returned ever, else first active
    let recommendedAnchor: WeeklyReviewData['recommendedAnchor'] = null;
    if (allAnchorRows.length > 0) {
      const top = allAnchorRows[0];
      recommendedAnchor = {
        id: top.id,
        intention: top.intention,
        baseSigilSvg: top.baseSigilSvg,
        enhancedImageUrl: top.enhancedImageUrl,
        threadStrength: top.threadStrength,
        returnCount: top.returnCount,
      };
    } else if (activeAnchors.length > 0) {
      const a = activeAnchors[0];
      const storedStrength =
        typeof a.threadStrength === 'number' && Number.isFinite(a.threadStrength)
          ? clamp(Math.round(a.threadStrength), 0, 100)
          : 50;
      recommendedAnchor = {
        id: a.id,
        intention: a.intentionText,
        baseSigilSvg: a.baseSigilSvg,
        enhancedImageUrl: a.enhancedImageUrl ?? null,
        threadStrength: storedStrength,
        returnCount: 0,
      };
    }

    // ── Screen state ──────────────────────────────────────────────────────────
    const state: WeeklyReviewData['state'] =
      returnCount === 0
        ? 'none'
        : isFirstWeek
          ? 'first'
          : 'live';

    return {
      weekOffset: offset,
      maxOffset: MAX_WEEK_OFFSET,
      canGoBack,
      canGoForward,
      weekStart,
      weekEnd,
      weekLabel,
      state,
      threadStrength: displayThreadStrength,
      momentum,
      threadDelta: weekThreadDelta,
      returnCount,
      practiceDays,
      minutesInPractice,
      anchorCount,
      days,
      modeMix,
      anchorRows,
      totalAnchorCount: anchorCount,
      patternLine: buildPatternLine(days, modeMix, returnCount),
      reflectionLine: buildReflectionLine(returnCount, practiceDays),
      isFirstWeek,
      journeyWeekStart: journeyMondayStr,
      recommendedAnchor,
    };
  }, [anchors, primingHistory, threadStrength, journeyWeekStart, weekOffset]);
}
