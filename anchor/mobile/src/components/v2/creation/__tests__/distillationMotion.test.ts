import {
  buildDistillationRenderModel,
  computeCompactionTargets,
  distillationSchedule,
  isCellRemoved,
  DISTILL_TIMING,
  type DistillationCell,
  type MeasuredLetter,
} from '../distillationMotion';
import { distillIntention } from '@/utils/sigil/distillation';

const SAMPLES = [
  'I BUILD THE BUSINESS I ENVISION',
  'I finish the project',
  'Close the deal',
  'Find inner peace',
  "I'm ready, 100%.",
  'AEIOU aeiou tt',
];

const cells = (text: string) => buildDistillationRenderModel(text).words.flatMap((word) => word.cells);

describe('buildDistillationRenderModel', () => {
  it('keeps exactly the letters the production algorithm keeps, in the same order', () => {
    for (const text of SAMPLES) {
      expect(buildDistillationRenderModel(text).keptLetters).toEqual(distillIntention(text).finalLetters);
    }
  });

  it('agrees with the algorithm on the normalized intention the step is actually handed', () => {
    const raw = '  I  build   the\tbusiness I envision  ';
    const normalized = raw.trim().replace(/\s+/g, ' ');
    expect(buildDistillationRenderModel(normalized).keptLetters).toEqual(distillIntention(raw).finalLetters);
  });

  it('attributes each removal to the pass that drops it', () => {
    expect(cells('I lead').map((cell) => [cell.char, cell.keep, cell.removalStep])).toEqual([
      ['I', false, 1],
      ['L', true, null],
      ['E', false, 1],
      ['A', false, 1],
      ['D', true, null],
    ]);
  });

  it('drops a repeated consonant on the second pass, keeping the first occurrence', () => {
    expect(cells('TEST').filter((cell) => cell.char === 'T').map((cell) => [cell.keep, cell.removalStep])).toEqual([
      [true, null],
      [false, 2],
    ]);
  });

  it('never keeps punctuation or digits, and retires them with the vowels', () => {
    for (const cell of cells("I'm ready, 100%.")) {
      if (!/[A-Za-z]/.test(cell.char)) {
        expect(cell.keep).toBe(false);
        expect(cell.removalStep).toBe(1);
      }
    }
  });

  it('numbers survivors by their slot in the settled sequence', () => {
    const model = buildDistillationRenderModel('Close the deal');
    const kept = model.words.flatMap((word) => word.cells).filter((cell) => cell.keep);
    expect(kept.map((cell) => cell.keptIndex)).toEqual(kept.map((_, index) => index));
    expect(kept.map((cell) => cell.char)).toEqual(model.keptLetters);
    expect(model.keptCount).toBe(kept.length);
  });

  it('orders the cascade left to right across word boundaries', () => {
    const staggers = cells('AB CD').map((cell) => cell.staggerIndex);
    expect(staggers).toEqual([...staggers].sort((a, b) => a - b));
    expect(new Set(staggers).size).toBe(staggers.length);
  });
});

describe('isCellRemoved', () => {
  const vowel: DistillationCell = { char: 'E', keep: false, removalStep: 1, staggerIndex: 0, keptIndex: -1 };
  const repeat: DistillationCell = { char: 'T', keep: false, removalStep: 2, staggerIndex: 1, keptIndex: -1 };
  const survivor: DistillationCell = { char: 'B', keep: true, removalStep: null, staggerIndex: 2, keptIndex: 0 };

  it('shows the whole phrase before any pass has run', () => {
    expect(isCellRemoved(vowel, 'whole')).toBe(false);
    expect(isCellRemoved(repeat, 'whole')).toBe(false);
  });

  it('drops vowels and repeats on separate passes, never together', () => {
    expect(isCellRemoved(vowel, 'vowels')).toBe(true);
    // The repeated consonants are still readable while the vowels are leaving.
    expect(isCellRemoved(repeat, 'vowels')).toBe(false);
    expect(isCellRemoved(repeat, 'repeats')).toBe(true);
  });

  it('never removes a surviving letter, at any stage', () => {
    for (const stage of ['whole', 'vowels', 'repeats', 'compact', 'settled'] as const) {
      expect(isCellRemoved(survivor, stage)).toBe(false);
    }
  });
});

