import { PlanetaryTier } from '@/types';
import { getGridConfig } from './gridRegistry';
import {
  MIN_SEGMENT_ANGLE_DEG,
  SHARP_TURN_MIN_LETTERS,
  describeTrueSigil,
  interiorAngleDeg,
  relaxSharpTurns,
} from './traditional-generator';

const LONG_DESIRES = [
  'I want to build a strong and lasting wealth for my family',
  'Break through every barrier standing between me and the stage',
  'My body is strong, my mind is calm, and my focus never breaks',
  'Win the championship by playing smart, tough, and relentless',
  'Grow my business into something truly worldwide and thriving',
  'Practice daily until the difficult becomes natural and fluid',
];

const consonants = (text: string) => new Set(text.toUpperCase().replace(/[^A-Z]/g, '').replace(/[AEIOU]/g, '')).size;
const minAngle = (vs: Array<{ x: number; y: number }>) => {
  let min = 180;
  for (let i = 1; i < vs.length - 1; i += 1) min = Math.min(min, interiorAngleDeg(vs[i - 1], vs[i], vs[i + 1]));
  return min;
};

describe('sharp-turn relaxation on the Sun (Desire) field', () => {
  it('measures the interior angle', () => {
    expect(interiorAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 6);
    expect(interiorAngleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0, 6);
    expect(interiorAngleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 6);
  });

  it('opens sharp folds on 11+ letter paths: never worse than the raw cells, better wherever it was sharp', () => {
    let sharpBefore = 0;
    let sharpAfter = 0;
    let improved = 0;
    LONG_DESIRES.forEach((text) => {
      expect(consonants(text)).toBeGreaterThanOrEqual(SHARP_TURN_MIN_LETTERS);
      const { vertices } = describeTrueSigil(text, PlanetaryTier.SUN, 'balanced');
      for (let i = 1; i < vertices.length - 1; i += 1) {
        const raw = interiorAngleDeg(vertices[i - 1].cell, vertices[i].cell, vertices[i + 1].cell);
        const now = interiorAngleDeg(vertices[i - 1], vertices[i], vertices[i + 1]);
        if (raw < MIN_SEGMENT_ANGLE_DEG) {
          sharpBefore += 1;
          if (now < MIN_SEGMENT_ANGLE_DEG) sharpAfter += 1;
          if (now > raw) improved += 1;
        }
      }
      // Most of these paths clear the floor outright; none may be left near a flat fold.
      expect(minAngle(vertices)).toBeGreaterThan(10);
    });
    expect(sharpBefore).toBeGreaterThan(0);
    expect(improved).toBe(sharpBefore);
    expect(sharpAfter).toBeLessThanOrEqual(Math.floor(sharpBefore / 3));
  });

  it('keeps every letter in its own cell, in order, close to the cell centre', () => {
    const grid = getGridConfig(PlanetaryTier.SUN);
    const cellStep = 60 / (grid.size - 1);
    LONG_DESIRES.forEach((text) => {
      const { vertices } = describeTrueSigil(text, PlanetaryTier.SUN, 'balanced');
      const letters = text.toUpperCase().replace(/[^A-Z]/g, '').replace(/[AEIOU]/g, '');
      expect(vertices.map((v) => v.letter).join('')).toBe(Array.from(new Set(letters.split(''))).join(''));
      vertices.forEach((v) => {
        expect(Math.abs(v.x - v.cell.x)).toBeLessThanOrEqual(cellStep / 2);
        expect(Math.abs(v.y - v.cell.y)).toBeLessThanOrEqual(cellStep / 2);
      });
    });
  });

  it('is deterministic and leaves short paths and other fields untouched', () => {
    const text = LONG_DESIRES[0];
    expect(describeTrueSigil(text, PlanetaryTier.SUN, 'balanced').pathData).toBe(describeTrueSigil(text, PlanetaryTier.SUN, 'balanced').pathData);
    const grid = getGridConfig(PlanetaryTier.SUN);
    const short = describeTrueSigil('Cold at basketball', PlanetaryTier.SUN, 'balanced').vertices;
    expect(relaxSharpTurns(short.slice(0, SHARP_TURN_MIN_LETTERS - 1), grid)).toEqual(short.slice(0, SHARP_TURN_MIN_LETTERS - 1));
    // Another tier keeps its raw path: relaxation is the Sun field's alone.
    const mars = describeTrueSigil(text, PlanetaryTier.MARS, 'balanced').vertices;
    mars.forEach((v) => expect(Math.abs(v.x - v.cell.x)).toBeLessThanOrEqual(2.01));
  });
});
