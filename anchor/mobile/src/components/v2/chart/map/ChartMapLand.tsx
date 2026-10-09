import type { ChartMapFrame } from './chartMapGeometry';
import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  ColorMatrix, FilterMode, FractalNoise, Group, Image as SkiaImage, ImageShader, MipmapMode, Paint, Rect, Shader,
  drawAsImage, useImage, Skia, type SkImage,
} from '@shopify/react-native-skia';
import { Image as NativeImage, PixelRatio } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { MAP_H, MAP_W, type ChartMapAnimState, type RouteTable } from './chartMapContracts';
import { packFogField, precomputeFogFieldAsync } from './chartMapGeometry';
import {
  CLOUD_SKSL, FOG_IMAGE_RECT, FOG_SKSL, TINT_SKSL, hexToVec3, makeEffect, routeCoordAt, splitFogField, uploadFogImage,
} from './chartMapShaders';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { loadCloudTiles } from './chartCloudTiles';
import { useChartIntroCameraTransform, useChartMapCameraTransform } from './useChartMapCamera';
import { getChartInkEffect, getChartSweepMaskEffect } from './chartInkShader';
import type { IntroSequenceProgress } from './chartMapSequences';

// 1704 x 2360 grayscale master, exactly 2x the 852 x 1180 design space.
const LANDSCAPE = require('@/../assets/chart/chart-landscape-master.webp');

const MAP_RECT = { x: 0, y: 0, width: MAP_W, height: MAP_H };
const SAMPLING_ART = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };
const SAMPLING_FOG = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

export type FogImages = { fieldDist: SkImage; fieldArc: SkImage; noise: SkImage };
const fogLoads = new WeakMap<RouteTable, Promise<FogImages | null>>();
let fogImagesCache: { table: RouteTable; images: FogImages | null } | null = null;

export function cachedFogImages(table: RouteTable): FogImages | null {
  return fogImagesCache && fogImagesCache.table === table ? fogImagesCache.images : null;
}

/** Built once per route (the field does not depend on N), off the render path. */
export async function loadFogImages(table: RouteTable): Promise<FogImages | null> {
  const hit = cachedFogImages(table);
  if (hit) return hit;
  const pending = fogLoads.get(table);
  if (pending) return pending;
  const loading = buildFogImages(table);
  fogLoads.set(table, loading);
  try { return await loading; } finally { fogLoads.delete(table); }
}

async function buildFogImages(table: RouteTable): Promise<FogImages | null> {
  const field = await precomputeFogFieldAsync(table);
  const { fieldRGBA, noiseRGBA } = packFogField(field);
  const bytes = splitFogField(fieldRGBA, noiseRGBA);
  const fieldDist = uploadFogImage(bytes.fieldDist);
  const fieldArc = uploadFogImage(bytes.fieldArc);
  const noise = uploadFogImage(bytes.noise);
  const images = fieldDist && fieldArc && noise ? { fieldDist, fieldArc, noise } : null;
  fogImagesCache = { table, images };
  return images;
}

let landscapeImageCache: SkImage | null = null;
let landscapeLoad: Promise<SkImage | null> | null = null;
let tintEffectCache: ReturnType<typeof makeEffect> | undefined;
let fogEffectCache: ReturnType<typeof makeEffect> | undefined;
function getTintEffect(): ReturnType<typeof makeEffect> {
  if (tintEffectCache === undefined) tintEffectCache = makeEffect(TINT_SKSL);
  return tintEffectCache;
}
function getFogEffect(): ReturnType<typeof makeEffect> {
  if (fogEffectCache === undefined) fogEffectCache = makeEffect(FOG_SKSL);
  return fogEffectCache;
}
const grainImages = new Map<string, SkImage>();
const grainLoads = new Map<string, Promise<SkImage | null>>();
const grainKey = (width: number, height: number) => `${width}:${height}:${Math.min(PixelRatio.get(), 2)}`;

function loadLandscape(): Promise<SkImage | null> {
  if (landscapeImageCache) return Promise.resolve(landscapeImageCache);
  if (landscapeLoad) return landscapeLoad;
  landscapeLoad = Promise.resolve().then(async () => {
    const source = NativeImage.resolveAssetSource(LANDSCAPE);
    const data = await Skia.Data.fromURI(source.uri);
    landscapeImageCache = Skia.Image.MakeImageFromEncoded(data);
    return landscapeImageCache;
  }).finally(() => { landscapeLoad = null; });
  return landscapeLoad;
}

