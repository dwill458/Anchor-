import { createMockAnchor } from '@/__tests__/utils/testUtils';
import {
  getAnchorState,
  getDeepChargeMicrocopy,
  getMeaningCopy,
  hasIgnited,
} from '../anchorStateHelpers';

describe('anchorStateHelpers', () => {
  it('detects pre-ignition anchors', () => {
    const anchor = createMockAnchor({
      isCharged: false,
      activationCount: 0,
      chargedAt: undefined,
      lastActivatedAt: undefined,
    });

    expect(hasIgnited(anchor)).toBe(false);

    const copy = getMeaningCopy(anchor, getAnchorState(anchor));
    expect(copy.activationStatus).toBe('Ready to ignite');
    expect(copy.lastActivatedText).toBe('Not yet');
  });

  it('detects ignition from chargedAt', () => {
    const anchor = createMockAnchor({
      isCharged: true,
      chargedAt: new Date(),
    });

    expect(hasIgnited(anchor)).toBe(true);
  });

  it('detects ignition from metadata fields', () => {
    const anchor = createMockAnchor({
      isCharged: false,
      chargeCount: 1,
      ignitedAt: new Date(),
    });

    expect(hasIgnited(anchor)).toBe(true);
  });

  it('formats post-ignition status copy with relative activation time', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const anchor = createMockAnchor({
      isCharged: true,
      chargedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      activationCount: 3,
      lastActivatedAt: twoHoursAgo,
    });

    const copy = getMeaningCopy(anchor, getAnchorState(anchor));
    expect(copy.activationStatus).toBe('Anchor is live');
    expect(copy.lastActivatedText).toBe('2h ago');
  });

  it('returns recent activation deep charge microcopy for fresh activations', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(getDeepChargeMicrocopy(fiveMinutesAgo)).toBe(
      'Optional: deepen what you just started.'
    );
  });

  it('returns stale deep charge microcopy for old activations', () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
    expect(getDeepChargeMicrocopy(thirtyHoursAgo)).toBe(
      'Your anchor may be dim. Recharge it.'
    );
  });

  it('returns default deep charge microcopy for intermediate activations', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(getDeepChargeMicrocopy(twoHoursAgo)).toBe(
      'Best when your intention feels dim.'
    );
  });

  it('treats missing or invalid activation timestamps as stale copy', () => {
    expect(getDeepChargeMicrocopy()).toBe('Your anchor may be dim. Recharge it.');
    expect(getDeepChargeMicrocopy('invalid-date')).toBe(
      'Your anchor may be dim. Recharge it.'
    );
  });
});
