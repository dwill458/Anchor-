/**
 * Chart map redesign: shared contracts between the logic, map, panel and
 * sequence layers. Types only (plus a few frozen constants). No React.
 *
 * Owners implement against these; nobody changes a type here without the lead.
 * See CHART_REDESIGN_PLAN.md at the repo root.
 */
import type { SharedValue } from 'react-native-reanimated';
import type { MoveSummary } from '@/types/chart';

/* ------------------------------------------------------------------ */
/* Geometry (chartMapGeometry.ts)                                      */
/* ------------------------------------------------------------------ */

/** Map design space. Route coordinates live here; the art is `cover`-fit to it. */
export const MAP_W = 852;
export const MAP_H = 1180;

export type MapPoint = { x: number; y: number };

export type RouteLeg = {
  a: MapPoint;
  c1: MapPoint;
  c2: MapPoint;
  b: MapPoint;
  /** Arc length at the start of this leg. */
  start: number;
  len: number;
};

/**
 * Dense arc-length table of the master route (prototype SAMPLES, ~6 units).
 * Flat typed arrays so worklets can read them without allocating.
 */
export type RouteTable = {
  xs: Float32Array;
  ys: Float32Array;
  arcs: Float32Array;
  count: number;
  total: number;
  legs: RouteLeg[];
  /** SVG path data of the whole route (all legs, one contour) for Skia.Path.MakeFromSVGString. */
  svgPath: string;
};

/** Per-N placement: waypoint k (0-based) sits at arcs[k]; start = 0, summit = table.total. */
export type WaypointPlacement = {
  n: number;
  arcs: number[];
  points: MapPoint[];
  summit: MapPoint;
  start: MapPoint;
  /** Leg i runs from (i === 0 ? 0 : arcs[i-1]) to arcs[i]. */
  legs: Array<{ start: number; end: number }>;
  /** Marker ring radius in map units (30, or 24 when n > 7). */
  markerRadius: number;
};

/** Fog field precomputed once per route (prototype `precompute`): 213 x 295 cells of 4 units. */
export const FOG_COLS = 213;
export const FOG_ROWS = 295;
export const FOG_CELL = 4;
export const FOG_LEAD = 110;
export const FOG_R_IN = 105;
export const FOG_FEATHER = 95;
export const FOG_ARRIVAL_R_IN = 1700;
export const FOG_ARRIVAL_FEATHER = 300;

export type FogField = {
  cols: number;
  rows: number;
  /** Distance to nearest route sample, map units. */
  dist: Float32Array;
  /** Arc of that nearest sample. */
  arc: Float32Array;
  /** Stipple noise N in [0,1]: .5*v2(.12) + .25*v2(.35) + .25*hash. */
  noise: Float32Array;
};

/* ------------------------------------------------------------------ */
/* Progress (chartProgress.ts)                                         */
/* ------------------------------------------------------------------ */

export const PROGRESS_CAP = 0.9;
export const METRIC_WEIGHT = 0.8;
export const MOVES_WEIGHT = 0.2;

/** Minimal progress input derived from ChartWaypointView (server data only). */
export type WaypointProgressInput = {
  id: string;
  completed: boolean;
  /** How this waypoint shows progress. Absent reads as numeric when there is a metric, otherwise moves. */
  mode?: 'numeric' | 'moves' | 'none';
  /** null for moves-only waypoints. */
  metric: { baseline: number; current: number; target: number } | null;
  movesDone: number;
  movesTotal: number;
};

/** Per-waypoint high-water marks, keyed by waypoint id, values in [0,1]. */
export type HighWaterMap = Record<string, number>;

export type WaypointFractionResult = {
  /** Route fraction of this leg to draw, [0, 0.9] or 1 when completed. */
  p: number;
  /** Updated high-water mark to persist (never lower than the input). */
  hw: number;
  raw: number;
};

/* ------------------------------------------------------------------ */
/* Rhythm (chartRhythm.ts)                                             */
/* ------------------------------------------------------------------ */

/** Single constant for the weekly recap slot (local time). 0 = Sunday. Assumption, see report. */
export const CHART_RECAP_SLOT = { weekday: 0, hour: 18, minute: 0 } as const;
export const CHART_IDLE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
export const CHART_MAX_PUSHES_PER_WEEK = 2;
/** Idle nudges are moved into this local window. */
export const CHART_PUSH_WINDOW = { startHour: 9, endHour: 20 } as const;

export type ChartRhythmInput = {
  moves: MoveSummary[];
  plottedAt: string;
  now: Date;
};

