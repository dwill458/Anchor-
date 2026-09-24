import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2Button, V2EmptyState, V2InlineError } from '@/components/v2';
import {
  V2HomeChartSection,
  V2HomeCategoryEnvironment,
  V2HomeBrandMark,
  V2HomeCreamSplice,
  V2HomeHeader,
  V2HomeHero,
  V2HomeProgressSection,
  V2HomeRecentActivitySection,
  V2HomeTodaySection,
  V2HomeVisionSection,
} from '@/components/v2/home';
import { resolveVisionAlternateImage, resolveVisionHeroImage, useV2HomeModel } from '@/adapters/v2/home';
import { useV2ReduceMotion, useV2Responsive } from '@/hooks/v2';
import { useV2ThreadEventQueue } from '@/hooks/v2/threadEvents';
import { V2ThreadEventModal } from '@/components/v2/threadEvents';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2DailyShellIntents, type V2DailyShellParamList } from './dailyShell';
import { isWithinWeeklyInsightReviewWindow } from '@/adapters/v2/weeklyInsight';
import { useHomeElasticScroll } from './homeElasticScroll';
import { V2_TRANSITION_SETTLE_MS } from '@/navigation/v2/transitions';
import { V2AssetPrewarm } from '@/components/v2/primitives/V2AssetPrewarm';
import { ANCHOR_DETAIL_EMPTY_ART, ANCHOR_DETAIL_HERO_ART } from '@/components/v2/anchors/anchorDetailArt';
import { GRID_ART_BY_PRACTICE } from '@/components/v2/practice/V2PracticeArtwork';
import { useSessionStore } from '@/stores/sessionStore';
import { HomeArrivalOverlay, HomeArrivalProvider, useHomeArrival } from '@/components/v2/home/homeArrival';
import { ProgressiveFocusTransition, useProgressiveFocusTransition } from '@/navigation/v2/ProgressiveFocusTransition';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2Home'>;

/** Brief-mandated page inset for both zones. */
const PAGE_INSET = 20;

const CHART_LANDSCAPE_ART = require('@/../assets/chart/landscape.jpg');

/** A focus within this window of the last context refresh reuses what Home already shows. */
const REFOCUS_REFRESH_MS = 30_000;

/** Changes whenever a practice is recorded, which is what moves Today, Thread and evidence. */
const practiceMarker = () => {
  const state = useSessionStore.getState();
  return `${state.lastSession?.id ?? ''}:${state.practiceHistory?.length ?? 0}`;
};

const track = (name: string, properties: Record<string, unknown> = {}) => {
  try {
    AnalyticsService.track(name, properties);
  } catch {
    /* analytics must never break Home */
  }
};

/**
 * The first-run empty state. It is the one place on Home with no Anchor to be
 * the hero, so a drawn gesture stands in for the artwork rather than leaving
 * the screen bare.
 */
function EmptyHomeGestureSvg() {
  return (
    <Svg width={220} height={200} viewBox="0 0 220 200" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Soft paper circular foundation */}
      <Circle cx={110} cy={100} r={76} fill="#FBF9F4" stroke="#DAD6CD" strokeWidth={1} strokeDasharray="6 6" />

      {/* Dynamic irregular brush arcs echoing the hero's construction strokes */}
      <Ellipse cx={110} cy={100} rx={86} ry={82} stroke="#7C5CFA" strokeWidth={4} strokeDasharray="160 30 110 40" strokeLinecap="round" opacity={0.4} transform="rotate(-25 110 100)" />
      <Ellipse cx={110} cy={100} rx={90} ry={85} stroke="#3157D8" strokeWidth={3} strokeDasharray="70 20 180 50" strokeLinecap="round" opacity={0.3} />
      <Path d="M145 170 C175 160 196 135 198 105" stroke="#53BDCC" strokeWidth={4} strokeLinecap="round" opacity={0.45} />
      <Path d="M182 48 L188 32 M196 52 L206 42 M200 62 L212 60" stroke="#F28A2E" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />

      {/* Gentle center waypoint sigil */}
      <Circle cx={110} cy={100} r={16} stroke="#D8D2C8" strokeWidth={1.5} strokeDasharray="3 3" />
      <Circle cx={110} cy={100} r={5} fill="#F9A72F" />
    </Svg>
  );
}

