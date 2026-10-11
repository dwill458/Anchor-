import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { Skia } from '@shopify/react-native-skia';
import { ChartMap } from '../ChartMap';
import { useChartMapAnimState } from '../useChartMapAnimState';
import { buildRouteTable, OVERVIEW_CAMERA, waypointPlacement } from '../chartMapGeometry';
import { resetCloudTilesCache } from '../chartCloudTiles';
import { resetWeatherEffectCache } from '../ChartMapWeather';
import { COVER_SKSL } from '../chartMapShaders';
import { WEATHER_PARALLAX, weatherTransformFor } from '../useChartMapCamera';
import type { ChartMapMarker } from '../chartMapContracts';

const CAT = '#A64F68';

function makeMarkers(n: number, current: number): ChartMapMarker[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    index: i,
    number: i + 1,
    title: `Title ${i + 1}`,
    state: i < current ? 'done' : i === current ? 'current' : 'upcoming',
    selected: i === current,
    accessibilityLabel: `Waypoint ${i + 1}: Title ${i + 1}`,
  }));
}

function Harness({ weather, reducedMotion = false }: { weather?: 'static' | 'textured' | 'living'; reducedMotion?: boolean }) {
  const anim = useChartMapAnimState({ revealArc: 400, flagIndex: 1, closed: 1 });
  const table = React.useMemo(() => buildRouteTable(), []);
  const placement = React.useMemo(() => waypointPlacement(5), []);
  return (
    <ChartMap testID="map" width={390} table={table} placement={placement} anim={anim} markers={makeMarkers(5, 1)}
      categoryColor={CAT} reducedMotion={reducedMotion} arrived={false} clouds weather={weather}
      onMarkerPress={() => undefined} onMapPress={() => undefined} />
  );
}

const layersOpacity = (screen: ReturnType<typeof render>) =>
  (screen.getByTestId('map-layers').props as { jestAnimatedStyle?: { value?: { opacity?: number } } }).jestAnimatedStyle?.value?.opacity;
const shaderSources = (screen: ReturnType<typeof render>) =>
  screen.UNSAFE_queryAllByType('Shader' as never).map((node) => node.props.source);

async function settle(ms = 120) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(() => {
  resetCloudTilesCache();
  resetWeatherEffectCache();
  (Skia.RuntimeEffect.Make as jest.Mock).mockImplementation((src: string) => ({ __runtimeEffectStub: true, src }));
});
afterEach(() => {
  (Skia.RuntimeEffect.Make as jest.Mock).mockImplementation(() => ({ __runtimeEffectStub: true }));
});

describe('ChartMap living weather (permanent Chart)', () => {
  it('clouds first: nothing of the map is visible until the weather is drawn; closed cover holds its place', async () => {
    const screen = render(<Harness weather="living" />);
    expect(layersOpacity(screen)).toBe(0);
    await waitFor(() => expect(screen.getByTestId('map-veil', { includeHiddenElements: true })).toBeTruthy());
    expect(layersOpacity(screen)).toBe(0);
    // The veil only stands in while the map is hidden: gone means the map is visible (the fog field builds first).
    await waitFor(() => expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull(), { timeout: 8000 });
    // The weather is its own masked layer; the land no longer draws the static cloud shader.
    const sources = shaderSources(screen).map((source: { src?: string }) => source?.src);
    expect(sources).toContain(COVER_SKSL);
    expect(sources.some((src: string | undefined) => src?.includes('float billow = fbm'))).toBe(false);
    screen.unmount();
  });

  it('waypoints beyond the next show only as faint, untappable, unlabelled rings under the weather', async () => {
    const screen = render(<Harness weather="living" />);
    await settle();
    expect(screen.getByTestId('chart-map-ghost', { includeHiddenElements: true })).toBeTruthy();
    for (const i of [3, 4]) {
      const ring = screen.getByTestId(`chart-map-faint-${i}`, { includeHiddenElements: true });
      expect(ring.props.accessibilityElementsHidden).toBe(true);
      expect(ring.props.pointerEvents).toBe('none');
      expect(ring.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 0.18 })]));
    }
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryAllByLabelText(/Title [345]/)).toHaveLength(0);
    screen.unmount();
  });

  it('falls back to the static clouds when the weather cannot be built, and never stays hidden', async () => {
    (Skia.RuntimeEffect.Make as jest.Mock).mockImplementation((src: string) => (src === COVER_SKSL ? null : { __runtimeEffectStub: true, src }));
    const screen = render(<Harness weather="living" />);
    await settle();
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    const sources = shaderSources(screen).map((source: { src?: string }) => source?.src);
    expect(sources).not.toContain(COVER_SKSL);
    expect(sources.some((src: string | undefined) => src?.includes('float billow = fbm'))).toBe(true);
    screen.unmount();
  });
});

describe('ChartMap static weather (Home/Details crops, creation) is unchanged', () => {
  it('shows at once with the land cloud shader, no veil, no weather layer, no faint rings', async () => {
    const screen = render(<Harness />);
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    await settle();
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    const sources = shaderSources(screen).map((source: { src?: string }) => source?.src);
    expect(sources).not.toContain(COVER_SKSL);
    expect(sources.some((src: string | undefined) => src?.includes('float billow = fbm'))).toBe(true);
    expect(screen.queryByTestId('chart-map-faint-3', { includeHiddenElements: true })).toBeNull();
    screen.unmount();
  });
});

describe('ChartMap textured weather (read-only Home/Details crops)', () => {
  it('uses the sculpted tile compositor without the living-map veil or waypoint overlay changes', async () => {
    const screen = render(<Harness weather="textured" reducedMotion />);
    expect(screen.queryByTestId('map-veil', { includeHiddenElements: true })).toBeNull();
    await waitFor(() => {
      const sources = shaderSources(screen).map((source: { src?: string }) => source?.src);
      expect(sources).toContain(COVER_SKSL);
      expect(sources.some((src: string | undefined) => src?.includes('float billow = fbm'))).toBe(false);
    }, { timeout: 8000 });
    expect(screen.queryByTestId('chart-map-faint-3', { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    screen.unmount();
  });
});

describe('weather parallax', () => {
  it('matches the land exactly at overview, and responds 6% more as the camera pushes in', () => {
    const at = weatherTransformFor(OVERVIEW_CAMERA.cx, OVERVIEW_CAMERA.cy, 1, 390, 540);
    const k = 390 / 852;
    expect(at.scale).toBeCloseTo(k);
    const pushed = weatherTransformFor(405, 650, 1.5, 390, 540);
    expect(pushed.scale).toBeCloseTo(1.5 * (1 + 0.5 * WEATHER_PARALLAX) * k);
  });
});
