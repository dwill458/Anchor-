import { VISION_ENTRANCE_ART, visionPossibleFuturePhoto } from '../visionArt';

const CATEGORIES = [
  'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
  'abundance', 'family', 'learning', 'adventure', 'custom',
] as const;

describe('Vision entrance art', () => {
  it('gives every established category its own photograph', () => {
    const sources = CATEGORIES.map(category => visionPossibleFuturePhoto(category));
    expect(sources.every(source => source !== undefined && source !== null)).toBe(true);
    expect(new Set(sources).size).toBe(CATEGORIES.length);
    expect(Object.keys(VISION_ENTRANCE_ART).sort()).toEqual([...CATEGORIES].sort());
  });

  it('uses the persisted category, whatever its casing', () => {
    expect(visionPossibleFuturePhoto('CAREER')).toBe(VISION_ENTRANCE_ART.career);
    expect(visionPossibleFuturePhoto(' family ')).toBe(VISION_ENTRANCE_ART.family);
  });

  it('always has intentional art for a missing or unknown category', () => {
    expect(visionPossibleFuturePhoto(undefined)).toBe(VISION_ENTRANCE_ART.custom);
    expect(visionPossibleFuturePhoto('not-a-category')).toBe(VISION_ENTRANCE_ART.custom);
  });
});
