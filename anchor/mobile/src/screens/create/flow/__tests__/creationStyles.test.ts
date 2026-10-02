import { REFINE_STYLES } from '../../constants/refineStyles';
import {
  BLOCKED_STYLE_IDS,
  ROTATION_POOL,
  applyPickedStyle,
  getAllStyles,
  getChipStyleIds,
  getDefaultStyleId,
} from '../creationStyles';

describe('creationStyles', () => {
  it('rotation pool has at least 8 ids, all real, none blocked', () => {
    expect(ROTATION_POOL.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(REFINE_STYLES.map((s) => s.id));
    ROTATION_POOL.forEach((id) => {
      expect(ids.has(id)).toBe(true);
      expect(BLOCKED_STYLE_IDS.has(id)).toBe(false);
    });
  });

  it('every blocked id is a real shipped style', () => {
    const ids = new Set(REFINE_STYLES.map((s) => s.id));
    BLOCKED_STYLE_IDS.forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it('default is the last committed style when there is one', () => {
    expect(getDefaultStyleId('career', 'Close the deal', 'watercolor')).toBe('watercolor');
  });

  it('default falls back to the first non-blocked recommendation', () => {
    const id = getDefaultStyleId('spirituality', 'Find inner peace');
    expect(BLOCKED_STYLE_IDS.has(id)).toBe(false);
    expect(REFINE_STYLES.some((s) => s.id === id)).toBe(true);
  });

  it('ignores a last style that is blocked or unknown', () => {
    expect(BLOCKED_STYLE_IDS.has(getDefaultStyleId('career', 'Lead well', 'cosmic'))).toBe(false);
    expect(REFINE_STYLES.some((s) => s.id === getDefaultStyleId('career', 'Lead well', 'nope'))).toBe(true);
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
    const a = getChipStyleIds('watercolor', 1);
    expect(a[1]).toBe(ROTATION_POOL[1]);
    const wrapped = getChipStyleIds('watercolor', ROTATION_POOL.length);
    expect(wrapped).toEqual(getChipStyleIds('watercolor', 0));
  });

  it('a blocklisted style is never a chip from rotation', () => {
    for (let counter = 0; counter < 20; counter += 1) {
      const chips = getChipStyleIds(getDefaultStyleId('desire', 'Be bold'), counter);
      chips.forEach((id) => expect(BLOCKED_STYLE_IDS.has(id)).toBe(false));
    }
  });

  it('the all-styles sheet lists all 20 shipped styles, blocked ones included', () => {
    const all = getAllStyles();
    expect(all).toHaveLength(20);
    BLOCKED_STYLE_IDS.forEach((id) => expect(all.some((s) => s.id === id)).toBe(true));
  });

  it('a picked style replaces the third chip, never the default', () => {
    const chips = ['watercolor', 'ink-brush', 'gold-leaf'];
    expect(applyPickedStyle(chips, 'lunar-etch')).toEqual(['watercolor', 'ink-brush', 'lunar-etch']);
    expect(applyPickedStyle(chips, 'ink-brush')).toBe(chips);
  });
});
