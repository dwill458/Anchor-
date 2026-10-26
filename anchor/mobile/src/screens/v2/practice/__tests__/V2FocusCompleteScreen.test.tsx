import React from 'react';
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusCompleteScreen } from '../focus/V2FocusCompleteScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { playCreationSound } from '@/services/CreationSounds';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { safeHaptics } from '@/utils/haptics';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { useCelebrationRecordsStore } from '@/stores/v2/celebrationRecordsStore';
import { NavigationContext } from '@react-navigation/native';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { withTiming } from 'react-native-reanimated';

jest.mock('@/utils/scheduleAfterInteractions', () => ({ scheduleAfterInteractions: (callback: () => void) => { callback(); return { cancel: jest.fn() }; } }));
jest.mock('@/stores/encryptedPersistStorage', () => ({ readSecureValue: jest.fn(async () => null), writeSecureValue: jest.fn(async () => undefined), encryptedPersistStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) } }));
const mockMilestoneAction = jest.fn();
jest.mock('@/milestones/queueMilestoneAction', () => ({ queueMilestoneAction: (...args: unknown[]) => mockMilestoneAction(...args) }));

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/hooks/useCelebrationReduceMotion', () => ({
  useCelebrationReduceMotion: jest.fn(() => false),
}));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(() => Promise.resolve()),
    selection: jest.fn(() => Promise.resolve()),
    notification: jest.fn(() => Promise.resolve()),
  },
}));

/** Repeat practice settles at 1500ms (fill 500 to 1500). First practice settles at 2300ms. */
const REPEAT_SETTLE_MS = 1600;
const FIRST_SETTLE_MS = 2300;

const threadCueCalls = () =>
  (playCreationSound as jest.Mock).mock.calls.filter(([key]) => typeof key === 'string' && key.startsWith('thread')).length;

const setTeachingFlag = (value: boolean) =>
  useTeachingStore.setState((state) => ({
    userFlags: { ...state.userFlags, hasSeenFirstPracticeScene: value },
  }));

const setPracticeHistory = (completed: number) => {
  useSessionStore.setState({
    practiceHistory: Array.from({ length: completed }, (_, index) => ({
      id: `prior-${index}`,
      completionStatus: 'completed',
    })) as unknown as ReturnType<typeof useSessionStore.getState>['practiceHistory'],
    totalSessionsCount: completed,
  });
};

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

const renderScene = (sessionId: string | null, before: number, after: number) => (
  <V2FocusCompleteScreen
    anchor={makeAnchor({ id: 'a1', category: 'desire', threadStrength: after })}
    durationSeconds={30}
    beforeStrength={before}
    afterStrength={after}
    sessionId={sessionId}
    onDone={jest.fn()}
    onAgain={jest.fn()}
  />
);

