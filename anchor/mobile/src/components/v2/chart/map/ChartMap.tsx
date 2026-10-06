import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  MAP_H, MAP_W,
  type ChartMapAnimState, type ChartMapMarker, type RouteTable, type WaypointPlacement,
} from './chartMapContracts';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { ChartMapLand, hasDecodedChartLandscape } from './ChartMapLand';
import { ChartMapMarkers } from './ChartMapMarkers';
import { ChartMapOverlay } from './ChartMapOverlay';
import { ChartMapWeather, weatherReadySync, type WeatherState } from './ChartMapWeather';
import { ChartWeatherVeil, useCloudTiles } from './ChartWeatherHold';
import { useChartWeatherTransform } from './useChartMapCamera';
import { ChartWeatherNativeVeil } from './ChartWeatherNativeVeil';
import { CHART_MAP_REDUCED_FADE } from '../chartMotion';

/** Wait after the weather reports ready before the land shows (~2 frames for its first draw). */
const WEATHER_SETTLE_MS = 34;
/**
 * The native veil stays over a new map this long after the map can show, covering the Skia canvases' first draw
 * (each Canvas is an Android TextureView whose surface arrives a few frames after mount; measured on the S24 Ultra:
 * land and weather ~3-5 frames, overlay ~8).
 */
export const CHART_FIRST_DRAW_HOLD_MS = 150;

export type ChartMapProps = {
  width: number;
  height?: number;
  table: RouteTable;
  placement: WaypointPlacement;
  anim: ChartMapAnimState;
  markers: ChartMapMarker[];
  categoryColor: string;
  /** Category name (for AA-safe numeral colour); falls back to contrast-picking from categoryColor. */
  category?: string;
  /** false = static map: markers are non-pressable images. Default true. */
  interactive?: boolean;
  reducedMotion: boolean;
  arrived: boolean;
  /** Fog of war clouds over undiscovered ground (the permanent Chart and creation after mapping). */
  clouds?: boolean;
  /**
   * How the clouds are drawn. 'static' (default): the original cloud shader inside the land canvas
   * (Home/Details crops, creation). 'living': drifting, parallaxed weather on its own canvas, driven by
   * `anim.coverArc` / `anim.closed`, and nothing is visible until the weather is (the permanent Chart).
   */
  weather?: 'static' | 'living';
  /**
   * The map continues from another map already on screen (creation's reveal into the permanent Chart): when
   * the living weather is ready at mount it shows on the very first frame, with no clouds-first wait or veil.
   */
  continuous?: boolean;
  /**
   * Living weather: the map has drawn its first frame and the native frame-one veil is gone (or, under Reduce
   * Motion, is cross-fading). The open sequence starts here, so its own closed 1 -> 0 parts the clouds.
   */
  onShown?: () => void;
  onMarkerPress: (index: number) => void;
  onMapPress: () => void;
  testID?: string;
};

/**
 * The treasure map: land canvas + (living weather canvas) + overlay canvas + RN
 * marker layer, all under one camera derived from anim.camera. A tap anywhere
 * that is not a marker calls onMapPress. Height = width * MAP_H / MAP_W.
 */