/** Resolve the one decoded landscape resource required before the intro's first visible frame. */
export async function prepareChartMapIntroArt(table?: RouteTable, width?: number, height?: number): Promise<boolean> {
  try {
    const image = await loadLandscape();
    // Compile the synchronous SkSL dependencies before the intro's first visible frame too.
    const tintEffect = getTintEffect();
    const inkEffect = getChartInkEffect();
    getFogEffect();
    getChartSweepMaskEffect();
    // The full-land stack is drawn under the intro's sweep mask.
    // Warm its CPU-built fog field and grain image in the parent's paper hold,
    // outside the time-critical intro sequence.
    if (table && width !== undefined && height !== undefined) {
      await Promise.allSettled([
        loadFogImages(table),
        loadGrain(width, height),
      ]);
    }
    return image !== null && tintEffect !== null && inkEffect !== null;
  } catch {
    return false;
  }
}

function loadGrain(width: number, height: number): Promise<SkImage | null> {
  const key = grainKey(width, height);
  const hit = grainImages.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = grainLoads.get(key);
  if (pending) return pending;
  const ratio = Math.min(PixelRatio.get(), 2);
  const loading = drawAsImage(<Group transform={[{ scale: ratio }]}><ChartMapGrain width={width} height={height} /></Group>, {
    width: Math.round(width * ratio), height: Math.round(height * ratio),
  }).then(image => {
    if (image) {
      // Keep only recent viewport sizes; mounted maps retain their own image reference.
      if (grainImages.size >= 6) {
        const oldest = grainImages.keys().next().value;
        if (oldest !== undefined) grainImages.delete(oldest);
      }
      grainImages.set(key, image);
    }
    return image;
  }).finally(() => { grainLoads.delete(key); });
  grainLoads.set(key, loading);
  return loading;
}

/** Start at creation mount; all resources (art, fog field, grain, cloud tiles) survive the permanent Chart mount. */
export function warmChartMapResources(table: RouteTable, width: number, height: number): void {
  void Promise.allSettled([loadLandscape(), loadFogImages(table), loadGrain(width, height), loadCloudTiles()]);
}

export function hasDecodedChartLandscape(): boolean { return landscapeImageCache !== null; }

type Props = {
  frame?: ChartMapFrame;
  width: number;
  height: number;
  anim: ChartMapAnimState;
  table: RouteTable;
  categoryColor: string;
  reducedMotion?: boolean;
  /** Fog of war: dense cloud over undiscovered ground. Off for surfaces that show the bare map (intro). */
  clouds?: boolean;
  introProgress?: IntroSequenceProgress;
  /** Keep the settled land/fog stack out of the animated intro ink pass. */
  introBaseVisible?: boolean;
  /** Intro uses distinct fixed-resolution canvases for base art and the ink sweep. */
  introPass?: 'base' | 'ink';
  onArtReady?: (ready: boolean) => void;
};

/**
 * Land layer (inside a Skia Canvas): paper, faint pencil art, then the ink art
 * masked by the fog shader, then grain. Redraws only when revealArc, fog or the
 * camera move; the flag sway lives on the separate overlay canvas.
 */
