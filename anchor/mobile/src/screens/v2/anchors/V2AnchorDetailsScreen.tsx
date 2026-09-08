import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Compass, ImagePlus } from 'lucide-react-native';
import {
  CircularAnchorRenderer,
  V2Button,
  V2Divider,
  V2EmptyState,
  V2ListRow,
  V2Screen,
  V2ThreadStrength,
  V2TopBar,
} from '@/components/v2';
import {
  V2AnchorRecentPractice,
  V2FormationProvenance,
  anchorArtworkSvg,
  categoryLabel,
  shortDate,
} from '@/components/v2/anchors';
import { useV2AnchorDetail } from '@/hooks/v2/anchors';
import { threadQualitativeLabel } from '@/adapters/v2/home';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import { v2Haptics } from '@/hooks/v2';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2DailyShellIntents, type V2DailyShellParamList } from '@/screens/v2/home/dailyShell';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Route = RouteProp<V2DailyShellParamList, 'V2AnchorDetails'>;

const track = (name: string, properties: Record<string, unknown> = {}) => {
  try {
    AnalyticsService.track(name, properties);
  } catch {
    /* no-op */
  }
};

/** Permanent, clean profile for one Anchor. No merch, talisman, analytics dump, or destructive burn UI. */
export function V2AnchorDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const intents = useV2DailyShellIntents();
  const detail = useV2AnchorDetail(params.anchorId);
  const { anchor, thread, provenance } = detail;

  useEffect(() => {
    if (anchor) track('v2_anchor_details_viewed', { category: anchor.category });
  }, [anchor?.id]);

  if (!anchor || !thread || !provenance) {
    return (
      <V2Screen testID="v2-anchor-details-screen">
        <V2TopBar title="Anchor" onBackPress={() => navigation.goBack()} />
        <V2EmptyState title="Anchor not found" message="This Anchor may have been removed." />
      </V2Screen>
    );
  }

  const anchorId = anchor.localId ?? anchor.id;
  const qualitative = threadQualitativeLabel(thread.value, thread.unmeasured);

  return (
    <V2Screen scroll testID="v2-anchor-details-screen">
      <V2TopBar title="" onBackPress={() => navigation.goBack()} />

      <View style={styles.hero}>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          category={anchor.category}
          size="hero"
          accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
        />
        <Text accessibilityRole="header" style={styles.intention}>
          {anchor.intentionText}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.dash, { backgroundColor: getCategoryColor(anchor.category) }]} />
          <Text style={styles.category}>{categoryLabel(anchor.category).toUpperCase()}</Text>
        </View>
        <Text style={styles.created}>Created {shortDate(anchor.createdAt)}</Text>
      </View>

      <View style={styles.threadBlock}>
        <V2ThreadStrength
          value={thread.value}
          category={thread.category}
          delta={thread.delta}
          trend={thread.trend}
          detail={thread.detail ?? qualitative}
          onPress={() => {
            track('v2_anchor_details_progress_tapped');
            intents.onOpenProgress(anchorId);
          }}
        />
        {detail.practiceCount > 0 ? (
          <Text style={styles.threadEvidence}>
            {detail.practiceCount} session{detail.practiceCount === 1 ? ' has' : 's have'} strengthened this Anchor.
          </Text>
        ) : (
          <Text style={styles.threadEvidence}>No practice recorded for this Anchor yet.</Text>
        )}
      </View>

      <V2Button
        accessibilityLabel="Practice this Anchor"
        onPress={() => {
          v2Haptics.selection();
          track('v2_anchor_details_practice_tapped');
          intents.onOpenPractice(anchorId);
        }}
        style={styles.primaryCta}
      >
        Practice this Anchor
      </V2Button>

      <V2Divider style={styles.divider} />
      <V2FormationProvenance provenance={provenance} />
      <V2Divider style={styles.divider} />

      <V2AnchorRecentPractice
        entries={detail.recentPractice}
        totalCount={detail.practiceCount}
        onSeeAll={() => intents.onOpenProgress(anchorId)}
      />

      <View style={styles.contextual}>
        <V2ListRow
          icon={<ImagePlus size={18} color={colors.text.primary} />}
          title="Vision"
          subtitle="The future this Anchor points at"
          disclosure
          onPress={() => {
            track('v2_anchor_details_vision_tapped');
            intents.onOpenVision(anchorId);
          }}
        />
        <V2Divider />
        <V2ListRow
          icon={<Compass size={18} color={colors.text.primary} />}
          title="Chart"
          subtitle="The course this Anchor is on"
          disclosure
          onPress={() => {
            track('v2_anchor_details_chart_tapped');
            intents.onOpenChart(anchorId);
          }}
        />
      </View>

      <V2Button
        variant="tertiary"
        accessibilityLabel="Release this Anchor"
        onPress={() => {
          track('v2_anchor_details_release_tapped');
          intents.onReleaseAnchor(anchorId);
        }}
        style={styles.release}
      >
        Release Anchor
      </V2Button>
    </V2Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[5] },
  intention: { ...typography.displayMedium, color: colors.text.primary, textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dash: { width: 16, height: 2, borderRadius: 2 },
  category: { ...typography.labelSM, color: colors.text.secondary },
  created: { ...typography.caption, color: colors.text.secondary },
  threadBlock: { gap: spacing[2], marginBottom: spacing[5] },
  threadEvidence: { ...typography.bodySM, color: colors.text.secondary },
  primaryCta: { marginBottom: spacing[6] },
  divider: { marginVertical: spacing[5] },
  contextual: { marginTop: spacing[6] },
  release: { marginTop: spacing[6], alignSelf: 'flex-start' },
});
