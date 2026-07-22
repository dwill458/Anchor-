/**
 * Widget Data Bridge — mirrors app state into platform-native shared storage
 * so the home screen widgets (separate processes) can render it.
 *
 * - Android: writes a JSON snapshot to AsyncStorage (read by the widget task
 *   handler) and asks react-native-android-widget to re-render placed widgets.
 * - iOS: hands the JSON to the AnchorWidgetBridge local Expo module, which
 *   writes it into the shared App Group UserDefaults and reloads WidgetKit
 *   timelines.
 *
 * Syncs are content-deduped: `syncWidgetData()` is cheap to call and only
 * touches storage / native when the snapshot actually changed.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionStore } from '@/stores/sessionStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore, type ThreadStrengthSensitivity } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { calculateStreakWithGrace } from '@/utils/streak';
import {
  addDays,
  localDateString,
  startOfIsoWeek,
  type PrimingHistoryEntry,
} from '@/utils/primingAnalytics';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';
import type { PracticeMode, PracticeSessionRecord } from '@/types/practice';
import {
  selectCanonicalPracticeEvents,
  buildThreadStrengthSnapshot,
  PRACTICE_CONSTANCY_WINDOW_DAYS,
  type ThreadStrengthSnapshot,
} from '@/utils/practiceMetrics';
import {
  createEmptyWidgetSnapshot,
  WIDGET_FALLBACK_ANCHOR_NAME,
  WIDGET_HISTORY_DAYS,
  WIDGET_LAST_SYNC_STORAGE_KEY,
  WIDGET_NAMES,
  WIDGET_SNAPSHOT_STORAGE_KEY,
  type WidgetHistoryDay,
  type WidgetPracticeType,
  type WidgetSnapshot,
  type WidgetWeekDay,
} from './widgetTypes';

// ─── Pure snapshot builders (exported for tests) ────────────────────────────

/**
 * Adapts the session store's uncapped priming history into the widget
 * contract: one entry per day for the trailing WIDGET_HISTORY_DAYS days
 * (oldest first, ending today). Level = per-day priming session count capped
 * at 3; deep = the day included a reinforce ("Deep Prime") session.
 */
export function buildWidgetHistory(
  primingHistory: PrimingHistoryEntry[],
  now: Date = new Date()
): WidgetHistoryDay[] {
  const hasCanonicalMode = primingHistory.some(
    (entry) => Boolean((entry as PrimingHistoryEntry & { canonicalMode?: PracticeMode }).canonicalMode),
  );
  const byDate = new Map<
    string,
    { count: number; deep: boolean; dominantMode: PracticeMode | null; mode: WidgetPracticeType | null; timestamp: number }
  >();
  for (const entry of primingHistory) {
    const canonicalMode = (entry as PrimingHistoryEntry & { canonicalMode?: PracticeMode }).canonicalMode;
    const mode = canonicalMode ?? normalizeWidgetPracticeType(entry.type);
    const timestamp = new Date(entry.completedAt).getTime();
    const existing = byDate.get(entry.localDate) ?? {
      count: 0,
      deep: false,
      dominantMode: null,
      mode: null,
      timestamp: Number.NEGATIVE_INFINITY,
    };
    existing.count += 1;
    if (canonicalMode === 'deep_prime' || (!canonicalMode && entry.type === 'reinforce')) {
      existing.deep = true;
    }
    if (canonicalMode) existing.dominantMode = canonicalMode;
    if (mode && timestamp >= existing.timestamp) {
      existing.mode = mode;
      existing.timestamp = timestamp;
    }
    byDate.set(entry.localDate, existing);
  }

  const days: WidgetHistoryDay[] = [];
  for (let offset = WIDGET_HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = localDateString(addDays(now, -offset));
    const dayData = byDate.get(date);
    const count = dayData?.count ?? 0;
    const level = (count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3) as 0 | 1 | 2 | 3;
    days.push({
      date,
      level,
      deep: dayData?.deep ?? false,
      ...(dayData?.mode ? { mode: dayData.mode } : {}),
      ...(hasCanonicalMode ? { dominantMode: dayData?.dominantMode ?? null } : {}),
    });
  }
  return days;
}

const SENSITIVITY_COPY: Record<
  ThreadStrengthSensitivity,
  { label: string; note: string }
