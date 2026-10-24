import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Canvas, Circle, Group, Image as SkiaImage, ImageSVG, ImageShader, Paint, Path, RadialGradient, Rect, Shader, Skia, interpolateColors, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { VISION_EDGE_TOP, VISION_EDGE_BOTTOM } from '@/components/v2/vision/VisionImageEdge';
import { colors } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import type { VisionBoardCardArt } from '@/components/v2/vision/board/VisionBoardIntentionCard';
import type { VisionBoardComposition } from '@/components/v2/vision/board/visionBoardComposition';
import { type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { coverRect, projectPoint, type Rect as GeometryRect } from './prototype/cinematicGeometry';
import { cinematicSessionFrame, CINEMATIC_MARK_BRIDGE_MS, type CinematicSessionGeometry } from './cinematicSessionMotion';
import type { CinematicTimeline } from './prototype/cinematicTimeline';
import type { ReturnTypeCinematicFrame } from './cinematicSessionMotion';
import { photoMotionFrame, photoMotionPlan, type PhotoFocus, type PhotoMotionPlan } from './cinematicPhotoMotion';
import { preserveVisualizeAnchorLayout } from './visualizePhotoFrame';

function smoothstep(value: number) {
  'worklet';
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function EnhancedDisc({ image, size }: { image: SkImage; size: number }) {
  const bounds = { x: -size / 2, y: -size / 2, width: size, height: size };
  return <Group layer={<Paint />} transform={[{ translateX: 0 }]}>
    <SkiaImage image={image} {...bounds} fit="cover" />
    <Group layer={<Paint blendMode="dstIn" />} transform={[{ translateX: 0 }]}>
      <Circle cx={0} cy={0} r={size / 2} color="white" />
    </Group>
  </Group>;
}

function EnhancedInkMask({ image, effect, size }: { image: SkImage; effect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>; size: number }) {
  return <Group transform={[{ translateX: -size / 2 }, { translateY: -size / 2 }]}>
    <Rect x={0} y={0} width={size} height={size}>
      <Shader source={effect} uniforms={{ size }}>
        <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width: size, height: size }} />
      </Shader>
    </Rect>
  </Group>;
}

/** A person's own landscape photograph is shown whole over a soft blurred copy of itself, never hard-cropped to a portrait. */
function FramedImage({ image, source, backdrop, softImage }: { image: SkImage; source: GeometryRect; backdrop: GeometryRect | null; softImage?: SkImage | null }) {
  return <>
    {backdrop && softImage ? <SkiaImage image={softImage} {...backdrop} fit="fill" /> : null}
    {backdrop && softImage ? <Rect {...backdrop} color="rgba(15,20,25,0.55)" /> : null}
    <SkiaImage image={image} {...source} fit="fill" />
  </>;
}

const MomentImage = memo(function MomentImage({ image, motion, backdrop, softImage, index, state, center, reduced, slot }: {
  image: SkImage; motion: PhotoMotionPlan; backdrop: GeometryRect | null; index: number; state: SharedValue<ReturnTypeCinematicFrame>;
  slot: { startMs: number; endMs: number };
  softImage?: SkImage | null;
  center: SharedValue<Array<{ translateX: number } | { translateY: number } | { scale: number }>>; reduced: boolean;
}) {
  const opacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival') return 0;
    if (s.segment.kind === 'breakout') return index === 0 ? reduced ? s.progress : smoothstep((s.progress - 0.7) / 0.3) : 0;
    if (s.segment.kind === 'transition') return index === s.sceneImageIndex ? 1 - s.progress :
      index === s.sceneImageIndex + 1 ? s.progress : 0;
    return index === s.sceneImageIndex ? s.unmasked : 0;
  });
  const rect = useDerivedValue(() => photoMotionFrame(motion, reduced ? 0.5 :
    (state.value.ms - slot.startMs) / Math.max(1, slot.endMs - slot.startMs)));
  const x = useDerivedValue(() => rect.value.x), y = useDerivedValue(() => rect.value.y);
  return <Group opacity={opacity} transform={center}>
    {backdrop && softImage ? <><SkiaImage image={softImage} {...backdrop} fit="fill" />
      <Rect {...backdrop} color="rgba(15,20,25,0.55)" /></> : null}
    <SkiaImage image={image} x={x} y={y} width={motion.width} height={motion.height} fit="fill" />
  </Group>;
});

