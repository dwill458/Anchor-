import {
  COMPACT_PHONE_HEIGHT,
  COMPACT_PHONE_WIDTH,
  SHORT_PHONE_HEIGHT,
  isCompactPhoneViewport,
  isShortPhoneViewport,
} from '@/utils/layout';

describe('layout viewport helpers', () => {
  it('keeps tall large phones out of compact mode', () => {
    expect(isCompactPhoneViewport(412, 915)).toBe(false);
    expect(isCompactPhoneViewport(430, 932)).toBe(false);
  });

  it('keeps smaller or shorter phones in compact mode', () => {
    expect(isCompactPhoneViewport(COMPACT_PHONE_WIDTH, 915)).toBe(true);
    expect(isCompactPhoneViewport(412, COMPACT_PHONE_HEIGHT)).toBe(true);
    expect(isCompactPhoneViewport(360, 915)).toBe(true);
  });

  it('flags only short viewports as short layouts', () => {
    expect(isShortPhoneViewport(SHORT_PHONE_HEIGHT)).toBe(true);
    expect(isShortPhoneViewport(SHORT_PHONE_HEIGHT + 1)).toBe(false);
  });
});