> = {
  lenient: { label: 'Lenient', note: '2 grace days before decay begins.' },
  balanced: { label: 'Balanced', note: '1 grace day before decay begins.' },
  strict: { label: 'Strict', note: 'Any missed day begins decay.' },
};

interface ClassifiedWidgetSession extends PrimingHistoryEntry {
  dateKey: string;
  timestamp: number;
  displayType: 'focus' | 'deep' | 'visualize' | 'release';
}

const WIDGET_PRACTICE_TYPE_ALIASES: Record<string, WidgetPracticeType> = {
  focus: 'focus',
  focus_session: 'focus',
  activation: 'focus',
  activate: 'focus',
  deep_prime: 'deep_prime',
  deepprime: 'deep_prime',
  deep: 'deep_prime',
  prime: 'deep_prime',
  reinforce: 'deep_prime',
  visualize: 'visualize',
  visualization: 'visualize',
  visualize_mode: 'visualize',
  release: 'release',
};

/** Normalizes legacy session labels for widgets without rewriting history. */
export function normalizeWidgetPracticeType(value: unknown): WidgetPracticeType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return WIDGET_PRACTICE_TYPE_ALIASES[normalized] ?? null;
}

/**
 * Legacy (pre-canonical-ledger) classifier: duplicate completion events are
 * ignored, and the first reinforce for an anchor is treated as Focus rather
 * than Deep Prime. Only used when there is no signed-in account with a
 * canonical practice ledger to read from — see `buildWidgetSummaryFromThreadStrength`
 * for the path that actually mirrors the Thread Strength sheet exactly.
 */
