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

const anchor = {
  id: 'a',
  localId: 'local-a',
  baseSigilSvg: '<svg viewBox="0 0 10 10"><path d="M1 1 L9 9"/></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: undefined,
  category: 'career',
  classifierMeta: undefined,
} as never;

type Api = ReturnType<typeof useProgressiveFocusTransition>;
let api: Api;
function Capture() {
  api = useProgressiveFocusTransition();
  return null;
}

function Place({ place, anchorId = 'a', testID }: { place: AnchorTransitionDestination; anchorId?: string; testID: string }) {
  const binding = useAnchorTransitionPlace(place, anchorId, 'paper');
  return (
    <View ref={binding.ref} onLayout={binding.onLayout} testID={testID}>
      <Text testID={`${testID}-state`}>{binding.hidden ? 'hidden' : 'shown'}</Text>
    </View>
  );
}

function Harness({ showDestination = false }: { showDestination?: boolean }) {
  return (
    <ProgressiveFocusTransitionProvider>
      <Capture />
      <AnchorTransitionScene place="practiceSetup">
        <Place place="practiceSetup" testID="source" />
      </AnchorTransitionScene>
      {showDestination ? (
        <AnchorTransitionScene place="focusSession">
          <Place place="focusSession" testID="destination" />
        </AnchorTransitionScene>
      ) : null}
    </ProgressiveFocusTransitionProvider>
  );
}

function answerMeasure(testID: string, rect: [number, number, number, number]) {
  const node = screen.getByTestId(testID, { includeHiddenElements: true });
  ((node.parent?.instance ?? node.instance).measureInWindow as jest.Mock)
    .mockImplementation((callback: (...values: number[]) => void) => callback(...rect));
}

function mountCopy() {
  answerMeasure('v2-anchor-transition-layer', [0, 0, 400, 800]);
  fireEvent(screen.getByTestId('v2-anchor-transition-layer', { includeHiddenElements: true }), 'layout');
}

const stateOf = (testID: string) => screen.getByTestId(`${testID}-state`, { includeHiddenElements: true }).props.children;

function start(onNavigate: jest.Mock, from: AnchorTransitionDestination = 'practiceSetup') {
  let accepted = false;
  act(() => {
    accepted = api.startAnchorTransition({
      anchor,
      from,
      to: { target: 'focusSession', rect: { x: 40, y: 260, width: 320, height: 320 } },
      onNavigate,
    });
  });
  return accepted;
}

beforeEach(() => {
  mockReduceMotion = false;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Anchor shared transition', () => {
  it('carries the Anchor from its place, mounts the destination beneath it, and owns the Anchor until it lands', () => {
    const onNavigate = jest.fn();
    const { rerender } = render(<Harness />);
    answerMeasure('source', [100, 400, 186, 186]);

    expect(start(onNavigate)).toBe(true);
    // Touches are absorbed and a second start (a repeated Begin) is refused.
    expect(screen.getByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeTruthy();
    expect(start(jest.fn())).toBe(false);

    mountCopy();
    expect(screen.getByTestId('v2-anchor-transition-copy', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('v2-anchor-transition-arrival', { includeHiddenElements: true })).toBeTruthy();
    // The real source artwork hides only once the copy stands in for it.
    expect(stateOf('source')).toBe('hidden');
    expect(onNavigate).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(ANCHOR_TRANSITION_TIMING.session.navigateAtMs); });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(true);

    // The destination mounts hidden: the copy is still in the air above it.
    rerender(<Harness showDestination />);
    expect(stateOf('destination')).toBe('hidden');
    answerMeasure('destination', [40, 240, 320, 320]);
    fireEvent(screen.getByTestId('destination', { includeHiddenElements: true }), 'layout');

    // Jest never advances Reanimated frames, so the watchdog ends the flight here.
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    expect(stateOf('source')).toBe('shown');
    expect(stateOf('destination')).toBe('shown');
    expect(onNavigate).toHaveBeenCalledTimes(1);

    // Released: the next hop may start.
    expect(start(jest.fn())).toBe(true);
  });

  it('never strands the person when the copy cannot mount: the watchdog navigates and clears', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('source', [100, 400, 186, 186]);
    start(onNavigate);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    expect(stateOf('source')).toBe('shown');
  });

  it('falls back to ordinary navigation when the source place is not registered', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    expect(start(onNavigate, 'details')).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('falls back when the source never answers its measurement', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    const node = screen.getByTestId('source', { includeHiddenElements: true });
    ((node.parent?.instance ?? node.instance).measureInWindow as jest.Mock).mockImplementation(() => undefined);
    start(onNavigate);
    expect(onNavigate).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(300); });
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-lock', { includeHiddenElements: true })).toBeNull();
  });

  it('falls back when the measured source is unusable', () => {
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('source', [0, 0, 0, 0]);
    start(onNavigate);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('only flies the Anchor a place was registered for', () => {
    const onNavigate = jest.fn();
    render(
      <ProgressiveFocusTransitionProvider>
        <Capture />
        <Place place="practiceSetup" anchorId="someone-else" testID="source" />
      </ProgressiveFocusTransitionProvider>,
    );
    answerMeasure('source', [100, 400, 186, 186]);
    start(onNavigate);
    expect(onNavigate).toHaveBeenCalledWith(false);
  });

  it('under Reduce Motion navigates at once with the route’s own transition', () => {
    mockReduceMotion = true;
    const onNavigate = jest.fn();
    render(<Harness />);
    answerMeasure('source', [100, 400, 186, 186]);
    expect(start(onNavigate)).toBe(true);
    expect(onNavigate).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toBeNull();
  });

  it('keeps one layer when providers nest, so a flight can leave one stack for another', () => {
    let inner: Api | null = null;
    function CaptureInner() {
      inner = useProgressiveFocusTransition();
      return null;
    }
    render(
      <ProgressiveFocusTransitionProvider>
        <Capture />
        <ProgressiveFocusTransitionProvider>
          <CaptureInner />
          <Place place="practiceSetup" testID="source" />
        </ProgressiveFocusTransitionProvider>
      </ProgressiveFocusTransitionProvider>,
    );
    expect(inner).toBe(api);
    answerMeasure('source', [100, 400, 186, 186]);
    start(jest.fn());
    expect(screen.getAllByTestId('v2-anchor-transition-layer', { includeHiddenElements: true })).toHaveLength(1);
  });
});
