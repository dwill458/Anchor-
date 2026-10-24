import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { deferAnimationCallbacks } from '@/__tests__/mocks/timedAnimationCallbacks';
import {
  ANCHOR_TRANSITION_TIMING,
  ProgressiveFocusTransitionProvider,
  useAnchorTransitionPlace,
  useProgressiveFocusTransition,
  type AnchorTransitionPlace,
} from '../ProgressiveFocusTransition';

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

const anchorA = {
  id: 'anchor-a',
  localId: 'local-a',
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1 L9 9"/></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: 'https://example.com/artwork-a.png',
  category: 'career',
  classifierMeta: undefined,
} as never;

type Api = ReturnType<typeof useProgressiveFocusTransition>;
let api: Api;
function Capture() {
  api = useProgressiveFocusTransition();
  return null;
}

function Place({
  place,
  anchorId = 'anchor-a',
  testID,
  enabled,
}: {
  place: AnchorTransitionPlace;
  anchorId?: string;
  testID: string;
  enabled?: boolean;
}) {
  const binding = useAnchorTransitionPlace(place, anchorId, 'paper', { enabled });
  return (
    <View ref={binding.ref} onLayout={binding.onLayout} testID={testID}>
      <Text testID={`${testID}-state`}>{binding.hidden ? 'hidden' : 'shown'}</Text>
    </View>
  );
}

/** The front carousel disc, plus an off-centre slot that must not claim Home's place. */
function Harness({ withOffSlot = false }: { withOffSlot?: boolean }) {
  return (
    <ProgressiveFocusTransitionProvider>
      <Capture />
      <Place place="details" testID="details-art" />
      <Place place="home" testID="home-art" />
      {withOffSlot ? <Place place="home" testID="home-offslot" enabled={false} /> : null}
    </ProgressiveFocusTransitionProvider>
  );
}

/** Installs a measureInWindow answer on the view, and returns the mock so calls can be counted. */
function answerMeasure(testID: string, rect: [number, number, number, number]) {
  const node = screen.getByTestId(testID, { includeHiddenElements: true });
  const inst = (node.parent as any)?.instance ?? node.instance;
  const measure = jest.fn((callback: (...values: number[]) => void) => callback(...rect));
  inst.measureInWindow = measure;
  return measure;
}

function mountCopy() {
  answerMeasure('v2-anchor-transition-layer', [0, 0, 400, 800]);
  fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
}

const stateOf = (testID: string) => screen.getByTestId(`${testID}-state`, { includeHiddenElements: true }).props.children;
const layerOf = () => screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true });

beforeEach(() => {
  mockReduceMotion = false;
  jest.useFakeTimers();
  deferAnimationCallbacks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Details -> Home reverse transition', () => {
  it('measures both ends when the return starts, then flies the Anchor home and reveals Home', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    const homeMeasure = answerMeasure('home-art', [120, 400, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);
    // Nothing is measured at rest: the return is the moment of truth.
    expect(homeMeasure).not.toHaveBeenCalled();

    let accepted = false;
    act(() => {
      accepted = api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate });
    });

    expect(accepted).toBe(true);
    expect(homeMeasure).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeTruthy();

    mountCopy();
    expect(layerOf()).toBeTruthy();
    // Both the departing Details artwork and Home's disc stand in for the copy.
    expect(stateOf('details-art')).toBe('hidden');
    expect(stateOf('home-art')).toBe('hidden');
    // The route pops in the spring's still tail (a cut, never a fade), so the pop cannot stall the flight.
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.back.navigateAtMs);
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(true);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(layerOf()).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    expect(stateOf('home-art')).toBe('shown');
    expect(stateOf('details-art')).toBe('shown');
  });

  it('uses Home where it is now, not where it was when last laid out', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('home-art', [120, 400, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    // Home scrolled (or re-rendered) after it last reported a layout.
    const moved = answerMeasure('home-art', [60, 470, 154, 154]);
    act(() => {
      api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate });
    });
    mountCopy();
    act(() => {
      jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.back.navigateAtMs);
    });

    expect(moved).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(true);
  });

  it('pops without a flight when Home is scrolled out of the window', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('home-art', [120, -600, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    act(() => {
      api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate });
    });

    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(layerOf()).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
  });

  it('navigates at once under Reduce Motion, with no copy', () => {
    mockReduceMotion = true;
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('home-art', [120, 400, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    let accepted = false;
    act(() => {
      accepted = api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate });
    });

    expect(accepted).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(layerOf()).toBeNull();
  });

  it('refuses a second return while one is in the air, and accepts again once it lands', () => {
    const first = jest.fn();
    const second = jest.fn();
    render(<Harness />);
    answerMeasure('home-art', [120, 400, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    let firstAccepted = false;
    let secondAccepted = true;
    act(() => {
      firstAccepted = api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate: first });
    });
    act(() => {
      secondAccepted = api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate: second });
    });

    expect(firstAccepted).toBe(true);
    expect(secondAccepted).toBe(false);
    expect(second).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    let thirdAccepted = false;
    act(() => {
      thirdAccepted = api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate: jest.fn() });
    });
    expect(thirdAccepted).toBe(true);
  });

  it('measures only the front Home disc, never an off-centre slot registered after it', () => {
    render(<Harness withOffSlot />);
    const frontMeasure = answerMeasure('home-art', [120, 400, 154, 154]);
    const offMeasure = answerMeasure('home-offslot', [-200, 400, 154, 154]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    act(() => {
      api.returnAnchor({ anchor: anchorA, from: 'details', to: 'home', onNavigate: jest.fn() });
    });

    expect(frontMeasure).toHaveBeenCalledTimes(1);
    expect(offMeasure).not.toHaveBeenCalled();
  });
});
