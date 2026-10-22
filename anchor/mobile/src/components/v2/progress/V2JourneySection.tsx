import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Flag } from 'lucide-react-native';
import { radii, typography } from '@/theme/v2';
import { VisionEditorialPreview } from '@/components/v2/vision/VisionEditorialPreview';
import type { VisionEditorialTile } from '@/components/v2/vision/visionEditorialLayout';
import { formatFocusTime, type JourneyState } from '@/adapters/v2/progress/journeyAdapter';
import { formatProgressDate } from '@/adapters/v2/progress/progressAdapter';
import type {
  V2ProgressLifetimeStats,
  V2ProgressRecentReflection,
  V2ProgressRouteSummary,
} from '@/adapters/v2/progress/types';
import { V2ProgressRoute } from './V2ProgressRoute';
import { progressTokens } from './progressTokens';

export interface JourneyVisionData {
  tiles: readonly VisionEditorialTile[];
  featuredTileId?: string;
  statement?: string;
}

export interface V2JourneySectionProps {
  state: JourneyState;
  category?: string | null;
  route?: V2ProgressRouteSummary | null;
  vision?: JourneyVisionData | null;
  recentReflection?: V2ProgressRecentReflection | null;
  lifetime?: V2ProgressLifetimeStats;
  /** Opening any of these goes through the app's existing screens, which own premium gating. */
  onOpenChart?: () => void;
  onOpenVision?: () => void;
  testID?: string;
}

const SUBTITLE: Record<Exclude<JourneyState, 'loading'>, string> = {
  chartVision: 'Vision and chart working together.',
  chartOnly: 'Your path toward this intention.',
  visionOnly: 'Your vision guides this intention.',
  practiceFirst: 'Built through your practice.',
};

const imageTiles = (vision?: JourneyVisionData | null) => (vision?.tiles ?? []).filter((t) => Boolean(t.imageUrl));

/** One real image from the board, for the compact Vision row. No collage is invented. */
function visionThumbnail(vision?: JourneyVisionData | null): string | null {
  const withImage = imageTiles(vision);
  const featured = withImage.find((t) => t.id === vision?.featuredTileId) ?? withImage.find((t) => t.isHero) ?? withImage[0];
  return featured?.imageUrl ?? null;
}

const VisionRow: React.FC<{ vision?: JourneyVisionData | null; onPress?: () => void; testID: string }> = ({
  vision,
  onPress,
  testID,
}) => {
  const uri = visionThumbnail(vision);
  const [failed, setFailed] = React.useState<string | null>(null);
  const showImage = Boolean(uri) && failed !== uri;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Vision"
      style={styles.row}
      testID={testID}
    >
      <View style={styles.thumb} testID={`${testID}-thumb`}>
        {showImage ? (
          <Image source={{ uri: uri! }} style={styles.thumbImage} resizeMode="cover" onError={() => setFailed(uri)} />
        ) : null}
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>Your Vision</Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {vision?.statement?.trim() || 'The life you’re building.'}
        </Text>
      </View>
      {onPress ? <ChevronRight size={18} color={progressTokens.muted} /> : null}
    </Pressable>
  );
};

const NextMove: React.FC<{ title: string; onPress?: () => void; testID: string }> = ({ title, onPress, testID }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole="button"
    accessibilityLabel={`Next move: ${title}`}
    style={styles.row}
    testID={testID}
  >
    <View style={styles.moveIcon}>
      <Flag size={16} color={progressTokens.current} />
    </View>
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle}>Next move</Text>
      <Text style={styles.rowSub} numberOfLines={2}>
        {title}
      </Text>
    </View>
    {onPress ? <ChevronRight size={18} color={progressTokens.muted} /> : null}
  </Pressable>
);

const Reflection: React.FC<{ reflection?: V2ProgressRecentReflection | null; testID: string }> = ({ reflection, testID }) => {
  const date = formatProgressDate(reflection?.occurredAt);
  return (
    <View style={styles.reflection} testID={testID}>
      {reflection ? (
        <>
          <Text style={styles.rowTitle}>Recent reflection</Text>
          <Text style={styles.quote} numberOfLines={3}>{`“${reflection.text}”`}</Text>
          {date ? <Text style={styles.rowSub}>{date}</Text> : null}
        </>
      ) : (
        <Text style={styles.rowSub}>Your Vision is here whenever you want to return to it.</Text>
      )}
    </View>
  );
};

/**
 * "Your Journey": progress toward the intention, adapted to what this Anchor actually has.
 * Never draws a Vision or Chart placeholder, never a percentage Vision cannot back, and holds
 * a fixed-height skeleton while Chart and Vision are still being read.
 */