describe('distillationSchedule', () => {
  it('holds the untouched phrase before the first removal', () => {
    expect(distillationSchedule(0).vowels).toBe(DISTILL_TIMING.holdWhole);
  });

  it('runs the passes in order, with the compaction settling last', () => {
    const at = distillationSchedule(6);
    expect(at.vowels).toBeLessThan(at.repeats);
    expect(at.repeats).toBeLessThan(at.compact);
    expect(at.compact).toBeLessThan(at.settled);
  });

  it('stretches a pass so a long phrase finishes its cascade before the next one starts', () => {
    const short = distillationSchedule(2);
    const long = distillationSchedule(120);
    const shortPass = short.repeats - short.vowels;
    const longPass = long.repeats - long.vowels;
    expect(shortPass).toBe(DISTILL_TIMING.stage);
    expect(longPass).toBeGreaterThan(shortPass);
    expect(longPass).toBeGreaterThanOrEqual(120 * DISTILL_TIMING.letterStagger + DISTILL_TIMING.letterFade);
  });
});

describe('computeCompactionTargets', () => {
  const row = (count: number, width: number, pitch: number): MeasuredLetter[] =>
    Array.from({ length: count }, (_, index) => ({
      keptIndex: index,
      x: index * pitch,
      y: 0,
      width,
      height: 30,
    }));

  /** Where the glyph ends up on screen, accounting for `scale` pivoting on its own centre. */
  const visualLeft = (letter: MeasuredLetter, target: { dx: number; scale: number }) =>
    letter.x + target.dx + (letter.width - letter.width * target.scale) / 2;

  it('closes the gaps to an even tracking while preserving order', () => {
    const letters = row(3, 20, 100);
    const targets = computeCompactionTargets(letters, { width: 300, height: 100 }, { tracking: 14, edgeInset: 8 });

    const lefts = letters.map((letter) => visualLeft(letter, targets.get(letter.keptIndex)!));
    expect(lefts[1] - (lefts[0] + 20)).toBeCloseTo(14);
    expect(lefts[2] - (lefts[1] + 20)).toBeCloseTo(14);
    // The travel is real: a letter that started 200pt out does not stay there.
    expect(targets.get(2)!.dx).toBeLessThan(0);
    expect(targets.get(0)!.dx).toBeGreaterThan(0);
  });

  it('centres the settled row in the stage, horizontally and vertically', () => {
    const letters = row(3, 20, 100);
    const targets = computeCompactionTargets(letters, { width: 300, height: 100 }, { tracking: 14, edgeInset: 8 });

    const lefts = letters.map((letter) => visualLeft(letter, targets.get(letter.keptIndex)!));
    expect(lefts[0] + (lefts[2] + 20 - lefts[0]) / 2).toBeCloseTo(150);
    expect(letters[0].y + targets.get(0)!.dy + 30 / 2).toBeCloseTo(50);
  });

  it('surrenders tracking before legibility when the row is tight', () => {
    // Nine 30pt glyphs (270pt) leave only 14pt of slack inside a 284pt stage.
    const targets = computeCompactionTargets(row(9, 30, 30), { width: 300, height: 100 }, { tracking: 14, edgeInset: 8 });
    expect(targets.get(0)!.scale).toBe(1);
    expect(targets.get(1)!.dx + 30 - targets.get(0)!.dx - 30).toBeLessThan(14);
  });

  it('shrinks the sequence only once tracking is exhausted, and still fits the stage', () => {
    const letters = row(3, 200, 220);
    const targets = computeCompactionTargets(letters, { width: 300, height: 100 }, { tracking: 14, edgeInset: 8 });

    const scale = targets.get(0)!.scale;
    expect(scale).toBeLessThan(1);
    const lefts = letters.map((letter) => visualLeft(letter, targets.get(letter.keptIndex)!));
    expect(lefts[0]).toBeGreaterThanOrEqual(8 - 0.001);
    expect(lefts[2] + 200 * scale).toBeLessThanOrEqual(292 + 0.001);
  });

  it('returns nothing to animate before the stage or the letters have been measured', () => {
    expect(computeCompactionTargets(row(3, 20, 100), { width: 0, height: 0 }).size).toBe(0);
    expect(computeCompactionTargets([], { width: 300, height: 100 }).size).toBe(0);
  });
});
