import { act, renderHook } from '@testing-library/react-native';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { useProgressionData } from '../useProgressionData';
import { useAnchorStore } from '@/stores/anchorStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';

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

describe('useProgressionData', () => {
  beforeEach(() => {
    useAnchorStore.getState().clearAnchors();
    useProfileStore.getState().resetProfile();
    useSessionStore.getState().reset();
    useProfileStore.setState({ timezone: 'UTC+0 (GMT)' });
  });

  it('updates totals, practice days, and deepest practice after a Prime', () => {
    const anchor = createMockAnchor({
      id: 'anchor-1',
      intentionText: 'Build with calm precision',
    });
    useAnchorStore.getState().addAnchor(anchor);

    const { result } = renderHook(() => useProgressionData());

    act(() => {
      useAnchorStore.getState().updateAnchor('anchor-1', {
        activationCount: 1,
        lastActivatedAt: new Date('2026-05-19T08:00:00.000Z'),
      });
      useAnchorStore.getState().incrementTotalPrimes();
      useSessionStore.getState().recordSession({
        anchorId: 'anchor-1',
        type: 'activate',
        durationSeconds: 120,
        mode: 'silent',
        completedAt: '2026-05-19T08:00:00.000Z',
      });
    });

    expect(result.current.totalPrimes).toBe(1);
    expect(result.current.practiceDays).toBe(1);
    expect(result.current.deepestPractice.empty).toBe(false);
    if (!result.current.deepestPractice.empty) {
      expect(result.current.deepestPractice.stats.primes).toBe(1);
      expect(result.current.deepestPractice.tierName).toBe('Surface');
    }
  });

  it('counts a reinforce after a prior prime as a Deep Prime and upgrades depth', () => {
    useAnchorStore.getState().addAnchor(
      createMockAnchor({
        id: 'anchor-deep',
        intentionText: 'Anchor the new pattern',
      })
    );

    useSessionStore.setState({
      primingHistory: [
        createPrimingEntry('1', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-01T12:00:00.000Z',
        }),
        createPrimingEntry('2', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-02T12:00:00.000Z',
        }),
        createPrimingEntry('3', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-03T12:00:00.000Z',
        }),
        createPrimingEntry('4', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-04T12:00:00.000Z',
        }),
        createPrimingEntry('5', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-05T12:00:00.000Z',
        }),
        createPrimingEntry('6', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-06T12:00:00.000Z',
        }),
        createPrimingEntry('7', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-07T12:00:00.000Z',
        }),
        createPrimingEntry('8', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-08T12:00:00.000Z',
        }),
        createPrimingEntry('9', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-09T12:00:00.000Z',
        }),
        createPrimingEntry('10', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-10T12:00:00.000Z',
        }),
        createPrimingEntry('11', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-11T12:00:00.000Z',
        }),
        createPrimingEntry('12', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-12T12:00:00.000Z',
        }),
        createPrimingEntry('13', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-13T12:00:00.000Z',
        }),
        createPrimingEntry('14', {
          anchorId: 'anchor-deep',
          type: 'activate',
          completedAt: '2026-05-14T12:00:00.000Z',
        }),
        createPrimingEntry('15', {
          anchorId: 'anchor-deep',
          type: 'reinforce',
          completedAt: '2026-05-15T12:00:00.000Z',
        }),
      ],
    });

    const { result } = renderHook(() => useProgressionData());

    expect(result.current.deepestPractice.empty).toBe(false);
    if (!result.current.deepestPractice.empty) {
      expect(result.current.deepestPractice.stats.deepPrimes).toBe(1);
      expect(result.current.deepestPractice.tierName).toBe('Embedded');
    }
  });

  it('tracks active and released anchor counts accurately', () => {
    useAnchorStore.setState({
      anchors: [
        createMockAnchor({
          id: 'anchor-active',
          intentionText: 'Active anchor',
        }),
        createMockAnchor({
          id: 'anchor-released',
          intentionText: 'Released anchor',
          isReleased: true,
        }),
      ],
      totalPrimes: 10,
      primeStreak: 0,
      lastPrimedDate: null,
      isLoading: false,
      error: null,
      lastSyncedAt: null,
      currentAnchorId: undefined,
    });

    const { result } = renderHook(() => useProgressionData());
    expect(result.current.activeAnchors).toBe(1);
    expect(result.current.releasedAnchors).toBe(1);
    expect(result.current.hasAnchors).toBe(true);
    expect(result.current.forgedCount).toBe(2);
  });
});
