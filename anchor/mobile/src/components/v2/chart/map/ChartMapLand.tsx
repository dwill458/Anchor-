import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  ColorMatrix, FilterMode, FractalNoise, Group, Image as SkiaImage, ImageShader, MipmapMode, Paint, Rect, Shader,
  drawAsImage, useImage, type SkImage,
} from '@shopify/react-native-skia';
import { PixelRatio } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { MAP_H, MAP_W, type ChartMapAnimState, type RouteTable } from './chartMapContracts';
import { packFogField, precomputeFogFieldAsync } from './chartMapGeometry';
import {
  FOG_IMAGE_RECT, FOG_SKSL, TINT_SKSL, hexToVec3, makeEffect, routeCoordAt, splitFogField, uploadFogImage,
} from './chartMapShaders';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { useChartMapCameraTransform } from './useChartMapCamera';

// 1704 x 2360 grayscale master, exactly 2x the 852 x 1180 design space.
const LANDSCAPE = require('@/../assets/chart/chart-landscape-master.webp');

const MAP_RECT = { x: 0, y: 0, width: MAP_W, height: MAP_H };
const SAMPLING_ART = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };
const SAMPLING_FOG = { filter: FilterMode.Nearest, mipmap: MipmapMode.None };

type FogImages = { fieldDist: SkImage; fieldArc: SkImage; noise: SkImage };
let fogImagesCache: { table: RouteTable; images: FogImages | null } | null = null;

function cachedFogImages(table: RouteTable): FogImages | null {
  return fogImagesCache && fogImagesCache.table === table ? fogImagesCache.images : null;
}

/** Built once per route (the field does not depend on N), off the render path. */
async function loadFogImages(table: RouteTable): Promise<FogImages | null> {
  const hit = cachedFogImages(table);
  if (hit) return hit;
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

type Props = {
  width: number;
  height: number;
  anim: ChartMapAnimState;
  table: RouteTable;
  categoryColor: string;
  reducedMotion?: boolean;
};

/**
 * Land layer (inside a Skia Canvas): paper, faint pencil art, then the ink art
 * masked by the fog shader, then grain. Redraws only when revealArc, fog or the
 * camera move; the flag sway lives on the separate overlay canvas.
 */
export const ChartMapLand = memo(function ChartMapLand({ width, height, anim, table, categoryColor, reducedMotion = false }: Props) {
  const image = useImage(LANDSCAPE);
  const tintEffect = useMemo(() => makeEffect(TINT_SKSL), []);
  const fogEffect = useMemo(() => makeEffect(FOG_SKSL), []);
  // First frames render faint-only; the ink layer appears when the field is ready.
  const [fogImages, setFogImages] = useState<FogImages | null>(() => cachedFogImages(table));
  useEffect(() => {
    if (!fogEffect) return undefined;
    let alive = true;
    loadFogImages(table)
      .then(images => { if (alive) setFogImages(images); })
      .catch(error => { if (__DEV__) console.warn('[chart-map] fog field failed', error); });
    return () => { alive = false; };
  }, [fogEffect, table]);
  // Ink fades in over 300 ms once the fog images resolve (instantly under reduced motion).
  const inkFade = useSharedValue(cachedFogImages(table) ? 1 : 0);
  useEffect(() => {
    if (!fogImages) return;
    inkFade.value = reducedMotion ? 1 : withTiming(1, { duration: 300 });
  }, [fogImages, reducedMotion, inkFade]);

  // Grain rendered once to an image; each land frame only draws it with multiply.
  const [grain, setGrain] = useState<SkImage | null>(null);
  useEffect(() => {
    let alive = true;
    // drawAsImage draws the picture unscaled into the surface, so scale it up to
    // fill width*ratio. Ratio capped at 2: grain is texture, not detail.
    const ratio = Math.min(PixelRatio.get(), 2);
    drawAsImage(<Group transform={[{ scale: ratio }]}><ChartMapGrain width={width} height={height} /></Group>, {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio),
    })
      .then(img => { if (alive) setGrain(img); })
      .catch(error => { if (__DEV__) console.warn('[chart-map] grain render failed', error); });
    return () => { alive = false; };
  }, [width, height]);
  const cameraTransform = useChartMapCameraTransform(anim, width, height);

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

  // Fallback when SkSL or the art is unavailable: paper only / faint only (no ink, no crash).
  const showArt = image !== null && image !== undefined && tintEffect !== null;
  const showInk = showArt && fogEffect !== null && fogImages !== null;

  return (
    <>
      <Group transform={cameraTransform}>
        <Rect x={0} y={0} width={MAP_W} height={MAP_H} color={CHART_MAP_TOKENS.paper} />
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
      </Group>
      {grain ? (
        <SkiaImage image={grain} x={0} y={0} width={width} height={height} fit="fill" blendMode="multiply" />
      ) : null}
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
