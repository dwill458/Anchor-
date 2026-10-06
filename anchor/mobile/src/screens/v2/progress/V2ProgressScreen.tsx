import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2Button, V2SectionHeader } from '@/components/v2';
import { useV2Progress } from '@/hooks/v2/progress';
import {
  V2ProgressHero,
  V2ProgressWeekCard,
  V2ProgressRhythm,
  V2ProgressRoute,
  V2ProgressWeeklyInsight,
  V2ProgressAnchorSheet,
  V2ProgressGhostCard,
  V2EvidenceSummary,
  V2ThreadEventTimeline,
  V2ThreadEventDetailSheet,
} from '@/components/v2/progress';
import { progressTokens } from '@/components/v2/progress/progressTokens';

export interface V2ProgressScreenProps {
  anchorId?: string;
  onBack?: () => void;
  onNavigateToChart?: (anchorId: string) => void;
  // DEFERRED: the Vision pill left the header; kept in the contract so hosts that pass it still type-check.
  onNavigateToVision?: (anchorId: string) => void;
  onNavigateToPractice?: (anchorId: string) => void;
  /** Opens the full Weekly Insight. Without it the insight card is read-only. */
  onNavigateToWeeklyInsight?: (anchorId: string) => void;
  testID?: string;
}

export const V2ProgressScreen: React.FC<V2ProgressScreenProps> = ({
  anchorId,
  onBack,
  onNavigateToChart,
  onNavigateToWeeklyInsight,
  testID = 'v2-progress-screen',
}) => {
  const insets = useSafeAreaInsets();
  const {
    model,
    loading,
    error,
    selectedEvent,
    setSelectedEvent,
    refresh,
    range,
    setRange,
    anchors,
    selectAnchor,
  } = useV2Progress({ anchorId });

  const [refreshing, setRefreshing] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-loading`}>
        <ActivityIndicator size="large" color={colors.cream} />
        <Text style={styles.loadingText}>Gathering your progress...</Text>
      </View>
    );
  }

  if (error && !model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-error`}>
        <Text style={styles.errorTitle}>Unable to load progress</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <V2Button variant="primary" onPress={refresh} style={styles.retryBtn}>
          Retry
        </V2Button>
      </View>
    );
  }

  if (!model) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]} testID={`${testID}-empty`}>
        <Text style={styles.emptyTitle}>No Anchor Selected</Text>
        <Text style={styles.emptySubtext}>Select or create an Anchor to view progress and evidence.</Text>
        {onBack && (
          <V2Button variant="tertiary" onPress={onBack}>
            Go Back
          </V2Button>
        )}
      </View>
    );
  }

  const canSwitch = anchors.length > 1;
  // A brand-new Anchor has only its creation event, which is not progress; the ghost says what comes next.
  const historyEvents = model.unmeasured
    ? model.events.filter((event) => event.type !== 'ANCHOR_CREATED')
    : model.events;

  return (
    <View style={styles.root} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor={progressTokens.heroBg} animated />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.cream}
            colors={[colors.ink.base]}
            progressBackgroundColor={colors.cream}
          />
        }
      >
        {/* Ink hero. The filler above it keeps the pull-down and overscroll area ink rather than cream. */}
        <View style={[styles.hero, { paddingTop: insets.top }]}>
          <View style={styles.overscroll} pointerEvents="none" />

          <View style={styles.header}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                style={styles.iconButton}
                testID={`${testID}-back-btn`}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <ArrowLeft size={18} color={progressTokens.heroText} />
              </Pressable>
            ) : (
              <View style={styles.headerSpacer} />
            )}

            <Pressable
              onPress={canSwitch ? () => setSwitcherOpen(true) : undefined}
              disabled={!canSwitch}
              style={styles.switcher}
              testID={`${testID}-anchor-switcher`}
              accessibilityRole={canSwitch ? 'button' : undefined}
              accessibilityLabel={`${categoryLabel(model.category)} Anchor${canSwitch ? ', switch Anchor' : ''}`}
            >
              <View style={[styles.switcherDot, { backgroundColor: getCategoryColor(model.category) }]} />
              <Text style={styles.switcherText} numberOfLines={1}>
                {categoryLabel(model.category)}
              </Text>
              {canSwitch ? <ChevronDown size={13} color={progressTokens.heroText} strokeWidth={2.6} /> : null}
            </Pressable>

            <View style={styles.headerSpacer} />
          </View>

          <V2ProgressHero model={model} testID={`${testID}-hero`} />
        </View>

        <View style={styles.body}>
          {/* This week */}
          {model.week ? (
            <View style={styles.section}>
              <V2SectionHeader title="This week" />
              <V2ProgressWeekCard
                week={model.week}
                streak={model.streak}
                longestRhythm={model.rhythm?.Year.bestRun}
                testID={`${testID}-week`} />
            </View>
          ) : null}

          {/* Rhythm */}
          {model.unmeasured ? (
            <View style={styles.section}>
              <V2ProgressGhostCard
                testID={`${testID}-rhythm-empty`}
                title="Your rhythm will draw itself here."
                body="A calendar, minutes practiced and how steady you are, all from sessions you actually complete."
              />
            </View>
          ) : model.rhythm && model.heatmap ? (
            <View style={styles.section}>
              <V2SectionHeader title="Rhythm" />
              <V2ProgressRhythm model={model} range={range} onRangeChange={setRange} testID={`${testID}-rhythm`} />
            </View>
          ) : null}

          {/* How you practice */}
          {!model.unmeasured ? (
            <View style={styles.section}>
              <V2EvidenceSummary model={model} testID={`${testID}-summary`} />
            </View>
          ) : null}

          {/* Your route */}
          {model.route ? (
            <View style={styles.section}>
              <V2ProgressRoute
                route={model.route}
                category={model.category}
                onOpenChart={onNavigateToChart ? () => onNavigateToChart(model.anchorId) : undefined}
                testID={`${testID}-route`}
              />
            </View>
          ) : model.unmeasured ? (
            <View style={styles.section}>
              <V2ProgressGhostCard
                testID={`${testID}-route-empty`}
                title="Nothing on your route yet."
                body="Add a Chart and your waypoints appear here as you reach them."
              />
            </View>
          ) : null}

          {/* DEFERRED: "In your words" reflections card. It is not part of the redesigned screen; V2ProgressReflections and model.reflections remain. */}

          {/* Course log */}
          <View style={styles.section}>
            <V2ThreadEventTimeline
              events={historyEvents}
              onSelectEvent={setSelectedEvent}
              testID={`${testID}-timeline`}
            />
          </View>

          {/* Weekly Insight: an interpretation of this week; it opens the full view when the host can. */}
          {model.insight ? (
            <View style={styles.section}>
              <V2ProgressWeeklyInsight
                insight={model.insight}
                onPress={onNavigateToWeeklyInsight ? () => onNavigateToWeeklyInsight(model.anchorId) : undefined}
                testID={`${testID}-weekly-insight`}
              />
            </View>
          ) : null}

          {/* DEFERRED: Vision/Chart "triangle" shortcut pills. Chart is reached from the route card; the Vision pill is not part of the redesign.
          {onNavigateToVision && (
            <Pressable onPress={() => onNavigateToVision(model.anchorId)} testID={`${testID}-nav-vision`}> Vision (See) </Pressable>
          )} */}
        </View>
      </ScrollView>

      {/* DEFERRED: header refresh icon. Pull-to-refresh stays; the explicit RefreshCw button is gone. */}

      <V2ThreadEventDetailSheet
        event={selectedEvent}
        route={model.route}
        visible={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        testID={`${testID}-event-detail`}
      />

      <V2ProgressAnchorSheet
        visible={switcherOpen}
        anchors={anchors}
        selectedAnchorId={model.anchorId}
        onSelect={selectAnchor}
        onClose={() => setSwitcherOpen(false)}
        testID={`${testID}-anchor-sheet`}
      />
    </View>
  );
};

