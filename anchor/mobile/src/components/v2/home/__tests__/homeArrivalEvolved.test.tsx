import React from 'react';
import { Text, View } from 'react-native';
import { act, render } from '@testing-library/react-native';

const mockPlayCreationSound = jest.fn();
jest.mock('@/services/CreationSounds', () => ({ playCreationSound: (...args: unknown[]) => mockPlayCreationSound(...args) }));
jest.mock('@/utils/haptics', () => ({
  safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() },
}));

import {
  ARRIVAL_TIMING,
  EVOLVED_GHOST_OPACITY,
  HomeArrivalProvider,
  arrivalDuration,
  arrivalWindows,
  evolvedGhostOpacity,
  evolvedLineProgress,
  evolvedParams,
  evolvedUnderlineProgress,
  homeArrivalCelebrationId,
  resetPlayedPracticeArrivalsForTests,
  useHomeArrival,
} from '../homeArrival';
import { HomeArrivalCounter } from '../HomeArrivalCounter';
import { HomeArrivalUnderline, HomeEvolvedFromLine, HomeEvolvedGhost, evolvedFromLine } from '../HomeArrivalEvolved';
import { useHomeArrivalStore, type ArrivalGhost, type HomeArrival } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { safeHaptics } from '@/utils/haptics';

const GHOST: ArrivalGhost = { svg: '<svg viewBox="0 0 10 10"/>', category: 'creativity' };
const hookResult: { current: ReturnType<typeof useHomeArrival> | null } = { current: null };

const successor = { evolvedFrom: { anchorId: 'old-1', intention: 'Publish my novel' } };
const plainAnchor = { evolvedFrom: undefined };

function Home({ selected = ['new-1'], reduceMotion = false, anchor = successor, total = 2 }: {
  selected?: Array<string | undefined>;
  reduceMotion?: boolean;
  anchor?: { evolvedFrom?: { anchorId: string; intention: string } };
  total?: number;
}) {
  const arrival = useHomeArrival({ selectedAnchorIds: selected, onPose: jest.fn(), reduceMotion });
  hookResult.current = arrival;
  return (
    <HomeArrivalProvider value={arrival.context}>
      <HomeArrivalCounter index={0} total={total} active style={{ fontSize: 10 }} />
      <HomeEvolvedGhost anchorSize={200} boxHeight={260} active />
      <HomeArrivalUnderline active width={88} height={7}><View testID="mark" /></HomeArrivalUnderline>
      <HomeEvolvedFromLine anchor={anchor} active />
    </HomeArrivalProvider>
  );
}

const stageEvolved = (extra: Partial<HomeArrival> = {}) =>
  useHomeArrivalStore.getState().stage({ anchorId: 'new-1', kind: 'evolved', svg: '<svg/>', fromRect: null, ghost: GHOST, ...extra });

const opacityOf = (node: { props: Record<string, unknown> }) =>
  (node.props.jestAnimatedStyle as { value?: { opacity?: number } } | undefined)?.value?.opacity;

