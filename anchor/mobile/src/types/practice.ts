import type { BackgroundAudioMode, GuidanceVoice } from './sessionAudio';

export const PRACTICE_MODES = [
  'deep_prime',
  'visualize',
  'focus',
  'release',
] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const PRACTICE_MODE_LABELS: Readonly<Record<PracticeMode, string>> = {
  deep_prime: 'Deep Prime',
  visualize: 'Visualize',
  focus: 'Focus',
  release: 'Release',
};

export const PRACTICE_MODE_THEME = {
  deep_prime: {
    label: PRACTICE_MODE_LABELS.deep_prime,
    primary: '#D4AF37',
    bright: '#F0CB6A',
  },
  visualize: {
    label: PRACTICE_MODE_LABELS.visualize,
    primary: '#78B4D1',
  },
  focus: {
    label: PRACTICE_MODE_LABELS.focus,
    primary: '#AD99D2',
  },
  release: {
    label: PRACTICE_MODE_LABELS.release,
    primary: '#C8875A',
  },
} as const;

/** Modes accepted by the single session-entry boundary. */
export const PRACTICE_ENTRY_MODES = [
  'focus',
  'deepPrime',
  'visualize',
  'release',
] as const;
export type PracticeEntryMode = (typeof PRACTICE_ENTRY_MODES)[number];

/**
 * Serializable destination carried through a practice flow.  Practice lives
 * in an independent navigation container, so an Anchor-detail destination
 * needs more than the legacy `returnTo: 'detail'` string to cross back into
 * the Vault stack safely.
 */
export type PracticeFlowReturnTarget =
  | { kind: 'practice' }
  | { kind: 'chart' }
  | { kind: 'sanctuary' }
  | { kind: 'anchorDetail'; anchorId: string };

export type WeaveRange = '4w' | '12w' | '6m' | '1y';

export type WeaveScope =
  | { kind: 'all' }
  | { kind: 'anchor'; anchorId: string };

/** Practice modes Chart may launch. Release remains an Anchor-owned action. */
export type ChartPracticeMode = Exclude<PracticeEntryMode, 'release'>;

/**
 * Successful completion data returned to the originating Chart waypoint.
 * Abandoned sessions intentionally carry no handoff, so they can never open a
 * post-practice Reflection.
 */
export interface ChartPracticeCompletionHandoff {
  outcome: 'completed';
  practiceSessionId: string;
  practiceMode: ChartPracticeMode;
  anchorId: string;
}

/**
 * Stable source labels used to audit every practice entry point.
 *
 * This union mirrors `PracticeEntrySource` in backend/src/types/chart.ts. The
 * backend validates `practiceEntrySource` against the same list, so a value
 * added here must exist there too or the session write is rejected.
 */
export type PracticeEntrySource =
  | 'practice_hero'
  | 'practice_deep_prime_card'
  | 'practice_focus_card'
  | 'practice_visualize_card'
  | 'practice_release_card'
  | 'anchor_detail'
  | 'sanctuary_prime_anchor'
  | 'widget'
  | 'shortcut'
  | 'evolve'
  | 'chart'
  | 'chart_waypoint_detail';

export const PRACTICE_ENTRY_SOURCES = [
  'practice_hero',
  'practice_deep_prime_card',
  'practice_focus_card',
  'practice_visualize_card',
  'practice_release_card',
  'anchor_detail',
  'sanctuary_prime_anchor',
  'widget',
  'shortcut',
  'evolve',
  'chart',
  'chart_waypoint_detail',
] as const satisfies readonly PracticeEntrySource[];

/** Chart entry sources. Only these may carry a `ChartPracticeContext`. */
export const CHART_PRACTICE_ENTRY_SOURCES = [
  'chart',
  'chart_waypoint_detail',
] as const satisfies readonly PracticeEntrySource[];

export type ChartPracticeEntrySource =
  (typeof CHART_PRACTICE_ENTRY_SOURCES)[number];

export const isChartPracticeEntrySource = (
  value: PracticeEntrySource | undefined,
): value is ChartPracticeEntrySource =>
  value === 'chart' || value === 'chart_waypoint_detail';

/**
 * Course context attached to a Chart-launched practice session.
 *
 * `courseVersion` is the expected Course version observed when the session was
 * launched. It is carried so a later waypoint completion can send
 * `expectedCourseVersion` without re-reading a possibly-stale cache. It is
 * deliberately NOT persisted server-side: `Course.version` is authoritative and
 * a session is immutable history, so a stored copy would only ever go stale.
 */
