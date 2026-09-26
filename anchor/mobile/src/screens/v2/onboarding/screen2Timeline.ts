/**
 * Screen 2 choreography: thought → written intention → reduction → fragments → visual Anchor.
 *
 * Pure data and planning only (no React), so the phase order can be tested. Everything is in
 * ms on the screen's single clock.
 *
 *   0      notebook arrives, page blank
 *   1200   the pen writes line 1, lifts, writes line 2 (the nib leads every stroke)
 *   5900   the finished intention holds
 *   6500   the writing loosens and breaks into its own strokes, which leave the page one by one
 *   7750   those strokes converge on the mark; each guide stroke starts where its pieces land
 *   ~9500  the textured mark has been painted in along the guides; the gold centre locks in
 *   10400  the finished Anchor holds quietly, then the copy and CTA settle
 */
import { HANDWRITING_LINES, type HandwritingLine } from "./handwritingStrokes";

export type Window = readonly [number, number];
export type Point = { x: number; y: number };

export const T = {
  notebookIn: [0, 1000] as Window,
  /** Handwriting, one window per line. The pen lifts and travels between them. */
  lines: [
    [1200, 3500],
    [3700, 5900],
  ] as readonly Window[],
  nib: [1100, 6100] as Window,
  // 5900 → 6500: the complete intention holds.
  /** Written strokes leave the page, staggered left to right across this span. */
  breakStart: 6500,
  breakSpread: 1000,
  flight: 1350,
  paperTear: [6500, 7900] as Window,
  notebookDim: [6900, 8300] as Window,
  /** Guide strokes of the mark, in drawing order. Each begins as its fragments arrive. */
  guides: [
    [7750, 8400], // axis
    [7920, 8550], // ring
    [8080, 8700], // top bar
    [8250, 8950], // diagonals
    [8420, 9100], // lower V
    [8580, 9200], // lower bar
  ] as readonly Window[],
  /** The textured mark is painted in along each guide, this long behind it. */
  brushLag: 220,
  nodes: [8800, 9200] as Window,
  /** The brush has covered the strokes; the rest of the mark's ragged edge fills in. */
  markComplete: [9450, 9750] as Window,
  guidesOut: [9500, 9950] as Window,
  build: [7700, 9500] as Window,
  diamondIn: [9400, 9800] as Window,
  settleUp: [9750, 10050] as Window,
  settleDown: [10050, 10400] as Window,
  fragmentsOut: [8800, 9250] as Window,
  residualRest: [9400, 10200] as Window,
  // 10400 → 10800: quiet hold on the finished Anchor.
  gradientIn: [9300, 10800] as Window,
  // 10400 → 10450: Anchor settles into its final position.
  // 10450: THEN "ANCHOR" fades/slides into place beneath it.
  // 10850: THEN "VISUAL GOAL SETTING" appears beneath ANCHOR.
  // 11400: THEN final composition (headline, support, verbs, CTA) settles.
  brandWordmark: [10450, 10850] as Window,
  brandSub: [10850, 11200] as Window,
  headline: [11400, 11850] as Window,
  support: [11550, 12000] as Window,
  verbs: [11700, 12100] as Window,
  cta: [11850, 12300] as Window,
  end: 12400,
} as const;
export const CTA_READY_MS = 12000;

/** Reduce Motion: controlled crossfades only — notebook with its intention, hold, dissolve to the mark, copy. */
export const RM = {
  notebookIn: [0, 360] as Window,
  dissolve: [1300, 1850] as Window,
  gradientIn: [1450, 1950] as Window,
  /** Brand identity crossfades in sequentially just ahead of the rest of the copy. */
  brandWordmark: [1700, 1950] as Window,
  brandSub: [1850, 2050] as Window,
  copy: [2000, 2350] as Window,
  cta: [2100, 2450] as Window,
  end: 2500,
} as const;
export const RM_CTA_READY_MS = 2200;

