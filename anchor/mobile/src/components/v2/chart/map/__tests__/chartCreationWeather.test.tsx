import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Skia } from '@shopify/react-native-skia';
import { ChartMap } from '../ChartMap';
import { ChartMapWeather, weatherReadySync } from '../ChartMapWeather';
import { ChartGenerationStage } from '../../ChartGenerationStage';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { buildRouteTable, clampCamera, OVERVIEW_CAMERA, waypointPlacement } from '../chartMapGeometry';
import { loadCloudTiles } from '../chartCloudTiles';
import { loadFogImages } from '../ChartMapLand';
import { chartMapScreenTop, chartMapViewportHeight } from '../ChartWeatherHold';
import { peekChartWeatherHandoff, resetChartWeatherHandoff } from '../chartWeatherHandoff';
import { laterSequence, openSequence } from '../chartMapSequences';
import { CHART_FIRST_DRAW_HOLD_MS } from '../ChartMap';
import { CHART_MAP_TIMING } from '../../chartMotion';
import type { ChartMapAnimState, ChartMapMarker, SequenceStep } from '../chartMapContracts';
import type { ChartMarker } from '../../ChartLandscape';

const CAT = '#A64F68';
/** memo() components: the test renderer sees the inner function. */
const inner = (component: unknown) => ((component as { type?: unknown }).type ?? component) as React.ComponentType<any>;
const table = buildRouteTable();

