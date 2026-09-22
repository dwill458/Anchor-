import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MoreHorizontal, Sparkle } from 'lucide-react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircularAnchorRenderer, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { ThreadStrength } from '@/components/v2/thread';
import { anchorRenderProps, categoryLabel, durationLabel, shortDate } from '@/components/v2/anchors';
import { useV2AnchorDetail } from '@/hooks/v2/anchors';
import { useV2Vision } from '@/hooks/v2/vision';
import { useCourseStore } from '@/stores/courseStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveHomeChartState } from '@/adapters/v2/home/chartAdapter';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '@/adapters/v2/practice';
import { isV2RecommendationContextFresh, peekV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { V2_RECOMMENDATION_ACTION_TO_MODE, V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { todayReasonCopy } from '@/components/v2/home/V2HomeTodaySection';
import { colors, getCategoryColor, getCategoryTextColor, getPracticeColor, typography } from '@/theme/v2';
import { useV2DailyShellIntents, type V2DailyShellParamList } from '@/screens/v2/home/dailyShell';
import { ANCHOR_DETAIL_EMPTY_ART, ANCHOR_DETAIL_HERO_ART, ANCHOR_DETAIL_PRACTICE_ART } from '@/components/v2/anchors/anchorDetailArt';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Route = RouteProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Recommendation = { mode: V2PracticeMode; reason: string; delta: number | null; strength: number | null };

const DETAIL_ACTION_COPY = {
  visionTitle: 'Add Vision',
  visionPayoff: 'See where this leads.',
  chartTitle: 'Create Chart',
  chartPayoff: 'Map the path from here.',
};

const HERO_ART = ANCHOR_DETAIL_HERO_ART;
const PRACTICE_ART = ANCHOR_DETAIL_PRACTICE_ART;
const EMPTY_ART = ANCHOR_DETAIL_EMPTY_ART;

function toRecommendation(context: V2RecommendationContext): Recommendation {
  return {
    mode: V2_RECOMMENDATION_ACTION_TO_MODE[context.recommendation.action],
    reason: context.recommendation.reason,
    delta: context.thread.delta7dStatus === 'AVAILABLE' ? context.thread.delta7d : null,
    strength: context.thread.status === 'AVAILABLE' && typeof context.thread.strength === 'number' ? context.thread.strength : null,
  };
}

function cachedRecommendation(anchorId: string) {
  const cached = peekV2RecommendationContext(anchorId);
  return { id: anchorId, value: cached ? toRecommendation(cached) : null, error: false };
}

/**
 * Home has almost always read this Anchor's recommendation already. Seeding
 * from that read means the Today card is present on the first frame of the
 * push, instead of a "Loading" line that grew into a full card and shoved the
 * rest of the page down just after the transition ended.
 */
function useRecommendation(anchorId: string) {
  const [result, setResult] = useState<{ id: string; value: Recommendation | null; error: boolean }>(() => cachedRecommendation(anchorId));
  useEffect(() => {
    if (!anchorId) return;
    setResult((previous) => (previous.id === anchorId && previous.value ? previous : cachedRecommendation(anchorId)));
    if (isV2RecommendationContextFresh(anchorId)) return;
    const controller = new AbortController();
    fetchV2RecommendationContext(anchorId, controller.signal).then((context) => {
      if (controller.signal.aborted) return;
      setResult({ id: anchorId, error: false, value: toRecommendation(context) });
    }).catch(() => {
      if (controller.signal.aborted) return;
      // A failed revalidation keeps the recommendation already on screen.
      setResult((previous) => (previous.id === anchorId && previous.value ? previous : { id: anchorId, value: null, error: true }));
    });
    return () => controller.abort();
  }, [anchorId]);
  return result.id === anchorId ? result : cachedRecommendation(anchorId);
}

function isDateToday(dateVal: string | Date): boolean {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function Hero({
  anchor,
  paintingHeight,
  medallionSize,
  onBack,
  onMore,
}: {
  anchor: NonNullable<ReturnType<typeof useV2AnchorDetail>['anchor']>;
  paintingHeight: number;
  medallionSize: number;
  onBack: () => void;
  onMore: () => void;
}) {
  const accent = getCategoryColor(anchor.category);
  // Small tracked caps on cream must clear WCAG AA; darkens within the same hue when the raw token would not.
  const categoryText = getCategoryTextColor(anchor.category, colors.surface, colors.text.primary);
  const art = HERO_ART[anchor.category?.toLowerCase() ?? ''];

  return (
    <View style={styles.heroWrap}>
      <View style={[styles.hero, { height: paintingHeight, backgroundColor: accent + '25' }]}>
        {art ? <Image source={art} style={styles.heroImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
        <View style={[styles.heroWash, { backgroundColor: 'rgba(251,249,244,0.32)' }]} />
        <View style={styles.heroNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12} style={styles.heroNavButton}>
            <ChevronLeft color={colors.text.primary} size={26} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More Anchor options" onPress={onMore} hitSlop={12} style={styles.heroNavButton}>
            <MoreHorizontal color={colors.text.primary} size={26} />
          </Pressable>
        </View>
        <Svg width="100%" height={32} viewBox="0 0 400 32" preserveAspectRatio="none" style={styles.arc}>
          <Path d="M0 0 Q200 48 400 0 L400 32 L0 32 Z" fill={colors.surface} />
        </Svg>
      </View>
      <CircularAnchorRenderer
        {...anchorRenderProps(anchor)}
        size={medallionSize}
        appearance="paper"
        accessibilityLabel={categoryLabel(anchor.category) + ' Anchor artwork'}
        style={[styles.glyph, { top: paintingHeight - medallionSize * 0.58 }]}
      />
      <View style={[styles.heroCopy, { paddingTop: medallionSize * 0.42 + 16 }]}>
        <Text accessibilityRole="header" style={styles.intention}>{anchor.intentionText}</Text>
        <Text style={[styles.category, { color: categoryText }]}>{categoryLabel(anchor.category).toUpperCase()}</Text>
        <Text style={styles.created}>{`Created ${new Date(anchor.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}</Text>
      </View>
    </View>
  );
}

function ThreadSummary({
  value,
  delta,
  accent,
  levelColor,
  onPress,
}: {
  value: number | null;
  delta: number | null;
  accent: string;
  levelColor: string;
  onPress: () => void;
  history: Array<number | null>;
}) {
  const level = value === null ? 'NOT ESTABLISHED' : resolveEvolutionStage(value).toUpperCase();
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  const isPositiveDelta = typeof delta === 'number' && delta > 0;
  const isNegativeDelta = typeof delta === 'number' && delta < 0;
  const deltaArrow = isPositiveDelta ? '↑' : isNegativeDelta ? '↓' : '';
  const deltaPrefix = isPositiveDelta ? ' +' : isNegativeDelta ? ' ' : '';
  const deltaColor = isNegativeDelta ? colors.semantic.error : isPositiveDelta ? colors.semantic.success : colors.text.secondary;

  return (
    <Pressable testID="v2-anchor-thread" accessibilityRole="button" onPress={onPress} style={styles.thread}>
      <View style={styles.sectionHeading}>
        <View style={styles.headingLabelGroup}>
          <Text style={styles.eyebrow}>Thread Strength</Text>
          <Svg width={12} height={12} viewBox="0 0 12 12" style={styles.headingIcon}>
            <Circle cx={6} cy={6} r={4.5} stroke={colors.text.secondary} strokeWidth={1.2} fill="none" />
            <Path d="M6 5.5v3M6 3.5h.01" stroke={colors.text.secondary} strokeWidth={1.2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={[styles.level, { color: levelColor }]}>{level}</Text>
      </View>

      <View style={styles.threadMetricsRow}>
        <View style={styles.threadValueGroup}>
          <Text style={styles.threadPercent}>{numericValue}%</Text>
          {delta !== null ? (
            <Text style={[styles.threadDelta, { color: deltaColor }]}>
              {deltaArrow ? `${deltaArrow}` : ''}
              {deltaPrefix}
              {delta}% this week
            </Text>
          ) : null}
        </View>
        <View style={styles.threadTrackWrap}>
          <ThreadStrength
            percent={numericValue}
            color={accent}
            weeklyDelta={delta}
            showDelta={false}
            showMetrics={false}
            arrowStyle="arrow"
            duration={1400}
            height={44}
          />
        </View>
      </View>

      <Text testID="v2-thread-strength-value" style={styles.hiddenValueTest}>
        {value === null ? '—' : value}
      </Text>
    </Pressable>
  );
}

function TodayCard({
  recommendation,
  error,
  duration,
  onPress,
}: {
  recommendation: Recommendation | null;
  error: boolean;
  duration: number;
  onPress: (mode: V2PracticeMode) => void;
}) {
  if (!recommendation) {
    return (
      <View style={styles.todayPending}>
        <Text style={styles.eyebrow}>RECOMMENDED PRACTICE</Text>
        <Text style={styles.quiet}>{error ? 'Today’s recommendation is unavailable.' : 'Loading today’s recommendation…'}</Text>
      </View>
    );
  }

  const mode = recommendation.mode;
  const modeTitle = V2_PRACTICE_MODE_BY_ID[mode]?.title ?? 'Focus';

  return (
    <Pressable
      testID="v2-anchor-today"
      accessibilityRole="button"
      accessibilityLabel={'Practice this Anchor: ' + modeTitle}
      onPress={() => onPress(mode)}
      style={({ pressed }) => [styles.todayCard, pressed && styles.pressed]}
    >
      <View style={styles.todayArtThumbnailWrap}>
        <Image source={PRACTICE_ART[mode]} style={styles.todayArtThumbnail} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={styles.todayBody}>
        <Text style={styles.todayEyebrow}>Recommended Practice</Text>
        <Text style={styles.todayTitle}>{modeTitle}</Text>
        <Text style={styles.todayMeta}>{mode !== 'release' ? durationLabel(duration) : 'Ready'} <ChevronRight size={14} color={colors.text.primary} /></Text>
        <Text style={styles.todayReason} numberOfLines={2}>{todayReasonCopy(recommendation.reason, mode)}</Text>
      </View>
    </Pressable>
  );
}

function VisionSection({
  accent,
  visionTile,
  tiles,
  statement,
  seenToday,
  onOpenVision,
}: {
  accent: string;
  visionTile: { imageUrl?: string | null } | null | undefined;
  tiles: Array<{ id: string; imageUrl?: string | null }>;
  statement?: string;
  seenToday?: boolean;
  onOpenVision: () => void;
}) {
  const hasVision = Boolean(visionTile?.imageUrl);

  if (!hasVision) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeaderTitle}>Vision</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vision"
          onPress={onOpenVision}
          style={({ pressed }) => [styles.emptyArtCard, pressed && styles.pressed]}
        >
          <EmptyCardArtwork source={EMPTY_ART.vision} testID="v2-vision-empty-art" />
          <View style={styles.emptyCardContent}>
            <Text style={styles.emptyCardTitle}>{DETAIL_ACTION_COPY.visionTitle}</Text>
            <Text style={styles.emptyCardPayoff}>{DETAIL_ACTION_COPY.visionPayoff}</Text>
          </View>
          <EmptyCardChevron />
        </Pressable>
      </View>
    );
  }

  const activeTilesCount = tiles.filter((t) => Boolean(t.imageUrl)).length;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Vision</Text>
        <Pressable accessibilityRole="button" onPress={onOpenVision} hitSlop={8}>
          <Text style={styles.viewAll}>{seenToday ? 'Seen today ✓' : 'View all →'}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Vision"
        onPress={onOpenVision}
        style={({ pressed }) => [styles.visionPhotoCard, pressed && styles.pressed]}
      >
        <Image source={{ uri: visionTile!.imageUrl! }} style={styles.visionPhotoImage} resizeMode="cover" accessibilityIgnoresInvertColors />
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(14,21,28,0.88)']}
          locations={[0, 0.42, 1]}
          style={styles.visionPhotoScrim}
        />
        {statement ? (
          <Text style={styles.visionStatement} numberOfLines={3}>
            {statement}
          </Text>
        ) : null}
      </Pressable>
      {activeTilesCount > 1 ? (
        <View style={styles.visionDotsRow}>
          {Array.from({ length: Math.min(5, activeTilesCount) }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.visionDot,
                i === 0 ? { backgroundColor: accent, width: 8, height: 8, borderRadius: 4 } : { backgroundColor: colors.border.strong },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RecentPractice({
  entries,
  onViewAll,
}: {
  entries: ReturnType<typeof useV2AnchorDetail>['recentPractice'];
  onViewAll: () => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>Recent Practice</Text>
        <Pressable accessibilityRole="button" onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>View all →</Text>
        </Pressable>
      </View>
      {entries.length ? (
        <View style={styles.practiceList}>
          {entries.slice(0, 4).map((entry) => {
            const isToday = isDateToday(entry.completedAt);
            const dateStr = isToday ? 'Today' : shortDate(entry.completedAt);
            return (
              <View key={entry.id} style={styles.practiceItemRow}>
                <View style={[styles.practiceIconBadge, { backgroundColor: getPracticeColor(entry.mode) }]}>
                  <Sparkle size={13} color="#FFFFFF" fill="#FFFFFF" />
                </View>
                <View style={styles.practiceItemCopy}>
                  <Text style={styles.practiceItemTitle}>
                    {entry.label} <Text style={styles.practiceItemDuration}>· {durationLabel(entry.durationSeconds)}</Text>
                  </Text>
                </View>
                <Text style={styles.practiceItemDate}>{dateStr}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.quiet}>No practice recorded for this Anchor yet.</Text>
      )}
    </View>
  );
}

function ChartSection({
  chart,
  chartCourseId,
  onOpenChart,
}: {
  chart: ReturnType<typeof resolveHomeChartState>;
  chartCourseId?: string;
  onOpenChart: (courseId?: string) => void;
}) {
  const isReady = chart.state === 'ready';
  return (
    <View style={styles.sectionBlock}>
      <Text style={styles.sectionHeaderTitle}>Chart</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chart"
        onPress={() => onOpenChart(chartCourseId)}
        style={({ pressed }) => [styles.chartPhotoCard, !isReady && styles.emptyArtCard, pressed && styles.pressed]}
      >
        {chart.state === 'ready' ? (
          <>
            <View style={styles.chartReadyFrame}>
              <Image source={EMPTY_ART.chart} style={styles.emptyCardImage} resizeMode="cover" accessibilityIgnoresInvertColors />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(14,21,28,0.75)', 'rgba(14,21,28,0.92)']}
                locations={[0, 0.45, 1]}
                style={styles.emptyArtScrim}
              />
            </View>
            <View style={styles.chartReadyContent}>
              <Text style={styles.chartReadyTitle}>Your Path</Text>
              <Text style={styles.chartReadySubtitle}>{`${chart.reachedCount} of ${chart.waypointCount} waypoints`}</Text>
            </View>
            <View style={styles.chartChevronCircle}>
              <ChevronRight size={20} color="#FFFFFF" />
            </View>
          </>
        ) : (
          <>
            <EmptyCardArtwork source={EMPTY_ART.chart} testID="v2-chart-empty-art" />
            <View style={styles.emptyCardContent}>
              <Text style={styles.emptyCardTitle}>{DETAIL_ACTION_COPY.chartTitle}</Text>
              <Text style={styles.emptyCardPayoff}>{DETAIL_ACTION_COPY.chartPayoff}</Text>
            </View>
            <EmptyCardChevron />
          </>
        )}
      </Pressable>
    </View>
  );
}

function EmptyCardArtwork({ source, testID }: { source: ImageSourcePropType; testID: string }) {
  return (
    <>
      <View pointerEvents="none" style={styles.emptyCardImageFrame}>
        <Image source={source} testID={testID} style={styles.emptyCardImage} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.text.primary + '00', colors.text.primary + 'A6']}
        style={styles.emptyArtScrim}
      />
    </>
  );
}

function EmptyCardChevron() {
  return (
    <View pointerEvents="none" style={styles.emptyCardChevronCircle}>
      <ChevronRight size={22} color={colors.text.inverse} />
    </View>
  );
}

export function V2AnchorDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const { width, height } = useWindowDimensions();
  const intents = useV2DailyShellIntents();
  const detail = useV2AnchorDetail(params.anchorId);
  const anchorId = detail.anchor?.localId ?? detail.anchor?.id ?? '';
  const serverId = detail.anchor?.id ?? '';
  const recommendation = useRecommendation(serverId);
  const vision = useV2Vision(serverId);

  const chartEnabled = useCourseStore((s) => s.flags.chart_enabled);
  const courseAccountId = useCourseStore((s) => s.accountId);
  const courseInitializationStatus = useCourseStore((s) => s.initializationStatus);
  const courses = useCourseStore((s) => s.courses);
  const activeCourse = useCourseStore((s) => s.activeCourse);
  const courseErrorCode = useCourseStore((s) => s.errorCode);
  const accountId = useAuthStore((s) => s.user?.id ?? null);
  const activeAnchorCount = useAnchorStore((s) => s.anchors.filter((a) => !a.isReleased && !a.archivedAt).length);
  const focusDuration = useSettingsStore((s) => s.focusSessionDuration);
  const primeDuration = useSettingsStore((s) => s.primeSessionDuration);
  const visualizeDuration = useSettingsStore((s) => s.visualizeSessionDuration);

  const chart = useMemo(
    () =>
      resolveHomeChartState({
        anchor: detail.anchor,
        chartEnabled,
        accountId,
        courseAccountId,
        initializationStatus: courseInitializationStatus,
        courses,
        activeCourse,
        errorCode: courseErrorCode,
        isOnlyActiveAnchor: activeAnchorCount === 1,
      }),
    [accountId, activeAnchorCount, activeCourse, chartEnabled, courseAccountId, courseErrorCode, courseInitializationStatus, courses, detail.anchor],
  );

  const history = useMemo(
    () =>
      detail.recentPractice
        .slice()
        .reverse()
        .map((item) => item.strengthAfter),
    [detail.recentPractice],
  );

  if (!detail.anchor) {
    return (
      <V2Screen testID="v2-anchor-details-screen">
        <V2TopBar title="Anchor" onBackPress={() => navigation.goBack()} />
        <V2EmptyState title="Anchor not found" message="This Anchor may have been removed." />
      </V2Screen>
    );
  }

  const accent = getCategoryColor(detail.anchor.category);
  const visionTile = vision.state.state === 'ready' ? vision.state.tiles.find((tile) => tile.imageUrl) : null;
  const visionTiles = vision.state.state === 'ready' ? vision.state.tiles : [];
  const visionStatement = vision.state.state === 'ready' ? vision.state.description || vision.description : '';
  const visionSeenToday = vision.state.state === 'ready' ? vision.state.seenToday : false;

  const hasChart = chart.state === 'ready';
  const chartCourseId = hasChart ? chart.courseId : undefined;
  const duration =
    recommendation.value?.mode === 'deep_prime'
      ? primeDuration
      : recommendation.value?.mode === 'visualize'
      ? visualizeDuration
      : focusDuration;

  const openPractice = (mode: V2PracticeMode) => {
    if (mode === 'release') intents.onReleaseAnchor(anchorId);
    else intents.onOpenPractice(anchorId, mode);
  };

  // Top category painting: reduced ~40-45% vertically from the original ~275px
  const paintingHeight = Math.max(145, Math.min(175, Math.round(height * 0.18)));
  // Hero medallion: enlarged from 172 to ~210px responsive
  const medallionSize = Math.max(190, Math.min(220, Math.round(width * 0.52)));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <ScrollView testID="v2-anchor-details-screen" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Hero
          anchor={detail.anchor}
          paintingHeight={paintingHeight}
          medallionSize={medallionSize}
          onBack={() => navigation.goBack()}
          onMore={() =>
            Alert.alert('Anchor', undefined, [
              { text: 'View Progress', onPress: () => intents.onOpenProgress(serverId) },
              ...(!detail.anchor?.isReleased ? [{ text: 'Release this Anchor', onPress: () => intents.onReleaseAnchor(anchorId) }] : []),
              { text: 'Cancel', style: 'cancel' },
            ])
          }
        />

        <View style={[styles.body, { paddingHorizontal: width < 370 ? 20 : 24 }]}>
          <ThreadSummary
            value={recommendation.value?.strength ?? detail.thread?.value ?? null}
            delta={recommendation.value?.delta ?? null}
            accent={accent}
            levelColor={getCategoryTextColor(detail.anchor.category, colors.surface, colors.text.primary)}
            onPress={() => intents.onOpenProgress(serverId)}
            history={history}
          />

          <TodayCard recommendation={recommendation.value} error={recommendation.error} duration={duration} onPress={openPractice} />

          <VisionSection
            accent={accent}
            visionTile={visionTile}
            tiles={visionTiles}
            statement={visionStatement}
            seenToday={visionSeenToday}
            onOpenVision={() => intents.onOpenVision(serverId)}
          />

          <RecentPractice entries={detail.recentPractice} onViewAll={() => intents.onOpenProgress(serverId)} />

          <ChartSection
            chart={chart}
            chartCourseId={chartCourseId}
            onOpenChart={(courseId) => intents.onOpenChart(serverId, courseId)}
          />

          {!detail.anchor.isReleased ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Release this Anchor"
              onPress={() => intents.onReleaseAnchor(anchorId)}
              style={styles.releaseRow}
            >
              <View style={styles.releaseIconWrap}>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Circle cx={12} cy={12} r={10} stroke={colors.semantic.error} strokeWidth={1.75} fill="none" />
                  <Path d="M8 8 L16 16 M16 8 L8 16" stroke={colors.semantic.error} strokeWidth={1.75} strokeLinecap="round" />
                </Svg>
              </View>
              <Text style={styles.releaseText}>Release this Anchor</Text>
              <ChevronRight size={18} color={colors.text.secondary} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingBottom: 36 },
  heroWrap: { alignItems: 'center' },
  hero: { width: '100%', overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroWash: { ...StyleSheet.absoluteFillObject },
  heroNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  heroNavButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(251,249,244,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 3,
  },
  heroCopy: {
    alignItems: 'center',
    maxWidth: '88%',
    zIndex: 2,
  },
  intention: {
    fontFamily: typography.displayBold,
    fontSize: 27,
    lineHeight: 32,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  category: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
  },
  created: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 5,
  },
  arc: {
    position: 'absolute',
    bottom: -1,
  },

  body: {
    paddingTop: 18,
    gap: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text.primary,
  },
  level: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  headingLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headingIcon: {
    marginLeft: 5,
  },
  hiddenValueTest: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },

  /* Thread Strength */
  thread: {
    backgroundColor: 'rgba(244,241,233,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  threadMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  threadValueGroup: {
    flexShrink: 0,
  },
  threadPercent: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 38,
    lineHeight: 42,
    color: colors.text.primary,
  },
  threadDelta: {
    fontFamily: typography.bodySemiBold,
    fontSize: 12,
    marginTop: 1,
  },
  threadTrackWrap: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },

  /* Today Card */
  todayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: 'rgba(244,241,233,0.6)',
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  todayArtThumbnailWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.grouped,
    flexShrink: 0,
  },
  todayArtThumbnail: {
    width: '100%',
    height: '100%',
  },
  todayBody: {
    flex: 1,
    minWidth: 0,
  },
  todayEyebrow: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.text.secondary,
  },
  todayTitle: {
    fontFamily: typography.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text.primary,
    marginTop: 1,
  },
  todayMeta: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13,
    color: colors.text.primary,
    marginTop: 2,
  },
  todayReason: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.secondary,
    marginTop: 4,
  },
  todayPending: {
    height: 80,
    justifyContent: 'center',
    gap: 6,
  },

  /* Generic Section Block */
  sectionBlock: {
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontFamily: typography.displayBold,
    fontSize: 16,
    color: colors.text.primary,
  },
  viewAll: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13,
    color: colors.text.primary,
  },

  /* Vision Section */
  visionPhotoCard: {
    width: '100%',
    aspectRatio: 16 / 9.5,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18212A',
  },
  visionPhotoImage: {
    width: '100%',
    height: '100%',
  },
  visionPhotoScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '75%',
  },
  visionStatement: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    fontFamily: 'EBGaramond-Medium',
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  visionDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  visionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Recent Practice */
  practiceList: {
    gap: 8,
  },
  practiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  practiceIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  practiceItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  practiceItemTitle: {
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    color: colors.text.primary,
  },
  practiceItemDuration: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.text.secondary,
  },
  practiceItemDate: {
    fontFamily: typography.bodyMedium,
    fontSize: 12.5,
    color: colors.text.secondary,
  },

  /* Chart */
  chartPhotoCard: {
    width: '100%',
    height: 108,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#18212A',
    marginTop: 10,
  },
  chartReadyFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  chartReadyContent: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    zIndex: 1,
  },
  chartReadyTitle: {
    fontFamily: typography.displaySemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  chartReadySubtitle: {
    fontFamily: typography.body,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  chartChevronCircle: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  /* Empty Cards */
  emptyArtCard: {
    position: 'relative',
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    borderColor: colors.border.subtle,
    borderWidth: 1,
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  emptyCardImageFrame: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  emptyCardImage: {
    width: '100%',
    height: '100%',
  },
  emptyArtScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },
  emptyCardContent: {
    zIndex: 1,
    paddingLeft: 16,
    paddingBottom: 14,
    paddingRight: 64,
  },
  emptyCardTitle: {
    fontFamily: typography.displaySemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text.inverse,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyCardPayoff: {
    fontFamily: typography.body,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.text.inverse + 'B3',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyCardChevronCircle: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text.inverse + '26',
    zIndex: 1,
  },

  /* Release */
  releaseRow: {
    minHeight: 44,
    marginTop: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  releaseIconWrap: {
    marginRight: 10,
  },
  releaseText: {
    flex: 1,
    fontFamily: typography.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.semantic.error,
  },

  quiet: {
    fontFamily: typography.body,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.82,
  },
});
