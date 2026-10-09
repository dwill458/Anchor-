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
    landSweep: { value: 0 } as any,
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

describe('ChartMapOverlay route revision (R1) and summit flag (S1)', () => {
  const pencil = (screen: ReturnType<typeof render>) =>
    screen.UNSAFE_getAllByType('Path' as never).find((node) => node.props.strokeWidth === 4 && node.props.end !== undefined && node.props.children);
  const pen = (screen: ReturnType<typeof render>) =>
    screen.UNSAFE_getAllByType('Path' as never).find((node) => node.props.strokeWidth === 4.5 && node.props.start !== undefined);
  const value = (input: unknown) => (typeof input === 'number' ? input : (input as { value: number }).value);
  const revisionAt = (out: number, penValue: number, pencilValue: number) => ({ out: { value: out }, pen: { value: penValue }, pencil: { value: pencilValue } }) as any;

  it('draws exactly as before without a revision: the pencil route is a plain .45 and there is no pen pass', () => {
    const screen = render(<ChartMapOverlay {...overlayProps()} />);
    expect(pencil(screen)!.props.opacity).toBe(0.45);
    expect(pen(screen)).toBeUndefined();
    screen.unmount();
  });

  it('rests as the settled pencil route: pencil at .45, the pen stroke gone', () => {
    const screen = render(<ChartMapOverlay {...overlayProps()} revision={revisionAt(1, 1, 1)} />);
    expect(value(pencil(screen)!.props.opacity)).toBeCloseTo(0.45);
    expect(value(pen(screen)!.props.opacity)).toBeCloseTo(0);
    screen.unmount();
  });

  it('at the start of the scene the old pencil route is still there and the pen has drawn nothing', () => {
    const screen = render(<ChartMapOverlay {...overlayProps()} revision={revisionAt(0, 0, 0)} />);
    expect(value(pencil(screen)!.props.opacity)).toBeCloseTo(0.45);
    expect(value(pen(screen)!.props.end)).toBeCloseTo(value(pen(screen)!.props.start));
    screen.unmount();
  });

  it('mid-scene the old route has faded and the pen is half way along the route ahead, in ink, never as progress', () => {
    const screen = render(<ChartMapOverlay {...overlayProps()} revision={revisionAt(1, 0.5, 0)} />);
    expect(value(pencil(screen)!.props.opacity)).toBeCloseTo(0);
    expect(value(pen(screen)!.props.opacity)).toBeCloseTo(0.9);
    expect(value(pen(screen)!.props.end)).toBeCloseTo(0.5);
    screen.unmount();
  });

  it('plants the flag at the summit slot, higher than a waypoint flag, and pops it 1 -> 1.12 as it drops', () => {
    const props = overlayProps();
    const placement = props.placement;
    props.anim.flagIndex.value = placement.points.length;
    props.anim.flagDrop.value = 0.5;
    const screen = render(<ChartMapOverlay {...props} plantedFlag arrived />);
    const flag = screen.UNSAFE_getAllByType('Group' as never).find((node) => {
      const transform = node.props.transform?.value;
      return Array.isArray(transform) && transform.length === 3 && Math.abs(transform[0]?.translateX - placement.summit.x) < 0.01;
    });
    expect(flag).toBeDefined();
    const [x, y, scale] = flag!.props.transform.value;
    expect(x.translateX).toBeCloseTo(placement.summit.x, 1);
    expect(y.translateY).toBeCloseTo(placement.summit.y - 38 - 8, 1);
    expect(scale.scale).toBeCloseTo(1.12);
    screen.unmount();
  });

  it('a flag on a waypoint is unchanged: 30 above the marker, no pop', () => {
    const props = overlayProps();
    props.anim.flagIndex.value = 2;
    props.anim.flagDrop.value = 0.5;
    const screen = render(<ChartMapOverlay {...props} />);
    const flag = screen.UNSAFE_getAllByType('Group' as never).find((node) => {
      const transform = node.props.transform?.value;
      return Array.isArray(transform) && transform.length === 3 && Math.abs(transform[0]?.translateX - props.placement.points[2].x) < 0.01;
    });
    const [, y, scale] = flag!.props.transform.value;
    expect(y.translateY).toBeCloseTo(props.placement.points[2].y - 30 - 8, 1);
    expect(scale.scale).toBe(1);
    screen.unmount();
  });
});
