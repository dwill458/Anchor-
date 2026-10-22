import type { Painter } from '../painter';
import { drawDrawScene } from './DrawScene';
import { drawIntentText } from './DistillScene';
import { drawForget, drawForgetDrawn } from './ForgetScene';
import { drawForm, drawStyleAnchor, type FormFrame } from './FormScene';
import { drawMap } from './MapScene';
import type { DrawPadState, Palette, SceneContext } from './sceneTypes';

/** What the canvas is showing this frame. Overlays (header, chips, cards) are React views. */
export type FlowFrame =
  | { kind: 'auto'; t: number }
  | { kind: 'draw'; pad: DrawPadState }
  | { kind: 'style'; styleU: number }
  | { kind: 'form'; form: FormFrame }
  | { kind: 'none' };

/**
 * Paint one frame's content in one palette. The renderer calls this twice — cream and ink — and
 * clips the ink pass to the torn boundary, so a single description of the scene produces the
 * whole two-tone transformation.
 */
export function drawFrameContent(p: Painter, pal: Palette, ctx: SceneContext, frame: FlowFrame): void {
  switch (frame.kind) {
    case 'auto': {
      const { t } = frame;
      const tl = ctx.timeline;

      // Intention text: handoff + Distill. Typed anchors stop once Map takes over.
      if (ctx.isDrawn ? t <= tl.handoff : t < tl.start.map) drawIntentText(p, pal, ctx, t);

      if (!ctx.isDrawn && t >= tl.start.map && t < tl.start.forget) drawMap(p, pal, ctx, t);

      if (t >= tl.start.forget) {
        if (ctx.isDrawn) drawForgetDrawn(p, pal, ctx, t);
        else drawForget(p, pal, ctx, t);
      }
      return;
    }
    case 'draw':
      drawDrawScene(p, pal, ctx, frame.pad);
      return;
    case 'style':
      drawStyleAnchor(p, pal, ctx, frame.styleU);
      return;
    case 'form':
      drawForm(p, pal, ctx, frame.form);
      return;
    case 'none':
      return;
  }
}
