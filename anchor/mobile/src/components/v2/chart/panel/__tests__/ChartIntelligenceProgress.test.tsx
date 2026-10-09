import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartWaypointContent } from '../../ChartWaypointContent';
import { ChartOneMoveRow } from '../../ChartOneMoveRow';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';
import { panelAccent } from '../chartPanelColors';
import { toMetricView } from '@/adapters/v2/chart/chartV2Model';
import { metricFraction, toProgressInput } from '../../map/chartProgress';
import type { CourseDetail, WaypointSummary } from '@/types/chart';
import { NOW, chartActions, course, move, viewOf } from './chartPanelFixtures';

function withTracking(overrides: Partial<WaypointSummary>): CourseDetail {
  const base = course();
  return {
    ...base,
    waypoints: base.waypoints.map(item => item.id === 'w2' ? {
      ...item,
      kind: 'MILESTONE',
      metric: null,
      ...overrides,
    } : item),
  };
}

const checklist = () => withTracking({
  progressMode: 'checklist',
  title: 'Prepare a portfolio for applications',
  requirements: [
    { id: 'portfolio', title: 'Publish two case studies', completed: true },
    { id: 'resume', title: 'Update the resume with relevant work', completed: false },
  ],
});

function content(detail: CourseDetail, actions = chartActions(), inSheet = true) {
  return <ChartWaypointContent
    view={viewOf(detail)} waypointId="w2" chart={actions} category="career" reducedMotion
    actionError={null} bottomInset={16} onBack={jest.fn()} onReached={jest.fn()}
    now={NOW} practiced={false}
    renderTiers={inSheet ? ({ peek, oneMove, half, full, edit }) => <View>{peek}{oneMove}{half}{full}{edit}</View> : undefined}
  />;
}

