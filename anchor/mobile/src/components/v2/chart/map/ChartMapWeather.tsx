import type { ChartMapFrame } from './chartMapGeometry';
import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { FilterMode, Group, ImageShader, MipmapMode, Paint, Rect, Shader } from '@shopify/react-native-skia';
import { NavigationContext } from '@react-navigation/native';
import { Easing, ReduceMotion, makeMutable, useDerivedValue, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { MAP_H, MAP_W, type ChartMapAnimState, type RouteTable, type WaypointPlacement } from './chartMapContracts';
import { CLOUD_TILE_SCALE, cachedCloudTiles, loadCloudTiles, type CloudTiles } from './chartCloudTiles';
import { cachedFogImages, loadFogImages, type FogImages } from './ChartMapLand';
import { COVER_SKSL, FOG_IMAGE_RECT, makeEffect, routeCoordAt } from './chartMapShaders';
import { useChartWeatherTransform } from './useChartMapCamera';

/** Weather extends this far past the map on every side, so parallax and drift never show its edge. */
export const WEATHER_PAD = 240;
const PAD_RECT = { x: -WEATHER_PAD, y: -WEATHER_PAD, width: MAP_W + WEATHER_PAD * 2, height: MAP_H + WEATHER_PAD * 2 };
const HAZE = 'rgba(233,229,221,0.92)';
const SAMPLING_TILE = { filter: FilterMode.Linear, mipmap: MipmapMode.None };
const SAMPLING_FOG = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

/** Drift speeds in map units per second (billows, near puffs, wisps slightly against them). */
export const WEATHER_DRIFT = {
  billows: { x: 6, y: 1.6 },
  near: { x: 9, y: 0.6 },
  wisps: { x: 14, y: -2.2 },
} as const;

export type WeatherState = 'ready' | 'failed';

/** Weather that arrives over a map already on screen (creation, once the route exists) rolls in over this. */
export const WEATHER_FADE_IN_MS = 900;

/** Shader compiled once per session; null when SkSL is unavailable (the host falls back to static clouds). */
let coverEffectCache: ReturnType<typeof makeEffect> | undefined;
function coverEffectOnce() {
  if (coverEffectCache === undefined) coverEffectCache = makeEffect(COVER_SKSL);
  return coverEffectCache;
}

/** True when the weather can draw on its very first frame: tiles, field and shader all exist already. */
export function weatherReadySync(table: RouteTable): boolean {
  return Boolean(cachedCloudTiles() && cachedFogImages(table) && coverEffectOnce());
}

/** Test helper: recompile the cover shader next time. */
export function resetWeatherEffectCache(): void {
  coverEffectCache = undefined;
}

type Props = {
  frame?: ChartMapFrame;
  width: number;
  height: number;
  anim: ChartMapAnimState;
  table: RouteTable;
  placement: WaypointPlacement;
  /** Waypoint the weather clears around (-1 = none). */
  currentIndex: number;
  reducedMotion: boolean;
  arrived: boolean;
  /** 'ready' once tiles, field and shader exist; 'failed' if any cannot be built (the host falls back). */
  onWeatherState?: (state: WeatherState) => void;
  /**
   * The map was already on screen without weather (creation, before the route existed): the weather rolls
   * in over WEATHER_FADE_IN_MS instead of appearing at once. Read at mount. Instant under Reduce Motion.
   */
  fadeIn?: boolean;
  /** Read-only previews keep the tile phase fixed even while a full Chart is mounted elsewhere. */
  freezeDrift?: boolean;
};

/** Pauses the drift while the screen is blurred. Safe outside a navigator (always focused). */
export function useScreenFocused(): boolean {
  // Module-constant guard (some test mocks of @react-navigation/native omit the context), so hook order is stable.
  const navigation = NavigationContext ? useContext(NavigationContext) : undefined;
  const [focused, setFocused] = useState(() => navigation?.isFocused?.() ?? true);
  useEffect(() => {
    if (!navigation) return undefined;
    setFocused(navigation.isFocused());
    const offFocus = navigation.addListener('focus', () => setFocused(true));
    const offBlur = navigation.addListener('blur', () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  return focused;
}

/** Wrap a drift offset into one tile period so the float never grows (map units). */
function wrap(v: number, period: number): number {
  'worklet';
  const m = v % period;
  return m < 0 ? m + period : m;
}

/**
 * One drift clock (seconds) for every weather surface, so the loading hold and
 * the map's weather show the same clouds in the same place across the hand-off.
 * Each frame callback advances it by the frame's own timestamp gap; two surfaces
 * ticking in the same frame see the same timestamp and advance it once.
 */
const weatherClock = makeMutable({ t: 0, last: -1 });

/** Current drift clock (seconds), read on the JS thread: the native frame-one veil lays its tiles out from it. */
export function weatherClockSeconds(): number {
  return weatherClock.value.t;
}

/** Drives the shared clock while `active` and the screen is focused. Static under Reduce Motion. */
export function useWeatherDrift(active: boolean): void {
  const focused = useScreenFocused();
  const drift = useFrameCallback((frame) => {
    const now = frame.timestamp;
    const clock = weatherClock.value;
    if (now <= clock.last) return;
    // Clamp long gaps (a resumed screen) so the weather never jumps.
    const dt = clock.last < 0 ? 0 : Math.min(now - clock.last, 50);
    weatherClock.value = { t: clock.t + dt / 1000, last: now };
  }, false);
  const on = active && focused;
  useEffect(() => {
    drift.setActive(on);
    if (!on) weatherClock.value = { t: weatherClock.value.t, last: -1 };
    return () => drift.setActive(false);
  }, [on, drift]);
}

function useTileTransform(layer: keyof typeof WEATHER_DRIFT, size: number, frozenAt?: number) {
  return useDerivedValue(() => {
    const t = frozenAt ?? weatherClock.value.t;
    const scale = CLOUD_TILE_SCALE[layer];
    const p = size * scale;
    return [
      { translateX: wrap(-WEATHER_DRIFT[layer].x * t, p) },
      { translateY: wrap(-WEATHER_DRIFT[layer].y * t, p) },
      { scale },
    ];
  });
}

/**
 * Dev lab only: weather layers dropped for the frame-rate fallback steps (CHART_PHASES_1_2 §8: drop the near-puff
 * layer, then the wisps). Production always draws all three. Read at mount; reopen the Chart after changing it.
 */
const devDroppedLayers = { near: false, wisps: false };
export function setWeatherLayersForDev(dropped: { near: boolean; wisps: boolean }): void {
  if (__DEV__) Object.assign(devDroppedLayers, dropped);
}
export function weatherLayersDroppedForDev(): { near: boolean; wisps: boolean } {
  return { ...devDroppedLayers };
}

/**
 * Haze plus the three drifting tiles over the padded map rect, in map space.
 * Shared by the map's weather (masked by COVER_SKSL) and the loading hold
 * (unmasked: closed weather).
 */
export function WeatherClouds({ tiles, frozenAt }: { tiles: CloudTiles; frozenAt?: number }) {
  const billows = useTileTransform('billows', 512, frozenAt);
  const near = useTileTransform('near', 384, frozenAt);
  const wisps = useTileTransform('wisps', 512, frozenAt);
  const [dropped] = useState(weatherLayersDroppedForDev);
  return (
    <>
      <Rect {...PAD_RECT} color={HAZE} />
      <Rect {...PAD_RECT}>
        <ImageShader image={tiles.billows} tx="repeat" ty="repeat" sampling={SAMPLING_TILE} transform={billows} />
      </Rect>
      {!dropped.near ? (
        <Rect {...PAD_RECT} opacity={0.9}>
          <ImageShader image={tiles.near} tx="repeat" ty="repeat" sampling={SAMPLING_TILE} transform={near} />
        </Rect>
      ) : null}
      {!dropped.wisps ? (
        <Rect {...PAD_RECT} opacity={0.8}>
          <ImageShader image={tiles.wisps} tx="repeat" ty="repeat" sampling={SAMPLING_TILE} transform={wisps} />
        </Rect>
      ) : null}
    </>
  );
}

/**
 * Living weather (inside its own Skia Canvas, between land and overlay): haze
 * plus three pre-rendered cloud tiles scrolling at their own drift, masked by
 * COVER_SKSL (dstIn). Per frame that is three image draws and one mask; the
 * land and ink shaders never re-run for the drift. Paper-derived colours only.
 */
export const ChartMapWeather = memo(function ChartMapWeather({
  width, height, anim, table, placement, currentIndex, reducedMotion, arrived, onWeatherState, fadeIn = false, freezeDrift = false, frame,
}: Props) {
  // DEFERRED: const coverEffect = useMemo(() => makeEffect(COVER_SKSL), []); (now compiled once per session)
  const coverEffect = useMemo(() => coverEffectOnce(), []);
  const [tiles, setTiles] = useState<CloudTiles | null>(() => cachedCloudTiles());
  const [fogImages, setFogImages] = useState<FogImages | null>(() => cachedFogImages(table));
  const [failed, setFailed] = useState(false);
  const [frozenAt] = useState(() => (freezeDrift ? weatherClockSeconds() : undefined));

  useEffect(() => {
    let alive = true;
    if (!tiles) {
      loadCloudTiles().then((value) => {
        if (!alive) return;
        if (value) setTiles(value);
        else setFailed(true);
      });
    }
    if (!fogImages) {
      loadFogImages(table)
        .then((value) => {
          if (!alive) return;
          if (value) setFogImages(value);
          else setFailed(true);
        })
        .catch(() => alive && setFailed(true));
    }
    return () => {
      alive = false;
    };
    // Each resource loads once; the caches are module-level.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const ready = Boolean(coverEffect && tiles && fogImages);
  const state: WeatherState | null = !coverEffect || failed ? 'failed' : ready ? 'ready' : null;
  useEffect(() => {
    if (state) onWeatherState?.(state);
  }, [state, onWeatherState]);

  useWeatherDrift(!reducedMotion && !freezeDrift && ready);

  // Late weather rolls in; weather present from the first frame (or Reduce Motion) is simply there.
  const opacity = useSharedValue(fadeIn && !reducedMotion ? 0 : 1);
  useEffect(() => {
    if (!ready || opacity.value >= 1) return;
    opacity.value = withTiming(1, { duration: WEATHER_FADE_IN_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }, [ready, opacity]);

  /* ---- cover mask uniforms ---- */
  const { xs, ys, arcs, count, total } = table;
  const current = useMemo<[number, number]>(() => {
    const p = !arrived && currentIndex >= 0 ? placement.points[currentIndex] : null;
    return p ? [p.x, p.y] : [-9999, -9999];
  }, [arrived, currentIndex, placement]);
  const coverUniforms = useDerivedValue(() => {
    const fa = anim.coverArc.value + 110;
    return {
      coverArc: anim.coverArc.value,
      fog: anim.fog.value,
      closed: anim.closed.value,
      tip: [routeCoordAt(xs, arcs, count, fa), routeCoordAt(ys, arcs, count, fa)],
      current,
      total,
    };
  }, [current, total]);

  const transform = useChartWeatherTransform(anim, width, height, frame);

  if (!ready || !coverEffect || !tiles || !fogImages) return null;
  return (
    <Group transform={transform} opacity={opacity}>
      <Group layer={<Paint />}>
        <WeatherClouds tiles={tiles} frozenAt={frozenAt} />
        <Rect {...PAD_RECT} blendMode="dstIn">
          <Shader source={coverEffect} uniforms={coverUniforms}>
            <ImageShader image={fogImages.fieldDist} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
            <ImageShader image={fogImages.fieldArc} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
            <ImageShader image={fogImages.noise} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
          </Shader>
        </Rect>
      </Group>
    </Group>
  );
});