export interface ChartPracticeContext {
  courseId: string;
  waypointId: string;
  courseVersion: number;
}

export const isChartPracticeContext = (
  value: unknown,
): value is ChartPracticeContext => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ChartPracticeContext>;
  return (
    typeof candidate.courseId === 'string' &&
    candidate.courseId.length > 0 &&
    typeof candidate.waypointId === 'string' &&
    candidate.waypointId.length > 0 &&
    typeof candidate.courseVersion === 'number' &&
    Number.isInteger(candidate.courseVersion) &&
    candidate.courseVersion >= 1
  );
};

/**
 * Rebuilds the context from scratch with only the three frozen routing fields.
 *
 * Validation alone is not enough at this boundary: deep links and restored
 * resume state are untrusted input, and passing the caller's object straight
 * through would carry any extra keys it happened to hold — destination text, a
 * waypoint title, reflection text — into navigation params. Constructing a new
 * object makes that structurally impossible rather than merely unlikely.
 */
export const normalizeChartPracticeContext = (
  value: unknown,
): ChartPracticeContext | null =>
  isChartPracticeContext(value)
    ? {
        courseId: value.courseId,
        waypointId: value.waypointId,
        courseVersion: value.courseVersion,
      }
    : null;

/** Existing product weighting: Deep Prime compounds faster than base practice. */
export const PRACTICE_THREAD_STRENGTH_GAINS: Readonly<
  Record<PracticeMode, number>
> = {
  deep_prime: 40,
  visualize: 40,
  focus: 25,
  release: 25,
};

const MODE_ALIASES: Readonly<Record<string, PracticeMode>> = {
  deep_prime: 'deep_prime',
  deepprime: 'deep_prime',
  'deep-prime': 'deep_prime',
  prime: 'deep_prime',
  priming: 'deep_prime',
  charge: 'deep_prime',
  charged: 'deep_prime',
  reinforce: 'deep_prime',
  reinforcement: 'deep_prime',
  visualize: 'visualize',
  visualization: 'visualize',
  visualisation: 'visualize',
  focus: 'focus',
  focussession: 'focus',
  'focus-session': 'focus',
  activate: 'focus',
  activation: 'focus',
  quickactivate: 'focus',
  quick_activation: 'focus',
  release: 'release',
  released: 'release',
  burn: 'release',
  burned: 'release',
  burning: 'release',
};

export function normalizePracticeMode(value: unknown): PracticeMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  return MODE_ALIASES[normalized] ?? null;
}

export type PracticeCompletionSource =
  | 'practice_screen'
  | 'anchor_detail'
  | 'notification'
  | 'widget'
  | 'deep_link'
  | 'restored'
  | 'unknown';

export type PracticeSessionSyncState =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed';

export interface PracticeSessionRecord {
  id: string;
  accountId: string;
  anchorId: string | null;
  anchorLocalId: string | null;
  anchorServerId: string | null;
  practiceMode: PracticeMode;
  plannedDurationSeconds: number;
  completedDurationSeconds: number;
  completionStatus: 'completed';
  startedAt: string;
  completedAt: string;
  localDateKey: string;
  timeZone: string;
  utcOffsetMinutesAtCompletion: number;
  completionSource: PracticeCompletionSource;
  schemaVersion: number;
  legacyType: string | null;
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
  sceneSnapshot: string | null;
  nextAction: string | null;
  clientVersion: string | null;
  metadata?: Record<string, unknown>;
  /**
   * Chart context, present only for Chart-launched sessions. These live on the
   * record (not only in memory) so the encrypted offline retry queue replays
   * them verbatim — the backend treats them as immutable session fields.
   */
  courseId?: string | null;
  waypointId?: string | null;
  practiceEntrySource?: PracticeEntrySource | null;
  syncState: PracticeSessionSyncState;
}

export interface UnknownPracticeHistoryRecord {
  fingerprint: string;
  accountId: string;
  legacyType: string;
  completedAt: string | null;
  raw: Record<string, unknown>;
}

export interface VisualizationScene {
  id?: string;
  accountId: string;
  anchorId: string;
  anchorLocalId: string | null;
  currentText: string;
  originalSuggestion: string;
  generationSource: 'gemini' | 'deterministic_fallback' | 'user_edited';
  generationVersion: string;
  clientUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
  syncState: PracticeSessionSyncState;
}

export const practiceModeLabel = (mode: PracticeMode): string =>
  PRACTICE_MODE_LABELS[mode];
