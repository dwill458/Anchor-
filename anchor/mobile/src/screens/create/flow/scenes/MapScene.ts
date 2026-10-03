import { colors } from '@/theme/colors';
import { SANS, W, distinctSegments, type MapLayout, type Pt } from '../geometry';
import { clamp, ease, easeOut, lerp, segmentU, smooth } from '../motion';
import type { Painter } from '../painter';
import { CAPTION_Y, drawCaption } from './DistillScene';
import type { Palette, SceneContext } from './sceneTypes';
import { RAW_STROKE_WIDTH } from './sceneTypes';

/** Segments shorter than this are jitter nubs, not strokes the person would see. */
const MIN_SEGMENT_PX = 0.5;

/**
 * For each point, whether it is the first to land in its cell. A repeated cell (common on the
 * small tiers) gets no second dot, number or tint — only the first landing is drawn.
 */
export function firstInCell(map: MapLayout): boolean[] {
  const seen = new Set<number>();
  return map.points.map((point) => {
    if (seen.has(point.cell)) return false;
    seen.add(point.cell);
    return true;
  });
}

/** The tier grid: N+1 lines each way, growing out from the centre. */
export function drawGrid(p: Painter, pal: Palette, map: MapLayout, grow: number, alpha: number): void {
  if (grow <= 0 || alpha <= 0) return;
  const { frame, step, size } = map;
  const cx = frame.x + frame.span / 2;
  const cy = frame.y + frame.span / 2;
  const half = (frame.span / 2) * grow;

  for (let k = 0; k <= size; k += 1) {
    const stroke = { color: pal.fg, width: 0.8, alpha: (k === 0 || k === size ? 0.38 : 0.2) * alpha };
    const x = frame.x + k * step;
    const y = frame.y + k * step;
    p.line(x, cy - half, x, cy + half, stroke);
    p.line(cx - half, y, cx + half, y, stroke);
  }
}

/** The cell number sits in the top-left of its cell. */
export function drawCellNumber(
  p: Painter,
  pal: Palette,
  map: MapLayout,
  col: number,
  row: number,
  value: number,
  alpha: number
): void {
  const origin = map.cellOrigin(col, row);
  p.text(String(value), origin.x + 7, origin.y + 16, {
    font: SANS(10, 500),
    color: pal.fg,
    alpha: 0.6 * alpha,
  });
}

/** The ritual line under the grid: the whole lesson of this beat. */
export const MAP_RITUAL_CAPTION = 'Letters become numbers. Numbers become the path.';
/** The field line sits just above it. */
const FIELD_CAPTION_Y = CAPTION_Y - 26;

/**
 * The two captions of the Map beat: the field the intention takes shape on (one line, by function)
 * and the ritual line. `tt` is seconds into the beat; both are gone before Forget begins.
 */
function drawMapCaptions(p: Painter, pal: Palette, ctx: SceneContext, tt: number, duration: number): void {
  const out = 1 - smooth(duration - 0.4, duration - 0.05, tt);
  if (ctx.fieldLine) {
    const a = ctx.reduceMotion ? 1 : smooth(0.15, 0.65, tt);
    if (a * out > 0.003) {
      p.text(ctx.fieldLine, W / 2, FIELD_CAPTION_Y, {
        font: SANS(14),
        color: pal.fg,
        alpha: 0.78 * a * out,
        align: 'center',
      });
    }
  }
  drawCaption(p, pal, MAP_RITUAL_CAPTION, (ctx.reduceMotion ? 1 : smooth(0.8, 1.4, tt)) * out);
}

/**
 * Beat 3 — letter -> number -> cell, on the tier's own grid (3x3 .. 7x7, never assumed 6x6).
 * The number shown is the one the app actually used for that letter on that tier.
 */
