jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual, runOnJS: (fn: unknown) => fn, withRepeat: (value: unknown) => value, withSequence: (...values: unknown[]) => values[values.length - 1], withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => { done?.(true); return value; } };
});
const mockSoundPlay = jest.fn();
jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: { play: (...args: unknown[]) => mockSoundPlay(...args), prewarm: jest.fn(), releaseIdle: jest.fn() },
}));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(() => Promise.resolve()),
    selection: jest.fn(() => Promise.resolve()),
    notification: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('@/services/notifications/chartNotifications', () => ({
  syncChartNotifications: jest.fn(async () => undefined),
}));
// The teaching overlay measures native views; its own tests cover it. Here it only has to stay out of the way.
jest.mock('../../sheet/ChartOneMoveTeaching', () => ({ ChartOneMoveTeaching: () => null }));

import React, { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { safeHaptics } from '@/utils/haptics';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { resetChartHighWaterCache } from '@/hooks/v2/chart/chartHighWater';
import { setChartOpenedClockOffsetForDev } from '@/hooks/v2/chart/chartLastOpened';
import { resetChartTaughtStateCache } from '@/hooks/v2/chart/chartTaughtState';
import type { CourseDetail } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartActiveView, chartMoveSceneId, chartWaypointSceneId } from '../../ChartActiveView';
import { CHART_MAP_TIMING } from '../../chartMotion';
import { loadFogImages, warmChartMapResources } from '../../map/ChartMapLand';
import { loadCloudTiles } from '../../map/chartCloudTiles';
import { buildRouteTable, waypointPlacement } from '../../map/chartMapGeometry';
import * as sequences from '../../map/chartMapSequences';
import { chartActions, course, move, viewOf, waypoint } from './chartPanelFixtures';

const impact = safeHaptics.impact as jest.Mock;
const selection = safeHaptics.selection as jest.Mock;
const LIGHT = Haptics.ImpactFeedbackStyle.Light;

let testDay = 100;
beforeEach(() => {
  testDay += 2;
  setChartOpenedClockOffsetForDev(testDay * 24 * 60 * 60 * 1000);
  resetChartHighWaterCache();
  resetChartTaughtStateCache();
  useCelebrationStore.getState().reset();
  impact.mockClear();
  selection.mockClear();
  mockSoundPlay.mockClear();
});
afterEach(() => useCelebrationStore.getState().reset());
beforeAll(async () => {
  await Promise.all([loadFogImages(buildRouteTable()), loadCloudTiles()]);
  warmChartMapResources(buildRouteTable(), 750, 1334);
  await new Promise((resolve) => setTimeout(resolve, 300));
});

/** Four waypoints, the first `reached` of them reached (the next one current). */
function fourWaypoints(reached: number): CourseDetail {
  const base = course();
  const ids = ['w1', 'w2', 'w3', 'w4'];
  return {
    ...base,
    version: 5 + reached,
    waypointCount: 4,
    reachedCount: reached,
    currentWaypointId: ids[reached] ?? null,
    currentMoveId: null,
    waypoints: ids.map((id, i) =>
      waypoint({
        id,
        position: (i + 1) * 100,
        title: `Waypoint ${i + 1} title`,
        state: i < reached ? 'REACHED' : i === reached ? 'CURRENT' : 'UPCOMING',
        reachedAt: i < reached ? '2026-09-22T00:00:00Z' : null,
      }),
    ),
    moves: [],
  };
}

/** w2 is current and its only move is m1: completing it fills the leg (progress is capped at the 90% hold). */
function oneMoveCourse(done: boolean): CourseDetail {
  const base = course();
  return {
    ...base,
    version: done ? 6 : 5,
    waypoints: base.waypoints.map((item) => (item.id === 'w2' ? { ...item, kind: 'MILESTONE', metric: null } : item)),
    moves: [
      move({ id: 'm1', title: 'Finish onboarding redesign', isCurrent: true, status: done ? 'COMPLETED' : 'ACTIVE', completedAt: done ? new Date().toISOString() : null }),
    ],
  };
}

type HarnessProps = {
  initial: CourseDetail;
  next?: CourseDetail | null;
  afterMove?: CourseDetail | null;
  reducedMotion?: boolean;
  onWaypointReached?: jest.Mock;
};
let lastActions: ReturnType<typeof chartActions> | null = null;
let completeMoveCalls = 0;