// --- Notebook page geometry (notebook.png pixels, 1200 × 794) -------------------------------
export const NB_W = 1200;
export const NB_H = 794;
/** Top-left page corner and the page's ruled-line direction (≈ -13.4°). */
export const PAGE_ORIGIN = { x: 86, y: 168 } as const;
export const PAGE_ANGLE_DEG = -13.4;
const PAGE_RAD = (PAGE_ANGLE_DEG * Math.PI) / 180;
export const PAGE_E1 = { x: Math.cos(PAGE_RAD), y: Math.sin(PAGE_RAD) } as const;
export const PAGE_E2 = { x: -PAGE_E1.y, y: PAGE_E1.x } as const;
/**
 * Where each handwritten line starts on the page (page pixels). Line 2 ends where the pen in
 * the notebook artwork rests, so the writing finishes at the pen's tip.
 */
export const LINE_ORIGINS = [
  { x: 84, baseline: 178 },
  { x: 100, baseline: 282 },
] as const;
/** One em of handwriting in page pixels: line 2's written width lands on the pen tip (x ≈ 544). */
export const EM_PAGE_PX = 444 / HANDWRITING_LINES[1].width;

// --- Brand mark geometry (anchor-mark-*.png pixels, 720 × 801) ------------------------------
export const MARK_W = 720;
export const MARK_H = 801;
export const MARK = {
  ringTop: { x: 355, y: 28 },
  topLeft: { x: 78, y: 227 },
  topRight: { x: 628, y: 227 },
  center: { x: 355, y: 435 },
  lowerLeft: { x: 110, y: 639 },
  lowerRight: { x: 602, y: 640 },
  base: { x: 352, y: 795 },
} as const;
export const RING = { cx: 355, cy: 70, r: 52 } as const;
/**
 * The mark's structure as polylines, one entry per guide window in T.guides. The ring is
 * sampled as a polyline so fragments can target points along it like any other stroke.
 */
const ringPoints = (): Point[] =>
  Array.from({ length: 33 }, (_, i) => {
    // Starts at the bottom of the ring, where the axis meets it, and runs clockwise.
    const angle = Math.PI / 2 + (i / 32) * Math.PI * 2;
    return { x: RING.cx + RING.r * Math.cos(angle), y: RING.cy + RING.r * Math.sin(angle) };
  });
export const MARK_STROKES: readonly (readonly Point[])[][] = [
  [[{ x: 355, y: 122 }, { x: 355, y: 792 }]],
  [ringPoints()],
  [[MARK.topLeft, MARK.topRight]],
  [
    [MARK.topLeft, MARK.lowerRight],
    [MARK.topRight, MARK.lowerLeft],
  ],
  [[MARK.lowerLeft, MARK.base, MARK.lowerRight]],
  [[MARK.lowerLeft, MARK.lowerRight]],
];

export function polylineToSvg(points: readonly Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

export function polylineLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}

export function pointAlong(points: readonly Point[], fraction: number): Point {
  const target = polylineLength(points) * Math.min(1, Math.max(0, fraction));
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + step >= target && step > 0) {
      const f = (target - walked) / step;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
    walked += step;
  }
  return points[points.length - 1];
}

// --- Ink planning -------------------------------------------------------------------------

/** Target length of one written fragment, in ems. Roughly a letter. */
const CHUNK_EM = 0.85;
/** A remainder shorter than this joins the previous piece instead of flying alone. */
const MIN_CHUNK_EM = 0.3;
/** Time the pen spends lifted between strokes. */
const PEN_LIFT_MS = 60;

export type InkStroke = {
  line: number;
  /** Page-pixel polyline. */
  points: Point[];
  length: number;
  write: Window;
};

export type InkChunk = {
  stroke: number;
  /** Page-pixel polyline, sharing its first point with the previous chunk's last. */
  points: Point[];
  /** Where this piece starts and how long it is, measured along its stroke. */
  offset: number;
  length: number;
  /** Leaves the page on this window. */
  flight: Window;
  /** Index into MARK_STROKES: the part of the mark this piece becomes. */
  target: number;
  /** 0–1 position along that part where it lands. */
  landing: number;
  /** Deterministic per-piece variation, -1…1. */
  jitter: number;
};

export type InkPlan = { strokes: InkStroke[]; chunks: InkChunk[] };

const hash = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

