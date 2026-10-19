jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withRepeat: (value: unknown) => value, withSequence: (...values: unknown[]) => values[values.length - 1], withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; } };
});
import React, { useEffect, useMemo, useState } from 'react';
import * as ReactNative from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartActiveView } from '../../ChartActiveView';
import * as sequences from '../../map/chartMapSequences';
import * as sheet from '../../sheet/ChartSheet';
import { resetChartHighWaterCache } from '@/hooks/v2/chart/chartHighWater';
import { syncChartNotifications } from '@/services/notifications/chartNotifications';
import type { CourseDetail } from '@/types/chart';
import { routeRevealArc, toProgressInput } from '../../map/chartProgress';
import { buildRouteTable, waypointPlacement } from '../../map/chartMapGeometry';
import { chartActions, course, finishedCourse, viewOf, waypoint } from './chartPanelFixtures';

import { loadFogImages, warmChartMapResources } from '../../map/ChartMapLand';
import { loadCloudTiles } from '../../map/chartCloudTiles';
import { setChartOpenedClockOffsetForDev } from '@/hooks/v2/chart/chartLastOpened';
import { resetChartTaughtStateCache, resetChartTaughtState } from '@/hooks/v2/chart/chartTaughtState';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { useAuthStore } from '@/stores/authStore';

jest.mock('@/services/notifications/chartNotifications', () => ({
  syncChartNotifications: jest.fn(async () => undefined),
}));

// ActiveView lifecycle tests observe when teaching is requested; the overlay's native
// coordinate measurement and controls are exercised in ChartOneMoveTeaching.test.tsx.
jest.mock('../../sheet/ChartOneMoveTeaching', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    ChartOneMoveTeaching: ({ visible, replayVersion, onReady, onDismiss }: { visible: boolean; replayVersion: number; onReady: () => void; onDismiss: () => void }) => {
      const [beat, setBeat] = React.useState(0);
      React.useEffect(() => { setBeat(0); }, [replayVersion]);
      React.useEffect(() => { if (visible) onReady(); }, [onReady, visible]);
      if (!visible) return null;
      const titles = ['This is your one move.', 'The circle is for done.', 'The words open the whole move.'];
      return React.createElement(View, { testID: 'chart-one-move-teaching' },
        React.createElement(Text, null, titles[beat]),
        React.createElement(Pressable, { onPress: () => beat === 2 ? onDismiss() : setBeat(beat + 1) }, React.createElement(Text, null, beat === 2 ? 'Got it' : 'Next')));
    },
  };
});

// Each test opens its Chart on a fresh day: a mark left by an earlier test would otherwise make this open a
// same-day "later" one (the open now waits long enough for the stored day to load).
let testDay = 0;
beforeEach(() => {
  testDay += 2;
  setChartOpenedClockOffsetForDev(testDay * 24 * 60 * 60 * 1000);
});
// The device warms the map (fog field, cloud tiles) before a Chart opens; the open waits for the map's first frame.
beforeAll(async () => {
  await Promise.all([loadFogImages(buildRouteTable()), loadCloudTiles()]);
  // The landscape decode and grain too, so no resource promise resolves outside act while a test mounts.
  warmChartMapResources(buildRouteTable(), 750, 1334);
  await new Promise((resolve) => setTimeout(resolve, 300));
});

/** w2 reached, w3 current (route advanced by the server). */
function afterFirstReach(): CourseDetail {
  const base = course();
  return {
    ...base,
    version: 6,
    currentWaypointId: 'w3',
    currentMoveId: 'm3',
    reachedCount: 2,
    waypoints: base.waypoints.map((item) =>
      item.id === 'w2'
        ? { ...item, state: 'REACHED', reachedAt: '2026-09-30T08:00:00Z' }
        : item.id === 'w3'
          ? { ...item, state: 'CURRENT' }
          : item
    ),
  };
}

/** Only the last waypoint is left. */
function lastWaypointCourse(): CourseDetail {
  const base = course();
  return {
    ...base,
    currentWaypointId: 'w3',
    currentMoveId: 'm3',
    reachedCount: 2,
    waypoints: base.waypoints.map((item) =>
      item.id === 'w2' ? { ...item, state: 'REACHED', reachedAt: '2026-09-29T00:00:00Z' } : item.id === 'w3' ? { ...item, state: 'CURRENT' } : item
    ),
  };
}

