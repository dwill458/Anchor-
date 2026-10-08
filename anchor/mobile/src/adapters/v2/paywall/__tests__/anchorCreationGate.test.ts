import { resolveAnchorCreationPaywall } from '../anchorCreationGate';

describe('resolveAnchorCreationPaywall', () => {
  it('allows the FIRST Anchor creation without a paywall', () => {
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 0, isOnboarding: false, hasEntitlement: false }),
    ).toEqual({ allowed: true, paywallContext: null });
  });

  it('raises SECOND_ANCHOR on the second Anchor attempt for a free user', () => {
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

  it('exempts an Evolve successor from the second-Anchor count', () => {
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 1, isOnboarding: false, hasEntitlement: false, isEvolve: true }),
    ).toEqual({ allowed: true, paywallContext: null });
    expect(
      resolveAnchorCreationPaywall({ activeAnchorCount: 7, isOnboarding: false, hasEntitlement: false, isEvolve: true }),
    ).toEqual({ allowed: true, paywallContext: null });
  });

  it('leaves every existing case unchanged when isEvolve is false or omitted', () => {
    const cases = [
      { activeAnchorCount: 0, isOnboarding: false, hasEntitlement: false },
      { activeAnchorCount: 1, isOnboarding: false, hasEntitlement: false },
      { activeAnchorCount: 1, isOnboarding: true, hasEntitlement: false },
      { activeAnchorCount: 5, isOnboarding: false, hasEntitlement: true },
    ];
    for (const input of cases) {
      expect(resolveAnchorCreationPaywall({ ...input, isEvolve: false })).toEqual(resolveAnchorCreationPaywall(input));
    }
    expect(resolveAnchorCreationPaywall({ activeAnchorCount: 1, isOnboarding: false, hasEntitlement: false, isEvolve: false }))
      .toEqual({ allowed: false, paywallContext: 'SECOND_ANCHOR' });
  });
});