type Props = {
  composition?: VisionBoardComposition; anchorArt?:VisionBoardCardArt;
  tiles: V2VisionTile[]; images: SkImage[]; intention: string; category: string; svgText: string; enhancedImageUrl?: string | null;
  focalPoints?: Array<PhotoFocus | null>;
  backdrops?: Array<SkImage | null>;
  scene: Size; viewport: Size; mark: SceneRect; geometry: CinematicSessionGeometry;
  svg: SkSVG | null; enhancedAnchor: SkImage | null;
  enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null;
  elapsed: SharedValue<number>; timeline: CinematicTimeline; reduced: boolean;
  /** How many of the images the session actually walks through; the last of them is the one the Anchor emerges from. */
  sequenceCount: number;
  activeIndex: number;
  /** Quiet corner mark for ordinary Vision chapters; the Anchor chapter takes the centre instead. */
  watermark: { x: number; y: number; size: number };
  onMarkLayout: (rect: GeometryRect) => void;
};

/** Production scene: the board, saved photos and enhanced Anchor share one camera. */
export const CinematicSessionStage = memo(function CinematicSessionStage({ tiles, images, intention, category, svgText,
  enhancedImageUrl, focalPoints, backdrops, scene, viewport, mark, geometry, svg, enhancedAnchor, enhancedMaskEffect, elapsed, timeline, reduced, sequenceCount, activeIndex, watermark, onMarkLayout,composition,anchorArt }: Props) {
  const board = useVisionBoardScene(tiles, scene, 1, true,undefined,composition);
  const sessionLayout = composition?board.layout:preserveVisualizeAnchorLayout(board.layout, tiles.length, scene);
  const state = useDerivedValue(() => cinematicSessionFrame(elapsed.value, timeline, geometry, reduced));
  const backgroundStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(state.value.ambientDarkness,
    [0, 1], [colors.canvas, colors.ink.deep]) }));
  const boardDimStyle = useAnimatedStyle(() => ({ opacity: state.value.environment * state.value.ambientDarkness * 0.94 }));
  const frameColor = useDerivedValue(() => interpolateColors(state.value.ambientDarkness, [0, 1], [colors.canvas, colors.ink.deep]));
  const nativePhoto = useDerivedValue(() => state.value.nativePhoto);
  const paperOpacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival' || s.segment.kind === 'breakout') return 1;
    const r = Math.max(0, Math.min(1, s.retreat / 0.75));
    return r * r * (3 - 2 * r);
  });
  const pinOpacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival' || s.segment.kind === 'breakout') return 1;
    const r = Math.max(0, Math.min(1, (s.retreat - 0.25) / 0.75));
    return r * r * (3 - 2 * r);
  });
  // The set-up's medallion dissolves into the session's ink mark over the opening moments.
  const bridgeOpacity = useDerivedValue(() => 1 - smoothstep(elapsed.value / CINEMATIC_MARK_BRIDGE_MS));
  const cinematic = useMemo(() => ({ photoId: tiles[0].sceneId, photoOpacity: nativePhoto, paperOpacity, pinOpacity, bridgeOpacity, onMarkLayout }),
    [nativePhoto, paperOpacity, pinOpacity, bridgeOpacity, onMarkLayout, tiles]);
  const cameraStyle = useAnimatedStyle(() => {
    const { camera, environment } = state.value;
    const center = projectPoint({ x: scene.width / 2, y: scene.height / 2 }, camera, viewport);
    return { opacity: environment, transform: [
      { translateX: center.x - viewport.width / 2 }, { translateY: center.y - viewport.height / 2 },
      { rotate: `${camera.rotation}deg` }, { scale: camera.scale },
    ] };
  });
  const firstTransform = useDerivedValue(() => [
    { translateX: state.value.firstCenter.x }, { translateY: state.value.firstCenter.y },
    { rotate: state.value.firstRotation * Math.PI / 180 }, { scale: state.value.firstScale },
  ]);
  const markTransform = useDerivedValue(() => [
    { translateX: state.value.markCenter.x }, { translateY: state.value.markCenter.y },
    { rotate: state.value.markRotation * Math.PI / 180 }, { scale: state.value.markScale },
  ]);
  const first = geometry.firstPhoto;
  const localWindow = { x: -first.width / 2, y: -first.height / 2, width: first.width, height: first.height };
  const firstFit = 'contain';
  const firstScale = firstFit === 'contain' ? Math.min(first.width / images[0].width(), first.height / images[0].height()) : 0;
  const sourceRect = firstFit === 'contain'
    ? { x: -images[0].width() * firstScale / 2, y: -images[0].height() * firstScale / 2, width: images[0].width() * firstScale, height: images[0].height() * firstScale }
    : coverRect({ width: images[0].width(), height: images[0].height() }, localWindow);
  const firstOpacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival') return 1;
    if (s.segment.kind === 'breakout') return reduced ? 1 - s.progress : 1 - smoothstep((s.progress - 0.7) / 0.3);
    return 0;
  });
  const frameOpacity = useDerivedValue(() => state.value.frameOpacity);
  const markOpacity = useDerivedValue(() => state.value.markOpacity * (1 - bridgeOpacity.value) *
    (state.value.segment.kind === 'recognition' ? 0.93 + 0.07 * state.value.anchorGlow : 1));
  const boardMarkOpacity = useDerivedValue(() => state.value.boardMarkOpacity);
  const markColor = useDerivedValue(() => state.value.segment.kind === 'arrival' || state.value.segment.kind === 'breakout'
    ? '#1E2126' : interpolateColors(state.value.retreat, [0, 0.8], ['#F4E8D4', '#1E2126']));
  const maskedOpacity = useDerivedValue(() => state.value.masked);
  const radius = useDerivedValue(() => Math.max(0.01, state.value.maskRadius));
  const center = useDerivedValue(() => ({ x: viewport.width / 2, y: viewport.height / 2 }));
  const viewportRect = { x: -viewport.width / 2, y: -viewport.height / 2, width: viewport.width, height: viewport.height };
  // Keep every photograph whole; only the dim background copy fills the viewport.
  const framings = useMemo(() => images.map((image, index) => {
    const size = { width: image.width(), height: image.height() };
    const motion = photoMotionPlan(size, viewport, focalPoints?.[index]);
    return { motion, source: photoMotionFrame(motion, reduced ? 0.5 : 1), backdrop: coverRect(size, viewportRect) };
  }), [images, viewport, focalPoints, reduced]);
  const motionSlots = useMemo(() => {
    const breakout = timeline.segments.find(segment => segment.kind === 'breakout');
    const dissolve = timeline.segments.find(segment => segment.kind === 'transition');
    const halfFade = dissolve ? (dissolve.endMs - dissolve.startMs) / 2 : 0;
    return images.map((_, index) => {
      const slot = timeline.photoSlots?.[index] ?? { startMs: 0, endMs: timeline.durationMs };
      return { startMs: index === 0 && breakout ? breakout.startMs + (breakout.endMs - breakout.startMs) * 0.7 : slot.startMs - halfFade,
        endMs: slot.endMs + (index < images.length - 1 ? halfFade : 0) };
    });
  }, [images, timeline]);
  const fullTransform = useDerivedValue<Array<{ translateX: number } | { translateY: number } | { scale: number }>>(() =>
    [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }]);
  const finalIndex = Math.max(0, Math.min(images.length, sequenceCount) - 1);
  const finalImage = images[finalIndex];
  const finalSource = framings[finalIndex].source;
  const finalBackdrop = framings[finalIndex].backdrop;
  // The grade is opacity-only over whatever the frame shows, so Reduce Motion keeps it intact.
  const warmOpacity = useDerivedValue(() => state.value.grade.warm * 0.32);
  const softenOpacity = useDerivedValue(() => state.value.grade.soften * 0.5);
  const hazeOpacity = useDerivedValue(() => state.value.grade.soften * 0.1);
  // A long silence's breath rides on the same near-black layer as the dim, so it can only ever darken a hair.
  const dimOpacity = useDerivedValue(() => (state.value.grade.dim + state.value.breath) * state.value.ambientDarkness);
  const watermarkOpacity = useDerivedValue(() => state.value.grade.watermark);
  const haloOpacity = useDerivedValue(() => state.value.anchorGlow * 0.11);
  const haloRadius = Math.max(1, mark.width * geometry.anchor.scale * 0.95);
  const haloCenter = { x: viewport.width / 2, y: viewport.height / 2 };
  const watermarkHeight = watermark.size * (mark.width > 0 ? mark.height / mark.width : 1);
  const boardMarkCenter = projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, geometry.rest, viewport);
  const boardMarkTransform = [{ translateX: boardMarkCenter.x }, { translateY: boardMarkCenter.y },
    { rotate: mark.rotation * Math.PI / 180 }, { scale: geometry.rest.scale }];
  const enhancedSize = Math.max(1, mark.width);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }, backgroundStyle]} />
    <Animated.View style={[{ position: 'absolute', left: (viewport.width - scene.width) / 2,
      top: (viewport.height - scene.height) / 2, width: scene.width, height: scene.height }, cameraStyle]}>
      <VisionBoardScene materialMode="photographic" sharedComposition={Boolean(composition)} slotOrder={composition?.order} notes={composition?.notes}
        displayScale={composition?composition.size.width/scene.width:undefined} focals={Object.fromEntries(tiles.filter(t=>t.focal).map(t=>[t.sceneId,t.focal!]))} scene={scene} roster={board.roster} entering={board.entering} layout={sessionLayout}
        shared={board.shared} initialRectFor={board.initialRectFor} intention={intention} category={category}
        art={anchorArt??{svg:svgText,imageUrl:enhancedImageUrl}} reduceMotion cinematic={cinematic} />
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ink.deep }, boardDimStyle]} />
    <Canvas style={StyleSheet.absoluteFill}>
      <Group opacity={firstOpacity} transform={firstTransform} clip={localWindow}>
        <Rect {...localWindow} color={frameColor} />
        <SkiaImage image={images[0]} {...sourceRect} fit="fill" />
        <Group opacity={frameOpacity} transform={[{ translateX: localWindow.x }, { translateY: localWindow.y }, { scaleX: localWindow.width / 1000 }, { scaleY: localWindow.height / 1000 }]}>
          <Path path={VISION_EDGE_TOP} color={frameColor} />
          <Path path={VISION_EDGE_BOTTOM} color={frameColor} />
        </Group>
      </Group>
      <Group layer={<Paint opacity={markOpacity} />}>
        {enhancedAnchor ? <Group transform={markTransform}><EnhancedDisc image={enhancedAnchor} size={enhancedSize} /></Group> : svg ? <>
          <Rect x={0} y={0} width={viewport.width} height={viewport.height} color={markColor} />
          <Group layer={<Paint blendMode="dstIn" />} transform={markTransform}>
            <ImageSVG svg={svg} x={-mark.width / 2} y={-mark.height / 2} width={mark.width} height={mark.height} />
          </Group>
        </> : null}
      </Group>
      {images.map((image, index) => index === activeIndex || index === activeIndex + 1 ? <MomentImage key={tiles[index].sceneId}
        image={image} motion={framings[index].motion} backdrop={framings[index].backdrop} index={index} state={state} center={fullTransform} reduced={reduced}
        softImage={backdrops?.[index]} slot={motionSlots[index]} /> : null)}
      <Group layer={<Paint opacity={maskedOpacity} />}>
        <Group transform={fullTransform}><FramedImage image={finalImage} source={finalSource} backdrop={finalBackdrop} softImage={backdrops?.[finalIndex]} /></Group>
        <Group layer={<Paint blendMode="dstIn" />}>
          {!reduced ? <Rect x={0} y={0} width={viewport.width} height={viewport.height}>
            <RadialGradient c={center} r={radius} colors={['white', 'white', 'transparent']} positions={[0, 0.82, 1]} />
          </Rect> : null}
          {enhancedAnchor && enhancedMaskEffect ? <Group transform={markTransform}>
            <EnhancedInkMask image={enhancedAnchor} effect={enhancedMaskEffect} size={enhancedSize} />
          </Group> : !enhancedAnchor && svg ? <Group transform={markTransform}>
            <ImageSVG svg={svg} x={-mark.width / 2} y={-mark.height / 2} width={mark.width} height={mark.height} />
          </Group> : null}
        </Group>
      </Group>
      {reduced ? <Group layer={<Paint opacity={boardMarkOpacity} />}>
        {enhancedAnchor ? <Group transform={boardMarkTransform}><EnhancedDisc image={enhancedAnchor} size={enhancedSize} /></Group> : svg ? <>
          <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="#1E2126" />
          <Group layer={<Paint blendMode="dstIn" />} transform={boardMarkTransform}>
            <ImageSVG svg={svg} x={-mark.width / 2} y={-mark.height / 2} width={mark.width} height={mark.height} />
          </Group>
        </> : null}
      </Group> : null}
      {/* The watermark sits under the grade, so it is warmed, softened and dimmed with the photograph it is etched into. */}
      <Group layer={<Paint opacity={watermarkOpacity} />}>
        {enhancedAnchor && enhancedMaskEffect ? <Group transform={[{ translateX: watermark.x }, { translateY: watermark.y }, { scale: watermark.size / Math.max(1, mark.width) }]}>
          <EnhancedInkMask image={enhancedAnchor} effect={enhancedMaskEffect} size={Math.max(1, mark.width)} />
        </Group> : svg ? <>
          <Rect x={watermark.x - watermark.size / 2} y={watermark.y - watermarkHeight / 2} width={watermark.size} height={watermarkHeight} color="#F4E8D4" />
          <Group layer={<Paint blendMode="dstIn" />}>
            <ImageSVG svg={svg} x={watermark.x - watermark.size / 2} y={watermark.y - watermarkHeight / 2} width={watermark.size} height={watermarkHeight} />
          </Group>
        </> : null}
      </Group>
      <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="rgb(255,222,178)" blendMode="multiply" opacity={warmOpacity} />
      <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="rgb(128,128,128)" blendMode="saturation" opacity={softenOpacity} />
      <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="rgb(244,232,212)" opacity={hazeOpacity} />
      <Rect x={0} y={0} width={viewport.width} height={viewport.height} color="rgb(10,14,18)" opacity={dimOpacity} />
      {/* While the Anchor is held, a barely-there halo breathes behind it: alive, not animated. */}
      <Circle cx={viewport.width / 2} cy={viewport.height / 2} r={haloRadius} opacity={haloOpacity}>
        <RadialGradient c={haloCenter} r={haloRadius} colors={['rgba(244,232,212,1)', 'rgba(244,232,212,0)']} />
      </Circle>
    </Canvas>
  </View>;
});
