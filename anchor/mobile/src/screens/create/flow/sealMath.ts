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

/** The card is pressed: 1 -> .94 (0.1), -> 1.015 (0.16), -> 1 (0.16). */
export function sealPress(u: number): number {
  'worklet';
  if (u < 0.1) return 1 - 0.06 * easeOut(u / 0.1);
  if (u < 0.26) return 0.94 + 0.075 * easeOut((u - 0.1) / 0.16);
  return lerp(1.015, 1, smooth(0.26, 0.42, u));
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
  return {
    centerY: lerp(CARD_CENTER_Y, MEDALLION.centerY, e),
    width: lerp(CARD.width, MEDALLION.size, e),
    height: lerp(CARD.height, MEDALLION.size, e),
    radius: lerp(CARD.radius, MEDALLION.size / 2, e),
    contentScale: lerp(1, 0.5, e),
    rim: ease(clamp((u - 0.35) / 0.55)),
    chromeAlpha: 1 - smooth(0, 0.25, u),
  };
}

/** The hold ring flashes outward once as the seal lands: 1 -> 1.5x, fading, over 0.4 s. */
export function sealFlash(seconds: number): { scale: number; alpha: number } {
  'worklet';
  const f = clamp(seconds / 0.4);
  return { scale: lerp(1, 1.5, easeOut(f)), alpha: 0.6 * (1 - f) };
}
