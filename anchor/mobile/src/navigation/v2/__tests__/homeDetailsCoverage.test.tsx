import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { deferAnimationCallbacks } from '@/__tests__/mocks/timedAnimationCallbacks';
import {
  ANCHOR_TRANSITION_TIMING,
  ProgressiveFocusTransitionProvider,
  anchorTransitionSceneOpacity,
  anchorTransitionSceneRole,
  useAnchorTransitionPlace,
  useProgressiveFocusTransition,
  type AnchorTransitionPlace,
} from '../ProgressiveFocusTransition';

/**
 * Home <-> Details must never show a frame with neither screen drawn. The
 * device recording of 2026-09-27 showed ~300ms of bare cream plus the flying
 * Anchor in both directions: Home (forward) and Details (back) faded their UI
 * out before the other screen was on screen. These tests hold the invariant
 * `sourceVisible || destinationVisible` at every sampled phase.
 */

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

const anchor = {
  id: 'a',
  localId: 'local-a',
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1 L9 9"/></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: undefined,
  category: 'career',
  classifierMeta: undefined,
} as never;

const SAMPLES = Array.from({ length: 11 }, (_, i) => i / 10);

type Pair = { direction: 'forward' | 'back'; sourcePlace: AnchorTransitionPlace; targetPlace: AnchorTransitionPlace };
const PAIRS: Pair[] = [
  { direction: 'forward', sourcePlace: 'home', targetPlace: 'details' },
  { direction: 'back', sourcePlace: 'details', targetPlace: 'home' },
  { direction: 'forward', sourcePlace: 'details', targetPlace: 'practiceSetup' },
  { direction: 'forward', sourcePlace: 'details', targetPlace: 'practice' },
];

/** A screen counts as visible only when fully drawn: a half-faded screen over bare cream is the defect. */
const isVisible = (opacity: number) => opacity >= 0.99;

describe('Home <-> Details screen coverage', () => {
  it.each(PAIRS)('keeps a full screen drawn at every phase ($sourcePlace -> $targetPlace)', ({ direction, sourcePlace, targetPlace }) => {
    const state = { active: true, direction, sourcePlace, targetPlace, backdrop: null };
    for (const exit of SAMPLES) {
      for (const reveal of SAMPLES) {
        const source = anchorTransitionSceneOpacity(anchorTransitionSceneRole(state, sourcePlace), exit, reveal);
        const destination = anchorTransitionSceneOpacity(anchorTransitionSceneRole(state, targetPlace), exit, reveal);
        const covered = isVisible(source) || isVisible(destination);
        if (!covered) throw new Error(`blank at exit=${exit} reveal=${reveal}: source=${source} destination=${destination}`);
      }
    }
  });

  it('the checker itself rejects a source fade that runs ahead of the destination', () => {
    // Setup -> Deep Focus session is a layer swap inside one route and keeps its staging; sampled early, neither layer is fully drawn.
    const state = { active: true, direction: 'forward' as const, sourcePlace: 'practiceSetup' as const, targetPlace: 'deepFocusSession' as const, backdrop: null };
    const source = anchorTransitionSceneOpacity(anchorTransitionSceneRole(state, 'practiceSetup'), 1, 0);
    const destination = anchorTransitionSceneOpacity(anchorTransitionSceneRole(state, 'deepFocusSession'), 1, 0);
    expect(isVisible(source) || isVisible(destination)).toBe(false);
  });

  it('never schedules a screen fade or a delayed route change on a route-changing hop', () => {
    for (const t of [ANCHOR_TRANSITION_TIMING.details, ANCHOR_TRANSITION_TIMING.back, ANCHOR_TRANSITION_TIMING.fromDetails]) {
      expect(t.exitMs).toBe(0);
      // Details -> Home pops late, in the spring's still tail, so the pop cannot stall the flight.
      expect(t.navigateAtMs).toBe(t === ANCHOR_TRANSITION_TIMING.back ? 240 : 0);
      expect(t.revealMs).toBe(0);
      expect(t.travelDelayMs + t.travelMs).toBeLessThanOrEqual(320);
    }
    expect(ANCHOR_TRANSITION_TIMING.reduced.exitMs).toBe(0);
    expect(ANCHOR_TRANSITION_TIMING.reduced.navigateAtMs).toBe(0);
  });
});

type Api = ReturnType<typeof useProgressiveFocusTransition>;
let api: Api;
function Capture() {
  api = useProgressiveFocusTransition();
  return null;
}

function DetailsPlace() {
  const binding = useAnchorTransitionPlace('details', 'a', 'paper');
  return (
    <View ref={binding.ref} onLayout={binding.onLayout} testID="details">
      <Text testID="details-state">{binding.hidden ? 'hidden' : 'shown'}</Text>
    </View>
  );
}

function Harness({ details }: { details: boolean }) {
  return (
    <ProgressiveFocusTransitionProvider>
      <Capture />
      {details ? <DetailsPlace /> : null}
    </ProgressiveFocusTransitionProvider>
  );
}

function answerMeasure(testID: string, rect: [number, number, number, number]) {
  const node = screen.getByTestId(testID, { includeHiddenElements: true });
  ((node.parent?.instance ?? node.instance).measureInWindow as jest.Mock)
    .mockImplementation((callback: (...values: number[]) => void) => callback(...rect));
}

/** The first flight measures the overlay; later ones reuse that origin and take over on mount. */
function mountCopy() {
  if (!screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })) return;
  answerMeasure('v2-anchor-transition-layer', [0, 0, 400, 800]);
  fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
}

beforeEach(() => {
  mockReduceMotion = false;
  jest.useFakeTimers();
  deferAnimationCallbacks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Home <-> Details flight', () => {
  it.each([false, true])('changes route at once and never fades a screen (reduce motion: %s)', (reduce) => {
    mockReduceMotion = reduce;
    const { rerender } = render(<Harness details={false} />);

    const openNavigate = jest.fn();
    act(() => {
      api.openAnchor(anchor, { x: 100, y: 200, width: 186, height: 186 }, { x: 80, y: 120, width: 220, height: 220 }, openNavigate);
    });
    mountCopy();
    // Home stays fully drawn: nothing drives a source fade.
    expect(api.exitProgress.value).toBe(0);
    act(() => { jest.advanceTimersByTime(0); });
    expect(openNavigate).toHaveBeenCalledTimes(1);
    expect(api.exitProgress.value).toBe(0);

    rerender(<Harness details />);
    answerMeasure('details', [80, 120, 220, 220]);
    fireEvent(screen.getByTestId('details', { includeHiddenElements: true }), 'layout');
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();

    const closeNavigate = jest.fn();
    let accepted = false;
    act(() => { accepted = api.closeAnchor('a', closeNavigate); });
    expect(accepted).toBe(true);
    mountCopy();
    act(() => { jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.back.navigateAtMs); });
    // Details is removed in the spring's still tail, uncovering a fully drawn Home; nothing fades either screen.
    expect(closeNavigate).toHaveBeenCalledTimes(1);
    expect(api.exitProgress.value).toBe(0);
  });
});
