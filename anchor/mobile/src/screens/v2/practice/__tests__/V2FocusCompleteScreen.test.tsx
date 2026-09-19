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

  it('renders "You returned." headline and practice duration', () => {
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

    expect(screen.getByText('You returned.')).toBeTruthy();
    expect(screen.getByText('30 sec practiced')).toBeTruthy();
    expect(screen.getByText('FOCUS COMPLETE')).toBeTruthy();
  });

  it('renders "1 min practiced" for 60 second duration', () => {
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

    expect(screen.getByText('1 min practiced')).toBeTruthy();
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
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByText('54')).toBeTruthy();
    expect(screen.getByTestId('focus-thread-delta')).toBeTruthy();
    expect(screen.getByText('+4')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(500);
    });
  });

  it('renders "THREAD FORMING" when thread strength is unmeasured, strictly never fabricating prototype increments', () => {
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

    expect(screen.getByText('THREAD FORMING')).toBeTruthy();
    expect(
      screen.getByText(
        'Each return gives Anchor more signal. Keep reinforcing it and your baseline will take shape.'
      )
    ).toBeTruthy();

    expect(screen.queryByTestId('focus-thread-delta')).toBeNull();
    expect(screen.queryByText('+8')).toBeNull();
    expect(screen.queryByText('+14')).toBeNull();
  });

  it('triggers onDone when Done button is pressed', () => {
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
