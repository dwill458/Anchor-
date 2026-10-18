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
import { useChartRouteRevisionStore } from '@/stores/v2/chartRouteRevisionStore';
import { resetChartHighWaterCache } from '@/hooks/v2/chart/chartHighWater';
import { setChartOpenedClockOffsetForDev } from '@/hooks/v2/chart/chartLastOpened';
import { resetChartTaughtStateCache } from '@/hooks/v2/chart/chartTaughtState';
import type { CourseDetail } from '@/types/chart';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartActiveView, chartRouteRevisedSceneId, chartSummitSceneId, chartWaypointSceneId, type ChartVisionPreview } from '../../ChartActiveView';
import type { ChartAnchorArt } from '../../ChartLandscape';
import { CHART_MAP_TIMING } from '../../chartMotion';
import { loadFogImages, warmChartMapResources } from '../../map/ChartMapLand';
import { loadCloudTiles } from '../../map/chartCloudTiles';
import { buildRouteTable } from '../../map/chartMapGeometry';
import * as sequences from '../../map/chartMapSequences';
import { chartActions, course, viewOf, waypoint } from './chartPanelFixtures';

const impact = safeHaptics.impact as jest.Mock;
const selection = safeHaptics.selection as jest.Mock;
const LIGHT = Haptics.ImpactFeedbackStyle.Light;
const HEAVY = Haptics.ImpactFeedbackStyle.Heavy;
const MEDIUM = Haptics.ImpactFeedbackStyle.Medium;

let testDay = 400;
beforeEach(() => {
  testDay += 2;
  setChartOpenedClockOffsetForDev(testDay * 24 * 60 * 60 * 1000);
  resetChartHighWaterCache();
  resetChartTaughtStateCache();
  useCelebrationStore.getState().reset();
  useChartRouteRevisionStore.getState().clear();
  impact.mockClear();
  selection.mockClear();
  mockSoundPlay.mockClear();
});
afterEach(() => {
  useCelebrationStore.getState().reset();
  useChartRouteRevisionStore.getState().clear();
});
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

/** The Chart once its last waypoint is reached. */
function finished(): CourseDetail {
  return { ...fourWaypoints(4), status: 'COMPLETED', completedAt: '2026-09-29T00:00:00Z', currentWaypointId: null };
}

/** The same Chart with a new waypoint ahead (a saved, changed revision). */
function revisedAhead(): CourseDetail {
  const base = fourWaypoints(1);
  return {
    ...base,
    version: base.version + 1,
    waypointCount: 5,
    waypoints: [...base.waypoints, waypoint({ id: 'w5', position: 450, title: 'Waypoint 5 title', state: 'UPCOMING' })],
  };
}

const ART: ChartAnchorArt = { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>', imageUrl: null, category: 'desire', expression: null };

type HarnessProps = {
  initial: CourseDetail;
  next?: CourseDetail | null;
  reducedMotion?: boolean;
  anchorArt?: ChartAnchorArt | null;
  onWaypointReached?: jest.Mock;
  onOpenLog?: jest.Mock;
  onRelease?: jest.Mock;
};
let lastActions: ReturnType<typeof chartActions> | null = null;

function Harness({ initial, next = null, reducedMotion = false, anchorArt = null, onWaypointReached, onOpenLog, onRelease }: HarnessProps) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => setCurrent(initial), [initial]);
  const [celebration, setCelebration] = useState<{ completedTitle: string; nextTitle: string | null; fromFraction: number } | null>(null);
  const actions = useMemo(() => {
    const built = chartActions({
      reachWaypoint: jest.fn(async () => {
        if (!next) return null;
        setCurrent(next);
        return { completedTitle: 'Done', nextTitle: next.status === 'COMPLETED' ? null : 'Next', destinationReached: next.status === 'COMPLETED', chart: next };
      }),
    });
    lastActions = built;
    return built;
  }, [next]);
  const vision: ChartVisionPreview = { imageUrl: null, description: 'My dashboard shows 10 thousand active users.', title: 'The dashboard' };
  return (
    <ChartActiveView
      view={viewOf(current)}
      course={current}
      identity={{ intention: 'Anchor has ten thousand users', category: 'desire' }}
      anchorArt={anchorArt}
      vision={vision}
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
      onCompleteMove={async () => true}
      onOpenVision={jest.fn()}
      onOpenLog={onOpenLog ?? jest.fn()}
      onAdjust={jest.fn()}
      onRelease={onRelease ?? jest.fn()}
      actionError={null}
    />
  );
}

