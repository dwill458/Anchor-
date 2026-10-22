import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';
import { CHART_MAP_TIMING } from '../chartMotion';
import { cachedCloudTiles, loadCloudTiles, type CloudTiles } from './chartCloudTiles';
import { buildRouteTable, clampCamera, OVERVIEW_CAMERA } from './chartMapGeometry';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { loadFogImages } from './ChartMapLand';
import { WeatherClouds, useWeatherDrift } from './ChartMapWeather';
import { weatherTransformFor } from './useChartMapCamera';
import { ChartWeatherVeilPrimer } from './ChartWeatherNativeVeil';

// DEFERRED: /** Space above the permanent Chart's map (ChartActiveView: insets.top + this). */
// DEFERRED: export const CHART_MAP_TOP = 100;
// DEFERRED:
// DEFERRED: /** The permanent Chart's map viewport height (same formula as ChartActiveView). */
// DEFERRED: export function chartMapViewportHeight(width: number, height: number, insetTop: number, insetBottom: number): number {
// DEFERRED:   const mapHeight = Math.min((width * 1180) / 852, Math.max(240, height - insetTop - insetBottom - 360));
// DEFERRED:   return mapHeight - CHART_MAP_TOP;
// DEFERRED: }
// DEFERRED:
// DEFERRED: /**
// DEFERRED:  * Window y of map-space y = 0 on the permanent Chart at overview: the viewport sits CHART_MAP_TOP below the
// DEFERRED:  * safe area and the camera centres the full-height art in it. Creation's "Explore your Chart" rises to this.
// DEFERRED:  */
// DEFERRED: export function chartMapScreenTop(width: number, height: number, insetTop: number, insetBottom: number): number {
// DEFERRED:   const viewH = chartMapViewportHeight(width, height, insetTop, insetBottom);
// DEFERRED:   const home = clampCamera(OVERVIEW_CAMERA.cx, OVERVIEW_CAMERA.cy, OVERVIEW_CAMERA.s, width, viewH);
// DEFERRED:   return insetTop + CHART_MAP_TOP + home.ty;
// DEFERRED: }
// DEFERRED:
/**
 * Space between the safe-area top and map-space y = 0 on the permanent Chart. The destination X (map y 112)
 * must sit at least 56dp below the header box (insetTop + 76). At overview the X lands at
 * artTop + 112 * (width / 852); with this offset it clears the header by about 67dp on a 360dp-wide phone
 * with a 48dp inset. Was 45 before the route reached the apex. Creation and the Chart share it via chartMapScreenTop.
 */
export const CHART_MAP_TOP = 96;

/** Permanent Chart fills the window; creation aligns map-space zero to this art top. */
export function chartMapViewportHeight(_width: number, height: number, _insetTop: number, _insetBottom: number): number {
  return height;
}
export function chartMapScreenTop(_width: number, _height: number, insetTop: number, _insetBottom: number): number {
  return insetTop + CHART_MAP_TOP;
}

type Transform = Array<{ translateX: number } | { translateY: number } | { scale: number }>;

/** Unmasked weather (closed cover) inside a Canvas: paper-derived haze and drifting tiles. */
export function ChartWeatherVeil({
  width, height, tiles, transform, reducedMotion,
}: {
  width: number;
  height: number;
  tiles: CloudTiles;
  transform: Transform | SharedValue<Transform>;
  reducedMotion: boolean;
}) {
  useWeatherDrift(!reducedMotion);
  return (
    <Canvas style={{ width, height }}>
      <Group transform={transform}>
        <WeatherClouds tiles={tiles} />
      </Group>
    </Canvas>
  );
}

/** Cloud tiles, from the session cache or built once (only when `enabled`). */
export function useCloudTiles(enabled = true): CloudTiles | null {
  const [tiles, setTiles] = useState<CloudTiles | null>(() => cachedCloudTiles());
  useEffect(() => {
    if (tiles || !enabled) return undefined;
    let alive = true;
    void loadCloudTiles().then((value) => {
      if (alive && value) setTiles(value);
    });
    return () => {
      alive = false;
    };
  }, [tiles, enabled]);
  return tiles;
}

/**
 * Loading state of the permanent Chart: closed weather, not a spinner. The map
 * paper and full cloud cover sit exactly where the map will be, framed by the
 * open's starting camera, so when the data lands the clouds simply part.
 * Also warms the fog field the map's weather needs.
 */
export function ChartWeatherHold({
  reducedMotion,
  header,
  accessibilityLabel,
  testID,
}: {
  reducedMotion: boolean;
  /** Header controls laid over the paper (back, title). */
  header?: React.ReactNode;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mapHeight = chartMapViewportHeight(width, height, insets.top, insets.bottom);
  const frame = useMemo(() => ({ mode: 'fullBleed' as const, artTop: chartMapScreenTop(width, height, insets.top, insets.bottom) }), [width, height, insets.top, insets.bottom]);
  const tiles = useCloudTiles();
  useEffect(() => {
    void loadFogImages(buildRouteTable()).catch(() => undefined);
  }, []);
  const transform = useMemo<Transform>(() => {
    const c = CHART_MAP_TIMING.open.startCamera;
    const w = weatherTransformFor(c.cx, c.cy, c.s, width, Math.max(1, mapHeight), frame);
    return [{ translateX: w.tx }, { translateY: w.ty }, { scale: w.scale }];
  }, [width, mapHeight, frame]);

  return (
    <View testID={testID} style={styles.screen}>
      <View
        style={[styles.map, { top: 0, width, height: Math.max(1, mapHeight) }]}
        pointerEvents="none"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: true }}
      >
        {tiles ? (
          <ChartWeatherVeil width={width} height={Math.max(1, mapHeight)} tiles={tiles} transform={transform} reducedMotion={reducedMotion} />
        ) : null}
      </View>
      {header}
      <ChartWeatherVeilPrimer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CHART_MAP_TOKENS.paper },
  map: { position: 'absolute', left: 0, overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
});