beforeEach(() => {
  jest.useFakeTimers();
  resetPlayedPracticeArrivalsForTests();
  hookResult.current = null;
  mockPlayCreationSound.mockClear();
  jest.mocked(safeHaptics.impact).mockClear();
  jest.mocked(safeHaptics.selection).mockClear();
  jest.mocked(safeHaptics.notification).mockClear();
  act(() => useHomeArrivalStore.setState({ arrival: null }));
  act(() => useCelebrationStore.getState().reset());
  act(() => useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', false));
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Evolved anchor lands on Home: timing and windows', () => {
  it('gives the evolved arrival 3400ms and leaves every other duration alone', () => {
    expect(ARRIVAL_TIMING.evolved).toBe(3400);
    expect(arrivalDuration('evolved', false)).toBe(3400);
    expect(arrivalDuration('evolved', true)).toBe(3400);
    expect(arrivalDuration('evolved', false, true)).toBe(700);
    expect(arrivalDuration('release', false)).toBe(2200);
    expect(arrivalDuration('practice', true)).toBe(2400);
    expect(arrivalDuration('first', true)).toBe(3400);
    expect(arrivalDuration('repeat', true)).toBe(1700);
    expect(arrivalDuration('repeat', false)).toBe(700);
  });

  it('runs the ghost 1000 to 1400 in and 2100 to 2800 out, the underline 1300 to 1900 and the line 2200 to 2800', () => {
    const w = arrivalWindows('evolved', false);
    const at = (ms: number) => ms / 3400;
    expect(w.ghostIn?.[0]).toBeCloseTo(at(1000));
    expect(w.ghostIn?.[1]).toBeCloseTo(at(1400));
    expect(w.ghostOut?.[0]).toBeCloseTo(at(2100));
    expect(w.ghostOut?.[1]).toBeCloseTo(at(2800));
    expect(w.underline?.[0]).toBeCloseTo(at(1300));
    expect(w.underline?.[1]).toBeCloseTo(at(1900));
    expect(w.line?.[0]).toBeCloseTo(at(2200));
    expect(w.line?.[1]).toBeCloseTo(at(2800));
    // The repeat arrival's regions, in place: header 1000 to 1500, the ink panel 500 to 1250, no slide.
    expect(w.header[0]).toBeCloseTo(at(1000));
    expect(w.header[1]).toBeCloseTo(at(1500));
    expect(w.lower[0]).toBeCloseTo(at(500));
    expect(w.lower[1]).toBeCloseTo(at(1250));
    expect(w.lowerSlide).toBeUndefined();
    // The counter does not move: one released, one new.
    expect(w.counter).toBeUndefined();
    expect(w.neighbours).toBeUndefined();
  });

  it('uses the short crossfade, with no ghost, no draw and no line window, under Reduce Motion', () => {
    const w = arrivalWindows('evolved', false, true);
    expect(w).toEqual(arrivalWindows('repeat', false));
    expect(w.ghostIn).toBeUndefined();
    expect(w.line).toBeUndefined();
  });

  it('leaves the first, repeat, practice and release windows exactly as they were', () => {
    expect(arrivalWindows('repeat', true)).toMatchObject({ flight: [0, 0.52], overlayOut: [0.54, 0.72], hero: [0.5, 0.72] });
    expect(arrivalWindows('first', true)).toMatchObject({ flight: [0, 0.38], hero: [0.38, 0.55], lower: [0.55, 0.95] });
    expect(arrivalWindows('practice', true).swap).toBeDefined();
    expect(arrivalWindows('release', false).lowerSlide).toBe(380);
    for (const kind of ['first', 'repeat', 'practice', 'release'] as const) {
      expect(arrivalWindows(kind, true).ghostIn).toBeUndefined();
      expect(arrivalWindows(kind, true).line).toBeUndefined();
    }
  });

  it('the ghost is .22 behind the new art between its windows, and gone before and after', () => {
    const params = evolvedParams({ windows: arrivalWindows('evolved', false), ghost: GHOST });
    const at = (ms: number) => ms / 3400;
    expect(evolvedGhostOpacity(at(900), params)).toBe(0);
    expect(evolvedGhostOpacity(at(1400), params)).toBeCloseTo(EVOLVED_GHOST_OPACITY);
    expect(evolvedGhostOpacity(at(2000), params)).toBeCloseTo(EVOLVED_GHOST_OPACITY);
    expect(evolvedGhostOpacity(at(2450), params)).toBeCloseTo(EVOLVED_GHOST_OPACITY / 2, 2);
    expect(evolvedGhostOpacity(at(2800), params)).toBe(0);
    expect(evolvedGhostOpacity(1, params)).toBe(0);
    expect(EVOLVED_GHOST_OPACITY).toBe(0.22);
  });

  it('the underline draws and the line fades in over their windows, eased out, and are complete at the end', () => {
    const params = evolvedParams({ windows: arrivalWindows('evolved', false), ghost: null });
    const at = (ms: number) => ms / 3400;
    expect(evolvedUnderlineProgress(at(1300), params)).toBe(0);
    const mid = evolvedUnderlineProgress(at(1600), params);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
    expect(evolvedUnderlineProgress(at(1900), params)).toBeCloseTo(1);
    expect(evolvedLineProgress(at(2100), params)).toBe(0);
    expect(evolvedLineProgress(at(2800), params)).toBeCloseTo(1);
    expect(evolvedLineProgress(1, params)).toBeCloseTo(1);
  });
});

describe('Evolved anchor lands on Home: the arrival', () => {
  it('is ready the moment Home is posed on the successor: no mark, no target, no flight', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    expect(useHomeArrivalStore.getState().arrival).toMatchObject({ id, kind: 'evolved', fromRect: null, targetRect: null, phase: 'ready' });
    expect(hookResult.current?.flight).toBe(false);
    expect(hookResult.current?.context.progress.value).toBe(0);
  });

  it('is for the successor only: Home showing another Anchor does not pose it', () => {
    render(<Home selected={['someone-else', undefined]} />);
    act(() => { stageEvolved(); });
    expect(hookResult.current?.arrival).toBeNull();
    expect(useHomeArrivalStore.getState().arrival?.phase).toBe('staging');
  });

  it('registers as a skippable level 3 scene of 3400ms under the usual home-arrival id, and clears itself', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });

    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 3, skippable: true });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(3400);

    act(() => { jest.advanceTimersByTime(3400 + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(hookResult.current?.context.progress.value).toBe(1);
  });

  it('a skip lands on the settled end state: progress complete, the arrival cleared, the coordinator free', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { jest.advanceTimersByTime(1000); });
    let skipped = false;
    act(() => { skipped = useCelebrationStore.getState().skip(); });
    expect(skipped).toBe(true);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(hookResult.current?.context.progress.value).toBe(1);
    // Nothing starts again later.
    act(() => { jest.advanceTimersByTime(5000); });
    expect(useCelebrationStore.getState().active).toBeNull();
  });

  it('does not start a second time when Home remounts mid-arrival: the remounted Home lands settled', () => {
    const first = render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(useCelebrationStore.getState().active?.id).toBe(homeArrivalCelebrationId(id));

    first.unmount();
    expect(useCelebrationStore.getState().active).toBeNull();

    render(<Home />);
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(useCelebrationStore.getState().queueLength).toBe(0);
    expect(hookResult.current?.context.progress.value).toBe(1);
  });

  it('under Reduce Motion plays the short crossfade as a level 2 scene, not skippable, and ends settled', () => {
    render(<Home reduceMotion />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(hookResult.current?.context.evolved).toBeNull();
    expect(useCelebrationStore.getState().active).toEqual({ id: homeArrivalCelebrationId(id), level: 2, skippable: false });
    expect(useCelebrationStore.getState().current?.durationMs).toBe(ARRIVAL_TIMING.withoutFlight);

    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.withoutFlight + 100); });
    expect(useHomeArrivalStore.getState().arrival).toBeNull();
    expect(useCelebrationStore.getState().active).toBeNull();
    expect(hookResult.current?.context.progress.value).toBe(1);
  });

  it('plays no wake note: no sound, no haptic, and the first-Anchor flag is not used up', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    act(() => { jest.advanceTimersByTime(3400 + 100); });
    expect(mockPlayCreationSound).not.toHaveBeenCalled();
    expect(safeHaptics.impact).not.toHaveBeenCalled();
    expect(safeHaptics.selection).not.toHaveBeenCalled();
    expect(safeHaptics.notification).not.toHaveBeenCalled();
    expect(useTeachingStore.getState().userFlags.hasSeenFirstAnchorArrival).toBe(false);
  });

  it('never gives a late measurement a target: nothing flies', () => {
    render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().reportReady(id, { x: 1, y: 2, width: 3, height: 4 }); });
    expect(useHomeArrivalStore.getState().arrival?.targetRect).toBeNull();
  });
});

