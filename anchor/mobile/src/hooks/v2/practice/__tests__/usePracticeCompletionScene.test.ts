import { act, renderHook } from '@testing-library/react-native';
import { playCreationSound } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import {
  isFirstPracticeEver,
  planPracticeSceneKind,
  practiceSceneValues,
  usePracticeCompletionScene,
} from '../usePracticeCompletionScene';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(() => Promise.resolve()),
    selection: jest.fn(() => Promise.resolve()),
    notification: jest.fn(() => Promise.resolve()),
  },
}));

type PracticeRecord = ReturnType<typeof useSessionStore.getState>['practiceHistory'][number];

const completed = (id: string): PracticeRecord =>
  ({ id, completionStatus: 'completed' }) as unknown as PracticeRecord;

const setHistory = (records: PracticeRecord[], totalSessionsCount = records.length) =>
  useSessionStore.setState({ practiceHistory: records, totalSessionsCount });

const setFlag = (value: boolean) =>
  useTeachingStore.setState((state) => ({
    userFlags: { ...state.userFlags, hasSeenFirstPracticeScene: value },
  }));

const threadSettleCalls = () =>
  (playCreationSound as jest.Mock).mock.calls.filter(([key]) => key === 'threadSettle').length;

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

describe('practice scene helpers', () => {
  beforeEach(() => {
    setHistory([]);
    setFlag(false);
  });

  it('isFirstPracticeEver is true only with no other completed practice and no lifetime sessions', () => {
    expect(isFirstPracticeEver('s1')).toBe(true);
    expect(isFirstPracticeEver(null)).toBe(true);

    setHistory([completed('s1')], 1);
    expect(isFirstPracticeEver('s1')).toBe(true);

    setHistory([completed('older'), completed('s1')], 2);
    expect(isFirstPracticeEver('s1')).toBe(false);

    setHistory([], 2);
    expect(isFirstPracticeEver('s1')).toBe(false);
  });

  it('planPracticeSceneKind gives first only to an unseen first practice with a real gain', () => {
    expect(planPracticeSceneKind('p', 5, true)).toBe('first');
    expect(planPracticeSceneKind('p', 0, true)).toBe('none');
    expect(planPracticeSceneKind('p', -3, true)).toBe('none');
    expect(planPracticeSceneKind('p', 5, false)).toBe('none');

    setFlag(true);
    expect(planPracticeSceneKind('p', 5, true)).toBe('repeat');

    setFlag(false);
    setHistory([completed('older')]);
    expect(planPracticeSceneKind('p', 5, true)).toBe('repeat');
  });

  it('practiceSceneValues gives the start and settled values from the prototype, using the real values', () => {
    expect(practiceSceneValues('first', 30, 35, 'start')).toEqual({ bar: 0.3, glow: 0.22, label: 0, value: 0, note: 0 });
    expect(practiceSceneValues('first', 30, 35, 'final')).toEqual({ bar: 0.35, glow: 0.36, label: 1, value: 1, note: 1 });
    expect(practiceSceneValues('repeat', 30, 35, 'start')).toEqual({ bar: 0.3, glow: 0.32, label: 1, value: 0, note: 0 });
    expect(practiceSceneValues('repeat', 30, 35, 'final')).toEqual({ bar: 0.35, glow: 0.38, label: 1, value: 1, note: 1 });
    expect(practiceSceneValues('none', 40, 40, 'start')).toEqual({ bar: 0.4, glow: 0.32, label: 1, value: 1, note: 1 });
  });
});

