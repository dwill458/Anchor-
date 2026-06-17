import { getEntitlements } from '../entitlements';

describe('entitlements', () => {
  it('returns pro entitlements correctly', () => {
    const entitlements = getEntitlements('pro');
    expect(entitlements).toEqual({
      tier: 'pro',
      maxAnchors: Infinity,
      aiStyleCount: 12,
      aiVariationCount: 4,
      focusSessionsPerWeek: Infinity,
      deepPrimeSessionsPerWeek: Infinity,
      canTraceAnchor: true,
      canForgeAnchor: true,
      canUseArchivedFilter: true,
      canExportHD: true,
    });
  });

  it('returns free entitlements correctly', () => {
    const entitlements = getEntitlements('free');
    expect(entitlements).toEqual({
      tier: 'free',
      maxAnchors: Infinity,
      aiStyleCount: 12,
      aiVariationCount: 4,
      focusSessionsPerWeek: 5,
      deepPrimeSessionsPerWeek: 2,
      canTraceAnchor: true,
      canForgeAnchor: true,
      canUseArchivedFilter: true,
      canExportHD: true,
    });
  });
});
