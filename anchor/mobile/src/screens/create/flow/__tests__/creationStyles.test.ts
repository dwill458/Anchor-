import { REFINE_STYLES } from '../../constants/refineStyles';
import {
  BLOCKED_STYLE_IDS,
  ROTATION_POOL,
  applyPickedStyle,
  getAllStyles,
  getChipStyleIds,
  getDefaultStyleId,
  getStyleById,
} from '../creationStyles';

describe('creationStyles (Anchor 2.0)', () => {
  it('rotation pool has exactly 15 styles, all real, none blocked', () => {
    expect(ROTATION_POOL).toHaveLength(15);
    const ids = new Set(REFINE_STYLES.map((s) => s.id));
    ROTATION_POOL.forEach((id) => {
      expect(ids.has(id)).toBe(true);
      expect(BLOCKED_STYLE_IDS.has(id)).toBe(false);
    });
  });

  it('default is the last committed style when there is one', () => {
    expect(getDefaultStyleId('career', 'Close the deal', 'velvet-ember')).toBe('velvet-ember');
  });

  it('resolves legacy style IDs via compatibility fallback without crashing', () => {
    const legacy = getStyleById('watercolor');
    expect(legacy).toBeDefined();
    expect(REFINE_STYLES.some((s) => s.id === legacy?.id)).toBe(true);

    const legacyDefault = getDefaultStyleId('career', 'Close the deal', 'watercolor');
    expect(REFINE_STYLES.some((s) => s.id === legacyDefault)).toBe(true);
  });

  it('default falls back to the first non-blocked recommendation', () => {
    const id = getDefaultStyleId('spirituality', 'Find inner peace');
    expect(BLOCKED_STYLE_IDS.has(id)).toBe(false);
    expect(REFINE_STYLES.some((s) => s.id === id)).toBe(true);
  });

  it('chips are the default plus two rotation entries, skipping the default', () => {
    const start = ROTATION_POOL[0];
    const chips = getChipStyleIds(start, 0);
    expect(chips).toHaveLength(3);
    expect(chips[0]).toBe(start);
    expect(chips[1]).toBe(ROTATION_POOL[1]);
    expect(chips[2]).toBe(ROTATION_POOL[2]);
    expect(new Set(chips).size).toBe(3);
  });

  it('rotation advances with the counter and wraps', () => {
    const a = getChipStyleIds('velvet-ember', 1);
    expect(a[1]).toBe(ROTATION_POOL[1]);
    const wrapped = getChipStyleIds('velvet-ember', ROTATION_POOL.length);
    expect(wrapped).toEqual(getChipStyleIds('velvet-ember', 0));
  });

  it('the all-styles sheet lists all 15 Anchor 2.0 styles', () => {
    const all = getAllStyles();
    expect(all).toHaveLength(15);
  });

  it('a picked style replaces the third chip, never the default', () => {
    const chips = ['velvet-ember', 'porcelain', 'prism-flow'];
    expect(applyPickedStyle(chips, 'joybrush')).toEqual(['velvet-ember', 'porcelain', 'joybrush']);
    expect(applyPickedStyle(chips, 'porcelain')).toBe(chips);
  });
});
