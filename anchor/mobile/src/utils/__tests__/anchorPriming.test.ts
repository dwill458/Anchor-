import {
  buildRecoveredChargeState,
  hasAnchorPrimeHistory,
  isFirstPrimeForAnchor,
  needsChargeStateBackfill,
} from '../anchorPriming';

describe('anchorPriming', () => {
  it('treats prior activations as prime history even when charged fields are missing', () => {
    const anchor = {
      isCharged: false,
      activationCount: 2,
      chargeCount: 0,
      firstChargedAt: undefined,
      chargedAt: undefined,
      lastActivatedAt: new Date('2026-05-20T12:00:00.000Z'),
    };

    expect(hasAnchorPrimeHistory(anchor)).toBe(true);
    expect(isFirstPrimeForAnchor(anchor)).toBe(false);
    expect(needsChargeStateBackfill(anchor)).toBe(true);
  });

  it('detects a genuine first prime when no activation or charge evidence exists', () => {
    const anchor = {
      isCharged: false,
      activationCount: 0,
      chargeCount: 0,
      firstChargedAt: undefined,
      chargedAt: undefined,
      lastActivatedAt: undefined,
    };

    expect(hasAnchorPrimeHistory(anchor)).toBe(false);
    expect(isFirstPrimeForAnchor(anchor)).toBe(true);
    expect(needsChargeStateBackfill(anchor)).toBe(false);
  });

  it('builds first-prime charge state from the fallback time', () => {
    const fallbackTime = new Date('2026-05-21T09:30:00.000Z');

    expect(
      buildRecoveredChargeState(
        {
          isCharged: false,
          chargeCount: 0,
        },
        fallbackTime,
        { incrementChargeCount: true }
      )
    ).toEqual({
      isCharged: true,
      chargedAt: fallbackTime,
      firstChargedAt: fallbackTime,
      chargeCount: 1,
    });
  });

  it('backfills charge state from existing activation history without incrementing count twice', () => {
    const lastActivatedAt = new Date('2026-05-18T07:00:00.000Z');

    expect(
      buildRecoveredChargeState(
        {
          isCharged: false,
          chargeCount: 0,
          lastActivatedAt,
        },
        new Date('2026-05-21T09:30:00.000Z')
      )
    ).toEqual({
      isCharged: true,
      chargedAt: lastActivatedAt,
      firstChargedAt: lastActivatedAt,
      chargeCount: 1,
    });
  });
});
