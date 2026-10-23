import React, { useCallback, useMemo, useRef } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { useVisionBoardComposition } from '@/components/v2/vision/board/useVisionBoardComposition';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { detailBoardSizeForWidth } from '@/components/v2/vision/board/visionBoardLayouts';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { VISION_BOARD_MOTION } from '@/components/v2/vision/board/visionBoardMotion';
import type { VisionBoardCardArt } from '@/components/v2/vision/board/VisionBoardIntentionCard';
import { VisionIntentionHeading } from '@/components/v2/vision/VisionIntentionHeading';
import { noteAssets } from '@/assets/vision/notes/noteAssets';
import { getVisionNotePreset } from '@/components/v2/vision/notes/visionNoteStyles';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { ShareTemplateProps } from '../shareTypes';
import { POSTER_CREAM, ShareBrandMark, ShareCanvas } from './shared';
import { visionBoardExportFrame } from '../visionBoardExportFrame';
import { getVisionShareBackground } from '../visionShareBackgrounds';

type AssetState = { signature: string; expected: Set<string>; ready: Set<string>; fired: boolean; failed?: boolean };
const SHARE_ANCHOR_MARK_ASSET = require('@/assets/home/anchor-brand-mark.png') as ImageSourcePropType;
const VISION_CANVAS_WIDTH = 360;
const VISION_CANVAS_HEIGHT = 640;

/** A static readiness barrier keyed by each rendered photo and note/Anchor asset. */
function useBoardAssetReadiness(assetIds: string[], onReady?: () => void, onError?: (error: Error) => void) {
  const signature = assetIds.slice().sort().join('\u0000');
  const callback = useRef(onReady);
  callback.current = onReady;
  const state = useRef<AssetState>({ signature, expected: new Set(assetIds), ready: new Set(), fired: false });
  if (state.current.signature !== signature) {
    state.current = { signature, expected: new Set(assetIds), ready: new Set(), fired: false };
  }
  const complete = useCallback((id: string) => {
    const current = state.current;
    if (current.signature !== signature || current.fired || current.failed || !current.expected.has(id)) return;
    current.ready.add(id);
    if (current.ready.size < current.expected.size) return;
    current.fired = true;
    // Let the last image/error state commit before view-shot captures the static composition.
    requestAnimationFrame(() => {
      if (state.current === current && !current.failed) callback.current?.();
    });
  }, [signature]);
  React.useEffect(() => {
    if (assetIds.length !== 0) return;
    const current = state.current;
    if (current.fired) return;
    current.fired = true;
    requestAnimationFrame(() => {
      if (state.current === current) callback.current?.();
    });
  }, [assetIds.length, signature]);
  const fail = useCallback((id: string) => {
    const current = state.current;
    if (current.signature !== signature || current.failed || !current.expected.has(id)) return;
    current.failed = true;
    onError?.(new Error('A Vision export image could not be loaded. Please try again.'));
  }, [onError, signature]);
  return { complete, fail };
}

export function wrappedLineCount(text: string, maxCharacters: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (word.length <= maxCharacters) {
      if (used > 0 && used + 1 + word.length > maxCharacters) {
        lines += 1;
        used = 0;
      }
      used += (used ? 1 : 0) + word.length;
      continue;
    }
    if (used > 0) {
      lines += 1;
      used = 0;
    }
    lines += Math.floor((word.length - 1) / maxCharacters);
    used = word.length % maxCharacters || maxCharacters;
  }
  return lines;
}

export function headingReserve(width: number, intention: string) {
  const fontSize = intention.length > 100 ? 22 : intention.length > 60 ? 24 : intention.length > 30 ? 26 : 30;
  const chars = Math.max(12, Math.floor((width * 0.84) / (fontSize * 0.47)));
  // One extra line of breathing room keeps native font metrics from touching the board.
  const lines = wrappedLineCount(intention, chars) + 1;
  return width * 0.07 + 20 + lines * (fontSize + 5) + width * 0.04;
}

export function annotationGeometry(text: string, boardViewport: { width: number; height: number }, scene: { width: number; height: number }, count: number) {
  const sceneScale = scene.width / boardViewport.width;
  const fontSize = text.length > 40 ? 21 : 24;
  const width = boardViewport.width * 0.22 * sceneScale;
  const lineHeight = 25 * sceneScale;
  const lines = wrappedLineCount(text, Math.max(5, Math.floor(width / (fontSize * sceneScale * 0.52))));
  const captionTop = boardViewport.height * (count > 3 ? 0.95 : count === 1 ? 0.92 : count === 2 ? 0.9 : 0.83);
  const top = scene.height / 2 + (captionTop - boardViewport.height / 2) * sceneScale;
  return {
    rect: { x: 16 * sceneScale, y: top, width, height: lines * lineHeight, rotation: -7 },
    style: { left: 16 * sceneScale, top, width, fontSize: fontSize * sceneScale, lineHeight, includeFontPadding: false as const, color: '#303027', transform: [{ rotate: '-7deg' }] as const },
  };
}

