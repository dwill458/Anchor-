import { VISION_ENTRANCE_ART, visionEntranceScene, visionPossibleFuturePhoto } from '../visionArt';

const CATEGORIES = [
  'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
  'abundance', 'family', 'learning', 'adventure', 'custom',
] as const;

describe('Vision entrance art', () => {
  it('gives every established category three curated photographs', () => {
    const sources = CATEGORIES.flatMap(category => VISION_ENTRANCE_ART[category]);
    expect(sources).toHaveLength(CATEGORIES.length * 3);
    expect(sources.every(source => source !== undefined && source !== null)).toBe(true);
    expect(new Set(sources).size).toBe(CATEGORIES.length * 3);
    expect(Object.keys(VISION_ENTRANCE_ART).sort()).toEqual([...CATEGORIES].sort());
  });

  it('uses a stable Anchor id for variety without random entry changes', () => {
    expect(visionEntranceScene('CAREER', 'career-anchor-a')).toBe(visionEntranceScene('CAREER', 'career-anchor-a'));
    const sceneIds = ['career-anchor-a', 'career-anchor-b', 'career-anchor-c', 'career-anchor-d']
      .map(id => visionEntranceScene('CAREER', id));
    expect(new Set(sceneIds).size).toBeGreaterThan(1);
  });

  it('uses the persisted category, whatever its casing', () => {
    expect(visionPossibleFuturePhoto('CAREER', 'career-anchor')).toBe(visionEntranceScene('career', 'career-anchor'));
    expect(visionPossibleFuturePhoto(' family ', 'family-anchor')).toBe(visionEntranceScene('family', 'family-anchor'));
  });

  it('always has intentional art for a missing or unknown category', () => {
    expect(visionPossibleFuturePhoto(undefined)).toBe(VISION_ENTRANCE_ART.custom[0]);
    expect(visionPossibleFuturePhoto('not-a-category')).toBe(VISION_ENTRANCE_ART.custom[0]);
  });
});
