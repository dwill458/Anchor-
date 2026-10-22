import { SEAL_CANCEL_SLOP_PX, SEAL_DRAIN_RATE, SEAL_HOLD_MS } from './creationFlowConfig';
import { clamp, lerp } from './motion';

/**
 * Pure rules for the Choose screen's two interleaved gestures: swiping between Forms and
 * holding the anchor to seal. Kept free of React and gesture libraries so the rules the spec
 * pins down (10 px, 1.9x snap, 1.1 s, 2.6x drain) are directly testable.
 */

/**
 * The Form is a square image, shown whole: the card is a square centred on the hold point, so
 * the anchor sits in the middle and nothing is cropped or stretched. Sealing contracts it to the
 * medallion at half scale, which shows the same whole image Home's circle shows.
 */
export const CARD = { x: 18, y: 223, width: 354, height: 354, radius: 24, gap: 14 } as const;
/** Page pitch in design px. */
export const PAGE_PITCH = CARD.width + CARD.gap;
export const PAGE_COUNT = 2;
/** The hold zone: a circle on the image centre — there is no separate seal button. */
export const HOLD = { centerX: 195, centerY: 400, radius: 126 } as const;

export interface PagerTouch {
  /** Where the finger went down, design px. */
  startX: number;
  startY: number;
  startPage: number;
  /** True when the touch began inside the hold zone on a settled page. */
  holding: boolean;
  dragging: boolean;
}

/** A hold may only begin when the pager is at rest on a page. */
export function isSettled(page: number): boolean {
  return Math.abs(page - Math.round(page)) < 0.05;
}

/** Hold zone is centred on the visible card, wherever the pager currently is. */
export function holdCenter(page: number): { x: number; y: number } {
  return { x: CARD.x + CARD.width / 2 + (Math.round(page) - page) * PAGE_PITCH, y: HOLD.centerY };
}

export function beginTouch(x: number, y: number, page: number): PagerTouch {
  const centre = holdCenter(page);
  const inZone = Math.hypot(x - centre.x, y - centre.y) < HOLD.radius;
  return { startX: x, startY: y, startPage: page, holding: isSettled(page) && inZone, dragging: false };
}

/**
 * Advance a touch with a pointer move. A finger moving more than 10 px sideways cancels a hold
 * and becomes a swipe; once swiping, the page follows the finger.
 */
export function moveTouch(touch: PagerTouch, x: number): { touch: PagerTouch; page: number | null } {
  const dx = x - touch.startX;
  let next = touch;

  if (touch.holding && Math.abs(dx) > SEAL_CANCEL_SLOP_PX) {
    next = { ...touch, holding: false, dragging: true };
  } else if (!touch.holding && !touch.dragging && Math.abs(dx) > 0) {
    next = { ...touch, dragging: true };
  }

  if (!next.dragging) return { touch: next, page: null };
  return {
    touch: next,
    page: clamp(touch.startPage - dx / PAGE_PITCH, -0.15, PAGE_COUNT - 1 + 0.15),
  };
}

/** Where a released swipe settles: `round(startPage + delta * 1.9)`, clamped to a real page. */
export function snapPage(startPage: number, releaseX: number, startX: number): number {
  const delta = (startX - releaseX) / PAGE_PITCH;
  return clamp(Math.round(startPage + delta * 1.9), 0, PAGE_COUNT - 1);
}

export interface HoldStep {
  progress: number;
  complete: boolean;
}

/** Fill over 1.1 s while held; drain at 2.6x when released early. */
export function advanceHold(progress: number, dtSeconds: number, holding: boolean): HoldStep {
  if (!holding) {
    return { progress: Math.max(0, progress - dtSeconds * SEAL_DRAIN_RATE), complete: false };
  }
  const next = Math.min(1, progress + (dtSeconds * 1000) / SEAL_HOLD_MS);
  return { progress: next, complete: next >= 1 };
}

/** Haptic cadence tightens from 150 ms to 50 ms as the hold fills. */
export function holdHapticInterval(progress: number): number {
  return lerp(150, 50, clamp(progress));
}

/** Haptic strength rises with the hold; expo-haptics only has styles, so it steps at the halfway mark. */
export function holdHapticStrength(progress: number): 'light' | 'medium' {
  return progress < 0.5 ? 'light' : 'medium';
}
