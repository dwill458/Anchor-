import { act, renderHook } from '@testing-library/react-native';
import type { V2ReleaseAdapter, V2ReleaseResult } from '@/adapters/v2/release';

const mockReleaseAnchor = jest.fn();
const mockAnchorStoreState: {
  anchors: Array<Record<string, unknown>>;
  releaseAnchor: jest.Mock;
} = { anchors: [], releaseAnchor: mockReleaseAnchor };
const mockCourseStoreState: { activeCourse: unknown } = { activeCourse: null };

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: unknown) => unknown) => selector(mockAnchorStoreState),
}));
jest.mock('@/stores/courseStore', () => ({
  useCourseStore: (selector: (s: unknown) => unknown) => selector(mockCourseStoreState),
}));

// eslint-disable-next-line import/first
import { useV2Release } from '../useV2Release';

const anchor = {
  id: 'anchor-1',
  localId: 'anchor-1',
  intentionText: 'Publish my novel',
  category: 'creativity',
  baseSigilSvg: '<svg />',
  reinforcedSigilSvg: null,
};

function fakeAdapter(results: V2ReleaseResult[]): V2ReleaseAdapter & { calls: Array<{ idempotencyKey: string }> } {
  const calls: Array<{ idempotencyKey: string }> = [];
  let i = 0;
  return {
    calls,
    submitRelease: jest.fn(async (req) => {
      calls.push({ idempotencyKey: req.idempotencyKey });
      const res = results[Math.min(i, results.length - 1)];
      i += 1;
      return res;
    }),
  };
}

