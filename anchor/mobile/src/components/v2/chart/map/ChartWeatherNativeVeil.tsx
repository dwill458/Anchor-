import type { ChartMapFrame } from './chartMapGeometry';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { CLOUD_TILE_PX, CLOUD_TILE_SCALE, cachedCloudTiles, cloudTileUris, loadCloudTiles, type CloudTileUris } from './chartCloudTiles';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { WEATHER_DRIFT, weatherClockSeconds, weatherLayersDroppedForDev } from './ChartMapWeather';
import { weatherTransformFor } from './useChartMapCamera';

/** Same haze as the Skia weather layer (ChartMapWeather HAZE). */
const HAZE = 'rgba(233,229,221,0.92)';
type Layer = { key: keyof typeof WEATHER_DRIFT; uri: string; px: number; scale: number; alpha: number };

const wrap = (v: number, period: number) => {
  const m = v % period;
  return m < 0 ? m + period : m;
};

/**
 * Closed cloud cover drawn with NATIVE views, for the map's first frames.
 *
 * Every Skia Canvas on Android is a TextureView whose surface arrives a few frames after mount, so a new map (and any
 * Skia veil) is bare paper for those frames. This veil is plain RN Images of the exact weather tiles, laid out with
 * the weather's own camera maths (weatherTransformFor) and the shared drift clock, so it matches the closed Skia
 * weather pixel for pixel and the host can drop it with no fade. With the tiles primed (ChartWeatherVeilPrimer) the
 * bitmaps are already decoded and draw on frame one; before that it is the haze alone.
 */
export const ChartWeatherNativeVeil = memo(function ChartWeatherNativeVeil({
  width, height, camera, testID, frame,
}: {
  frame?: ChartMapFrame;
  width: number;
  height: number;
  /** Map camera at mount (the open's starting framing). */
  camera: { cx: number; cy: number; s: number };
  testID?: string;
}) {
  const uris = cloudTileUris();
  // The clock is paused while no weather surface is mounted, so this is exactly where the live weather resumes.
  const [clock] = useState(() => weatherClockSeconds());
  const tiles = useMemo(() => {
    if (!uris) return [];
    const w = weatherTransformFor(camera.cx, camera.cy, camera.s, width, height, frame);
    const dropped = weatherLayersDroppedForDev();
    const layers: Layer[] = [
      { key: 'billows', uri: uris.billows, px: CLOUD_TILE_PX.billows, scale: CLOUD_TILE_SCALE.billows, alpha: 1 },
      { key: 'near', uri: uris.near, px: CLOUD_TILE_PX.near, scale: CLOUD_TILE_SCALE.near, alpha: 0.9 },
      { key: 'wisps', uri: uris.wisps, px: CLOUD_TILE_PX.wisps, scale: CLOUD_TILE_SCALE.wisps, alpha: 0.8 },
    ].filter((layer) => !(layer.key === 'near' && dropped.near) && !(layer.key === 'wisps' && dropped.wisps)) as Layer[];
    const out: Array<{ key: string; uri: string; left: number; top: number; size: number; alpha: number }> = [];
    // Map-space window the viewport shows.
    const mapLeft = -w.tx / w.scale;
    const mapTop = -w.ty / w.scale;
    const mapRight = (width - w.tx) / w.scale;
    const mapBottom = (height - w.ty) / w.scale;
    for (const layer of layers) {
      const period = layer.px * layer.scale; // map units per tile
      const ox = wrap(-WEATHER_DRIFT[layer.key].x * clock, period);
      const oy = wrap(-WEATHER_DRIFT[layer.key].y * clock, period);
      const x0 = ox + Math.floor((mapLeft - ox) / period) * period;
      const y0 = oy + Math.floor((mapTop - oy) / period) * period;
      const size = period * w.scale;
      for (let y = y0; y < mapBottom; y += period) {
        for (let x = x0; x < mapRight; x += period) {
          out.push({
            key: `${layer.key}:${Math.round(x)}:${Math.round(y)}`,
            uri: layer.uri,
            left: w.tx + x * w.scale,
            top: w.ty + y * w.scale,
            size,
            alpha: layer.alpha,
          });
        }
      }
    }
    return out;
  }, [uris, frame, camera.cx, camera.cy, camera.s, width, height, clock]);

  return (
    <View testID={testID} style={[styles.root, { width, height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[StyleSheet.absoluteFill, styles.haze]} />
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          fadeDuration={0}
          resizeMethod="scale"
          style={{ position: 'absolute', left: tile.left, top: tile.top, width: tile.size, height: tile.size, opacity: tile.alpha }}
        />
      ))}
    </View>
  );
});

/**
 * Keeps the three tile bitmaps decoded in the image memory cache (1 pt, invisible), so the native veil draws on the
 * very first frame of a Chart open. Mount it where the user is before opening a Chart (the Home/Details Chart cards,
 * the loading hold, the Chart itself). Builds the tiles if no Chart surface has yet.
 */
export function ChartWeatherVeilPrimer() {
  const [uris, setUris] = useState<CloudTileUris | null>(() => (cachedCloudTiles() ? cloudTileUris() : null));
  useEffect(() => {
    if (uris) return undefined;
    let alive = true;
    void loadCloudTiles().then((tiles) => {
      if (!alive || !tiles) return;
      // Encode off the current frame.
      setTimeout(() => {
        if (alive) setUris(cloudTileUris());
      }, 0);
    });
    return () => {
      alive = false;
    };
  }, [uris]);
  if (!uris) return null;
  return (
    <View style={styles.primer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[uris.billows, uris.near, uris.wisps].map((uri, i) => (
        <Image key={i} source={{ uri }} fadeDuration={0} resizeMethod="scale" style={styles.primerImage} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
  haze: { backgroundColor: HAZE },
  primer: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden' },
  primerImage: { width: 1, height: 1 },
});
