import React from 'react';
import { Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  ANCHOR_TRANSITION_TIMING,
  AnchorTransitionScene,
  ProgressiveFocusTransitionProvider,
  useAnchorTransitionPlace,
  useProgressiveFocusTransition,
  type AnchorTransitionDestination,
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

const anchorB = {
  id: 'anchor-b',
  localId: 'local-b',
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M2 2 L8 8"/></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: 'https://example.com/artwork-b.png',
  category: 'health',
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
}: {
  place: AnchorTransitionDestination;
  anchorId?: string;
  testID: string;
}) {
  const binding = useAnchorTransitionPlace(place, anchorId, place === 'details' ? 'paper' : 'bare');
  return (
    <View ref={binding.ref} onLayout={binding.onLayout} testID={testID}>
      <Text testID={`${testID}-state`}>{binding.hidden ? 'hidden' : 'shown'}</Text>
    </View>
  );
}

function TestHarness({
  showProgress = false,
  progressAnchorId = 'anchor-a',
}: {
  showProgress?: boolean;
  progressAnchorId?: string;
}) {
  return (
    <ProgressiveFocusTransitionProvider>
      <Capture />
      <AnchorTransitionScene place="details">
        <Place place="details" anchorId="anchor-a" testID="details-art" />
      </AnchorTransitionScene>
      {showProgress ? (
        <AnchorTransitionScene place="progress">
          <Place place="progress" anchorId={progressAnchorId} testID="progress-art" />
        </AnchorTransitionScene>
      ) : null}
    </ProgressiveFocusTransitionProvider>
  );
}

function answerMeasure(testID: string, rect: [number, number, number, number]) {
  const node = screen.getByTestId(testID, { includeHiddenElements: true });
  const inst = (node.parent as any)?.instance ?? node.instance;
  inst.measureInWindow = (callback: (...values: number[]) => void) => callback(...rect);
}

function mountCopy() {
  answerMeasure('v2-anchor-transition-layer', [0, 0, 400, 800]);
  fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
}

const stateOf = (testID: string) => screen.getByTestId(`${testID}-state`, { includeHiddenElements: true }).props.children;

beforeEach(() => {
  mockReduceMotion = false;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Progress Shared-Element Transition', () => {
  it('orchestrates forward flight from Details to Progress gauge ring', () => {
    const onNavigate = jest.fn();
    const { rerender } = render(<TestHarness />);
    answerMeasure('details-art', [136, 120, 128, 128]);

    let accepted = false;
    act(() => {
      accepted = api.startAnchorTransition({
        anchor: anchorA,
        from: 'details',
        to: { target: 'progress' },
        onNavigate,
      });
    });

    expect(accepted).toBe(true);
    // Touch absorber lock is active
    expect(screen.getByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeTruthy();

    mountCopy();
    // Copy mounted on overlay, details artwork hidden
    expect(screen.getByTestId('v2-anchor-transition-copy', { includeHiddenElements: true })).toBeTruthy();
    expect(stateOf('details-art')).toBe('hidden');

    // Navigation dispatched
    act(() => {
      jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.progress.navigateAtMs);
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(true);

    // Progress mounts with artwork hidden while flight is active
    rerender(<TestHarness showProgress />);
    expect(stateOf('progress-art')).toBe('hidden');
    answerMeasure('progress-art', [24, 180, 104, 104]);
    fireEvent(screen.getByTestId('progress-art', { includeHiddenElements: true }), 'layout');

    // Watchdog / settlement finishes flight
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    // Both settled to shown
    expect(stateOf('details-art')).toBe('shown');
    expect(stateOf('progress-art')).toBe('shown');
  });

  it('orchestrates reverse return flight from Progress gauge ring back to Details', () => {
    const onNavigate = jest.fn();
    render(<TestHarness showProgress />);
    answerMeasure('progress-art', [24, 180, 104, 104]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    let accepted = false;
    act(() => {
      accepted = api.returnAnchor({
        anchor: anchorA,
        from: 'progress',
        to: 'details',
        onNavigate,
      });
    });

    expect(accepted).toBe(true);
    expect(screen.getByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeTruthy();

    mountCopy();
    expect(screen.getByTestId('v2-anchor-transition-copy', { includeHiddenElements: true })).toBeTruthy();
    // Progress artwork hidden while departing, Details artwork hidden while arriving
    expect(stateOf('progress-art')).toBe('hidden');
    expect(stateOf('details-art')).toBe('hidden');

    act(() => {
      jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.progressBack.navigateAtMs);
    });
    expect(onNavigate).toHaveBeenCalledWith(true);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
    expect(stateOf('details-art')).toBe('shown');
    expect(stateOf('progress-art')).toBe('shown');
  });

  it('refuses return flight and falls back when Progress changed to a different Anchor', () => {
    const onNavigate = jest.fn();
    // Render with Progress showing Anchor B while Details has Anchor A
    render(<TestHarness showProgress progressAnchorId="anchor-b" />);
    answerMeasure('progress-art', [24, 180, 104, 104]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    let accepted = false;
    act(() => {
      // Trying to return Anchor B to Details (which holds Anchor A)
      accepted = api.returnAnchor({
        anchor: anchorB,
        from: 'progress',
        to: 'details',
        onNavigate,
      });
    });

    // Successfully handled by immediately calling fallback without animating
    expect(accepted).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('falls back when source or destination is scrolled out of window', () => {
    const onNavigate = jest.fn();
    render(<TestHarness showProgress />);
    // Positioned at y: -500 (scrolled off top)
    answerMeasure('progress-art', [24, -500, 104, 104]);
    answerMeasure('details-art', [136, 120, 128, 128]);

    act(() => {
      api.returnAnchor({
        anchor: anchorA,
        from: 'progress',
        to: 'details',
        onNavigate,
      });
    });

    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('navigates immediately with route fallback under Reduce Motion', () => {
    mockReduceMotion = true;
    const onNavigate = jest.fn();
    render(<TestHarness showProgress />);
    answerMeasure('details-art', [136, 120, 128, 128]);
    answerMeasure('progress-art', [24, 180, 104, 104]);

    act(() => {
      api.startAnchorTransition({
        anchor: anchorA,
        from: 'details',
        to: { target: 'progress' },
        onNavigate,
      });
    });

    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();

    const onReturn = jest.fn();
    act(() => {
      api.returnAnchor({
        anchor: anchorA,
        from: 'progress',
        to: 'details',
        onNavigate: onReturn,
      });
    });

    expect(onReturn).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('orchestrates forward flight from Home hero carousel into Progress gauge ring', () => {
    const onNavigate = jest.fn();
    const { rerender } = render(<TestHarness />);
    const homeSourceRect = { x: 120, y: 150, width: 154, height: 154 };

    let accepted = false;
    act(() => {
      accepted = api.startAnchorTransition({
        anchor: anchorA,
        from: { rect: homeSourceRect, appearance: 'paper', place: 'home' },
        to: { target: 'progress', rect: { x: 45, y: 180, width: 104, height: 104 }, appearance: 'bare' },
        onNavigate,
      });
    });

    expect(accepted).toBe(true);
    expect(screen.getByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeTruthy();

    mountCopy();
    expect(screen.getByTestId('v2-anchor-transition-copy', { includeHiddenElements: true })).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.progress.navigateAtMs);
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(true);

    rerender(<TestHarness showProgress />);
    expect(stateOf('progress-art')).toBe('hidden');
    answerMeasure('progress-art', [45, 180, 104, 104]);
    fireEvent(screen.getByTestId('progress-art', { includeHiddenElements: true }), 'layout');

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    expect(stateOf('progress-art')).toBe('shown');
  });
});