export const ChartMapLand = memo(function ChartMapLand({ width, height, anim, table, categoryColor, reducedMotion = false, clouds = false, introProgress, introBaseVisible, introPass, onArtReady, frame }: Props) {
  const drawBaseLand = introPass !== 'ink' && (!introProgress || introBaseVisible !== false);
  const drawIntroInk = introPass !== 'base' && Boolean(introProgress);
  const decodedImage = useImage(landscapeImageCache ? null : LANDSCAPE);
  const [warmedImage, setWarmedImage] = useState<SkImage | null>(() => landscapeImageCache);
  const image = warmedImage ?? decodedImage;
  useEffect(() => {
    let alive = true;
    loadLandscape().then(value => { if (alive && value) setWarmedImage(value); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const tintEffect = useMemo(() => getTintEffect(), []);
  const fogEffect = useMemo(() => getFogEffect(), []);
  const cloudEffect = useMemo(() => (clouds ? makeEffect(CLOUD_SKSL) : null), [clouds]);
  // First frames render faint-only; the ink layer appears when the field is ready.
  const [fogImages, setFogImages] = useState<FogImages | null>(() => cachedFogImages(table));
  useEffect(() => {
    if (!drawBaseLand) return undefined;
    if (!fogEffect) return undefined;
    let alive = true;
    loadFogImages(table)
      .then(images => { if (alive) setFogImages(images); })
      .catch(error => { if (__DEV__) console.warn('[chart-map] fog field failed', error); });
    return () => { alive = false; };
  }, [drawBaseLand, fogEffect, table]);
  // Ink fades in over 300 ms once the fog images resolve (instantly under reduced motion).
  const inkFade = useSharedValue(cachedFogImages(table) ? 1 : 0);
  useEffect(() => {
    if (!fogImages) return;
    inkFade.value = reducedMotion ? 1 : withTiming(1, { duration: 300 });
  }, [fogImages, reducedMotion, inkFade]);

  // Clouds roll in over a beat once the fog field is ready (instantly under reduced motion).
  const cloudFade = useSharedValue(0);
  useEffect(() => {
    const on = clouds && fogImages !== null;
    cloudFade.value = on ? (reducedMotion ? 1 : withTiming(1, { duration: 900 })) : 0;
  }, [clouds, fogImages, reducedMotion, cloudFade]);

  // Grain rendered once to an image; each land frame only draws it with multiply.
  // DEFERRED: grain was rendered anew for every mount; the viewport cache shares it across the handoff.
  const [grain, setGrain] = useState<SkImage | null>(() => grainImages.get(grainKey(width, height)) ?? null);
  useEffect(() => {
    if (!drawBaseLand) return undefined;
    let alive = true;
    loadGrain(width, height).then(value => { if (alive) setGrain(value); })
      .catch(error => { if (__DEV__) console.warn('[chart-map] grain render failed', error); });
    return () => { alive = false; };
  }, [drawBaseLand, width, height]);
  const cameraTransform = useChartMapCameraTransform(anim, width, height, frame);
  // The base canvas gets the sweep progress for its mask but its camera comes from the wrapper, so it is not applied twice.
  const introTransform = useChartIntroCameraTransform(introPass === 'base' ? undefined : introProgress?.cameraScale, width);
  const inkEffect = useMemo(() => introProgress ? getChartInkEffect() : null, [introProgress]);
  const sweepEffect = useMemo(() => introProgress ? getChartSweepMaskEffect() : null, [introProgress]);
  const introInkColor = useMemo(() => hexToVec3(CHART_MAP_TOKENS.ink), []);
  const introInkUniforms = useDerivedValue(() => ({
    size: [MAP_W, MAP_H],
    contourP: introProgress?.contour.value ?? 0,
    landSweepP: introProgress?.landSweep.value ?? 0,
    inkColor: introInkColor,
  }), [introInkColor, introProgress]);
  // The land (and the survey route, in the overlay) show only where the sweep has passed.
  const introSweepUniforms = useDerivedValue(() => ({
    size: [MAP_W, MAP_H],
    sweepP: introProgress?.landSweep.value ?? 1,
  }), [introProgress]);
  const introGrainSweepUniforms = useDerivedValue(() => ({
    size: [width, height],
    sweepP: introProgress?.landSweep.value ?? 1,
  }), [height, introProgress, width]);
  // Without the sweep shader the land cannot be masked; a plain opacity crossfade of the base is the safe fallback.
  const landOpacity = introProgress && !sweepEffect ? introProgress.landSweep : 1;

  const paper = useMemo(() => hexToVec3(CHART_MAP_TOKENS.paper), []);
  const cat = useMemo(() => hexToVec3(categoryColor), [categoryColor]);
  const faintUniforms = useMemo(() => ({ paper, cat, mode: 0 }), [paper, cat]);
  const inkUniforms = useMemo(() => ({ paper, cat, mode: 1 }), [paper, cat]);

  const { xs, ys, arcs, count, total } = table;
  const fogUniforms = useDerivedValue(() => {
    const reveal = anim.revealArc.value;
    // Prototype: tip = posAt(revealArc + 110) (posAt clamps to the route).
    const fa = reveal + 110;
    return {
      revealArc: reveal,
      fog: anim.fog.value,
      tip: [routeCoordAt(xs, arcs, count, fa), routeCoordAt(ys, arcs, count, fa)],
    };
  }, [total]);

  const cloudUniforms = useDerivedValue(() => ({ ...fogUniforms.value, paper }), [paper]);

  // Fallback when SkSL or the art is unavailable: paper only / faint only (no ink, no crash).
  const showArt = image !== null && image !== undefined && tintEffect !== null;
  const showInk = showArt && fogEffect !== null && fogImages !== null;
  useEffect(() => { onArtReady?.(showArt); }, [onArtReady, showArt]);

  return (
    <>
      <Group transform={introTransform}>
        <Group transform={cameraTransform}>
          {introPass !== 'ink' ? <Rect x={0} y={0} width={MAP_W} height={MAP_H} color={CHART_MAP_TOKENS.paper} /> : null}
          {drawBaseLand ? <Group layer={sweepEffect ? <Paint /> : undefined} opacity={landOpacity}>
            {showArt && tintEffect ? (
              <Rect x={0} y={0} width={MAP_W} height={MAP_H}>
                <Shader source={tintEffect} uniforms={faintUniforms}>
                  <ImageShader image={image} fit="cover" rect={MAP_RECT} sampling={SAMPLING_ART} />
                </Shader>
              </Rect>
            ) : null}
            {showInk && tintEffect && fogEffect && fogImages ? (
              <Group layer={<Paint />} opacity={inkFade}>
                <Rect x={0} y={0} width={MAP_W} height={MAP_H}>
                  <Shader source={tintEffect} uniforms={inkUniforms}>
                    <ImageShader image={image} fit="cover" rect={MAP_RECT} sampling={SAMPLING_ART} />
                  </Shader>
                </Rect>
                <Rect x={0} y={0} width={MAP_W} height={MAP_H} blendMode="dstIn">
                  <Shader source={fogEffect} uniforms={fogUniforms}>
                    <ImageShader image={fogImages.fieldDist} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                    <ImageShader image={fogImages.fieldArc} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                    <ImageShader image={fogImages.noise} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                  </Shader>
                </Rect>
              </Group>
            ) : null}
            {showInk && cloudEffect && fogImages ? (
              <Group opacity={cloudFade}>
                <Rect x={0} y={0} width={MAP_W} height={MAP_H}>
                  <Shader source={cloudEffect} uniforms={cloudUniforms}>
                    <ImageShader image={fogImages.fieldDist} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                    <ImageShader image={fogImages.fieldArc} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                    <ImageShader image={fogImages.noise} fit="fill" rect={FOG_IMAGE_RECT} sampling={SAMPLING_FOG} />
                  </Shader>
                </Rect>
              </Group>
            ) : null}
            {sweepEffect ? (
              <Rect x={0} y={0} width={MAP_W} height={MAP_H} blendMode="dstIn">
                <Shader source={sweepEffect} uniforms={introSweepUniforms} />
              </Rect>
            ) : null}
          </Group> : null}
          {drawIntroInk && introProgress && inkEffect && showArt && image ? (
            <Rect x={0} y={0} width={MAP_W} height={MAP_H}>
              <Shader source={inkEffect} uniforms={introInkUniforms}>
                <ImageShader image={image} fit="cover" rect={MAP_RECT} sampling={SAMPLING_ART} />
              </Shader>
            </Rect>
          ) : null}
        </Group>
      </Group>
      {grain && drawBaseLand ? (sweepEffect ? (
        // Grain sits in screen space, outside the camera group, so its mask uses the screen size.
        <Group layer={<Paint />} blendMode="multiply">
          <SkiaImage image={grain} x={0} y={0} width={width} height={height} fit="fill" />
          <Rect x={0} y={0} width={width} height={height} blendMode="dstIn">
            <Shader source={sweepEffect} uniforms={introGrainSweepUniforms} />
          </Rect>
        </Group>
      ) : (
        <SkiaImage image={grain} x={0} y={0} width={width} height={height} fit="fill" blendMode="multiply" opacity={landOpacity} />
      )) : null}
    </>
  );
});

/** Prototype .grain: fractalNoise .9, 2 octaves, colour (.45,.4,.32), alpha .22, at .5. */
const GRAIN_MATRIX = [0, 0, 0, 0, 0.45, 0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0.32, 0, 0, 0, 0.22, 0];

/**
 * Grain source in screen space (prototype .grain, fractalNoise .9, 2 octaves, alpha .22 at .5).
 * ChartMapLand renders this ONCE to an image (drawAsImage) and draws that with multiply, so the
 * noise shader never runs per frame.
 */
export const ChartMapGrain = memo(function ChartMapGrain({ width, height }: { width: number; height: number }) {
  return (
    <Rect x={0} y={0} width={width} height={height} opacity={0.5}>
      <FractalNoise freqX={0.9} freqY={0.9} octaves={2} seed={4} />
      <ColorMatrix matrix={GRAIN_MATRIX} />
    </Rect>
  );
});
