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
import { calculateStreakWithGrace } from '@/utils/streak';
import { addDays, localDateString, type PrimingHistoryEntry } from '@/utils/primingAnalytics';
import { logger } from '@/utils/logger';
import type { Anchor } from '@/types';
import {
  WIDGET_FALLBACK_ANCHOR_NAME,
  WIDGET_HISTORY_DAYS,
  WIDGET_LAST_SYNC_STORAGE_KEY,
  WIDGET_NAMES,
  WIDGET_SNAPSHOT_STORAGE_KEY,
  type WidgetHistoryDay,
  type WidgetSnapshot,
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

/**
 * Mirrors PracticeScreen's anchor resolution: the explicitly selected anchor
 * when it is still active, otherwise the most recently updated active anchor
 * (the store keeps `anchors` sorted most-recent-first).
 */
export function selectWidgetAnchorName(
  anchors: Anchor[],
  currentAnchorId: string | undefined
): string {
  const activeAnchors = anchors.filter((anchor) => !anchor.isReleased && !anchor.archivedAt);
  const selected =
    activeAnchors.find((anchor) => anchor.id === currentAnchorId) ?? activeAnchors[0];
  const name = selected?.intentionText?.trim();
  return name && name.length > 0 ? name : WIDGET_FALLBACK_ANCHOR_NAME;
}

export interface WidgetSnapshotInputs {
  anchors: Anchor[];
  currentAnchorId: string | undefined;
  primingHistory: PrimingHistoryEntry[];
  lastPrimedAt: string | null;
  lastGraceDayUsedAt: string | null;
  now?: Date;
}

export function buildWidgetSnapshot(inputs: WidgetSnapshotInputs): WidgetSnapshot {
  const now = inputs.now ?? new Date();
  const today = localDateString(now);
  const streakResult = calculateStreakWithGrace(inputs.primingHistory, inputs.lastGraceDayUsedAt);

  return {
    anchorName: selectWidgetAnchorName(inputs.anchors, inputs.currentAnchorId),
    primedToday: inputs.lastPrimedAt === today,
    streak: streakResult.currentStreak,
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

    const snapshot = buildWidgetSnapshot({
      anchors: anchorState.anchors,
      currentAnchorId: anchorState.currentAnchorId,
      primingHistory: sessionState.primingHistory,
      lastPrimedAt: sessionState.lastPrimedAt,
      lastGraceDayUsedAt: sessionState.lastGraceDayUsedAt,
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
