import { isAnchorV2Enabled } from '../v2FeatureFlag';

describe('Anchor V2 entry flag', () => {
  it('keeps the legacy navigator when explicitly disabled', () => {
    expect(isAnchorV2Enabled('false', true, 'development')).toBe(false);
    expect(isAnchorV2Enabled('false', false, 'staging')).toBe(false);
  });

  it('allows the opt-in in development, preview, and staging builds', () => {
    expect(isAnchorV2Enabled('true', false, undefined)).toBe(true);
    expect(isAnchorV2Enabled('true', true, 'development')).toBe(true);
    expect(isAnchorV2Enabled('true', false, 'staging')).toBe(true);
    expect(isAnchorV2Enabled(undefined, false, 'staging')).toBe(true);
    expect(isAnchorV2Enabled(undefined, false, 'preview')).toBe(true);
  });
});
