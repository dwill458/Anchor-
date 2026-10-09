/**
 * Anchor Details 2.0: the hero Anchor and the draggable sheet that rises over it.
 *
 * The prototype is authored at 390 x 844 with the sheet's top edge `y` as the one
 * driver. Every interpolated value is derived from `y` here, as plain worklet
 * math, so the screen can run it on the UI thread while dragging and tests can
 * run it as ordinary functions.
 *
 * The prototype's three snaps are 566 / 392 / 212 ("rest" / "half" / "full").
 * On a real device the snaps come from window-height fractions, so `y` is first
 * mapped back into prototype space (piecewise, so each snap lands exactly on its
 * prototype counterpart) and the prototype's own formulas run unchanged.
 */

export const SHEET_PROTOTYPE = {
  width: 390,
  height: 844,
  rest: 566,
  half: 392,
  full: 212,
  /** The status-bar allowance the prototype's absolute tops were drawn with. */
  topInset: 44,
} as const;

export type SheetSnaps = { rest: number; half: number; full: number };

export type SheetLayoutInput = {
  y: number;
  snaps: SheetSnaps;
  width: number;
  height: number;
  topInset: number;
};

export type SheetLayout = {
  /** Anchor disc diameter, dp. */
  anchorSize: number;
  anchorCenterX: number;
  anchorTop: number;
  haloSize: number;
  haloOpacity: number;
  /** Centered title block (title, category, thread). */
  centeredTop: number;
  centeredWidth: number;
  centeredFontSize: number;
  centeredOpacity: number;
  /** Header title block beside the Anchor at full. */
  headerLeft: number;
  headerTop: number;
  headerWidth: number;
  headerOpacity: number;
  /** 0 at full, 1 at half and above: how open the recommended-practice card is. */
  practiceT: number;
  practiceHeight: number;
  practiceOpacity: number;
  barOpacity: number;
};

export const PRACTICE_CARD_HEIGHT = 136;
export const SHEET_HANDLE_HEIGHT = 34;
/** The sheet only scrolls this close to the full snap. */
export const SHEET_SCROLL_TOLERANCE = 4;

export function resolveSheetSnaps(height: number, topInset: number): SheetSnaps {
  'worklet';
  const rest = Math.round(height * 0.671);
  // Full never rises above the status bar plus the back-button row and the small Anchor.
  const full = Math.round(Math.max(height * 0.251, topInset + 168));
  let half = Math.round(height * 0.464);
  // A very short window can squeeze the snaps together; keep them strictly ordered.
  if (half <= full + 40) half = Math.round((full + rest) / 2);
  return { rest, half, full };
}

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

/** Maps a real sheet top into the prototype's 212..566 space. */
export function toPrototypeY(y: number, snaps: SheetSnaps): number {
  'worklet';
  if (y >= snaps.half) {
    const span = Math.max(1, snaps.rest - snaps.half);
    return SHEET_PROTOTYPE.half + ((y - snaps.half) / span) * (SHEET_PROTOTYPE.rest - SHEET_PROTOTYPE.half);
  }
  const span = Math.max(1, snaps.half - snaps.full);
  return SHEET_PROTOTYPE.full + ((y - snaps.full) / span) * (SHEET_PROTOTYPE.half - SHEET_PROTOTYPE.full);
}

export function resolveSheetLayout({ y, snaps, width, height, topInset }: SheetLayoutInput): SheetLayout {
  'worklet';
  const P = SHEET_PROTOTYPE;
  const yp = clamp(toPrototypeY(y, snaps), P.full, P.rest);
  const kx = width / P.width;
  // Vertical room is the scarcer one on a short phone; the Anchor follows the smaller scale.
  const k = Math.min(kx, height / P.height);
  const hi = yp >= P.half;
  const hiT = (yp - P.half) / (P.rest - P.half);
  const loT = (yp - P.full) / (P.half - P.full);

  const aS = (hi ? 200 + hiT * 100 : 84 + loT * 116) * k;
  const cx = (hi ? 195 : 62 + loT * 133) * kx;
  const aTopProto = hi ? 76 + hiT * 10 : 104 - loT * 28;
  const aTop = topInset + (aTopProto - P.topInset) * k;
  const aL = cx - aS / 2;

  const centeredGap = hi ? 16 + hiT * 4 : 16;
  const centeredWidth = (hi ? 340 - hiT * 40 : 340) * kx;
  const centeredFontSize = hi ? 21 + hiT * 4 : 21;
  const headerLeft = aL + aS + 16;
  const t = clamp(loT, 0, 1);

  return {
    anchorSize: aS,
    anchorCenterX: cx,
    anchorTop: aTop,
    haloSize: aS * 1.15,
    haloOpacity: hi ? 1 : clamp(loT, 0, 1),
    centeredTop: aTop + aS + centeredGap,
    centeredWidth,
    centeredFontSize,
    centeredOpacity: clamp((yp - 250) / 100, 0, 1),
    headerLeft,
    headerTop: aTop + 2,
    headerWidth: Math.max(120, width - 18 * kx - headerLeft),
    headerOpacity: clamp((262 - yp) / 50, 0, 1),
    practiceT: t,
    practiceHeight: PRACTICE_CARD_HEIGHT * t,
    practiceOpacity: t,
    barOpacity: clamp((330 - yp) / 90, 0, 1),
  };
}

/** Where a released drag lands: the nearest snap to where it was heading in 160 ms. */
export function nearestSnap(y: number, velocityY: number, snaps: SheetSnaps): number {
  'worklet';
  const projected = y + (velocityY / 1000) * 160;
  const rest = Math.abs(snaps.rest - projected);
  const half = Math.abs(snaps.half - projected);
  const full = Math.abs(snaps.full - projected);
  if (full <= half && full <= rest) return snaps.full;
  return half <= rest ? snaps.half : snaps.rest;
}

/** A tap on the handle cycles rest -> half -> full -> rest. */
export function nextSnapForTap(y: number, snaps: SheetSnaps): number {
  'worklet';
  const yp = toPrototypeY(y, snaps);
  return yp > 480 ? snaps.half : yp > 300 ? snaps.full : snaps.rest;
}

/**
 * The Anchor's rect at the rest snap, in window coordinates. Home's travelling
 * Anchor lands here, and Details measures itself to the same place.
 */
export function resolveRestAnchorRect({ width, height, topInset }: { width: number; height: number; topInset: number }) {
  const layout = resolveSheetLayout({ y: resolveSheetSnaps(height, topInset).rest, snaps: resolveSheetSnaps(height, topInset), width, height, topInset });
  return {
    x: layout.anchorCenterX - layout.anchorSize / 2,
    y: layout.anchorTop,
    width: layout.anchorSize,
    height: layout.anchorSize,
  };
}
