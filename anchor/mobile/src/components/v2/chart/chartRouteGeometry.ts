import type { ImageSourcePropType } from 'react-native';

/**
 * One route geometry for every Chart.
 *
 * The trail is traced from the Chart landscape illustration in normalized
 * image coordinates (0–1 on each axis). Category artwork must be painted
 * around this same trail so a single path/waypoint algorithm serves every
 * category; the environment changes, the route does not.
 */

export type ChartArt = {
  source: ImageSourcePropType;
  /** Natural pixel size; only the ratio matters for layout. */
  width: number;
  height: number;
  /** Neutral art takes a restrained category wash; bespoke category packs do not. */
  tintable: boolean;
};

/**
 * Category environments. Each is an editorial, engraved survey drawing painted
 * around the same trail (the art supplies terrain; the app supplies the route),
 * graded to one ink palette with the ground at matched exposure so the route
 * overlay reads identically on every pack. Source prompts and the grading pass
 * are documented in docs/chart/CHART_ILLUSTRATION_PACKS.md.
 */
const pack = (source: ImageSourcePropType): ChartArt => ({ source, width: 1200, height: 1600, tintable: false });

/* eslint-disable @typescript-eslint/no-var-requires */
export const CHART_PACKS = {
  /** Expansive terrain: a mountain valley toward a distant horizon. */
  valley: pack(require('../../../assets/chart/chart-landscape-valley.jpg')),
  /** A road across worked land toward a distant city. */
  city: pack(require('../../../assets/chart/chart-landscape-city.jpg')),
  /** Botanical terrain: large natural forms, orchards, a garden clearing. */
  botanical: pack(require('../../../assets/chart/chart-landscape-botanical.jpg')),
  /** Clifftops and an open sea horizon, ending at a headland light. */
  coast: pack(require('../../../assets/chart/chart-landscape-coast.jpg')),
  /** Sculptural, wind-carved stone; the trail ends at an arch. */
  canyon: pack(require('../../../assets/chart/chart-landscape-canyon.jpg')),
} as const;
/* eslint-enable @typescript-eslint/no-var-requires */

export type ChartPackKey = keyof typeof CHART_PACKS;

/** Category → environment. Every pack shares the trail, so any mapping is safe. */
export const CHART_CATEGORY_PACK: Record<string, ChartPackKey> = {
  desire: 'valley',
  adventure: 'valley',
  custom: 'valley',
  career: 'city',
  abundance: 'city',
  learning: 'city',
  health: 'botanical',
  family: 'botanical',
  relationships: 'coast',
  spirituality: 'coast',
  creativity: 'canyon',
  focus: 'canyon',
};

export const CHART_LANDSCAPES: Record<string, ChartArt> = Object.fromEntries(
  Object.entries(CHART_CATEGORY_PACK).map(([category, key]) => [category, CHART_PACKS[key]])
);

export function chartArtFor(category?: string | null): ChartArt {
  const key = category?.trim().toLowerCase() ?? '';
  return CHART_LANDSCAPES[key] ?? CHART_PACKS.valley;
}

/** A compact portal crop centered on the actual current waypoint. */
export function chartWindowAroundRoutePoint(fraction: number, width: number, height: number): ChartWindow {
  const imageHeight = (width * CHART_PACKS.valley.height) / CHART_PACKS.valley.width;
  const span = Math.min(1, Math.max(0.12, height / imageHeight));
  const center = pointAt(fraction, CHART_PACKS.valley).y;
  const top = Math.max(0, Math.min(1 - span, center - span / 2));
  return { top, bottom: top + span };
}

export type RoutePoint = { x: number; y: number };

/** The trail, START (lower left) → DESTINATION clearing (upper right). */
export const CHART_ROUTE_CONTROL_POINTS: readonly RoutePoint[] = [
  { x: 0.1, y: 0.925 },
  { x: 0.18, y: 0.885 },
  { x: 0.26, y: 0.855 },
  { x: 0.33, y: 0.83 },
  { x: 0.39, y: 0.805 },
  { x: 0.43, y: 0.775 },
  { x: 0.43, y: 0.745 },
  { x: 0.39, y: 0.725 },
  { x: 0.365, y: 0.712 },
  { x: 0.383, y: 0.703 },
  { x: 0.42, y: 0.69 },
  { x: 0.47, y: 0.677 },
  { x: 0.53, y: 0.664 },
  { x: 0.596, y: 0.656 },
  { x: 0.64, y: 0.647 },
  { x: 0.68, y: 0.637 },
  { x: 0.705, y: 0.627 },
  { x: 0.717, y: 0.615 },
  { x: 0.7, y: 0.603 },
  { x: 0.65, y: 0.595 },
  { x: 0.605, y: 0.588 },
  { x: 0.6, y: 0.578 },
  { x: 0.64, y: 0.57 },
  { x: 0.7, y: 0.562 },
  { x: 0.73, y: 0.554 },
  { x: 0.7, y: 0.545 },
  { x: 0.665, y: 0.537 },
  { x: 0.662, y: 0.529 },
  { x: 0.685, y: 0.522 },
  { x: 0.713, y: 0.514 },
  { x: 0.73, y: 0.497 },
];

