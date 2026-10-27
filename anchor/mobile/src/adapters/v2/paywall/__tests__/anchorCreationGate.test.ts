import { resolveAnchorCreationPaywall } from '../anchorCreationGate';

describe('resolveAnchorCreationPaywall', () => {
  it('raises SECOND_ANCHOR for new Anchor attempts without entitlement outside onboarding', () => {
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 0, isOnboarding: false, hasEntitlement: false }),
    ).toEqual({ allowed: false, paywallContext: 'SECOND_ANCHOR' });
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 1, isOnboarding: false, hasEntitlement: false }),
    ).toEqual({ allowed: false, paywallContext: 'SECOND_ANCHOR' });
  });

  it('never paywalls an onboarding / first-run creation attempt', () => {
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 0, isOnboarding: true, hasEntitlement: false }),
    ).toEqual({ allowed: true, paywallContext: null });
    // Even a returning onboarding edge case with an existing Anchor stays open.
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 1, isOnboarding: true, hasEntitlement: false }),
    ).toEqual({ allowed: true, paywallContext: null });
  });

  it('never paywalls an entitled user, however many Anchors they hold', () => {
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 5, isOnboarding: false, hasEntitlement: true }),
    ).toEqual({ allowed: true, paywallContext: null });
  });
});
