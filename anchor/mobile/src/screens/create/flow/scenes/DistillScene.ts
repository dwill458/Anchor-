import { SANS, SERIF, W, type IntentChar } from '../geometry';
import { clamp, ease, easeOut, lerp, segmentU, smooth } from '../motion';
import type { Painter } from '../painter';
import type { Palette, SceneContext } from './sceneTypes';

/** Where the intention text sits as a whole (camera pivot). */
const CAMERA = { x: W / 2, y: 300 };

/** Caption baseline shared by Distill and Form. */
export const CAPTION_Y = 772;

export function drawCaption(p: Painter, pal: Palette, text: string, alpha: number): void {
  if (alpha <= 0.003) return;
  p.text(text, W / 2, CAPTION_Y, { font: SANS(14), color: pal.fg, alpha: 0.78 * alpha, align: 'center' });
}

/**
 * Beat 1 -> 2: the typed words glide from the Intention field to the centred layout, then
 * Distill removes vowels, merges repeats and gathers the survivors into one row.
 *
 * Driven by the real `distillIntention` result: survivors are exactly `layout.uniq`, in order.
 */
export function drawIntentText(
  p: Painter,
  pal: Palette,
  ctx: SceneContext,
  t: number,
  alphaScale: number = 1
): void {
  const { layout, timeline: tl, reduceMotion } = ctx;
  const handoffU = segmentU(t, 0, tl.handoff);
  const distillU = segmentU(t, tl.start.distill, tl.start.distill + tl.distill);

  // Glide: begins 0.15 into the handoff and takes 70% of it. 'fade' entries have no field to leave.
  const glide =
    ctx.entry === 'glide' && !reduceMotion ? ease(clamp((handoffU - 0.15) / 0.7)) : 1;
  const entryAlpha = (ctx.entry === 'fade' ? smooth(0.1, 0.9, handoffU) : 1) * alphaScale;

  // Slow push-in over the first 55% of Distill — never during the handoff, so the glide keeps the
  // field's exact size.
  const camU = segmentU(t, tl.start.distill, tl.start.distill + tl.distill * 0.55);
  const camera = reduceMotion ? 1 : 1 + 0.035 * easeOut(camU);
  const fontSize = layout.fontSize * camera;

  const place = (c: IntentChar) => {
    const x = lerp(c.ax, c.cx, glide);
    const y = lerp(c.ay, c.by, glide);
    return { x: CAMERA.x + (x - CAMERA.x) * camera, y: CAMERA.y + (y - CAMERA.y) * camera };
  };

  if (reduceMotion) {
    // Crossfade: the whole sentence out, the distilled row in.
    const out = 1 - smooth(0, 0.5, distillU);
    layout.chars.forEach((c) => {
      if (c.ch === ' ') return;
      const pos = place(c);
      p.text(c.ch, pos.x, pos.y, {
        font: SERIF(layout.fontSize),
        color: pal.fg,
        alpha: out * entryAlpha,
        align: 'center',
      });
    });
    const inA = smooth(0.5, 1, distillU);
    layout.uniq.forEach((u) => {
      p.text(u.L, u.rx, u.ry + 9, { font: SANS(26, 500), color: pal.fg, alpha: inA, align: 'center' });
    });
    return;
  }

  layout.chars.forEach((c) => {
    if (c.ch === ' ') return;
    const pos = place(c);
    let alpha = entryAlpha;
    let x = pos.x;
    let y = pos.y;
    let size = fontSize;
    let sansAlpha = 0;

    if (c.type === 'vowel' || c.type === 'other') {
      // Vowels and punctuation fade up and out, 8 ms apart.
      const k = clamp((distillU - 0.05 - c.j * 0.008) / 0.22);
      alpha *= 1 - easeOut(k);
      y -= 8 * easeOut(k);
    } else if (c.type === 'dup') {
      // Repeats slide to their first occurrence and dissolve into it.
      const first = layout.chars[c.first ?? 0];
      const target = place(first);
      const m = ease(clamp((distillU - 0.3 - c.j * 0.01) / 0.3));
      x = lerp(pos.x, target.x, m);
      y = lerp(pos.y, target.y, m);
      alpha *= 1 - smooth(0.5, 1, m);
    } else {
      // Survivors travel to the single row and cross-fade serif -> sans caps.
      const u = layout.uniq[c.ki ?? 0];
      const g = ease(clamp((distillU - 0.56 - (c.ki ?? 0) * 0.014) / 0.38));
      x = lerp(pos.x, u.rx, g);
      y = lerp(pos.y, u.ry + 9, g);
      size = lerp(fontSize, 26, g);
      alpha *= 1 - smooth(0, 0.55, g);
      sansAlpha = smooth(0.25, 0.95, g);
      if (sansAlpha > 0) {
        p.text(c.ch.toUpperCase(), x, y, {
          font: SANS(26, 500),
          color: pal.fg,
          alpha: sansAlpha,
          align: 'center',
        });
      }
    }

    p.text(c.ch, x, y, { font: SERIF(size), color: pal.fg, alpha, align: 'center' });
  });

  // Captions follow the three passes.
  if (distillU > 0 && distillU < 1) {
    drawCaption(p, pal, 'Removing vowels…', 1 - smooth(0.24, 0.3, distillU));
    drawCaption(p, pal, 'Combining duplicates…', smooth(0.3, 0.36, distillU) * (1 - smooth(0.5, 0.56, distillU)));
    drawCaption(p, pal, 'Keeping each letter, in order.', smooth(0.56, 0.62, distillU));
  }
}
