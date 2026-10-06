/**
 * Living weather textures (Chart phases 1-2). Three tileable cloud images are
 * drawn ONCE with `drawAsImage` (the same trick grain uses) and cached for the
 * session; ChartMapWeather only scrolls and masks them, so no per-pixel fbm runs
 * per frame.
 *
 * Port of the approved prototype ("Chart Entrance Prototype", puffTile /
 * wispTileMake): soft cumulus clusters of overlapping white puffs, a warm
 * underside laid only on the cloud itself (srcATop), and long thin wisps. Every
 * element is drawn wrapped (+-size) so the tiles repeat seamlessly, from a
 * seeded LCG (16807) so the textures are identical on every device.
 */
import React from 'react';
import { Circle, Group, RadialGradient, drawAsImage, vec, type SkImage } from '@shopify/react-native-skia';

/** Map units per tile pixel for each layer (prototype: half-resolution cloud canvas, near puffs at .8). */
export const CLOUD_TILE_SCALE = { billows: 2, near: 1.6, wisps: 2 } as const;

const BILLOWS = { size: 512, seed: 7, clusters: 7, rMin: 46, rMax: 96 } as const;
const NEAR = { size: 384, seed: 19, clusters: 8, rMin: 22, rMax: 50 } as const;
const WISPS = { size: 512, seed: 31, count: 26 } as const;

export type CloudTiles = { billows: SkImage; near: SkImage; wisps: SkImage };

/** Park-Miller LCG (prototype `rng`): deterministic floats in [0, 1). */
export function cloudRng(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type CloudPuff = { x: number; y: number; r: number };
export type CloudCluster = { cx: number; cy: number; w: number; puffs: CloudPuff[] };
export type CloudWisp = { x: number; y: number; rx: number; ry: number; a: number };

/** Cluster layout of one puff tile, drawn back to front by y. Pure: the test pins it. */
export function cloudClusters(size: number, seed: number, clusters: number, rMin: number, rMax: number): CloudCluster[] {
  const R = cloudRng(seed);
  const list: CloudCluster[] = [];
  for (let k = 0; k < clusters; k++) {
    const cx = R() * size;
    const cy = R() * size;
    const w = rMax * (2.2 + R() * 2);
    const n = 5 + Math.floor(R() * 5);
    const puffs: CloudPuff[] = [];
    for (let j = 0; j < n; j++) {
      const t = R() - 0.5;
      // Puffs grow toward the cluster centre and lift, so each cluster reads as a rounded cumulus top.
      const hump = Math.max(0.25, 1 - Math.abs(t) * 1.5);
      const r = rMin + (rMax - rMin) * hump * (0.7 + R() * 0.3);
      puffs.push({ x: cx + t * w, y: cy - r * 0.45 * hump - R() * r * 0.2, r });
    }
    list.push({ cx, cy, w, puffs });
  }
  return list.sort((a, b) => a.cy - b.cy);
}

export function cloudWisps(size: number, seed: number, count: number): CloudWisp[] {
  const R = cloudRng(seed);
  const out: CloudWisp[] = [];
  for (let k = 0; k < count; k++) {
    const x = R() * size;
    const y = R() * size;
    out.push({ x, y, rx: 50 + R() * 130, ry: 6 + R() * 12, a: 0.25 + R() * 0.35 });
  }
  return out;
}

/** Every wrapped copy (+-size) of an element of radius r that touches the tile. */
function wraps(size: number, x: number, y: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx * size;
      const Y = y + dy * size;
      if (X + r < 0 || X - r > size || Y + r < 0 || Y - r > size) continue;
      out.push([X, Y]);
    }
  }
  return out;
}

const PUFF_COLORS = ['rgba(255,254,251,0.96)', 'rgba(250,248,243,0.78)', 'rgba(248,245,239,0)'];
const PUFF_STOPS = [0, 0.62, 1];
const UNDER_COLORS = ['rgba(178,167,151,0.42)', 'rgba(196,187,173,0.18)', 'rgba(210,202,190,0)'];
const UNDER_STOPS = [0, 0.6, 1];

function PuffTile({ size, clusters, rMax }: { size: number; clusters: CloudCluster[]; rMax: number }) {
  return (
    <Group>
      {clusters.map((cl, k) => (
        <Group key={k}>
          {cl.puffs.flatMap((p, j) =>
            wraps(size, p.x, p.y, p.r).map(([X, Y], w) => (
              <Circle key={`${j}-${w}`} cx={X} cy={Y} r={p.r}>
                <RadialGradient c={vec(X - p.r * 0.2, Y - p.r * 0.3)} r={p.r} colors={PUFF_COLORS} positions={PUFF_STOPS} />
              </Circle>
            )),
          )}
          {/* Warm underside on the cloud pixels only. */}
          {wraps(size, cl.cx, cl.cy + rMax * 0.35, cl.w * 0.7).map(([X, Y], w) => {
            const rx = cl.w * 0.7;
            const ry = rMax * 0.6;
            return (
              <Group key={`u-${w}`} transform={[{ translateX: X }, { translateY: Y }, { scaleY: ry / rx }]}>
                <Circle cx={0} cy={rx * 0.35} r={rx} blendMode="srcATop">
                  <RadialGradient c={vec(0, rx * 0.35)} r={rx} colors={UNDER_COLORS} positions={UNDER_STOPS} />
                </Circle>
              </Group>
            );
          })}
        </Group>
      ))}
    </Group>
  );
}

