import { isNoAccountSanctuaryUser } from '../noAccountAccess';

describe('noAccountAccess', () => {
  it('identifies unauthenticated sanctuary users with local anchors', () => {
    expect(
      isNoAccountSanctuaryUser({
        isAuthenticated: false,
        pendingFirstAnchorDraft: null,
        sanctuaryAnchorCount: 1,
      })
    ).toBe(true);
  });

  it('excludes authenticated users and pending first-anchor handoff users', () => {
    expect(
      isNoAccountSanctuaryUser({
        isAuthenticated: true,
        pendingFirstAnchorDraft: null,
        sanctuaryAnchorCount: 1,
      })
    ).toBe(false);

    expect(
      isNoAccountSanctuaryUser({
        isAuthenticated: false,
        pendingFirstAnchorDraft: {
          tempAnchorId: 'pending-1',
          source: 'onboarding_first_anchor',
          requiresAccountGate: true,
          createdAt: new Date(),
        },
        sanctuaryAnchorCount: 1,
      })
    ).toBe(false);
  });

  it('includes local pending anchors that are already allowed into Sanctuary', () => {
    expect(
      isNoAccountSanctuaryUser({
        isAuthenticated: false,
        pendingFirstAnchorDraft: {
          tempAnchorId: 'pending-1',
          source: 'onboarding_first_anchor',
          requiresAccountGate: false,
          createdAt: new Date(),
        },
        sanctuaryAnchorCount: 1,
      })
    ).toBe(true);
  });
});