export const ChartMap = memo(function ChartMap({
  width, height: viewportHeight, table, placement, anim, markers, categoryColor, category, interactive = true, reducedMotion, arrived, clouds = false, weather = 'static', continuous = false, onShown, onMarkerPress, onMapPress, testID,
}: ChartMapProps) {
  const height = viewportHeight ?? (width * MAP_H) / MAP_W;
  const [artReady, setArtReady] = useState(hasDecodedChartLandscape);
  const onArtReady = useCallback((ready: boolean) => setArtReady(ready), []);

  const living = clouds && weather === 'living';
  // A continuing map whose weather is already cached draws land and weather together on frame one.
  const [readyAtMount] = useState(() => continuous && living && weatherReadySync(table));
  const [weatherState, setWeatherState] = useState<WeatherState | null>(readyAtMount ? 'ready' : null);
  // Clouds-first: the weather canvas draws its first frame a beat after it reports ready, so the land waits
  // about two more frames. Uncharted ground is never on screen without its cover.
  const [weatherShown, setWeatherShown] = useState(readyAtMount);
  // Living weather that switches on after the map is already showing (creation, once the route exists) never
  // hides the map: it rolls in over it instead.
  const [shownBare, setShownBare] = useState(false);
  useEffect(() => {
    if (artReady && !living) setShownBare(true);
  }, [artReady, living]);
  useEffect(() => {
    if (!living || weatherState === null || weatherShown) return undefined;
    if (weatherState === 'failed') {
      setWeatherShown(true);
      return undefined;
    }
    const timer = setTimeout(() => setWeatherShown(true), WEATHER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [living, weatherState, weatherShown]);
  const onWeatherState = useCallback((state: WeatherState) => setWeatherState(state), []);
  // If the living weather cannot be built, the land falls back to the static cloud shader.
  const livingActive = living && weatherState !== 'failed';
  const landClouds = clouds && !livingActive;

  // One visibility gate covers land, weather, route, flag, and native markers. Overlay and markers mount with
  // the art (screen readers and taps keep working); with living weather they stay at opacity 0 until it shows.
  const visible = artReady && (!living || weatherShown || shownBare);
  const fade = useAnimatedStyle(() => ({ opacity: visible ? anim.mapOpacity.value : 0 }));
  // Until the map is visible, living weather holds closed cover in its place (the ChartWeatherHold look).
  const tiles = useCloudTiles(living);
  const weatherTransform = useChartWeatherTransform(anim, width, height);
  // DEFERRED: const veil = living && !visible && tiles;
  const veil = living && !visible && tiles && !shownBare && anim.closed.value >= 1;

  // Frame one of a new living-weather map: closed cover drawn by NATIVE views (a Skia veil would be blank for the
  // same frames as the map). It holds until the map has drawn, then goes with no fade: the map underneath shows the
  // same closed cover. Reduce Motion: a 180 ms cross-fade. A continuing map (creation's reveal) needs none.
  const nativeVeil = living && !continuous && !shownBare;
  const [mountCamera] = useState(() => ({ cx: anim.camera.cx.value, cy: anim.camera.cy.value, s: anim.camera.s.value }));
  const [shown, setShown] = useState(false);
  const [veilGone, setVeilGone] = useState(!nativeVeil);
  const veilOpacity = useSharedValue(1);
  useEffect(() => {
    if (shown || !visible) return undefined;
    if (!nativeVeil) {
      setShown(true);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), CHART_FIRST_DRAW_HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible, shown, nativeVeil]);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;
  useEffect(() => {
    if (!shown) return undefined;
    onShownRef.current?.();
    if (veilGone) return undefined;
    if (!reducedMotion) {
      setVeilGone(true);
      return undefined;
    }
    veilOpacity.value = withTiming(0, { duration: CHART_MAP_REDUCED_FADE, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    const timer = setTimeout(() => setVeilGone(true), CHART_MAP_REDUCED_FADE);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veilOpacity.value }));

  return (
    <View testID={testID} style={[styles.root, { width, height }]}>
      {veil ? (
        <View testID={testID ? `${testID}-veil` : 'chart-map-veil'} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ChartWeatherVeil width={width} height={height} tiles={tiles} transform={weatherTransform} reducedMotion={reducedMotion} />
        </View>
      ) : null}
      <Animated.View testID={testID ? `${testID}-layers` : undefined} style={[StyleSheet.absoluteFill, fade]}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Canvas style={{ width, height }}>
            <ChartMapLand width={width} height={height} anim={anim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} clouds={landClouds} onArtReady={onArtReady} />
          </Canvas>
        </View>
        {livingActive ? (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Canvas style={{ width, height }}>
              <ChartMapWeather
                width={width}
                height={height}
                anim={anim}
                table={table}
                placement={placement}
                currentIndex={markers.find(marker => marker.state === 'current')?.index ?? -1}
                reducedMotion={reducedMotion}
                arrived={arrived}
                onWeatherState={onWeatherState}
                fadeIn={shownBare}
              />
            </Canvas>
          </View>
        ) : null}
        {/* DEFERRED: separate static grain canvas (normal blend); grain is now a cached multiply image inside the land canvas. */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Canvas style={{ width, height }}>
            {artReady ? <ChartMapOverlay
              width={width}
              height={height}
              anim={anim}
              table={table}
              placement={placement}
              categoryColor={categoryColor}
              reducedMotion={reducedMotion}
              arrived={arrived}
              clouds={clouds}
              livingWeather={livingActive}
            /> : null}
          </Canvas>
        </View>
        <Pressable
          testID={testID ? `${testID}-surface` : 'chart-map-surface'}
          accessible={false}
          importantForAccessibility="no"
          onPress={onMapPress}
          style={StyleSheet.absoluteFill}
        />
        {artReady ? <ChartMapMarkers
          width={width}
          height={height}
          anim={anim}
          placement={placement}
          markers={markers}
          categoryColor={categoryColor}
          category={category}
          interactive={interactive}
          arrived={arrived}
          clouds={livingActive}
          onMarkerPress={onMarkerPress}
        /> : null}
      </Animated.View>
      {!veilGone ? (
        <Animated.View testID={testID ? `${testID}-native-veil` : 'chart-map-native-veil'} style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none">
          <ChartWeatherNativeVeil width={width} height={height} camera={mountCamera} />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
});
