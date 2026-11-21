import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { MoveSummary } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartMovePlanSheet, planCueOptions, planTimeOptions } from '../ChartMovePlanSheet';
import { panelAccent } from '../chartPanelColors';

// Monday 16 November 2026, 10:00 local.
const NOW = new Date(2026, 10, 16, 10, 0);

const move = (overrides: Partial<MoveSummary> = {}): MoveSummary => ({
  id: 'm1',
  courseId: 'c1',
  waypointId: 'w1',
  title: 'Open the curtains',
  rationale: null,
  source: 'USER',
  status: 'ACTIVE',
  position: 100,
  isCurrent: true,
  completedAt: null,
  createdAt: '2026-11-10T00:00:00Z',
  plan: null,
  ...overrides,
});

function renderSheet(props: Partial<React.ComponentProps<typeof ChartMovePlanSheet>> = {}) {
  const onSave = jest.fn(async () => true);
  const onClose = jest.fn();
  const requestPermission = jest.fn(async () => true);
  const subject = move(props.move ? props.move : {});
  const screen = render(
    <ChartMovePlanSheet
      visible
      move={subject}
      chartMoves={[subject]}
      accent={panelAccent('desire')}
      reducedMotion
      now={NOW}
      use24h={false}
      onSave={onSave}
      onClose={onClose}
      requestPermission={requestPermission}
      {...props}
    />
  );
  return { screen, onSave, onClose, requestPermission };
}

const disabled = (node: any) => node.props.accessibilityState?.disabled === true;

describe('ChartMovePlanSheet', () => {
  it('preselects only the first cue on a Move with no plan', () => {
    const { screen } = renderSheet();
    expect(screen.getByTestId('chart-plan-cue-After I wake up').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('chart-plan-day-Today').props.accessibilityState.selected).toBe(false);
  });

  it('keeps time chips disabled until a day is picked', () => {
    const { screen } = renderSheet();
    expect(disabled(screen.getByTestId('chart-plan-time-08:00'))).toBe(true);
    expect(disabled(screen.getByTestId('chart-plan-time-other'))).toBe(true);
    fireEvent.press(screen.getByTestId('chart-plan-day-Tomorrow'));
    expect(disabled(screen.getByTestId('chart-plan-time-08:00'))).toBe(false);
  });

  it('keeps the reminder switch disabled until a day and a time exist', () => {
    const { screen } = renderSheet();
    expect(screen.getByTestId('chart-plan-remind').props.disabled).toBe(true);
    expect(screen.getByTestId('chart-plan-remind-helper').props.children).toBe(CHART_COPY.plan.remindNeedsTime);
    fireEvent.press(screen.getByTestId('chart-plan-day-Tomorrow'));
    expect(screen.getByTestId('chart-plan-remind').props.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('chart-plan-time-18:00'));
    expect(screen.getByTestId('chart-plan-remind').props.disabled).toBe(false);
  });

  it('saves the full plan with a reminder and closes with the toast', async () => {
    const { screen, onSave, onClose, requestPermission } = renderSheet();
    fireEvent.press(screen.getByTestId('chart-plan-day-Today'));
    fireEvent.press(screen.getByTestId('chart-plan-time-18:00'));
    fireEvent(screen.getByTestId('chart-plan-remind'), 'valueChange', true);
    await waitFor(() => expect(requestPermission).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('chart-plan-push-preview', { includeHiddenElements: true })).toBeTruthy());
    fireEvent.press(screen.getByTestId('chart-plan-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ cue: 'After I wake up', date: '2026-11-16', time: '18:00', remind: true }));
    expect(onClose).toHaveBeenCalledWith('Plan set: after I wake up, today at 6:00 PM');
  });

  it('a denied permission turns the switch back off and the plan still saves', async () => {
    const requestPermission = jest.fn(async () => false);
    const { screen, onSave } = renderSheet({ requestPermission });
    fireEvent.press(screen.getByTestId('chart-plan-day-Tomorrow'));
    fireEvent.press(screen.getByTestId('chart-plan-time-08:00'));
    fireEvent(screen.getByTestId('chart-plan-remind'), 'valueChange', true);
    await waitFor(() => expect(screen.getByTestId('chart-plan-remind-helper').props.children).toBe(CHART_COPY.plan.remindDenied));
    expect(screen.getByTestId('chart-plan-remind').props.value).toBe(false);
    fireEvent.press(screen.getByTestId('chart-plan-save'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ cue: 'After I wake up', date: '2026-11-17', time: '08:00', remind: false }));
  });

  it('"Clear plan" sends null', async () => {
    const { screen, onSave } = renderSheet({ move: move({ plan: { cue: 'After lunch', date: '2026-11-17', time: '12:30', remind: true } }) });
    expect(screen.getByTestId('chart-plan-day-Tomorrow').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('chart-plan-time-12:30').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('chart-plan-clear'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it('stays open with an error line when the save fails', async () => {
    const onSave = jest.fn(async () => false);
    const { screen, onClose } = renderSheet({ onSave });
    fireEvent.press(screen.getByTestId('chart-plan-save'));
    await waitFor(() => expect(screen.getByTestId('chart-plan-error').props.children).toBe(CHART_COPY.plan.error));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hides the push preview from screen readers', async () => {
    const { screen } = renderSheet({ move: move({ plan: { cue: null, date: '2026-11-17', time: '12:30', remind: true } }) });
    const preview = screen.getByTestId('chart-plan-push-preview', { includeHiddenElements: true });
    expect(preview.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(preview.props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByTestId('chart-plan-push-preview')).toBeNull();
  });

  it('builds cue and time chips from this Chart, deduplicated, at most five', () => {
    const subject = move({ plan: { cue: 'After work', date: null, time: null, remind: false } });
    const others = [
      move({ id: 'old', createdAt: '2026-11-01T00:00:00Z', plan: { cue: 'After the school run', date: '2026-11-02', time: '07:15', remind: false } }),
      move({ id: 'new', createdAt: '2026-11-12T00:00:00Z', plan: { cue: 'after work', date: '2026-11-13', time: '19:45', remind: false } }),
    ];
    expect(planCueOptions(subject, [subject, ...others])).toEqual(['After work', 'After the school run', 'After I wake up', 'After lunch', 'Before bed']);
    expect(planTimeOptions(subject, [subject, ...others])).toEqual(['19:45', '08:00', '12:30', '18:00', '21:00']);
  });
});
