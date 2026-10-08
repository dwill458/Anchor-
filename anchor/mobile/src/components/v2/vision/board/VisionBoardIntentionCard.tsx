import { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { useVisionImageArrival } from '../VisionImageArrival';

import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { AnchorExpression } from '@/constants/v2/creation';
import type { SceneRect } from './visionBoardLayouts';
import { boardRecomposeEasing, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';

export type VisionBoardCardArt = { svg: string; imageUrl?: string | null; category?: string | null; expression?: AnchorExpression | null };

type Props = {
  rect: SceneRect;
  intention: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  reduceMotion: boolean;
  onPress?: () => void;
  anchorTestID?: string;
  /** `paper` sets the mark on an ivory medallion; `bare` leaves the strokes free on the card. */
  markAppearance?: 'bare' | 'paper';
  /** A cinematic compositor can own the same mark without duplicating it. */
  hideMark?: boolean;
  onMarkLayout?: (rect: LayoutRectangle) => void;
  /** Optional independent layers for the cinematic return; ordinary boards default to fully visible. */
  paperOpacity?: SharedValue<number>;
  pinOpacity?: SharedValue<number>;
  onTeachingMotionChange?: (sceneId: string, moving: boolean) => void;
};

/** The persisted Anchor SVG connects the photographs without repeating the intention. */
export const VisionBoardIntentionCard = memo(function VisionBoardIntentionCard({
  rect, intention, category, art, reduceMotion, onPress, anchorTestID, markAppearance = 'bare', hideMark = false, onMarkLayout,
  paperOpacity, pinOpacity, onTeachingMotionChange,
}: Props) {
  const arrival = useVisionImageArrival();
  const markSlot = useRef<View>(null);
  // When a chosen image arrives with the person's Anchor, tell it where the board holds the mark.
  const landAnchor = () => {
    if (!arrival?.anchorInFlight) return;
    markSlot.current?.measureInWindow?.((x, y, width, height) => arrival.landAnchor({ x, y, width, height }));
  };
  useEffect(landAnchor, [arrival?.anchorInFlight]); // eslint-disable-line react-hooks/exhaustive-deps
  const contentLayout = useRef<LayoutRectangle | null>(null);
  const markLayout = useRef<LayoutRectangle | null>(null);
  const reportMark = () => {
    const content = contentLayout.current;
    const mark = markLayout.current;
    if (content && mark) onMarkLayout?.({ x: content.x + mark.x, y: content.y + mark.y, width: mark.width, height: mark.height });
  };
  const x = useSharedValue(rect.x);
  const y = useSharedValue(rect.y);
  const width = useSharedValue(rect.width);
  const height = useSharedValue(rect.height);
  const rotation = useSharedValue(rect.rotation);
  useAnimatedReaction(() => Boolean(onTeachingMotionChange) && (
    Math.abs(x.value - rect.x) > 0.1 || Math.abs(y.value - rect.y) > 0.1 ||
    Math.abs(width.value - rect.width) > 0.1 || Math.abs(height.value - rect.height) > 0.1 || Math.abs(rotation.value - rect.rotation) > 0.05
  ), (moving, previous) => { if (onTeachingMotionChange && moving !== previous) runOnJS(onTeachingMotionChange)('anchor-card', moving); }, [rect, onTeachingMotionChange]);
  useEffect(() => () => onTeachingMotionChange?.('anchor-card', false), [onTeachingMotionChange]);
  useEffect(() => {
    const config = reduceMotion
      ? { duration: MOTION.reduced.recomposeMs }
      : { duration: MOTION.recompose.moveMs, easing: boardRecomposeEasing };
    x.value = boardTiming(rect.x, config);
    y.value = boardTiming(rect.y, config);
    width.value = boardTiming(rect.width, config);
    height.value = boardTiming(rect.height, config);
    rotation.value = boardTiming(rect.rotation, config);
  }, [height, rect, reduceMotion, rotation, width, x, y]);

  const style = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const paperStyle = useAnimatedStyle(() => ({ opacity: paperOpacity?.value ?? 1 }));

  // Type is laid out for the target size; the card's own motion is small.
  const paper = markAppearance === 'paper';
  const markSize = paper ? rect.width * 0.94 : rect.width * 0.86;
  const label = `Your Anchor, ${categoryLabel(category)}. ${intention}`;
  const content = <Animated.View style={[styles.fill, paperStyle]}>
    <View testID="vision-board-card-content" style={styles.content} pointerEvents="none"
      onLayout={onMarkLayout ? event => { contentLayout.current = event.nativeEvent.layout; reportMark(); } : undefined}>
      <View ref={markSlot} collapsable={false} testID="vision-board-card-mark-slot" style={{ width: markSize, height: markSize }}
        onLayout={event => {
          if (onMarkLayout) { markLayout.current = event.nativeEvent.layout; reportMark(); }
          landAnchor();
        }}>
        {!hideMark && art?.svg ? <CircularAnchorRenderer testID={anchorTestID} svg={art.svg} imageUrl={art.imageUrl}
          expression={art.expression} category={art.category ?? category} appearance={paper ? 'paper' : 'bare'}
          size={markSize} style={paper ? styles.medallion : undefined} accessibilityLabel={`${categoryLabel(category)} Anchor`} /> : null}
      </View>
    </View>
  </Animated.View>;

  return (
    <Animated.View style={[styles.card, style]}>
      {onPress ? (
        <Pressable style={styles.fill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
          accessibilityHint="Double tap to bring your Anchor forward and edit your Vision.">
          {content}
        </Pressable>
      ) : (
        <View style={styles.fill} accessible accessibilityRole="image" accessibilityLabel={label}>{content}</View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { position: 'absolute', zIndex: 40 },
  fill: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  medallion: { borderWidth: 2, borderColor: 'rgba(23,23,23,0.22)', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  content: { position: 'absolute', left: '7%', right: '7%', top: '7%', bottom: '7%', alignItems: 'center', justifyContent: 'center' },
});
