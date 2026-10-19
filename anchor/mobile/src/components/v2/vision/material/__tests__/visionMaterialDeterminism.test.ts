import { buildPaperTexture } from '../VisionPaperSurface';
import { createSeededRandom, seededRotation } from '../visionMaterialRandom';

describe('visionMaterial determinism', () => {
  it('produces the same random sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const first = Array.from({ length: 20 }, () => a());
    const second = Array.from({ length: 20 }, () => b());
    expect(first).toEqual(second);
    first.forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it('produces different sequences for different seeds', () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });

  it('treats non-finite seeds as a stable zero seed', () => {
    expect(createSeededRandom(Number.NaN)()).toBe(createSeededRandom(0)());
  });

  it('builds identical paper texture for the same seed', () => {
    const first = buildPaperTexture(7);
    const second = buildPaperTexture(7);
    expect(first.grain).toBe(second.grain);
    expect(first.fibres).toBe(second.fibres);
    expect(first.grain.length).toBeGreaterThan(0);
    expect(first.fibres.length).toBeGreaterThan(0);
  });

  it('builds different paper texture for different seeds', () => {
    expect(buildPaperTexture(7).grain).not.toBe(buildPaperTexture(8).grain);
  });

  it('gives the same rotation for the same seed and keeps it within the limit', () => {
    expect(seededRotation(5, 6)).toBe(seededRotation(5, 6));
    for (let seed = 0; seed < 200; seed++) {
      const deg = seededRotation(seed, 6);
      expect(Math.abs(deg)).toBeLessThanOrEqual(6);
    }
  });
});