function classifyWidgetSessions(entries: PrimingHistoryEntry[]): ClassifiedWidgetSession[] {
  const seenIds = new Set<string>();
  const lastSignatureTime = new Map<string, number>();
  const anchorsWithPriorPrime = new Set<string>();
  const sorted = entries
    .map((entry) => {
      const rawEntry = entry as PrimingHistoryEntry & { type?: unknown; practiceMode?: unknown };
      const normalizedMode =
        normalizeWidgetPracticeType(rawEntry.practiceMode) ?? normalizeWidgetPracticeType(rawEntry.type);
      const timestamp = new Date(entry.completedAt).getTime();
      return normalizedMode && !Number.isNaN(timestamp)
        ? { ...entry, normalizedMode, dateKey: entry.localDate, timestamp }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((left, right) => left.timestamp - right.timestamp);

  const classified: ClassifiedWidgetSession[] = [];
  for (const entry of sorted) {
    if (seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);

    const signature = `${entry.anchorId}|${entry.normalizedMode}`;
    const previousTime = lastSignatureTime.get(signature);
    if (previousTime != null && Math.abs(entry.timestamp - previousTime) <= 5_000) {
      continue;
    }
    lastSignatureTime.set(signature, entry.timestamp);

    const canonicalMode = (entry as PrimingHistoryEntry & { canonicalMode?: PracticeMode }).canonicalMode;
    const displayType = canonicalMode
      ? canonicalMode === 'deep_prime' ? 'deep' : canonicalMode
      : entry.normalizedMode === 'visualize'
        ? 'visualize'
        : entry.normalizedMode === 'release'
          ? 'release'
        : entry.normalizedMode === 'deep_prime' && anchorsWithPriorPrime.has(entry.anchorId)
          ? 'deep'
          : 'focus';
    classified.push({ ...entry, displayType });
    anchorsWithPriorPrime.add(entry.anchorId);
  }

  return classified;
}

/** % of the trailing 30 days (inclusive of today) with at least one session. */
function computeConstancyPercent(sessions: ClassifiedWidgetSession[], now: Date): number {
  const today = localDateString(now);
  const windowStart = localDateString(addDays(now, -(PRACTICE_CONSTANCY_WINDOW_DAYS - 1)));
  const activeDates = new Set(
    sessions
      .map((session) => session.dateKey)
      .filter((dateKey) => dateKey >= windowStart && dateKey <= today)
  );
  return Math.round((activeDates.size / PRACTICE_CONSTANCY_WINDOW_DAYS) * 100);
}

function longestSessionStreak(sessions: ClassifiedWidgetSession[]): number {
  const dates = Array.from(new Set(sessions.map((session) => session.dateKey))).sort();
  let longest = 0;
  let running = 0;
  let previous: Date | null = null;

  for (const dateKey of dates) {
    const date = new Date(`${dateKey}T00:00:00`);
    const isConsecutive = previous != null && date.getTime() - previous.getTime() === 86_400_000;
    running = isConsecutive ? running + 1 : 1;
    longest = Math.max(longest, running);
    previous = date;
  }

  return longest;
}

/**
 * Consecutive-day session streak ending today (or yesterday, so an unprimed
 * morning doesn't zero the number). No grace days — this is the raw per-anchor
 * thread shown on the 4×2; the practice-wide `streak` keeps grace handling.
 */
function currentSessionStreak(sessions: ClassifiedWidgetSession[], now: Date): number {
  const dates = new Set(sessions.map((session) => session.dateKey));
  let cursor = now;
  if (!dates.has(localDateString(cursor))) {
    cursor = addDays(cursor, -1);
    if (!dates.has(localDateString(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (dates.has(localDateString(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Per-anchor metrics for the medium widget, scoped to one anchor's sessions. */
function buildAnchorMetrics(
  primingHistory: PrimingHistoryEntry[],
  anchorId: string | null,
  now: Date
): Pick<WidgetSnapshot, 'anchorTotalSessions' | 'anchorDayStreak' | 'anchorDeepPrimeSessions' | 'anchorVisualizeSessions'> {
  if (!anchorId) {
    return { anchorTotalSessions: 0, anchorDayStreak: 0, anchorDeepPrimeSessions: 0, anchorVisualizeSessions: 0 };
  }
  const sessions = classifyWidgetSessions(
    primingHistory.filter((entry) => entry.anchorId === anchorId)
  );
  return {
    anchorTotalSessions: sessions.length,
    anchorDayStreak: currentSessionStreak(sessions, now),
    anchorDeepPrimeSessions: sessions.filter((session) => session.displayType === 'deep').length,
    anchorVisualizeSessions: sessions.filter((session) => session.displayType === 'visualize').length,
  };
}

function buildCurrentWeek(
  sessions: ClassifiedWidgetSession[],
  now: Date
): WidgetWeekDay[] {
  const today = localDateString(now);
  const byDate = new Map<string, { focus: boolean; deep: boolean; visualize: boolean; dominantMode: PracticeMode | null }>();
  for (const session of sessions) {
    const value = byDate.get(session.dateKey) ?? { focus: false, deep: false, visualize: false, dominantMode: null };
    if (session.displayType === 'focus') value.focus = true;
    if (session.displayType === 'deep') value.deep = true;
    if (session.displayType === 'visualize') value.visualize = true;
    value.dominantMode = session.displayType === 'deep' ? 'deep_prime' : session.displayType;
    byDate.set(session.dateKey, value);
  }

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => {
    const date = addDays(startOfIsoWeek(now), index);
    const dateKey = localDateString(date);
    const value = byDate.get(dateKey) ?? { focus: false, deep: false, visualize: false, dominantMode: null };
    return {
      label,
      date: dateKey,
      hasFocus: value.focus,
      hasDeep: value.deep,
      hasVisualize: value.visualize,
      dominantMode: value.dominantMode,
      isToday: dateKey === today,
      isFuture: dateKey > today,
    };
  });
}

function buildWidgetSummary(
  primingHistory: PrimingHistoryEntry[],
  now: Date,
  threadStrength: number,
  sensitivity: ThreadStrengthSensitivity
): Pick<
  WidgetSnapshot,
  | 'threadStrength'
  | 'totalSessions'
  | 'focusSessions'
  | 'deepPrimeSessions'
  | 'visualizeSessions'
  | 'releaseSessions'
  | 'deepPrimePercent'
  | 'constancyPercent'
  | 'longestStreak'
  | 'sensitivityLabel'
  | 'sensitivityNote'
  | 'currentWeek'
> {
  const sessions = classifyWidgetSessions(primingHistory);
  const deepPrimeSessions = sessions.filter((session) => session.displayType === 'deep').length;
  const visualizeSessions = sessions.filter((session) => session.displayType === 'visualize').length;
  const releaseSessions = sessions.filter((session) => session.displayType === 'release').length;
  const focusSessions = sessions.length - deepPrimeSessions - visualizeSessions - releaseSessions;
  const totalSessions = sessions.length;
  const sensitivityCopy = SENSITIVITY_COPY[sensitivity] ?? SENSITIVITY_COPY.balanced;

  return {
    threadStrength: Math.max(0, Math.min(100, Math.round(threadStrength))),
    totalSessions,
    focusSessions,
    deepPrimeSessions,
    visualizeSessions,
    releaseSessions,
    deepPrimePercent: totalSessions > 0 ? Math.round((deepPrimeSessions / totalSessions) * 100) : 0,
    constancyPercent: computeConstancyPercent(sessions, now),
    longestStreak: longestSessionStreak(sessions),
    sensitivityLabel: sensitivityCopy.label,
    sensitivityNote: sensitivityCopy.note,
    currentWeek: buildCurrentWeek(sessions, now),
  };
}

/**
 * Canonical-ledger path: derives the large widget's summary directly from
 * the same `ThreadStrengthSnapshot` the Thread Strength sheet renders, so
 * every number on the 4×4 (total sessions, constancy, prime record, deep
 * prime %) is identical to the sheet rather than independently recomputed.
 */
function widgetWeekFromThreadStrength(snapshot: ThreadStrengthSnapshot): WidgetWeekDay[] {
  return snapshot.currentWeek.map((day) => {
    const aggregate = snapshot.dailyAggregates.get(day.localDateKey);
    return {
      label: day.label,
      date: day.localDateKey,
      hasFocus: (aggregate?.byMode.focus ?? 0) > 0,
      hasDeep: (aggregate?.byMode.deep_prime ?? 0) > 0,
      hasVisualize: (aggregate?.byMode.visualize ?? 0) > 0,
      dominantMode: aggregate?.dominantMode ?? null,
      isToday: day.isToday,
      isFuture: day.isFuture,
    };
  });
}

function buildWidgetSummaryFromThreadStrength(
  snapshot: ThreadStrengthSnapshot,
  sensitivity: ThreadStrengthSensitivity
): Pick<
  WidgetSnapshot,
  | 'threadStrength'
  | 'totalSessions'
  | 'focusSessions'
  | 'deepPrimeSessions'
  | 'visualizeSessions'
  | 'releaseSessions'
  | 'deepPrimePercent'
  | 'constancyPercent'
  | 'longestStreak'
  | 'sensitivityLabel'
  | 'sensitivityNote'
  | 'currentWeek'
> {
  const countFor = (mode: PracticeMode): number =>
    snapshot.sessionBreakdown.find((row) => row.mode === mode)?.count ?? 0;
  const sensitivityCopy = SENSITIVITY_COPY[sensitivity] ?? SENSITIVITY_COPY.balanced;

  return {
    threadStrength: snapshot.score,
    totalSessions: snapshot.totalSessions,
    focusSessions: countFor('focus'),
    deepPrimeSessions: countFor('deep_prime'),
    visualizeSessions: countFor('visualize'),
    releaseSessions: countFor('release'),
    deepPrimePercent: snapshot.deepPrimePercent,
    constancyPercent: snapshot.constancyPercent,
    longestStreak: snapshot.primeRecordDays,
    sensitivityLabel: sensitivityCopy.label,
    sensitivityNote: sensitivityCopy.note,
    currentWeek: widgetWeekFromThreadStrength(snapshot),
  };
}

/**
 * Mirrors PracticeScreen's anchor resolution: the explicitly selected anchor
 * when it is still active, otherwise the most recently updated active anchor
 * (the store keeps `anchors` sorted most-recent-first).
 */
export function selectWidgetAnchorName(
  anchors: Anchor[],
  currentAnchorId: string | undefined
): string {
  const selected = selectWidgetAnchor(anchors, currentAnchorId);
  const name = selected?.intentionText?.trim();
  return name && name.length > 0 ? name : WIDGET_FALLBACK_ANCHOR_NAME;
}

/** Resolves the same active anchor used by PracticeScreen for widget content. */
export function selectWidgetAnchor(
  anchors: Anchor[],
  currentAnchorId: string | undefined
): Anchor | undefined {
  const activeAnchors = anchors.filter((anchor) => !anchor.isReleased && !anchor.archivedAt);
  return activeAnchors.find((anchor) => anchor.id === currentAnchorId) ?? activeAnchors[0];
}

function hashWidgetArtwork(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function selectWidgetArtwork(anchor: Anchor | undefined): Pick<
  WidgetSnapshot,
  'sigilSvg' | 'artworkSource' | 'artworkVersion'
> {
  const reinforced = anchor?.reinforcedSigilSvg?.trim();
  const base = anchor?.baseSigilSvg?.trim();
  const sigilSvg = reinforced || base || null;
  const artworkSource = reinforced ? 'reinforced_svg' : base ? 'base_svg' : 'fallback';
  const changedAt =
    anchor?.updatedAt instanceof Date ? anchor.updatedAt.toISOString() : String(anchor?.updatedAt ?? '');

  return {
    sigilSvg,
    artworkSource,
    artworkVersion:
      anchor && sigilSvg ? `${anchor.userId}:${anchor.id}:${changedAt}:${hashWidgetArtwork(sigilSvg)}` : null,
  };
}

export interface WidgetSnapshotInputs {
  anchors: Anchor[];
  currentAnchorId: string | undefined;
  primingHistory: PrimingHistoryEntry[];
  practiceHistory?: PracticeSessionRecord[];
  accountId?: string | null;
  lastPrimedAt: string | null;
  lastGraceDayUsedAt: string | null;
  threadStrength?: number;
  threadStrengthSensitivity?: ThreadStrengthSensitivity;
  now?: Date;
}

function canonicalToWidgetHistory(
  events: PracticeSessionRecord[],
  accountId: string | null | undefined,
  now: Date,
): Array<PrimingHistoryEntry & { canonicalMode: PracticeMode }> {
  return selectCanonicalPracticeEvents(events, accountId, now).map((event) => {
    const completedAt = new Date(event.completedAt);
    const localNoon = new Date(`${event.localDateKey}T12:00:00`);
    return {
      id: event.id,
      anchorId: event.anchorId ?? event.anchorLocalId ?? event.anchorServerId ?? 'released-anchor',
      type: event.practiceMode === 'deep_prime' ? 'reinforce' : event.practiceMode === 'visualize' ? 'visualize' : 'activate',
      completedAt: event.completedAt,
      localDate: event.localDateKey,
      weekKey: `${localNoon.getFullYear()}-W${String(Math.ceil((((localNoon.getTime() - new Date(localNoon.getFullYear(), 0, 1).getTime()) / 86_400_000) + new Date(localNoon.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`,
      weekStart: localDateString(startOfIsoWeek(localNoon)),
      weekdayIndex: (localNoon.getDay() + 6) % 7,
      hourOfDay: completedAt.getHours(),
      timeOfDay: completedAt.getHours() < 12 ? 'morning' : completedAt.getHours() < 17 ? 'afternoon' : 'evening',
      canonicalMode: event.practiceMode,
    } as PrimingHistoryEntry & { canonicalMode: PracticeMode };
  });
}

export function buildWidgetSnapshot(inputs: WidgetSnapshotInputs): WidgetSnapshot {
  const now = inputs.now ?? new Date();
  const today = localDateString(now);
  const useCanonical = inputs.practiceHistory != null && Boolean(inputs.accountId);
  const sourceHistory = useCanonical
    ? canonicalToWidgetHistory(inputs.practiceHistory ?? [], inputs.accountId, now)
    : inputs.primingHistory;
  const streakResult = calculateStreakWithGrace(
    sourceHistory,
    inputs.lastGraceDayUsedAt,
    now
  );
  const selectedAnchor = selectWidgetAnchor(inputs.anchors, inputs.currentAnchorId);
  const artwork = selectWidgetArtwork(selectedAnchor);
  const sensitivity = inputs.threadStrengthSensitivity ?? 'balanced';
  const summary = useCanonical
    ? buildWidgetSummaryFromThreadStrength(
        buildThreadStrengthSnapshot({
          events: inputs.practiceHistory ?? [],
          accountId: inputs.accountId,
          dailyGoal: 3,
          sensitivity,
          restDays: [],
          now,
        }),
        sensitivity
      )
    : buildWidgetSummary(sourceHistory, now, inputs.threadStrength ?? 0, sensitivity);

  return {
    ...createEmptyWidgetSnapshot(),
    anchorId: selectedAnchor?.id ?? null,
    anchorName: selectedAnchor?.intentionText?.trim() || WIDGET_FALLBACK_ANCHOR_NAME,
    ...artwork,
    primedToday: sourceHistory.some((entry) => entry.localDate === today),
    streak: streakResult.currentStreak,
    ...summary,
    ...buildAnchorMetrics(sourceHistory, selectedAnchor?.id ?? null, now),
    history: buildWidgetHistory(sourceHistory, now),
    lastPrimedDate: sourceHistory[sourceHistory.length - 1]?.localDate ?? inputs.lastPrimedAt,
  };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

let lastWrittenJson: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: Array<() => void> = [];

async function pushSnapshotToAndroidWidgets(snapshot: WidgetSnapshot): Promise<void> {
  // Required inside the platform guard so the Android-only native module is
  // never touched on iOS.
  const { requestWidgetUpdate } = require('react-native-android-widget');
  const { renderAnchorWidgetByName } = require('./android/renderAnchorWidget');

  await Promise.all(
    WIDGET_NAMES.map((widgetName) =>
      requestWidgetUpdate({
        widgetName,
        renderWidget: (info: { width: number; height: number }) =>
          renderAnchorWidgetByName(widgetName, snapshot, { width: info.width, height: info.height }),
        widgetNotFound: () => {
          // Widget of this size not placed on any home screen — nothing to update.
        },
      })
    )
  );
}

function pushSnapshotToIosWidgets(json: string): void {
  // Local Expo module — absent in dev clients built before the widget work
  // landed, so failures are non-fatal.
  const { setWidgetSnapshot } = require('../../modules/anchor-widget-bridge');
  setWidgetSnapshot(json);
}

/**
 * Reads current app state and mirrors it into the platform widget storage.
 * No-op when the resulting snapshot is identical to the last one written.
 */
export async function syncWidgetData(): Promise<void> {
  try {
    const sessionState = useSessionStore.getState();
    const anchorState = useAnchorStore.getState();
    const settingsState = useSettingsStore.getState();
    const accountId = useAuthStore.getState().user?.id ?? null;

    const snapshot = buildWidgetSnapshot({
      anchors: anchorState.anchors,
      currentAnchorId: anchorState.currentAnchorId,
      primingHistory: sessionState.primingHistory,
      practiceHistory: sessionState.practiceHistory,
      accountId,
      lastPrimedAt: sessionState.lastPrimedAt,
      lastGraceDayUsedAt: sessionState.lastGraceDayUsedAt,
      threadStrength: sessionState.threadStrength,
      threadStrengthSensitivity: settingsState.threadStrengthSensitivity,
    });
    const json = JSON.stringify(snapshot);

    if (json === lastWrittenJson) {
      return;
    }
    lastWrittenJson = json;

    await AsyncStorage.setItem(WIDGET_SNAPSHOT_STORAGE_KEY, json);
    await AsyncStorage.setItem(WIDGET_LAST_SYNC_STORAGE_KEY, new Date().toISOString());

    if (Platform.OS === 'android') {
      await pushSnapshotToAndroidWidgets(snapshot);
    } else if (Platform.OS === 'ios') {
      pushSnapshotToIosWidgets(json);
    }
  } catch (error) {
    // Widget sync must never break app flows — log and move on.
    logger.warn('[widgetDataBridge] widget sync failed', error);
  }
}

function scheduleSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  // Trailing debounce: batches bursts of store updates (e.g. a prime
  // completion touching several session fields) into one sync.
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncWidgetData();
  }, 500);
}

/**
 * Starts mirroring app state into the widgets. Call once at app startup.
 *
 * Subscribing to the stores (rather than patching each prime-completion call
 * site) also keeps widgets fresh across backend hydration, thread decay, and
 * anchor renames/releases.
 */
export function initWidgetDataSync(): void {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return;
  }
  if (unsubscribers.length > 0) {
    return;
  }

  unsubscribers = [
    useSessionStore.subscribe(scheduleSync),
    useAnchorStore.subscribe(scheduleSync),
    useSettingsStore.subscribe(scheduleSync),
  ];
  scheduleSync();
}

/** Test-only: clears subscriptions and dedupe state. */
export function __resetWidgetDataSyncForTests(): void {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  lastWrittenJson = null;
}
