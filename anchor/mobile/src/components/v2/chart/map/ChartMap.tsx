import type { ChartMapFrame } from './chartMapGeometry';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Animated, { Easing, ReduceMotion, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  MAP_H, MAP_W,
  type ChartMapAnimState, type ChartMapMarker, type ChartRouteRevision, type RouteTable, type WaypointPlacement,
} from './chartMapContracts';
import type { ChartAnchorArt } from '../ChartLandscape';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { ChartMapLand, hasDecodedChartLandscape } from './ChartMapLand';
import { ChartMapMarkers } from './ChartMapMarkers';
import { ChartMapOverlay } from './ChartMapOverlay';
import { ChartMapWeather, weatherReadySync, type WeatherState } from './ChartMapWeather';
import { ChartWeatherVeil, useCloudTiles } from './ChartWeatherHold';
import { chartIntroBaseLayerStyle, useChartWeatherTransform } from './useChartMapCamera';
import { ChartWeatherNativeVeil } from './ChartWeatherNativeVeil';
import { CHART_MAP_REDUCED_FADE } from '../chartMotion';
import type { IntroSequenceProgress } from './chartMapSequences';

/** Wait after the weather reports ready before the land shows (~2 frames for its first draw). */
const WEATHER_SETTLE_MS = 34;
/**
 * The native veil stays over a new map this long after the map can show, covering the Skia canvases' first draw
 * (each Canvas is an Android TextureView whose surface arrives a few frames after mount; measured on the S24 Ultra:
 * land and weather ~3-5 frames, overlay ~8).
 */
export const CHART_FIRST_DRAW_HOLD_MS = 150;
/** Avoid leaving an interactive Chart under its loading veil indefinitely. */
const CHART_RESOURCE_WAIT_MS = 8000;