function WispTile({ size, wisps }: { size: number; wisps: CloudWisp[] }) {
  return (
    <Group>
      {wisps.flatMap((p, k) =>
        wraps(size, p.x, p.y, p.rx).map(([X, Y], w) => (
          <Group key={`${k}-${w}`} transform={[{ translateX: X }, { translateY: Y }, { rotate: -0.06 }, { scaleY: p.ry / p.rx }]}>
            <Circle cx={0} cy={0} r={p.rx}>
              <RadialGradient c={vec(0, 0)} r={p.rx} colors={[`rgba(253,252,248,${p.a})`, 'rgba(253,252,248,0)']} />
            </Circle>
          </Group>
        )),
      )}
    </Group>
  );
}

/** Tile sizes in pixels (one period of each repeating texture). */
export const CLOUD_TILE_PX = { billows: BILLOWS.size, near: NEAR.size, wisps: WISPS.size } as const;

let tilesCache: CloudTiles | null = null;
let tilesLoad: Promise<CloudTiles | null> | null = null;

export function cachedCloudTiles(): CloudTiles | null {
  return tilesCache;
}

/** Build the three tiles once per session; concurrent callers share one build. Null if Skia cannot draw them. */
export function loadCloudTiles(): Promise<CloudTiles | null> {
  if (tilesCache) return Promise.resolve(tilesCache);
  if (tilesLoad) return tilesLoad;
  tilesLoad = (async () => {
    const billowClusters = cloudClusters(BILLOWS.size, BILLOWS.seed, BILLOWS.clusters, BILLOWS.rMin, BILLOWS.rMax);
    const nearClusters = cloudClusters(NEAR.size, NEAR.seed, NEAR.clusters, NEAR.rMin, NEAR.rMax);
    const wisps = cloudWisps(WISPS.size, WISPS.seed, WISPS.count);
    const [billows, near, wispImage] = await Promise.all([
      drawAsImage(<PuffTile size={BILLOWS.size} clusters={billowClusters} rMax={BILLOWS.rMax} />, { width: BILLOWS.size, height: BILLOWS.size }),
      drawAsImage(<PuffTile size={NEAR.size} clusters={nearClusters} rMax={NEAR.rMax} />, { width: NEAR.size, height: NEAR.size }),
      drawAsImage(<WispTile size={WISPS.size} wisps={wisps} />, { width: WISPS.size, height: WISPS.size }),
    ]);
    if (!billows || !near || !wispImage) return null;
    tilesCache = { billows, near, wisps: wispImage };
    return tilesCache;
  })()
    .catch((error) => {
      if (__DEV__) console.warn('[chart-map] cloud tiles failed', error);
      return null;
    })
    .finally(() => {
      tilesLoad = null;
    });
  return tilesLoad;
}

/**
 * The same three tiles as PNG data URIs, for the native (non-Skia) frame-one veil. A Skia canvas on Android is a
 * TextureView whose surface arrives a few frames after mount, so the first frames of any new map must come from
 * native views; these let them show the exact textures the weather draws. Encoded once, after the tiles exist.
 */
export type CloudTileUris = { billows: string; near: string; wisps: string };
let urisCache: CloudTileUris | null = null;
const PNG = 4; // ImageFormat.PNG

export function cloudTileUris(): CloudTileUris | null {
  if (urisCache) return urisCache;
  const tiles = tilesCache;
  if (!tiles) return null;
  try {
    const encode = (image: SkImage) => {
      const base64 = (image as SkImage & { encodeToBase64?: (fmt?: number) => string }).encodeToBase64?.(PNG);
      return base64 ? `data:image/png;base64,${base64}` : null;
    };
    const billows = encode(tiles.billows);
    const near = encode(tiles.near);
    const wisps = encode(tiles.wisps);
    if (!billows || !near || !wisps) return null;
    urisCache = { billows, near, wisps };
    return urisCache;
  } catch {
    return null;
  }
}

/** Test helper: forget the cached tiles. */
export function resetCloudTilesCache(): void {
  tilesCache = null;
  tilesLoad = null;
  urisCache = null;
}
