import { INK_BOUNDARY } from '../creationFlowConfig';
import { H } from '../geometry';
import { clamp, ease, lerp, rng, segmentU } from '../motion';
import type { SceneContext } from './sceneTypes';

/**
 * The cream/ink boundary: the one piece of "magic". The ink band is a closed region whose top
 * edge sits at `B(t)` plus a torn-paper noise. This file owns the math (pure, testable); the Skia
 * renderer turns it into a clip path.
 */

/** Value noise on a lattice, smoothstep-interpolated. */
function valueNoise(values: number[], step: number, x: number): number {
  const f = (x + 40) / step;
  const i = Math.floor(f);
  const t = f - i;
  const s = t * t * (3 - 2 * t);
  return lerp(values[i] ?? 0, values[i + 1] ?? 0, s);
}

const makeLattice = (seed: number, n: number): number[] => {
  const random = rng(seed);
  return Array.from({ length: n }, () => random() * 2 - 1);
};

const OCTAVE_A = makeLattice(7, 40);
const OCTAVE_B = makeLattice(11, 110);
const OCTAVE_C = makeLattice(13, 260);

/** Three octaves, amplitudes ~9 / 3.6 / 0.9 px at frequencies 14 / 5 / 2 px. */
export function tornEdge(x: number): number {
  return (
    valueNoise(OCTAVE_A, 14, x) * 9 +
    valueNoise(OCTAVE_B, 5, x) * 3.6 +
    (OCTAVE_C[Math.floor((x + 40) / 2)] ?? 0) * 0.9
  );
}

/** Below the screen, out of sight. */
export const INK_HIDDEN = H + INK_BOUNDARY.offscreenOffset;
/** At or beyond this the band is off-screen and the ink pass can be skipped. */
export const INK_VISIBLE_BELOW = H + 50;

/**
 * Boundary during the automatic part of the flow (handoff -> stillness, and the Draw path's
 * Forget-settle). `t` is seconds since Continue.
 */
export function autoBoundary(ctx: SceneContext, t: number): number {
  const { timeline: tl, reduceMotion } = ctx;
  const handoffU = segmentU(t, 0, tl.handoff);

  if (t < tl.handoff) {
    // Rises from below the screen to 618 over the handoff, starting 0.15 in.
    // Reduce motion: no rise — the band is simply there.
    if (reduceMotion) return INK_BOUNDARY.afterHandoff;
    return lerp(INK_HIDDEN, INK_BOUNDARY.afterHandoff, ease(clamp((handoffU - 0.15) / 0.85)));
  }

  if (ctx.isDrawn) return INK_BOUNDARY.held;

  const distillEnd = tl.start.distill + tl.distill;
  if (t < distillEnd) {
    if (reduceMotion) return INK_BOUNDARY.afterDistill;
    return lerp(INK_BOUNDARY.afterHandoff, INK_BOUNDARY.afterDistill, ease(segmentU(t, tl.start.distill, distillEnd)));
  }

  const mapEnd = distillEnd + tl.map;
  if (t < mapEnd) {
    return lerp(INK_BOUNDARY.afterDistill, INK_BOUNDARY.held, segmentU(t, distillEnd, mapEnd));
  }

  return INK_BOUNDARY.held;
}

/** Draw path: the band rises 618 -> 98 as the pad comes in. */
export function drawBoundary(riseU: number, reduceMotion: boolean): number {
  if (reduceMotion) return INK_BOUNDARY.held;
  return lerp(INK_BOUNDARY.afterHandoff, INK_BOUNDARY.held, ease(clamp(riseU)));
}

/** Sweep into Choose: the band recedes down the screen. */
export function sweepBoundary(sweepU: number, reduceMotion: boolean): number {
  if (reduceMotion) return sweepU >= 1 ? INK_HIDDEN : INK_BOUNDARY.held;
  return lerp(INK_BOUNDARY.held, INK_HIDDEN, ease(clamp(sweepU)));
}
