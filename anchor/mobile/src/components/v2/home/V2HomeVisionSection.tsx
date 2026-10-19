import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import { VisionEditorialPreview } from '@/components/v2/vision/VisionEditorialPreview';
import { useVisionEditorialNotes } from '@/components/v2/vision/useVisionEditorialNotes';
import { colors, typography } from '@/theme/v2';
import { resolveVisionHeroImage, type HomeVisionState } from '@/adapters/v2/home';
import { v2Haptics } from '@/hooks/v2';

type Props = {
  vision: HomeVisionState;
  categoryColor?: string;
  onOpenVision?: () => void;
  onRetry?: () => void;
  /** The first Vision image's return to Home: the label and the print settle in through these. Absent, both are plain. */
  arrival?: { label: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle>; body: StyleProp<ViewStyle> | AnimatedStyle<ViewStyle> };
  testID?: string;
};

/** Home shows Vision only when this Anchor has one; empty, loading and error render nothing. */
function V2HomeVisionSectionComponent({ vision, categoryColor, onOpenVision, arrival, testID }: Props) {
  const noteElements = useVisionEditorialNotes(vision.state === 'ready' ? vision.notes : undefined);
  if (vision.state !== 'ready') return null;

  const heroImage = resolveVisionHeroImage(vision);
  const title = vision.title?.trim();
  const statement = title || vision.previewText?.trim();
  if (!heroImage && !statement && noteElements.length === 0) return null;
  const open = () => { if (onOpenVision) { v2Haptics.selection(); onOpenVision(); } };
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.kickerRow, arrival?.label]}>
        <Text style={styles.title}>Your Vision</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all Vision" onPress={open} disabled={!onOpenVision} hitSlop={8}>
          <Text style={styles.seen}>View all ›</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={[{ marginTop: 10 }, arrival?.body]}>
        <VisionEditorialPreview key={vision.visionId} variant="home" tiles={vision.tiles ?? []} featuredTileId={vision.featuredTileId}
          noteElements={noteElements} statement={statement} accent={categoryColor}
          onPress={onOpenVision ? open : undefined} accessibilityLabel={vision.seenToday ? 'Revisit your Vision' : 'Enter your Vision'}
          testID={testID ?? 'v2-home-vision'} imageTestID="v2-home-vision-image"
          statementTestID={title ? 'v2-home-vision-title' : 'v2-home-vision-statement'} />
      </Animated.View>
      {vision.seenToday ? <Text style={[styles.seen, { marginTop: 8 }]}>Seen today</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tighter than Today's other dividers on purpose: Today flows into Vision
  // rather than floating apart from it as an unrelated module.
  container: {
    marginTop: 30,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'BricolageGrotesque-SemiBold',
    fontSize: 18,
    lineHeight: 23,
    color: colors.graphite.text.primary,
  },
  seen: {
    ...typography.bodySM,
    color: colors.graphite.text.secondary,
  },

});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeVisionSection = memo(V2HomeVisionSectionComponent);
