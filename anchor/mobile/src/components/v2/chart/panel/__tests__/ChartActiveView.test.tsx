import React, { useEffect, useMemo, useState } from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChartActiveView } from '../../ChartActiveView';
import * as sequences from '../../map/chartMapSequences';
import { resetChartHighWaterCache } from '@/hooks/v2/chart/chartHighWater';
import { syncChartNotifications } from '@/services/notifications/chartNotifications';
import type { CourseDetail } from '@/types/chart';
import { routeRevealArc, toProgressInput } from '../../map/chartProgress';
import { buildRouteTable, waypointPlacement } from '../../map/chartMapGeometry';
import { chartActions, course, finishedCourse, viewOf, waypoint } from './chartPanelFixtures';

jest.mock('@/services/notifications/chartNotifications', () => ({
  syncChartNotifications: jest.fn(async () => undefined),
}));

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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  // High-water marks are remembered per course; each test starts from a clean memory.
  resetChartHighWaterCache();
  (syncChartNotifications as jest.Mock).mockClear();
  lastActions = null;
});

describe('ChartActiveView — treasure map composition', () => {
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
    const { getByText, getByTestId, getByLabelText } = render(<Harness />);
    expect(getByText('Chart')).toBeTruthy();
    expect(getByText('DESIRE')).toBeTruthy();
    expect(getByLabelText('Open Vision')).toBeTruthy();
    expect(getByLabelText('Go back')).toBeTruthy();
    expect(getByTestId('chart-current-waypoint')).toBeTruthy();
    expect(getByTestId('chart-scallop', { includeHiddenElements: true })).toBeTruthy();
    await settle();
  });

  it('tapping a reached marker shows it in the panel; the back control returns to the current waypoint', async () => {
    const { getByLabelText, getByText, queryByTestId } = render(<Harness />);
    await settle(400);
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    expect(getByText('REACHED')).toBeTruthy();
    expect(queryByTestId('chart-current-waypoint')).toBeNull();
    fireEvent.press(getByLabelText('Go back'));
    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
  });

  it('an undiscovered waypoint cannot be opened or read from the map', async () => {
    const { queryByLabelText } = render(<Harness />);
    await settle(300);
    expect(queryByLabelText(/^Waypoint 3/)).toBeNull();

  });

  it('opens focused on initialWaypointId', async () => {
    const { getByText } = render(<Harness initialWaypointId="w1" />);
    expect(getByText('REACHED')).toBeTruthy();
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
    await settle();
    fireEvent.press(getByTestId('chart-practice-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('focus');
    fireEvent.press(getByTestId('chart-practice-deep-focus'));
    expect(onOpenPractice).toHaveBeenLastCalledWith('deep_prime');
  });
});

describe('ChartActiveView — reach ceremony', () => {
  it('a confirmed reach runs the ceremony, then shows the commit card; "I\'m committed" dismisses it', async () => {
    const onWaypointReached = jest.fn();
    const { getByTestId, findByTestId, queryByTestId, getByText, getAllByText, queryByText } = render(<Harness next={afterFirstReach()} onWaypointReached={onWaypointReached} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    expect(await findByTestId('chart-waypoint-reached', {}, { timeout: 3000 })).toBeTruthy();
    expect(getByText('WAYPOINT 2 REACHED')).toBeTruthy();
    expect(getByText("Look how far you've come.")).toBeTruthy();
    // The panel moved on to the next waypoint, and onWaypointReached was told once.
    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(getAllByText('Reach 10,000 active users').length).toBeGreaterThanOrEqual(2);
    expect(queryByText('Reach 1,000 active users')).toBeNull();
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(onWaypointReached.mock.calls[0][1]).toBe(1);
    expect(onWaypointReached.mock.calls[0][2]).toBe(3);
    fireEvent.press(getByText("I'm committed"));
    await waitFor(() => expect(queryByTestId('chart-waypoint-reached')).toBeNull());
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
    fireEvent.press(getByTestId('chart-reach-yes'));
    await waitFor(() => expect(lastActions!.reachWaypoint).toHaveBeenCalledWith('w2'));
    await settle(400);
    expect(queryByTestId('chart-waypoint-reached')).toBeNull();
    expect(onWaypointReached).not.toHaveBeenCalled();
    expect(getByText('That didn’t go through. Try again.')).toBeTruthy();
    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(getByText('Reach 1,000 active users')).toBeTruthy();
  });

  it('reaching the last waypoint plays the arrival and ends on the arrival panel with View Vision and Release', async () => {
    const onWaypointReached = jest.fn();
    const { getByTestId, findByText, getByText } = render(<Harness initial={lastWaypointCourse()} next={finishedCourse()} onWaypointReached={onWaypointReached} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    expect(await findByText("You've arrived.", {}, { timeout: 3000 })).toBeTruthy();
    expect(getByText('ARRIVED')).toBeTruthy();
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
  it('reach, "I\x27m committed", then completing the next move extends the route again (moveCheckSequence runs from the drawn arc)', async () => {
    const spy = jest.spyOn(sequences, 'moveCheckSequence');
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
    fireEvent.press(getByTestId('chart-reach-yes'));
    expect(await findByTestId('chart-waypoint-reached', {}, { timeout: 3000 })).toBeTruthy();
    fireEvent.press(getByText("I'm committed"));
    await waitFor(() => expect(queryByTestId('chart-waypoint-reached')).toBeNull());
    await settle(400);
    spy.mockClear();
    fireEvent.press(getByTestId('chart-one-move-check'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const ctx = spy.mock.calls[0][0];
    expect(ctx.toArc).toBeGreaterThan(ctx.fromArc);
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

  it('a marker tap during the arrival is a pure skip: the camera ends at overview and the arrival panel shows', async () => {
    const spy = jest.spyOn(sequences, 'arrivalSequence');
    const { getByTestId, getByLabelText, findByText } = render(<Harness reducedMotion={false} initial={lastWaypointCourse()} next={finishedCourse()} />);
    await settle(300);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
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
    fireEvent.press(getByTestId('chart-reach-yes'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    expect(await findByTestId('chart-waypoint-reached', {}, { timeout: 1500 })).toBeTruthy();
    expect(getByText('CURRENT WAYPOINT')).toBeTruthy();
    expect(getByText('3 of 3')).toBeTruthy();
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
    const { getByLabelText, getByTestId, findByTestId } = render(<Harness reducedMotion next={afterFirstReach()} />);
    await settle(300);
    fireEvent.press(getByLabelText('Waypoint 1: Validate acquisition, reached'));
    fireEvent.press(getByLabelText('Go back'));
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    expect(await findByTestId('chart-waypoint-reached', {}, { timeout: 3000 })).toBeTruthy();
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });

  it('full motion: opens and reaches, and skipping with a map tap still lands on the commit card', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { getByTestId, findByTestId } = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(300);
    // A tap while the open sequence runs skips it.
    fireEvent.press(getByTestId('chart-hero-map-surface'));
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    await settle(50);
    fireEvent.press(getByTestId('chart-hero-map-surface'));
    expect(await findByTestId('chart-waypoint-reached', {}, { timeout: 4000 })).toBeTruthy();
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });

  it('unmounting mid-sequence is clean', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount, getByTestId } = render(<Harness reducedMotion={false} next={afterFirstReach()} />);
    await settle(50);
    fireEvent.press(getByTestId('chart-menu-button'));
    fireEvent.press(getByTestId('chart-mark-waypoint'));
    fireEvent.press(getByTestId('chart-reach-yes'));
    await settle(20);
    unmount();
    await settle(300);
    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 300))).toEqual([]);
    errors.mockRestore();
  });
});