export type ChartRhythmState = {
  dayClosed: boolean;
  daysOnCourse: number;
  practicedToday: boolean;
};

export type ChartNotificationKind = 'recap' | 'idle';

export type ChartNotificationPlanInput = {
  anchorId: string;
  now: Date;
  /** ISO of the most recent COMPLETED move on this course (server data), or null. */
  lastMoveAt: string | null;
  /** lastMoveAt value an idle nudge was already scheduled for (once per idle stretch). */
  idleNudgeScheduledFor: string | null;
  movesThisWeek: number;
  practicesThisWeek: number;
  oneMoveTitle: string | null;
  destination: string;
  /** True when the existing Weekly Summary push is on: recap is skipped. */
  weeklySummaryEnabled: boolean;
  notificationsEnabled: boolean;
  permissionGranted: boolean;
  /** Fire dates (ISO) of chart pushes already scheduled/sent, for the weekly cap. */
  alreadyScheduled: Array<{ kind: ChartNotificationKind; fireDate: string }>;
};

export type ChartNotificationPlan = {
  kind: ChartNotificationKind;
  /** `chart-recap:{anchorId}` | `chart-idle:{anchorId}` */
  id: string;
  fireDate: Date;
  title: string;
  body: string;
  /** anchor://v2/chart/{anchorId} */
  deepLink: string;
};

/* ------------------------------------------------------------------ */
/* Map animation state (owned by ChartActiveView, driven by sequences) */
/* ------------------------------------------------------------------ */

export type ChartCamera = {
  /** Map-space centre and scale. Overview = {426, 590, 1}. */
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  s: SharedValue<number>;
};

/**
 * Every animatable value of the map. Created once by `useChartMapAnimState`
 * (map layer), passed to <ChartMap> for rendering and to sequences for driving.
 */
export type ChartMapAnimState = {
  camera: ChartCamera;
  /** Arc length of drawn route (0..table.total). */
  revealArc: SharedValue<number>;
  /** Fog clear 0..1 (0.035 breath on reach, 1 on arrival). */
  fog: SharedValue<number>;
  /** 0..1 opacity of the whole map on open. */
  mapOpacity: SharedValue<number>;
  /** Index of the waypoint the flag stands on (-1 = hidden). */
  flagIndex: SharedValue<number>;
  /** 0..1 flag drop progress (0 = 16 units above, 1 = settled). */
  flagDrop: SharedValue<number>;
  flagOpacity: SharedValue<number>;
  /** 0..1 tip pulse progress (opacity .9*(1-u), r 26+56u). */
  pulse: SharedValue<number>;
  /** Index of marker being stamped (-1 none) and 0..1 stamp progress (scale 1+.28 sin(u*pi)). */
  stampIndex: SharedValue<number>;
  stamp: SharedValue<number>;
  /** 0..1 summit X -> anchor glyph crossfade. */
  glyph: SharedValue<number>;
  /** 0..1 gold centre dot on the glyph. */
  goldDot: SharedValue<number>;
};

export type ChartMarkerRenderState = 'done' | 'current' | 'upcoming';

export type ChartMapMarker = {
  id: string;
  index: number;
  number: number;
  title: string;
  state: ChartMarkerRenderState;
  selected: boolean;
  /** "Waypoint 2: Title, current" */
  accessibilityLabel: string;
};

/* ------------------------------------------------------------------ */
/* Sequences (chartSequence.ts engine, chartMapSequences.ts specs)     */
/* ------------------------------------------------------------------ */

export type SequenceEasing = 'inOut' | 'out' | 'linear';

export type SequenceStep =
  | {
      kind: 'tween';
      /** Start offset ms from sequence start. */
      at: number;
      duration: number;
      easing?: SequenceEasing;
      target: SharedValue<number>;
      to: number;
      /** Optional explicit start value; default = value at step start. */
      from?: number;
    }
  | {
      kind: 'call';
      at: number;
      /** JS-thread side effect (panel state etc). Must be idempotent. */
      run: () => void;
    };

export type SequenceSpec = {
  name: 'open' | 'moveCheck' | 'waypointTap' | 'reach' | 'arrival';
  steps: SequenceStep[];
  /** Called once at the end, after skip or natural completion. */
  onEnd?: () => void;
};

export type SequenceRunner = {
  run(spec: SequenceSpec): Promise<void>;
  /** Resolve every pending tween/timer to its end state, in `at` order. */
  skip(): void;
  /** Cancel without applying end state (unmount). */
  cancel(): void;
  isBusy(): boolean;
};
