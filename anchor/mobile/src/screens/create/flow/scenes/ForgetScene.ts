import { HERO, PAD, SANS, SERIF, W, proofLineText } from '../geometry';
import { clamp, ease, lerp, segmentU, smooth } from '../motion';
import type { Painter } from '../painter';
import { drawAnchorLine } from './anchorLine';
import { drawCellNumber, drawGrid, firstInCell } from './MapScene';
import type { Palette, SceneContext } from './sceneTypes';
import { RAW_STROKE_WIDTH } from './sceneTypes';

const PROOF_Y = 584;

export function drawProofLine(p: Painter, pal: Palette, ctx: SceneContext, alpha: number): void {
  if (alpha <= 0.003) return;
  if (!ctx.isDrawn && ctx.letterCount <= 0) return;
  p.text(proofLineText(ctx.letterCount, ctx.isDrawn), W / 2, PROOF_Y, {
    font: SERIF(20),
    color: pal.fg,
    alpha: 0.92 * alpha,
    align: 'center',
  });
}

/**
 * Beat 4 — the technology of forgetting. Letters, numbers and the grid fall away and only the
 * polyline remains, travelling from its grid position to the hero. Everything shown is the real
 * geometry; nothing is added.
 */
export function drawForget(p: Painter, pal: Palette, ctx: SceneContext, t: number): void {
  const { map, hero, timeline: tl } = ctx;
  if (!map) return;
  const u = segmentU(t, tl.start.forget, tl.start.forget + tl.forget);
  const n = map.points.length;
  const first = firstInCell(map);

  if (ctx.reduceMotion) {
    // Crossfade: the finished map out, the settled line in.
    const out = 1 - smooth(0, 0.5, u);
    drawGrid(p, pal, map, 1, out);
    p.polyline(map.points.map((pt) => ({ x: pt.x, y: pt.y })), {
      color: pal.fg,
      width: RAW_STROKE_WIDTH,
      alpha: 0.95 * out,
    });
    drawAnchorLine(p, hero, pal.fg, HERO.x, HERO.y, 1, RAW_STROKE_WIDTH, smooth(0.5, 1, u));
    drawProofLine(p, pal, ctx, smooth(0.5, 1, u));
    return;
  }

  // The line travels from the grid to the hero over the last 75%.
  const e = ease(clamp((u - 0.25) / 0.75));
  const positions = map.points.map((pt, i) => ({
    x: lerp(pt.x, HERO.x + (hero.vertices[i]?.x ?? 0), e),
    y: lerp(pt.y, HERO.y + (hero.vertices[i]?.y ?? 0), e),
  }));

  // 0–25%: the distilled letters fade.
  const letterAlpha = 1 - smooth(0, 0.25, u);
  ctx.layout.uniq.forEach((row) => {
    p.text(row.L, row.rx, row.ry + 9, { font: SANS(26, 500), color: pal.fg, alpha: letterAlpha, align: 'center' });
  });

  // 25–60%: the grid lines fade. 10–40%: cell numbers fade.
  drawGrid(p, pal, map, 1, 1 - smooth(0.25, 0.6, u));
  const numberAlpha = 1 - smooth(0.1, 0.4, u);
  if (numberAlpha > 0) {
    map.points.forEach((pt, i) => {
      if (!first[i]) return;
      drawCellNumber(p, pal, map, pt.col, pt.row, pt.number, numberAlpha);
      p.text(pt.letter, positions[i].x + 9, positions[i].y - 8, {
        font: SANS(12, 600),
        color: pal.fg,
        alpha: 0.85 * numberAlpha,
      });
    });
  }

  p.polyline(positions, { color: pal.fg, width: RAW_STROKE_WIDTH, alpha: 0.95 });

  // 55–85%: the points disappear.
  const pointAlpha = 1 - smooth(0.55, 0.85, u);
  if (pointAlpha > 0.003) {
    positions.forEach((pos, i) => {
      if (!first[i]) return;
      p.circle(pos.x, pos.y, 3.4, { fill: { color: pal.fg, alpha: pointAlpha } });
    });
  }

  // Last 25%: the proof line.
  drawProofLine(p, pal, ctx, smooth(0.75, 0.95, u));
}

/**
 * Draw path's Forget-settle: the pad outline fades, the raw hand strokes travel to the hero by
 * the same affine used for the fit, the cleaned vertices appear, then the raw line gives way to
 * the cleaned one.
 */
export function drawForgetDrawn(p: Painter, pal: Palette, ctx: SceneContext, t: number): void {
  const drawn = ctx.drawn;
  if (!drawn) return;
  const { timeline: tl, hero } = ctx;
  const u = segmentU(t, tl.start.forget, tl.start.forget + tl.forget);

  if (ctx.reduceMotion) {
    const out = 1 - smooth(0, 0.5, u);
    drawn.raw.forEach((stroke) => p.smoothStroke(stroke, { color: pal.fg, width: 3, alpha: out }));
    drawAnchorLine(p, hero, pal.fg, HERO.x, HERO.y, 1, RAW_STROKE_WIDTH, smooth(0.5, 1, u));
    drawProofLine(p, pal, ctx, smooth(0.5, 1, u));
    return;
  }

  const e = ease(clamp((u - 0.1) / 0.65));
  const padAlpha = 1 - smooth(0, 0.35, u);
  if (padAlpha > 0.003) {
    p.strokeRRect(PAD.x, PAD.y, PAD.w, PAD.h, 18, { color: pal.fg, width: 1, alpha: 0.3 * padAlpha, dash: [5, 7] });
  }

  const rawAlpha = 1 - smooth(0.62, 0.95, u);
  drawn.raw.forEach((stroke) => {
    const moved = stroke.map((pt) => {
      const target = drawn.rawToHero(pt);
      return { x: lerp(pt.x, HERO.x + target.x, e), y: lerp(pt.y, HERO.y + target.y, e) };
    });
    p.smoothStroke(moved, { color: pal.fg, width: lerp(3, RAW_STROKE_WIDTH, e), alpha: rawAlpha });
  });

  // Cleaned vertices show at 45–70%, gone by the end.
  const vertexAlpha = smooth(0.45, 0.7, u) * (1 - smooth(0.8, 1, u));
  if (vertexAlpha > 0.003) {
    drawn.vertices.forEach((v) => {
      p.circle(HERO.x + v.x, HERO.y + v.y, 3.2, { fill: { color: pal.fg, alpha: vertexAlpha } });
    });
  }

  drawAnchorLine(p, hero, pal.fg, HERO.x, HERO.y, 1, RAW_STROKE_WIDTH, smooth(0.62, 0.95, u));
  drawProofLine(p, pal, ctx, smooth(0.75, 0.95, u));
}
