import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { MoveSummary } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartOneMoveRow } from '../ChartOneMoveRow';
import { panelAccent } from '../panel/chartPanelColors';

const move: MoveSummary = {
  id: 'move-1',
  courseId: 'course-1',
  waypointId: 'waypoint-1',
  title: 'Schedule gym sessions for the upcoming week, three days, same times, in the calendar.',
  rationale: null,
  source: 'USER',
  status: 'ACTIVE',
  position: 0,
  isCurrent: true,
  completedAt: null,
  createdAt: '2026-10-08T00:00:00Z',
};

function rowElement(onCheck: () => Promise<boolean>, currentMove: MoveSummary = move, checked = false, criteria: string | null = null, progress: string | null = null) {
  return (
    <ChartOneMoveRow
      accent={panelAccent('desire')}
      move={currentMove}
      waypointTitle="Establish a consistent gym routine"
      waypointCriteria={criteria}
      progressText={progress}
      checked={checked}
      busy={false}
      reducedMotion
      onCheck={onCheck}
      onExpandSheet={jest.fn()}
    />
  );
}

function renderRow(onCheck = jest.fn(async () => true), currentMove = move) {
  return render(rowElement(onCheck, currentMove));
}

describe('ChartOneMoveRow', () => {
  it('keeps the circle and the move text as separate actions', async () => {
    const onCheck = jest.fn(async () => true);
    const screen = render(rowElement(onCheck, move, false, 'Three workouts logged in one week.'));

    fireEvent.press(screen.getByTestId('chart-one-move-body'));
    expect(screen.getByTestId('chart-one-move-details')).toBeTruthy();
    expect(onCheck).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    await waitFor(() => expect(onCheck).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('chart-one-move-toast').props.children).toBe(CHART_COPY.sheet.moveDoneToast);
    expect(screen.getByTestId('chart-one-move-body').props.accessibilityState.expanded).toBe(true);
  });

  it('collapsed: two-line title, one short why, no helper line; the waypoint title appears once', () => {
    const screen = renderRow();
    expect(screen.getByTestId('chart-one-move-title').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('chart-one-move-why').props.numberOfLines).toBe(2);
    expect(screen.getAllByText('Establish a consistent gym routine')).toHaveLength(1);
    expect(screen.queryByText(/Tap the circle when/)).toBeNull();
    expect(screen.queryByTestId('chart-one-move-details')).toBeNull();
  });

  it('expanded: full why only; no DONE MEANS filler, no TOWARD line, and DONE WHEN only when the move has one', () => {
    const screen = renderRow();
    fireEvent.press(screen.getByTestId('chart-one-move-body'));
    expect(screen.getByTestId('chart-one-move-title').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('chart-one-move-why').props.numberOfLines).toBeUndefined();
    expect(screen.queryByText(/done means/i)).toBeNull();
    expect(screen.queryByText(/^toward$/i)).toBeNull();
    expect(screen.queryByText(/Mark this move done when/)).toBeNull();
    expect(screen.queryByText(CHART_COPY.sheet.doneWhen)).toBeNull();
    expect(screen.getAllByText('Establish a consistent gym routine')).toHaveLength(1);
  });

  it('uses why and doneWhen only when the move record provides non-empty strings', () => {
    const detailsMove = { ...move, why: 'A calendar makes the plan visible.', doneWhen: 'The three events are saved.' } as MoveSummary;
    const screen = renderRow(jest.fn(async () => true), detailsMove);
    fireEvent.press(screen.getByTestId('chart-one-move-body'));
    expect(screen.getByText('A calendar makes the plan visible.')).toBeTruthy();
    expect(screen.getByText(CHART_COPY.sheet.doneWhen)).toBeTruthy();
    expect(screen.getByText('The three events are saved.')).toBeTruthy();
  });

  it('uses the move’s own rationale as the reason, and shows what reaching the waypoint means', () => {
    const withReason = { ...move, rationale: 'A calendar makes the plan visible.' };
    const screen = render(rowElement(jest.fn(async () => true), withReason, false, 'Three workouts logged in one week.'));
    fireEvent.press(screen.getByTestId('chart-one-move-body'));
    expect(screen.getByText('A calendar makes the plan visible.')).toBeTruthy();
    expect(screen.getByText(CHART_COPY.sheet.waypointReachedWhen)).toBeTruthy();
    expect(screen.getByTestId('chart-one-move-criteria').props.children).toBe('Three workouts logged in one week.');
  });

  it('does not invent a count of its own: no progress text means no count', () => {
    const screen = renderRow();
    expect(screen.queryByTestId('chart-one-move-progress')).toBeNull();
    expect(screen.queryByText(/of 1 done/)).toBeNull();
    expect(screen.getByText('Your next move')).toBeTruthy();
  });

  it('resets expansion when the server-selected One Move changes and exposes no undo affordance', async () => {
    const screen = render(rowElement(jest.fn(async () => true), move, false, 'Three workouts logged in one week.'));
    fireEvent.press(screen.getByTestId('chart-one-move-body'));
    expect(screen.getByTestId('chart-one-move-details')).toBeTruthy();

    const nextMove = { ...move, id: 'move-2', title: 'Book the first session.' };
    screen.rerender(rowElement(jest.fn(async () => true), nextMove));
    await waitFor(() => expect(screen.queryByTestId('chart-one-move-details')).toBeNull());

    screen.rerender(rowElement(jest.fn(async () => true), nextMove, true, null, '1 of 3 done'));
    expect(screen.getByText('1 of 3 done')).toBeTruthy();
    expect(screen.getByTestId('chart-one-move-check').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chart-one-move-check').props.accessibilityLabel).toBe(CHART_COPY.sheet.markMoveUndone);
  });

  it('does not show success when completion fails or rejects', async () => {
    const failed = renderRow(jest.fn(async () => false));
    fireEvent.press(failed.getByTestId('chart-one-move-check'));
    await waitFor(() => expect(failed.queryByTestId('chart-one-move-toast')).toBeNull());

    const rejected = renderRow(jest.fn(async () => { throw new Error('offline'); }));
    fireEvent.press(rejected.getByTestId('chart-one-move-check'));
    await waitFor(() => expect(rejected.queryByTestId('chart-one-move-toast')).toBeNull());
  });
});
