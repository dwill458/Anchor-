export type ThreadEventSignificance = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAJOR';

export type CanonicalThreadEventType =
  | 'ANCHOR_CREATED'
  | 'THREAD_STRENGTHENED'
  | 'THREAD_STABILIZED'
  | 'THREAD_RECOVERED'
  | 'THREAD_SOFTENED'
  | 'THREAD_RETURNED'
  | 'EVOLUTION_STAGE_REACHED'
  | 'PRACTICE_MILESTONE_REACHED'
  | 'ONE_MOVE_COMPLETED'
  | 'PRACTICE_COMPLETED'
  | 'WAYPOINT_REACHED'
  | 'DESTINATION_REACHED'
  | 'COURSE_RESUMED'
  | 'ANCHOR_COMPLETED'
  | 'RELEASE_RECOMMENDED'
  | 'ANCHOR_RELEASED'
  | 'CHART_CREATED'
  | 'ROUTE_ADJUSTED'
  | 'FULL_STRENGTH_REACHED';

export interface V2ThreadEventItem {
  id: string;
  type: CanonicalThreadEventType;
  title: string;
  copy: string;
  why: string;
  significance: ThreadEventSignificance;
  /** ISO string of the real date, or '' when it is not known. Never a stand-in such as updatedAt. */
  occurredAt: string;
  formattedDate: string;
  formattedTime?: string;
  /** Authoritative Thread movement delta from server/ledger if known, null otherwise. NEVER fabricated. */
  authoritativeDelta: number | null;
  /** Authoritative Thread range [before, after] if known. */
  authoritativeThreadRange: [number, number] | null;
  stageName?: string | null;
  waypointTitle?: string | null;
  milestoneCount?: number | null;
  /** The waypoint a Course event belongs to, for the log detail. */
  waypointId?: string | null;
  /** Which practice mode a PRACTICE_COMPLETED event was, for its colour. */
  practiceMode?: 'focus' | 'deepPrime' | 'visualize' | 'release';
  /** The user's own words for a Move (reflection body, else the Move's title). Never invented. */
  note?: string | null;
  sourceDomain: 'PRACTICE' | 'THREAD_ENGINE' | 'COURSE_EVENT' | 'ANCHOR_LIFECYCLE';
  rawDomainEventId?: string | null;
}

export interface V2PracticeModeBreakdown {
  focusCount: number;
  focusSeconds: number;
  deepPrimeCount: number;
  deepPrimeSeconds: number;
  visualizeCount: number;
  visualizeSeconds: number;
  releaseCount: number;
  releaseSeconds: number;
  totalSessions: number;
  totalDurationSeconds: number;
}

/** Mon–Sun practice marks for the current ISO week. */
export interface V2ProgressWeek {
  /** [Mon–Sun] true = practised that local day. Always seven entries. */
  days: boolean[];
  /** 0 = Monday … 6 = Sunday. */
  todayIndex: number;
}

/** Days-in-a-row run. Hard-resets on a gap; it is not Consistency. */
export interface V2ProgressStreak {
  current: number;
  best: number;
  /** A grace day is currently bridging a one-day gap. */
  isProtected: boolean;
  /** The one-per-week grace day has not been used yet. */
  graceAvailable: boolean;
}

export type V2ProgressRange = 'Week' | 'Month' | 'Year';

export interface V2ProgressRhythmStats {
  practices: number;
  /** Whole minutes, from completed (not planned) duration. */
  minutes: number;
  activeDays: number;
  /** Real-world Moves completed inside the range. */
  moves: number;
  /** Longest run of consecutive local days with a practice inside the range. */
  bestRun: number;
}

export type V2ProgressRhythm = Record<V2ProgressRange, V2ProgressRhythmStats>;

export interface V2ProgressDayCell {
  /** Local YYYY-MM-DD. */
  dateKey: string;
  /** 0 none, 1 one practice, 2 two, 3 three or more. */
  level: 0 | 1 | 2 | 3;
  sessionCount: number;
  minutes: number;
  isToday?: boolean;
  /** After today: drawn empty, never counted. */
  isFuture?: boolean;
}

export interface V2ProgressSparkPoint {
  dateKey: string;
  /** Persisted `threadStrengthAfter`, never computed on the client. */
  value: number;
}

export interface V2ProgressRouteMetric {
  /** "340 / 1,000". */
  display: string;
  /** "34%", or null with no recorded value. */
  percentLabel: string | null;
  /** 0-1, or null with no recorded value. */
  fraction: number | null;
}

