import { HERO, type Pt } from '../geometry';
import { clamp, ease, lerp, smooth } from '../motion';
import type { Painter } from '../painter';
import { drawAnchorLine } from './anchorLine';
import { drawCaption } from './DistillScene';
import { drawProofLine } from './ForgetScene';
import type { Palette, SceneContext } from './sceneTypes';
import { FORM_FINAL_STROKE_WIDTH, RAW_STROKE_WIDTH } from './sceneTypes';
import {
  REFERENCE_WIDTH,
  drawTreatedRange,
  measureStrokes,
  slicePolyline,
  strokeTreatmentFor,
  type PlacedStrokes,
  type StrokeTreatment,
} from './styleStrokes';

/** Where the raw anchor rests while the person chooses a style. */
export const STYLE_ANCHOR = { y: 300, scale: 0.74 } as const;

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
  /** 0..1 request progress; drives the header's segment, not anything on the canvas. */
  progress: number;
  /** After ~12 s the caption changes. */
  slow: boolean;
  /** 1 normally; fades to 0 across the sweep into Choose. */
  fade: number;
  /** The committed style: its material is what blooms along the line. */
  styleId?: string;
}

/** Seconds: the line flies to the hero, then re-draws; the material follows a beat behind. */
export const FORM_TIMING = {
  fly: 0.55,
  redrawStart: 0.45,
  redraw: 2.2,
  materialLag: 0.5,
  /** The leading stretch of the material is still growing to full weight. */
  bloomWindow: 0.12,
  sheenPeriod: 2.6,
} as const;

/** When the material has fully arrived (seconds into Form). */
export const FORM_REVEAL_SECONDS = FORM_TIMING.redrawStart + FORM_TIMING.materialLag + FORM_TIMING.redraw;

const RAW_ONLY: StrokeTreatment = {
  bloom: '#FFFFFF',
  layers: [{ width: RAW_STROKE_WIDTH, color: '', alpha: 0.95 }],
};

/** The point `frac` (0..1) of the way along all pen strokes. */
function pointAlong(placed: PlacedStrokes, measured: ReturnType<typeof measureStrokes>, frac: number): Pt | null {
  const target = clamp(frac) * measured.total;
  for (let i = 0; i < placed.strokes.length; i += 1) {
    const start = measured.starts[i];
    if (target > start + measured.lengths[i] && i < placed.strokes.length - 1) continue;
    const slice = slicePolyline(placed.strokes[i], 0, Math.max(0, target - start));
    const end = slice[slice.length - 1] ?? placed.strokes[i][0];
    if (!end) return null;
    return { x: placed.cx + end.x * placed.k, y: placed.cy + end.y * placed.k };
  }
  return null;
}

/**
 * Beat 6 — forming. The real wait, made the reveal: the line returns to the hero, is drawn again
 * from its first point to its last, and the chosen style's material blooms along it, a beat behind
 * the pen. Once it has arrived, a slow sheen keeps travelling the line until the request resolves.
 *
 * DECISION D5: no geometry morph. The straight polyline is what Gemini receives, so it is never
 * smoothed on screen; only weight, material and the sheen animate. What blooms is the style's
 * stroke treatment (`styleStrokes.ts`), a stand-in for the generated artwork that follows.
 */
export function drawForm(p: Painter, pal: Palette, ctx: SceneContext, f: FormFrame): void {
  const { tf, fade } = f;
  if (fade <= 0.003) return;

  const rm = ctx.reduceMotion;
  const T = FORM_TIMING;
  const back = rm ? 1 : ease(clamp(tf / T.fly));
  const treatment = strokeTreatmentFor(f.styleId);
  const unit = FORM_FINAL_STROKE_WIDTH / REFERENCE_WIDTH;

  const cx = HERO.x;
  const cy = lerp(STYLE_ANCHOR.y, HERO.y, back);
  const k = lerp(STYLE_ANCHOR.scale, 1, back);
  const placed: PlacedStrokes = { strokes: ctx.hero.strokes, cx, cy, k };
  const measured = measureStrokes(ctx.hero.strokes);

  // The old line steps back to a faint trace, and is drawn over.
  const trace = rm ? 0.22 : lerp(1, 0.22, smooth(0, 0.45, tf));
  drawAnchorLine(p, ctx.hero, pal.fg, cx, cy, k, RAW_STROKE_WIDTH, trace * fade);

  let head = 1;
  let material = 1;
  if (!rm) {
    head = ease(clamp((tf - T.redrawStart) / T.redraw));
    material = ease(clamp((tf - T.redrawStart - T.materialLag) / T.redraw));
  } else {
    material = smooth(0, 0.3, tf);
  }

  if (!rm) {
    // The pen: a bright raw stroke up to the head.
    const penLayer: StrokeTreatment = { ...RAW_ONLY, layers: [{ ...RAW_ONLY.layers[0], color: pal.fg }] };
    drawTreatedRange(p, placed, measured, penLayer, 0, head, 1, 1, fade);
    if (head > 0.003 && head < 0.999) {
      const tip = pointAlong(placed, measured, head);
      if (tip) p.circle(tip.x, tip.y, 3.2, { fill: { color: treatment.bloom, alpha: 0.9 * fade } });
    }
  }

  // The material: full weight behind the bloom window, growing to weight inside it.
  const window = T.bloomWindow;
  const settled = Math.max(0, material - window);
  if (rm) {
    drawTreatedRange(p, placed, measured, treatment, 0, 1, unit, 1, material * fade);
  } else {
    drawTreatedRange(p, placed, measured, treatment, 0, settled, unit, 1, fade);
    const steps = 3;
    for (let i = 0; i < steps; i += 1) {
      const from = settled + (window * i) / steps;
      const to = Math.min(material, settled + (window * (i + 1)) / steps);
      drawTreatedRange(p, placed, measured, treatment, from, to, unit, 0.3 + 0.7 * (i / steps), fade);
    }
    if (material > 0.003 && material < 0.999) {
      const tip = pointAlong(placed, measured, material);
      if (tip) {
        p.circle(tip.x, tip.y, 6, { fill: { color: treatment.bloom, alpha: 0.28 * fade } });
        p.circle(tip.x, tip.y, 2.6, { fill: { color: treatment.bloom, alpha: 0.95 * fade } });
      }
    }
  }

  // Alive while waiting: a soft sheen keeps travelling the finished line.
  if (!rm && tf > FORM_REVEAL_SECONDS) {
    const cycle = ((tf - FORM_REVEAL_SECONDS) / T.sheenPeriod) % 1.35;
    const from = cycle - 0.15;
    const sheen: StrokeTreatment = {
      bloom: treatment.bloom,
      // DEFERRED: the 1.5 / 0.55 bloom-colour sheen blended into Alloy's pale core.
      layers: [{ width: 2.2, color: '#FFFFFF', alpha: 0.85 }],
    };
    drawTreatedRange(p, placed, measured, sheen, clamp(from), clamp(cycle), unit, 1, fade);
  }

  drawCaption(p, pal, f.slow ? 'Still working on your anchor…' : 'Applying your style…', fade);
}
