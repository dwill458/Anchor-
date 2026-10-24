import { memo } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { BoardCaption } from './visionBoardLayouts';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';
import {
  boardTiming,
  boardSpring,
  boardRecomposeEasing,
  VISION_BOARD_MOTION as MOTION,
} from './visionBoardMotion';
import {
  VISION_CAPTION_COLOR,
  VISION_SHADOW,
} from '../material/visionMaterialTokens';
import { useVisionImageArrival } from '../VisionImageArrival';

/** Labels sit above every photograph; they keep the photo's stable identity and UI-thread motion. */
export const VisionBoardCaption = memo(function VisionBoardCaption({
  sceneId,
  caption,
  sceneWidth,
  referenceScale,
  initialRect,
  shared,
  reduced,
  dimmed,
  onEdit,
  onReady,
}: {
  sceneId: string;
  caption: BoardCaption;
  sceneWidth: number;
  referenceScale: number;
  initialRect: BoardSlotRect;
  shared: VisionBoardShared;
  reduced: boolean;
  dimmed?: boolean;
  onEdit?: (id: string) => void;
  onReady?: (id: string) => void;
}) {
  const x = useSharedValue(initialRect.x),
    y = useSharedValue(initialRect.y),
    w = useSharedValue(initialRect.width),
    h = useSharedValue(initialRect.height),
    rotation = useSharedValue(initialRect.rotation);
  const arrival = useVisionImageArrival(),
    print = arrival?.setPrints?.find((item) => item.sceneId === sceneId);
  const landed = !print || ['landed', 'pinned', 'failed'].includes(print.phase);
  useAnimatedReaction(
    () => {
      const i = shared.order.value.indexOf(sceneId);
      return {
        rect: shared.slots.value[i],
        version: shared.layoutVersion.value,
      };
    },
    (next, previous) => {
      if (!next.rect) return;
      const recomposing = previous?.version !== next.version;
      const move = (to: number) => {
        'worklet';
        return reduced
          ? boardTiming(to, {
              duration: recomposing
                ? MOTION.reduced.recomposeMs
                : MOTION.reduced.swapMs,
            })
          : recomposing
            ? boardTiming(to, {
                duration: shared.recomposeMs?.value ?? MOTION.recompose.moveMs,
                easing: boardRecomposeEasing,
              })
            : boardSpring(to);
      };
      x.value = move(next.rect.x);
      y.value = move(next.rect.y);
      w.value = move(next.rect.width);
      h.value = move(next.rect.height);
      rotation.value = move(next.rect.rotation);
    },
    [sceneId, reduced],
  );
  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    zIndex: 30 + Math.max(0, shared.order.value.indexOf(sceneId)),
    opacity:
      landed && shared.dragging.value !== sceneId ? (dimmed ? 0.24 : 1) : 0,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View pointerEvents="box-none" style={style}>
      <Pressable
        disabled={!onEdit}
        accessibilityRole={onEdit ? 'button' : undefined}
        accessibilityLabel={onEdit ? 'Edit photo caption' : caption.text}
        onPress={() => onEdit?.(sceneId)}
        style={{
          position: 'absolute',
          left: caption.left * sceneWidth,
          top: caption.top * sceneWidth,
          width: caption.width * sceneWidth,
          minHeight: caption.height * sceneWidth,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 9 / referenceScale,
          backgroundColor: '#FBF7EC',
          borderRadius: 2,
          ...VISION_SHADOW.contact,
        }}
      >
        <Text
          allowFontScaling={false}
          onTextLayout={onReady ? event => { if(event.nativeEvent.lines.length)onReady(sceneId); } : undefined}
          style={{
            fontFamily: caption.fontFamily,
            fontSize: caption.fontSize * sceneWidth,
            lineHeight: caption.lineHeight * sceneWidth,
            color: VISION_CAPTION_COLOR,
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {caption.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
});
