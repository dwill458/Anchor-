/** Pure layout maths for TimeWheel and ReminderTimeSheet (kept apart so Jest can test it). */

export const ROW_HEIGHT = 44;
export const VISIBLE_ROWS = 5;
export const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
/** Blank rows above/below the list so the first and last entries can centre. */
export const WHEEL_PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

/** Breathing room kept under the Done button. */
const SHEET_BASE_PADDING = 16;
/** A sheet may never cover more than this share of the window. */
const SHEET_MAX_WINDOW_SHARE = 0.85;

/** Nearest row index for a scroll offset, clamped to `[0, count - 1]`. */
export const indexFromOffset = (offsetY: number, count: number): number => {
  'worklet';
  const index = Math.round(offsetY / ROW_HEIGHT);
  return Math.min(count - 1, Math.max(0, index));
};

/** Scroll offset that centres row `index`. */
export const offsetFromIndex = (index: number): number => index * ROW_HEIGHT;

/**
 * Bottom padding under the sheet's content. The app is edge-to-edge, so the safe-area bottom
 * inset already includes the Android navigation bar / iOS home indicator.
 */
export const sheetBottomPadding = (insetBottom: number): number => Math.max(insetBottom, 0) + SHEET_BASE_PADDING;

/**
 * Props for the consumer's own content while the sheet is open, so a screen reader cannot reach
 * what is behind it: spread onto the screen's root content view.
 */
export const behindSheetA11yProps = (sheetOpen: boolean) =>
  sheetOpen
    ? ({ importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true } as const)
    : ({ importantForAccessibility: 'auto', accessibilityElementsHidden: false } as const);

/** Clamp the sheet's height so it fits compact devices (<= 85% of the window). */
export const clampSheetHeight = (windowHeight: number, desired: number): number =>
  Math.min(desired, Math.floor(windowHeight * SHEET_MAX_WINDOW_SHARE));

/** Fixed (non-wheel) parts of the sheet: top padding 12 + handle 4/12 + title 28/16 + wheel gap 20 + Done 52. */
export const SHEET_FIXED_HEIGHT = 12 + (4 + 12) + (28 + 16) + 20 + 52;
/** Fewest wheel rows the sheet may shrink to on a very short window. */
export const MIN_VISIBLE_WHEEL_ROWS = 3;

/** Full content height with the wheel at its natural size. */
export const sheetContentHeight = (bottomPadding: number): number =>
  SHEET_FIXED_HEIGHT + WHEEL_HEIGHT + bottomPadding;

/**
 * Height cap for the sheet: normally its content (at most 85% of the window), but never less than
 * header + Done + a 3-row wheel, and never taller than the space below the status bar. When the cap
 * is below the content, the wheel area shrinks (centred) so the header and Done stay visible.
 */
export const sheetMaxHeight = (windowHeight: number, topInset: number, bottomPadding: number): number => {
  const content = sheetContentHeight(bottomPadding);
  const minUsable = SHEET_FIXED_HEIGHT + MIN_VISIBLE_WHEEL_ROWS * ROW_HEIGHT + bottomPadding;
  return Math.min(Math.max(windowHeight - topInset, 0), Math.max(clampSheetHeight(windowHeight, content), minUsable));
};
