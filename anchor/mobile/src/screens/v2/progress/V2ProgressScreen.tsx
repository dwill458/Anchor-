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
import { V2Button, V2SectionHeader } from '@/components/v2';
import { useV2Progress } from '@/hooks/v2/progress';
import type { Anchor } from '@/types';
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
  onAnchorResolved,
  onNavigateToChart,
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

  const shownAnchor = model ? (anchors.find((a) => a.id === model.anchorId)?.anchor ?? model.anchor) : undefined;
  React.useEffect(() => { onAnchorResolved?.(shownAnchor); }, [onAnchorResolved, shownAnchor]);
  const handleBack = React.useCallback(() => onBack?.(shownAnchor), [onBack, shownAnchor]);

  const [refreshing, setRefreshing] = React.useState(false);
  const [switcherOpen, setSwitcherOpen] = React.useState(false);
  const teachingFocus = useTeachingFocus();
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const reducedMotion = useV2ReduceMotion();
  const scrollRef = React.useRef<ScrollView>(null);
  const threadTeachingRef = React.useRef<View>(null);
  const weekTeachingRef = React.useRef<View>(null);
  const rhythmTeachingRef = React.useRef<View>(null);
  const routeTeachingRef = React.useRef<View>(null);
  const scrollMetrics = React.useRef({ y: 0, content: 0, viewport: 0 });
  const controlledScroll = React.useRef(false);
  const [scrolling, setScrolling] = React.useState(false);
  const [rangeMoving, setRangeMoving] = React.useState(false);
  const teachingQueue = useTeachingQueue({ screenId: 'progress', accountId: teachingAccountId,
    eligible: model ? progressTeachingBeats({ unmeasured: model.unmeasured, hasWeek: Boolean(model.week), hasRhythm: model.unmeasured || Boolean(model.rhythm && model.heatmap), hasRoute: Boolean(model.route) }) : [],
    cap: 2, isFocused: teachingFocus.isFocused,
    blocked: teachingFocus.transitioning || !model || loading || refreshing || switcherOpen || Boolean(selectedEvent) || rangeMoving || scrolling });
  const getTeachingRect = React.useCallback(async (target: React.RefObject<View | null>) => {
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
      <StatusBar barStyle="light-content" backgroundColor={progressTokens.heroBg} animated />

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
          {/* This week */}
          {model.week ? (
            <View ref={weekTeachingRef} collapsable={false} style={styles.section}>
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
            <View ref={rhythmTeachingRef} collapsable={false} style={styles.section}>
              <V2ProgressGhostCard
                testID={`${testID}-rhythm-empty`}
                title="Your rhythm will draw itself here."
                body="A calendar, minutes practiced and how steady you are, all from sessions you actually complete."
              />
            </View>
          ) : model.rhythm && model.heatmap ? (
            <View ref={rhythmTeachingRef} collapsable={false} style={styles.section}>
              <V2SectionHeader title="Rhythm" />
              <V2ProgressRhythm model={model} range={range} onRangeChange={setRange} onRangeMotionChange={setRangeMoving} testID={`${testID}-rhythm`} />
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
            <View ref={routeTeachingRef} collapsable={false} style={styles.section}>
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