type HarnessProps = {
  initial?: CourseDetail;
  next?: CourseDetail | null;
  reducedMotion?: boolean;
  onWaypointReached?: jest.Mock;
  initialWaypointId?: string | null;
  actionError?: string | null;
  onOpenPractice?: jest.Mock;
  onCompleteMove?: jest.Mock;
  /** The Chart the server returns once the next move is completed. */
  afterMove?: CourseDetail | null;
};

const DEFAULT_COURSE = course();
let lastActions: ReturnType<typeof chartActions> | null = null;

function Harness({
  initial = DEFAULT_COURSE,
  next = null,
  reducedMotion = true,
  onWaypointReached,
  initialWaypointId = null,
  actionError = null,
  onOpenPractice,
  onCompleteMove,
  afterMove = null,
}: HarnessProps) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => setCurrent(initial), [initial]);
  const [celebration, setCelebration] = useState<{ completedTitle: string; nextTitle: string | null; fromFraction: number } | null>(null);
  const actions = useMemo(() => {
    const built = chartActions({
      reachWaypoint: jest.fn(async () => {
        if (!next) return null;
        setCurrent(next);
        return {
          completedTitle: 'Reach 1,000 active users',
          nextTitle: next.status === 'COMPLETED' ? null : 'Reach 10,000 active users',
          destinationReached: next.status === 'COMPLETED',
          chart: next,
        };
      }),
    });
    lastActions = built;
    return built;
  }, [next]);
  return (
    <ChartActiveView
      view={viewOf(current)}
      course={current}
      identity={{ intention: 'Anchor has ten thousand users', category: 'desire' }}
      anchorArt={null}
      vision={{ imageUrl: null, description: 'My dashboard shows 10 thousand active users.', title: 'The dashboard' }}
      stale={false}
      busyKey={null}
      reducedMotion={reducedMotion}
      celebration={celebration}
      onCelebrationDone={() => setCelebration(null)}
      onBack={jest.fn()}
      chartActions={actions as never}
      initialWaypointId={initialWaypointId}
      onWaypointReached={(result, previous, total) => {
        onWaypointReached?.(result, previous, total);
        if (!result.destinationReached) setCelebration({ completedTitle: result.completedTitle, nextTitle: result.nextTitle, fromFraction: 0 });
      }}
      onCompleteMove={(onCompleteMove as never) ?? (async () => { if (afterMove) setCurrent(afterMove); return true; })}
      onOpenVision={jest.fn()}
      onOpenLog={jest.fn()}
      onAdjust={jest.fn()}
      onRelease={jest.fn()}
      onOpenPractice={onOpenPractice}
      actionError={actionError}
    />
  );
}

async function settle(ms = 300) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
  // React flushes effects at the end of act; flush the sequence call and then the content crossfade.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 240)); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 160)); });
}

beforeEach(() => {
  // High-water marks are remembered per course; each test starts from a clean memory.
  resetChartHighWaterCache();
  resetChartTaughtStateCache();
  (syncChartNotifications as jest.Mock).mockClear();
  lastActions = null;
});

