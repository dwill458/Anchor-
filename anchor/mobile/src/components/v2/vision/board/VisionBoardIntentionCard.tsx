import React, { memo, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { AnchorExpression } from '@/constants/v2/creation';
import { BOARD_CARD_PIN, VISION_BOARD_IMAGES } from './visionBoardAssets';
import type { SceneRect } from './visionBoardLayouts';
import { boardRecomposeEasing, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';

/** Ink for the Anchor drawn onto paper, and for the handwritten-feeling intention. */
const INK = '#1E2126';
const INK_SOFT = 'rgba(30,33,38,0.55)';

export type VisionBoardCardArt = { svg: string; category?: string | null; expression?: AnchorExpression | null };

/** Longer intentions get a smaller hand so they still sit inside the paper. */
export function intentionTypeScale(intention: string): { fontScale: number; lines: number } {
  const length = intention.trim().length;
  if (length <= 32) return { fontScale: 1, lines: 3 };
  if (length <= 64) return { fontScale: 0.8, lines: 3 };
  if (length <= 110) return { fontScale: 0.64, lines: 4 };
  return { fontScale: 0.56, lines: 4 };
}

type Props = {
  rect: SceneRect;
  intention: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  reduceMotion: boolean;
  onPress?: () => void;
  anchorTestID?: string;
};

/**
 * The board's centre: a blank torn sheet with the person's real Anchor
 * structure drawn in ink and their intention written beneath it. Nothing is
 * baked into the paper, so it works for every Anchor.
 */
export const VisionBoardIntentionCard = memo(function VisionBoardIntentionCard({
  rect, intention, category, art, reduceMotion, onPress, anchorTestID,
}: Props) {
  const x = useSharedValue(rect.x);
  const y = useSharedValue(rect.y);
  const width = useSharedValue(rect.width);
  const height = useSharedValue(rect.height);
  const rotation = useSharedValue(rect.rotation);
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

  // Type is laid out for the target size; the card's own motion is small.
  const markSize = rect.width * 0.52;
  const { fontScale, lines } = intentionTypeScale(intention);
  const fontSize = rect.width * 0.128 * fontScale;
  const label = `Your Anchor, ${categoryLabel(category)}. ${intention}`;

  const content = (
    <>
      <Image source={VISION_BOARD_IMAGES.intentionPaper} resizeMode="stretch" accessible={false} style={styles.fill} />
      <View style={styles.content} pointerEvents="none">
        <View style={{ width: markSize, height: markSize, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={VISION_BOARD_IMAGES.compassRose} resizeMode="contain" accessible={false}
            style={[styles.compass, { width: markSize * 1.32, height: markSize * 1.32 }]} />
          {art?.svg ? (
            // The Anchor's own structure, drawn in ink as if by hand on the paper: foil
            // and colour expressions belong to the Anchor's screens, not to this sheet.
            <AnchorMark testID={anchorTestID} svg={art.svg} category={art.category ?? category}
              size={markSize} strokeColor={INK} accessibilityLabel={`${categoryLabel(category)} Anchor`} />
          ) : (
            <View testID={anchorTestID} style={[styles.markFallback, { width: markSize * 0.7, height: markSize * 0.7, borderRadius: markSize }]} />
          )}
        </View>
        <Text numberOfLines={lines} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.intention, { fontSize, lineHeight: fontSize * 1.22 }]}>
          {intention}
        </Text>
        <View style={[styles.underline, { width: rect.width * 0.34 }]} />
      </View>
      <Image source={BOARD_CARD_PIN} resizeMode="contain" accessible={false}
        style={[styles.pin, { width: rect.width * 0.1, height: rect.width * 0.1, left: rect.width * 0.45, top: rect.width * 0.02 }]} />
    </>
  );

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
  content: { position: 'absolute', left: '11%', right: '11%', top: '13%', bottom: '10%', alignItems: 'center', justifyContent: 'center' },
  compass: { position: 'absolute', opacity: 0.16 },
  markFallback: { borderWidth: 1.5, borderColor: INK_SOFT },
  intention: { fontFamily: 'CrimsonPro-Italic', color: INK, textAlign: 'center', marginTop: '7%' },
  underline: { height: 1.5, marginTop: '4%', backgroundColor: 'rgba(139,46,46,0.55)', borderRadius: 1 },
  pin: { position: 'absolute' },
});
