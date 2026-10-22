import { MASTER_ASSETS, engravingStart, getMasterAsset } from '../masterAssets';

describe('master collectible geometry', () => {
  it('selects only the four commissioned masters, preserving other legacy artwork', () => {
    expect(Object.keys(MASTER_ASSETS)).toEqual(['strength.full', 'commitment.practices.1', 'journey.goal', 'vision.first']);
    expect(getMasterAsset('commitment.practices.10')).toBeUndefined();
  });

  it('traces the Commitment boundary before forming the star and illuminates the center last', () => {
    const paths = MASTER_ASSETS['commitment.practices.1'].paths;
    const start = (id: string) => { const i = paths.findIndex(p => p.id === id); return engravingStart(paths[i], i, 'commitment'); };
    expect(start('ring-47')).toBeLessThan(start('eight-point-outline'));
    expect(start('eight-point-outline')).toBeLessThan(start('focal'));
  });

  it('has separately addressable engraving, accents and focal geometry', () => {
    for (const asset of Object.values(MASTER_ASSETS)) {
      expect(new Set(asset.paths.map(p => p.id)).size).toBe(asset.paths.length);
      expect(asset.paths.some(p => p.layer === 'engraving')).toBe(true);
      expect(asset.paths.some(p => p.layer === 'metal')).toBe(true);
      expect(asset.paths.some(p => p.layer === 'focal')).toBe(true);
      for (const p of asset.paths) {
        expect(p.d).not.toMatch(/NaN|undefined|Infinity/);
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });
});
