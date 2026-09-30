import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  BlendColor, Canvas, Circle, Group, Image as SkiaImage, ImageSVG, ImageShader, Paint, RadialGradient, Rect, Shader, Skia,
  interpolateColors, type SkImage, type SkSVG,
} from '@shopify/react-native-skia';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { BOARD_ATTACHMENT_ART } from '@/components/v2/vision/board/visionBoardAssets';
import { boardAttachmentFor, BOARD_FRAME_WINDOW, type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';
import { coverRect, projectPoint, type Rect as GeometryRect } from './prototype/cinematicGeometry';
import { cinematicSessionFrame, type CinematicSessionGeometry } from './cinematicSessionMotion';
import type { CinematicTimeline } from './prototype/cinematicTimeline';
import type { ReturnTypeCinematicFrame } from './cinematicSessionMotion';

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

const MomentImage = memo(function MomentImage({ image, source, index, state, center, reduced }: {
  image: SkImage; source: GeometryRect; index: number; state: SharedValue<ReturnTypeCinematicFrame>;
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
  return <Group opacity={opacity} transform={center}><SkiaImage image={image} {...source} fit="fill" /></Group>;
});

type Props = {
  tiles: V2VisionTile[]; images: SkImage[]; intention: string; category: string; svgText: string; enhancedImageUrl?: string | null;
  scene: Size; viewport: Size; mark: SceneRect; geometry: CinematicSessionGeometry;
  frameImage: SkImage; attachmentImage: SkImage; svg: SkSVG | null; enhancedAnchor: SkImage | null;
  enhancedMaskEffect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>> | null;
  elapsed: SharedValue<number>; timeline: CinematicTimeline; reduced: boolean;
  onMarkLayout: (rect: GeometryRect) => void;
};

/** Production scene: the board, saved photos and enhanced Anchor share one camera. */
export const CinematicSessionStage = memo(function CinematicSessionStage({ tiles, images, intention, category, svgText,
  enhancedImageUrl, scene, viewport, mark, geometry, frameImage, attachmentImage, svg, enhancedAnchor, enhancedMaskEffect, elapsed, timeline, reduced, onMarkLayout }: Props) {
  const board = useVisionBoardScene(tiles, scene);
  const state = useDerivedValue(() => cinematicSessionFrame(elapsed.value, timeline, geometry, reduced));
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
  const cinematic = useMemo(() => ({ photoId: tiles[0].sceneId, photoOpacity: nativePhoto, paperOpacity, pinOpacity, onMarkLayout }),
    [nativePhoto, paperOpacity, pinOpacity, onMarkLayout, tiles]);
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
  const sourceRect = coverRect({ width: images[0].width(), height: images[0].height() }, localWindow);
  const frameKind = board.layout.photos[0].frame;
  const w = BOARD_FRAME_WINDOW[frameKind];
  const frameWidth = first.width / (w.right - w.left + 0.024);
  const frameHeight = first.height / (w.bottom - w.top + 0.024);
  const frame = { x: localWindow.x - (w.left - 0.012) * frameWidth,
    y: localWindow.y - (w.top - 0.012) * frameHeight, width: frameWidth, height: frameHeight };
  const attachment = BOARD_ATTACHMENT_ART[boardAttachmentFor(tiles[0].sceneId)];
  const pinWidth = frameWidth * attachment.width;
  const pin = { x: frame.x + frameWidth * attachment.x - pinWidth / 2,
    y: frame.y + frameHeight * attachment.y - pinWidth / attachment.aspect / 2,
    width: pinWidth, height: pinWidth / attachment.aspect };
  const firstOpacity = useDerivedValue(() => {
    const s = state.value;
    if (s.segment.kind === 'arrival') return 1;
    if (s.segment.kind === 'breakout') return reduced ? 1 - s.progress : 1;
    if (reduced) return 0;
    if (s.sceneImageIndex === 0) return s.segment.kind === 'transition' ? 1 - s.progress : s.unmasked;
    return 0;
  });
  const frameOpacity = useDerivedValue(() => state.value.frameOpacity);
  const markOpacity = useDerivedValue(() => state.value.markOpacity);
  const boardMarkOpacity = useDerivedValue(() => state.value.boardMarkOpacity);
  const markColor = useDerivedValue(() => state.value.segment.kind === 'arrival' || state.value.segment.kind === 'breakout'
    ? '#1E2126' : interpolateColors(state.value.retreat, [0, 0.8], ['#F4E8D4', '#1E2126']));
  const maskedOpacity = useDerivedValue(() => state.value.masked);
  const radius = useDerivedValue(() => Math.max(0.01, state.value.maskRadius));
  const center = useDerivedValue(() => ({ x: viewport.width / 2, y: viewport.height / 2 }));
  const viewportRect = { x: -viewport.width / 2, y: -viewport.height / 2, width: viewport.width, height: viewport.height };
  const fullSources = images.map(image => coverRect({ width: image.width(), height: image.height() }, viewportRect));
  const fullTransform = [{ translateX: viewport.width / 2 }, { translateY: viewport.height / 2 }];
  const finalImage = images[images.length - 1];
  const finalSource = fullSources[fullSources.length - 1];
  const boardMarkCenter = projectPoint({ x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 }, geometry.rest, viewport);
  const boardMarkTransform = [{ translateX: boardMarkCenter.x }, { translateY: boardMarkCenter.y },
    { rotate: mark.rotation * Math.PI / 180 }, { scale: geometry.rest.scale }];
  const enhancedSize = Math.max(1, mark.width - 8);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[{ position: 'absolute', left: (viewport.width - scene.width) / 2,
      top: (viewport.height - scene.height) / 2, width: scene.width, height: scene.height }, cameraStyle]}>
      <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout}
        shared={board.shared} initialRectFor={board.initialRectFor} intention={intention} category={category}
        art={{ svg: svgText, imageUrl: enhancedImageUrl }} reduceMotion cinematic={cinematic} />
    </Animated.View>
    <Canvas style={StyleSheet.absoluteFill}>
      <Group opacity={frameOpacity} transform={firstTransform}>
        <Group transform={[{ translateX: 1.6 }, { translateY: 4 }]} opacity={0.16}>
          <SkiaImage image={frameImage} {...frame} fit="fill"><BlendColor color="#000000" mode="srcIn" /></SkiaImage>
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
      <Group opacity={firstOpacity} transform={firstTransform} clip={localWindow}>
        <SkiaImage image={images[0]} {...sourceRect} fit="fill" />
      </Group>
      {images.map((image, index) => index === 0 && !reduced ? null : <MomentImage key={tiles[index].sceneId}
        image={image} source={fullSources[index]} index={index} state={state} center={fullTransform} reduced={reduced} />)}
      <Group layer={<Paint opacity={maskedOpacity} />}>
        {images.length === 1 && !reduced ? <Group transform={firstTransform} clip={localWindow}>
          <SkiaImage image={finalImage} {...sourceRect} fit="fill" />
        </Group> : <Group transform={fullTransform}><SkiaImage image={finalImage} {...finalSource} fit="fill" /></Group>}
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
      <Group opacity={frameOpacity} transform={firstTransform}>
        <SkiaImage image={frameImage} {...frame} fit="fill" />
        <Group origin={{ x: pin.x + pin.width / 2, y: pin.y + pin.height / 2 }}
          transform={[{ rotate: attachment.rotation * Math.PI / 180 }]}>
          <SkiaImage image={attachmentImage} {...pin} fit="fill" />
        </Group>
      </Group>
    </Canvas>
  </View>;
});
