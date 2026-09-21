import React, { useCallback, useEffect } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { V2Button, V2EmptyState, V2InlineError } from '@/components/v2';
import {
  V2HomeChartSection,
  V2HomeCategoryEnvironment,
  V2HomeCreamSplice,
  V2HomeHeader,
  V2HomeHero,
  V2HomeProgressSection,
  V2HomeRecentActivitySection,
  V2HomeTodaySection,
  V2HomeVisionSection,
} from '@/components/v2/home';
import { useV2HomeModel } from '@/adapters/v2/home';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useV2ThreadEventQueue } from '@/hooks/v2/threadEvents';
import { V2ThreadEventModal } from '@/components/v2/threadEvents';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2DailyShellIntents, type V2DailyShellParamList } from './dailyShell';
import { isWithinWeeklyInsightReviewWindow } from '@/adapters/v2/weeklyInsight';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2Home'>;

/** Brief-mandated page inset for both zones. */
const PAGE_INSET = 20;

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
  const model = useV2HomeModel();
  const reduceMotion = useV2ReduceMotion();
  const insets = useSafeAreaInsets();
  const intents = useV2DailyShellIntents();
  const threadEvents = useV2ThreadEventQueue({
    channel: 'HOME_CONTEXT',
    enabled: Boolean(model.selectedAnchor),
  });

  const { refreshChart, refreshToday, refreshVision } = model;
  const refreshHomeContext = useCallback(() => {
    void refreshToday();
    void refreshVision();
    void refreshChart();
  }, [refreshChart, refreshToday, refreshVision]);

  // Returning from a Practice session must re-read Today, Thread and evidence.
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshHomeContext();
    });
    return () => listener.remove();
  }, [refreshHomeContext]);

  useEffect(() => navigation.addListener('focus', refreshHomeContext), [navigation, refreshHomeContext]);

  useEffect(() => {
    track('v2_home_viewed', { anchorCount: model.anchorList.length });
  }, [model.anchorList.length]);

  const selectedId = model.selectedAnchor?.id ?? null;

  const categoryColor = getCategoryColor(model.selectedAnchor?.category);

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
      navigation.navigate('V2AnchorDetails', { anchorId });
    },
    [navigation],
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
    <View style={styles.headerInset}>
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
    <SafeAreaView edges={TOP_EDGE} style={styles.creamScreen} testID="v2-home-screen">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        // The hero must never be clipped or slide under the status bar.
        contentInsetAdjustmentBehavior="never"
      >
        {/* ── Cream hero world ── */}
        {header}

        <View style={styles.heroEnvironment}>
          <V2HomeCategoryEnvironment category={model.selectedAnchor.category} reduceMotion={reduceMotion} />
          <View style={styles.creamZone}>
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
          </View>

          {/* The scene continues through the center of the divider. */}
          <V2HomeCreamSplice testID="v2-home-splice" />
        </View>

        {/* ── Graphite system world ── */}
        <View testID="v2-home-graphite-zone" style={[styles.graphiteZone, { paddingBottom: 56 + insets.bottom }]}>
          <V2HomeTodaySection
            testID="v2-home-today"
            today={model.today}
            onBegin={handleBeginToday}
            onOpenAllPractices={handleOpenAllPractices}
            onRetry={handleRetryToday}
          />

          <V2HomeVisionSection
            vision={model.vision}
            expanded={model.vision.state === 'ready' && model.chart.state !== 'ready'}
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
        </View>

        {/* Keeps the graphite field unbroken under an overscroll bounce. */}
        <View style={styles.overscrollFill} pointerEvents="none" />
      </ScrollView>

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
    </SafeAreaView>
  );
}

const TOP_EDGE = ['top'] as const;

const styles = StyleSheet.create({
  creamScreen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerInset: {
    paddingHorizontal: PAGE_INSET,
    paddingTop: 6,
  },
  heroEnvironment: {
    position: 'relative',
    backgroundColor: colors.canvas,
  },
  creamZone: {
    position: 'relative',
    paddingHorizontal: PAGE_INSET,
    paddingBottom: 0,
  },
  graphiteZone: {
    flexGrow: 1,
    paddingHorizontal: PAGE_INSET,
    paddingTop: 18,
    backgroundColor: colors.graphite.base,
  },
  overscrollFill: {
    height: 400,
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