function makeMarkers(n: number, current: number): ChartMapMarker[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`, index: i, number: i + 1, title: `Title ${i + 1}`,
    state: i < current ? 'done' : i === current ? 'current' : 'upcoming',
    selected: false, accessibilityLabel: `Waypoint ${i + 1}`,
  }));
}

function Harness({ clouds, continuous = false }: { clouds: boolean; continuous?: boolean }) {
  const anim = useChartMapAnimState({ revealArc: 300, flagIndex: 0 });
  const placement = React.useMemo(() => waypointPlacement(4), []);
  return (
    <ChartMap testID="map" width={390} table={table} placement={placement} anim={anim} markers={makeMarkers(4, 0)}
      categoryColor={CAT} reducedMotion={false} arrived={false} clouds={clouds} weather="living" continuous={continuous}
      onMarkerPress={() => undefined} onMapPress={() => undefined} />
  );
}

async function settle(ms = 120) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeAll(async () => {
  (Skia.RuntimeEffect.Make as jest.Mock).mockImplementation((src: string) => ({ __runtimeEffectStub: true, src }));
  await loadCloudTiles();
  await loadFogImages(table);
});
afterAll(() => {
  (Skia.RuntimeEffect.Make as jest.Mock).mockImplementation(() => ({ __runtimeEffectStub: true }));
});
beforeEach(() => resetChartWeatherHandoff());

describe('living weather in creation', () => {
  it('weather that switches on over a map already on screen rolls in over it: never a veil, never hidden', async () => {
    const screen = render(<Harness clouds={false} />);
    await settle();
    expect(screen.UNSAFE_queryAllByType(inner(ChartMapWeather))).toHaveLength(0);
    screen.rerender(<Harness clouds />);
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    const weather = screen.UNSAFE_getByType(inner(ChartMapWeather));
    expect(weather.props.fadeIn).toBe(true);
    await settle();
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    screen.unmount();
  });

  it('the stage map uses living weather once the route exists, surveys leg 1 without inking it, and records its cover', async () => {
    const markers: ChartMarker[] = [0, 1, 2].map((i) => ({
      id: `w${i}`, number: i + 1, title: `W${i + 1}`, state: i === 0 ? 'current' : 'upcoming', accessibilityLabel: `Waypoint ${i + 1}`,
    })) as unknown as ChartMarker[];
    const screen = render(
      <ChartGenerationStage width={390} height={700} markers={null} reducedMotion settled testID="stage" />
    );
    const before = screen.UNSAFE_getByType(inner(ChartMap));
    expect(before.props.weather).toBe('living');
    expect(before.props.clouds).toBe(false);
    expect(peekChartWeatherHandoff()).toBeNull();
    screen.rerender(<ChartGenerationStage width={390} height={700} markers={markers} reducedMotion settled testID="stage" />);
    expect(screen.UNSAFE_getByType(inner(ChartMap)).props.clouds).toBe(true);
    expect(peekChartWeatherHandoff()).toEqual({ coverArc: waypointPlacement(3).arcs[0] });
    // Route honesty: the plan is surveyed (cover + dotted route), never inked.
    const stageMap = screen.UNSAFE_getByType(inner(ChartMap));
    expect(stageMap.props.anim.revealArc.value).toBe(0);
    expect(stageMap.props.anim.coverArc.value).toBe(waypointPlacement(3).arcs[0]);
    await settle(500);
    screen.unmount();
  });
});

describe('reveal hand-off into the permanent Chart', () => {
  it('a continuing map with cached weather shows land and weather on its first frame, with no veil or fade', () => {
    expect(weatherReadySync(table)).toBe(true);
    const screen = render(<Harness clouds continuous />);
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    const weather = screen.UNSAFE_getByType(inner(ChartMapWeather));
    expect(weather.props.fadeIn).toBe(false);
    screen.unmount();
  });

  it('the instant open keeps the inherited cover, closed = 0, and never fades the map', () => {
    const sv = (value = 0) => ({ value }) as any;
    const anim = {
      camera: { cx: sv(426), cy: sv(590), s: sv(1) },
      revealArc: sv(), fog: sv(), mapOpacity: sv(1), flagIndex: sv(-1), flagDrop: sv(), flagOpacity: sv(),
      pulse: sv(1), stampIndex: sv(-1), stamp: sv(), glyph: sv(), goldDot: sv(), coverArc: sv(), closed: sv(1),
    } as unknown as ChartMapAnimState;
    const placement = waypointPlacement(4);
    const spec = openSequence({ anim, placement, revealTo: 0, currentIndex: 0, reducedMotion: true, coverTo: placement.arcs[0], fadeIn: false });
    const tweens = spec.steps.filter((s): s is Extract<SequenceStep, { kind: 'tween' }> => s.kind === 'tween');
    expect(tweens.find((s) => s.target === anim.mapOpacity)).toMatchObject({ duration: 0, to: 1 });
    expect(tweens.find((s) => s.target === anim.coverArc)).toMatchObject({ duration: 0, to: placement.arcs[0] });
    spec.steps.filter((s) => s.kind === 'call').forEach((s) => (s as any).run());
    expect(anim.closed.value).toBe(0);
    // Without a hand-off the cover simply follows the ink, and it never sits behind it.
    const plain = openSequence({ anim, placement, revealTo: 200, currentIndex: 0, reducedMotion: true, coverTo: 50 });
    expect(plain.steps.find((s) => s.kind === 'tween' && s.target === anim.coverArc)).toMatchObject({ to: 200 });
  });

  it('"Explore your Chart" rises to where the permanent Chart draws map y = 0 at overview', () => {
    for (const [w, h, top, bottom] of [[390, 844, 47, 34], [412, 915, 24, 48], [360, 640, 24, 0]]) {
      const viewH = chartMapViewportHeight(w, h, top, bottom);
// DEFERRED:       // ChartActiveView: map viewport at insets.top + 100, height = min(artH, max(240, h - insets - 360)) - 100.
// DEFERRED:       const mapHeight = Math.min((w * 1180) / 852, Math.max(240, h - top - bottom - 360));
// DEFERRED:       expect(viewH).toBeCloseTo(mapHeight - 100);
// DEFERRED:       const home = clampCamera(OVERVIEW_CAMERA.cx, OVERVIEW_CAMERA.cy, 1, w, viewH);
// DEFERRED:       expect(chartMapScreenTop(w, h, top, bottom)).toBeCloseTo(top + CHART_MAP_TOP + home.ty);
      expect(viewH).toBe(h);
      const artTop = top + 45;
      const home = clampCamera(OVERVIEW_CAMERA.cx, OVERVIEW_CAMERA.cy, 1, w, viewH, { mode: 'fullBleed', artTop });
      expect(chartMapScreenTop(w, h, top, bottom)).toBeCloseTo(home.ty);
      const creationPageY = top + 200;
      const exploreDelta = chartMapScreenTop(w, h, top, bottom) - creationPageY;
      expect(creationPageY + exploreDelta).toBeCloseTo(artTop);
      // The creation stage draws the full-height art at ty = 0, so the rise is exactly this top minus its own.
      expect(clampCamera(OVERVIEW_CAMERA.cx, OVERVIEW_CAMERA.cy, 1, w, (w * 1180) / 852).ty).toBeCloseTo(0);
    }
  });
});

describe('surveyed route', () => {
  function Survey({ weather }: { weather: 'static' | 'living' }) {
    const anim = useChartMapAnimState({ revealArc: 0, flagIndex: 0 });
    anim.coverArc.value = 600;
    const placement = React.useMemo(() => waypointPlacement(4), []);
    return (
      <ChartMap width={390} table={table} placement={placement} anim={anim} markers={makeMarkers(4, 0)}
        categoryColor={CAT} reducedMotion arrived={false} clouds weather={weather}
        onMarkerPress={() => undefined} onMapPress={() => undefined} />
    );
  }
  const dottedEnd = (screen: ReturnType<typeof render>) =>
    screen.UNSAFE_getAllByType('Path' as never).find((node) => node.props.opacity === 0.45)?.props.end.value;

  it('under living weather the dotted route reaches as far as the clouds have parted; ink stays at progress', async () => {
    const living = render(<Survey weather="living" />);
    await settle();
    expect(dottedEnd(living)).toBeCloseTo(600 / table.total);
    living.unmount();
    // Static clouds (Home/Details crops) keep the original rule: a little past the ink.
    const crop = render(<Survey weather="static" />);
    await settle();
    expect(dottedEnd(crop)).toBeCloseTo(140 / table.total);
    crop.unmount();
  });
});

describe('frame-one native veil', () => {
  function Fresh({ continuous = false, reduced = false, onShown }: { continuous?: boolean; reduced?: boolean; onShown?: () => void }) {
    const anim = useChartMapAnimState({ revealArc: 0, flagIndex: 0, closed: 1, camera: CHART_MAP_TIMING.open.startCamera });
    const placement = React.useMemo(() => waypointPlacement(4), []);
    return (
      <ChartMap testID="map" width={390} table={table} placement={placement} anim={anim} markers={makeMarkers(4, 0)}
        categoryColor={CAT} reducedMotion={reduced} arrived={false} clouds weather="living" continuous={continuous}
        onShown={onShown} onMarkerPress={() => undefined} onMapPress={() => undefined} />
    );
  }
  const veil = (screen: ReturnType<typeof render>) => screen.queryByTestId('map-native-veil', { includeHiddenElements: true });

  it('covers a new map with closed cloud cover from its first render until the map has drawn, then goes at once', async () => {
    const onShown = jest.fn();
    const screen = render(<Fresh onShown={onShown} />);
    // Frame one: the native veil is already there (no Skia canvas involved).
    expect(veil(screen)).toBeTruthy();
    await settle(CHART_FIRST_DRAW_HOLD_MS - 60);
    expect(veil(screen)).toBeTruthy();
    expect(onShown).not.toHaveBeenCalled();
    await settle(CHART_FIRST_DRAW_HOLD_MS + 200);
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(veil(screen)).toBeNull();
    screen.unmount();
  });

  it('a continuing map (the reveal) has no veil and is shown at once', async () => {
    const onShown = jest.fn();
    const screen = render(<Fresh continuous onShown={onShown} />);
    expect(veil(screen)).toBeNull();
    await settle(60);
    expect(onShown).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('Reduce Motion: the same veil, then a cross-fade (still present just after the map shows)', async () => {
    const onShown = jest.fn();
    const screen = render(<Fresh reduced onShown={onShown} />);
    expect(veil(screen)).toBeTruthy();
    for (let i = 0; i < 20 && onShown.mock.calls.length === 0; i++) await settle(20);
    expect(onShown).toHaveBeenCalled();
    expect(veil(screen)).toBeTruthy();
    await settle(400);
    expect(veil(screen)).toBeNull();
    screen.unmount();
  });

  it('a later visit opened under the veil parts the clouds and eases the camera home instead of jumping', () => {
    const sv = (value = 0) => ({ value }) as any;
    const anim = {
      camera: { cx: sv(405), cy: sv(650), s: sv(1.08) },
      revealArc: sv(), fog: sv(), mapOpacity: sv(1), flagIndex: sv(-1), flagDrop: sv(), flagOpacity: sv(),
      pulse: sv(1), stampIndex: sv(-1), stamp: sv(), glyph: sv(), goldDot: sv(), coverArc: sv(), closed: sv(1),
    } as unknown as ChartMapAnimState;
    const placement = waypointPlacement(4);
    const spec = laterSequence({ anim, placement, revealTo: 300, currentIndex: 0, reducedMotion: false, partFromClosed: true });
    spec.steps.filter((s) => s.kind === 'call' && s.at === 0).forEach((s) => (s as any).run());
    expect(anim.closed.value).toBe(1);
    expect(anim.camera.s.value).toBe(1.08);
    const tweens = spec.steps.filter((s): s is Extract<SequenceStep, { kind: 'tween' }> => s.kind === 'tween');
    expect(tweens.find((s) => s.target === anim.closed)).toMatchObject({ from: 1, to: 0, duration: CHART_MAP_TIMING.later.part, easing: 'settle' });
    expect(tweens.find((s) => s.target === anim.camera.s)).toMatchObject({ to: 1, duration: CHART_MAP_TIMING.later.part });
  });
});