/**
 * Anchor 2.0 Home.
 *
 * Two zones, one continuous surface: a cream hero world (header, Anchor
 * context, hero carousel, intention, compact Thread Strength) spliced into a
 * graphite system world (Today, All Practices, Vision, Chart, Progress).
 *
 * Every module below the splice is conditional on real data for the ACTIVE
 * Anchor. Absent is not loading: Vision and Chart render nothing at all when
 * the record does not exist, and nothing on this screen reserves space for a
 * feature the user has not created.
 */
export function V2HomeScreen() {
  const navigation = useNavigation<Nav>();
  const focusTransition = useProgressiveFocusTransition();
  const model = useV2HomeModel();
  const reduceMotion = useV2ReduceMotion();
  const insets = useSafeAreaInsets();
  const { gutter } = useV2Responsive();
  const elastic = useHomeElasticScroll();
  const intents = useV2DailyShellIntents();
  const threadEvents = useV2ThreadEventQueue({
    channel: 'HOME_CONTEXT',
    enabled: Boolean(model.selectedAnchor),
  });

  const { refreshChart, refreshToday, refreshVision } = model;
  // Each model already loads on mount, so the first focus is not a reason to refetch.
  const lastRefresh = useRef({ at: Date.now(), practice: practiceMarker() });
  const refreshHomeContext = useCallback(() => {
    lastRefresh.current = { at: Date.now(), practice: practiceMarker() };
    void refreshToday();
    void refreshVision();
    void refreshChart();
  }, [refreshChart, refreshToday, refreshVision]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshHomeContext();
    });
    return () => listener.remove();
  }, [refreshHomeContext]);

  /**
   * Returning from a Practice session must re-read Today, Thread and evidence.
   * Returning from anywhere else within a few seconds has nothing new to read.
   * Either way the refresh starts once the transition back to Home has
   * settled: its responses re-render Home, and they used to arrive mid-pop.
   * Every refresh is stale-while-revalidate, so nothing on screen empties.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const unsubscribeFocus = navigation.addListener('focus', () => {
      const previous = lastRefresh.current;
      if (Date.now() - previous.at < REFOCUS_REFRESH_MS && previous.practice === practiceMarker()) return;
      cancel();
      timer = setTimeout(refreshHomeContext, V2_TRANSITION_SETTLE_MS);
    });
    const unsubscribeBlur = navigation.addListener('blur', cancel);
    return () => {
      cancel();
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, refreshHomeContext]);

  useEffect(() => {
    track('v2_home_viewed', { anchorCount: model.anchorList.length });
  }, [model.anchorList.length]);

  /**
   * A just-created Anchor arrives here from creation. Home is posed while creation still
   * covers it — at the top of the page, with Home itself (not a pushed Details) in front — and
   * then assembles around the mark as creation lets go. See homeArrival.tsx.
   */
  const poseForArrival = useCallback(() => {
    (elastic.scrollRef.current as { scrollTo?: (options: { y: number; animated: boolean }) => void } | null)?.scrollTo?.({ y: 0, animated: false });
    const state = navigation.getState?.();
    if (state && state.index > 0) navigation.popToTop();
  }, [elastic.scrollRef, navigation]);
  const arrival = useHomeArrival({
    selectedAnchorIds: [model.selectedAnchor?.id, model.selectedAnchor?.localId],
    onPose: poseForArrival,
    reduceMotion,
  });

  const selectedId = model.selectedAnchor?.id ?? null;
  const selectedCategory = model.selectedAnchor?.category?.toLowerCase() ?? '';

  /**
   * The two destinations one tap away from Home are Anchor Details and
   * Practice. Their large artwork is decoded here while Home is idle, so it is
   * already on screen in the first frame of the push (see V2AssetPrewarm).
   * Today's artwork is not listed: Home is already drawing it.
   */
  const hasChart = model.chart.state === 'ready';
  const nextScreenArt = useMemo(() => {
    const heroArt = ANCHOR_DETAIL_HERO_ART[selectedCategory];
    return [
      ...(heroArt ? [heroArt] : []),
      ...(hasChart ? [CHART_LANDSCAPE_ART] : []),
      ANCHOR_DETAIL_EMPTY_ART.vision,
      ANCHOR_DETAIL_EMPTY_ART.chart,
      GRID_ART_BY_PRACTICE.focus,
      GRID_ART_BY_PRACTICE.deep_prime,
      GRID_ART_BY_PRACTICE.visualize,
      GRID_ART_BY_PRACTICE.release,
    ];
  }, [hasChart, selectedCategory]);
  const anchorArtUris = useMemo(
    () => model.anchorList.map((summary) => summary.anchor.enhancedImageUrl),
    [model.anchorList],
  );

  const categoryColor = getCategoryColor(model.selectedAnchor?.category);

  /**
   * Today borrows a Vision photograph only when the server recommendation is
   * Visualize — it never becomes the recommendation engine itself, and
   * Focus/Deep Prime/Release keep their illustrated art. Prefers a SECOND
   * Vision image distinct from the one the Vision section shows below, so the
   * identical photograph never appears twice on Home; with only one Vision
   * image, Today reuses it but is told so, and gives it a different crop.
   */
  const visionCoverUri = useMemo(() => resolveVisionHeroImage(model.vision) ?? undefined, [model.vision]);
  const visionAlternateUri = useMemo(() => resolveVisionAlternateImage(model.vision) ?? undefined, [model.vision]);
  const todayVisionUri = visionAlternateUri ?? visionCoverUri;
  const todayVisionIsReused = Boolean(todayVisionUri) && !visionAlternateUri;

  /**
   * Every handler below is stable. The sections are memoised, and a memoised
   * section with a freshly created arrow prop re-renders anyway - which is
   * exactly the cascade a carousel commit used to trigger across the whole
   * page. Inline arrows are cheap; the renders they force are not.
   */
  const { selectAnchor, refreshChart: refreshChartModel, refreshToday: refreshTodayModel, today, chart } = model;
  const chartCourseId = chart.state === 'ready' ? chart.courseId : undefined;

  const handleCreateAnchor = useCallback(() => {
    track('v2_home_create_anchor_tapped');
    intents.onCreateAnchor();
  }, [intents]);

  const handleSelectAnchor = useCallback(
    (anchorId: string) => {
      selectAnchor(anchorId);
      track('v2_home_anchor_switched');
    },
    [selectAnchor],
  );

  const handleOpenActive = useCallback(
    (anchorId: string) => {
      track('v2_anchor_details_viewed', { from: 'home' });
      focusTransition.begin();
      navigation.navigate('V2AnchorDetails', { anchorId });
    },
    [focusTransition, navigation],
  );

  const handleOpenProgress = useCallback(() => {
    track('v2_home_progress_tapped');
    intents.onOpenProgress(selectedId ?? undefined);
  }, [intents, selectedId]);

  const handleOpenAllAnchors = useCallback(() => {
    track('v2_anchor_library_viewed', { from: 'home' });
    navigation.navigate('V2AnchorLibrary');
  }, [navigation]);

  const handleBeginToday = useCallback(() => {
    track('v2_home_practice_tapped');
    if (selectedId && today.state === 'ready') {
      intents.onOpenPractice(selectedId, today.mode);
    }
  }, [intents, selectedId, today]);

  const handleOpenAllPractices = useCallback(() => {
    track('v2_home_all_practices_tapped');
    if (selectedId) intents.onOpenPractice(selectedId);
  }, [intents, selectedId]);

  const handleRetryToday = useCallback(() => {
    void refreshTodayModel();
  }, [refreshTodayModel]);

  const handleOpenVision = useCallback(() => {
    track('v2_home_vision_tapped');
    if (selectedId) intents.onOpenVision(selectedId);
  }, [intents, selectedId]);

  const handleOpenChart = useCallback(() => {
    track('v2_home_chart_tapped');
    if (selectedId) intents.onOpenChart(selectedId, chartCourseId);
  }, [chartCourseId, intents, selectedId]);

  const header = (
    <View style={[styles.headerInset, { paddingHorizontal: gutter }]}>
      <V2HomeHeader
        greeting={model.greeting}
        profileInitial={model.profileInitial}
        profilePictureUrl={model.profilePictureUrl}
        showChartUtility={false}
        onCreateAnchor={handleCreateAnchor}
        onOpenProfile={intents.onOpenProfile}
      />
    </View>
  );

  if (model.anchorState === 'loading') {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        {/* A restrained layout skeleton, not a pile of independent loading cards. */}
        <View testID="v2-home-anchors-loading" style={styles.skeletonZone}>
          <View style={styles.skeletonDisc} />
          <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
          <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
        </View>
      </SafeAreaView>
    );
  }

  if (model.anchorState === 'error') {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        <View testID="v2-home-anchors-error" style={styles.statusZone}>
          <V2InlineError message={model.anchorError ?? 'Unable to load your Anchors.'} onRetry={model.refreshAnchors} />
        </View>
      </SafeAreaView>
    );
  }

  if (!model.selectedAnchor) {
    return (
      <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
        {header}
        <View style={styles.emptyZone}>
          <V2EmptyState
            gesture={<EmptyHomeGestureSvg />}
            title="No Anchor yet"
            message="Create your first Anchor to begin. Everything on Home orients around one selected Anchor."
            action={
              <V2Button accessibilityLabel="Create your first Anchor" onPress={handleCreateAnchor}>
                Create an Anchor
              </V2Button>
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <HomeArrivalProvider value={arrival.context}>
    <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
      <V2AssetPrewarm sources={nextScreenArt} remoteUris={anchorArtUris} />
      <GestureDetector gesture={elastic.elasticPan}>
      <View style={styles.scrollHost}>
      <GestureDetector gesture={elastic.nativeScroll}>
      <Animated.ScrollView
        ref={elastic.scrollRef}
        onScroll={elastic.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // The hero must never be clipped or slide under the status bar.
        contentInsetAdjustmentBehavior="never"
        // iOS: native bounce and momentum are the target feel. Android: the
        // native stretch would distort the artwork, so the elastic edge is
        // drawn by `useHomeElasticScroll` instead.
        bounces
        overScrollMode={elastic.enabled ? 'never' : 'auto'}
      >
        <Animated.View style={[styles.elasticContent, elastic.elasticStyle]}>
        {/* ── Cream hero world ── */}
        <Animated.View style={arrival.headerStyle}>{header}</Animated.View>

        <View style={styles.heroEnvironment}>
          <Animated.View style={[StyleSheet.absoluteFill, arrival.environmentStyle]} pointerEvents="none">
            <V2HomeCategoryEnvironment category={model.selectedAnchor.category} reduceMotion={reduceMotion} />
          </Animated.View>
          <Animated.View style={[styles.creamZone, arrival.heroStyle]}>
            <V2HomeHero
              testID="v2-home-hero"
              anchors={model.anchorList}
              selectedIndex={model.selectedIndex}
              thread={model.thread}
              reduceMotion={reduceMotion}
              onSelect={handleSelectAnchor}
              onOpenActive={handleOpenActive}
              onOpenProgress={handleOpenProgress}
              onOpenAllAnchors={handleOpenAllAnchors}
            />
          </Animated.View>

          {/* The cream landscape terminates on its own at the keel point. */}
          <Animated.View style={arrival.lowerStyle}>
            <V2HomeCreamSplice testID="v2-home-splice" />
          </Animated.View>
        </View>

        {/* ── Graphite system world ── */}
        <Animated.View testID="v2-home-graphite-zone" style={[styles.graphiteZone, { paddingHorizontal: gutter, paddingBottom: 56 + insets.bottom }, arrival.lowerStyle]}>
          {/* Product signature: opens the ink field, beneath the keel and above Today. */}
          <V2HomeBrandMark testID="v2-home-brand-mark" />

          <V2HomeTodaySection
            testID="v2-home-today"
            today={model.today}
            visionCoverUri={todayVisionUri}
            visionCoverIsReused={todayVisionIsReused}
            onBegin={handleBeginToday}
            onOpenAllPractices={handleOpenAllPractices}
            onRetry={handleRetryToday}
          />

          <V2HomeVisionSection
            vision={model.vision}
            categoryColor={categoryColor}
            onOpenVision={handleOpenVision}
          />

          <V2HomeChartSection
            chart={model.chart}
            categoryColor={categoryColor}
            expanded={model.chart.state === 'ready' && model.vision.state !== 'ready'}
            onOpenChart={handleOpenChart}
            onRetry={refreshChartModel}
          />

          {model.vision.state !== 'ready' && model.chart.state !== 'ready' ? (
            <V2HomeProgressSection
              progress={model.progress}
              thread={model.thread}
              categoryColor={categoryColor}
              onOpenProgress={handleOpenProgress}
            />
          ) : null}
          <V2HomeRecentActivitySection items={model.recentActivity ?? []} />

          {isWithinWeeklyInsightReviewWindow() ? (
            <View testID="v2-home-weekly-review" style={styles.weeklyReview}>
              <Pressable accessibilityRole="button" accessibilityLabel="Open Weekly Review" onPress={intents.onOpenWeeklyInsight}>
                <Text style={styles.weeklyReviewText}>Weekly Review  →</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>

        {/* Keeps the graphite field unbroken under an overscroll bounce. */}
        <View style={styles.overscrollFill} pointerEvents="none" />
        </Animated.View>
      </Animated.ScrollView>
      </GestureDetector>
      </View>
      </GestureDetector>

      <V2ThreadEventModal
        bundle={threadEvents.active}
        visible={Boolean(threadEvents.active)}
        anchorSvg={model.selectedAnchor?.baseSigilSvg}
        category={model.selectedAnchor?.category}
        reducedMotion={reduceMotion}
        onPresented={() => {
          void threadEvents.claimActive().then(threadEvents.markPresented);
        }}
        onAcknowledge={() => {
          void threadEvents.acknowledge();
        }}
        onDismiss={() => {
          void threadEvents.dismiss();
        }}
      />

      {arrival.arrival ? (
        <HomeArrivalOverlay arrival={arrival.arrival} progress={arrival.context.progress} origin={arrival.origin} onOrigin={arrival.reportOrigin} />
      ) : null}
      <ProgressiveFocusTransition role="source" />
    </SafeAreaView>
    </HomeArrivalProvider>
  );
}

const TOP_EDGE = ['top'] as const;

const styles = StyleSheet.create({
  creamScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollHost: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  elasticContent: {
    flexGrow: 1,
  },
  headerInset: {
    paddingTop: 6,
  },
  heroEnvironment: {
    position: 'relative',
    backgroundColor: colors.canvas,
  },
  // Full-bleed on purpose. The carousel track measures itself and centres on
  // this zone, so a page gutter here would push its centre off the viewport
  // centre. The hero items apply the gutter to their own text instead.
  creamZone: {
    position: 'relative',
    paddingBottom: 0,
  },
  graphiteZone: {
    flexGrow: 1,
    // The brand mark carries the keel → Today rhythm itself, and its lower
    // gap already clears the Today artwork's upward bleed.
    paddingTop: 0,
    backgroundColor: colors.graphite.base,
  },
  overscrollFill: {
    // Overlaps the graphite zone by 2px: at the fractional offsets of an
    // elastic pull, abutting edges otherwise show a hairline of cream.
    height: 402,
    marginTop: -2,
    marginBottom: -400,
    backgroundColor: colors.graphite.base,
  },
  weeklyReview: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  weeklyReviewText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.graphite.text.secondary,
  },
  statusZone: {
    paddingHorizontal: PAGE_INSET,
    paddingVertical: 32,
  },
  emptyZone: {
    flex: 1,
    paddingHorizontal: PAGE_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonZone: {
    paddingHorizontal: PAGE_INSET,
    paddingTop: 48,
    alignItems: 'center',
    gap: 20,
  },
  skeletonDisc: {
    width: 178,
    height: 178,
    borderRadius: 89,
    backgroundColor: colors.grouped,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.grouped,
    alignSelf: 'stretch',
  },
  skeletonLineWide: {
    marginTop: 8,
  },
  skeletonLineNarrow: {
    width: '60%',
    alignSelf: 'flex-start',
  },
});
