import { createMockAnchor } from '@/__tests__/utils/testUtils';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import {
  formatDepthGuidance,
  getAnchorDepth,
  getAnchorDepthProgress,
  getCurrentRank,
  getDeepestPracticeAnchor,
  getMarkProgress,
  getNextMark,
  getNextRankProgress,
  getPracticeDays,
} from '../progression';

function createPrimingEntry(
  id: string,
  {
    anchorId,
    type,
    completedAt,
  }: {
    anchorId: string;
    type: 'activate' | 'reinforce';
    completedAt: string;
  }
): PrimingHistoryEntry {
  const date = new Date(completedAt);
  return {
    id,
    anchorId,
    type,
    completedAt,
    localDate: completedAt.slice(0, 10),
    weekKey: '2026-W21',
    weekStart: '2026-05-18',
    weekdayIndex: date.getUTCDay(),
    hourOfDay: date.getUTCHours(),
    timeOfDay: 'morning',
  };
}

describe('progression selectors', () => {
  describe('rank qualification', () => {
    it('requires all metrics for multi-gate ranks', () => {
      expect(
        getCurrentRank({
          totalPrimes: 0,
          practiceDays: 0,
          releasedAnchors: 0,
        }).tier.name
      ).toBe('Initiate');

      expect(
        getCurrentRank({
          totalPrimes: 10,
          practiceDays: 2,
          releasedAnchors: 0,
        }).tier.name
      ).toBe('Initiate');

      expect(
        getCurrentRank({
          totalPrimes: 10,
          practiceDays: 3,
          releasedAnchors: 0,
        }).tier.name
      ).toBe('Practitioner');

      expect(
        getCurrentRank({
          totalPrimes: 50,
          practiceDays: 14,
          releasedAnchors: 0,
        }).tier.name
      ).toBe('Practitioner');

      expect(
        getCurrentRank({
          totalPrimes: 50,
          practiceDays: 14,
          releasedAnchors: 1,
        }).tier.name
      ).toBe('Architect');
    });

    it('averages requirement progress toward the next rank', () => {
      const progress = getNextRankProgress({
        totalPrimes: 5,
        practiceDays: 1,
        releasedAnchors: 0,
      });

      expect(progress.currentTier.name).toBe('Initiate');
      expect(progress.nextTier?.name).toBe('Practitioner');
      expect(progress.progress).toBeCloseTo((5 / 10 + 1 / 3) / 2, 4);
    });

    it('fills to one at the highest rank', () => {
      const progress = getNextRankProgress({
        totalPrimes: 200,
        practiceDays: 60,
        releasedAnchors: 3,
      });

      expect(progress.currentTier.name).toBe('Sovereign');
      expect(progress.nextTier).toBeNull();
      expect(progress.progress).toBe(1);
    });
  });

  describe('anchor depth qualification', () => {
    it('qualifies tiers from per-anchor primes, days, and Deep Primes', () => {
      expect(
        getAnchorDepth({ primes: 0, practiceDays: 0, deepPrimes: 0 }).tier.name
      ).toBe('Surface');
      expect(
        getAnchorDepth({ primes: 3, practiceDays: 2, deepPrimes: 0 }).tier.name
      ).toBe('Grounded');
      expect(
        getAnchorDepth({ primes: 7, practiceDays: 5, deepPrimes: 0 }).tier.name
      ).toBe('Rooted');
      expect(
        getAnchorDepth({ primes: 15, practiceDays: 10, deepPrimes: 1 }).tier.name
      ).toBe('Embedded');
      expect(
        getAnchorDepth({ primes: 30, practiceDays: 21, deepPrimes: 3 }).tier.name
      ).toBe('Embodied');
    });

    it('builds actionable next-step guidance', () => {
      expect(
        formatDepthGuidance(
          getAnchorDepthProgress({ primes: 2, practiceDays: 1, deepPrimes: 0 })
        )
      ).toBe('1 prime · 1 practice day to Grounded');

      expect(
        formatDepthGuidance(
          getAnchorDepthProgress({ primes: 15, practiceDays: 10, deepPrimes: 0 })
        )
      ).toBe('1 Deep Prime needed to reach Embedded');
    });

    it('fills to one at maximum depth', () => {
      const progress = getAnchorDepthProgress({
        primes: 30,
        practiceDays: 21,
        deepPrimes: 3,
      });

      expect(progress.currentTier.name).toBe('Embodied');
      expect(progress.nextTier).toBeNull();
      expect(progress.progress).toBe(1);
    });
  });

  describe('deepest practice selection', () => {
    it('prefers higher depth tiers first', () => {
      const anchors = [
        createMockAnchor({ id: 'anchor-1', intentionText: 'Anchor One' }),
        createMockAnchor({ id: 'anchor-2', intentionText: 'Anchor Two' }),
      ];

      const sessions = [
        createPrimingEntry('1', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-05-01T12:00:00.000Z',
        }),
        createPrimingEntry('2', {
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-05-02T12:00:00.000Z',
        }),
        createPrimingEntry('3', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-05-01T12:00:00.000Z',
        }),
        createPrimingEntry('4', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-05-03T12:00:00.000Z',
        }),
        createPrimingEntry('5', {
          anchorId: 'anchor-2',
          type: 'activate',
          completedAt: '2026-05-05T12:00:00.000Z',
        }),
      ];

      expect(
        getDeepestPracticeAnchor(anchors, sessions, 'UTC+0 (GMT)')?.anchor.id
      ).toBe('anchor-2');
    });

    it('uses progress and recency as tie-breakers', () => {
      const anchors = [
        createMockAnchor({ id: 'anchor-a', intentionText: 'Anchor A' }),
        createMockAnchor({ id: 'anchor-b', intentionText: 'Anchor B' }),
      ];

      const sessions = [
        createPrimingEntry('1', {
          anchorId: 'anchor-a',
          type: 'activate',
          completedAt: '2026-05-01T12:00:00.000Z',
        }),
        createPrimingEntry('2', {
          anchorId: 'anchor-a',
          type: 'activate',
          completedAt: '2026-05-03T12:00:00.000Z',
        }),
        createPrimingEntry('3', {
          anchorId: 'anchor-b',
          type: 'activate',
          completedAt: '2026-05-01T12:00:00.000Z',
        }),
        createPrimingEntry('4', {
          anchorId: 'anchor-b',
          type: 'activate',
          completedAt: '2026-05-02T12:00:00.000Z',
        }),
      ];

      expect(
        getDeepestPracticeAnchor(anchors, sessions, 'UTC+0 (GMT)')?.anchor.id
      ).toBe('anchor-a');
    });

    it('returns null when there is no active anchor', () => {
      const anchors = [
        createMockAnchor({
          id: 'released-anchor',
          isReleased: true,
          releasedAt: new Date('2026-05-10T00:00:00.000Z'),
        }),
      ];

      expect(getDeepestPracticeAnchor(anchors, [], 'UTC+0 (GMT)')).toBeNull();
    });
  });

  describe('mark ladder and practice day counting', () => {
    it('selects the next mark within reach and the earned max state', () => {
      expect(getNextMark(0).current.name).toBe('First Return Mark');
      expect(getNextMark(4).current.name).toBe('Steady Thread Mark');
      expect(getNextMark(29).current.name).toBe('Discipline Mark');
      expect(getNextMark(100).current.name).toBe('Constancy Mark');
      expect(getNextMark(100).earned).toBe(true);
    });

    it('tracks mark progress against the current threshold', () => {
      expect(getMarkProgress(4)).toEqual({
        current: 4,
        required: 7,
        progress: 4 / 7,
        earned: false,
      });
    });

    it('deduplicates multiple sessions on the same local day with an IANA timezone', () => {
      const sessions = [
        createPrimingEntry('1', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-05-19T02:00:00.000Z',
        }),
        createPrimingEntry('2', {
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-05-19T04:30:00.000Z',
        }),
        createPrimingEntry('3', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-05-20T05:30:00.000Z',
        }),
      ];

      expect(getPracticeDays(sessions, 'UTC-5 · America/Chicago')).toBe(2);
    });

    it('falls back to the stored UTC offset when no IANA timezone is present', () => {
      const sessions = [
        createPrimingEntry('1', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-05-19T03:30:00.000Z',
        }),
        createPrimingEntry('2', {
          anchorId: 'anchor-1',
          type: 'reinforce',
          completedAt: '2026-05-19T04:00:00.000Z',
        }),
        createPrimingEntry('3', {
          anchorId: 'anchor-1',
          type: 'activate',
          completedAt: '2026-05-20T05:10:00.000Z',
        }),
      ];

      expect(getPracticeDays(sessions, 'UTC-5 (EST)')).toBe(2);
    });
  });
});