const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const soundKeys = () => mockSoundPlay.mock.calls.map(([key]) => key as string);
const soundCalls = (key: string) => mockSoundPlay.mock.calls.filter(([played]) => played === key);
const active = () => useCelebrationStore.getState().active;
/** The ghost markers and the summit artwork are hidden from screen readers on purpose. */
const HIDDEN = { includeHiddenElements: true } as const;
const SUMMIT_ID = chartSummitSceneId('course-1');

/** Opens the Chart in full motion, lets the opening finish, then clears the opening's own cues. */
async function openChart(props: HarnessProps) {
  const open = jest.spyOn(sequences, 'openSequence');
  const screen = render(<Harness {...props} />);
  for (let i = 0; i < 40 && open.mock.calls.length === 0; i++) await wait(100);
  open.mockRestore();
  await wait(1600);
  impact.mockClear();
  mockSoundPlay.mockClear();
  return screen;
}

async function reachFromMenu(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId('chart-menu-button'));
  fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
  await act(async () => { fireEvent.press(screen.getByTestId('chart-reach-yes')); });
}

describe('Summit (S1)', () => {
  it('registers as level 4, 7600ms, skippable, with Skip only while it plays; the final waypoint never also plays W1', async () => {
    const reach = jest.spyOn(sequences, 'reachSequence');
    const summit = jest.spyOn(sequences, 'summitSequence');
    const ids: string[] = [];
    const unsubscribe = useCelebrationStore.subscribe((state) => { if (state.active && ids[ids.length - 1] !== state.active.id) ids.push(state.active.id); });
    const screen = await openChart({ initial: fourWaypoints(3), next: finished() });
    expect(screen.queryByLabelText('Skip')).toBeNull();
    await reachFromMenu(screen);
    expect(active()).toEqual({ id: SUMMIT_ID, level: 4, skippable: true });
    expect(CHART_MAP_TIMING.summit.settleAt).toBe(7600);
    const skip = screen.getByLabelText('Skip');
    expect(skip.props.accessibilityRole).toBe('button');
    // Mutually exclusive: the last waypoint is the summit, never also a waypoint scene.
    expect(summit).toHaveBeenCalledTimes(1);
    expect(reach).not.toHaveBeenCalled();
    act(() => { fireEvent.press(skip); });
    await waitFor(() => expect(active()).toBeNull());
    expect(screen.queryByLabelText('Skip')).toBeNull();
    expect(ids).toEqual([SUMMIT_ID]);
    expect(ids).not.toContain(chartWaypointSceneId('w4'));
    unsubscribe();
    reach.mockRestore();
    summit.mockRestore();
    screen.unmount();
  }, 30000);

  it('plays exactly one Heavy haptic and the authored summit thud and chord at the flag; the stillness is silent; no Medium', async () => {
    const screen = await openChart({ initial: fourWaypoints(3), next: finished() });
    await reachFromMenu(screen);
    await wait(900);
    // The pen draws the final leg first; there is no haptic and no thud yet.
    expect(soundKeys()).toContain('chart-ink');
    expect(impact).not.toHaveBeenCalled();
    const before = mockSoundPlay.mock.calls.length;
    // 1400-2000: stillness. Nothing sounds, nothing buzzes.
    await wait(800);
    expect(impact).not.toHaveBeenCalled();
    expect(mockSoundPlay.mock.calls.length).toBeLessThanOrEqual(before + 1);
    expect(soundCalls('chart-summit-thud')).toHaveLength(0);
    await wait(700);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(HEAVY);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    // The rest of the scene adds nothing of its own.
    await wait(5600);
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact.mock.calls.some(([style]) => style === MEDIUM || style === LIGHT)).toBe(false);
    expect(selection).not.toHaveBeenCalled();
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    expect(soundKeys()).not.toContain('chart-wind');
    // It ends on the existing cream completion panel.
    expect(screen.getByTestId('chart-summit-panel')).toBeTruthy();
    expect(screen.getByTestId('chart-completion-panel')).toBeTruthy();
    screen.unmount();
  }, 40000);

  it('Skip lands settled: flag planted, panel shown, and the Heavy haptic and summit cues play once if they had not', async () => {
    const onWaypointReached = jest.fn();
    const screen = await openChart({ initial: fourWaypoints(3), next: finished(), onWaypointReached });
    await reachFromMenu(screen);
    await wait(300);
    expect(impact).not.toHaveBeenCalled();
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(screen.getByTestId('chart-summit-panel')).toBeTruthy());
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(HEAVY);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Waypoint 4: Waypoint 4 title, reached')).toBeTruthy();
    // Nothing fires again afterwards.
    await wait(1500);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    screen.unmount();
  }, 30000);

  it('Skip after the flag has planted does not play the haptic or chord again', async () => {
    const screen = await openChart({ initial: fourWaypoints(3), next: finished() });
    await reachFromMenu(screen);
    await wait(2500);
    expect(impact).toHaveBeenCalledTimes(1);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(active()).toBeNull());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    screen.unmount();
  }, 30000);

  it('two entry points and a replayed report cannot double fire: one request, one summit, one Heavy haptic', async () => {
    const onWaypointReached = jest.fn();
    const screen = await openChart({ initial: fourWaypoints(3), next: finished(), onWaypointReached });
    fireEvent.press(screen.getByTestId('chart-menu-button'));
    fireEvent.press(screen.getByTestId('chart-mark-waypoint'));
    fireEvent.press(screen.getByTestId('chart-sheet-grabber'));
    fireEvent.press(screen.getByTestId('chart-mark-waypoint-cta'));
    const yes = screen.getAllByTestId('chart-reach-yes');
    expect(yes.length).toBeGreaterThanOrEqual(2);
    const summit = jest.spyOn(sequences, 'summitSequence');
    await act(async () => { yes.forEach((button) => fireEvent.press(button)); });
    expect(lastActions!.reachWaypoint).toHaveBeenCalledTimes(1);
    expect(active()?.id).toBe(SUMMIT_ID);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(active()).toBeNull());
    await wait(300);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    expect(onWaypointReached).toHaveBeenCalledTimes(1);
    expect(summit).toHaveBeenCalledTimes(1);
    summit.mockRestore();
    screen.unmount();
  }, 30000);

  it('the cream panel is the existing one: CHART_COPY.reached strings unchanged, and its two actions go to the journey and to Release', async () => {
    expect(CHART_COPY.reached).toEqual({
      destinationHeadline: 'Destination reached.',
      destinationSupport: 'What you once pictured is now part of your history.',
      viewJourney: 'View your journey',
      release: 'Release Anchor',
    });
    const onOpenLog = jest.fn();
    const onRelease = jest.fn();
    const screen = await openChart({ initial: fourWaypoints(3), next: finished(), onOpenLog, onRelease });
    await reachFromMenu(screen);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(screen.getByTestId('chart-summit-panel')).toBeTruthy());
    expect(screen.getByText(CHART_COPY.reached.destinationHeadline)).toBeTruthy();
    expect(screen.getByText(CHART_COPY.labels.destinationReached)).toBeTruthy();
    expect(screen.getByText(CHART_COPY.reached.viewJourney)).toBeTruthy();
    expect(screen.getByText(CHART_COPY.reached.release)).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-view-journey'));
    expect(onOpenLog).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('chart-release-anchor'));
    expect(onRelease).toHaveBeenCalledTimes(1);
    screen.unmount();
  }, 30000);

  it('Reduce Motion: not skippable (registered short), no travel, and the Heavy haptic and chord still fire once', async () => {
    const screen = await openChart({ initial: fourWaypoints(3), next: finished(), reducedMotion: true });
    impact.mockClear();
    mockSoundPlay.mockClear();
    await reachFromMenu(screen);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(HEAVY);
    expect(soundCalls('chart-summit-thud')).toHaveLength(1);
    expect(soundCalls('chart-summit-chord')).toHaveLength(1);
    expect(screen.queryByLabelText('Skip')).toBeNull();
    // No pen: it belongs to the travel that no longer plays.
    expect(soundKeys()).not.toContain('chart-ink');
    await waitFor(() => expect(screen.getByTestId('chart-summit-panel')).toBeTruthy(), { timeout: 3000 });
    await wait(600);
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    screen.unmount();
  }, 30000);

  it('a higher or equal scene ahead of it: it waits, then plays when promoted and is never lost', async () => {
    const screen = await openChart({ initial: fourWaypoints(3), next: finished() });
    useCelebrationStore.getState().request(4, 'other-summit', { durationMs: 7600 });
    await reachFromMenu(screen);
    expect(active()?.id).toBe('other-summit');
    expect(useCelebrationStore.getState().queueLength).toBe(1);
    await wait(1500);
    expect(impact).not.toHaveBeenCalled();
    act(() => useCelebrationStore.getState().finish('other-summit'));
    expect(active()?.id).toBe(SUMMIT_ID);
    act(() => { fireEvent.press(screen.getByLabelText('Skip')); });
    await waitFor(() => expect(screen.getByTestId('chart-summit-panel')).toBeTruthy());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(HEAVY);
    screen.unmount();
  }, 30000);

  it('leaving the Chart mid-scene releases the coordinator', async () => {
    const screen = await openChart({ initial: fourWaypoints(3), next: finished() });
    await reachFromMenu(screen);
    expect(active()?.id).toBe(SUMMIT_ID);
    screen.unmount();
    expect(active()).toBeNull();
  }, 30000);

  it('the real Anchor artwork stands at the destination once it is reached (and only then); a Chart with no artwork keeps the drawn stand-in', async () => {
    const withArt = render(<Harness initial={finished()} anchorArt={ART} reducedMotion />);
    await wait(300);
    expect(withArt.getByTestId('chart-map-summit-art', HIDDEN)).toBeTruthy();
    withArt.unmount();
    const noArt = render(<Harness initial={finished()} anchorArt={null} reducedMotion />);
    await wait(300);
    expect(noArt.queryByTestId('chart-map-summit-art', HIDDEN)).toBeNull();
    noArt.unmount();
    const unfinished = render(<Harness initial={fourWaypoints(3)} anchorArt={ART} reducedMotion />);
    await wait(300);
    expect(unfinished.queryByTestId('chart-map-summit-art', HIDDEN)).toBeNull();
    unfinished.unmount();
  }, 30000);
});

