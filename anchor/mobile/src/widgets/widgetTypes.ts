/**
 * Widget shared contract — the data shape written from the RN app and read by
 * the home screen widgets on both platforms.
 *
 * iOS reads the JSON-serialized snapshot from the shared App Group
 * UserDefaults (written via the AnchorWidgetBridge local module).
 * Android reads it from AsyncStorage inside the widget task handler.
 *
 * Keep this file dependency-free — it is imported by the Android widget
 * renderers, which run in a headless JS context.
 */

export interface WidgetHistoryDay {
  /** Local YYYY-MM-DD */
  date: string;
  /** 0 = no priming sessions that day, 1–3 = session-count intensity */
  level: 0 | 1 | 2 | 3;
  /** True when the day included a reinforce ("Deep Prime") session */
  deep: boolean;
}

export interface WidgetWeekDay {
  label: string;
  date: string;
  hasFocus: boolean;
  hasDeep: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface WidgetSnapshot {
  /** The active anchor represented by the widget, if one exists. */
  anchorId: string | null;
  anchorName: string;
  /** The selected anchor's deterministic sigil SVG. */
  sigilSvg: string | null;
  primedToday: boolean;
  /** "Day Thread" count shown on the large widget */
  streak: number;
  /** Thread Strength sheet summary, mirrored for the large widget. */
  threadStrength: number;
  totalSessions: number;
  focusSessions: number;
  deepPrimeSessions: number;
  visualizeSessions: number;
  deepPrimePercent: number;
  longestStreak: number;
  sensitivityLabel: string;
  sensitivityNote: string;
  /**
   * Metrics scoped to the selected anchor only (the practice-wide numbers
   * above feed the 4×4; these feed the 4×2's per-anchor row).
   */
  anchorTotalSessions: number;
  anchorDayStreak: number;
  anchorDeepPrimeSessions: number;
  anchorVisualizeSessions: number;
  currentWeek: WidgetWeekDay[];
  /** Most recent ~126 days (18 weeks), oldest first */
  history: WidgetHistoryDay[];
  /**
   * Local YYYY-MM-DD of the last priming session, or null.
   * Lets renderers recompute the primed state after local midnight without
   * waiting for the app to produce a fresh snapshot.
   */
  lastPrimedDate: string | null;
}

/** Days of history included in a snapshot: 18 weeks × 7 days */
export const WIDGET_HISTORY_DAYS = 126;
export const WIDGET_HISTORY_WEEKS = 18;

/** Android widget names — must match the react-native-android-widget plugin config in app.json */
export const WIDGET_NAMES = ['AnchorSmallWidget', 'AnchorMediumWidget', 'AnchorLargeWidget'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

/** AsyncStorage keys owned by the widget system (RN side) */
export const WIDGET_SNAPSHOT_STORAGE_KEY = '@anchor_widget_snapshot';
export const WIDGET_LAST_SYNC_STORAGE_KEY = '@anchor_widget_last_sync';

/** iOS App Group shared with the AnchorWidget extension */
export const WIDGET_APP_GROUP = 'group.com.anchorintentions.app.widget';
/** Key inside the shared UserDefaults suite holding the snapshot JSON */
export const WIDGET_IOS_SNAPSHOT_KEY = 'widgetSnapshot';

/**
 * Deep link opened by the medium widget CTA. Lands on the Practice tab
 * (PracticeHome) — the Focus session entry point — for both CTA states.
 */
export const WIDGET_PRACTICE_DEEP_LINK = 'anchor://practice';

/** Opens the prime picker for the anchor represented by the 2×2 widget. */
export function buildWidgetPrimeDeepLink(anchorId: string): string {
  return `anchor://prime?anchorId=${encodeURIComponent(anchorId)}`;
}

/** Shown when the user has no active anchors yet */
export const WIDGET_FALLBACK_ANCHOR_NAME = 'Anchor';

export function createEmptyWidgetSnapshot(): WidgetSnapshot {
  return {
    anchorId: null,
    anchorName: WIDGET_FALLBACK_ANCHOR_NAME,
    sigilSvg: null,
    primedToday: false,
    streak: 0,
    threadStrength: 0,
    totalSessions: 0,
    focusSessions: 0,
    deepPrimeSessions: 0,
    visualizeSessions: 0,
    deepPrimePercent: 0,
    longestStreak: 0,
    sensitivityLabel: 'Balanced',
    sensitivityNote: '1 grace day before decay begins.',
    anchorTotalSessions: 0,
    anchorDayStreak: 0,
    anchorDeepPrimeSessions: 0,
    anchorVisualizeSessions: 0,
    currentWeek: [],
    history: [],
    lastPrimedDate: null,
  };
}