/** Share Studio uses the saved Vision's exact scene, framed for a curated 9:16 poster. */
export function VisionExportTemplate({ data, width, showMark, visionBackgroundId, visionBackgroundSource, onAssetsReady, onAssetsError }: ShareTemplateProps) {
  const scale = width / VISION_CANVAS_WIDTH;
  const bg = getVisionShareBackground(visionBackgroundId);
  // Old payloads carry only the first real Vision URL. Adapt that URL to the
  // one-photo detail composition so every Vision export uses the shared scene.
  const tiles = useMemo<readonly V2VisionTile[]>(() => {
    if (data.visionTiles?.length) return data.visionTiles.map(tile => tile.imageUrl?.trim() ? tile : { ...tile, imageUrl: null });
    if (!data.visionImageUrl?.trim()) return data.visionTiles ?? [];
    return [{ id: 'share-legacy-vision', sceneId: 'share-legacy-vision', imageUrl: data.visionImageUrl.trim(), prompt: null, caption: null, sortOrder: 0, isHero: true }];
  }, [data.visionImageUrl, data.visionTiles]);
  const rawNotes = data.visionNotes ?? [];
  const {width:windowWidth}=useWindowDimensions();
  const composition=useVisionBoardComposition({tiles,notes:rawNotes,width:data.visionLayoutWidth??windowWidth-24,boardLayout:data.visionBoardLayout??'CLASSIC'});
  const notes=composition.notes;
  const height = VISION_CANVAS_HEIGHT;
  const titleHeight = headingReserve(VISION_CANVAS_WIDTH, data.intention);
  const footerHeight = VISION_CANVAS_WIDTH * 0.15;
  // Enlarged boardWidth and tighter padding makes the photographs ~15% more prominent while remaining safely inside bounds
  const boardWidth = VISION_CANVAS_WIDTH * 0.94;
  const boardAreaHeight = Math.max(VISION_CANVAS_WIDTH * 0.45, height - titleHeight - footerHeight);
  const boardViewport = useMemo(() => ({width:boardWidth,height:boardWidth*composition.ratio}), [boardWidth,composition.ratio]);
  const scene = useMemo(() => ({width:boardWidth*VISION_BOARD_MOTION.renderScale,height:boardViewport.height*VISION_BOARD_MOTION.renderScale}), [boardWidth,boardViewport]);
  const board = useVisionBoardScene(tiles, scene, 1, true,undefined,composition);
  const layout = board.layout;
  const frameViewport = useMemo(() => ({ width: boardWidth, height: boardAreaHeight }), [boardAreaHeight, boardWidth]);
  const annotation = data.visionAnnotation?.trim() ?? '';
  const annotationLayout = useMemo(() => annotation ? annotationGeometry(annotation, boardViewport, scene, tiles.length) : null,
    [annotation, boardViewport, scene, tiles.length]);
  const overlays = useMemo(() => annotationLayout ? [annotationLayout.rect] : [], [annotationLayout]);
  const frame = useMemo(() => visionBoardExportFrame(scene, layout, notes, frameViewport, boardWidth * 0.02, tiles, overlays,composition.order),
    [boardWidth, frameViewport, layout, notes, overlays, scene, tiles,composition.order]);
  const artwork: VisionBoardCardArt = {
    svg: data.svg,
    imageUrl: data.imageUrl,
    category: data.category,
    expression: data.expression,
  };
  const auxiliaryAssets = useMemo(() => {
    const assets = new Map<string, ImageSourcePropType>();
    assets.set(`bg:${bg.id}`, bg.source);
    for (const note of notes) {
      if (note.isArchived || !note.content.text.trim()) continue;
      const assetKey = getVisionNotePreset(note.presentation.styleId).surfaceAsset;
      if (assetKey) assets.set(`note:${assetKey}`, noteAssets[assetKey]);
    }
    if (showMark && data.imageUrl) assets.set('anchor:image', { uri: data.imageUrl });
    if (showMark) assets.set('brand:mark', SHARE_ANCHOR_MARK_ASSET);
    return [...assets].map(([id, source]) => ({ id, source }));
  }, [bg.id, bg.source, data.imageUrl, notes, showMark]);
  const expectedAssetIds = useMemo(() => [
    'geometry:captions',
    ...tiles.slice(0, layout.photos.length).filter(tile => Boolean(tile.imageUrl?.trim())).map(tile => `photo:${tile.sceneId}`),
    ...tiles.filter(tile => Boolean(tile.caption?.trim())).map(tile => `caption:${tile.sceneId}`),
    ...auxiliaryAssets.map(asset => asset.id),
  ], [auxiliaryAssets, layout.photos.length, tiles]);
  const { complete: markAssetReady, fail: markAssetFailed } = useBoardAssetReadiness(expectedAssetIds, onAssetsReady, onAssetsError);
  React.useEffect(()=>{if(composition.ready)markAssetReady('geometry:captions');},[composition.ready,markAssetReady]);
  const sceneLeft = (VISION_CANVAS_WIDTH - boardWidth) / 2 + frame.left + (frame.scale - 1) * scene.width / 2;
  const sceneTop = titleHeight + frame.top + (frame.scale - 1) * scene.height / 2;

  return (
    <ShareCanvas width={width} background={bg.tone === 'dark' ? '#0B0C16' : POSTER_CREAM}>
      {composition.measurementView}
      {/* Keep the selected artwork visible while its full-resolution asset decodes. */}
      {!onAssetsReady ? <Image source={bg.thumbSource} fadeDuration={0} resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width, height: width * VISION_CANVAS_HEIGHT / VISION_CANVAS_WIDTH }]} /> : null}
      <Image
        key={bg.id}
        testID="vision-share-background"
        source={visionBackgroundSource ?? bg.source}
        style={[StyleSheet.absoluteFill, { width, height: width * VISION_CANVAS_HEIGHT / VISION_CANVAS_WIDTH }]}
        resizeMode="cover"
        resizeMethod={onAssetsReady ? 'scale' : 'resize'}
        fadeDuration={0}
        onLoad={() => markAssetReady(`bg:${bg.id}`)}
        onError={() => markAssetFailed(`bg:${bg.id}`)}
      />
      <View testID="vision-export-canonical-composition" style={{ position: 'absolute', width: VISION_CANVAS_WIDTH, height: VISION_CANVAS_HEIGHT,
        left: (scale - 1) * VISION_CANVAS_WIDTH / 2, top: (scale - 1) * VISION_CANVAS_HEIGHT / 2, transform: [{ scale }] }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: VISION_CANVAS_WIDTH * 0.08, right: VISION_CANVAS_WIDTH * 0.08, top: VISION_CANVAS_WIDTH * 0.07 }}>
        <VisionIntentionHeading intention={data.intention} category={data.category} tone={bg.tone} />
      </View>
      {/* Capture mounts at final measured geometry, so no in-flight recompose can enter a saved file. */}
      {!onAssetsReady || composition.ready ? <View pointerEvents="none" style={{ position: 'absolute', width: scene.width, height: scene.height, left: sceneLeft, top: sceneTop, transform: [{ scale: frame.scale }] }}>
        <VisionBoardScene
          materialMode="photographic"
          sharedComposition slotOrder={composition.order} displayScale={composition.size.width/scene.width}
          focals={Object.fromEntries(tiles.filter(t=>t.focal).map(t=>[t.sceneId,t.focal!]))}
          scene={scene}
          roster={board.roster}
          entering={new Set()}
          layout={layout}
          shared={board.shared}
          initialRectFor={board.initialRectFor}
          intention={data.intention}
          category={data.category}
          art={artwork}
          showAnchorMark={showMark}
          reduceMotion
          notes={notes}
          interactive={false}
          dragEnabled={false}
          markAppearance="paper"
          detailEdges
          onPhotoAssetReady={sceneId => markAssetReady(`photo:${sceneId}`)}
          onPhotoAssetError={sceneId => markAssetFailed(`photo:${sceneId}`)}
          onCaptionReady={sceneId => markAssetReady(`caption:${sceneId}`)}
        />
        {annotationLayout ? <Text pointerEvents="none" style={[{ position: 'absolute', zIndex: 100, fontFamily: 'Allison-Regular' }, annotationLayout.style]}>{annotation}</Text> : null}
      </View> : null}
      {auxiliaryAssets.filter(asset => !asset.id.startsWith('bg:')).map(asset => <Image key={asset.id} source={asset.source} fadeDuration={0} onLoad={() => markAssetReady(asset.id)} onError={() => markAssetFailed(asset.id)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />)}
      {showMark ? <ShareBrandMark width={VISION_CANVAS_WIDTH} ground={bg.tone === 'dark' ? 'dark' : 'light'} /> : null}
      </View>
    </ShareCanvas>
  );
}
