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
import { calculateStreakWithGrace } from '@/utils/streak';
import {
  addDays,
  localDateString,
  startOfIsoWeek,
  type PrimingHistoryEntry,
} from '@/utils/primingAnalytics';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';
import {
  createEmptyWidgetSnapshot,
  WIDGET_FALLBACK_ANCHOR_NAME,
  WIDGET_HISTORY_DAYS,
  WIDGET_LAST_SYNC_STORAGE_KEY,
  WIDGET_NAMES,
  WIDGET_SNAPSHOT_STORAGE_KEY,
  type WidgetHistoryDay,
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
  const byDate = new Map<string, { count: number; deep: boolean }>();
  for (const entry of primingHistory) {
    const existing = byDate.get(entry.localDate) ?? { count: 0, deep: false };
    existing.count += 1;
    if (entry.type === 'reinforce') {
      existing.deep = true;
    }
    byDate.set(entry.localDate, existing);
  }

  const days: WidgetHistoryDay[] = [];
  for (let offset = WIDGET_HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = localDateString(addDays(now, -offset));
    const dayData = byDate.get(date);
    const count = dayData?.count ?? 0;
    const level = (count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3) as 0 | 1 | 2 | 3;
    days.push({ date, level, deep: dayData?.deep ?? false });
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
  displayType: 'focus' | 'deep' | 'visualize';
}

/**
 * Keeps the large widget's summary in step with the Thread Strength sheet:
 * duplicate completion events are ignored, and the first reinforce for an
 * anchor is treated as Focus rather than Deep Prime.
 */
function classifyWidgetSessions(entries: PrimingHistoryEntry[]): ClassifiedWidgetSession[] {
  const seenIds = new Set<string>();
  const lastSignatureTime = new Map<string, number>();
  const anchorsWithPriorPrime = new Set<string>();
  const sorted = entries
    .filter((entry) => entry.type === 'activate' || entry.type === 'reinforce' || entry.type === 'visualize')
    .map((entry) => ({
      ...entry,
      dateKey: entry.localDate,
      timestamp: new Date(entry.completedAt).getTime(),
    }))
    .filter((entry) => !Number.isNaN(entry.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);

  const classified: ClassifiedWidgetSession[] = [];
  for (const entry of sorted) {
    if (seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);

    const signature = `${entry.anchorId}|${entry.type}`;
    const previousTime = lastSignatureTime.get(signature);
    if (previousTime != null && Math.abs(entry.timestamp - previousTime) <= 5_000) {
      continue;
    }
    lastSignatureTime.set(signature, entry.timestamp);

    const displayType = entry.type === 'visualize'
      ? 'visualize'
      : entry.type === 'reinforce' && anchorsWithPriorPrime.has(entry.anchorId)
        ? 'deep'
        : 'focus';
    classified.push({ ...entry, displayType });
    anchorsWithPriorPrime.add(entry.anchorId);
  }

  return classified;
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
  const byDate = new Map<string, { focus: boolean; deep: boolean }>();
  for (const session of sessions) {
    const value = byDate.get(session.dateKey) ?? { focus: false, deep: false };
    if (session.displayType !== 'visualize') value[session.displayType] = true;
    byDate.set(session.dateKey, value);
  }

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => {
    const date = addDays(startOfIsoWeek(now), index);
    const dateKey = localDateString(date);
    const value = byDate.get(dateKey) ?? { focus: false, deep: false };
    return {
      label,
      date: dateKey,
      hasFocus: value.focus,
      hasDeep: value.deep,
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
  | 'deepPrimePercent'
  | 'longestStreak'
  | 'sensitivityLabel'
  | 'sensitivityNote'
  | 'currentWeek'
> {
  const sessions = classifyWidgetSessions(primingHistory);
  const deepPrimeSessions = sessions.filter((session) => session.displayType === 'deep').length;
  const visualizeSessions = sessions.filter((session) => session.displayType === 'visualize').length;
  const focusSessions = sessions.length - deepPrimeSessions - visualizeSessions;
  const totalSessions = sessions.length;
  const sensitivityCopy = SENSITIVITY_COPY[sensitivity] ?? SENSITIVITY_COPY.balanced;

  return {
    threadStrength: Math.max(0, Math.min(100, Math.round(threadStrength))),
    totalSessions,
    focusSessions,
    deepPrimeSessions,
    visualizeSessions,
    deepPrimePercent: totalSessions > 0 ? Math.round((deepPrimeSessions / totalSessions) * 100) : 0,
    longestStreak: longestSessionStreak(sessions),
    sensitivityLabel: sensitivityCopy.label,
    sensitivityNote: sensitivityCopy.note,
    currentWeek: buildCurrentWeek(sessions, now),
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

export interface WidgetSnapshotInputs {
  anchors: Anchor[];
  currentAnchorId: string | undefined;
  primingHistory: PrimingHistoryEntry[];
  lastPrimedAt: string | null;
  lastGraceDayUsedAt: string | null;
  threadStrength?: number;
  threadStrengthSensitivity?: ThreadStrengthSensitivity;
  now?: Date;
}

export function buildWidgetSnapshot(inputs: WidgetSnapshotInputs): WidgetSnapshot {
  const now = inputs.now ?? new Date();
  const today = localDateString(now);
  const streakResult = calculateStreakWithGrace(
    inputs.primingHistory,
    inputs.lastGraceDayUsedAt,
    now
  );
  const selectedAnchor = selectWidgetAnchor(inputs.anchors, inputs.currentAnchorId);
  const sigilSvg =
    selectedAnchor?.baseSigilSvg?.trim() || selectedAnchor?.reinforcedSigilSvg?.trim() || null;
  const summary = buildWidgetSummary(
    inputs.primingHistory,
    now,
    inputs.threadStrength ?? 0,
    inputs.threadStrengthSensitivity ?? 'balanced'
  );

  return {
    ...createEmptyWidgetSnapshot(),
    anchorId: selectedAnchor?.id ?? null,
    anchorName: selectedAnchor?.intentionText?.trim() || WIDGET_FALLBACK_ANCHOR_NAME,
    sigilSvg,
    primedToday: inputs.lastPrimedAt === today,
    streak: streakResult.currentStreak,
    ...summary,
    ...buildAnchorMetrics(inputs.primingHistory, selectedAnchor?.id ?? null, now),
    history: buildWidgetHistory(inputs.primingHistory, now),
    lastPrimedDate: inputs.lastPrimedAt,
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
        renderWidget: () => renderAnchorWidgetByName(widgetName, snapshot),
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

    const snapshot = buildWidgetSnapshot({
      anchors: anchorState.anchors,
      currentAnchorId: anchorState.currentAnchorId,
      primingHistory: sessionState.primingHistory,
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