function Harness({ initial, next = null, afterMove = null, reducedMotion = false, onWaypointReached }: HarnessProps) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => setCurrent(initial), [initial]);
  const [celebration, setCelebration] = useState<{ completedTitle: string; nextTitle: string | null; fromFraction: number } | null>(null);
  const actions = useMemo(() => {
    const built = chartActions({
      reachWaypoint: jest.fn(async () => {
        if (!next) return null;
        setCurrent(next);
        return { completedTitle: 'Done', nextTitle: 'Next', destinationReached: false, chart: next };
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
      onWaypointReached={(result, previous, total) => {
        onWaypointReached?.(result, previous, total);
        if (!result.destinationReached) setCelebration({ completedTitle: result.completedTitle, nextTitle: result.nextTitle, fromFraction: 0 });
      }}
      onCompleteMove={async () => {
        completeMoveCalls += 1;
        if (afterMove) setCurrent(afterMove);
        return true;
      }}
      onOpenVision={jest.fn()}
      onOpenLog={jest.fn()}
      onAdjust={jest.fn()}
      onRelease={jest.fn()}
      actionError={null}
    />
  );
}

const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const noteCalls = () => mockSoundPlay.mock.calls.filter(([key]) => typeof key === 'string' && key.startsWith('chart-waypoint_'));
const soundKeys = () => mockSoundPlay.mock.calls.map(([key]) => key as string);
const active = () => useCelebrationStore.getState().active;

/** Opens the Chart in full motion, lets the opening finish, then clears the opening's own cues. */
async function openChart(props: HarnessProps) {
  const open = jest.spyOn(sequences, 'openSequence');
  const screen = render(<Harness {...props} />);
  // The open starts once the map has drawn its first frame; a reach started before then would be skipped by it.
  for (let i = 0; i < 40 && open.mock.calls.length === 0; i++) await wait(100);
  open.mockRestore();
  await wait(1600);
  impact.mockClear();
  mockSoundPlay.mockClear();
  return screen;
}

/** The menu's Mark path: opens the confirm sheet and answers Yes. */
async function reachFromMenu(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId('chart-menu-button'));
  fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
  await act(async () => { fireEvent.press(screen.getByTestId('chart-reach-yes')); });
}

describe('Waypoint reached (W1)', () => {
  it('registers as level 3, 3200ms, skippable, with a Skip button only while it is the active scene', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    expect(screen.queryByLabelText('Skip')).toBeNull();
    await reachFromMenu(screen);
    expect(active()).toEqual({ id: chartWaypointSceneId('w2'), level: 3, skippable: true });
    expect(CHART_MAP_TIMING.reach.settleAt).toBe(3200);
    const skip = screen.getByLabelText('Skip');
    expect(skip.props.accessibilityRole).toBe('button');
    act(() => { fireEvent.press(skip); });
    await waitFor(() => expect(active()).toBeNull());
    expect(screen.queryByLabelText('Skip')).toBeNull();
    screen.unmount();
  });

  it('plays exactly one Light haptic and one note, at the marker fill (~1000ms), and no Medium, selection, stamp or wind', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    await reachFromMenu(screen);
    await wait(500);
    expect(impact).not.toHaveBeenCalled();
    expect(noteCalls()).toHaveLength(0);
    // The pen draws the leg first.
    expect(soundKeys()).toContain('chart-ink');
    await wait(900);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    expect(noteCalls()).toHaveLength(1);
    expect(noteCalls()[0][0]).toBe('chart-waypoint_2');
    // The rest of the scene adds nothing: it ends at 3200 with the same single haptic and note.
    await wait(2500);
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(selection).not.toHaveBeenCalled();
    expect(noteCalls()).toHaveLength(1);
    expect(soundKeys()).not.toContain('chart-stamp');
    expect(soundKeys()).not.toContain('chart-wind');
    expect(impact.mock.calls.every(([style]) => style === LIGHT)).toBe(true);
    screen.unmount();
  }, 20000);

  it.each([1, 2, 3])('waypoint %i plays its authored cue', async (number) => {
    const screen = await openChart({ initial: fourWaypoints(number - 1), next: fourWaypoints(number) });
    await reachFromMenu(screen);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(noteCalls()).toHaveLength(1));
    expect(noteCalls()[0][0]).toBe(`chart-waypoint_${number}`);
    screen.unmount();
  }, 20000);

  it('Skip lands settled and plays the note and Light haptic once if they had not played yet', async () => {
    const onWaypointReached = jest.fn();
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2), onWaypointReached });
    await reachFromMenu(screen);
    await wait(200);
    expect(impact).not.toHaveBeenCalled();
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(screen.getByTestId('chart-waypoint-reached')).toBeTruthy());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    expect(noteCalls()).toHaveLength(1);
    expect(active()).toBeNull();
    // Settled: the marker is filled (reached), the commit card names the next waypoint, the route is no longer frozen.
    expect(screen.getByLabelText('Waypoint 2: Waypoint 2 title, reached')).toBeTruthy();
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    // Nothing fires again afterwards.
    await wait(1500);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(noteCalls()).toHaveLength(1);
    screen.unmount();
  }, 20000);

  it('Skip after the note has played does not play it again', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    await reachFromMenu(screen);
    await wait(1300);
    expect(impact).toHaveBeenCalledTimes(1);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(active()).toBeNull());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(noteCalls()).toHaveLength(1);
    screen.unmount();
  }, 20000);

  it('two entry points and a replayed report cannot double fire: one request, one scene, one haptic, one note', async () => {
    const onWaypointReached = jest.fn();
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2), onWaypointReached });
    // The menu's confirm and the sheet's own Mark confirm are both open, then both answer Yes in the same tick.
    fireEvent.press(screen.getByTestId('chart-menu-button'));
    fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
    // peek -> half -> full, where the route list (and its reach button) is reachable
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    fireEvent.press(screen.getByTestId('chart-route-reach'));
    const yes = screen.getAllByTestId('chart-reach-yes');
    expect(yes.length).toBeGreaterThanOrEqual(2);
    const reach = jest.spyOn(sequences, 'reachSequence');
    await act(async () => { yes.forEach((button) => fireEvent.press(button)); });
    expect(lastActions!.reachWaypoint).toHaveBeenCalledTimes(1);
    expect(active()?.id).toBe(chartWaypointSceneId('w2'));
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(active()).toBeNull());
    await wait(300);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(noteCalls()).toHaveLength(1);
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(reach).toHaveBeenCalledTimes(1);
    reach.mockRestore();
    screen.unmount();
  }, 20000);

  it('waits behind a higher scene, keeps the marker open, then plays when promoted and is never lost', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    useCelebrationStore.getState().request(4, 'other-summit', { durationMs: 7600 });
    await reachFromMenu(screen);
    expect(active()?.id).toBe('other-summit');
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    await wait(1300);
    // Deferred: no note, no haptic, and the reached marker has not filled yet.
    expect(impact).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Waypoint 2: Waypoint 2 title, current')).toBeTruthy();
    act(() => useCelebrationStore.getState().finish('other-summit'));
    expect(active()?.id).toBe(chartWaypointSceneId('w2'));
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(screen.getByTestId('chart-waypoint-reached')).toBeTruthy());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(noteCalls()).toHaveLength(1);
    screen.unmount();
  }, 20000);

  it('a higher scene preempts it: it lands settled, with the note and haptic once, and is not requeued', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    await reachFromMenu(screen);
    await wait(300);
    act(() => { useCelebrationStore.getState().request(4, 'other-summit', { durationMs: 7600 }); });
    await waitFor(() => expect(screen.getByTestId('chart-waypoint-reached')).toBeTruthy());
    expect(active()?.id).toBe('other-summit');
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(noteCalls()).toHaveLength(1);
    screen.unmount();
  }, 20000);

  it('Reduce Motion: no travel and not skippable, but the note and the Light haptic still fire once', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2), reducedMotion: true });
    impact.mockClear();
    await reachFromMenu(screen);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    expect(noteCalls()).toHaveLength(1);
    expect(screen.queryByLabelText('Skip')).toBeNull();
    // No pen: it belongs to the travel that no longer plays.
    expect(soundKeys()).not.toContain('chart-ink');
    await wait(700);
    expect(active()).toBeNull();
    // The sheet swaps to the commit card through its own content crossfade.
    await waitFor(() => expect(screen.getByTestId('chart-waypoint-reached')).toBeTruthy(), { timeout: 3000 });
    expect(impact).toHaveBeenCalledTimes(1);
    screen.unmount();
  }, 20000);

  it('leaving the Chart mid-scene releases the coordinator', async () => {
    const screen = await openChart({ initial: fourWaypoints(1), next: fourWaypoints(2) });
    await reachFromMenu(screen);
    expect(active()?.id).toBe(chartWaypointSceneId('w2'));
    screen.unmount();
    expect(active()).toBeNull();
  }, 20000);
});

