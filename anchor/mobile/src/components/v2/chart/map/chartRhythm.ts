/**
 * Chart rhythm: day-closed, days-on-course, practiced-today, weekly counts and
 * the local-notification planner. Pure (no React, no stores, no timers).
 *
 * Copy rule: calm, never guilt. No streak / missed / broke / lost / behind /
 * failed / "don't" language anywhere in this file.
 */
import type { MoveSummary } from '@/types/chart';
import { localDateString } from '@/utils/primingAnalytics';
import {
  CHART_IDLE_AFTER_MS,
  CHART_MAX_PUSHES_PER_WEEK,
  CHART_PUSH_WINDOW,
  CHART_RECAP_SLOT,
  type ChartNotificationPlan,
  type ChartNotificationPlanInput,
} from './chartMapContracts';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_LEAD_MS = 15 * 60 * 1000;

const validDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/* ------------------------------------------------------------------ */
/* Day state                                                           */
/* ------------------------------------------------------------------ */

// Pure day helpers live in the adapters layer; re-exported so this module's API is unchanged.
export { isDayClosed, daysOnCourse } from '@/adapters/v2/chart/chartDayRhythm';

/** `todayPractice` is sessionStore's DayPractice (local YYYY-MM-DD). */
export function practicedToday(
  todayPractice: { date: string; sessionsCount: number } | null | undefined,
  now: Date
): boolean {
  return Boolean(todayPractice && todayPractice.date === localDateString(now) && todayPractice.sessionsCount > 0);
}

export type AdjustEvidence = 'ahead' | 'stalled' | null;

const STALLED_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

/**
 * Is there evidence the course may need adjusting? Drives "Still the right route?", which only ever opens
 * the one Adjust Route flow.
 * - ahead: the current waypoint's measure is already at or past its target (the route is behind reality).
 * - stalled: nothing completed or reached for three weeks.
 */
export function routeAdjustEvidence(
  view: { isFinished: boolean; current: { metric: { current: number | null; target: number } | null } | null; waypoints: Array<{ reachedAt: string | null; moves: MoveSummary[] }>; plottedAt: string },
  now: Date
): AdjustEvidence {
  if (view.isFinished || !view.current) return null;
  const metric = view.current.metric;
  if (metric && metric.current !== null && metric.current >= metric.target) return 'ahead';
  const times = [validDate(view.plottedAt)?.getTime() ?? 0];
  for (const waypoint of view.waypoints) {
    times.push(validDate(waypoint.reachedAt)?.getTime() ?? 0);
    const move = lastCompletedMoveAt(waypoint.moves);
    if (move) times.push(validDate(move)?.getTime() ?? 0);
  }
  const last = Math.max(...times);
  return last > 0 && now.getTime() - last >= STALLED_AFTER_MS ? 'stalled' : null;
}

/** ISO string of the most recent COMPLETED move, or null. */
export function lastCompletedMoveAt(moves: MoveSummary[]): string | null {
  let best: { time: number; iso: string } | null = null;
  for (const move of moves) {
    if (move.status !== 'COMPLETED') continue;
    const at = validDate(move.completedAt);
    if (at && (!best || at.getTime() > best.time)) best = { time: at.getTime(), iso: move.completedAt as string };
  }
  return best ? best.iso : null;
}

/**
 * COMPLETED moves in the rolling 7 days ending at `now` (inclusive). A rolling
 * window (not a calendar week) because the recap summarises "the 7 days before
 * the recap fires".
 */
export function movesInWeek(moves: MoveSummary[], now: Date): number {
  const end = now.getTime();
  const start = end - 7 * DAY_MS;
  return moves.filter((move) => {
    if (move.status !== 'COMPLETED') return false;
    const at = validDate(move.completedAt);
    return at !== null && at.getTime() > start && at.getTime() <= end;
  }).length;
}

/** Start (Monday 00:00 local) of the week containing `fire`. */
const recapWeekStart = (fire: Date): Date =>
  new Date(fire.getFullYear(), fire.getMonth(), fire.getDate() - ((fire.getDay() + 6) % 7));

