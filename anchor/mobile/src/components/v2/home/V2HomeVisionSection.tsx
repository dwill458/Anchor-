import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VisionBoardPreview } from '@/components/v2/vision/VisionBoardPreview';
import { colors, typography } from '@/theme/v2';
import { resolveVisionHeroImage, type HomeVisionState } from '@/adapters/v2/home';
import { v2Haptics } from '@/hooks/v2';

type Props = {
  vision: HomeVisionState;
  categoryColor?: string;
  onOpenVision?: () => void;
  onRetry?: () => void;
  testID?: string;
};

/** Home distinguishes confirmed empty, loading, error, and saved Vision. */
function V2HomeVisionSectionComponent({ vision, categoryColor, onOpenVision, onRetry, testID }: Props) {
  if (vision.state !== 'ready') return <View testID={testID ?? `v2-home-vision-${vision.state}`} style={styles.container}>
    <Text style={styles.title}>Your Vision</Text>
    <Text style={[styles.seen, { marginTop: 8 }]}>{vision.state === 'loading' ? 'Loading your Vision�' : vision.state === 'error' ? 'Your Vision could not load.' : 'See where this is going.'}</Text>
    {vision.state !== 'loading' ? <Pressable accessibilityRole="button" onPress={vision.state === 'error' ? onRetry : onOpenVision}
      style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.seen}>{vision.state === 'error' ? 'Retry Vision' : 'Create Vision'}</Text></Pressable> : null}
  </View>;

  const heroImage = resolveVisionHeroImage(vision);
  const title = vision.title?.trim();
  const statement = title || vision.previewText?.trim();
  if (!heroImage && !statement) return null;
  const open = () => { if (onOpenVision) { v2Haptics.selection(); onOpenVision(); } };
  return (
    <View style={styles.container}>
      <View style={styles.kickerRow}>
        <Text style={styles.title}>Your Vision</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all Vision" onPress={open} disabled={!onOpenVision} hitSlop={8}>
          <Text style={styles.seen}>View all ›</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 10 }}>
        <VisionBoardPreview key={vision.visionId} tiles={vision.tiles ?? []} statement={statement} accent={categoryColor}
          onPress={onOpenVision ? open : undefined} accessibilityLabel={vision.seenToday ? 'Revisit your Vision' : 'Enter your Vision'}
          testID={testID ?? 'v2-home-vision'} imageTestID="v2-home-vision-image"
          statementTestID={title ? 'v2-home-vision-title' : 'v2-home-vision-statement'} />
      </View>
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
  title: { ...typography.headingSM, color: colors.graphite.text.primary },
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