describe('One Move done (M1)', () => {
  beforeEach(() => {
    completeMoveCalls = 0;
  });

  it('fires exactly one Light haptic at the tap, and a second tap does not fire again', async () => {
    const screen = await openChart({ initial: oneMoveCourse(false), afterMove: oneMoveCourse(true) });
    const circle = screen.getByTestId('chart-one-move-check');
    // The haptic is at the tap itself, before the server answers.
    act(() => { fireEvent.press(circle); fireEvent.press(circle); });
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    expect(soundKeys()).toContain('chart-move-done');
    await waitFor(() => expect(completeMoveCalls).toBe(1));
    await wait(300);
    // The route ink that follows adds no haptic of its own, and no selection.
    expect(impact).toHaveBeenCalledTimes(1);
    expect(selection).not.toHaveBeenCalled();
    // The checked circle cannot be tapped again.
    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    expect(impact).toHaveBeenCalledTimes(1);
    expect(completeMoveCalls).toBe(1);
    screen.unmount();
  }, 20000);

  it('registers as level 2, 2500ms, not skippable; inks the leg to the 90% hold, never the marker; the toast stays', async () => {
    const hold = jest.spyOn(sequences, 'moveHoldSequence');
    const screen = await openChart({ initial: oneMoveCourse(false), afterMove: oneMoveCourse(true) });
    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    await waitFor(() => expect(hold).toHaveBeenCalled());
    expect(active()).toEqual({ id: chartMoveSceneId('m1'), level: 2, skippable: false });
    expect(useCelebrationStore.getState().skip()).toBe(false);
    expect(screen.queryByLabelText('Skip')).toBeNull();
    // The shipped toast is unchanged.
    await waitFor(() => expect(screen.getByTestId('chart-one-move-toast').props.children).toBe(CHART_COPY.sheet.moveDoneToast));
    const ctx = hold.mock.calls[0][0];
    const placement = waypointPlacement(3);
    const leg = placement.legs[ctx.legIndex];
    const holdArc = sequences.moveHoldArc(placement, ctx.legIndex)!;
    expect(ctx.legIndex).toBe(1);
    expect(ctx.toArc).toBeCloseTo(holdArc);
    expect(ctx.toArc!).toBeLessThan(leg.end);
    expect(ctx.anim.revealArc.value).toBeLessThanOrEqual(holdArc + 1e-6);
    expect(ctx.anim.revealArc.value).toBeLessThan(leg.end);
    await wait(1800);
    expect(soundKeys()).toContain('chart-ink-hold');
    // The marker stays open: the move did not reach it (state current, no stamp).
    expect(ctx.anim.stampIndex.value).toBe(-1);
    expect(screen.getByLabelText('Waypoint 2: Reach 1,000 active users, current')).toBeTruthy();
    // The scene rests until 2500, then the coordinator is free.
    await wait(2700);
    expect(active()).toBeNull();
    expect(ctx.anim.revealArc.value).toBeCloseTo(holdArc, 3);
    expect(ctx.anim.revealArc.value).toBeLessThan(leg.end);
    hold.mockRestore();
    screen.unmount();
  }, 20000);

  it('a move waits behind a waypoint scene (L3) and plays when promoted', async () => {
    const hold = jest.spyOn(sequences, 'moveHoldSequence');
    const screen = await openChart({ initial: oneMoveCourse(false), afterMove: oneMoveCourse(true) });
    useCelebrationStore.getState().request(3, 'chart-waypoint:other', { durationMs: 3200 });
    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    await wait(400);
    expect(hold).not.toHaveBeenCalled();
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    act(() => useCelebrationStore.getState().finish('chart-waypoint:other'));
    expect(active()?.id).toBe(chartMoveSceneId('m1'));
    await waitFor(() => expect(hold).toHaveBeenCalledTimes(1));
    hold.mockRestore();
    screen.unmount();
  }, 20000);

  it('Reduce Motion: the tap Light haptic still fires once; the ink is set with no travel', async () => {
    const hold = jest.spyOn(sequences, 'moveHoldSequence');
    const screen = await openChart({ initial: oneMoveCourse(false), afterMove: oneMoveCourse(true), reducedMotion: true });
    fireEvent.press(screen.getByTestId('chart-one-move-check'));
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    expect(soundKeys()).toContain('chart-move-done');
    expect(soundKeys()).not.toContain('chart-ink-hold');
    await waitFor(() => expect(hold).toHaveBeenCalled());
    expect(hold.mock.calls[0][0].reducedMotion).toBe(true);
    expect(impact).toHaveBeenCalledTimes(1);
    hold.mockRestore();
    screen.unmount();
  }, 20000);
});
