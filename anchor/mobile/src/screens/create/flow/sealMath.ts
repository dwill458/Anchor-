import { ease, easeOut, lerp, smooth, clamp } from './motion';
import { CARD } from './choosePager';

/**
 * The seal sequence as pure functions of `u` (0..1 over 1.6 s). They are worklets because the
 * Choose scene feeds them to Reanimated styles; they are also plain functions the tests call.
 */

export const SEAL_SEQUENCE_SECONDS = 1.6;
/** Medallion: where the sealed card settles. */
export const MEDALLION = { centerX: 195, centerY: 300, size: 176 } as const;
/** The card's centre before it contracts. */
const CARD_CENTER_Y = CARD.y + CARD.height / 2;

/**
 * The hold completes: for the first 240 ms (0.15 of the sequence) the card squeezes — scale 1 -> .92
 * and its corners soften 24 -> 120 px, ease-in-out — before it contracts into the circular medallion.
 * It is the front of the same clock, so the seal cue, flash and save hand-off keep their timing.
 */
export const SEAL_SQUEEZE_U = 0.15;
export const SEAL_SQUEEZE_SCALE = 0.92;
export const SEAL_SQUEEZE_RADIUS = 120;

/** After the squeeze the card rebounds: .92 -> 1.015 (to 0.3), -> 1. */
export function sealPress(u: number): number {
  'worklet';
  if (u < SEAL_SQUEEZE_U) return lerp(1, SEAL_SQUEEZE_SCALE, ease(u / SEAL_SQUEEZE_U));
  if (u < 0.3) return SEAL_SQUEEZE_SCALE + (1.015 - SEAL_SQUEEZE_SCALE) * easeOut((u - SEAL_SQUEEZE_U) / (0.3 - SEAL_SQUEEZE_U));
  return lerp(1.015, 1, smooth(0.3, 0.42, u));
}

export interface SealCardShape {
  /** Centre of the card/medallion, design px. */
  centerY: number;
  width: number;
  height: number;
  radius: number;
  /** Uniform scale of the image inside it. */
  contentScale: number;
  /** 0..1, the medallion's pressed-into-paper rim. */
  rim: number;
  /** Labels, page dots and the hint leave first. */
  chromeAlpha: number;
}

/** After the press, the card contracts into a 176 px circular medallion at (195, 300). */
export function sealCard(u: number): SealCardShape {
  'worklet';
  const e = ease(clamp((u - 0.18) / 0.7));
  // The squeeze softens the corners first; the contraction then takes them on to the circle.
  const squeezedRadius = lerp(CARD.radius, SEAL_SQUEEZE_RADIUS, ease(clamp(u / SEAL_SQUEEZE_U)));
  return {
    centerY: lerp(CARD_CENTER_Y, MEDALLION.centerY, e),
    width: lerp(CARD.width, MEDALLION.size, e),
    height: lerp(CARD.height, MEDALLION.size, e),
    radius: lerp(squeezedRadius, MEDALLION.size / 2, e),
    contentScale: lerp(1, 0.5, e),
    rim: ease(clamp((u - 0.35) / 0.55)),
    chromeAlpha: 1 - smooth(0, 0.25, u),
  };
}

/**
 * The payoff: once the medallion has formed, the anchor pulses once and the intention sentence
 * appears beneath it — symbol and sentence, married. The pulse begins at this point of the sequence.
 */
export const SEAL_PULSE_AT = 0.72;
const SEAL_PULSE_SPAN = 0.2;

/** The medallion swells 5% and settles, once. */
export function sealPulse(u: number): number {
  'worklet';
  const f = clamp((u - SEAL_PULSE_AT) / SEAL_PULSE_SPAN);
  return 1 + 0.05 * Math.sin(Math.PI * f);
}

/** The ring of light that leaves the medallion with the pulse: scale and alpha. */
export function sealHalo(u: number): { scale: number; alpha: number } {
  'worklet';
  const f = clamp((u - SEAL_PULSE_AT) / (SEAL_PULSE_SPAN * 1.6));
  return { scale: lerp(1, 1.55, easeOut(f)), alpha: 0.55 * Math.sin(Math.PI * Math.min(1, f * 1.15)) * (f > 0 ? 1 : 0) };
}

/** The sentence arrives just behind the pulse and then holds. */
export function sealSentenceAlpha(u: number): number {
  'worklet';
  return smooth(SEAL_PULSE_AT + 0.05, SEAL_PULSE_AT + 0.26, u);
}

/** The hold ring flashes outward once as the seal lands: 1 -> 1.5x, fading, over 0.4 s. */
export function sealFlash(seconds: number): { scale: number; alpha: number } {
  'worklet';
  const f = clamp(seconds / 0.4);
  return { scale: lerp(1, 1.5, easeOut(f)), alpha: 0.6 * (1 - f) };
}
