/**
 * Layout for the onboarding question: a serif question over six rows on one cream field.
 * The rows share whatever height the question leaves, within a comfortable touch range.
 */
export const FOCUS_METRICS = {
  sidePad: 28,
  headerHeight: 48,
  questionLine: 38,
  rows: 6,
  minRowH: 56,
  maxRowH: 72,
  /** Space between the question and the first row. */
  questionGap: 28,
} as const;

export type FocusLayout = {
  questionTop: number;
  listTop: number;
  rowH: number;
};

export function solveFocusLayout(
  _width: number,
  height: number,
  insets: { top: number; bottom: number },
): FocusLayout {
  const m = FOCUS_METRICS;
  const bottom = Math.max(insets.bottom, 16) + 12;
  const headerBottom = insets.top + m.headerHeight;
  const questionBlock = m.questionLine * 2 + m.questionGap;
  // Rows first: as tall as they can be, then the question is centred in what remains above.
  const rowH = Math.max(m.minRowH, Math.min(m.maxRowH, Math.floor((height - headerBottom - bottom - questionBlock - 24) / m.rows)));
  const listTop = height - bottom - rowH * m.rows;
  const questionTop = Math.max(headerBottom + 8, headerBottom + (listTop - m.questionGap - headerBottom - m.questionLine * 2) / 2);
  return { questionTop, listTop, rowH };
}