describe('V2FocusCompleteScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(true);
    setPracticeHistory(3);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the Focus completion hierarchy', () => {
    const anchor = makeAnchor({
      id: 'a1',
      intentionText: 'Stay centered through change',
      category: 'health',
      threadStrength: 50,
    });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByText('Focus complete')).toBeTruthy();
    expect(screen.getByText('Reinforced today ✓')).toBeTruthy();
    expect(screen.queryByText('FOCUS COMPLETE')).toBeNull();
  });

  it('keeps the completion hierarchy concise for a 60 second duration', () => {
    const anchor = makeAnchor({
      id: 'a1',
      intentionText: 'Stay centered through change',
      category: 'learning',
      threadStrength: 50,
    });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={60}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByText('Focus complete')).toBeTruthy();
    expect(screen.getByText('Reinforced today ✓')).toBeTruthy();
  });

  it('renders authoritative Thread Strength movement when before and after are provided', () => {
    const anchor = makeAnchor({
      id: 'a1',
      category: 'desire',
      threadStrength: 54,
    });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        beforeStrength={50}
        afterStrength={54}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByTestId('focus-complete-thread-bar')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('54%')).toBeTruthy();
    expect(screen.getByTestId('focus-thread-delta')).toBeTruthy();
    expect(screen.getByText('+4')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(500);
    });
  });

  it('records completion without fabricating a Thread movement when strength is unmeasured', () => {
    const anchor = makeAnchor({
      id: 'a1',
      category: 'creativity',
      threadStrength: undefined,
    });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        beforeStrength={undefined}
        afterStrength={undefined}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByText('THREAD STRENGTH')).toBeTruthy();
    expect(
      screen.getByText('Session recorded. Strength will appear as data builds.')
    ).toBeTruthy();

    expect(screen.queryByTestId('focus-thread-delta')).toBeNull();
    expect(screen.queryByText('+8')).toBeNull();
    expect(screen.queryByText('+14')).toBeNull();
  });

  it('shows one current Thread Strength value when the backend reports no movement', () => {
    const anchor = makeAnchor({ id: 'a1', threadStrength: 24 });
    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        beforeStrength={24}
        afterStrength={24}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByText('24%')).toBeTruthy();
    expect(screen.queryByText('24% → 24%')).toBeNull();
    expect(screen.getByText('Reinforced today ✓')).toBeTruthy();
    advance(1200);
    expect(playCreationSound).not.toHaveBeenCalledWith('threadSettle');
  });

  it('plays Thread settle once after the bar fills only when strength increased', () => {
    const anchor = makeAnchor({ id: 'a1', threadStrength: 30 });
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={30} beforeStrength={30} afterStrength={35} onDone={jest.fn()} onAgain={jest.fn()} />);
    advance(REPEAT_SETTLE_MS);
    expect(playCreationSound).toHaveBeenCalledTimes(1);
    expect(playCreationSound).toHaveBeenCalledWith('threadSettle');

    jest.clearAllMocks();
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={30} beforeStrength={35} afterStrength={30} onDone={jest.fn()} onAgain={jest.fn()} />);
    advance(REPEAT_SETTLE_MS);
    expect(playCreationSound).not.toHaveBeenCalled();
  });

  it('does not claim reinforcement when the session record was not saved', () => {
    const anchor = makeAnchor({ id: 'a1', threadStrength: 24 });
    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        sessionSaved={false}
        onDone={jest.fn()}
        onAgain={jest.fn()}
      />
    );

    expect(screen.getByText('This session could not be saved. Thread Strength was not updated.')).toBeTruthy();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    expect(screen.queryByTestId('focus-complete-thread-bar')).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('triggers onDone when Continue button is pressed', () => {
    const onDone = jest.fn();
    const anchor = makeAnchor({ id: 'a1' });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        onDone={onDone}
        onAgain={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('focus-complete-done-button'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('triggers onAgain when Focus again link is pressed', () => {
    const onAgain = jest.fn();
    const anchor = makeAnchor({ id: 'a1' });

    render(
      <V2FocusCompleteScreen
        anchor={anchor}
        durationSeconds={30}
        onDone={jest.fn()}
        onAgain={onAgain}
      />
    );

    fireEvent.press(screen.getByTestId('focus-complete-again-button'));
    expect(onAgain).toHaveBeenCalledTimes(1);
  });
});

describe('V2FocusCompleteScreen Thread settle is once per session', () => {
  const anchor = makeAnchor({ id: 'a1', threadStrength: 30 });
  const renderMoved = (sessionId?: string) => (
    <V2FocusCompleteScreen
      anchor={anchor}
      durationSeconds={30}
      beforeStrength={30}
      afterStrength={35}
      sessionId={sessionId}
      onDone={jest.fn()}
      onAgain={jest.fn()}
    />
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(true);
    setPracticeHistory(3);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays once when the same session remounts, e.g. Focus again and back', () => {
    const first = render(renderMoved('thread-remount-session'));
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(1);
    first.unmount();

    const second = render(renderMoved('thread-remount-session'));
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(1);
    second.unmount();
  });

  it('plays again for a new session id', () => {
    const first = render(renderMoved('thread-new-session-a'));
    advance(REPEAT_SETTLE_MS);
    first.unmount();

    const second = render(renderMoved('thread-new-session-b'));
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(2);
    second.unmount();
  });

  it('keeps the bar filling on a remount while the sound stays deduplicated', () => {
    const first = render(renderMoved('thread-bar-session'));
    advance(REPEAT_SETTLE_MS);
    first.unmount();

    const second = render(renderMoved('thread-bar-session'));
    advance(REPEAT_SETTLE_MS);
    expect(screen.getByTestId('focus-complete-thread-bar')).toBeTruthy();
    expect(screen.getByTestId('focus-thread-delta')).toBeTruthy();
    expect(threadCueCalls()).toBe(1);
    second.unmount();
  });

  it('keeps the Reduce Motion path playing once per session across remounts', () => {
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(true);
    const first = render(renderMoved('thread-reduce-session'));
    expect(threadCueCalls()).toBe(1);
    first.unmount();

    const second = render(renderMoved('thread-reduce-session'));
    expect(threadCueCalls()).toBe(1);
    second.unmount();
  });

  it('still plays without a session id, once per mount, as before', () => {
    const first = render(renderMoved());
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(1);
    first.unmount();
  });
});

describe('V2FocusCompleteScreen first practice scene (P1)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(false);
    setPracticeHistory(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests level 3 and marks the once-ever flag when the scene starts', () => {
    render(renderScene('p1-once', 30, 35));
    expect(useCelebrationStore.getState().active).toEqual({
      id: 'practice-complete:p1-once',
      level: 3,
      skippable: true,
    });
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(true);
  });

  it('settles at the end of the fill: one threadSettle and one Medium haptic', () => {
    render(renderScene('p1-settle', 30, 35));
    advance(FIRST_SETTLE_MS - 1);
    expect(threadCueCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    advance(1);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
  });

  it('says the Thread has begun after the settle and releases the scene at 3.9s', () => {
    render(renderScene('p1-line', 30, 35));
    advance(2500);
    expect(screen.getByText('Your Thread has begun.')).toBeTruthy();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    expect(useCelebrationStore.getState().active?.id).toBe('practice-complete:p1-line');
    advance(1400);
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('a tap on Skip lands the settled values, plays the settle beat once, and removes the control', () => {
    render(renderScene('p1-skip', 30, 35));
    fireEvent.press(screen.getByLabelText('Skip'));
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    expect(screen.getByText('Your Thread has begun.')).toBeTruthy();
    expect(screen.getByText('35%')).toBeTruthy();
    expect(screen.queryByLabelText('Skip')).toBeNull();
  });

  it('a remount of the same session shows the settled line and does not play again', () => {
    const first = render(renderScene('p1-remount', 30, 35));
    advance(FIRST_SETTLE_MS);
    first.unmount();

    render(renderScene('p1-remount', 30, 35));
    advance(FIRST_SETTLE_MS);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Your Thread has begun.')).toBeTruthy();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('a higher-level scene preempts it and it lands on the settled end state without a cue', () => {
    render(renderScene('p1-preempt', 30, 35));
    act(() => {
      useCelebrationStore.getState().request(4, 'other-major', { durationMs: 6000 });
    });
    expect(useCelebrationStore.getState().active?.id).toBe('other-major');
    expect(screen.getByText('Your Thread has begun.')).toBeTruthy();
    expect(threadCueCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });

  it('releases the scene from the coordinator when the screen leaves', () => {
    const { unmount } = render(renderScene('p1-unmount', 30, 35));
    expect(useCelebrationStore.getState().active?.id).toBe('practice-complete:p1-unmount');
    unmount();
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('under Reduce Motion registers level 2, snaps, and still fires the settle cue and haptic', () => {
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(true);
    render(renderScene('p1-reduce', 30, 35));
    expect(useCelebrationStore.getState().active).toEqual({
      id: 'practice-complete:p1-reduce',
      level: 2,
      skippable: true,
    });
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    expect(screen.getByText('Your Thread has begun.')).toBeTruthy();
    advance(300);
    expect(useCelebrationStore.getState().active).toBeNull();
  });
});

describe('V2FocusCompleteScreen repeat practice scene (P2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(true);
    setPracticeHistory(3);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('requests level 2 with no skip control, strikes the old value, and settles at 1.5s with one Light haptic', () => {
    render(renderScene('p2-settle', 30, 35));
    expect(useCelebrationStore.getState().active).toEqual({
      id: 'practice-complete:p2-settle',
      level: 2,
      skippable: false,
    });
    expect(screen.queryByLabelText('Skip')).toBeNull();
    const struck = StyleSheet.flatten(screen.getByText('30%').props.style);
    expect(struck.textDecorationLine).toBe('line-through');

    advance(1499);
    expect(threadCueCalls()).toBe(0);
    advance(1);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
    expect(screen.getByText('Reinforced today ✓')).toBeTruthy();
  });

  it('plays the repeat scene when the once-ever flag is unset but there was prior practice', () => {
    setTeachingFlag(false);
    setPracticeHistory(2);
    render(renderScene('p2-prior', 30, 35));
    expect(useCelebrationStore.getState().active?.level).toBe(2);
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);
  });
});

describe('V2FocusCompleteScreen with no real gain', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(false);
    setPracticeHistory(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['a zero gain', 40, 40],
    ['a negative gain', 40, 35],
  ])('animates nothing, plays no cue or haptic, and requests no scene for %s', (_label, before, after) => {
    render(renderScene(`zero-${before}-${after}`, before, after));
    advance(FIRST_SETTLE_MS + 500);
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(threadCueCalls()).toBe(0);
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);
  });
});

describe('V2FocusCompleteScreen coordinator sequencing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(true);
    setPracticeHistory(3);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a repeat scene waits behind a higher-level scene and starts when it is promoted', () => {
    act(() => {
      useCelebrationStore.getState().request(3, 'hold-l3', { durationMs: 1000 });
    });
    render(renderScene('p2-queued', 30, 35));
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(0);

    act(() => {
      useCelebrationStore.getState().finish('hold-l3');
    });
    expect(useCelebrationStore.getState().active?.id).toBe('practice-complete:p2-queued');
    advance(REPEAT_SETTLE_MS);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
  });
});

