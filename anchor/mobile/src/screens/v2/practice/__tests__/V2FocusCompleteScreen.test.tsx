import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusCompleteScreen } from '../focus/V2FocusCompleteScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';

describe('V2FocusCompleteScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
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