describe('Route revised (R1)', () => {
  /** What Adjust does on a saved, changed revision: it signals, then publishes the new Chart. */
  function saveRevision(screen: ReturnType<typeof render>, props: HarnessProps, revised: CourseDetail) {
    let nonce = 0;
    act(() => {
      nonce = useChartRouteRevisionStore.getState().signal('anchor-1', 'course-1');
      screen.rerender(<Harness {...props} initial={revised} />);
    });
    return nonce;
  }

  it('registers as level 1, not skippable, with no Skip button; holds the revised markers back, then shows them', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeTruthy();
    const nonce = saveRevision(screen, props, revisedAhead());
    expect(active()).toEqual({ id: chartRouteRevisedSceneId(nonce), level: 1, skippable: false });
    expect(useCelebrationStore.getState().skip()).toBe(false);
    expect(screen.queryByLabelText('Skip')).toBeNull();
    // The markers ahead stay back while the pen draws.
    await wait(900);
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('chart-map-faint-3', HIDDEN)).toBeNull();
    // The new waypoint appears at ~1800.
    await wait(1200);
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('chart-map-faint-3', HIDDEN)).toBeTruthy();
    // The scene rests until 3200 and then frees the coordinator.
    await wait(1300);
    expect(active()).toBeNull();
    screen.unmount();
  }, 30000);

  it('plays exactly one Light haptic at the new-waypoint pop (~1800ms) and no sound at all', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    saveRevision(screen, props, revisedAhead());
    await wait(1500);
    expect(impact).not.toHaveBeenCalled();
    await wait(500);
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    await wait(1500);
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(selection).not.toHaveBeenCalled();
    expect(mockSoundPlay).not.toHaveBeenCalled();
    screen.unmount();
  }, 30000);

  it('is dropped when another celebration is active, but the new route still shows, settled, with no haptic', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    useCelebrationStore.getState().request(2, 'other-move', { durationMs: 2500 });
    saveRevision(screen, props, revisedAhead());
    expect(active()?.id).toBe('other-move');
    await wait(300);
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('chart-map-faint-3', HIDDEN)).toBeTruthy();
    expect(useChartRouteRevisionStore.getState().pending).toBeNull();
    await wait(2000);
    expect(impact).not.toHaveBeenCalled();
    expect(mockSoundPlay).not.toHaveBeenCalled();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    screen.unmount();
  }, 30000);

  it('plays once per saved revision: the same signal is never replayed, and a route change with no signal is quiet', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    // A route that changes with no saved revision (a sheet edit, a refresh) makes no scene.
    act(() => { screen.rerender(<Harness {...props} initial={revisedAhead()} />); });
    await wait(500);
    expect(active()).toBeNull();
    expect(impact).not.toHaveBeenCalled();
    // A revision plays once.
    act(() => { useChartRouteRevisionStore.getState().signal('anchor-1', 'course-1'); });
    await wait(300);
    expect(active()?.level).toBe(1);
    await wait(3300);
    expect(impact).toHaveBeenCalledTimes(1);
    act(() => { screen.rerender(<Harness {...props} initial={fourWaypoints(1)} />); });
    await wait(500);
    expect(active()).toBeNull();
    expect(impact).toHaveBeenCalledTimes(1);
    screen.unmount();
  }, 30000);

  it('ignores a signal for another Chart', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    act(() => { useChartRouteRevisionStore.getState().signal('anchor-2', 'course-2'); });
    await wait(500);
    expect(active()).toBeNull();
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeTruthy();
    expect(impact).not.toHaveBeenCalled();
    screen.unmount();
  }, 30000);

  it('Reduce Motion: the new route shows at once, with one Light haptic and no sound', async () => {
    const props = { initial: fourWaypoints(1), reducedMotion: true };
    const screen = await openChart(props);
    impact.mockClear();
    saveRevision(screen, props, revisedAhead());
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith(LIGHT);
    await wait(600);
    expect(active()).toBeNull();
    expect(screen.queryByTestId('chart-map-ghost', HIDDEN)).toBeTruthy();
    expect(impact).toHaveBeenCalledTimes(1);
    expect(mockSoundPlay).not.toHaveBeenCalled();
    screen.unmount();
  }, 30000);

  it('leaving the Chart mid-scene releases the coordinator', async () => {
    const props = { initial: fourWaypoints(1) };
    const screen = await openChart(props);
    saveRevision(screen, props, revisedAhead());
    expect(active()?.level).toBe(1);
    screen.unmount();
    expect(active()).toBeNull();
  }, 30000);
});