describe('V2FocusCompleteScreen entry', () => {
  const anchor = makeAnchor({ id: 'a1', intentionText: 'Stay centered', category: 'health', threadStrength: 50 });
  const opacityOf = (id: string) => {
    const style = StyleSheet.flatten(screen.getByTestId(id).props.style);
    return style.opacity;
  };

  it('arrives from the ink field by default, which fades away', () => {
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={60} onDone={jest.fn()} onAgain={jest.fn()} />);
    // The Reanimated stand-in resolves animations to their end values immediately.
    expect(withTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 500 }));
    expect(opacityOf('v2-focus-complete-ink')).toBe(0);
  });

  it('arrives on cream after Visualize, whose last frame is the cream board, so there is no dark flash', () => {
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={60} practiceTitle="Visualize" enterFrom="cream" onDone={jest.fn()} onAgain={jest.fn()} />);
    expect(opacityOf('v2-focus-complete-ink')).toBe(0);
  });
});

describe('authoritative post-practice milestone boundary', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false); useCelebrationStore.getState().reset(); });
  afterEach(() => jest.useRealTimers());
  const props = () => ({ anchor: makeAnchor({ id: 'a1', threadStrength: 35 }), durationSeconds: 60, sessionId: 'confirmed-session', beforeStrength: 30, afterStrength: 35, onDone: jest.fn(), onAgain: jest.fn() });
  it('preserves normal completion and requests a reservation after its entry, once', () => {
    const view = render(<V2FocusCompleteScreen {...props()} sessionSaved />);
    expect(view.getByTestId('v2-focus-complete-screen')).toBeTruthy();
    advance(2499); expect(mockMilestoneAction).not.toHaveBeenCalled();
    advance(1); expect(mockMilestoneAction).toHaveBeenCalledTimes(1);
    expect(mockMilestoneAction).toHaveBeenCalledWith('a1', { kind: 'practice', sourceEntityId: 'confirmed-session' }, expect.any(Function), expect.any(Function));
    const guard = mockMilestoneAction.mock.calls[0][2]; expect(guard()).toBe(true);
    view.unmount(); expect(guard()).toBe(false);
  });
  it('cannot celebrate an unconfirmed or failed save', () => {
    render(<V2FocusCompleteScreen {...props()} sessionSaved={false} />);
    advance(6000); expect(mockMilestoneAction).not.toHaveBeenCalled();
  });
  it('accepts a late confirmation only while the same completion remains mounted', () => {
    const p = props(); const view = render(<V2FocusCompleteScreen {...p} sessionSaved={false} />);
    advance(3000); expect(mockMilestoneAction).not.toHaveBeenCalled();
    view.rerender(<V2FocusCompleteScreen {...p} sessionSaved />);
    expect(mockMilestoneAction).toHaveBeenCalledTimes(1);
  });
  it('releases its global milestone hold when a failed-save completion loses focus', () => {
    let focused = true;
    const listeners = new Map<string, Set<() => void>>();
    const navigation = {
      isFocused: () => focused,
      addListener: (event: string, listener: () => void) => {
        const callbacks = listeners.get(event) ?? new Set<() => void>();
        callbacks.add(listener); listeners.set(event, callbacks);
        return () => callbacks.delete(listener);
      },
    };
    const holdsBefore = useMilestoneCelebrationStore.getState().holds.length;
    render(<NavigationContext.Provider value={navigation as never}><V2FocusCompleteScreen {...props()} sessionSaved={false} /></NavigationContext.Provider>);
    advance(3000);
    expect(useMilestoneCelebrationStore.getState().holds.length).toBeGreaterThan(holdsBefore);
    act(() => { focused = false; listeners.get('blur')?.forEach(listener => listener()); });
    expect(useMilestoneCelebrationStore.getState().holds.length).toBe(holdsBefore);
    expect(mockMilestoneAction).not.toHaveBeenCalled();
  });
});