export const V2JourneySection: React.FC<V2JourneySectionProps> = ({
  state,
  category,
  route,
  vision,
  recentReflection,
  lifetime,
  onOpenChart,
  onOpenVision,
  testID = 'v2-progress-journey',
}) => {
  if (state === 'loading') {
    return <View style={[styles.card, styles.skeleton]} testID={`${testID}-loading`} accessibilityLabel="Loading your journey" />;
  }

  const hasImages = imageTiles(vision).length > 0;
  const showRoute = (state === 'chartVision' || state === 'chartOnly') && route;

  return (
    <View style={styles.card} testID={testID} accessibilityLabel="Your Journey">
      <View style={styles.header}>
        <Text style={styles.heading}>YOUR JOURNEY</Text>
        <Text style={styles.subtitle}>{SUBTITLE[state]}</Text>
      </View>

      {state === 'chartVision' ? <VisionRow vision={vision} onPress={onOpenVision} testID={`${testID}-vision`} /> : null}

      {showRoute ? (
        <View style={styles.block}>
          <V2ProgressRoute route={route} hideHeader category={category} onOpenChart={onOpenChart} testID={`${testID}-route`} />
        </View>
      ) : null}

      {showRoute && route.oneMoveTitle ? (
        <NextMove title={route.oneMoveTitle} onPress={onOpenChart} testID={`${testID}-next-move`} />
      ) : null}

      {state === 'visionOnly' ? (
        <>
          <View style={styles.block} testID={`${testID}-vision`}>
            {hasImages ? (
              <VisionEditorialPreview
                tiles={vision!.tiles}
                featuredTileId={vision!.featuredTileId}
                statement={vision!.statement}
                variant="home"
                onPress={onOpenVision}
                accessibilityLabel="Open Vision"
                testID={`${testID}-vision-board`}
              />
            ) : (
              <VisionRow vision={vision} onPress={onOpenVision} testID={`${testID}-vision-row`} />
            )}
          </View>
          <Reflection reflection={recentReflection} testID={`${testID}-reflection`} />
        </>
      ) : null}

      {state === 'practiceFirst' ? (
        <PracticeFirst lifetime={lifetime} onOpenChart={onOpenChart} onOpenVision={onOpenVision} testID={testID} />
      ) : null}
    </View>
  );
};

const PracticeFirst: React.FC<{
  lifetime?: V2ProgressLifetimeStats;
  onOpenChart?: () => void;
  onOpenVision?: () => void;
  testID: string;
}> = ({ lifetime, onOpenChart, onOpenVision, testID }) => {
  const practices = lifetime?.practices ?? 0;
  const since = formatProgressDate(lifetime?.firstPracticeAt);
  const summary =
    practices > 0
      ? `${practices} ${practices === 1 ? 'practice' : 'practices'} across ${lifetime!.activeDays} ${lifetime!.activeDays === 1 ? 'day' : 'days'}${since ? `, since ${since}` : ''}.`
      : 'Your first practice starts this record.';
  return (
    <View testID={`${testID}-practice-first`}>
      <View style={styles.block}>
        <Text style={styles.quote}>{summary}</Text>
        {practices > 0 ? (
          <Text style={styles.rowSub}>{`${formatFocusTime(lifetime!.totalSeconds)} of focused time so far.`}</Text>
        ) : null}
      </View>
      {onOpenVision || onOpenChart ? (
        <View style={styles.invite}>
          <Text style={styles.rowSub}>Give your intention a direction, when you’re ready.</Text>
          <View style={styles.inviteRow}>
            {onOpenVision ? (
              <Pressable onPress={onOpenVision} accessibilityRole="button" style={styles.chip} testID={`${testID}-create-vision`}>
                <Text style={styles.chipText}>Create a Vision</Text>
              </Pressable>
            ) : null}
            {onOpenChart ? (
              <Pressable onPress={onOpenChart} accessibilityRole="button" style={styles.chip} testID={`${testID}-create-chart`}>
                <Text style={styles.chipText}>Create a Chart</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    padding: 16,
    gap: 12,
  },
  skeleton: { minHeight: 220 },
  header: { gap: 2 },
  heading: { ...typography.labelSM, fontSize: 11, letterSpacing: 1.6, color: progressTokens.text },
  subtitle: { ...typography.bodySM, color: progressTokens.muted },
  block: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.labelMD, color: progressTokens.text },
  rowSub: { ...typography.bodySM, color: progressTokens.muted, lineHeight: 18 },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: progressTokens.chip,
  },
  thumbImage: { width: '100%', height: '100%' },
  moveIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: progressTokens.chip,
  },
  reflection: { gap: 4, paddingTop: 4 },
  quote: { fontFamily: progressTokens.serif, fontSize: 16, lineHeight: 22, color: progressTokens.text },
  invite: { gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: progressTokens.hairline },
  inviteRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: progressTokens.chip,
  },
  chipText: { ...typography.labelMD, fontSize: 12, color: progressTokens.text },
});
