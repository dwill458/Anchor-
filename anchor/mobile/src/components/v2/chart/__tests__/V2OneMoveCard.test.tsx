import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { V2OneMoveCard } from '../V2OneMoveCard';
import type { V2WaypointPresentation } from '@/adapters/v2/chart';

describe('V2OneMoveCard', () => {
  const baseWaypoint: V2WaypointPresentation = {
    id: 'wp-1',
    value: 'Finish Alpha Build',
    description: 'Ship initial usable app',
    state: 'current',
    isCurrent: true,
    isDestination: false,
    raw: {} as any,
    reached: false,
    reachedAt: null,
    doneMoveCount: 1,
    totalMoveCount: 2,
    moves: [
      { id: 'm-1', waypointId: 'wp-1', text: 'Implement auth', done: true },
      { id: 'm-2', waypointId: 'wp-1', text: 'Connect database', done: false, context: 'Requires Supabase credentials' },
    ],
  };

  it('renders pending move with check circle, text, context, and mark complete button', () => {
    const onCompleteMoveMock = jest.fn();
    const onPromptReachedMock = jest.fn();

    const { getByText, getByLabelText } = render(
      <V2OneMoveCard
        currentWaypoint={baseWaypoint}
        oneMove={baseWaypoint.moves[1]}
        isFinished={false}
        destinationText="10k users"
        onCompleteMove={onCompleteMoveMock}
        onPromptReached={onPromptReachedMock}
        onAddMovePress={jest.fn()}
        onLookBackPress={jest.fn()}
      />,
    );

    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(getByText('Reach Finish Alpha Build')).toBeTruthy();
    expect(getByText('Ship initial usable app')).toBeTruthy();
    expect(getByText('1/2')).toBeTruthy();
    expect(getByText('STEPS')).toBeTruthy();

    expect(getByText('ONE MOVE')).toBeTruthy();
    expect(getByText('Connect database')).toBeTruthy();
    expect(getByText('Requires Supabase credentials')).toBeTruthy();
    expect(getByText('Mark complete')).toBeTruthy();

    // Complete move
    fireEvent.press(getByText('Mark complete'));
    expect(onCompleteMoveMock).toHaveBeenCalledWith('wp-1', 'm-2');

    // Prompt reached
    fireEvent.press(getByText('Think you’ve arrived? Mark waypoint reached'));
    expect(onPromptReachedMock).toHaveBeenCalled();
  });

  it('renders "Your moves are complete" when all moves are completed', () => {
    const allDoneWaypoint: V2WaypointPresentation = {
      ...baseWaypoint,
      doneMoveCount: 2,
      totalMoveCount: 2,
      moves: [
        { id: 'm-1', waypointId: 'wp-1', text: 'Implement auth', done: true },
        { id: 'm-2', waypointId: 'wp-1', text: 'Connect database', done: true },
      ],
    };

    const onPromptReachedMock = jest.fn();

    const { getByText, queryByText } = render(
      <V2OneMoveCard
        currentWaypoint={allDoneWaypoint}
        oneMove={null}
        isFinished={false}
        destinationText="10k users"
        onCompleteMove={jest.fn()}
        onPromptReached={onPromptReachedMock}
        onAddMovePress={jest.fn()}
        onLookBackPress={jest.fn()}
      />,
    );

    expect(getByText('Your moves are complete. Have you reached this waypoint?')).toBeTruthy();
    expect(queryByText('Add a move')).toBeNull();
    expect(getByText('Mark waypoint reached')).toBeTruthy();

    fireEvent.press(getByText('Mark waypoint reached'));
    expect(onPromptReachedMock).toHaveBeenCalled();
  });

  it('renders "Add a move" CTA when waypoint has 0 moves yet', () => {
    const zeroMovesWaypoint: V2WaypointPresentation = {
      ...baseWaypoint,
      doneMoveCount: 0,
      totalMoveCount: 0,
      moves: [],
    };

    const onAddMovePressMock = jest.fn();

    const { getByText } = render(
      <V2OneMoveCard
        currentWaypoint={zeroMovesWaypoint}
        oneMove={null}
        isFinished={false}
        destinationText="10k users"
        onCompleteMove={jest.fn()}
        onPromptReached={jest.fn()}
        onAddMovePress={onAddMovePressMock}
        onLookBackPress={jest.fn()}
      />,
    );

    expect(getByText('What is one move you can make toward this waypoint?')).toBeTruthy();
    expect(getByText('Add a move')).toBeTruthy();

    fireEvent.press(getByText('Add a move'));
    expect(onAddMovePressMock).toHaveBeenCalledWith('wp-1');
  });

  it('renders Destination Reached state when finished', () => {
    const onLookBackPressMock = jest.fn();

    const { getByText } = render(
      <V2OneMoveCard
        currentWaypoint={null}
        oneMove={null}
        isFinished={true}
        destinationText="Launch worldwide to 10k users"
        onCompleteMove={jest.fn()}
        onPromptReached={jest.fn()}
        onAddMovePress={jest.fn()}
        onLookBackPress={onLookBackPressMock}
      />,
    );

    expect(getByText('DESTINATION REACHED')).toBeTruthy();
    expect(getByText('You made it.')).toBeTruthy();
    expect(getByText(/Launch worldwide to 10k users/)).toBeTruthy();
    expect(getByText('Look back on your journey →')).toBeTruthy();

    fireEvent.press(getByText('Look back on your journey →'));
    expect(onLookBackPressMock).toHaveBeenCalled();
  });
});