describe('V2FocusCompleteScreen stage and Full Strength scenes (celebration Step 4a)', () => {
  const RECORD_DATE = '2026-01-02T03:04:05.000Z';

  const flush = () => act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
    useCelebrationStore.getState().reset();
    setTeachingFlag(true);
    setPracticeHistory(3);
    useCelebrationRecordsStore.setState({ records: {}, hydrated: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a first stage shows the five-segment strip, the Established segment, and the stage line after the fill', async () => {
    render(renderScene('screen-stage-first', 47, 53));
    await flush();
    expect(screen.getByTestId('focus-complete-stage-strip')).toBeTruthy();
    expect(screen.getByText('Established')).toBeTruthy();
    expect(screen.getByText('Your Anchor is now Established.')).toBeTruthy();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    expect(screen.queryByTestId('focus-complete-full-strength-ring')).toBeNull();
    expect(screen.getByLabelText('Skip')).toBeTruthy();
  });

  it('a stage re-reached after decay relights the segment with no sentence at all, at level 2 and not skippable', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: { established: RECORD_DATE } } } });
    render(renderScene('screen-stage-relight', 47, 53));
    await flush();
    // The strip and the Established segment are drawn, but no line is rendered in the note's place.
    expect(screen.getByTestId('focus-complete-stage-strip')).toBeTruthy();
    expect(screen.queryByText('Established again.')).toBeNull();
    expect(screen.queryByText('Your Anchor is now Established.')).toBeNull();
    expect(screen.queryByText('Reinforced today ✓')).toBeNull();
    expect(screen.queryByTestId('focus-complete-full-strength-ring')).toBeNull();
    expect(useCelebrationStore.getState().active).toMatchObject({ level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBeLessThanOrEqual(2000);
    expect(screen.queryByLabelText('Skip')).toBeNull();
    // One Light haptic and the short relight cue land together.
    advance(1200);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('light');
    expect(threadCueCalls()).toBe(1);
  });

  it('a first Full Strength shows the ring, the Full Strength line and its subline, and the ring closes at 2.9s', async () => {
    render(renderScene('screen-full-first', 96, 100));
    await flush();
    expect(screen.getByTestId('focus-complete-full-strength-ring')).toBeTruthy();
    expect(screen.getByText('Full Strength.')).toBeTruthy();
    expect(screen.getByText('Your Anchor is fully reinforced.')).toBeTruthy();
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 4, durationMs: 4600 });
    expect(threadCueCalls()).toBe(0);
    advance(2000);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    advance(900);
    expect(safeHaptics.impact).toHaveBeenLastCalledWith('light');
  });

  it('back at 100 after decay shows the short line and no ring or subline', async () => {
    useCelebrationRecordsStore.setState({ records: { a1: { stages: {}, fullStrengthAt: RECORD_DATE } } });
    render(renderScene('screen-full-repeat', 97, 100));
    await flush();
    expect(screen.getByText('Back at full strength.')).toBeTruthy();
    expect(screen.queryByTestId('focus-complete-full-strength-ring')).toBeNull();
    expect(screen.queryByText('Your Anchor is fully reinforced.')).toBeNull();
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 3, durationMs: 3200 });
  });

  it('already at 100 shows no Full Strength wording and requests nothing', async () => {
    render(renderScene('screen-at-cap', 100, 100));
    await flush();
    expect(screen.queryByText('Full Strength.')).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
  });

  it('skipping a Full Strength scene lands the final line and ring, and the settle beat fires once', async () => {
    render(renderScene('screen-full-skip', 96, 100));
    await flush();
    advance(500);
    fireEvent.press(screen.getByLabelText('Skip'));
    expect(screen.getByText('Full Strength.')).toBeTruthy();
    expect(screen.getByTestId('focus-complete-full-strength-ring')).toBeTruthy();
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
    advance(5000);
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledTimes(1);
  });

  it('under Reduce Motion a first stage plays its chord at once with level 2 and the same words', async () => {
    (useCelebrationReduceMotion as jest.Mock).mockReturnValue(true);
    render(renderScene('screen-stage-rm', 47, 53));
    await flush();
    expect(useCelebrationStore.getState().current).toMatchObject({ level: 2 });
    expect(threadCueCalls()).toBe(1);
    expect(safeHaptics.impact).toHaveBeenCalledWith('medium');
    expect(screen.getByText('Your Anchor is now Established.')).toBeTruthy();
  });
});

