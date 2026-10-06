/**
 * Line-breaking and sizing for the intention on share posters.
 *
 * The wording is never changed or truncated. Layout adapts instead: lines are
 * balanced (no arbitrary device-width wrapping), type steps down only to a
 * floor, and past that the text drops from uppercase to sentence case and, as
 * a last resort, takes more lines. All measurements are in 1080-wide poster
 * pixels; templates scale them by `width / 1080`.
 */

export type IntentionMode = 'statement' | 'manifesto' | 'longform';
export type IntentionPreset = IntentionMode | 'style';

interface PresetSpec {
  uppercase: boolean;
  maxFont: number;
  minFont: number;
  /** Average glyph advance over font size, letter-spacing included. Deliberately a little wide. */
  charWidth: number;
  lineHeight: number;
  /** Letter-spacing over font size. */
  tracking: number;
  /** Line count that reads best; tried first, at the largest size that achieves it. */
  preferLines: number;
  maxLines: number;
}

const SPEC: Record<IntentionPreset, PresetSpec> = {
  style: { uppercase: false, maxFont: 72, minFont: 46, charWidth: 0.47, lineHeight: 1.18, tracking: 0, preferLines: 3, maxLines: 4 },
  statement: { uppercase: true, maxFont: 156, minFont: 100, charWidth: 0.66, lineHeight: 1.04, tracking: 0.03, preferLines: 3, maxLines: 4 },
  manifesto: { uppercase: true, maxFont: 96, minFont: 60, charWidth: 0.64, lineHeight: 1.12, tracking: 0.03, preferLines: 3, maxLines: 5 },
  longform: { uppercase: false, maxFont: 72, minFont: 48, charWidth: 0.47, lineHeight: 1.3, tracking: 0, preferLines: 6, maxLines: 10 },
};
const SENTENCE_CASE_CHAR_WIDTH = 0.47;

export interface IntentionLayout {
  mode: IntentionPreset;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  uppercase: boolean;
  /** Total height of the text block. */
  blockHeight: number;
}

/** Statement: up to 5 words. Manifesto: 6-12. Longform: more (or very many characters). */
export function classifyIntention(text: string): IntentionMode {
  const clean = text.trim().replace(/\s+/g, ' ');
  const words = clean ? clean.split(' ').length : 0;
  if (words > 12 || clean.length > 80) return 'longform';
  if (words > 5 || clean.length > 34) return 'manifesto';
  return 'statement';
}

const WEAK_LINE_END = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'my', 'our', 'your', 'i']);

function lineLength(words: string[], from: number, to: number) {
  let length = to - from - 1;
  for (let i = from; i < to; i += 1) length += words[i].length;
  return length;
}

function partition(words: string[], maxChars: number, lines: number): string[] | null {
  const n = words.length;
  if (lines > n) return null;
  const total = lineLength(words, 0, n);
  const target = total / lines;
  const INF = Number.POSITIVE_INFINITY;
  // best[k][i]: lowest cost of setting the first i words in k lines.
  const best: number[][] = Array.from({ length: lines + 1 }, () => new Array<number>(n + 1).fill(INF));
  const prev: number[][] = Array.from({ length: lines + 1 }, () => new Array<number>(n + 1).fill(0));
  best[0][0] = 0;
  for (let k = 1; k <= lines; k += 1) {
    for (let i = k; i <= n; i += 1) {
      for (let j = k - 1; j < i; j += 1) {
        if (best[k - 1][j] === INF) continue;
        const length = lineLength(words, j, i);
        if (length > maxChars) continue;
        let cost = (length - target) ** 2;
        if (WEAK_LINE_END.has(words[i - 1].toLowerCase()) && i < n) cost += target * 1.5;
        if (k === lines && i - j === 1 && length <= 3 && n > 1) cost += target * target * 0.4;
        const total2 = best[k - 1][j] + cost;
        if (total2 < best[k][i]) {
          best[k][i] = total2;
          prev[k][i] = j;
        }
      }
    }
  }
  if (best[lines][n] === INF) return null;
  const out: string[] = [];
  let i = n;
  for (let k = lines; k >= 1; k -= 1) {
    const j = prev[k][i];
    out.unshift(words.slice(j, i).join(' '));
    i = j;
  }
  return out;
}

/** Balanced lines no wider than `maxChars`, or null when a single word is wider than that. */
export function balancedBreak(text: string, maxChars: number): string[] | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.some((word) => word.length > maxChars)) return null;
  const minLines = Math.max(1, Math.ceil(lineLength(words, 0, words.length) / maxChars));
  const first = partition(words, maxChars, minLines);
  if (!first) {
    return partition(words, maxChars, Math.min(words.length, minLines + 1));
  }
  // One more line is worth it only to rescue a trailing orphan.
  const last = first[first.length - 1];
  const orphan = first.length > 1 && !last.includes(' ') && last.length <= 3;
  if (orphan && minLines + 1 <= words.length) {
    const alt = partition(words, maxChars, minLines + 1);
    const altLast = alt?.[alt.length - 1];
    if (alt && altLast && (altLast.includes(' ') || altLast.length > 3)) return alt;
  }
  return first;
}

function attempt(text: string, spec: PresetSpec, mode: IntentionPreset, column: number, uppercase: boolean, charWidth: number, limit: number): IntentionLayout | null {
  const body = uppercase ? text.toLocaleUpperCase() : text;
  for (let font = spec.maxFont; font >= spec.minFont; font -= 4) {
    const maxChars = Math.floor(column / (font * charWidth));
    if (maxChars < 1) continue;
    const lines = balancedBreak(body, maxChars);
    if (lines && lines.length <= limit) return build(lines, spec, mode, font, uppercase);
  }
  return null;
}

function build(lines: string[], spec: PresetSpec, mode: IntentionPreset, font: number, uppercase: boolean): IntentionLayout {
  return {
    mode,
    lines,
    fontSize: font,
    lineHeight: font * spec.lineHeight,
    letterSpacing: uppercase ? font * spec.tracking : 0,
    uppercase,
    blockHeight: lines.length * font * spec.lineHeight,
  };
}

/**
 * Lays an intention out for a column `column` px wide (1080-wide poster
 * space). Never truncates: if nothing fits at the floor size the text takes
 * more lines.
 */
export function layoutIntention(
  text: string,
  preset: IntentionPreset,
  column: number,
  options: { quote?: boolean } = {},
): IntentionLayout {
  const plain = text.trim().replace(/\s+/g, ' ');
  // Smart quotes frame the statement and are set with the words, so they take part in line breaking.
  const alreadyQuoted = /^["“‘«]/.test(plain);
  const clean = options.quote && plain && !alreadyQuoted ? `“${plain}”` : plain;
  const spec = SPEC[preset];
  for (const limit of [spec.preferLines, spec.maxLines]) {
    const fit = attempt(clean, spec, preset, column, spec.uppercase, spec.charWidth, limit);
    if (fit) return fit;
  }
  if (spec.uppercase) {
    const sentence = attempt(clean, spec, preset, column, false, SENTENCE_CASE_CHAR_WIDTH, spec.maxLines);
    if (sentence) return sentence;
  }
  // Last resort: the floor size, as many lines as the words need.
  const maxChars = Math.max(
    Math.floor(column / (spec.minFont * SENTENCE_CASE_CHAR_WIDTH)),
    ...clean.split(' ').map((word) => word.length),
    1,
  );
  const lines = balancedBreak(clean, maxChars) ?? [clean];
  return build(lines, spec, preset, spec.minFont, false);
}
