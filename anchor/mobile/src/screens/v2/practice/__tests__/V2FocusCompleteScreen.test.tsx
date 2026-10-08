import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusCompleteScreen } from '../focus/V2FocusCompleteScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { playCreationSound } from '@/services/CreationSounds';
import { useV2ReduceMotion } from '@/hooks/v2';

jest.mock('@/services/CreationSounds', () => ({ playCreationSound: jest.fn() }));
jest.mock('@/hooks/v2', () => ({
  ...jest.requireActual('@/hooks/v2'),
  useV2ReduceMotion: jest.fn(() => false),
}));

describe('V2FocusCompleteScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
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
    act(() => { jest.advanceTimersByTime(1200); });
    expect(playCreationSound).not.toHaveBeenCalledWith('threadSettle');
  });

  it('plays Thread settle once after the bar fills only when strength increased', () => {
    const anchor = makeAnchor({ id: 'a1', threadStrength: 30 });
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={30} beforeStrength={30} afterStrength={35} onDone={jest.fn()} onAgain={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(1200); });
    expect(playCreationSound).toHaveBeenCalledTimes(1);
    expect(playCreationSound).toHaveBeenCalledWith('threadSettle');

    jest.clearAllMocks();
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={30} beforeStrength={35} afterStrength={30} onDone={jest.fn()} onAgain={jest.fn()} />);
    act(() => { jest.advanceTimersByTime(1200); });
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
  const threadSettleCalls = () =>
    (playCreationSound as jest.Mock).mock.calls.filter(([key]) => key === 'threadSettle').length;
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
    (useV2ReduceMotion as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays once when the same session remounts, e.g. Focus again and back', () => {
    const first = render(renderMoved('thread-remount-session'));
    act(() => { jest.advanceTimersByTime(1200); });
    expect(threadSettleCalls()).toBe(1);
    first.unmount();

    const second = render(renderMoved('thread-remount-session'));
    act(() => { jest.advanceTimersByTime(1200); });
    expect(threadSettleCalls()).toBe(1);
    second.unmount();
  });

  it('plays again for a new session id', () => {
    const first = render(renderMoved('thread-new-session-a'));
    act(() => { jest.advanceTimersByTime(1200); });
    first.unmount();

    const second = render(renderMoved('thread-new-session-b'));
    act(() => { jest.advanceTimersByTime(1200); });
    expect(threadSettleCalls()).toBe(2);
    second.unmount();
  });

  it('keeps the bar filling on a remount while the sound stays deduplicated', () => {
    const first = render(renderMoved('thread-bar-session'));
    act(() => { jest.advanceTimersByTime(1200); });
    first.unmount();

    const second = render(renderMoved('thread-bar-session'));
    act(() => { jest.advanceTimersByTime(1200); });
    expect(screen.getByTestId('focus-complete-thread-bar')).toBeTruthy();
    expect(screen.getByTestId('focus-thread-delta')).toBeTruthy();
    expect(threadSettleCalls()).toBe(1);
    second.unmount();
  });

  it('keeps the Reduce Motion path playing once per session across remounts', () => {
    (useV2ReduceMotion as jest.Mock).mockReturnValue(true);
    const first = render(renderMoved('thread-reduce-session'));
    expect(threadSettleCalls()).toBe(1);
    first.unmount();

    const second = render(renderMoved('thread-reduce-session'));
    expect(threadSettleCalls()).toBe(1);
    second.unmount();
  });

  it('still plays without a session id, once per mount, as before', () => {
    const first = render(renderMoved());
    act(() => { jest.advanceTimersByTime(1200); });
    expect(threadSettleCalls()).toBe(1);
    first.unmount();
  });
});

describe('V2FocusCompleteScreen entry', () => {
  const anchor = makeAnchor({ id: 'a1', intentionText: 'Stay centered', category: 'health', threadStrength: 50 });
  const opacityOf = (id: string) => {
    const style = require('react-native').StyleSheet.flatten(screen.getByTestId(id).props.style);
    return style.opacity;
  };

  it('arrives from the ink field by default, which fades away', () => {
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={60} onDone={jest.fn()} onAgain={jest.fn()} />);
    expect(opacityOf('v2-focus-complete-ink')).toBe(1);
  });

  it('arrives on cream after Visualize, whose last frame is the cream board, so there is no dark flash', () => {
    render(<V2FocusCompleteScreen anchor={anchor} durationSeconds={60} practiceTitle="Visualize" enterFrom="cream" onDone={jest.fn()} onAgain={jest.fn()} />);
    expect(opacityOf('v2-focus-complete-ink')).toBe(0);
  });
});