export type ChartMapProps = {
  frame?: ChartMapFrame;
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
  /** Preview-only authoritative completion for cloud clearing; leaves the displayed route state untouched. */
  weatherComplete?: boolean;
  /** Fog of war clouds over undiscovered ground (the permanent Chart and creation after mapping). */
  clouds?: boolean;
  /**
   * How the clouds are drawn. 'static' (default): the original land shader. 'textured': the shared sculpted tile
   * compositor with a frozen phase for read-only crops. 'living': drifting, parallaxed weather on its own canvas,
   * driven by `anim.coverArc` / `anim.closed`, and nothing is visible until ready (the permanent Chart).
   */
  weather?: 'static' | 'textured' | 'living';
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
  /** Creation-only opening motion, driven by the existing Chart sequence runner. */
  introProgress?: IntroSequenceProgress;
  /** Delay the settled land/fog/grain layer until the intro's land crossfade. */
  introBaseVisible?: boolean;
  onMapArtReady?: (ready: boolean) => void;
  onIntroSurfaceSized?: () => void;
  /** Route revised (R1): the pen's pass and the settle into pencil. Absent: the route draws as ever. */
  revision?: ChartRouteRevision;
  /** The Anchor's real artwork, shown in a circle at the summit once the destination is reached (S1). Never redrawn. */
  summitArt?: ChartAnchorArt | null;
  /** The flag planted at the summit (S1) stays on screen once arrived. */
  plantedFlag?: boolean;
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
  width, height: viewportHeight, table, placement, anim, markers, categoryColor, category, interactive = true, reducedMotion, arrived, weatherComplete, clouds = false, weather = 'static', continuous = false, onShown, introProgress, introBaseVisible, onMapArtReady, onIntroSurfaceSized, revision, summitArt, plantedFlag, onMarkerPress, onMapPress, testID, frame,
}: ChartMapProps) {
  const height = viewportHeight ?? (width * MAP_H) / MAP_W;
  // The moving land shader is the expensive layer in the opening. Render this
  // single canvas at half linear resolution and let the native view upscale it;
  // route, copy and controls remain at full resolution in their own layers.
  const landResolutionScale = introProgress ? 0.5 : 1;
  const landWidth = width * landResolutionScale;
  const landHeight = height * landResolutionScale;
  const isIntro = introProgress !== undefined;
  const introBaseMode = useRef(isIntro);
  if (isIntro) introBaseMode.current = true;
  const baseCanvasSize = useSharedValue({ width: 0, height: 0 });
  const inkCanvasSize = useSharedValue({ width: 0, height: 0 });
  const [introSurfaceMeasured, setIntroSurfaceMeasured] = useState(false);
  // Skia forwards onSize through a Reanimated mapper tied to the native view.
  // Detach it after measurement while the prep cover is still up, before the
  // short-lived ink Canvas is removed at sequence completion.
  const markIntroSurfaceSized = useCallback(() => {
    setIntroSurfaceMeasured(true);
    onIntroSurfaceSized?.();
  }, [onIntroSurfaceSized]);
  useAnimatedReaction(
    () => isIntro && !introSurfaceMeasured &&
      baseCanvasSize.value.width > 0 && baseCanvasSize.value.height > 0 &&
      inkCanvasSize.value.width > 0 && inkCanvasSize.value.height > 0,
    (ready, previous) => { if (ready && !previous) runOnJS(markIntroSurfaceSized)(); },
    [isIntro, introSurfaceMeasured, markIntroSurfaceSized, width, height],
  );
  const [artReady, setArtReady] = useState(hasDecodedChartLandscape);
  const onArtReady = useCallback((ready: boolean) => {
    setArtReady(ready);
    onMapArtReady?.(ready);
  }, [onMapArtReady]);

  const textured = clouds && weather !== 'static';
  const living = textured && weather === 'living';
  // Read-only textured previews reveal the underlying engraved land to the same arc as the full Chart's cover.
  // The separate overlay continues to use `anim.revealArc`, preserving its existing preview route and markers.
  const landAnim = React.useMemo(() => weather === 'textured' ? { ...anim, revealArc: anim.coverArc } : anim, [anim, weather]);
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
  const texturedReady = textured && weatherState === 'ready';
  const landClouds = clouds && (weather === 'textured' ? !texturedReady : !livingActive);

  // One visibility gate covers land, weather, route, flag, and native markers. Overlay and markers mount with
  // the art (screen readers and taps keep working); with living weather they stay at opacity 0 until it shows.
  const [resourceWaitExpired, setResourceWaitExpired] = useState(false);
  useEffect(() => {
    if (!onShown || isIntro || resourceWaitExpired || (artReady && (!living || weatherShown || shownBare))) return undefined;
    const timer = setTimeout(() => {
      setResourceWaitExpired(true);
      // The existing static-cloud path works without the living weather resources.
      setWeatherState(current => current === null ? 'failed' : current);
    }, CHART_RESOURCE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [onShown, isIntro, resourceWaitExpired, artReady, living, weatherShown, shownBare]);
  const landAvailable = artReady || resourceWaitExpired;
  const visible = landAvailable && (!living || weatherShown || shownBare || resourceWaitExpired);
  const fade = useAnimatedStyle(() => ({ opacity: visible ? anim.mapOpacity.value : 0 }));
  // Until the map is visible, living weather holds closed cover in its place (the ChartWeatherHold look).
  const tiles = useCloudTiles(living);
  const weatherTransform = useChartWeatherTransform(anim, width, height, frame);
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
  const introBaseStyle = useAnimatedStyle(() => {
    if (!introProgress) return {};
    const land = introProgress.land.value;
    // The base layer is fully covered throughout the ink sweep. Do not send
    // camera transforms to the native wrapper until its first visible frame.
    if (land <= 0) return { opacity: 0 };
    return chartIntroBaseLayerStyle(width, introProgress.cameraScale.value, land);
  }, [introProgress, width]);

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
          {introBaseMode.current ? (
            <Animated.View testID={testID ? `${testID}-land-base-layer` : undefined} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.introBaseLayer, introBaseStyle]}>
              <Canvas testID={testID ? `${testID}-land-base-canvas` : undefined} onSize={isIntro && !introSurfaceMeasured ? baseCanvasSize : undefined} style={{ width, height }}>
                <ChartMapLand frame={frame} width={width} height={height} anim={landAnim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} clouds={landClouds} introPass="base" introProgress={introProgress} onArtReady={onArtReady} />
              </Canvas>
            </Animated.View>
          ) : (
            <Canvas testID={testID ? `${testID}-land-base-canvas` : undefined} style={{ width, height }}>
              <ChartMapLand frame={frame} width={width} height={height} anim={landAnim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} clouds={landClouds} onArtReady={onArtReady} />
            </Canvas>
          )}
          {isIntro ? (
            <Canvas testID={`${testID ?? 'chart-map'}-land-ink-canvas`} onSize={introSurfaceMeasured ? undefined : inkCanvasSize} style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: landWidth,
              height: landHeight,
              transformOrigin: 'top left',
              transform: [{ scale: 1 / landResolutionScale }],
            }}>
              <ChartMapLand frame={frame} width={landWidth} height={landHeight} anim={anim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} clouds={false} introPass="ink" introProgress={introProgress} />
            </Canvas>
          ) : null}
        </View>
        {textured && weatherState !== 'failed' ? (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Canvas style={{ width, height }}>
              <ChartMapWeather frame={frame}
                width={width}
                height={height}
                anim={anim}
                table={table}
                placement={placement}
                currentIndex={markers.find(marker => marker.state === 'current')?.index ?? -1}
                reducedMotion={reducedMotion}
                arrived={weatherComplete ?? arrived}
                onWeatherState={onWeatherState}
                fadeIn={shownBare}
                freezeDrift={weather === 'textured'}
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
            {landAvailable ? <ChartMapOverlay frame={frame}
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
              introProgress={introProgress}
              revision={revision}
              summitArtwork={Boolean(summitArt)}
              plantedFlag={plantedFlag}
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
        {landAvailable ? <ChartMapMarkers frame={frame}
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
          summitArt={summitArt}
          onMarkerPress={onMarkerPress}
        /> : null}
      </Animated.View>
      {!veilGone ? (
        <Animated.View testID={testID ? `${testID}-native-veil` : 'chart-map-native-veil'} style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none">
          <ChartWeatherNativeVeil frame={frame} width={width} height={height} camera={mountCamera} />
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
  introBaseLayer: { transformOrigin: 'top left' },
});