describe('usePracticeCompletionScene', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useCelebrationStore.getState().reset();
    setHistory([]);
    setFlag(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays the first scene at level 3, skippable, and sets the flag when it starts', () => {
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-first', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    expect(result.current.kind).toBe('first');
    expect(result.current.canSkip).toBe(true);
    expect(useCelebrationStore.getState().current).toMatchObject({ id: 'practice-complete:hook-first', level: 3, durationMs: 3900 });
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(true);
  });

  it('fires one settle cue and a Medium haptic at 2.3s, then releases at 3.9s', () => {
    renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-timing', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    advance(2299);
    expect(threadSettleCalls()).toBe(0);
    advance(1);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(1600);
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('a repeat scene is level 2, not skippable, and settles at 1.5s with a Light haptic', () => {
    setFlag(true);
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-repeat', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    expect(result.current.kind).toBe('repeat');
    expect(result.current.canSkip).toBe(false);
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2, durationMs: 2500 });
    advance(1500);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
  });

  it('a skip lands the bar, glow and figures on their final values, and the tap fires the settle beat once', () => {
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-skip', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    advance(500);
    act(() => { result.current.skip(); });
    expect(result.current.barProgress.value).toBeCloseTo(0.35);
    expect(result.current.glowOpacity.value).toBeCloseTo(0.36);
    expect(result.current.labelOpacity.value).toBe(1);
    expect(result.current.valueOpacity.value).toBe(1);
    expect(result.current.noteOpacity.value).toBe(1);
    expect(result.current.phase).toBe('settled');
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');

    advance(5000);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('a higher-level preemption lands the scene on its final values with no cue, so cues never overlap', () => {
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-preempt', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    act(() => {
      useCelebrationStore.getState().request(4, 'major-other', { durationMs: 6000 });
    });
    expect(useCelebrationStore.getState().active?.id).toBe('major-other');
    expect(result.current.barProgress.value).toBeCloseTo(0.35);
    expect(result.current.noteOpacity.value).toBe(1);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });

  it('under Reduce Motion the bar is at its value at once (no travel), level 2, with the cue and haptic still firing', () => {
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-reduce', fromValue: 30, toValue: 35, eligible: true, reduceMotion: true }),
    );
    expect(useCelebrationStore.getState().current).toMatchObject({ id: 'practice-complete:hook-reduce', level: 2 });
    expect(result.current.barProgress.value).toBeCloseTo(0.35);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(240);
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('a zero gain requests nothing, plays nothing, and rests on the value', () => {
    const { result } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-zero', fromValue: 40, toValue: 40, eligible: true, reduceMotion: false }),
    );
    expect(result.current.kind).toBe('none');
    expect(result.current.barProgress.value).toBeCloseTo(0.4);
    advance(4000);
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);
  });

  it('an ineligible session (not saved) requests nothing', () => {
    renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-unsaved', fromValue: 30, toValue: 35, eligible: false, reduceMotion: false }),
    );
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(threadSettleCalls()).toBe(0);
  });

  it('the once-ever flag is written when the scene starts, not when it is queued', () => {
    act(() => {
      useCelebrationStore.getState().request(3, 'hold-for-first', { durationMs: 1000 });
    });
    renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-queued-first', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);

    act(() => {
      useCelebrationStore.getState().finish('hold-for-first');
    });
    expect(useCelebrationStore.getState().active?.id).toBe('practice-complete:hook-queued-first');
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(true);
  });

  it('a remount of the same session lands on the settled state and plays nothing again', () => {
    const first = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-remount', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    advance(2400);
    first.unmount();
    expect(useCelebrationStore.getState().active).toBeNull();

    const second = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-remount', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    expect(second.result.current.kind).toBe('first');
    expect(second.result.current.phase).toBe('settled');
    expect(second.result.current.barProgress.value).toBeCloseTo(0.35);
    expect(useCelebrationStore.getState().active).toBeNull();
    advance(4000);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('an unmount mid-scene releases the scene from the coordinator', () => {
    const { unmount } = renderHook(() =>
      usePracticeCompletionScene({ sessionId: 'hook-unmount', fromValue: 30, toValue: 35, eligible: true, reduceMotion: false }),
    );
    expect(useCelebrationStore.getState().active?.id).toBe('practice-complete:hook-unmount');
    unmount();
    expect(useCelebrationStore.getState().active).toBeNull();
    advance(4000);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });
});
