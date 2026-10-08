jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; } };
});
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { type SharedValue } from 'react-native-reanimated';
import { ChartSheetContent } from '../ChartSheetContent';
import { ChartSheet, type ChartSheetHandle } from '../ChartSheet';
import * as sheet from '../ChartSheet';
import { chartActions, course, dayClosedCourse, NOW, viewOf } from '../../panel/__tests__/chartPanelFixtures';

type Props = React.ComponentProps<typeof ChartSheetContent>;
function setup(overrides: Partial<Props> = {}) {
  const ref = React.createRef<ChartSheetHandle>();
  const props: Props = { view: viewOf(), waypointId: 'w2', chart: chartActions(), category: 'desire', reducedMotion: true, actionError: null, bottomInset: 34, onBack: jest.fn(), onReached: jest.fn(), now: NOW, practiced: false, viewWaypoint: jest.fn(), swapRevision: 0, isContentLocked: () => false, ...overrides };
  const tree = (next: Props) => <ChartSheet ref={ref} busy={{ value: false } as SharedValue<boolean>} reducedMotion><ChartSheetContent {...next} /></ChartSheet>;
  const screen = render(tree(props));
  act(() => ref.current!.snapTo('peek'));
  return { ...screen, props, ref, update: (next: Props) => screen.rerender(tree(next)) };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('prioritises commit over day closed over One Move, with a fixed peek frame', () => {
  const commit = setup({ view: viewOf(dayClosedCourse()), commit: { number: 1 } });
  expect(commit.getByTestId('chart-commit')).toBeTruthy();
  expect(commit.queryByTestId('chart-day-closed')).toBeNull();
  expect(commit.queryByTestId('chart-one-move')).toBeNull();
  commit.unmount();
  const closed = setup({ view: viewOf(dayClosedCourse()) });
  expect(closed.getByTestId('chart-day-closed')).toBeTruthy();
  expect(closed.queryByTestId('chart-one-move')).toBeNull();
  closed.unmount();
  const current = setup();
  expect(current.getByTestId('chart-one-move-check')).toBeTruthy();
  expect(current.getByTestId('chart-sheet-peek').props.style.height).toBe(134);
});
it('keeps half mounted and inaccessible at peek, then makes the existing controls reachable', () => {
  const screen = setup();
  expect(screen.getByTestId('chart-sheet-half', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('chart-practice-row')).toBeNull();
  act(() => screen.ref.current!.snapTo('half'));
  for (const id of ['chart-practice-row', 'chart-waypoint-bar', 'chart-waypoint-progress', 'chart-update-progress-button', 'chart-mark-waypoint-cta', 'chart-edit-waypoint-button']) expect(screen.getByTestId(id)).toBeTruthy();
  fireEvent.press(screen.getByTestId('chart-update-progress-button'));
  for (const id of ['chart-progress-sheet', 'chart-progress-input', 'chart-save-progress']) expect(screen.getByTestId(id)).toBeTruthy();
});
it('shows an upcoming waypoint rationale and the numbered back button at peek', () => {
  const raw = course(); raw.waypoints[2].description = 'This is why the next step matters.';
  const screen = setup({ view: viewOf(raw), waypointId: 'w3' });
  expect(screen.getByText('This is why the next step matters.').props.numberOfLines).toBe(2);
  expect(screen.getByLabelText('Back to waypoint 2')).toBeTruthy();
  fireEvent.press(screen.getByTestId('chart-back-to-current'));
  expect(screen.props.onBack).toHaveBeenCalled();
  expect(screen.queryByTestId('chart-one-move-check')).toBeNull();
});
it('holds the content and tier render counts during a sequence; swaps only at its allowed commit step', () => {
  let locked = true;
  const screen = setup({ isContentLocked: () => locked });
  const tiers = jest.spyOn(sheet, 'ChartSheetTier');
  const next = { ...screen.props, view: { ...screen.props.view, version: 6 }, waypointId: 'w3' };
  screen.update(next);
  act(() => jest.advanceTimersByTime(500));
  expect(screen.getByText('Waypoint 2 of 3 · Current')).toBeTruthy();
  expect(tiers).not.toHaveBeenCalled();
  screen.update({ ...next, swapRevision: 1 });
  act(() => jest.advanceTimersByTime(120));
  expect(screen.getByText('Waypoint 3 of 3 · Upcoming')).toBeTruthy();
  expect(tiers).toHaveBeenCalledTimes(2);
  locked = false;
});
it('refreshes route progress when stored high water hydrates without a new server view', () => {
  const screen = setup();
  act(() => screen.ref.current!.snapTo('half'));
  screen.update({ ...screen.props, hw: { w2: .8 } });
  expect(screen.getByTestId('chart-route-segment-1').props.accessibilityValue.now).toBe(80);
});
