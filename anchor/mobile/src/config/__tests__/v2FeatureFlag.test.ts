import { isAnchorV2DevEnabled } from '../v2FeatureFlag';

describe('Anchor V2 development entry flag', () => {
  it('keeps the production navigator selected when disabled', () => {
    expect(isAnchorV2DevEnabled('false', true)).toBe(false);
    expect(isAnchorV2DevEnabled(undefined, true)).toBe(false);
  });

  it('allows V2 only in an approved development build', () => {
    expect(isAnchorV2DevEnabled('true', true)).toBe(true);
    expect(isAnchorV2DevEnabled('true', false)).toBe(false);
  });
});
