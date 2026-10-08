import React from 'react';
import { render } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ChartMapOverlay } from '../ChartMapOverlay';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import type { IntroSequenceProgress } from '../chartMapSequences';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { useChartIntroCameraTransform } from '../useChartMapCamera';

jest.mock('react-native-reanimated', () => {
  const ReactActual = jest.requireActual('react') as typeof import('react');
  const actual = jest.requireActual('react-native-reanimated');
  return {
    ...actual,
    __esModule: true,
    useSharedValue: (initial: unknown) => ReactActual.useRef({ value: initial }).current,
    useDerivedValue: (updater: () => unknown) => {
      const value = ReactActual.useRef<{ value: unknown } | null>(null);
      const next = updater();
      if (value.current === null) value.current = { value: next };
      else value.current.value = next;
      return value.current;
    },
    cancelAnimation: jest.fn(),
    withRepeat: jest.fn((animation: unknown) => animation),
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    withTiming: (value: number) => value,
  };
});

const withRepeat = Reanimated.withRepeat as jest.Mock;
const cancelAnimation = Reanimated.cancelAnimation as jest.Mock;
const CATEGORY = '#A64F68';

function overlayProps(introProgress?: IntroSequenceProgress) {
  return {
    width: 393,
    height: 744,
    anim: {
      camera: { cx: { value: 426 }, cy: { value: 590 }, s: { value: 1 } },
      revealArc: { value: 0 }, fog: { value: 0 }, mapOpacity: { value: 1 },
      flagIndex: { value: 0 }, flagDrop: { value: 1 }, flagOpacity: { value: 1 },
      pulse: { value: 1 }, stampIndex: { value: -1 }, stamp: { value: 0 }, glyph: { value: 0 },
      goldDot: { value: 0 }, coverArc: { value: 0 }, closed: { value: 0 },
    } as any,
    table: buildRouteTable(),
    placement: waypointPlacement(5),
    categoryColor: CATEGORY,
    reducedMotion: false,
    arrived: false,
    introProgress,
  };
}

function IntroOverlay({
  intro,
  reducedMotion = false,
}: {
  intro: boolean;
  reducedMotion?: boolean;
}) {
  const anim = useChartMapAnimState({ revealArc: 0 });
  const table = React.useMemo(() => buildRouteTable(), []);
  const placement = React.useMemo(() => waypointPlacement(5), []);
  const progress = React.useMemo<IntroSequenceProgress>(() => ({
    contour: { value: 0 } as any,
    tone: { value: 0 } as any,
    route: { value: 0 } as any,
    copy: { value: 0 } as any,
    marker: { value: 0 } as any,
    continue: { value: 0 } as any,
    land: { value: 0 } as any,
    cameraScale: { value: 1.1 } as any,
  }), []);
  return <ChartMapOverlay {...overlayProps(intro ? progress : undefined)} anim={anim} table={table} placement={placement} reducedMotion={reducedMotion} />;
}

describe('ChartMapOverlay intro work', () => {
  beforeEach(() => {
    withRepeat.mockClear();
    cancelAnimation.mockClear();
  });

  it('does not start the perpetual flag sway during the intro, including reduced motion', () => {
    const normal = render(<IntroOverlay intro />);
    expect(withRepeat).not.toHaveBeenCalled();
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
    normal.unmount();

    cancelAnimation.mockClear();
    const reduced = render(<IntroOverlay intro reducedMotion />);
    expect(withRepeat).not.toHaveBeenCalled();
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
    reduced.unmount();
  });

  it('cancels legacy sway on intro entry and keeps it stopped after intro progress is removed', () => {
    const screen = render(<IntroOverlay intro={false} />);
    expect(withRepeat).toHaveBeenCalledTimes(1);
    expect(cancelAnimation).not.toHaveBeenCalled();

    screen.rerender(<IntroOverlay intro />);
    // Cleanup cancels the active legacy loop; the intro branch never starts a replacement.
    expect(withRepeat).toHaveBeenCalledTimes(1);
    expect(cancelAnimation).toHaveBeenCalledTimes(2);

    screen.rerender(<IntroOverlay intro={false} />);
    expect(withRepeat).toHaveBeenCalledTimes(1);
    expect(cancelAnimation).toHaveBeenCalledTimes(3);
    screen.unmount();
    expect(withRepeat).toHaveBeenCalledTimes(1);
    expect(cancelAnimation).toHaveBeenCalledTimes(3);
  });

  it('retains legacy sway and cancels it on cleanup when no intro ever occurred', () => {
    const legacy = render(<IntroOverlay intro={false} />);
    expect(withRepeat).toHaveBeenCalledTimes(1);
    legacy.unmount();
    expect(cancelAnimation).toHaveBeenCalledTimes(1);
  });

  it('holds the same identity camera while route is hidden, then uses the current scale on first exposure', () => {
    const scale = { value: 1.1 } as any;
    const route = { value: 0 } as any;
    const outputs: unknown[] = [];
    function CameraHarness({ onValue }: { onValue: (value: unknown) => void }) {
      const transform = useChartIntroCameraTransform(scale, 393, route);
      onValue(transform.value);
      return null;
    }

    const screen = render(<CameraHarness onValue={value => outputs.push(value)} />);
    const identity = outputs[outputs.length - 1];
    expect(identity).toEqual([{ translateX: 196.5 }, { scale: 1 }, { translateX: -196.5 }]);

    scale.value = 1.06;
    screen.rerender(<CameraHarness onValue={value => outputs.push(value)} />);
    expect(outputs[outputs.length - 1]).toBe(identity);

    route.value = 0.001;
    screen.rerender(<CameraHarness onValue={value => outputs.push(value)} />);
    expect(outputs[outputs.length - 1]).toEqual([
      { translateX: 196.5 }, { scale: 1.06 }, { translateX: -196.5 },
    ]);
    expect(outputs[outputs.length - 1]).not.toBe(identity);

    // Reduced motion and a completed early skip expose the same settled matrix.
    scale.value = 1;
    route.value = 1;
    screen.rerender(<CameraHarness onValue={value => outputs.push(value)} />);
    expect(outputs[outputs.length - 1]).toEqual([
      { translateX: 196.5 }, { scale: 1 }, { translateX: -196.5 },
    ]);
    screen.unmount();
  });
});