/** Count ISO timestamps from Monday 00:00 (local) of the recap's week up to the recap fire date, inclusive. */
export function countInRecapWeek(isoDates: string[], recapFireDate: Date): number {
  const start = recapWeekStart(recapFireDate).getTime();
  const end = recapFireDate.getTime();
  return isoDates.filter((iso) => {
    const at = validDate(iso);
    return at !== null && at.getTime() >= start && at.getTime() <= end;
  }).length;
}

/** COMPLETED moves from Monday 00:00 (local) of the recap's week up to the recap fire date, inclusive. */
export function movesInRecapWeek(moves: MoveSummary[], recapFireDate: Date): number {
  return countInRecapWeek(
    moves.filter((m) => m.status === 'COMPLETED').map((m) => m.completedAt ?? ''),
    recapFireDate
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const stripEnd = (text: string) => text.trim().replace(/[.!?\s]+$/, '');

export const CHART_RHYTHM_COPY = {
  recapTitle: 'Your week on the Chart',
  recapBody: (args: { moves: number; practices: number; oneMove: string | null }): string => {
    const { moves, practices, oneMove } = args;
    const next = oneMove ? ` Next: ${stripEnd(oneMove)}.` : '';
    if (moves <= 0 && practices <= 0) {
      return oneMove ? `Your course is right where you left it.${next}` : 'Your Vision is waiting on the Chart.';
    }
    const parts: string[] = [];
    if (moves > 0) parts.push(`${plural(moves, 'move', 'moves')} this week`);
    if (practices > 0) {
      parts.push(moves > 0 ? `and ${plural(practices, 'practice', 'practices')}` : `${plural(practices, 'practice', 'practices')} this week`);
    }
    const head = parts.length === 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
    return `${head}.${next}`;
  },
  idleTitle: 'One small move',
  idleBody: (oneMove: string | null): string =>
    oneMove && stripEnd(oneMove) ? `${stripEnd(oneMove)}. Two minutes is enough.` : 'Your course is here when you are.',
} as const;

/** Panel copy, exactly per the build prompt section 13 table. Imported by the panel layer. */
export const CHART_PANEL_COPY = {
  labels: { current: 'CURRENT WAYPOINT', reached: 'REACHED', upcoming: 'UPCOMING', arrived: 'ARRIVED' },
  position: (n: number, total: number) => `${n} of ${total}`,
  oneMove: 'ONE MOVE',
  updateProgress: 'UPDATE PROGRESS',
  /** value is the delta; label uses U+2212 for the minus. */
  chips: [
    { value: -10, label: '−10' },
    { value: 10, label: '+10' },
    { value: 50, label: '+50' },
    { value: 100, label: '+100' },
  ] as ReadonlyArray<{ value: number; label: string }>,
  dayClosedTitle: "Today's move is done.",
  dayClosedSub: 'Next move tomorrow.',
  another: 'Do another move now',
  practiceOffer: 'Lock it in — a short practice reinforces what you just moved.',
  focus: 'Focus',
  deepFocus: 'Deep Focus',
  practicedToo: 'You practiced today too.',
  ctaMark: 'Mark waypoint reached',
  ctaMarkDestination: 'Mark destination reached',
  ctaConfirm: 'Confirm waypoint reached',
  confirmTitle: (title: string) => `Have you reached “${title}” in the real world?`,
  confirmBody: 'Progress only moves on your word. The route never guesses.',
  confirmYes: "Yes, I've reached it",
  confirmNo: 'Not yet',
  reachedTitle: "Look how far you've come.",
  reachedSub: 'Commit to the next leg.',
  committed: "I'm committed",
  arrivedTitle: "You've arrived.",
  viewVision: 'View Vision',
  release: 'Release',
  /** "Course log · 1 day on course" for n === 1, otherwise "Course log · {n} days on course". */
  log: (n: number) => `Course log · ${n} ${n === 1 ? 'day' : 'days'} on course`,
  destination: 'DESTINATION',
  movesAllDone: 'Every move on this waypoint is done.',
  back: 'Back to current waypoint',
} as const;

/* ------------------------------------------------------------------ */
/* Notification planner                                                */
/* ------------------------------------------------------------------ */

/** Local Monday 00:00 date string of the week containing `d` (weeks run Mon-Sun). */
const weekKey = (d: Date): string => {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return localDateString(start);
};

/** Next CHART_RECAP_SLOT strictly after `now` (local time). */
export function nextRecapSlot(now: Date): Date {
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CHART_RECAP_SLOT.hour, CHART_RECAP_SLOT.minute, 0, 0);
  slot.setDate(slot.getDate() + ((CHART_RECAP_SLOT.weekday - now.getDay() + 7) % 7));
  if (slot.getTime() <= now.getTime()) slot.setDate(slot.getDate() + 7);
  return slot;
}

/** Move a time into the local push window: before the window opens -> 9:00 same day; at/after close -> 9:00 next day. */
export function intoPushWindow(at: Date): Date {
  const hour = at.getHours();
  if (hour < CHART_PUSH_WINDOW.startHour) {
    return new Date(at.getFullYear(), at.getMonth(), at.getDate(), CHART_PUSH_WINDOW.startHour, 0, 0, 0);
  }
  if (hour >= CHART_PUSH_WINDOW.endHour) {
    return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, CHART_PUSH_WINDOW.startHour, 0, 0, 0);
  }
  return at;
}

