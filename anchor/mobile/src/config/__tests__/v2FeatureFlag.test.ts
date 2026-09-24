import { isAnchorV2Enabled } from '../v2FeatureFlag';

describe('Anchor V2 entry flag', () => {
  it('keeps the legacy navigator when disabled', () => {
    expect(isAnchorV2Enabled('false', true, 'development')).toBe(false);
    expect(isAnchorV2Enabled(undefined, true, 'development')).toBe(false);
  });

  it('allows the opt-in in development and staging preview builds only', () => {
    expect(isAnchorV2Enabled('true', true, 'development')).toBe(true);
    expect(isAnchorV2Enabled('true', false, 'staging')).toBe(true);
    expect(isAnchorV2Enabled('true', false, 'production')).toBe(false);
    expect(isAnchorV2Enabled('true', false, undefined)).toBe(false);
  });
});
