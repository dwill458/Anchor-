import type { ViewInstance, ScrollViewInstance } from 'react-native';

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
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2Button } from '@/components/v2';
import { useV2Progress } from '@/hooks/v2/progress';
import { useProgressJourney } from '@/hooks/v2/progress/useProgressJourney';
import { useAnchorMilestones } from '@/hooks/v2/milestones/useAnchorMilestones';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import type { Anchor } from '@/types';
import {
  V2ProgressHero,
  V2JourneySection,
  V2CommitmentSection,
  V2MilestoneShelf,
  V2ProgressWeeklyInsight,
  V2ProgressAnchorSheet,
  V2ThreadEventTimeline,
  V2ThreadEventDetailSheet,
} from '@/components/v2/progress';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { useAnchorTransitionDeparture, useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';
import { useAuthStore } from '@/stores/authStore';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { progressTeachingBeats } from '@/hooks/v2/teaching/progressTeaching';
import { ScreenTeaching } from '@/components/v2/teaching/ScreenTeaching';
import { scrollToTarget } from '@/components/v2/teaching/scrollToTarget';

export interface V2ProgressScreenProps {
  anchorId?: string;
  /** Receives the Anchor Progress is showing, so a host can fly it back to where it came from. */
  onBack?: (anchor?: Anchor) => void;
  /** The Anchor currently shown (it changes with the switcher). */
  onAnchorResolved?: (anchor?: Anchor) => void;
  onNavigateToChart?: (anchorId: string) => void;
  /** Opens Vision (existing screen; it owns creation and gating). */
  onNavigateToVision?: (anchorId: string) => void;
  onNavigateToPractice?: (anchorId: string) => void;
  /** Opens every milestone for the Anchor shown. */
  onNavigateToMilestones?: (anchorId: string) => void;
  /** Opens one milestone's detail (and its replay). */
  onNavigateToMilestone?: (anchorId: string, definitionId: string) => void;
  /** Opens the full Weekly Insight. Without it the insight card is read-only. */
  onNavigateToWeeklyInsight?: (anchorId: string) => void;
  testID?: string;
}

export const V2ProgressScreen: React.FC<V2ProgressScreenProps> = ({
  anchorId,
  onBack,
  onAnchorResolved,
  onNavigateToChart,
  onNavigateToVision,
  onNavigateToMilestones,
  onNavigateToMilestone,
  onNavigateToWeeklyInsight,
  testID = 'v2-progress-screen',
}) => {
  const insets = useSafeAreaInsets();
  // The Anchor leaves this screen (Progress -> Details) as its UI fades; the lower sections arrive last when it opens.
  const departure = useAnchorTransitionDeparture('progress');
  const bodyReveal = useAnchorTransitionReveal('progress', 3);
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
  const journey = useProgressJourney(model?.anchorId, model?.route);
  const milestones = useAnchorMilestones(model?.anchorId);
  const milestoneAccountId = useAuthStore(state => state.user?.id ?? null);
  // Earned but never celebrated (another device, an interrupted scene): queue them behind anything playing.
  React.useEffect(() => {
    if (milestones.pendingCelebrations.length > 0) {
      useMilestoneCelebrationStore.getState().enqueueAwards(milestones.pendingCelebrations, milestoneAccountId);
    }
  }, [milestones.pendingCelebrations, milestoneAccountId]);

  const shownAnchor = model ? (anchors.find((a) => a.id === model.anchorId)?.anchor ?? model.anchor) : undefined;
  React.useEffect(() => { onAnchorResolved?.(shownAnchor); }, [onAnchorResolved, shownAnchor]);
  const handleBack = React.useCallback(() => onBack?.(shownAnchor), [onBack, shownAnchor]);

  const [refreshing, setRefreshing] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const teachingFocus = useTeachingFocus();
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const reducedMotion = useV2ReduceMotion();
  const scrollRef = React.useRef<ScrollViewInstance>(null);
  const threadTeachingRef = React.useRef<ViewInstance>(null);
  const weekTeachingRef = React.useRef<ViewInstance>(null);
  const rhythmTeachingRef = React.useRef<ViewInstance>(null);
  const routeTeachingRef = React.useRef<ViewInstance>(null);
  const scrollMetrics = React.useRef({ y: 0, content: 0, viewport: 0 });
  const controlledScroll = React.useRef(false);
  const [scrolling, setScrolling] = React.useState(false);
  const [rangeMoving, setRangeMoving] = React.useState(false);
  const teachingQueue = useTeachingQueue({ screenId: 'progress', accountId: teachingAccountId,
    eligible: model ? progressTeachingBeats({ unmeasured: model.unmeasured, hasWeek: Boolean(model.week), hasRhythm: model.unmeasured || Boolean(model.rhythm && model.heatmap), hasRoute: Boolean(model.route) }) : [],
    cap: 2, isFocused: teachingFocus.isFocused,
    blocked: teachingFocus.transitioning || !model || loading || refreshing || switcherOpen || Boolean(selectedEvent) || rangeMoving || scrolling });
  const getTeachingRect = React.useCallback(async (target: React.RefObject<ViewInstance | null>) => {
    controlledScroll.current = true;
    try {
      return await scrollToTarget(target, scrollRef, () => ({ y: scrollMetrics.current.y, max: Math.max(0, scrollMetrics.current.content - scrollMetrics.current.viewport), viewportTop: 0 }), reducedMotion);
    } finally { controlledScroll.current = false; }
  }, [reducedMotion]);

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
          <V2Button variant="tertiary" onPress={handleBack}>
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
      <StatusBar barStyle="light-content" animated />

      <Animated.View style={[styles.departure, departure]}>
      <ScrollView
        ref={scrollRef}
        onLayout={event => { scrollMetrics.current.viewport = event.nativeEvent.layout.height; }}
        onContentSizeChange={(_width, height) => { scrollMetrics.current.content = height; }}
        onScroll={event => { scrollMetrics.current.y = event.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setScrolling(true)}
        onScrollEndDrag={() => setScrolling(false)}
        onMomentumScrollBegin={() => { if (!controlledScroll.current) setScrolling(true); }}
        onMomentumScrollEnd={() => setScrolling(false)}
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
                onPress={handleBack}
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

            <View style={styles.titleColumn}>
            <Text style={styles.screenTitle}>PROGRESS</Text>
            <Pressable
              onPress={canSwitch ? () => setSwitcherOpen(true) : undefined}
              disabled={!canSwitch}
              style={styles.switcher}
              testID={`${testID}-anchor-switcher`}
              accessibilityRole={canSwitch ? 'button' : undefined}
              accessibilityLabel={`My Anchors${canSwitch ? ', switch Anchor' : ''}`}
            >
              <Text style={styles.switcherText} numberOfLines={1}>
                My Anchors
              </Text>
              {canSwitch ? <ChevronDown size={13} color={progressTokens.heroText} strokeWidth={2.6} /> : null}
            </Pressable>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View ref={threadTeachingRef} collapsable={false}>
            <V2ProgressHero
              model={model}
              anchor={shownAnchor}
              testID={`${testID}-hero`}
            />
          </View>
        </View>

        <Animated.View style={[styles.body, bodyReveal]}>
          {/* Your Journey: adapts to what this Anchor has (Chart, Vision, both or neither). */}
          <View ref={routeTeachingRef} collapsable={false} style={styles.section}>
            <V2JourneySection
              state={journey.state}
              category={model.category}
              route={model.route}
              vision={journey.vision}
              recentReflection={model.recentReflection}
              lifetime={model.lifetime}
              onOpenChart={onNavigateToChart ? () => onNavigateToChart(model.anchorId) : undefined}
              onOpenVision={onNavigateToVision ? () => onNavigateToVision(model.anchorId) : undefined}
              testID={`${testID}-journey`}
            />
          </View>

          {/* Milestones earned for this Anchor. */}
          <View style={styles.section}>
            <V2MilestoneShelf
              records={milestones.records}
              categoryColor={getCategoryColor(model.category)}
              onOpenMilestone={onNavigateToMilestone ? (record) => onNavigateToMilestone(model.anchorId, record.definitionId) : undefined}
              onOpenCollection={onNavigateToMilestones ? () => onNavigateToMilestones(model.anchorId) : undefined}
              testID={`${testID}-milestones`}
            />
          </View>

          {/* Your Commitment: this week and Rhythm together, with insights tucked behind a toggle. */}
          <View style={styles.section}>
            <V2CommitmentSection
              model={model}
              range={range}
              onRangeChange={setRange}
              onRangeMotionChange={setRangeMoving}
              weekRef={weekTeachingRef}
              rhythmRef={rhythmTeachingRef}
              testID={`${testID}-commitment`}
            />
          </View>

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
        </Animated.View>
      </ScrollView>
      </Animated.View>

      <ScreenTeaching screen="progress" queue={teachingQueue} reducedMotion={reducedMotion} targets={{
        'progress.thread': { getRect: () => getTeachingRect(threadTeachingRef) }, 'progress.week': { getRect: () => getTeachingRect(weekTeachingRef) },
        'progress.rhythm': { getRect: () => getTeachingRect(rhythmTeachingRef) }, 'progress.route': { getRect: () => getTeachingRect(routeTeachingRef) },
      }} />

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
  departure: { flex: 1 },
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
  titleColumn: { alignItems: 'center', gap: 8 },
  screenTitle: { ...typography.labelSM, fontSize: 11, letterSpacing: 3, color: progressTokens.heroText },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 230,
    paddingVertical: 7,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
  },
  switcherText: { ...typography.labelMD, color: progressTokens.heroText, flexShrink: 1 },
  body: { paddingHorizontal: 18, paddingTop: 22 },
  section: { marginBottom: 26 },
});