export interface V2ProgressRouteWaypoint {
  id: string;
  /** 1-based position on the live route. */
  number: number;
  title: string;
  metric: V2ProgressRouteMetric | null;
  state: 'completed' | 'current' | 'upcoming';
  isDestination: boolean;
}

export interface V2ProgressRouteSummary {
  /** 0-based index of the current waypoint (`total` once finished). */
  currentIndex: number;
  total: number;
  currentTitle: string;
  /** The current waypoint's measure, when it has one. */
  currentMetric: V2ProgressRouteMetric | null;
  /** The Chart's current One Move, when it has one. */
  oneMoveTitle?: string | null;
  reachedCount: number;
  isFinished: boolean;
  waypoints: V2ProgressRouteWaypoint[];
}

export interface V2ProgressInsight {
  headline: string;
  support: string;
}

export interface V2ProgressReflection {
  id: string;
  word: string;
  occurredAt: string;
}

/** Whole-history totals for one Anchor. */
export interface V2ProgressLifetimeStats {
  practices: number;
  activeDays: number;
  totalSeconds: number;
  firstPracticeAt: string | null;
  /** Reached waypoints on the live Chart; 0 with no Chart. */
  waypointsReached: number;
}

export interface V2ProgressRecentReflection {
  text: string;
  occurredAt: string;
}

export interface V2ProgressModel {
  anchorId: string;
  anchor?: import('@/types').Anchor;
  intention: string;
  category?: string | null;
  threadStrength: number | null;
  unmeasured: boolean;
  qualitativeLabel: string;
  highestEvolutionStage: 'Unestablished' | 'Forming' | 'Building' | 'Established' | 'Integrated' | 'Reinforced';
  practiceSummary: V2PracticeModeBreakdown;
  waypointsReachedCount: number;
  events: V2ThreadEventItem[];
  /** The fields below are optional so older callers and fixtures keep compiling. */
  week?: V2ProgressWeek;
  streak?: V2ProgressStreak;
  rhythm?: V2ProgressRhythm;
  /** Day cells per range: Week 7, Month 35 (5 weeks), Year 182 (26 weeks), Monday-first. */
  heatmap?: Record<V2ProgressRange, V2ProgressDayCell[]>;
  /** Persisted Consistency over the last 30 days; absent with fewer than two points. */
  spark?: V2ProgressSparkPoint[];
  /** Absent when this Anchor has no live Chart. */
  route?: V2ProgressRouteSummary | null;
  reflections?: V2ProgressReflection[];
  /** ISO timestamp (or local YYYY-MM-DD) of the last completed practice, if known. */
  lastPracticedAt?: string | null;
  lifetimeSessions?: number;
  lifetime?: V2ProgressLifetimeStats;
  recentReflection?: V2ProgressRecentReflection | null;
  /** A deterministic read of this week. Absent while the Anchor is unmeasured. */
  insight?: V2ProgressInsight | null;
  /** The real date Full Strength was first reached on this device (ISO). Null when no record exists. */
  fullStrengthAt?: string | null;
}

/** Account-level and Chart inputs the adapter cannot get from the Anchor alone. */
export interface V2ProgressExtras {
  weekHistory?: boolean[];
  weekHistoryKey?: string | null;
  lastGraceDayUsedAt?: string | null;
  /** The Anchor's live Chart, if any. */
  course?: import('@/types/chart').CourseDetail | null;
  /** Store-level last practice date (YYYY-MM-DD); a fallback when no session carries a date. */
  lastPrimedAt?: string | null;
  reflections?: V2ProgressReflection[];
  lifetimeSessions?: number;
  now?: Date;
  /** This Anchor's local celebration dates (read only). Absent means no dates are known. */
  celebrations?: ProgressCelebrationDates | null;
}

/**
 * The dates the device recorded for this Anchor's stages and Full Strength. Structurally the same
 * as the celebration records store; declared here so the adapter stays pure and imports no store.
 */
export interface ProgressCelebrationDates {
  stages?: Partial<Record<'building' | 'established' | 'integrated' | 'reinforced', string>>;
  fullStrengthAt?: string;
}

/** One row in the Progress anchor switcher. */
export interface V2ProgressAnchorOption {
  id: string;
  category: string | null;
  intention: string;
  /** The Anchor itself, so the switcher can draw its artwork beside its name. */
  anchor: import('@/types').Anchor;
}