/** Vertical band of the art each surface shows, as fractions of image height. */
export const CHART_WINDOWS = {
  /** Empty state and generation: most of the scene, sky for copy. */
  full: { top: 0.0, bottom: 1.0 },
  /** Active Chart hero: the whole trail, a little sky above the clearing. */
  hero: { top: 0.2, bottom: 0.965 },
  /** Home snapshot: a compact view across the waypoints toward the destination. */
  home: { top: 0.49, bottom: 0.82 },
  /** Waypoint detail: a tighter crop into the same route. */
  strip: { top: 0.49, bottom: 0.77 },
} as const;

export type ChartWindow = { top: number; bottom: number };

export type ChartFrame = {
  /** Rendered width in points. */
  width: number;
  /** Height of the whole image at this width. */
  imageHeight: number;
  window: ChartWindow;
  /** Visible height (the window) in points. */
  height: number;
};

export function chartFrame(width: number, art: ChartArt, window: ChartWindow): ChartFrame {
  const imageHeight = (width * art.height) / art.width;
  return { width, imageHeight, window, height: (window.bottom - window.top) * imageHeight };
}

export function toFramePoint(point: RoutePoint, frame: ChartFrame): RoutePoint {
  return { x: point.x * frame.width, y: (point.y - frame.window.top) * frame.imageHeight };
}

function catmullRom(p0: RoutePoint, p1: RoutePoint, p2: RoutePoint, p3: RoutePoint, t: number): RoutePoint {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

type Sampled = { points: RoutePoint[]; cumulative: number[]; length: number };

const SAMPLES_PER_SEGMENT = 8;

/**
 * Smooth, arc-length-parameterized samples of the trail. Lengths are measured
 * in image pixels (aspect-correct) so spacing is even on screen.
 */
function sample(controls: readonly RoutePoint[], aspect: number): Sampled {
  const points: RoutePoint[] = [];
  for (let i = 0; i < controls.length - 1; i += 1) {
    const p0 = controls[Math.max(0, i - 1)];
    const p1 = controls[i];
    const p2 = controls[i + 1];
    const p3 = controls[Math.min(controls.length - 1, i + 2)];
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s += 1) points.push(catmullRom(p0, p1, p2, p3, s / SAMPLES_PER_SEGMENT));
  }
  points.push(controls[controls.length - 1]);
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    const dx = points[i].x - points[i - 1].x;
    const dy = (points[i].y - points[i - 1].y) * aspect;
    cumulative.push(cumulative[i - 1] + Math.hypot(dx, dy));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

const cache = new Map<number, Sampled>();

function sampledFor(art: Pick<ChartArt, 'width' | 'height'>): Sampled {
  const aspect = art.height / art.width;
  const cached = cache.get(aspect);
  if (cached) return cached;
  const next = sample(CHART_ROUTE_CONTROL_POINTS, aspect);
  cache.set(aspect, next);
  return next;
}

/** Point at arc-length fraction t (0 = START, 1 = DESTINATION), normalized. */
export function pointAt(t: number, art: Pick<ChartArt, 'width' | 'height'>): RoutePoint {
  const { points, cumulative, length } = sampledFor(art);
  const target = Math.max(0, Math.min(1, t)) * length;
  let index = 1;
  while (index < cumulative.length - 1 && cumulative[index] < target) index += 1;
  const span = cumulative[index] - cumulative[index - 1] || 1;
  const local = (target - cumulative[index - 1]) / span;
  const a = points[index - 1];
  const b = points[index];
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}

/**
 * Route positions for N waypoints. START sits at t=0 and the last waypoint
 * (the destination) at t=1; the rest are evenly spaced by arc length.
 */
export function waypointFractions(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => (index + 1) / count);
}

/** SVG path data for the trail between two fractions, in frame coordinates. */
export function routePathData(frame: ChartFrame, art: Pick<ChartArt, 'width' | 'height'>, from = 0, to = 1): string {
  const { points, cumulative, length } = sampledFor(art);
  const start = Math.max(0, Math.min(1, from)) * length;
  const end = Math.max(0, Math.min(1, to)) * length;
  if (end <= start) return '';
  const inside = points.filter((_, index) => cumulative[index] > start && cumulative[index] < end);
  const all = [pointAt(from, art), ...inside, pointAt(to, art)].map((point) => toFramePoint(point, frame));
  return all.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

/** Rendered length (points) of the trail between two fractions. */
export function routeLength(frame: ChartFrame, art: Pick<ChartArt, 'width' | 'height'>, from = 0, to = 1): number {
  const { length } = sampledFor(art);
  // Sampled length is in "width units"; scale to the rendered width.
  return Math.max(0, Math.min(1, to) - Math.max(0, from)) * length * frame.width;
}
