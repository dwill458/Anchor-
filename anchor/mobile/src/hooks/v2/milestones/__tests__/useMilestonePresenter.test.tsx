import { act, renderHook } from '@testing-library/react-native';

const mockSettle = jest.fn();
jest.mock('@/milestones/milestoneSnapshots', () => ({
  settleMilestone: (...args: unknown[]) => mockSettle(...args),
}));

import { useMilestonePresenter } from '../useMilestonePresenter';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import type { MilestoneRecord } from '@/milestones/milestoneModel';

const rec = (id: string, definitionId: string, earnedAt: string): MilestoneRecord => ({
  id,
  anchorId: 'a1',
  definitionId,
  definitionVersion: 1,
  earnedAt,
  sourceKind: 'PRACTICE_COMPLETION',
  sourceEntityId: null,
  metadata: {},
  celebratedAt: null,
  presentationId: `r-${id}`,
  presentationExpiresAt: new Date(Date.now() + 90000).toISOString(),
});

const enqueue = (...records: MilestoneRecord[]) =>
  act(() => {
    useMilestoneCelebrationStore.getState().enqueueAwards(records, 'user-1');
  });

describe('useMilestonePresenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCelebrationStore.getState().reset();
    useMilestoneCelebrationStore.getState().reset();
  });

  it('returns through the originating practice destination once after Continue', () => {
    const onReturn = jest.fn();
    const { result } = renderHook(() => useMilestonePresenter());
    act(() => { useMilestoneCelebrationStore.getState().enqueueAwards([rec('m1', 'commitment.practices.1', new Date().toISOString())], 'user-1', () => true, onReturn); });
    act(() => { result.current.finish(); result.current.finish(); });
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it('never invokes a stale return destination after source navigation or interruption', () => {
    const onReturn = jest.fn(); let active = true;
    const { result } = renderHook(() => useMilestonePresenter());
    act(() => { useMilestoneCelebrationStore.getState().enqueueAwards([rec('m1', 'commitment.practices.1', new Date().toISOString())], 'user-1', () => active, onReturn); });
    active = false;
    act(() => result.current.finish());
    expect(onReturn).not.toHaveBeenCalled();
  });

  it('presents a queued milestone through the shared coordinator and settles it when the user continues', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'));
    expect(result.current.presenting?.record.id).toBe('m1');
    expect(useCelebrationStore.getState().active?.id).toBe('award:m1');

    act(() => result.current.finish());
    expect(mockSettle).toHaveBeenCalledTimes(1);
    expect(mockSettle).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: 'm1' }));
    expect(result.current.presenting).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('settles only once however many times it is finished', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'));
    const finish = result.current.finish;
    act(() => {
      finish();
      finish();
    });
    expect(mockSettle).toHaveBeenCalledTimes(1);
  });

  it('waits for the practice completion scene to settle before starting', () => {
    useCelebrationStore.getState().request(3, 'practice-completion', { durationMs: 3900 });
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'strength.reinforced', '2026-10-01T00:00:00Z'));
    // Even a level 4 milestone does not preempt the completion that is playing.
    expect(result.current.presenting).toBeNull();
    expect(useCelebrationStore.getState().active?.id).toBe('practice-completion');

    act(() => useCelebrationStore.getState().finish('practice-completion'));
    expect(result.current.presenting?.record.id).toBe('m1');
  });

  it('features at most one simultaneous unlock and does not stack another', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'), rec('m2', 'strength.established', '2026-10-01T00:00:00Z'));
    act(() => result.current.finish());
    expect(result.current.presenting).toBeNull();
    expect(mockSettle).toHaveBeenCalledTimes(1);
  });

  it('never settles a replay', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    act(() => useMilestoneCelebrationStore.getState().requestReplay(rec('m1', 'journey.halfway', '2026-10-01T00:00:00Z')));
    expect(result.current.presenting?.mode).toBe('replay');
    act(() => result.current.finish());
    expect(mockSettle).not.toHaveBeenCalled();
    expect(result.current.presenting).toBeNull();
  });

  it('does not fabricate acknowledgment when the coordinator interrupts it', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'));
    expect(result.current.presenting).not.toBeNull();
    // A higher-level scene takes over.
    act(() => {
      useCelebrationStore.getState().request(4, 'something-bigger', { durationMs: 5000 });
    });
    expect(result.current.presenting).toBeNull();
    expect(mockSettle).not.toHaveBeenCalled();
  });

  it('does not settle when the host goes away mid-celebration', () => {
    const { result, unmount } = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'));
    expect(result.current.presenting).not.toBeNull();
    unmount();
    expect(mockSettle).not.toHaveBeenCalled();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
    const resumed = renderHook(() => useMilestonePresenter());
    expect(resumed.result.current.presenting).toBeNull();
  });

  it('waits while an active practice or Vision editor owns a hold', () => {
    useMilestoneCelebrationStore.getState().hold('session');
    const view = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'commitment.practices.1', '2026-10-01T00:00:00Z'));
    expect(view.result.current.presenting).toBeNull();
    act(() => useMilestoneCelebrationStore.getState().release('session'));
    expect(view.result.current.presenting?.record.id).toBe('m1');
  });

  it('consumes the attempt on background or active-task interruption without a false receipt', () => {
    const view = renderHook(() => useMilestonePresenter());
    enqueue(rec('m1', 'vision.first', '2026-10-01T00:00:00Z'));
    act(() => useMilestoneCelebrationStore.getState().hold('editor'));
    expect(view.result.current.presenting).toBeNull();
    expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
    expect(mockSettle).not.toHaveBeenCalled();
    act(() => useMilestoneCelebrationStore.getState().release('editor'));
    expect(view.result.current.presenting).toBeNull();
  });

  it('skips a milestone from a newer app version instead of celebrating invented copy', () => {
    const { result } = renderHook(() => useMilestonePresenter());
    enqueue(rec('mx', 'future.unknown', '2026-10-01T00:00:00Z'));
    expect(result.current.presenting).toBeNull();
    expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
  });
});
