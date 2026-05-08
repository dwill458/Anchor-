import {
  getDepthLevel,
  getDepthProgress,
  getNextDepthLevel,
} from '../practiceDepth';
import {
  getCurrentRank,
  getNextRank,
  getRankProgress,
} from '../practiceRank';

describe('practice progression utilities', () => {
  describe('rank helpers', () => {
    it('returns the current rank for total primes', () => {
      expect(getCurrentRank(0).name).toBe('Initiate');
      expect(getCurrentRank(10).name).toBe('Practitioner');
      expect(getCurrentRank(50).name).toBe('Architect');
      expect(getCurrentRank(200).name).toBe('Sovereign');
    });

    it('returns the next rank above the current total', () => {
      expect(getNextRank(0)?.name).toBe('Practitioner');
      expect(getNextRank(49)?.name).toBe('Architect');
      expect(getNextRank(200)).toBeNull();
    });

    it('clamps rank progress between zero and one', () => {
      expect(getRankProgress(0)).toBe(0);
      expect(getRankProgress(5)).toBeCloseTo(0.5);
      expect(getRankProgress(999)).toBe(1);
    });
  });

  describe('depth helpers', () => {
    it('returns the current depth level for total primes', () => {
      expect(getDepthLevel(0).label).toBe('Surface');
      expect(getDepthLevel(25).label).toBe('Grounded');
      expect(getDepthLevel(75).label).toBe('Rooted');
      expect(getDepthLevel(300).label).toBe('Sovereign');
    });

    it('returns the next depth level above the current total', () => {
      expect(getNextDepthLevel(0)?.label).toBe('Grounded');
      expect(getNextDepthLevel(149)?.label).toBe('Embedded');
      expect(getNextDepthLevel(300)).toBeNull();
    });

    it('clamps depth progress between zero and one', () => {
      expect(getDepthProgress(0)).toBe(0);
      expect(getDepthProgress(50)).toBeCloseTo((50 - 25) / 50);
      expect(getDepthProgress(999)).toBe(1);
    });
  });
});
