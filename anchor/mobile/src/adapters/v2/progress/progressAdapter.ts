import type { Anchor } from '@/types';
import type { CourseDetail, CourseLogEntry, ReflectionMood } from '@/types/chart';
import type { SessionLogEntry } from '@/stores/sessionStore';
import type { PracticeSessionRecord } from '@/types/practice';

export type AnyProgressSession = SessionLogEntry | PracticeSessionRecord;
// Imported from the module, not the Home barrel: the barrel now reaches back
// into this file, and going through it would create an import cycle.
import { threadQualitativeLabel } from '@/adapters/v2/home/threadAdapter';
import { toChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { calculateStreakWithGrace } from '@/utils/streak';
import { buildProgressInsight } from './progressInsight';
import { buildLifetimeStats, buildRecentReflection } from './journeyAdapter';
import {
  addDays,
  getIsoWeekdayIndex,
  isoWeekKey,
  localDateString,
  startOfIsoWeek,
} from '@/utils/primingAnalytics';
import type {
  CanonicalThreadEventType,
  ProgressCelebrationDates,
  ThreadEventSignificance,
  V2PracticeModeBreakdown,
  V2ProgressDayCell,
  V2ProgressExtras,
  V2ProgressModel,
  V2ProgressRange,
  V2ProgressReflection,
  V2ProgressRhythm,
  V2ProgressRhythmStats,
  V2ProgressRouteSummary,
  V2ProgressSparkPoint,
  V2ProgressStreak,
  V2ProgressWeek,
  V2ThreadEventItem,
} from './types';

export function resolveEvolutionStage(
  threadStrength: number | null,
): 'Unestablished' | 'Forming' | 'Building' | 'Established' | 'Integrated' | 'Reinforced' {
  if (threadStrength === null) return 'Unestablished';
  if (threadStrength >= 90) return 'Reinforced';
  if (threadStrength >= 75) return 'Integrated';
  if (threadStrength >= 50) return 'Established';
  if (threadStrength >= 25) return 'Building';
  return 'Forming';
}

function toIsoString(val: Date | string | undefined | null): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function formatDate(val: Date | string | undefined | null): string {
  if (!val) return 'Recent';
  try {
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

function formatTime(val: Date | string | undefined | null): string {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** The Progress screen's date format ("Oct 4"), or null when the value is not a real date. */
export function formatProgressDate(value: string | null | undefined): string | null {
  const iso = recordedDate(value);
  return iso ? formatDate(iso) : null;
}

/** A recorded date as ISO, or null when it is missing or not a real date. Never a stand-in. */
function recordedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** The celebration record key for a derived stage name. */
function recordKeyForStage(
  stage: ReturnType<typeof resolveEvolutionStage>,
): 'building' | 'established' | 'integrated' | 'reinforced' | null {
  switch (stage) {
    case 'Building':
      return 'building';
    case 'Established':
      return 'established';
    case 'Integrated':
      return 'integrated';
    case 'Reinforced':
      return 'reinforced';
    default:
      return null;
  }
}

/** Newest first. Events with no known date sort after every dated one. */
function compareNewestFirst(a: V2ThreadEventItem, b: V2ThreadEventItem): number {
  const aTime = Date.parse(a.occurredAt);
  const bTime = Date.parse(b.occurredAt);
  const aDated = !Number.isNaN(aTime);
  const bDated = !Number.isNaN(bTime);
  if (aDated && bDated) return bTime - aTime;
  if (aDated !== bDated) return aDated ? -1 : 1;
  return 0;
}

type SessionModeKey = 'focus' | 'deepPrime' | 'visualize' | 'release';

/** One mode per session, by the same rules the breakdown below counts with. */
function sessionModeKey(s: AnyProgressSession): SessionModeKey {
  const rawMode =
    'practiceMode' in s && s.practiceMode
      ? s.practiceMode
      : 'type' in s && s.type
        ? s.type
        : (s as any).mode || 'focus';
  if (rawMode === 'deep_prime' || rawMode === 'reinforce' || (s as any).mode === 'ambient') return 'deepPrime';
  if (rawMode === 'visualize') return 'visualize';
  if (rawMode === 'release' || rawMode === 'burn') return 'release';
  return 'focus';
}

const MODE_COPY: Record<SessionModeKey, string> = {
  focus: 'Focus',
  deepPrime: 'Deep Focus',
  visualize: 'Visualize',
  release: 'Release',
};

/** "10 minute Focus session", "45 second Release session". */
function describePractice(s: AnyProgressSession): string {
  const seconds = Math.max(0, Math.round(sessionSeconds(s)));
  const mode = MODE_COPY[sessionModeKey(s)];
  if (seconds <= 0) return `${mode} session`;
  if (seconds < 60) return `${seconds} second ${mode} session`;
  return `${Math.round(seconds / 60)} minute ${mode} session`;
}

/**
 * Aggregates practice sessions for a specific Anchor into a mode breakdown.
 */
export function aggregatePracticeSessions(
  sessions: AnyProgressSession[],
  anchorId: string,
): V2PracticeModeBreakdown {
  const matching = sessions.filter((s) => {
    const aid = s.anchorId || (s as any).anchorLocalId || (s as any).anchor_id;
    return aid === anchorId;
  });

  let focusCount = 0;
  let focusSeconds = 0;
  let deepPrimeCount = 0;
  let deepPrimeSeconds = 0;
  let visualizeCount = 0;
  let visualizeSeconds = 0;
  let releaseCount = 0;
  let releaseSeconds = 0;

  for (const s of matching) {
    const duration =
      'completedDurationSeconds' in s && typeof s.completedDurationSeconds === 'number'
        ? s.completedDurationSeconds
        : 'durationSeconds' in s && typeof s.durationSeconds === 'number'
          ? s.durationSeconds
          : 0;
    const mode = sessionModeKey(s);
    if (mode === 'deepPrime') {
      deepPrimeCount++;
      deepPrimeSeconds += duration;
    } else if (mode === 'visualize') {
      visualizeCount++;
      visualizeSeconds += duration;
    } else if (mode === 'release') {
      releaseCount++;
      releaseSeconds += duration;
    } else {
      focusCount++;
      focusSeconds += duration;
    }
  }

  const totalSessions = matching.length;
  const totalDurationSeconds =
    focusSeconds + deepPrimeSeconds + visualizeSeconds + releaseSeconds;

  return {
    focusCount,
    focusSeconds,
    deepPrimeCount,
    deepPrimeSeconds,
    visualizeCount,
    visualizeSeconds,
    releaseCount,
    releaseSeconds,
    totalSessions,
    totalDurationSeconds,
  };
}

/**
 * Derives durable, evidence-first Thread Events strictly from persisted domain facts.
 * NEVER calculates fake Thread delta; if the authoritative server delta is absent,
 * authoritativeDelta remains null.
 */
export function deriveThreadEvents(
  anchor: Anchor,
  courseLogs: CourseLogEntry[],
  practiceSessions: AnyProgressSession[],
  /** The device's own dates for this Anchor's stages and Full Strength. Omitted means none are known. */
  celebrations?: ProgressCelebrationDates | null,
): V2ThreadEventItem[] {
  const events: V2ThreadEventItem[] = [];
  const intentionText = (anchor as any).intention || anchor.intentionText || 'Your Anchor';

  // 1. Anchor Created Event (Baseline lifecycle fact)
  if (anchor.createdAt) {
    const createdIso = toIsoString(anchor.createdAt);
    events.push({
      id: `evt-created-${anchor.id}`,
      type: 'ANCHOR_CREATED',
      title: 'Anchor created',
      copy: intentionText,
      why: 'Where your journey began.',
      significance: 'MEDIUM',
      occurredAt: createdIso,
      formattedDate: formatDate(anchor.createdAt),
      formattedTime: formatTime(anchor.createdAt),
      authoritativeDelta: null, // Initial creation has no delta
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  // 2. Evolution Stage Reached (if threshold crossed)
  const strength = typeof anchor.threadStrength === 'number' ? anchor.threadStrength : 0;
  const stage = resolveEvolutionStage(strength);
  if (stage !== 'Forming') {
    // Dated only by the real date this device recorded for the stage. With no record the event
    // carries no date at all: anchor.updatedAt is the last sync, not the day the stage was reached.
    const stageKey = recordKeyForStage(stage);
    const stageAt = stageKey ? recordedDate(celebrations?.stages?.[stageKey]) : null;
    events.push({
      id: `evt-stage-${anchor.id}-${stage}`,
      type: 'EVOLUTION_STAGE_REACHED',
      title: `${stage} reached`,
      copy: `Your Anchor reached the ${stage} stage. Stages follow your current Thread Strength.`,
      why: 'Meaningful reinforcement held across time.',
      significance: 'HIGH',
      occurredAt: stageAt ?? '',
      formattedDate: stageAt ? formatDate(stageAt) : '',
      formattedTime: stageAt ? formatTime(stageAt) : undefined,
      authoritativeDelta: null, // Client must not infer or invent delta numbers
      authoritativeThreadRange: null,
      stageName: stage,
      sourceDomain: 'THREAD_ENGINE',
      rawDomainEventId: anchor.id,
    });
  }

  // 2b. Full Strength: a fact about the past, present only when this device recorded the date.
  const fullStrengthAt = recordedDate(celebrations?.fullStrengthAt);
  if (fullStrengthAt) {
    events.push({
      id: `evt-full-strength-${anchor.id}`,
      type: 'FULL_STRENGTH_REACHED',
      title: 'Full Strength reached',
      copy: '',
      why: '',
      significance: 'MAJOR',
      occurredAt: fullStrengthAt,
      formattedDate: formatDate(fullStrengthAt),
      formattedTime: formatTime(fullStrengthAt),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'THREAD_ENGINE',
      rawDomainEventId: anchor.id,
    });
  }

  // 3. Practice Milestones
  const anchorSessions = practiceSessions.filter((s) => {
    const aid = s.anchorId || (s as any).anchorLocalId || (s as any).anchor_id;
    return aid === anchor.id || (anchor.localId && aid === anchor.localId);
  });
  const totalCount = anchorSessions.length;
  const milestones = [10, 25, 50].filter((m) => totalCount >= m);

  for (const m of milestones) {
    const sessionDate = anchorSessions[m - 1]?.completedAt || new Date().toISOString();
    events.push({
      id: `evt-milestone-${anchor.id}-${m}`,
      type: 'PRACTICE_MILESTONE_REACHED',
      title: `${m}th Practice complete`,
      copy: `${m} completed sessions dedicated to this Anchor.`,
      why: 'Verifiable practice constancy.',
      significance: m >= 25 ? 'HIGH' : 'MEDIUM',
      occurredAt: toIsoString(sessionDate),
      formattedDate: formatDate(sessionDate),
      formattedTime: formatTime(sessionDate),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      milestoneCount: m,
      sourceDomain: 'PRACTICE',
      rawDomainEventId: anchorSessions[m - 1]?.id,
    });
  }

  // 3b. Each completed practice, in the order it happened.
  for (const s of anchorSessions) {
    const completedAt = s.completedAt || (s as any).createdAt;
    if (!completedAt || Number.isNaN(new Date(completedAt).getTime())) continue;
    events.push({
      id: `evt-practice-${s.id}`,
      type: 'PRACTICE_COMPLETED',
      title: 'Practice completed',
      copy: describePractice(s),
      why: 'A session you completed for this Anchor.',
      significance: 'LOW',
      occurredAt: toIsoString(completedAt),
      formattedDate: formatDate(completedAt),
      formattedTime: formatTime(completedAt),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      practiceMode: sessionModeKey(s),
      sourceDomain: 'PRACTICE',
      rawDomainEventId: s.id,
    });
  }

  // 4. Course / Waypoint Events from canonical CourseLog
  for (const log of courseLogs) {
    if (log.eventType === 'WAYPOINT_REACHED') {
      const wpTitle = (log.snapshot?.waypointTitle as string) || log.message || 'Waypoint reached';
      events.push({
        id: `evt-wp-${log.id}`,
        type: 'WAYPOINT_REACHED',
        title: wpTitle,
        copy: 'Milestone reached on your route.',
        why: 'Real-world milestone confirmed.',
        significance: 'HIGH',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        waypointTitle: wpTitle,
        waypointId: log.waypointId,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    } else if (log.eventType === 'MOVE_COMPLETED') {
      const moveTitle = typeof log.snapshot?.moveTitle === 'string' ? log.snapshot.moveTitle.trim() : '';
      const reflection = log.reflection?.body?.trim() ?? '';
      events.push({
        id: `evt-move-${log.id}`,
        type: 'ONE_MOVE_COMPLETED',
        title: 'Move completed',
        note: reflection || moveTitle || null,
        waypointId: log.waypointId,
        copy: 'A real-world move toward your destination.',
        why: 'Completed on your Chart.',
        significance: 'LOW',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    } else if (log.eventType === 'COURSE_CREATED') {
      events.push({
        id: `evt-chart-${log.id}`,
        type: 'CHART_CREATED',
        title: 'Chart created',
        copy: 'This Anchor was given somewhere to go.',
        why: 'A route from here to your destination.',
        significance: 'MEDIUM',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    } else if (log.eventType === 'ROUTE_ADJUSTED') {
      events.push({
        id: `evt-route-${log.id}`,
        type: 'ROUTE_ADJUSTED',
        title: 'Route adjusted',
        copy: 'The way ahead was updated as the path became clearer.',
        why: 'Reached waypoints stay as they were.',
        significance: 'LOW',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    } else if (log.eventType === 'COURSE_COMPLETED') {
      events.push({
        id: `evt-dest-${log.id}`,
        type: 'DESTINATION_REACHED',
        title: 'Destination reached',
        copy: log.message || 'You reached your destination.',
        why: 'All waypoints on your course completed.',
        significance: 'MAJOR',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    }
  }

  // 5. Intention Completed / Released lifecycle moments
  if ((anchor as any).intentionCompletedAt) {
    const completedAt = (anchor as any).intentionCompletedAt as string;
    events.push({
      id: `evt-completed-${anchor.id}`,
      type: 'ANCHOR_COMPLETED',
      title: 'Intention completed',
      copy: 'You confirmed this intention was realized in the real world.',
      why: 'Authoritative completion milestone.',
      significance: 'MAJOR',
      occurredAt: toIsoString(completedAt),
      formattedDate: formatDate(completedAt),
      formattedTime: formatTime(completedAt),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  const isArchived = Boolean(anchor.archivedAt || (anchor as any).isArchived);
  if (isArchived) {
    const releasedDate = anchor.archivedAt || anchor.updatedAt;
    const releasedIso = toIsoString(releasedDate);
    events.push({
      id: `evt-released-${anchor.id}`,
      type: 'ANCHOR_RELEASED',
      title: 'Anchor released',
      copy: 'You released your Anchor into the archive.',
      why: 'Non-destructive lifecycle transition.',
      significance: 'MAJOR',
      occurredAt: releasedIso,
      formattedDate: formatDate(releasedDate),
      formattedTime: formatTime(releasedDate),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  // Sort descending by occurredAt; undated events fall to the end.
  return events.sort(compareNewestFirst);
}

// ─── Evidence builders (Progress 2.0) ────────────────────────────────────────
// Pure functions. Every number is read from a persisted field; nothing here
// computes a Thread delta or invents a score.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const RANGE_WEEKS: Record<V2ProgressRange, number> = { Week: 1, Month: 5, Year: 26 };

function sessionAnchorKey(s: AnyProgressSession): string | undefined {
  return s.anchorId || (s as any).anchorLocalId || (s as any).anchor_id || undefined;
}

function matchesAnchor(s: AnyProgressSession, anchorIds: string | readonly string[]): boolean {
  const key = sessionAnchorKey(s);
  if (!key) return false;
  return typeof anchorIds === 'string' ? key === anchorIds : anchorIds.includes(key);
}

/** The user's local day for a session. Prefers the persisted key so a late-night session is never re-bucketed by UTC. */
function sessionDateKey(s: AnyProgressSession): string | null {
  const stored = 'localDateKey' in s ? s.localDateKey : undefined;
  if (typeof stored === 'string' && DATE_KEY.test(stored)) return stored;
  const completed = new Date(s.completedAt);
  return Number.isNaN(completed.getTime()) ? null : localDateString(completed);
}

/** Completed duration, never planned. */
function sessionSeconds(s: AnyProgressSession): number {
  if ('completedDurationSeconds' in s && typeof s.completedDurationSeconds === 'number') {
    return s.completedDurationSeconds;
  }
  if ('durationSeconds' in s && typeof s.durationSeconds === 'number') return s.durationSeconds;
  return 0;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.round(Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 86_400_000);
}

function rangeWindow(range: V2ProgressRange, now: Date): { start: Date; length: number } {
  const weeks = RANGE_WEEKS[range];
  return { start: addDays(startOfIsoWeek(now), -(weeks - 1) * 7), length: weeks * 7 };
}

/** Mon–Sun marks for the current ISO week, straight from `weekHistory`. A stale week reads as empty. */
export function buildWeek(
  weekHistory: boolean[] | null | undefined,
  now: Date = new Date(),
  weekHistoryKey?: string | null,
): V2ProgressWeek {
  const stale = typeof weekHistoryKey === 'string' && weekHistoryKey !== isoWeekKey(now);
  const days = Array.from({ length: 7 }, (_, i) => !stale && weekHistory?.[i] === true);
  return { days, todayIndex: getIsoWeekdayIndex(now) };
}

/** This Anchor's own Mon–Sun marks, read from the same day cells the Week heatmap draws. */
export function buildAnchorWeek(weekCells: V2ProgressDayCell[], now: Date = new Date()): V2ProgressWeek {
  const days = Array.from({ length: 7 }, (_, i) => (weekCells[i]?.sessionCount ?? 0) > 0);
  return { days, todayIndex: getIsoWeekdayIndex(now) };
}

/** Days in a row, with the one-per-week grace day, via the shared streak utility. */
export function buildStreak(
  sessions: Array<{ completedAt?: string; createdAt?: string }>,
  lastGraceDayUsedAt: string | null | undefined,
  now: Date = new Date(),
): V2ProgressStreak {
  const result = calculateStreakWithGrace(sessions, lastGraceDayUsedAt ?? null, now);
  return {
    current: result.currentStreak,
    best: result.longestStreak,
    isProtected: result.isStreakProtected,
    graceAvailable: result.canUseGraceDay,
  };
}

/** One cell per local day, Monday-first, ending with the current week. Keyed on `localDateKey`. */
export function buildHeatmap(
  sessions: AnyProgressSession[],
  anchorIds: string | readonly string[],
  range: V2ProgressRange,
  now: Date = new Date(),
): V2ProgressDayCell[] {
  const { start, length } = rangeWindow(range, now);
  const todayKey = localDateString(now);
  const byDay = new Map<string, { count: number; seconds: number }>();
  for (const s of sessions) {
    if (!matchesAnchor(s, anchorIds)) continue;
    const key = sessionDateKey(s);
    if (!key) continue;
    const bucket = byDay.get(key) ?? { count: 0, seconds: 0 };
    bucket.count += 1;
    bucket.seconds += sessionSeconds(s);
    byDay.set(key, bucket);
  }
  return Array.from({ length }, (_, i) => {
    const dateKey = localDateString(addDays(start, i));
    const isFuture = dateKey > todayKey;
    const bucket = isFuture ? undefined : byDay.get(dateKey);
    const sessionCount = bucket?.count ?? 0;
    return {
      dateKey,
      level: Math.min(3, sessionCount) as 0 | 1 | 2 | 3,
      sessionCount,
      minutes: Math.round((bucket?.seconds ?? 0) / 60),
      isToday: dateKey === todayKey,
      isFuture,
    };
  });
}

function longestRun(dateKeys: string[]): number {
  const days = Array.from(new Set(dateKeys.map(dayNumber))).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of days) {
    run = day - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Practices, minutes, active days and best run for each range, over the same windows the heatmap draws. */
export function buildRhythm(
  sessions: AnyProgressSession[],
  anchorIds: string | readonly string[],
  now: Date = new Date(),
  moveDateKeys: readonly string[] = [],
): V2ProgressRhythm {
  const todayKey = localDateString(now);
  const mine = sessions.filter((s) => matchesAnchor(s, anchorIds));
  const stats = (range: V2ProgressRange): V2ProgressRhythmStats => {
    const { start } = rangeWindow(range, now);
    const startKey = localDateString(start);
    let practices = 0;
    let seconds = 0;
    const keys: string[] = [];
    for (const s of mine) {
      const key = sessionDateKey(s);
      if (!key || key < startKey || key > todayKey) continue;
      practices += 1;
      seconds += sessionSeconds(s);
      keys.push(key);
    }
    return {
      practices,
      minutes: Math.round(seconds / 60),
      moves: moveDateKeys.filter((key) => key >= startKey && key <= todayKey).length,
      activeDays: new Set(keys).size,
      bestRun: longestRun(keys),
    };
  };
  return { Week: stats('Week'), Month: stats('Month'), Year: stats('Year') };
}

/**
 * Consistency over the last `days` days from the persisted `threadStrengthAfter`
 * of each practice (the last one of each local day). Records without it are
 * skipped, never estimated.
 */
export function buildSpark(
  sessions: AnyProgressSession[],
  anchorIds: string | readonly string[],
  days = 30,
  now: Date = new Date(),
): V2ProgressSparkPoint[] {
  const todayKey = localDateString(now);
  const startKey = localDateString(addDays(now, -(days - 1)));
  const dated: Array<{ dateKey: string; at: number; id: string; value: number }> = [];
  for (const s of sessions) {
    if (!matchesAnchor(s, anchorIds) || !('threadStrengthAfter' in s)) continue;
    const value = s.threadStrengthAfter;
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const dateKey = sessionDateKey(s);
    if (!dateKey || dateKey < startKey || dateKey > todayKey) continue;
    dated.push({ dateKey, at: new Date(s.completedAt).getTime() || 0, id: s.id, value });
  }
  dated.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const lastOfDay = new Map<string, number>();
  for (const entry of dated) lastOfDay.set(entry.dateKey, entry.value);
  return Array.from(lastOfDay, ([dateKey, value]) => ({ dateKey, value })).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
}

/** The live Chart as a compact route strip. Null when there is no route to show. */
export function buildRouteSummary(course: CourseDetail | null | undefined): V2ProgressRouteSummary | null {
  if (!course || (course.status !== 'ACTIVE' && course.status !== 'COMPLETED')) return null;
  const view = toChartViewModel(course);
  if (view.total === 0) return null;
  const toMetric = (metric: (typeof view.waypoints)[number]['metric']) =>
    metric ? { display: metric.display, percentLabel: metric.percentLabel, fraction: metric.fraction } : null;
  return {
    currentIndex: view.isFinished ? view.total : view.currentIndex,
    total: view.total,
    currentTitle: view.isFinished ? view.destination : (view.current?.title ?? view.destination),
    currentMetric: view.isFinished ? null : toMetric(view.current?.metric ?? null),
    oneMoveTitle: view.oneMove?.title ?? null,
    reachedCount: view.reachedCount,
    isFinished: view.isFinished,
    waypoints: view.waypoints.map((w) => ({
      id: w.id,
      number: w.number,
      title: w.title,
      metric: toMetric(w.metric),
      state: w.state,
      isDestination: w.isDestination,
    })),
  };
}

const MOOD_WORDS: Record<ReflectionMood, string> = {
  CALM: 'Calm',
  FOCUSED: 'Focused',
  ENERGIZED: 'Energized',
  UNCHANGED: 'Unchanged',
  DISTRACTED: 'Distracted',
};

export type V2ProgressReflectionSource = 'course_log' | 'session_log' | 'none';

/**
 * One-word reflections from real records only. Chart reflections (their
 * `moodAfter`) win when the flag is on and any exist; otherwise the legacy
 * `reflectionWord` saved with a session. Nothing is ever invented.
 */
export function buildProgressReflections(input: {
  courseLogs: CourseLogEntry[];
  sessionLog: SessionLogEntry[];
  anchorIds: string | readonly string[];
  chartReflectionsEnabled: boolean;
  limit?: number;
}): { source: V2ProgressReflectionSource; items: V2ProgressReflection[] } {
  const limit = input.limit ?? 8;
  const newestFirst = (a: V2ProgressReflection, b: V2ProgressReflection) =>
    new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();

  if (input.chartReflectionsEnabled) {
    const fromChart = input.courseLogs
      .filter((entry) => entry.reflection?.moodAfter)
      .map((entry) => ({
        id: `reflection-${entry.reflection!.id}`,
        word: MOOD_WORDS[entry.reflection!.moodAfter as ReflectionMood] ?? '',
        occurredAt: entry.occurredAt,
      }))
      .filter((item) => item.word !== '')
      .sort(newestFirst)
      .slice(0, limit);
    if (fromChart.length > 0) return { source: 'course_log', items: fromChart };
  }

  const fromSessions = input.sessionLog
    .filter((entry) => matchesAnchor(entry, input.anchorIds) && entry.reflectionWord?.trim())
    .map((entry) => ({
      id: `reflection-${entry.id}`,
      word: entry.reflectionWord!.trim(),
      occurredAt: entry.completedAt,
    }))
    .sort(newestFirst)
    .slice(0, limit);
  return fromSessions.length > 0 ? { source: 'session_log', items: fromSessions } : { source: 'none', items: [] };
}

/** "today", "yesterday", "3 days ago", "2 weeks ago" for a local date key or ISO timestamp. */
export function formatRelativeDay(value: string | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null;
  let key: string | null;
  if (DATE_KEY.test(value)) {
    key = value;
  } else {
    const parsed = new Date(value);
    key = Number.isNaN(parsed.getTime()) ? null : localDateString(parsed);
  }
  if (!key) return null;
  const diff = dayNumber(localDateString(now)) - dayNumber(key);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 14) return `${diff} days ago`;
  if (diff < 60) return `${Math.floor(diff / 7)} weeks ago`;
  return `${Math.floor(diff / 30)} months ago`;
}

/** Latest completed practice for these Anchor ids, as an ISO timestamp. */
export function latestPracticeAt(
  sessions: AnyProgressSession[],
  anchorIds: string | readonly string[],
): string | null {
  let latest: { at: number; iso: string } | null = null;
  for (const s of sessions) {
    if (!matchesAnchor(s, anchorIds)) continue;
    const at = new Date(s.completedAt).getTime();
    if (Number.isNaN(at)) continue;
    if (!latest || at > latest.at) latest = { at, iso: s.completedAt };
  }
  return latest?.iso ?? null;
}

export interface V2ProgressVerdict {
  headline: string;
  support: string;
}

/**
 * Hero verdict. The "strongest on days you practice twice" line has no data
 * behind it, so it is never shown; support is only what is actually known.
 */
export function getProgressVerdict(
  threadStrength: number | null,
  unmeasured: boolean,
  lastPracticedAt: string | null | undefined,
  now: Date = new Date(),
): V2ProgressVerdict {
  if (unmeasured || threadStrength === null) {
    return {
      headline: 'Your thread is waiting.',
      support: 'Complete your first practice and this starts to measure. Nothing is scored until then.',
    };
  }
  const relative = formatRelativeDay(lastPracticedAt, now);
  const last = relative ? `Last practiced ${relative}.` : '';
  if (threadStrength >= 60) {
    return { headline: 'Holding steady and building.', support: last };
  }
  return {
    headline: 'Soft, but still here.',
    support: [last, 'One practice today starts it climbing again.'].filter(Boolean).join(' '),
  };
}

export interface V2ThreadEventDayGroup {
  /** Local YYYY-MM-DD. */
  key: string;
  /** "Today", "Yesterday" or "Sun, Oct 4". */
  label: string;
  events: V2ThreadEventItem[];
}

/** Groups events (already newest-first) by the user's local day. */
export function groupThreadEventsByDay(
  events: V2ThreadEventItem[],
  now: Date = new Date(),
): V2ThreadEventDayGroup[] {
  const todayKey = localDateString(now);
  const yesterdayKey = localDateString(addDays(now, -1));
  const groups: V2ThreadEventDayGroup[] = [];
  for (const event of events) {
    const at = new Date(event.occurredAt);
    const key = Number.isNaN(at.getTime()) ? 'unknown' : localDateString(at);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const label =
        key === todayKey
          ? 'Today'
          : key === yesterdayKey
            ? 'Yesterday'
            : key === 'unknown'
              ? 'Earlier'
              : at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      group = { key, label, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  }
  return groups;
}

/**
 * Normalizes state for V2ProgressScreen. `extras` carries the account-level and
 * Chart inputs; without it the model has only the original fields.
 */
export function toV2ProgressModel(
  anchor: Anchor | null | undefined,
  courseLogs: CourseLogEntry[] = [],
  sessions: AnyProgressSession[] = [],
  extras?: V2ProgressExtras,
): V2ProgressModel | null {
  if (!anchor) return null;

  const storedStrength = anchor.threadStrength;
  const hasStored = typeof storedStrength === 'number' && Number.isFinite(storedStrength);
  const threadStrength = hasStored ? Math.min(100, Math.max(0, Math.round(storedStrength as number))) : null;
  const unmeasured = !hasStored;

  const qualitativeLabel = threadQualitativeLabel(threadStrength, unmeasured);
  const highestEvolutionStage = resolveEvolutionStage(threadStrength);
  const practiceSummary = aggregatePracticeSessions(sessions, anchor.id);

  const waypointsReachedCount = courseLogs.filter(
    (l) => l.eventType === 'WAYPOINT_REACHED' || l.eventType === 'COURSE_COMPLETED',
  ).length;

  const events = deriveThreadEvents(anchor, courseLogs, sessions, extras?.celebrations ?? null);
  const intention = (anchor as any).intention || anchor.intentionText || 'Your Anchor';

  const base: V2ProgressModel = {
    anchorId: anchor.id,
    anchor,
    intention,
    category: anchor.category,
    threadStrength,
    unmeasured,
    qualitativeLabel,
    highestEvolutionStage,
    practiceSummary,
    waypointsReachedCount,
    events,
    fullStrengthAt: recordedDate(extras?.celebrations?.fullStrengthAt),
    delta7d: (anchor as any).delta7d ?? null,
    delta7dStatus: (anchor as any).delta7dStatus ?? null,
  };
  if (!extras) return base;

  const now = extras.now ?? new Date();
  const anchorIds = [anchor.id, anchor.localId].filter((id): id is string => Boolean(id));
  const lastPracticedAt =
    latestPracticeAt(sessions, anchorIds) ?? (sessions.length === 0 ? (extras.lastPrimedAt ?? null) : null);

  const moveDateKeys = courseLogs
    .filter((log) => log.eventType === 'MOVE_COMPLETED')
    .map((log) => new Date(log.occurredAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => localDateString(date));
  const heatmap = {
    Week: buildHeatmap(sessions, anchorIds, 'Week', now),
    Month: buildHeatmap(sessions, anchorIds, 'Month', now),
    Year: buildHeatmap(sessions, anchorIds, 'Year', now),
  };
  const rhythm = buildRhythm(sessions, anchorIds, now, moveDateKeys);
  const route = buildRouteSummary(extras.course);
  // The week belongs to this Anchor: its own practice days, not the account's.
  const week = buildAnchorWeek(heatmap.Week, now);

  return {
    ...base,
    week,
    streak: buildStreak(sessions, extras.lastGraceDayUsedAt, now),
    rhythm,
    heatmap,
    spark: buildSpark(sessions, anchorIds, 30, now),
    route,
    insight: unmeasured ? null : buildProgressInsight({ week, moves: rhythm.Week.moves, route }),
    reflections: extras.reflections ?? [],
    lastPracticedAt,
    lifetimeSessions: extras.lifetimeSessions,
    lifetime: buildLifetimeStats(sessions, anchorIds, route),
    recentReflection: buildRecentReflection(courseLogs),
  };
}
