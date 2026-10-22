import { HERO, SANS, W, type Pt } from '../geometry';
import { clamp, ease, lerp, smooth } from '../motion';
import type { Painter } from '../painter';
import { drawAnchorLine } from './anchorLine';
import { CAPTION_Y, drawCaption } from './DistillScene';
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
  /** Display name of the committed style, for the wait caption. */
  styleName?: string;
  /** The picked style is not the default one, so it generates longer: say so while it runs. */
  longerWait?: boolean;
}

/** Seconds: the line flies to the hero, then re-draws; the material follows a beat behind. */
export const FORM_TIMING = {
  fly: 0.55,
  redrawStart: 0.45,
  redraw: 2.2,
  materialLag: 0.5,
  /** The leading stretch of the material is still growing to full weight. */
  bloomWindow: 0.12,
  /** Seconds for a lit head to travel the whole line; the haptic/sound cues tick once per lap. */
  sheenPeriod: 2.6,
  /** How much of the line (0..1) a lit head's tail covers. */
  cometTail: 0.16,
  /** Seconds per breath of the halo. */
  breathPeriod: 1.8,
} as const;

const glowCache = new Map<StrokeTreatment, string>();

/**
 * The hue the motion is drawn in: the style's most saturated layer colour, so Prism glows cyan-violet
 * and Joybrush amber instead of everything going white; a neutral style (Alloy, Flash) falls back to
 * its bloom. Cached per treatment — this runs every frame.
 */
function glowColorFor(t: StrokeTreatment): string {
  const hit = glowCache.get(t);
  if (hit) return hit;
  let best: [number, number, number] | null = null;
  let bestSat = 0.18;
  t.layers.forEach((layer) => {
    const m = /^#([0-9a-f]{6})$/i.exec(layer.color);
    if (!m || layer.alpha < 0.3) return;
    const n = parseInt(m[1], 16);
    const rgb: [number, number, number] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const mx = Math.max(...rgb);
    const sat = mx === 0 ? 0 : (mx - Math.min(...rgb)) / mx;
    if (sat > bestSat && mx > 90) {
      best = rgb;
      bestSat = sat;
    }
  });
  let out = t.bloom;
  if (best) {
    // The field is dark: lift a deep hue (Porcelain's underglaze blue) toward white until it glows.
    const [r, g, b] = best as [number, number, number];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mix = Math.min(0.7, Math.max(0.15, (0.78 - lum) * 1.5));
    const c = (v: number) => Math.round(v + (255 - v) * mix).toString(16).padStart(2, '0');
    out = `#${c(r)}${c(g)}${c(b)}`;
  }
  glowCache.set(t, out);
  return out;
}

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
      // A short tail follows the real centreline, including separate pen strokes.
      const trail: StrokeTreatment = { bloom: treatment.bloom, layers: [
        { width: 8, color: treatment.bloom, alpha: 0.12 },
        { width: 3.6, color: treatment.bloom, alpha: 0.6 },
      ] };
      drawTreatedRange(p, placed, measured, trail, Math.max(0, head - 0.055), head, 1, 1, fade);
      const tip = pointAlong(placed, measured, head);
      if (tip) {
        p.circle(tip.x, tip.y, 9, { fill: { color: treatment.bloom, alpha: 0.12 * fade } });
        p.circle(tip.x, tip.y, 5.2, { fill: { color: treatment.bloom, alpha: 0.5 * fade } });
        p.circle(tip.x, tip.y, 3.6, { fill: { color: '#FFFFFF', alpha: fade } });
      }
    }
  }

  // A halo in the style's own hue breathes along whatever material has arrived, under it, so even a
  // line that is already finished is visibly alive (a thin white sheen vanishes on a pale line).
  if (!rm && material > 0.003) {
    const breathe = 0.5 + 0.5 * Math.sin((tf / T.breathPeriod) * Math.PI * 2);
    const halo: StrokeTreatment = { bloom: treatment.bloom, layers: [{ width: 12, color: glowColorFor(treatment), alpha: 0.06 + 0.12 * breathe }] };
    drawTreatedRange(p, placed, measured, halo, 0, material, 1, 1, fade);
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
      const sweep: StrokeTreatment = { bloom: treatment.bloom, layers: [
        { width: 7, color: treatment.bloom, alpha: 0.22 },
        { width: 3.2, color: treatment.bloom, alpha: 0.9 },
        { width: 1.2, color: '#FFFFFF', alpha: 0.95 },
      ] };
      drawTreatedRange(p, placed, measured, sweep, Math.max(0, material - 0.07), material, unit, 1, fade);
      const tip = pointAlong(placed, measured, material);
      if (tip) {
        p.circle(tip.x, tip.y, 6, { fill: { color: treatment.bloom, alpha: 0.28 * fade } });
        p.circle(tip.x, tip.y, 2.6, { fill: { color: treatment.bloom, alpha: 0.95 * fade } });
      }
    }
  }

  // Alive while waiting, in every style: two lit heads keep circling the finished line, half a lap
  // apart so there is never a gap, over the breathing halo drawn beneath the material.
  // They light a beat before the material finishes arriving, so the hand-off from the sweep has no lull.
  if (!rm && tf > FORM_REVEAL_SECONDS - 0.6) {
    const since = tf - FORM_REVEAL_SECONDS;
    const ramp = smooth(-0.6, -0.1, since);
    const glow = glowColorFor(treatment);
    [0, 0.5].forEach((offset) => {
      const h = (((since / T.sheenPeriod + offset) % 1) + 1) % 1;
      if (h < 0.004) return;
      // Absolute px layers, not the material's: the halo reaches past even a thin or pale line, so
      // the motion reads on the field whatever colour the line is.
      const comet: StrokeTreatment = { bloom: glow, layers: [
        { width: 11, color: glow, alpha: 0.2 * ramp },
        { width: 4.4, color: glow, alpha: 0.7 * ramp },
        { width: 1.6, color: '#FFFFFF', alpha: 0.95 * ramp },
      ] };
      drawTreatedRange(p, placed, measured, comet, Math.max(0, h - T.cometTail), h, 1, 1, fade);
      const tip = pointAlong(placed, measured, h);
      if (tip) {
        p.circle(tip.x, tip.y, 8, { fill: { color: glow, alpha: 0.22 * ramp * fade } });
        p.circle(tip.x, tip.y, 3.8, { fill: { color: '#FFFFFF', alpha: ramp * fade } });
      }
    });
  }

  const applying = rm || tf >= T.redrawStart + T.materialLag;
  drawCaption(p, pal, applying ? 'Applying your style…' : 'Drawing your line…', fade, { time: tf, reduceMotion: rm });
  // Keep the stage visible throughout the wait. Alloy needs this expectation even if recommended.
  const longerWait = f.longerWait || f.styleId === 'alloy';
  if (applying && ((longerWait && f.styleName) || f.slow)) {
    const expectation = longerWait && f.styleName
      ? 'Forging your Anchor — this one takes a moment.'
      : 'Still working on your anchor…';
    p.text(expectation, W / 2, CAPTION_Y + 24, {
      font: SANS(12), color: pal.fg, alpha: 0.84 * fade, align: 'center',
    });
  }
}
