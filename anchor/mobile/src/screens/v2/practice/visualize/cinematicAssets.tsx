import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';
import { useImage, type SkImage } from '@shopify/react-native-skia';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';

/** A 2048-square decoded texture is 16 MiB RGBA, irrespective of encoded byte size. */
export const MAX_CINEMATIC_TEXTURE_PIXELS = 2048 * 2048;

export function isCinematicTextureSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 &&
    width * height <= MAX_CINEMATIC_TEXTURE_PIXELS;
}

export type CinematicAssets = {
  tiles: V2VisionTile[];
  images: SkImage[];
  enhancedAnchor: SkImage | null;
};

const ENHANCED_ANCHOR_ID = '__enhanced_anchor_art__';

/** A session freezes this roster once; refreshed Vision data cannot change a running film. */
export function freezeCinematicTiles(tiles: V2VisionTile[]): V2VisionTile[] {
  return tiles.filter(tile => Boolean(tile.imageUrl)).slice(0, VISION_BOARD_MAX_IMAGES).map(tile => ({ ...tile }));
}

function ImageResource({ id, imageUrl, onReady, onFailure }: {
  id: string;
  imageUrl: string;
  onReady: (id: string, image: SkImage) => void;
  onFailure: (id: string) => void;
}) {
  const readyRef = useRef(onReady);
  const failureRef = useRef(onFailure);
  readyRef.current = onReady; failureRef.current = onFailure;
  const failure = useCallback(() => failureRef.current(id), [id]);
  const image = useImage(imageUrl, failure);
  useEffect(() => { if (image) readyRef.current(id, image); }, [image, id]);
  return null;
}

/** Native photographs and Skia textures must exist before the practice clock starts. */
export function useCinematicAssets(tiles: V2VisionTile[], enhancedImageUrl?: string | null) {
  const [attempt, setAttempt] = useState(0);
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const [textures, setTextures] = useState<Record<string, SkImage>>({});
  const [dimensionsReady, setDimensionsReady] = useState<ReadonlySet<string>>(new Set());
  const [prefetched, setPrefetched] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [oversized, setOversized] = useState<ReadonlySet<string>>(new Set());
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useCallback(() => {
    setAttempt(value => value + 1);
    setTextures({}); setDimensionsReady(new Set()); setPrefetched(new Set()); setFailed(new Set()); setOversized(new Set());
    setTimedOut(false);
  }, []);
  const onReady = useCallback((generation: number, id: string, image: SkImage) => {
    if (generation !== attemptRef.current) return;
    setTextures(previous => previous[id] === image ? previous : { ...previous, [id]: image });
  }, []);
  const onFailure = useCallback((generation: number, id: string) => {
    if (generation !== attemptRef.current) return;
    setFailed(previous => new Set(previous).add(id));
  }, []);
  useEffect(() => {
    let live = true;
    const timeout = setTimeout(() => { if (live) setTimedOut(true); }, 20_000);
    timeoutRef.current = timeout;
    const sources = tiles.map(tile => ({ id: tile.sceneId, imageUrl: tile.imageUrl! }));
    if (enhancedImageUrl) sources.push({ id: ENHANCED_ANCHOR_ID, imageUrl: enhancedImageUrl });
    sources.forEach(source => {
      Image.getSize(source.imageUrl, (width, height) => {
        if (!live) return;
        if (!isCinematicTextureSize(width, height)) {
          setFailed(previous => new Set(previous).add(source.id));
          if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 &&
            width * height > MAX_CINEMATIC_TEXTURE_PIXELS) {
            setOversized(previous => new Set(previous).add(source.id));
          }
          return;
        }
        setDimensionsReady(previous => new Set(previous).add(source.id));
        void Promise.resolve().then(() => Image.prefetch(source.imageUrl))
          .then(ok => { if (live) (ok ? setPrefetched : setFailed)(previous => new Set(previous).add(source.id)); })
          .catch(() => { if (live) setFailed(previous => new Set(previous).add(source.id)); });
      }, () => { if (live) setFailed(previous => new Set(previous).add(source.id)); });
    });
    return () => { live = false; clearTimeout(timeout); if (timeoutRef.current === timeout) timeoutRef.current = null; };
  }, [attempt, enhancedImageUrl, tiles]);
  const available = useMemo(() => tiles.filter(tile => dimensionsReady.has(tile.sceneId) && textures[tile.sceneId] &&
    prefetched.has(tile.sceneId) && !failed.has(tile.sceneId)), [dimensionsReady, failed, prefetched, textures, tiles]);
  const sourceIds = enhancedImageUrl ? [...tiles.map(tile => tile.sceneId), ENHANCED_ANCHOR_ID] : tiles.map(tile => tile.sceneId);
  const pending = sourceIds.some(id => !failed.has(id) && (!dimensionsReady.has(id) ||
    !prefetched.has(id) || !textures[id]));
  const ready = tiles.length > 0 && !pending && failed.size === 0 && available.length === tiles.length;
  useEffect(() => { if (ready && timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } }, [ready]);
  const enhancedFailed = failed.has(ENHANCED_ANCHOR_ID);
  const enhancedReady = !enhancedImageUrl || (dimensionsReady.has(ENHANCED_ANCHOR_ID) && prefetched.has(ENHANCED_ANCHOR_ID) &&
    Boolean(textures[ENHANCED_ANCHOR_ID]) && !enhancedFailed);
  const partial = (tiles.some(tile => failed.has(tile.sceneId)) || timedOut) && available.length > 0 && enhancedReady;
  const unavailable = enhancedFailed || (timedOut && !enhancedReady) ||
    (!pending && available.length === 0) || (timedOut && available.length === 0);
  const resources = <React.Fragment key={attempt}>{[...tiles.map(tile => ({ id: tile.sceneId, imageUrl: tile.imageUrl! })),
    ...(enhancedImageUrl ? [{ id: ENHANCED_ANCHOR_ID, imageUrl: enhancedImageUrl }] : [])]
    .filter(source => dimensionsReady.has(source.id)).map(source => <ImageResource key={source.id} {...source}
      onReady={(id, image) => onReady(attempt, id, image)} onFailure={id => onFailure(attempt, id)} />)}</React.Fragment>;
  const select = (selection: V2VisionTile[]): CinematicAssets => ({ tiles: selection,
    images: selection.map(tile => textures[tile.sceneId]), enhancedAnchor: enhancedImageUrl ? textures[ENHANCED_ANCHOR_ID] ?? null : null });
  return { resources, ready, partial, unavailable, available, select, retry, timedOut,
    failedCount: failed.size, oversizedCount: oversized.size, enhancedFailed, enhancedReady };
}
