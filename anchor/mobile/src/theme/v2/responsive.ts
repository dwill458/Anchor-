/**
 * Anchor 2.0 responsive system.
 *
 * Pure, dependency-free functions so every calculation is unit-testable at
 * representative viewport sizes. Screens read them through `useV2Responsive()`.
 *
 * The rules this file encodes:
 *  - Size things by `clamp(min, fluid, max)`. Never scale the whole UI by width.
 *  - Width and height are independent axes. Width sets gutters and content
 *    width; usable HEIGHT (window minus safe areas) sets vertical rhythm.
 *  - Large phones keep their approved sizes: every fluid value is capped at
 *    the design value, so this system only ever *gives back* space on small
 *    screens.
 *  - Type and touch targets are not scaled here. Reclaim whitespace first,
 *    artwork second, and scroll before crushing controls.
 */

export type V2ViewportInput = {
  width: number;
  height: number;
  topInset?: number;
  bottomInset?: number;
};

export type V2WidthClass = 'compact' | 'standard' | 'large';
export type V2HeightClass = 'short' | 'regular' | 'tall';

/** Width of the approved design reference (iPhone 15/16). */
export const V2_REFERENCE_WIDTH = 393;
/** Lower and upper usable-height anchors for the fluid `roominess` value. */
export const V2_ROOMINESS_MIN_HEIGHT = 620;
export const V2_ROOMINESS_MAX_HEIGHT = 800;
/** No phone layout should stretch past this; guards tablets and foldables. */
export const V2_MAX_CONTENT_WIDTH = 560;
/** Design-approved page gutter on standard and large phones. */
export const V2_GUTTER_MAX = 20;
export const V2_GUTTER_MIN = 16;
/** Minimum comfortable touch target (HIG 44pt, Material 48dp: use the smaller safe floor). */
export const V2_MIN_TOUCH_TARGET = 44;

export function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(0, t, 1);
}

export function widthClassFor(width: number): V2WidthClass {
  if (width < 375) return 'compact';
  if (width < 411) return 'standard';
  return 'large';
}

export function heightClassFor(usableHeight: number): V2HeightClass {
  if (usableHeight < 680) return 'short';
  if (usableHeight < 780) return 'regular';
  return 'tall';
}

export type V2Viewport = {
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  /** Window height minus top and bottom safe areas. */
  usableHeight: number;
  widthClass: V2WidthClass;
  heightClass: V2HeightClass;
  /** 0 on the tightest supported height, 1 on a tall phone. Drives vertical rhythm. */
  roominess: number;
  /** Horizontal page inset. 20 on standard and large phones, down to 16 on 320. */
  gutter: number;
  /** Width available inside the gutters, capped for readability. */
  contentWidth: number;
  /** Pick a value between `atShort` (tightest height) and `atTall` (approved design value). */
  vertical: (atShort: number, atTall: number) => number;
  /** Bottom padding for a sticky CTA: never hugs the gesture bar or nav buttons. */
  footerPaddingBottom: number;
};

export function resolveV2Viewport({ width, height, topInset = 0, bottomInset = 0 }: V2ViewportInput): V2Viewport {
  const safeWidth = Math.max(1, width);
  const usableHeight = Math.max(0, height - topInset - bottomInset);
  const roominess = clamp(0, (usableHeight - V2_ROOMINESS_MIN_HEIGHT) / (V2_ROOMINESS_MAX_HEIGHT - V2_ROOMINESS_MIN_HEIGHT), 1);
  const gutter = Math.round(clamp(V2_GUTTER_MIN, safeWidth * (V2_GUTTER_MAX / V2_REFERENCE_WIDTH), V2_GUTTER_MAX));
  return {
    width: safeWidth,
    height,
    topInset,
    bottomInset,
    usableHeight,
    widthClass: widthClassFor(safeWidth),
    heightClass: heightClassFor(usableHeight),
    roominess,
    gutter,
    contentWidth: Math.min(safeWidth - gutter * 2, V2_MAX_CONTENT_WIDTH),
    vertical: (atShort, atTall) => Math.round(lerp(atShort, atTall, roominess)),
    footerPaddingBottom: Math.max(16, bottomInset + 12),
  };
}