describe('Evolved anchor lands on Home: what it adds to the hero', () => {
  it('leaves the counter as it is: one released, one new, so it never rolls', () => {
    const view = render(<Home total={2} />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(view.queryByTestId('v2-home-counter-roll')).toBeNull();
    expect(view.getByText('1 OF 2')).toBeTruthy();
  });

  it('shows the lineage line with the exact approved wording and typographic quotes', () => {
    const view = render(<Home />);
    expect(evolvedFromLine('Publish my novel')).toBe('Evolved from “Publish my novel”');
    expect(view.queryByTestId('v2-home-evolved-from')).toBeNull();
    act(() => { stageEvolved(); });
    expect(view.getByTestId('v2-home-evolved-from').props.children).toBe('Evolved from “Publish my novel”');
  });

  it('omits the line entirely when the Anchor has no evolvedFrom, and changes nothing else', () => {
    const view = render(<Home anchor={plainAnchor} />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(view.queryByTestId('v2-home-evolved-from')).toBeNull();
    expect(view.queryByText(/Evolved from/)).toBeNull();
    // The ghost and the draw are the scene's own, not the line's.
    expect(view.getByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeTruthy();
    expect(view.getByTestId('v2-home-underline-draw')).toBeTruthy();
    // A blank intention is no line either.
    view.rerender(<Home anchor={{ evolvedFrom: { anchorId: 'old-1', intention: '   ' } }} />);
    expect(view.queryByTestId('v2-home-evolved-from')).toBeNull();
  });

  it('fades the line in with the arrival and removes it after skip', () => {
    const view = render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    // While it plays the line is the arrival's own (an animated text); the worklets above carry its timing.
    expect(view.getByTestId('v2-home-evolved-from')).toBeTruthy();
    act(() => { useCelebrationStore.getState().skip(); });
    expect(view.queryByTestId('v2-home-evolved-from')).toBeNull();
  });

  it('removes the line when the arrival finishes', () => {
    const view = render(<Home />);
    act(() => { const id = stageEvolved(); useHomeArrivalStore.getState().release(id); });
    expect(view.getByTestId('v2-home-evolved-from')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(ARRIVAL_TIMING.evolved + 100); });
    expect(view.queryByTestId('v2-home-evolved-from')).toBeNull();
  });

  it('under Reduce Motion the line is shown, with no ghost and no draw', () => {
    const view = render(<Home reduceMotion />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    act(() => { useHomeArrivalStore.getState().release(id); });
    expect(view.getByTestId('v2-home-evolved-from')).toBeTruthy();
    expect(opacityOf(view.getByTestId('v2-home-evolved-from')) ?? 1).toBe(1);
    expect(view.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    expect(view.queryByTestId('v2-home-underline-draw')).toBeNull();
  });

  it('draws the ghost only while the arrival plays and only when the released art is known', () => {
    const withGhost = render(<Home />);
    let id = 0;
    act(() => { id = stageEvolved(); });
    expect(withGhost.getByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeTruthy();
    act(() => { useHomeArrivalStore.getState().clear(id); });
    expect(withGhost.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    withGhost.unmount();

    const without = render(<Home />);
    act(() => { stageEvolved({ ghost: null }); });
    expect(without.queryByTestId('v2-home-evolved-ghost', { includeHiddenElements: true })).toBeNull();
    // The rest of the scene is unaffected by a missing ghost.
    expect(without.getByTestId('v2-home-underline-draw')).toBeTruthy();
    expect(without.getByTestId('v2-home-evolved-from')).toBeTruthy();
  });

  it('is the child, untouched, at any other time', () => {
    const view = render(
      <HomeArrivalProvider value={{ active: false, phase: null, release: null, evolved: null, progress: { value: 1 } as never, reportTarget: jest.fn(), reportHeroImageLoaded: jest.fn(), overlayHold: { value: 0 } as never }}>
        <HomeArrivalUnderline active width={88} height={7}><Text testID="mark">mark</Text></HomeArrivalUnderline>
      </HomeArrivalProvider>,
    );
    expect(view.getByTestId('mark')).toBeTruthy();
    expect(view.queryByTestId('v2-home-underline-draw')).toBeNull();
  });
});