describe('ChartActiveView — treasure map composition', () => {
  it('waits for opening and a measurable row, teaches once, supports replay, and remembers dismissal across remounts', async () => {
    await resetChartTaughtState(null, DEFAULT_COURSE.id);
    const first = render(<Harness />);
    expect(first.queryByTestId('chart-one-move-teaching-measure')).toBeNull();
    await settle(1400);
    await waitFor(() => expect(first.queryByTestId('chart-one-move-teaching-measure') ?? first.queryByTestId('chart-one-move-teaching')).toBeTruthy(), { timeout: 2500 });
    await waitFor(() => expect(first.getByText('This is your one move.')).toBeTruthy(), { timeout: 2500 });
    fireEvent.press(first.getByLabelText('Replay move teaching'));
    await waitFor(() => expect(first.getByText('This is your one move.')).toBeTruthy());
    fireEvent.press(first.getByText('Next'));
    expect(first.getByText('The circle is for done.')).toBeTruthy();
    fireEvent.press(first.getByText('Next'));
    expect(first.getByText('The words open the whole move.')).toBeTruthy();
    fireEvent.press(first.getByText('Got it'));
    first.unmount();

    const second = render(<Harness />);
    await settle(1400);
    expect(second.queryByTestId('chart-one-move-teaching')).toBeNull();
    expect(second.queryByTestId('chart-one-move-teaching-measure')).toBeNull();
    act(() => ReactNative.DeviceEventEmitter.emit('chartResetOneMoveTeaching', 'another-course'));
    await settle(100);
    expect(second.queryByTestId('chart-one-move-teaching')).toBeNull();
    act(() => ReactNative.DeviceEventEmitter.emit('chartResetOneMoveTeaching', DEFAULT_COURSE.id));
    await waitFor(() => expect(second.getByTestId('chart-one-move-teaching')).toBeTruthy());
    second.unmount();
  });

  it('still teaches when encrypted storage is unavailable', async () => {
    const originalUser = useAuthStore.getState().user;
    useAuthStore.setState({ user: { id: 'teaching-storage-failure' } as never });
    const readStorage = encryptedPersistStorage.getItem.bind(encryptedPersistStorage);
    const getItem = jest.spyOn(encryptedPersistStorage, 'getItem').mockImplementation(key => key.includes(':taught:') ? Promise.reject(new Error('keystore locked')) : readStorage(key));
    const screen = render(<Harness />);
    try {
      await settle(1400);
      await waitFor(() => expect(screen.getByTestId('chart-one-move-teaching')).toBeTruthy(), { timeout: 2500 });
    } finally {
      screen.unmount();
      getItem.mockRestore();
      useAuthStore.setState({ user: originalUser });
    }
  });

  it('fills the 360x760dp window and keeps the One Move in the sheet', async () => {
    // Dimensions is shared by named and namespace RN imports; spying on a
    // namespace copy of useWindowDimensions would leave the view unmocked.
    const dimensions = jest.spyOn(ReactNative.Dimensions, 'get').mockReturnValue({ width: 360, height: 760, scale: 1, fontScale: 1 });
    try {
      const { getByTestId } = render(<Harness />);
      const mapStyle = ReactNative.StyleSheet.flatten(getByTestId('chart-hero-map').props.style);
      expect(mapStyle.width).toBe(360);
      // Jest has no native text layout: this verifies the viewport budget;
      // the checkbox/chevron bounds still require the Galaxy recording.
      expect(mapStyle.height).toBe(760);
      expect(getByTestId('chart-one-move-check')).toBeTruthy();
      await settle();
    } finally {
      dimensions.mockRestore();
    }
  });

  it('renders only the discovered waypoints as accessible markers (role, number, title, state)', async () => {
    const { getByLabelText, queryByLabelText, getByTestId, getAllByRole } = render(<Harness />);
    expect(getByTestId('chart-hero-map')).toBeTruthy();
    expect(getByLabelText('Waypoint 1: Validate acquisition, reached').props.accessibilityRole).toBe('button');
    expect(getByLabelText('Waypoint 2: Reach 1,000 active users, current')).toBeTruthy();
    // Fog of war: the next waypoint is an unlabelled ghost, and anything beyond it is not rendered at all.
    expect(queryByLabelText(/^Waypoint 3/)).toBeNull();
    expect(getByTestId('chart-map-ghost', { includeHiddenElements: true })).toBeTruthy();
    const labels = getAllByRole('button').map((b) => b.props.accessibilityLabel as string).filter((l) => /^Waypoint \d: /.test(l ?? ''));
    expect(labels).toHaveLength(2);
    await settle();
  });

  it('shows the map top bar, category label and the ink panel for the current waypoint', async () => {
    const { getByText, getByTestId, getByLabelText, queryByTestId } = render(<Harness />);
    expect(getByText('Chart')).toBeTruthy();
    expect(getByText('DESIRE')).toBeTruthy();
    expect(getByLabelText('Open Vision')).toBeTruthy();
    expect(getByLabelText('Go back')).toBeTruthy();
    expect(getByTestId('chart-current-waypoint')).toBeTruthy();
    expect(queryByTestId('chart-scallop', { includeHiddenElements: true })).toBeNull();
    await settle();
  });

  it('tapping a reached marker shows it in the panel; the back control returns to the current waypoint', async () => {
    const { getByLabelText, getByText, queryByText, queryByTestId } = render(<Harness />);
    await settle(1400);
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    await settle(200);
    // A tap during the entrance is a skip; select after its completion.
    if (queryByText('Waypoint 1 of 3 · Reached') === null) {
      fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
      await settle(200);
    }
    expect(getByText('Waypoint 1 of 3 · Reached')).toBeTruthy();
    expect(queryByTestId('chart-current-waypoint')).toBeNull();
    fireEvent.press(getByLabelText('Go back'));
    await settle(200);
    expect(getByText(/Waypoint [23] of 3 · Current/)).toBeTruthy();
  });

  it('the entrance ends with the sheet at peek: the half tier stays hidden until it is expanded', async () => {
    const { getByTestId } = render(<Harness />);
    await settle(1400);
    // The half tier is mounted but hidden from accessibility at peek, so the query must include hidden elements.
    expect(getByTestId('chart-sheet-half', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    expect(getByTestId('chart-sheet-peek')).toBeTruthy();
    await settle();
  });

  it('a map tap while viewing a reached waypoint returns to the current one', async () => {
    const { getByLabelText, getByText, queryByText, getByTestId } = render(<Harness />);
    await settle(1400);
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    await settle(200);
    // A tap during the entrance is a skip; select after its completion.
    if (queryByText('Waypoint 1 of 3 · Reached') === null) {
      fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
      await settle(200);
    }
    expect(getByText('Waypoint 1 of 3 · Reached')).toBeTruthy();
    fireEvent.press(getByTestId('chart-hero-map-surface'));
    await settle(200);
    expect(getByText(/Waypoint [23] of 3 · Current/)).toBeTruthy();
    await settle();
  });

  it('an undiscovered waypoint cannot be opened or read from the map', async () => {
    const { queryByLabelText } = render(<Harness />);
    await settle(300);
    expect(queryByLabelText(/^Waypoint 3/)).toBeNull();

  });

  it('opens focused on initialWaypointId', async () => {
    const { getByText } = render(<Harness initialWaypointId="w1" />);
    await settle(200);
    expect(getByText('Waypoint 1 of 3 · Reached')).toBeTruthy();
    await settle();
  });

  it('checking the One Move goes through onCompleteMove (server first; the route waits for new data)', async () => {
    const onCompleteMove = jest.fn(async () => true);
    const { getByTestId } = render(<Harness onCompleteMove={onCompleteMove} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-one-move-check'));
    await waitFor(() => expect(onCompleteMove).toHaveBeenCalledWith('m1'));
    await settle();
  });

  it('schedules chart notifications after load (fire and forget)', async () => {
    render(<Harness />);
    await settle();
    expect(syncChartNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ anchorId: 'anchor-1', courseId: 'course-1', view: expect.objectContaining({ destination: 'Reach 10,000 active users' }) })
    );
  });

  it('day-closed Focus / Deep Focus open Practice through onOpenPractice', async () => {
    const onOpenPractice = jest.fn();
    const base = course();
    const closed: CourseDetail = {
      ...base,
      currentMoveId: 'm2',
      moves: [
        { ...base.moves![0], status: 'COMPLETED', isCurrent: false, completedAt: new Date().toISOString() },
        base.moves![1],
        base.moves![2],
      ],
    };
    const { getByTestId } = render(<Harness initial={closed} onOpenPractice={onOpenPractice} />);
    await settle(1400);
    fireEvent.press(getByTestId('chart-practice-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('focus');
    for (let i = 0; i < 5 && getByTestId('chart-sheet-grabber').props.accessibilityLabel !== 'Collapse panel'; i++) {
      await settle(200);
      fireEvent.press(getByTestId('chart-sheet-grabber'));
    }
    fireEvent.press(getByTestId('chart-practice-deep-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('deep_prime');
  });
});

describe('ChartActiveView — reach ceremony', () => {
  it('keeps a queued replay hidden during the reach ceremony, then shows it after the ceremony settles', async () => {
    const stamped = jest.fn();
    const reachSequence = jest.spyOn(sequences, 'reachSequence').mockImplementation(context => ({ name: 'reach', steps: [
      { kind: 'call', at: 0, run: stamped },
      { kind: 'call', at: 900, run: () => context.onCommitCard?.() },
    ] }));
    const screen = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(1600);
    if (screen.queryByText('Got it')) fireEvent.press(screen.getByText('Got it'));
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    fireEvent.press(screen.getByTestId('chart-menu-button'));
    fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(screen.getByTestId('chart-reach-yes')); });
    act(() => ReactNative.DeviceEventEmitter.emit('chartReplayOneMoveTeaching', 'course-1'));
    await waitFor(() => expect(stamped).toHaveBeenCalled());
    expect(screen.queryByTestId('chart-one-move-teaching')).toBeNull();
    await settle(1100);
    await waitFor(() => expect(screen.getByTestId('chart-one-move-teaching')).toBeTruthy());
    reachSequence.mockRestore();
    screen.unmount();
  });

  it('forces peek before the stamp and holds tier renders until the reach commit call', async () => {
    const stamped = jest.fn();
    const reachSequence = jest.spyOn(sequences, 'reachSequence').mockImplementation(context => ({ name: 'reach', steps: [
      { kind: 'call', at: 0, run: stamped },
      { kind: 'call', at: 1000, run: () => context.onCommitCard?.() },
    ] }));
    const screen = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(1600);
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    fireEvent.press(screen.getByTestId('chart-menu-button'));
    fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(screen.getByTestId('chart-reach-yes')); });
    await waitFor(() => expect(stamped).toHaveBeenCalled());
    expect(screen.getByTestId('chart-sheet-half', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    const tiers = jest.spyOn(sheet, 'ChartSheetTier');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
    expect(tiers).not.toHaveBeenCalled();
    expect(screen.getByText('Waypoint 2 of 3 · Current')).toBeTruthy();
    await settle(1100);
    expect(screen.getByText('Waypoint 3 of 3 · Current')).toBeTruthy();
    expect(tiers).toHaveBeenCalled();
    tiers.mockRestore();
    reachSequence.mockRestore();
  });
  it('a confirmed reach runs the ceremony, then shows the commit card; "I\'m committed" dismisses it', async () => {
    const onWaypointReached = jest.fn();
    const { getByTestId, findByTestId, queryByTestId, getByText, getAllByText, queryByText } = render(<Harness next={afterFirstReach()} onWaypointReached={onWaypointReached} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await settle(650);
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(getByText("Look how far you've come.")).toBeTruthy();
    // The panel moved on to the next waypoint, and onWaypointReached was told once.
    await settle(200);
    expect(getByText(/Waypoint [23] of 3 · Current/)).toBeTruthy();
    expect(getAllByText('Reach 10,000 active users', { includeHiddenElements: true }).length).toBeGreaterThanOrEqual(2);
    expect(queryByText('Reach 1,000 active users')).toBeNull();
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(onWaypointReached.mock.calls[0][1]).toBe(1);
    expect(onWaypointReached.mock.calls[0][2]).toBe(3);
    fireEvent.press(getByText("I'm committed"));
    await settle(400);
    expect(queryByTestId('chart-waypoint-reached')).toBeNull();
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
  });

  it('a failed reach plays no ceremony, shows no commit card, and keeps the error on screen', async () => {
    const onWaypointReached = jest.fn();
    const { getByTestId, queryByTestId, getByText } = render(
      <Harness next={null} onWaypointReached={onWaypointReached} actionError="That didn’t go through. Try again." />
    );
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await waitFor(() => expect(lastActions!.reachWaypoint).toHaveBeenCalledWith('w2'));
    await settle(400);
    expect(queryByTestId('chart-waypoint-reached')).toBeNull();
    expect(onWaypointReached).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('chart-sheet-grabber'));
    expect(getByText('That didn’t go through. Try again.')).toBeTruthy();
    await settle(200);
    expect(getByText(/Waypoint [23] of 3 · Current/)).toBeTruthy();
    expect(getByText('Reach 1,000 active users')).toBeTruthy();
  });

  it('reaching the last waypoint plays the summit and ends on the arrival panel with View Vision and Release', async () => {
    const onWaypointReached = jest.fn();
    const { getByTestId, findByText, findByTestId, getByText } = render(<Harness initial={lastWaypointCourse()} next={finishedCourse()} onWaypointReached={onWaypointReached} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    expect(await findByText("You've arrived.", {}, { timeout: 3000 })).toBeTruthy();
    // The sheet gives way to the cream completion panel; its own arrival content is still there behind it (hidden -> peek -> half -> full).
    expect(await findByTestId('chart-summit-panel')).toBeTruthy();
    fireEvent.press(getByTestId('chart-sheet-grabber'));
    fireEvent.press(getByTestId('chart-sheet-grabber'));
    fireEvent.press(getByTestId('chart-sheet-grabber'));
    expect(getByText('View Vision')).toBeTruthy();
    expect(getByText('Release')).toBeTruthy();
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(onWaypointReached.mock.calls[0][0]).toMatchObject({ destinationReached: true });
  });

  it('a Chart that is already finished opens straight on the arrival panel', async () => {
    const { getByText } = render(<Harness initial={finishedCourse()} />);
    expect(getByText("You've arrived.")).toBeTruthy();
    await settle();
  });
});

describe('ChartActiveView — after a reach', () => {
  it('reach, "I\x27m committed", then completing the next move extends the route again (moveHoldSequence inks the current leg from the drawn arc)', async () => {
    const spy = jest.spyOn(sequences, 'moveHoldSequence');
    const base = afterFirstReach();
    const afterMove: CourseDetail = {
      ...base,
      version: 7,
      moves: (base.moves ?? []).map((m) => (m.id === 'm3' ? { ...m, status: 'COMPLETED' as const, completedAt: new Date().toISOString() } : m)),
    };
    const { getByTestId, findByTestId, getByText, queryByTestId } = render(<Harness next={base} afterMove={afterMove} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await settle(650);
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    fireEvent.press(getByText("I'm committed"));
    await settle(400);
    expect(queryByTestId('chart-waypoint-reached')).toBeNull();
    await settle(400);
    spy.mockClear();
    fireEvent.press(getByTestId('chart-one-move-check'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const ctx = spy.mock.calls[0][0];
    expect(ctx.toArc!).toBeGreaterThan(ctx.fromArc!);
    spy.mockRestore();
  });
});

describe('ChartActiveView — cycle 2 behaviours', () => {
  it('TalkBack order: the back control is read before the markers', async () => {
    const { getAllByRole } = render(<Harness />);
    const labels = getAllByRole('button').map((b) => b.props.accessibilityLabel as string);
    const back = labels.indexOf('Go back');
    const firstMarker = labels.findIndex((l) => /^Waypoint 1: /.test(l ?? ''));
    expect(back).toBeGreaterThanOrEqual(0);
    expect(back).toBeLessThan(firstMarker);
    expect(labels.indexOf('Chart options')).toBeLessThan(firstMarker);
    await settle();
  });

  it('a marker tap during the summit is a pure skip: the camera ends at overview and the arrival panel shows', async () => {
    const spy = jest.spyOn(sequences, 'summitSequence');
    const { getByTestId, getByLabelText, findByText } = render(<Harness reducedMotion={false} initial={lastWaypointCourse()} next={finishedCourse()} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    expect(await findByText("You've arrived.", {}, { timeout: 1500 })).toBeTruthy();
    const anim = spy.mock.calls[0][0].anim;
    expect(anim.camera.s.value).toBe(1);
    spy.mockRestore();
  });

  it('a marker tap during a reach is a pure skip: the commit card still shows, on the next waypoint', async () => {
    const spy = jest.spyOn(sequences, 'reachSequence');
    const { getByTestId, getByLabelText, findByTestId, getByText } = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    await settle(400);
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    await settle(200);
    expect(getByText(/Waypoint [23] of 3 · Current/)).toBeTruthy();
    expect(getByText('Waypoint 3 of 3 · Current')).toBeTruthy();
    spy.mockRestore();
  });

  it('adding a waypoint on the same course re-anchors the drawn route to the new spacing', async () => {
    const spy = jest.spyOn(sequences, 'openSequence');
    const base = course();
    const four: CourseDetail = {
      ...base,
      version: 6,
      waypointCount: 4,
      waypoints: [...base.waypoints, waypoint({ id: 'w4', position: 400, title: 'Reach 50,000 active users' })],
    };
    const { rerender } = render(<Harness initial={base} />);
    // The open starts once the map has drawn its first frame (frame-one veil hold).
    await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 4000 });
    await settle(400);
    const anim = spy.mock.calls[0][0].anim;
    rerender(<Harness initial={four} />);
    await settle(200);
    const view = viewOf(four);
    const table = buildRouteTable();
    const placement = waypointPlacement(4);
    const inputs = view.waypoints.map((w) => toProgressInput(w, four.waypoints.find((x) => x.id === w.id)?.metric));
    const target = routeRevealArc({ inputs, currentIndex: view.currentIndex, isFinished: false, hw: {}, placement, table });
    expect(anim.revealArc.value).toBeCloseTo(target, 1);
    spy.mockRestore();
  });
});

describe('ChartActiveView — motion', () => {
  it('reduced motion: opens, focuses a waypoint and reaches with no camera or sequence errors', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errors.mockClear();
    const { getByLabelText, getByTestId, findByTestId } = render(<Harness reducedMotion next={afterFirstReach()} />);
    await settle(300);
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    fireEvent.press(getByLabelText('Go back'));
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await settle(650);
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });

  it('full motion: opens and reaches, and skipping with a map tap still lands on the commit card', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errors.mockClear();
    const { getByTestId, findByTestId } = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(300);
    // A tap while the open sequence runs skips it.
    fireEvent.press(getByTestId('chart-hero-map-surface'));
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await settle(50);
    fireEvent.press(getByTestId('chart-hero-map-surface'));
    await settle(1800);
    expect(getByTestId('chart-waypoint-reached')).toBeTruthy();
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });

  it('unmounting mid-sequence is clean', async () => {
    const open = jest.spyOn(sequences, 'openSequence');
    const { unmount, getByTestId } = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    // DEFERRED: settle(50). The map now opens after its first drawn frame (then a 1.2 s open); unmount mid-REACH,
    // not mid-mount or mid-open.
    // Poll inside act (not waitFor, which toggles the act environment) until the open has started, then let it end.
    for (let i = 0; i < 40 && open.mock.calls.length === 0; i++) await settle(100);
    expect(open).toHaveBeenCalled();
    open.mockRestore();
    await settle(1600);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    errors.mockClear();
    // console.error may already be a mock carrying the mount's calls; only the interaction under test counts.
    errors.mockClear();
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    await act(async () => { fireEvent.press(getByTestId('chart-reach-yes')); });
    await settle(20);
    unmount();
    await settle(300);
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });
});

describe('ChartActiveView — menu actions', () => {
  it('shows Archive Chart and Delete Chart in menu, and triggers archive on confirmation', async () => {
    const alertSpy = jest.spyOn(ReactNative.Alert, 'alert');
    const { getByTestId } = render(<Harness />);
    await settle(300);

    fireEvent.press(getByTestId('chart-menu-button'));
    const archiveMenuItem = getByTestId('chart-archive-menu-item');
    const deleteMenuItem = getByTestId('chart-delete-menu-item');
    expect(archiveMenuItem).toBeTruthy();
    expect(deleteMenuItem).toBeTruthy();

    fireEvent.press(archiveMenuItem);
    expect(alertSpy).toHaveBeenCalledWith(
      'Archive this Chart?',
      expect.stringContaining('This route will be moved to your history'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const confirmBtn = buttons.find((b: any) => b.text === 'Archive Chart');
    expect(confirmBtn).toBeDefined();

    confirmBtn.onPress();
    expect(lastActions!.archiveChart).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('triggers delete on confirmation when Delete Chart is pressed', async () => {
    const alertSpy = jest.spyOn(ReactNative.Alert, 'alert');
    const { getByTestId } = render(<Harness />);
    await settle(300);

    fireEvent.press(getByTestId('chart-menu-button'));
    const deleteMenuItem = getByTestId('chart-delete-menu-item');
    fireEvent.press(deleteMenuItem);

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete this Chart?',
      expect.stringContaining('This will permanently remove this route'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls[0][2] as any[];
    const confirmBtn = buttons.find((b: any) => b.text === 'Delete Chart');
    expect(confirmBtn).toBeDefined();

    confirmBtn.onPress();
    expect(lastActions!.deleteChart).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

