import fs from 'fs';
import path from 'path';
import type { AnchorCategory } from '@/types';
import { editDistancePct, VISION_EXAMPLE_COPY, visionExamplesFor } from '../visionExamples';

const FORBIDDEN = /\b(sigil|ritual|charge|spell|streak|attract|mindfulness|meditation|vision board|occult|prime|priming)\b/i;
const CATEGORIES = Object.keys(VISION_EXAMPLE_COPY) as AnchorCategory[];

/** Loads the manifest against a stand-in picture table, so the fill rules are tested without the 33 files. */
function examplesWith(images: Record<string, Record<number, unknown>>, category: AnchorCategory) {
  let result: ReturnType<typeof visionExamplesFor> = [];
  jest.isolateModules(() => {
    jest.doMock('../visionExampleImages', () => ({ VISION_EXAMPLE_IMAGES: images }));
    result = require('../visionExamples').visionExamplesFor(category);
  });
  jest.dontMock('../visionExampleImages');
  return result;
}
const pics = (...slots: number[]) => Object.fromEntries(slots.map(slot => [slot, { uri: `file:///${slot}.webp` }]));

describe('Vision example copy', () => {
  it('has three examples for each of the eleven categories', () => {
    expect(CATEGORIES).toHaveLength(11);
    for (const category of CATEGORIES) expect(VISION_EXAMPLE_COPY[category]).toHaveLength(3);
  });
  it('keeps every caption within 30 characters and every moment within 400', () => {
    for (const category of CATEGORIES) for (const row of VISION_EXAMPLE_COPY[category]) {
      expect(row.caption.length).toBeGreaterThan(0); expect(row.caption.length).toBeLessThanOrEqual(30);
      expect(row.moment.length).toBeGreaterThan(0); expect(row.moment.length).toBeLessThanOrEqual(400);
    }
  });
  it('contains no forbidden vocabulary', () => {
    for (const category of CATEGORIES) for (const row of VISION_EXAMPLE_COPY[category]) expect(`${row.caption} ${row.moment}`).not.toMatch(FORBIDDEN);
  });
});

describe('visionExamplesFor', () => {
  it('returns the category pictures in order with their copy', () => {
    const list = examplesWith({ health: pics(1, 2, 3) }, 'health');
    expect(list.map(item => item.caption)).toEqual(VISION_EXAMPLE_COPY.health.map(row => row.caption));
    expect(list[1]).toEqual({ image: { uri: 'file:///2.webp' }, ...VISION_EXAMPLE_COPY.health[1] });
  });
  it('fills a missing picture with its built-in stand-in and keeps every row\'s own copy', () => {
    const list = examplesWith({ health: pics(1, 3), custom: {} }, 'health');
    expect(list.map(item => item.caption)).toEqual(VISION_EXAMPLE_COPY.health.map(row => row.caption));
    expect(list[0].image).toEqual({ uri: 'file:///1.webp' });
    expect(list[1].image).not.toEqual({ uri: 'file:///2.webp' });
  });
  it('always returns three examples per category, even with no generated pictures', () => {
    for (const category of CATEGORIES) expect(examplesWith({}, category)).toHaveLength(3);
  });
  it('compiles and returns an array with whatever pictures exist today', () => {
    for (const category of CATEGORIES) { const list = visionExamplesFor(category); expect(list.length).toBeLessThanOrEqual(3); }
  });
});

describe('example pictures on disk', () => {
  const root = path.resolve(__dirname, '../../../../../assets/vision/examples');
  const manifest = fs.readFileSync(path.resolve(__dirname, '../visionExampleImages.ts'), 'utf8');
  const onDisk = fs.existsSync(root) ? CATEGORIES.flatMap(category => [1, 2, 3].filter(n => fs.existsSync(path.join(root, category, `${n}.webp`))).map(n => `${category}/${n}.webp`)) : [];
  it('wires every picture in assets/vision/examples into the manifest (run scripts/generate-vision-example-manifest.mjs)', () => {
    for (const file of onDisk) expect(manifest).toContain(`assets/vision/examples/${file}'`);
  });
  it('requires nothing that is not on disk', () => {
    const required = [...manifest.matchAll(/assets\/vision\/examples\/([a-z]+\/[123]\.webp)'/g)].map(match => match[1]);
    for (const file of required) expect(onDisk).toContain(file);
  });
});

describe('editDistancePct', () => {
  it('is 0 for untouched text, ignoring edge whitespace', () => {
    expect(editDistancePct('The light is quiet.', 'The light is quiet.')).toBe(0);
    expect(editDistancePct('The light is quiet.', '  The light is quiet.  ')).toBe(0);
  });
  it('is 100 when one side is empty or nothing is shared', () => {
    expect(editDistancePct('Something', '')).toBe(100); expect(editDistancePct('abc', 'xyz')).toBe(100);
  });
  it('measures characters changed against the longer text', () => {
    expect(editDistancePct('abcd', 'abcf')).toBe(25);
    const moment = VISION_EXAMPLE_COPY.health[0].moment;
    const edited = editDistancePct(moment, `${moment} Salt on my lips.`);
    expect(edited).toBeGreaterThan(0); expect(edited).toBeLessThan(25);
  });
});
