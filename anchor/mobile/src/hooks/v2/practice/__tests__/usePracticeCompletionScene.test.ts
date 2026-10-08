import { act, renderHook } from '@testing-library/react-native';
import { playCreationSound } from '@/services/CreationSounds';
import { safeHaptics } from '@/utils/haptics';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useCelebrationRecordsStore } from '@/stores/v2/celebrationRecordsStore';
import {
  fullStrengthCrossedBy,
  isFirstPracticeEver,
  planPracticeSceneKind,
  practiceSceneValues,
  sceneForRecords,
  stageCrossedBy,
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
    const none = { strip: 0, segment: 0, ring: 0, subline: 0 };
    expect(practiceSceneValues('first', 30, 35, 'start')).toEqual({ bar: 0.3, glow: 0.22, label: 0, value: 0, note: 0, ...none });
    expect(practiceSceneValues('first', 30, 35, 'final')).toEqual({ bar: 0.35, glow: 0.36, label: 1, value: 1, note: 1, ...none });
    expect(practiceSceneValues('repeat', 30, 35, 'start')).toEqual({ bar: 0.3, glow: 0.32, label: 1, value: 0, note: 0, ...none });
    expect(practiceSceneValues('repeat', 30, 35, 'final')).toEqual({ bar: 0.35, glow: 0.38, label: 1, value: 1, note: 1, ...none });
    expect(practiceSceneValues('none', 40, 40, 'start')).toEqual({ bar: 0.4, glow: 0.32, label: 1, value: 1, note: 1, ...none });
  });

  it('practiceSceneValues settles the stage strip and the Full Strength ring only on the scenes that have them', () => {
    expect(practiceSceneValues('stageFirst', 47, 53, 'final')).toMatchObject({ bar: 0.53, strip: 1, segment: 1, ring: 0, subline: 0 });
    expect(practiceSceneValues('stageFirst', 47, 53, 'start')).toMatchObject({ strip: 0, segment: 0 });
    expect(practiceSceneValues('fullFirst', 96, 100, 'final')).toMatchObject({ bar: 1, ring: 1, subline: 1, strip: 0 });
    expect(practiceSceneValues('fullRepeat', 97, 100, 'final')).toMatchObject({ ring: 0, subline: 0 });
    expect(practiceSceneValues('pending', 47, 53, 'start')).toMatchObject({ bar: 0.47, note: 0, value: 0 });
  });

  it('stageCrossedBy names only an upward crossing into a celebrated stage', () => {
    expect(stageCrossedBy(47, 53)).toBe('established');
    expect(stageCrossedBy(24, 25)).toBe('building');
    expect(stageCrossedBy(89, 90)).toBe('reinforced');
    expect(stageCrossedBy(50, 50)).toBeNull();
    expect(stageCrossedBy(53, 58)).toBeNull();
    expect(stageCrossedBy(60, 55)).toBeNull();
    expect(stageCrossedBy(10, 20)).toBeNull();
  });

  it('fullStrengthCrossedBy is true only when the value reaches 100 from below', () => {
    expect(fullStrengthCrossedBy(97, 100)).toBe(true);
    expect(fullStrengthCrossedBy(100, 100)).toBe(false);
    expect(fullStrengthCrossedBy(99, 99)).toBe(false);
  });

  it('sceneForRecords: Full Strength outranks a stage, and a stage is a relight unless it is the first', () => {
    expect(sceneForRecords({ stage: 'established', stageOutcome: 'first', fullStrength: false })).toBe('stageFirst');
    expect(sceneForRecords({ stage: 'reinforced', stageOutcome: 'first', fullStrength: false })).toBe('stageReinforced');
    expect(sceneForRecords({ stage: 'established', stageOutcome: 'repeat', fullStrength: false })).toBe('stageRelight');
    expect(sceneForRecords({ stage: 'reinforced', stageOutcome: 'first', fullStrength: true, fullOutcome: 'first' })).toBe('fullFirst');
    expect(sceneForRecords({ stage: null, fullStrength: true, fullOutcome: 'repeat' })).toBe('fullRepeat');
    expect(sceneForRecords({ stage: null, fullStrength: false })).toBe('none');
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

describe('stage and Full Strength scenes', () => {
  const RECORD_DATE = '2026-01-02T03:04:05.000Z';
  const LATER_DATE = '2026-02-01T00:00:00.000Z';

  const records = () => useCelebrationRecordsStore.getState().records;
  /** Lets the record read resolve and the decision run. */
  const flushDecision = () => act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const stageArgs = (sessionId: string, anchorId = 'a1', reduceMotion = false) => ({
    sessionId, anchorId, fromValue: 47, toValue: 53, eligible: true, reduceMotion,
  });
  const fullArgs = (sessionId: string, from = 96, anchorId = 'a1', reduceMotion = false) => ({
    sessionId, anchorId, fromValue: from, toValue: 100, eligible: true, reduceMotion,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useCelebrationStore.getState().reset();
    setHistory([]);
    // The first-practice scene never competes with the stage and Full Strength scenes under test.
    setFlag(true);
    useCelebrationRecordsStore.setState({ records: {}, hydrated: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a stage crossed for the first time plays the full stage scene at level 3, settles at 1.95s, and records the real date', async () => {
    jest.setSystemTime(new Date(RECORD_DATE));
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('stage-first')));
    expect(result.current.kind).toBe('pending');
    await flushDecision();

    expect(result.current.kind).toBe('stageFirst');
    expect(useCelebrationStore.getState().current).toMatchObject({ id: 'practice-complete:stage-first', level: 3, durationMs: 3800 });
    expect(records().a1.stages.established).toBe(RECORD_DATE);

    advance(1949);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    advance(1);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(1900);
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('a stage re-reached after decay is a quiet relight: level 1, no chord, one Light haptic at 1.7s, and the first date is kept', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: { established: RECORD_DATE } } } });
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('stage-relight')));
    await flushDecision();

    expect(result.current.kind).toBe('stageRelight');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 1, durationMs: 3000 });
    advance(1699);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    advance(1);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
    expect(records().a1.stages.established).toBe(RECORD_DATE);
  });

  it('a completion that crosses no stage keeps the practice scene and writes no record', async () => {
    renderHook(() => usePracticeCompletionScene({ ...stageArgs('no-cross'), fromValue: 30, toValue: 35 }));
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2, durationMs: 2500 });
    await flushDecision();
    expect(records()).toEqual({});
  });

  it('a Reinforced crossing is the same scene, longer, at level 4', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene({ ...stageArgs('reinforced'), fromValue: 88, toValue: 93 }));
    await flushDecision();
    expect(result.current.kind).toBe('stageReinforced');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 4, durationMs: 4600 });
    expect(records().a1.stages.reinforced).toBeDefined();
  });

  it('reaching 100 for the first time plays Full Strength at level 4, closes the ring at 2.9s with a Light haptic, and records it', async () => {
    jest.setSystemTime(new Date(RECORD_DATE));
    const { result } = renderHook(() => usePracticeCompletionScene(fullArgs('full-first')));
    await flushDecision();

    expect(result.current.kind).toBe('fullFirst');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 4, durationMs: 4600 });
    expect(records().a1.fullStrengthAt).toBe(RECORD_DATE);

    advance(1999);
    expect(threadSettleCalls()).toBe(0);
    advance(1);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(899);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    advance(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(2);
    expect(safeHaptics.impact).toHaveBeenLastCalledWith('light');
    advance(1700);
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('Full Strength again after decay is the short scene at level 3: a Light wake, no chord, and the last date is updated', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: {}, fullStrengthAt: RECORD_DATE } } });
    jest.setSystemTime(new Date(LATER_DATE));
    const { result } = renderHook(() => usePracticeCompletionScene(fullArgs('full-repeat', 97)));
    await flushDecision();

    expect(result.current.kind).toBe('fullRepeat');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 3, durationMs: 3200 });
    advance(1699);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    advance(1);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
    expect(records().a1.fullStrengthAt).toBe(RECORD_DATE);
    expect(records().a1.fullStrengthLastAt).toBe(LATER_DATE);
  });

  it('already at 100 requests nothing and plays nothing', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene({ ...fullArgs('at-cap', 100) }));
    await flushDecision();
    expect(result.current.kind).toBe('none');
    expect(useCelebrationStore.getState().active).toBeNull();
    advance(5000);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(records()).toEqual({});
  });

  it('a stage and Full Strength in one completion plays Full Strength only, and still records the stage', async () => {
    renderHook(() => usePracticeCompletionScene(fullArgs('both', 88)));
    await flushDecision();
    expect(useCelebrationStore.getState().current).toMatchObject({ id: 'practice-complete:both', level: 4, durationMs: 4600 });
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(records().a1.stages.reinforced).toBeDefined();
    expect(records().a1.fullStrengthAt).toBeDefined();
  });

  it('a zero gain records nothing and requests nothing', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene({ ...stageArgs('zero'), fromValue: 40, toValue: 40 }));
    await flushDecision();
    expect(result.current.kind).toBe('none');
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(records()).toEqual({});
  });

  it('records persist per Anchor: a second Anchor celebrates its own first stage', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: { established: RECORD_DATE } } } });
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('per-anchor', 'a2')));
    await flushDecision();
    expect(result.current.kind).toBe('stageFirst');
    expect(records().a1.stages.established).toBe(RECORD_DATE);
    expect(records().a2.stages.established).toBeDefined();
  });

  it('before the records are read nothing replays a full scene: after the read times out the practice scene plays, and nothing is written', async () => {
    useCelebrationRecordsStore.setState({ hydrated: false });
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('unhydrated')));
    await flushDecision();
    expect(result.current.kind).toBe('pending');
    expect(useCelebrationStore.getState().active).toBeNull();

    advance(800);
    await flushDecision();
    expect(result.current.kind).toBe('repeat');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2, durationMs: 2500 });
    expect(records()).toEqual({});
  });

  it('under Reduce Motion a full stage registers at level 2, the chord and haptic fire at once, and the record is still written', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('stage-rm', 'a1', true)));
    await flushDecision();
    expect(result.current.kind).toBe('stageFirst');
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2 });
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    expect(records().a1.stages.established).toBeDefined();
    advance(5000);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('under Reduce Motion Full Strength is level 2 with the bar at its value, the chord at once, and no motion haptic later', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene(fullArgs('full-rm', 96, 'a1', true)));
    await flushDecision();
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2 });
    expect(result.current.barProgress.value).toBeCloseTo(1);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(5000);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('under Reduce Motion a quiet relight stays at level 1 and its Light haptic fires at once', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: { established: RECORD_DATE } } } });
    renderHook(() => usePracticeCompletionScene(stageArgs('relight-rm', 'a1', true)));
    await flushDecision();
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 1 });
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
  });

  it('skipping Full Strength lands the bar, the ring and the text on their end state, and fires the settle beat once', async () => {
    const { result } = renderHook(() => usePracticeCompletionScene(fullArgs('full-skip')));
    await flushDecision();
    advance(500);
    act(() => { result.current.skip(); });

    expect(result.current.barProgress.value).toBeCloseTo(1);
    expect(result.current.ringDraw.value).toBe(1);
    expect(result.current.sublineOpacity.value).toBe(1);
    expect(result.current.noteOpacity.value).toBe(1);
    expect(result.current.phase).toBe('settled');
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);

    advance(5000);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('a quiet relight dropped by a busy coordinator lands silently on its end state and is not replayed', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: { established: RECORD_DATE } } } });
    act(() => {
      useCelebrationStore.getState().request(3, 'busy-hold', { durationMs: 1000 });
    });
    const { result } = renderHook(() => usePracticeCompletionScene(stageArgs('dropped-relight')));
    await flushDecision();

    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(result.current.kind).toBe('stageRelight');
    expect(result.current.phase).toBe('settled');
    expect(result.current.barProgress.value).toBeCloseTo(0.53);
    expect(threadSettleCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });

  it('a remount of a played stage scene lands settled and does not replay the chord', async () => {
    const first = renderHook(() => usePracticeCompletionScene(stageArgs('stage-remount')));
    await flushDecision();
    advance(2000);
    first.unmount();

    const second = renderHook(() => usePracticeCompletionScene(stageArgs('stage-remount')));
    expect(second.result.current.kind).toBe('stageFirst');
    expect(second.result.current.phase).toBe('settled');
    expect(useCelebrationStore.getState().active).toBeNull();
    advance(4000);
    expect(threadSettleCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('unmounting before the records are read cancels the decision: no scene starts and nothing is recorded', async () => {
    const { unmount } = renderHook(() => usePracticeCompletionScene(stageArgs('unmount-decision')));
    unmount();
    await flushDecision();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(records()).toEqual({});
    expect(threadSettleCalls()).toBe(0);
  });
});
