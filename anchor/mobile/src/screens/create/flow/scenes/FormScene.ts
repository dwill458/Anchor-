import { HERO, W } from '../geometry';
import { TAU, clamp, ease, lerp, smooth } from '../motion';
import type { Painter } from '../painter';
import { drawAnchorLine } from './anchorLine';
import { drawCaption } from './DistillScene';
import { drawProofLine } from './ForgetScene';
import type { Palette, SceneContext } from './sceneTypes';
import { FORM_FINAL_STROKE_WIDTH, RAW_STROKE_WIDTH } from './sceneTypes';

/** Where the raw anchor rests while the person chooses a style. */
export const STYLE_ANCHOR = { y: 300, scale: 0.74 } as const;

/** Progress hairline under the Form caption. */
const PROGRESS = { y: 790, width: 220 } as const;
const CONSTRUCTION_RADIUS = 128;

/** Style beat: the line lifts and shrinks to make room for the chips. */
export function drawStyleAnchor(p: Painter, pal: Palette, ctx: SceneContext, styleU: number): void {
  const e = ctx.reduceMotion ? 1 : ease(styleU);
  drawProofLine(p, pal, ctx, 1 - smooth(0, 0.3, styleU));
  drawAnchorLine(
    p,
    ctx.hero,
    pal.fg,
    HERO.x,
    lerp(HERO.y, STYLE_ANCHOR.y, e),
    lerp(1, STYLE_ANCHOR.scale, e),
    RAW_STROKE_WIDTH,
    1
  );
}

export interface FormFrame {
  /** Seconds since the style committed. */
  tf: number;
  /** 0..1 hairline fill; the generation screen's fake-progress curve, 1 on resolve. */
  progress: number;
  /** After ~12 s the caption changes. */
  slow: boolean;
  /** 1 normally; fades to 0 across the sweep into Choose. */
  fade: number;
}

/**
 * Beat 6 — forming. The real wait. The line returns to the hero, its weight settles, a fine
 * construction circle and crosshair draw in, and a hairline tracks the request.
 *
 * DECISION D5: no geometry morph. The straight polyline is what Gemini receives, so it is never
 * smoothed on screen; only stroke weight, the construction lines and the hairline animate.
 */
export function drawForm(p: Painter, pal: Palette, ctx: SceneContext, f: FormFrame): void {
  const { tf, fade } = f;
  if (fade <= 0.003) return;

  const rm = ctx.reduceMotion;
  const back = rm ? 1 : ease(clamp(tf / 0.55));
  const settle = rm ? 1 : 1 - Math.exp(-tf / 1.5);
  const build = rm ? smooth(0, 0.2, tf) : 1 - Math.exp(-tf / 1.2);

  // Construction: a circle drawing in and a crosshair, both at fine opacity.
  const construction = fade * back;
  if (construction > 0.003) {
    const circleAlpha = 0.3 * construction * smooth(0, 0.3, build);
    p.arc(HERO.x, HERO.y, CONSTRUCTION_RADIUS, -Math.PI / 2, TAU * smooth(0, 0.8, build), {
      color: pal.fg,
      width: 0.8,
      alpha: circleAlpha,
    });
    const len = 150 * smooth(0.1, 0.7, build);
    p.line(HERO.x, HERO.y - len, HERO.x, HERO.y + len, { color: pal.fg, width: 0.8, alpha: circleAlpha });
    p.line(HERO.x - len, HERO.y, HERO.x + len, HERO.y, { color: pal.fg, width: 0.8, alpha: circleAlpha });
  }

  drawAnchorLine(
    p,
    ctx.hero,
    pal.fg,
    HERO.x,
    lerp(STYLE_ANCHOR.y, HERO.y, back),
    lerp(STYLE_ANCHOR.scale, 1, back),
    lerp(RAW_STROKE_WIDTH, FORM_FINAL_STROKE_WIDTH, settle),
    fade
  );

  drawCaption(p, pal, f.slow ? 'Still working on your anchor…' : 'Applying your style…', fade);

  const x = W / 2 - PROGRESS.width / 2;
  p.fillRect(x, PROGRESS.y, PROGRESS.width, 2, { color: pal.fg, alpha: 0.2 * fade });
  p.fillRect(x, PROGRESS.y, PROGRESS.width * clamp(f.progress), 2, { color: pal.fg, alpha: 0.85 * fade });
}