/**
 * Plans at most one recap and one idle nudge for this anchor.
 * - Nothing without notificationsEnabled AND permissionGranted.
 * - Recap: next Sunday slot strictly after now; skipped when the Weekly Summary push is on.
 * - Idle: only when a completed move exists, only once per lastMoveAt, at
 *   lastMoveAt + 48h moved into the 9:00-20:00 window. If that moment already
 *   passed, the next window slot at least 15 minutes from now.
 * - Weekly cap (Mon-Sun, local): every entry in `alreadyScheduled` counts, so the
 *   caller must leave out this anchor's own pending pushes it is about to
 *   replace. Over the cap, the idle nudge is dropped first, then the recap.
 */
export function planChartNotifications(input: ChartNotificationPlanInput): ChartNotificationPlan[] {
  if (!input.notificationsEnabled || !input.permissionGranted) return [];
  const { anchorId, now } = input;
  const deepLink = `anchor://v2/chart/${anchorId}`;
  const plans: ChartNotificationPlan[] = [];

  if (!input.weeklySummaryEnabled) {
    plans.push({
      kind: 'recap',
      id: `chart-recap:${anchorId}`,
      fireDate: nextRecapSlot(now),
      title: CHART_RHYTHM_COPY.recapTitle,
      body: CHART_RHYTHM_COPY.recapBody({
        moves: input.movesThisWeek,
        practices: input.practicesThisWeek,
        oneMove: input.oneMoveTitle,
      }),
      deepLink,
    });
  }

  const last = validDate(input.lastMoveAt);
  if (last && input.idleNudgeScheduledFor !== input.lastMoveAt) {
    const due = new Date(last.getTime() + CHART_IDLE_AFTER_MS);
    const fireDate = due.getTime() > now.getTime() ? intoPushWindow(due) : intoPushWindow(new Date(now.getTime() + MIN_LEAD_MS));
    plans.push({
      kind: 'idle',
      id: `chart-idle:${anchorId}`,
      fireDate,
      title: CHART_RHYTHM_COPY.idleTitle,
      body: CHART_RHYTHM_COPY.idleBody(input.oneMoveTitle),
      deepLink,
    });
  }

  const existing = input.alreadyScheduled
    .map((entry) => validDate(entry.fireDate))
    .filter((d): d is Date => d !== null)
    .map(weekKey);
  const countFor = (week: string, chosen: ChartNotificationPlan[]) =>
    existing.filter((w) => w === week).length + chosen.filter((p) => weekKey(p.fireDate) === week).length;

  // Keep plans in priority order (recap first); drop idle first when over cap.
  const kept: ChartNotificationPlan[] = [];
  for (const plan of plans) {
    const week = weekKey(plan.fireDate);
    if (countFor(week, kept) + 1 <= CHART_MAX_PUSHES_PER_WEEK) kept.push(plan);
  }
  return kept;
}
