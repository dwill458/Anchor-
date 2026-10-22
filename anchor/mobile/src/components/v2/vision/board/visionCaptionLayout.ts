/**
 * Polaroid caption sizing.
 *
 * Everything here is in the size the person actually sees (display points), not in board-scene units: the board is
 * drawn at `renderScale` times its on-screen size and scaled down by the camera, so a font set in scene units shows
 * at a fraction of its number. Callers convert with `1 / displayScale` when they draw.
 *
 * The rule: show the caption at 16pt where the print's bottom margin holds it, step down to 14pt before giving up
 * on the margin, and below that grow the paper rather than clip, truncate or cover the photograph.
 */
export const CAPTION_FONT_SIZES = [16, 15, 14] as const;
export const CAPTION_LINE_HEIGHT = 1.18;
/** Caveat's average glyph advance as a share of its font size, a little generous so an estimate never undercounts lines. */
export const CAPTION_CHAR_WIDTH_EM = 0.46;
/** The caption's text box as a share of the print width. */
export const CAPTION_WIDTH_FRACTION = 0.84;
/** Air between the photograph's bottom edge and the first line, and below the last line, in display points. */
export const CAPTION_PAD = 4;

export type CaptionPlan = {
  /** Font size, display points. */
  fontSize: number;
  lineHeight: number;
  lines: number;
  /** Text block height, display points. */
  textHeight: number;
  /** Text box width, display points. */
  width: number;
  /** Paper to add under the print's own bottom margin, display points. Zero when the margin holds the caption. */
  extra: number;
};

/** Greedy word wrap with an average glyph width. Words wider than a line break across lines. */
export function estimateCaptionLines(text: string, fontSize: number, width: number): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const perLine = Math.max(1, Math.floor(width / (fontSize * CAPTION_CHAR_WIDTH_EM)));
  let lines = 1, used = 0;
  for (const word of trimmed.split(/\s+/)) {
    let remaining = word.length;
    while (remaining > perLine) {
      if (used > 0) { lines += 1; used = 0; }
      remaining -= perLine;
      lines += 1;
    }
    const need = (used > 0 ? 1 : 0) + remaining;
    if (used + need > perLine) { lines += 1; used = remaining; } else used += need;
  }
  return lines;
}

/**
 * Plans a caption for one print. `printWidth` and `margin` are the print's width and the height of its bottom paper
 * margin, both in display points.
 */
export function planCaption(text: string, printWidth: number, margin: number): CaptionPlan | null {
  const clean = text.trim();
  if (!clean || !(printWidth > 0)) return null;
  const width = printWidth * CAPTION_WIDTH_FRACTION;
  const room = Math.max(0, margin - CAPTION_PAD * 2);
  for (const fontSize of CAPTION_FONT_SIZES) {
    const lines = estimateCaptionLines(clean, fontSize, width);
    const lineHeight = fontSize * CAPTION_LINE_HEIGHT;
    if (lines * lineHeight <= room) return { fontSize, lineHeight, lines, textHeight: lines * lineHeight, width, extra: 0 };
  }
  const fontSize = CAPTION_FONT_SIZES[CAPTION_FONT_SIZES.length - 1];
  const lines = estimateCaptionLines(clean, fontSize, width);
  const lineHeight = fontSize * CAPTION_LINE_HEIGHT;
  const textHeight = lines * lineHeight;
  return { fontSize, lineHeight, lines, textHeight, width, extra: Math.max(0, textHeight + CAPTION_PAD * 2 - margin) };
}

/** Where the print's photograph window ends, as a share of the print height (the polaroid art's aperture). */
export const POLAROID_WINDOW_BOTTOM = 0.78;