describe('useV2Release', () => {
  beforeEach(() => {
    mockReleaseAnchor.mockClear();
    mockAnchorStoreState.anchors = [anchor];
    mockCourseStoreState.activeCourse = null;
  });

  it('builds the consequence snapshot from the real Anchor record', () => {
    const { result } = renderHook(() =>
      useV2Release({ anchorId: 'anchor-1', adapter: fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]) }),
    );
    expect(result.current.snapshot?.intentionText).toBe('Publish my novel');
    expect(result.current.stage).toBe('preflight');
    expect(result.current.anchorMissing).toBe(false);
  });

  it('reports a missing Anchor without crashing', () => {
    mockAnchorStoreState.anchors = [];
    const { result } = renderHook(() =>
      useV2Release({ anchorId: 'ghost', adapter: fakeAdapter([{ status: 'released', anchorId: 'ghost' }]) }),
    );
    expect(result.current.anchorMissing).toBe(true);
    expect(result.current.snapshot).toBeNull();
  });

  it('submits an idempotent release, waits for the ceremony, then completes and reconciles once', async () => {
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1', lifecycleState: 'released' }]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));

    await act(async () => {
      result.current.startRelease();
    });

    expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
    expect(adapter.calls[0].idempotencyKey).toMatch(/^release-anchor-1-/);
    // Ceremony visuals still running — do not jump to completion.
    expect(result.current.stage).toBe('dissolving');

    await act(async () => {
      result.current.markDissolutionComplete();
    });

    expect(result.current.stage).toBe('completed');
    expect(mockReleaseAnchor).toHaveBeenCalledTimes(1);
    expect(mockReleaseAnchor).toHaveBeenCalledWith('anchor-1');
  });

  it('ignores duplicate startRelease calls (single submission)', async () => {
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));

    await act(async () => {
      result.current.startRelease();
      result.current.startRelease();
    });

    expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
  });

  it('allows retry after an offline pending result, reusing the same idempotency key, with no data corruption', async () => {
    const adapter = fakeAdapter([
      { status: 'pending', anchorId: 'anchor-1', message: 'offline', retryable: true },
      { status: 'released', anchorId: 'anchor-1' },
    ]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));

    await act(async () => {
      result.current.startRelease();
    });
    await act(async () => {
      result.current.markDissolutionComplete();
    });

    expect(result.current.stage).toBe('confirming');
    expect(mockReleaseAnchor).not.toHaveBeenCalled();

    await act(async () => {
      result.current.retry();
    });

    expect(result.current.stage).toBe('completed');
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[0].idempotencyKey).toBe(adapter.calls[1].idempotencyKey);
    expect(mockReleaseAnchor).toHaveBeenCalledTimes(1);
  });

  it('surfaces a definitive failure without reconciling local state', async () => {
    const adapter = fakeAdapter([{ status: 'failed', anchorId: 'anchor-1', message: 'nope', retryable: false }]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));

    await act(async () => {
      result.current.startRelease();
    });
    await act(async () => {
      result.current.markDissolutionComplete();
    });

    expect(result.current.stage).toBe('failed');
    expect(mockReleaseAnchor).not.toHaveBeenCalled();

    // A fresh attempt after reset issues a new idempotency key.
    await act(async () => {
      result.current.reset();
    });
    expect(result.current.stage).toBe('preflight');
  });

  it('includes a Course consequence row when the active Course is linked to this Anchor', () => {
    mockCourseStoreState.activeCourse = {
      status: 'ACTIVE',
      waypointCount: 3,
      reachedCount: 1,
      destinationAnchorLink: { anchorId: 'anchor-1' },
      waypoints: [],
    };
    const { result } = renderHook(() =>
      useV2Release({ anchorId: 'anchor-1', adapter: fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]) }),
    );
    expect(result.current.snapshot?.hasLinkedCourse).toBe(true);
    expect(result.current.snapshot?.consequences.some((c) => c.id === 'course')).toBe(true);
  });
  it('retains the committed artwork when reconciliation removes the active Anchor', async () => {
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]);
    const { result, rerender } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));
    const original = result.current.snapshot;
    await act(async () => result.current.startRelease());
    mockAnchorStoreState.anchors = [];
    rerender({});
    expect(result.current.snapshot).toBe(original);
    expect(result.current.anchorMissing).toBe(false);
    act(() => result.current.markDissolutionComplete());
    expect(result.current.stage).toBe('completed');
  });


  it('rejects a hold whose relationships changed before commit: no request, refreshed rows, a new hold is required', async () => {
    mockCourseStoreState.activeCourse = {
      id: 'course-1', status: 'ACTIVE', version: 1, waypointCount: 2, reachedCount: 0,
      destinationAnchorLink: { anchorId: 'anchor-1' }, waypoints: [],
    };
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]);
    const { result, rerender } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));
    act(() => result.current.beginHold());
    mockCourseStoreState.activeCourse = { ...(mockCourseStoreState.activeCourse as object), version: 2, reachedCount: 1 };
    rerender({});
    await act(async () => result.current.startRelease());
    expect(adapter.submitRelease).not.toHaveBeenCalled();
    expect(result.current.stale).toBe(true);
    expect(result.current.stage).toBe('preflight');
    expect(result.current.snapshot?.consequences.find((c) => c.id === 'course')?.detail).toMatch(/1 of 2/);

    // A fresh hold on the refreshed consequences commits.
    act(() => result.current.beginHold());
    expect(result.current.stale).toBe(false);
    await act(async () => result.current.startRelease());
    expect(adapter.submitRelease).toHaveBeenCalledTimes(1);
  });

  it('evolve cannot start without a valid successor, and a successor equal to the released Anchor is invalid', async () => {
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]);
    const missing = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter, reason: 'evolve' }));
    expect(missing.result.current.canRelease).toBe(false);
    await act(async () => missing.result.current.startRelease());
    expect(adapter.submitRelease).not.toHaveBeenCalled();

    const self = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter, reason: 'evolve', successor: { anchorId: 'anchor-1', intentionText: 'x' } }));
    expect(self.result.current.canRelease).toBe(false);

    mockAnchorStoreState.anchors = [anchor, { ...anchor, id: 'anchor-2', localId: 'anchor-2', intentionText: 'Next' }];
    const valid = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter, reason: 'evolve', successor: { anchorId: 'anchor-2', intentionText: 'Next' } }));
    expect(valid.result.current.canRelease).toBe(true);
    await act(async () => valid.result.current.startRelease());
    expect(adapter.submitRelease).toHaveBeenCalledWith(expect.objectContaining({ reason: 'evolve' }));
  });

  it('sends the verified reason, never an unconfirmed completion claim', async () => {
    const adapter = fakeAdapter([{ status: 'released', anchorId: 'anchor-1' }]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter, reason: 'destination_completed' }));
    await act(async () => result.current.startRelease());
    expect(adapter.submitRelease).toHaveBeenCalledWith(expect.objectContaining({ reason: 'no_longer_aligned' }));
  });

  it('a definitive failure leaves the Anchor active and a retry uses a fresh key only after a fresh hold', async () => {
    const adapter = fakeAdapter([
      { status: 'failed', anchorId: 'anchor-1', message: 'nope', retryable: false },
      { status: 'released', anchorId: 'anchor-1' },
    ]);
    const { result } = renderHook(() => useV2Release({ anchorId: 'anchor-1', adapter }));
    await act(async () => result.current.startRelease());
    act(() => result.current.markDissolutionComplete());
    expect(result.current.stage).toBe('failed');
    expect(mockReleaseAnchor).not.toHaveBeenCalled();
    act(() => result.current.reset());
    await act(async () => result.current.startRelease());
    expect(adapter.calls).toHaveLength(2);
    expect(adapter.calls[0].idempotencyKey).not.toBe(adapter.calls[1].idempotencyKey);
  });

});