describe('Chart intelligence progress interactions', () => {
  it('toggles checklist requirements in both directions using refreshed server state', async () => {
    const updateRequirement = jest.fn();
    function Harness() {
      const [detail, setDetail] = useState(checklist);
      const actions = chartActions({ updateRequirement: async (waypointId: string, id: string, completed: boolean) => {
        updateRequirement(waypointId, id, completed);
        setDetail(previous => ({
          ...previous,
          version: previous.version + 1,
          waypoints: previous.waypoints.map(waypoint => waypoint.id === waypointId ? {
            ...waypoint,
            requirements: waypoint.requirements?.map(requirement => requirement.id === id ? { ...requirement, completed } : requirement),
          } : waypoint),
        }));
        return true;
      } });
      return content(detail, actions);
    }
    const screen = render(<Harness />);
    fireEvent.press(screen.getByTestId('chart-update-progress-button'));
    expect(screen.getByText('1 of 2 requirements complete')).toBeTruthy();
    expect(screen.getByTestId('chart-requirement-portfolio').props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByTestId('chart-requirement-resume'));
    await waitFor(() => expect(screen.getByText('2 of 2 requirements complete')).toBeTruthy());
    expect(updateRequirement).toHaveBeenLastCalledWith('w2', 'resume', true);
    expect(screen.getByTestId('chart-requirement-resume').props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByTestId('chart-requirement-resume'));
    await waitFor(() => expect(screen.getByText('1 of 2 requirements complete')).toBeTruthy());
    expect(updateRequirement).toHaveBeenLastCalledWith('w2', 'resume', false);
  });

  it('does not complete a checklist requirement when a separate One Move is completed', async () => {
    const updateRequirement = jest.fn(async () => true);
    const actions = chartActions({ updateRequirement });
    const screen = render(content(checklist(), actions));
    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    await waitFor(() => expect(actions.completeMove).toHaveBeenCalledWith('m1'));
    fireEvent.press(screen.getByTestId('chart-update-progress-button'));
    expect(screen.getByText('1 of 2 requirements complete')).toBeTruthy();
    expect(screen.getByTestId('chart-requirement-resume').props.accessibilityState.checked).toBe(false);
    expect(updateRequirement).not.toHaveBeenCalled();
  });

  it('keeps checklist controls safe when an older action adapter has no requirement mutation', () => {
    const screen = render(content(checklist()));
    fireEvent.press(screen.getByTestId('chart-update-progress-button'));
    fireEvent.press(screen.getByTestId('chart-requirement-resume'));
    expect(screen.getByTestId('chart-requirement-resume').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('chart-requirement-resume').props.accessibilityState.checked).toBe(false);
  });

  it.each([
    ['CURRENT', null, 'Not reached'],
    ['REACHED', NOW.toISOString(), 'Reached'],
  ] as const)('shows binary %s milestones without a fabricated numeric percentage or progress bar', (state, reachedAt, label) => {
    const detail = withTracking({ progressMode: 'completion', state, reachedAt, completionCriteria: 'The app is publicly available in the store.' });
    if (state === 'REACHED') { detail.currentWaypointId = 'w3'; detail.currentMoveId = 'm3'; detail.reachedCount = 2; }
    const screen = render(content(detail, chartActions(), true));
    expect(screen.getByText(`${label} · The app is publicly available in the store.`)).toBeTruthy();
    expect(screen.queryByTestId('chart-waypoint-bar')).toBeNull();
    expect(screen.queryByText(/\d+%/)).toBeNull();
    expect(screen.queryByTestId('chart-update-progress-button')).toBeNull();
  });

  it('keeps a failed waypoint edit open with its draft intact and provides Cancel', async () => {
    const actions = chartActions({ editWaypoint: jest.fn(async () => false) });
    const screen = render(content(course(), actions, true));
    fireEvent.press(screen.getByTestId('chart-edit-waypoint-button'));
    fireEvent.changeText(screen.getByLabelText('Waypoint title'), 'Reach the first 25 active users');
    expect(screen.getByText('Cancel')).toBeTruthy();
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(actions.editWaypoint).toHaveBeenCalledWith('w2', {
      title: 'Reach the first 25 active users', rationale: 'Growth becomes visible.',
    }));
    const modal = () => screen.UNSAFE_getAllByType(V2SheetModal).find(item => item.props.testID === 'chart-edit-waypoint-modal')!;
    expect(modal().props.visible).toBe(true);
    expect(screen.getByLabelText('Waypoint title').props.value).toBe('Reach the first 25 active users');
    fireEvent.press(screen.getByText('Cancel'));
    await waitFor(() => expect(modal().props.visible).toBe(false));
  });

  it('lets users override tracking with a decreasing numeric target including zero', async () => {
    const actions = chartActions();
    const screen = render(content(checklist(), actions, true));
    fireEvent.press(screen.getByTestId('chart-edit-waypoint-button'));
    fireEvent.press(screen.getByTestId('chart-tracking-numeric'));
    fireEvent.changeText(screen.getByLabelText('Metric unit'), 'credit card debt');
    fireEvent.changeText(screen.getByLabelText('Metric baseline'), '1000');
    fireEvent.changeText(screen.getByLabelText('Metric target'), '0');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(actions.editWaypoint).toHaveBeenCalledWith('w2', expect.objectContaining({
      progressMode: 'numeric', kind: 'METRIC', metricBaseline: 1000, metricTarget: 0, metricLabel: 'credit card debt',
    })));
    await waitFor(() => expect(screen.UNSAFE_getAllByType(V2SheetModal).find(item => item.props.testID === 'chart-edit-waypoint-modal')!.props.visible).toBe(false));
  });

  it('shows a complete long One Move title without truncation or strikethrough', () => {
    const title = 'List every essential monthly bill and each minimum debt payment, then choose one affordable transfer that will not leave the account short.';
    const completed = move({ id: 'long-completed', title, status: 'COMPLETED', completedAt: NOW.toISOString() });
    const screen = render(<ChartOneMoveRow
      accent={panelAccent('career')} move={completed} waypointTitle="Understand the current financial starting point"
      checked busy={false} reducedMotion onCheck={jest.fn(async () => false)}
    />);
    const text = screen.getByTestId('chart-one-move-title');
    expect(text.props.children).toBe(title);
    expect(text.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(text.props.style).textDecorationLine).not.toBe('line-through');
    expect(screen.getByTestId('chart-one-move-check').props.accessibilityState.checked).toBe(true);
  });
});

describe('Chart intelligence numeric adapter regression', () => {
  it.each([
    [1000, 750, 0, 0.25],
    [1000, 0, 0, 1],
    [0, 0, 1000, 0],
    [-500, -250, 0, 0.5],
  ])('preserves baseline %s, current %s and target %s', (baseline, current, target, expected) => {
    const metric = { baseline, current, target, label: 'balance' };
    expect(toMetricView(metric)?.fraction).toBe(expected);
    const detail = withTracking({ progressMode: 'numeric', kind: 'METRIC', metric });
    const waypoint = viewOf(detail).waypoints.find(item => item.id === 'w2')!;
    const input = toProgressInput(waypoint);
    expect(input.metric).toEqual({ baseline, current, target });
    expect(metricFraction(input)).toBe(expected);
  });

  it('treats an unrecorded current value as the actual baseline instead of fabricating zero progress data', () => {
    const metric = { baseline: 1000, current: null, target: 0, label: 'debt' };
    expect(toMetricView(metric)?.fraction).toBeNull();
    const detail = withTracking({ progressMode: 'numeric', kind: 'METRIC', metric });
    const waypoint = viewOf(detail).waypoints.find(item => item.id === 'w2')!;
    const input = toProgressInput(waypoint);
    expect(input.metric).toEqual({ baseline: 1000, current: 1000, target: 0 });
    expect(metricFraction(input)).toBeCloseTo(0);
  });
});
