import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { BlendColor, Canvas, Group, Image as SkiaImage, ImageSVG, Paint, RadialGradient, Rect, interpolateColors, type SkImage, type SkSVG } from '@shopify/react-native-skia';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { BOARD_ATTACHMENT_ART } from '@/components/v2/vision/board/visionBoardAssets';
import { boardAttachmentFor, BOARD_FRAME_WINDOW, type SceneRect, type Size } from '@/components/v2/vision/board/visionBoardLayouts';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { coverRect, projectPoint, type Rect as GeometryRect } from './cinematicGeometry';
import { signatureFrame, type SignatureGeometry } from './signatureMotion';

type Props = {
  tiles: V2VisionTile[]; intention: string; category: string; svgText: string;
  scene: Size; viewport: Size; mark: SceneRect; geometry: SignatureGeometry;
  image: SkImage; frameImage: SkImage; attachmentImage: SkImage; svg: SkSVG;
  elapsed: SharedValue<number>; reduced: boolean;
  onMarkLayout: (rect: GeometryRect) => void;
};

/** The board and compositor are two render surfaces driven by the SAME camera. */
export const SignatureStage = memo(function SignatureStage({ tiles, intention, category, svgText, scene, viewport, mark, geometry,
  image, frameImage, attachmentImage, svg, elapsed, reduced, onMarkLayout }: Props) {
  const board = useVisionBoardScene(tiles, scene);
  const state = useDerivedValue(() => signatureFrame(elapsed.value, geometry, reduced));
  const nativePhoto = useDerivedValue(() => state.value.nativePhoto);
  const cinematic = useMemo(() => ({ photoId: tiles[0].sceneId, photoOpacity: nativePhoto, onMarkLayout }), [nativePhoto, onMarkLayout, tiles]);
  const cameraStyle = useAnimatedStyle(() => {
    const { camera, environment, opening } = state.value;
    const center = projectPoint({ x: scene.width / 2, y: scene.height / 2 }, camera, viewport);
    return { opacity: environment * opening, transform: [
      { translateX: center.x - viewport.width / 2 }, { translateY: center.y - viewport.height / 2 },
      { rotate: `${camera.rotation}deg` }, { scale: camera.scale },
    ] };
  });
  const presence = useDerivedValue(() => state.value.opening);
  const photoTransform = useDerivedValue(() => [
    { translateX: state.value.photoCenter.x }, { translateY: state.value.photoCenter.y },
    { rotate: state.value.photoRotation * Math.PI / 180 }, { scale: state.value.photoScale },
  ]);
  const markTransform = useDerivedValue(() => [
    { translateX: state.value.markCenter.x }, { translateY: state.value.markCenter.y },
    { rotate: state.value.markRotation * Math.PI / 180 }, { scale: state.value.markScale },
  ]);
  const photo = geometry.photo;
  const localWindow = { x: -photo.width / 2, y: -photo.height / 2, width: photo.width, height: photo.height };
  const sourceRect = coverRect({ width: image.width(), height: image.height() }, localWindow);
  const kind = board.layout.photos[0].frame;
  const w = BOARD_FRAME_WINDOW[kind];
  const frameWidth = photo.width / (w.right - w.left + 0.024);
  const frameHeight = photo.height / (w.bottom - w.top + 0.024);
  const frame = { x: localWindow.x - (w.left - 0.012) * frameWidth,
    y: localWindow.y - (w.top - 0.012) * frameHeight, width: frameWidth, height: frameHeight };
  const attachment = BOARD_ATTACHMENT_ART[boardAttachmentFor(tiles[0].sceneId)];
  const pinWidth = frameWidth * attachment.width;
  const pin = { x: frame.x + frameWidth * attachment.x - pinWidth / 2,
    y: frame.y + frameHeight * attachment.y - pinWidth / attachment.aspect / 2,
    width: pinWidth, height: pinWidth / attachment.aspect };
  const directTextureOpacity = useDerivedValue(() => elapsed.value < 11000 ? state.value.textured : 0);
  const maskedTextureOpacity = useDerivedValue(() => elapsed.value < 11000 ? 0 : state.value.textured);
  const frameOpacity = useDerivedValue(() => state.value.frameOpacity);
  const markOpacity = useDerivedValue(() => state.value.markPresence);
  const markColor = useDerivedValue(() => interpolateColors(elapsed.value < 6000 ? 1 : state.value.retreat, [0, 0.8], ['#F4E8D4', '#1E2126']));
  const boundaryOpacity = useDerivedValue(() => state.value.boundary);
  const radius = useDerivedValue(() => Math.max(0.01, Math.hypot(viewport.width, viewport.height) * (1 - state.value.aperture)));
  const center = useDerivedValue(() => ({ x: viewport.width / 2, y: viewport.height / 2 }));
  const maskMarkOpacity = useDerivedValue(() => elapsed.value < 11000 ? 0 : 1);
  const markMask = <Group transform={markTransform}><ImageSVG svg={svg} x={-mark.width / 2} y={-mark.height / 2} width={mark.width} height={mark.height} /></Group>;

  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Animated.View style={[{ position: 'absolute', left: (viewport.width - scene.width) / 2,
      top: (viewport.height - scene.height) / 2, width: scene.width, height: scene.height }, cameraStyle]}>
      <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout}
        shared={board.shared} initialRectFor={board.initialRectFor} intention={intention} category={category}
        art={{ svg: svgText }} reduceMotion cinematic={cinematic} />
    </Animated.View>
    <Canvas style={StyleSheet.absoluteFill}>
      <Group opacity={presence}>
        <Group opacity={frameOpacity} transform={photoTransform}>
          <Group transform={[{ translateX: 1.6 }, { translateY: 4 }]} opacity={0.16}>
            <SkiaImage image={frameImage} {...frame} fit="fill"><BlendColor color="#000000" mode="srcIn" /></SkiaImage>
          </Group>
        </Group>
        <Group layer={<Paint opacity={markOpacity} />}>
          <Rect x={0} y={0} width={viewport.width} height={viewport.height} color={markColor} />
          <Group layer={<Paint blendMode="dstIn" />}>{markMask}</Group>
        </Group>
        <Group opacity={directTextureOpacity}>
          <Group transform={photoTransform} clip={localWindow}><SkiaImage image={image} {...sourceRect} fit="fill" /></Group>
        </Group>
        <Group layer={<Paint opacity={maskedTextureOpacity} />}>
          <Group transform={photoTransform}>
            <SkiaImage image={image} {...sourceRect} fit="fill" />
          </Group>
          <Group layer={<Paint blendMode="dstIn" />}>
            <Group opacity={boundaryOpacity}>
              <Rect x={0} y={0} width={viewport.width} height={viewport.height}>
                <RadialGradient c={center} r={radius} colors={['white', 'white', 'transparent']} positions={[0, 0.82, 1]} />
              </Rect>
            </Group>
            <Group transform={markTransform} layer={<Paint opacity={maskMarkOpacity} />}>
              <ImageSVG svg={svg} x={-mark.width / 2} y={-mark.height / 2} width={mark.width} height={mark.height} />
            </Group>
          </Group>
        </Group>
        <Group opacity={frameOpacity} transform={photoTransform}>
          <SkiaImage image={frameImage} {...frame} fit="fill" />
          <Group origin={{ x: pin.x + pin.width / 2, y: pin.y + pin.height / 2 }} transform={[{ rotate: attachment.rotation * Math.PI / 180 }]}>
            <SkiaImage image={attachmentImage} {...pin} fit="fill" />
          </Group>
        </Group>
      </Group>
    </Canvas>
  </View>;
});
