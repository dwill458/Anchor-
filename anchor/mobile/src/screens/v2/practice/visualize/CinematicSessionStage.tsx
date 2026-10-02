import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { Blur, Canvas, Circle, Group, Image as SkiaImage, ImageSVG, ImageShader, Paint, Path, RadialGradient, Rect, Shader, Skia, interpolateColors, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { VISION_EDGE_TOP, VISION_EDGE_BOTTOM } from '@/components/v2/vision/VisionImageEdge';
import { fullscreenFit, visionImageFit } from '@/components/v2/vision/visionImageGeometry';
import { colors } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { containRect, coverRect, projectPoint, type Rect as GeometryRect } from './prototype/cinematicGeometry';
import { cinematicSessionFrame, CINEMATIC_MARK_BRIDGE_MS, type CinematicSessionGeometry } from './cinematicSessionMotion';
import type { CinematicTimeline } from './prototype/cinematicTimeline';
import type { ReturnTypeCinematicFrame } from './cinematicSessionMotion';

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
function FramedImage({ image, source, backdrop }: { image: SkImage; source: GeometryRect; backdrop: GeometryRect | null }) {
  return <>
    {backdrop ? <SkiaImage image={image} {...backdrop} fit="fill"><Blur blur={28} /></SkiaImage> : null}
    {backdrop ? <Rect x={backdrop.x} y={backdrop.y} width={backdrop.width} height={backdrop.height} color="rgba(15,20,25,0.22)" /> : null}
    <SkiaImage image={image} {...source} fit="fill" />
  </>;
}

const MomentImage = memo(function MomentImage({ image, source, backdrop, index, state, center, reduced }: {
  image: SkImage; source: GeometryRect; backdrop: GeometryRect | null; index: number; state: SharedValue<ReturnTypeCinematicFrame>;
  center: Array<{ translateX: number } | { translateY: number }>; reduced: boolean;
}) {
  const opacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival') return 0;
    if (s.segment.kind === 'breakout') return reduced && index === 0 ? s.progress : 0;
    if (s.segment.kind === 'transition') return index === s.sceneImageIndex ? 1 - s.progress :
      index === s.sceneImageIndex + 1 ? s.progress : 0;
    return index === s.sceneImageIndex ? s.unmasked : 0;
  });
  return <Group opacity={opacity} transform={center}><FramedImage image={image} source={source} backdrop={backdrop} /></Group>;
});

type Props = {
  tiles: V2VisionTile[]; images: SkImage[]; intention: string; category: string; svgText: string; enhancedImageUrl?: string | null;
  scene: Size; viewport: Size; mark: SceneRect; geometry: CinematicSessionGeometry;
  svg: SkSVG | null; enhancedAnchor: SkImage | null;
  enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null;
  elapsed: SharedValue<number>; timeline: CinematicTimeline; reduced: boolean;
  onMarkLayout: (rect: GeometryRect) => void;
};