const HERO_RADIUS = 34;
const OVERSCROLL = 1200;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: progressTokens.bodyBg },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.ink.base,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: { ...typography.caption, color: colors.ink.text.secondary, marginTop: spacing.md },
  errorTitle: { ...typography.headingMD, color: colors.ink.text.primary, marginBottom: spacing.xs },
  errorSubtext: {
    ...typography.bodyMD,
    color: colors.ink.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryBtn: { minWidth: 140 },
  emptyTitle: { ...typography.headingMD, color: colors.ink.text.primary, marginBottom: spacing.xs },
  emptySubtext: {
    ...typography.bodyMD,
    color: colors.ink.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  scrollContent: { paddingBottom: spacing.xxl },
  hero: {
    backgroundColor: progressTokens.heroBg,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
  },
  overscroll: {
    position: 'absolute',
    top: -OVERSCROLL,
    left: 0,
    right: 0,
    height: OVERSCROLL,
    backgroundColor: progressTokens.heroBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: spacing.sm,
    paddingBottom: 18,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 230,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
  },
  switcherDot: { width: 8, height: 8, borderRadius: 4 },
  switcherText: { ...typography.labelMD, color: progressTokens.heroText, flexShrink: 1 },
  body: { paddingHorizontal: 18, paddingTop: 22 },
  section: { marginBottom: 26 },
});