describe('Phase 3 completion ownership', () => {
 let sequence = 0;
 beforeEach(async () => {
  jest.useFakeTimers(); sequence++;
  const { useAuthStore } = require('@/stores/authStore');
  const { useSettingsStore } = require('@/stores/settingsStore');
  const { bindGuidanceAccount, guidanceCoordinator } = require('@/hooks/v2/guidance/guidanceRuntime');
  const account = `phase3-completion-${sequence}`;
  useAuthStore.setState({ user: { id: account } });
  useSettingsStore.setState({ showTips: true });
  useCelebrationStore.getState().reset();
  useMilestoneCelebrationStore.setState({ queue: [], holds: [] });
  setTeachingFlag(true); setPracticeHistory(3);
  (useCelebrationReduceMotion as jest.Mock).mockReturnValue(false);
  guidanceCoordinator.dispose();
  await bindGuidanceAccount(account);
  guidanceCoordinator.bind(account, { records: {}, discovery: {} });
 });
 afterEach(() => jest.useRealTimers());
 const props = () => ({ anchor: makeAnchor({ id: 'a1', threadStrength: 35 }), durationSeconds: 60, sessionId: `phase3-session-${sequence}`, beforeStrength: 30, afterStrength: 35, onDone: jest.fn(), onAgain: jest.fn() });
 const finish = async () => { advance(2600); await act(async () => { await Promise.resolve(); }); advance(0); };
 it('waits for the real scene end and never teaches from an unverified snapshot', async () => {
  const p = props(); const view = render(<V2FocusCompleteScreen {...p} />);
  await finish();
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
  view.rerender(<V2FocusCompleteScreen {...p} strengthResultVerified />);
  await act(async () => { await Promise.resolve(); }); advance(0);
  expect(view.getByText("Your Thread Strength grew \u2014 and your Anchor's glow with it.")).toBeTruthy();
  fireEvent(view.getByTestId('focus-complete-scroll'), 'layout', { nativeEvent: { layout: { height: 600 } } });
  fireEvent(view.getByTestId('thread-glow-lesson'), 'layout', { nativeEvent: { layout: { y: 300, height: 80 } } });
  advance(1000);
  const { guidanceCoordinator } = require('@/hooks/v2/guidance/guidanceRuntime');
  expect(guidanceCoordinator.data().records['thread.glow']).toMatchObject({ displayCount: 1, variant: 'B' });
  fireEvent.press(view.getByTestId('focus-complete-done-button'));
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
 });
 it('cancels pending education when Continue leaves before the scene ends', async () => {
  const view = render(<V2FocusCompleteScreen {...props()} strengthResultVerified />);
  advance(1600);
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
  fireEvent.press(view.getByTestId('focus-complete-done-button'));
  await finish();
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
 });
 it.each([false, true])('shows first-use copy after the natural transition (reduced motion: %s)', async reduced => {
  setTeachingFlag(false); setPracticeHistory(0);
  (useCelebrationReduceMotion as jest.Mock).mockReturnValue(reduced);
  const view = render(<V2FocusCompleteScreen {...props()} strengthResultVerified />);
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
  advance(reduced ? 500 : 4000);
  await act(async () => { await Promise.resolve(); }); advance(0);
  expect(view.getByText("As your Thread Strength grows, so does your Anchor's glow.")).toBeTruthy();
 });
 it('invalidates the result scene when the account changes', async () => {
  const view = render(<V2FocusCompleteScreen {...props()} strengthResultVerified />);
  await finish();
  expect(view.getByTestId('thread-glow-lesson')).toBeTruthy();
  const { useAuthStore } = require('@/stores/authStore');
  act(() => useAuthStore.setState({ user: { id: 'different-phase3-account' } }));
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
 });

 it('cancels pending education on background instead of delivering it on foreground', async () => {
  const listeners: Array<(state: AppStateStatus) => void> = [];
  const originalSubscription = AppState.addEventListener;
  AppState.addEventListener = jest.fn((event: string, callback: (state: AppStateStatus) => void) => {
    if (event === 'change') listeners.push(callback as (state: AppStateStatus) => void);
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener;
  try {
    const view = render(<V2FocusCompleteScreen {...props()} strengthResultVerified />);
    advance(500);
    expect(listeners.length).toBeGreaterThan(0);
    act(() => listeners.forEach(listener => listener('background')));
    await finish();
    act(() => listeners.forEach(listener => listener('active')));
    advance(0);
    expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
  } finally { AppState.addEventListener = originalSubscription; }
 });
 it('yields a visible line to a starting milestone without acquiring another hold', async () => {
  const view = render(<V2FocusCompleteScreen {...props()} strengthResultVerified />);
  await finish();
  expect(view.getByTestId('thread-glow-lesson')).toBeTruthy();
  const holds = useMilestoneCelebrationStore.getState().holds;
  act(() => useMilestoneCelebrationStore.setState({ queue: [{ key: 'new-milestone' } as never] }));
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
  expect(useMilestoneCelebrationStore.getState().holds).toEqual(holds);
  act(() => useMilestoneCelebrationStore.setState({ queue: [] }));
  advance(0);
  expect(view.queryByTestId('thread-glow-lesson')).toBeNull();
 });

});