/** Production scene: the board, saved photos and enhanced Anchor share one camera. */
export const CinematicSessionStage = memo(function CinematicSessionStage({ tiles, images, intention, category, svgText,
  enhancedImageUrl, scene, viewport, mark, geometry, svg, enhancedAnchor, enhancedMaskEffect, elapsed, timeline, reduced, onMarkLayout }: Props) {
  const board = useVisionBoardScene(tiles, scene);
  const state = useDerivedValue(() => cinematicSessionFrame(elapsed.value, timeline, geometry, reduced));
  const backgroundStyle = useAnimatedStyle(() => ({ opacity: state.value.environment }));
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
  const uploaded = tiles[0].sourceType === 'USER_UPLOAD' || tiles[0].sourceType === 'USER_CAMERA';
  const firstFit = visionImageFit(images[0].width() / images[0].height(), first.width / first.height, uploaded);
  const firstScale = firstFit === 'contain' ? Math.min(first.width / images[0].width(), first.height / images[0].height()) : 0;
  const sourceRect = firstFit === 'contain'
    ? { x: -images[0].width() * firstScale / 2, y: -images[0].height() * firstScale / 2, width: images[0].width() * firstScale, height: images[0].height() * firstScale }
    : coverRect({ width: images[0].width(), height: images[0].height() }, localWindow);
  const firstOpacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival') return 1;
    if (s.segment.kind === 'breakout') return reduced ? 1 - s.progress : 1;
    if (reduced) return 0;
    if (s.sceneImageIndex === 0) return s.segment.kind === 'transition' ? 1 - s.progress : s.unmasked;
    return 0;
  });
  const frameOpacity = useDerivedValue(() => state.value.frameOpacity);
  const markOpacity = useDerivedValue(() => state.value.markOpacity * (1 - bridgeOpacity.value));
  const boardMarkOpacity = useDerivedValue(() => state.value.boardMarkOpacity);
  const markColor = useDerivedValue(() => state.value.segment.kind === 'arrival' || state.value.segment.kind === 'breakout'
    ? '#1E2126' : interpolateColors(state.value.retreat, [0, 0.8], ['#F4E8D4', '#1E2126']));
  const maskedOpacity = useDerivedValue(() => state.value.masked);
  const radius = useDerivedValue(() => Math.max(0.01, state.value.maskRadius));
  const center = useDerivedValue(() => ({ x: viewport.width / 2, y: viewport.height / 2 }));
  const viewportRect = { x: -viewport.width / 2, y: -viewport.height / 2, width: viewport.width, height: viewport.height };
  // Each image is framed once, deterministically, for the viewport: generated portraits fill it; a person's own
  // landscape photograph that a cover would gut is shown whole over a blurred copy of itself.
  const framings = images.map((image, index) => {
    const size = { width: image.width(), height: image.height() };
    const own = tiles[index]?.sourceType === 'USER_UPLOAD' || tiles[index]?.sourceType === 'USER_CAMERA';
    if (fullscreenFit(size, viewport, own) === 'contain') return { source: containRect(size, viewportRect), backdrop: coverRect(size, viewportRect) };
    return { source: coverRect(size, viewportRect), backdrop: null };
  });
  const fullSources = framings.map(item => item.source);
  const fullTransform = [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }];
  const finalImage = images[images.length - 1];
  const finalSource = fullSources[fullSources.length - 1];
  const finalBackdrop = framings[framings.length - 1].backdrop;
  const boardMarkCenter = projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, geometry.rest, viewport);
  const boardMarkTransform = [{ translateX: boardMarkCenter.x }, { translateY: boardMarkCenter.y },
    { rotate: mark.rotation * Math.PI / 180 }, { scale: geometry.rest.scale }];
  const enhancedSize = Math.max(1, mark.width);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }, backgroundStyle]} />
    <Animated.View style={[{ position: 'absolute', left: (viewport.width - scene.width) / 2,
      top: (viewport.height - scene.height) / 2, width: scene.width, height: scene.height }, cameraStyle]}>
      <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout}
        shared={board.shared} initialRectFor={board.initialRectFor} intention={intention} category={category}
        art={{ svg: svgText, imageUrl: enhancedImageUrl }} reduceMotion cinematic={cinematic} />
    </Animated.View>
    <Canvas style={StyleSheet.absoluteFill}>
      <Group opacity={firstOpacity} transform={firstTransform} clip={localWindow}>
        <Rect {...localWindow} color={colors.canvas} />
        <SkiaImage image={images[0]} {...sourceRect} fit="fill" />
        <Group opacity={frameOpacity} transform={[{ translateX: localWindow.x }, { translateY: localWindow.y }, { scaleX: localWindow.width / 1000 }, { scaleY: localWindow.height / 1000 }]}>
          <Path path={VISION_EDGE_TOP} color={colors.canvas} />
          <Path path={VISION_EDGE_BOTTOM} color={colors.canvas} />
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
      {images.map((image, index) => index === 0 && !reduced ? null : <MomentImage key={tiles[index].sceneId}
        image={image} source={fullSources[index]} backdrop={framings[index].backdrop} index={index} state={state} center={fullTransform} reduced={reduced} />)}
      <Group layer={<Paint opacity={maskedOpacity} />}>
        {images.length === 1 && !reduced ? <Group transform={firstTransform} clip={localWindow}>
          <SkiaImage image={finalImage} {...sourceRect} fit="fill" />
        </Group> : <Group transform={fullTransform}><FramedImage image={finalImage} source={finalSource} backdrop={finalBackdrop} /></Group>}
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
    </Canvas>
  </View>;
});