function toPagePoints(line: HandwritingLine, lineIndex: number, flat: readonly number[]): Point[] {
  const origin = LINE_ORIGINS[lineIndex];
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: origin.x + flat[i] * EM_PAGE_PX, y: origin.baseline + flat[i + 1] * EM_PAGE_PX });
  }
  return points;
}

function splitStroke(points: Point[], chunkLength: number, minLength: number): { points: Point[]; offset: number; length: number }[] {
  const total = polylineLength(points);
  const count = Math.max(1, Math.round(total / chunkLength));
  const bounds: number[] = [];
  for (let i = 0; i <= count; i++) bounds.push((total * i) / count);
  if (count > 1 && total - bounds[count - 1] < minLength) bounds.splice(count - 1, 1);

  const pieces: { points: Point[]; offset: number; length: number }[] = [];
  for (let c = 0; c < bounds.length - 1; c++) {
    const from = bounds[c];
    const to = bounds[c + 1];
    const piece: Point[] = [pointAlong(points, from / total)];
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      walked += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (walked > from && walked < to) piece.push(points[i]);
    }
    piece.push(pointAlong(points, to / total));
    pieces.push({ points: piece, offset: from, length: to - from });
  }
  return pieces;
}

/**
 * Splits the handwriting into pen strokes (with write windows that share each line's time by
 * length, less the pen lifts) and into letter-sized pieces (with staggered departures, each
 * assigned to the part of the mark it becomes, in the mark's drawing order).
 */
export function planInk(lines: readonly HandwritingLine[] = HANDWRITING_LINES): InkPlan {
  const strokes: InkStroke[] = [];
  lines.forEach((line, lineIndex) => {
    const [start, end] = T.lines[lineIndex];
    const pagePolylines = line.strokes.map((stroke) => toPagePoints(line, lineIndex, stroke.points));
    const lengths = pagePolylines.map(polylineLength);
    const total = lengths.reduce((sum, length) => sum + length, 0);
    const drawTime = end - start - PEN_LIFT_MS * (pagePolylines.length - 1);
    let cursor = start;
    pagePolylines.forEach((points, i) => {
      const duration = (lengths[i] / total) * drawTime;
      strokes.push({ line: lineIndex, points, length: lengths[i], write: [cursor, cursor + duration] });
      cursor += duration + PEN_LIFT_MS;
    });
  });

  const chunkLength = CHUNK_EM * EM_PAGE_PX;
  const minLength = MIN_CHUNK_EM * EM_PAGE_PX;
  const pieces = strokes.flatMap((stroke, strokeIndex) =>
    splitStroke(stroke.points, chunkLength, minLength).map((piece) => ({ ...piece, stroke: strokeIndex })),
  );

  // Departure order: left to right across the page (both lines interleaved), loosened by a
  // little jitter so neighbouring letters don't leave in lockstep.
  const centreX = (points: Point[]) => points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const order = pieces
    .map((piece, index) => ({ index, key: centreX(piece.points) + hash(index) * 40 }))
    .sort((a, b) => a.key - b.key)
    .map(({ index }) => index);
  const rankOf = new Array<number>(pieces.length);
  order.forEach((pieceIndex, rank) => {
    rankOf[pieceIndex] = rank;
  });

  const targets = MARK_STROKES.length;
  const chunks: InkChunk[] = pieces.map((piece, index) => {
    const rank = rankOf[index];
    const departs = T.breakStart + (pieces.length > 1 ? (rank / (pieces.length - 1)) * T.breakSpread : 0);
    // Pieces are handed to the mark's parts in drawing order, so the first to leave feed the
    // first guide stroke, and each part's pieces spread along it.
    const perTarget = pieces.length / targets;
    const target = Math.min(targets - 1, Math.floor(rank / perTarget));
    const withinTarget = (rank - target * perTarget + 0.5) / perTarget;
    return {
      stroke: piece.stroke,
      points: piece.points,
      offset: piece.offset,
      length: piece.length,
      flight: [departs, departs + T.flight],
      target,
      landing: Math.min(0.95, Math.max(0.05, withinTarget)),
      jitter: hash(index + 17),
    };
  });

  return { strokes, chunks };
}
