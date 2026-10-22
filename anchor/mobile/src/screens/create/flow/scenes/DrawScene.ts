import { PAD, SANS, SERIF, W, wrapText } from '../geometry';
import { smooth } from '../motion';
import type { Painter } from '../painter';
import { drawIntentText } from './DistillScene';
import type { DrawPadState, Palette, SceneContext } from './sceneTypes';

/** Pen width on the pad. */
export const PEN_WIDTH = 3;

/**
 * Draw path (replaces Distill and Map): the big intention fades to a small one, a dashed pad
 * rises in, and the person's strokes show as they draw. No grid, no letters.
 *
 * Undo / Done / Clear are real controls (RN), not painted here, so they can be reached by
 * assistive technology.
 */
export function drawDrawScene(p: Painter, pal: Palette, ctx: SceneContext, pad: DrawPadState): void {
  const u = pad.riseU;
  const a = smooth(0.45, 0.9, u);

  // The big sentence fades out over the first 45% of the rise.
  const big = 1 - smooth(0, 0.45, u);
  if (big > 0.003) drawIntentText(p, pal, ctx, ctx.timeline.handoff, big);

  if (a <= 0.003) return;

  wrapText(ctx.layout.text, SERIF(17), 320, p.measure)
    .slice(0, 2)
    .forEach((line, i) => {
      p.text(line, W / 2, 148 + i * 22, { font: SERIF(17), color: pal.fg, alpha: 0.9 * a, align: 'center' });
    });

  p.strokeRRect(PAD.x, PAD.y, PAD.w, PAD.h, 18, { color: pal.fg, width: 1, alpha: 0.3 * a, dash: [5, 7] });

  const empty = pad.strokes.length === 0 && !pad.current;
  if (empty) {
    p.text('Draw here', W / 2, PAD.y + PAD.h / 2, {
      font: SANS(15),
      color: pal.fg,
      alpha: 0.45 * a,
      align: 'center',
    });
  }

  const all = pad.current ? [...pad.strokes, pad.current] : pad.strokes;
  all.forEach((stroke) => {
    if (stroke.length >= 2) {
      p.smoothStroke(stroke, { color: pal.fg, width: PEN_WIDTH, alpha: a });
    } else if (stroke.length === 1) {
      p.circle(stroke[0].x, stroke[0].y, PEN_WIDTH / 2, { fill: { color: pal.fg, alpha: a } });
    }
  });
}