export function drawMap(p: Painter, pal: Palette, ctx: SceneContext, t: number): void {
  const map = ctx.map;
  if (!map) return;
  const { layout, timeline: tl } = ctx;
  const n = map.points.length;
  if (n === 0) return;

  const start = tl.start.map;
  const duration = tl.map;
  const first = firstInCell(map);

  if (ctx.reduceMotion) {
    // Crossfade straight to the finished map: grid, landed dots, numbers and the whole path.
    const a = smooth(0, 1, segmentU(t, start, start + Math.min(duration, 0.4)));
    drawGrid(p, pal, map, 1, a);
    drawMapCaptions(p, pal, ctx, t - start, duration);
    p.segments(
      distinctSegments(map.points).filter(([s, e]) => Math.hypot(e.x - s.x, e.y - s.y) > MIN_SEGMENT_PX),
      { color: pal.fg, width: RAW_STROKE_WIDTH, alpha: 0.95 * a }
    );
    map.points.forEach((pt, i) => {
      if (!first[i]) return;
      p.circle(pt.x, pt.y, 3.4, { fill: { color: pal.fg, alpha: a } });
      drawCellNumber(p, pal, map, pt.col, pt.row, pt.number, a);
      p.text(pt.letter, pt.x + 9, pt.y - 8, { font: SANS(12, 600), color: pal.fg, alpha: 0.85 * a });
    });
    return;
  }

  const tt = t - start;
  const intro = Math.min(0.6, duration * 0.12);
  const slot = (duration - intro) / n;
  const V = (i: number) => (tt - intro - i * slot) / slot;

  drawGrid(p, pal, map, ease(clamp(tt / intro)), 1);
  drawMapCaptions(p, pal, ctx, tt, duration);

  // Cell tints: 11% while the letter lands, settling to 5%.
  map.points.forEach((pt, i) => {
    const v = V(i);
    if (v <= 0 || !first[i]) return;
    const origin = map.cellOrigin(pt.col, pt.row);
    p.fillRect(origin.x + 1, origin.y + 1, map.step - 2, map.step - 2, {
      color: pal.fg,
      alpha: v < 1 ? 0.11 * smooth(0.1, 0.4, v) : 0.05,
    });
  });

  // The path draws progressively, one real (jittered) segment at a time.
  const drawn: Array<[Pt, Pt]> = [];
  for (let i = 1; i < n; i += 1) {
    const sp = smooth(0, 1, clamp((V(i) - 0.5) / 0.45));
    if (sp <= 0) break;
    const a = map.points[i - 1];
    const b = map.points[i];
    if (Math.hypot(b.x - a.x, b.y - a.y) <= MIN_SEGMENT_PX) continue;
    drawn.push([a, { x: lerp(a.x, b.x, sp), y: lerp(a.y, b.y, sp) }]);
  }
  p.segments(drawn, { color: pal.fg, width: RAW_STROKE_WIDTH, alpha: 0.95 });

  map.points.forEach((pt, i) => {
    const v = V(i);
    const row = layout.uniq[i];
    if (!row) return;

    // The distilled letter pulses as it is mapped, then rests.
    let alpha = 0.92;
    let pulse = 1;
    if (v >= 1) alpha = 0.4;
    else if (v > 0) {
      alpha = 1;
      pulse = 1 + 0.16 * Math.sin(Math.PI * clamp(v / 0.5));
    }
    p.text(row.L, row.rx, row.ry + 9 * pulse, {
      font: SANS(26 * pulse, 500),
      color: pal.fg,
      alpha,
      align: 'center',
    });

    if (v > 0 && v < 1) {
      // Its mapped number floats beside it, and a thin curve carries the letter to its cell.
      p.text(String(pt.number), row.rx + 14, row.ry - 10, {
        font: SANS(11, 500),
        color: pal.fg,
        alpha: 0.9 * smooth(0.05, 0.25, v) * (1 - smooth(0.75, 1, v)),
      });
      const grow = smooth(0.12, 0.5, v);
      const fade = 1 - smooth(0.8, 1, v);
      const from = { x: row.rx, y: row.ry + 16 };
      p.quadCurve(from, { x: row.rx, y: (row.ry + pt.y) / 2 }, { x: pt.x, y: pt.y }, grow, {
        color: pal.fg,
        width: 1,
        alpha: 0.45 * fade,
      });
    }

    if (v > 0 && first[i]) {
      const land = smooth(0.38, 0.55, v);
      drawCellNumber(p, pal, map, pt.col, pt.row, pt.number, smooth(0.2, 0.45, v));
      p.circle(pt.x, pt.y, 3.4 * land, { fill: { color: pal.fg } });

      // The one gold in this beat: a single ring as the dot lands.
      const ring = clamp((v - 0.4) / 0.35);
      if (ring > 0 && ring < 1) {
        p.circle(pt.x, pt.y, 4 + 14 * easeOut(ring), {
          stroke: { color: colors.creation.gold, width: 1.3, alpha: 0.7 * (1 - ring) },
        });
      }
      p.text(pt.letter, pt.x + 9, pt.y - 8, { font: SANS(12, 600), color: pal.fg, alpha: 0.85 * land });
    }
  });
}
