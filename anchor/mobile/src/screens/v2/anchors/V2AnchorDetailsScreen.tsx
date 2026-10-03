import { releaseArtworkRect } from '@/components/v2/release/releaseBurn';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MoreHorizontal, Play, Sparkle } from 'lucide-react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CircularAnchorRenderer, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { HandDrawnThreadLine } from '@/components/v2/thread';
import { anchorArtworkSvg, anchorRenderProps, categoryLabel, durationLabel, shortDate } from '@/components/v2/anchors';
import { useAnchorExportActions, useV2AnchorDetail } from '@/hooks/v2/anchors';
import { useV2Vision } from '@/hooks/v2/vision';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveAnchorChartState, type HomeChartState } from '@/adapters/v2/home/chartAdapter';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { resolveEvolutionStage } from '@/adapters/v2/progress/progressAdapter';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '@/adapters/v2/practice';
import { isV2RecommendationContextFresh, peekV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { V2_RECOMMENDATION_ACTION_TO_MODE, V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { todayReasonCopy } from '@/components/v2/home/V2HomeTodaySection';
import { spacing, colors, getCategoryColor, getCategoryTextColor, getPracticeColor } from '@/theme/v2';
import { useV2DailyShellIntents, type V2DailyShellParamList } from '@/screens/v2/home/dailyShell';
import { ANCHOR_DETAIL_EMPTY_ART, ANCHOR_DETAIL_PRACTICE_ART } from '@/components/v2/anchors/anchorDetailArt';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import {
  PRACTICE_CARD_HEIGHT,
  SHEET_HANDLE_HEIGHT,
  SHEET_SCROLL_TOLERANCE,
  nearestSnap,
  nextSnapForTap,
  resolveSheetLayout,
  resolveSheetSnaps,
} from '@/components/v2/anchors/anchorDetailsSheetLayout';
import { AnchorOptionsMenu, type AnchorOptionsMenuAction } from '@/components/AnchorOptionsMenu';
import { ExportAnchorSheet } from '@/components/ExportAnchorSheet';
import { AnchorTransitionScene, useAnchorTransitionPlace, useProgressiveFocusTransition } from '@/navigation/v2/ProgressiveFocusTransition';
import { ChartWorldPreview } from '@/components/v2/chart/ChartWorldPreview';
import { VisionBoardPreview } from '@/components/v2/vision/VisionBoardPreview';
import { predictPracticeSetupAnchorRect } from '@/navigation/v2/anchorHeroGeometry';
import { useV2Responsive, useV2ReduceMotion } from '@/hooks/v2';
import { VisualProfiler } from '@/utils/visualProfiler';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Route = RouteProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Recommendation = { mode: V2PracticeMode; reason: string; delta: number | null; strength: number | null };

const DETAIL_ACTION_COPY = {
  visionTitle: 'Add Vision',
  visionPayoff: 'See where this leads.',
  chartTitle: 'Create Chart',
  chartPayoff: 'Map the path from here.',
};

const PRACTICE_ART = ANCHOR_DETAIL_PRACTICE_ART;
const EMPTY_ART = ANCHOR_DETAIL_EMPTY_ART;

const SNAP_MS = 420;
const SNAP_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const SHEET_GUTTER = 20;
const TOAST_MS = 1900;

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

/** A soft glow behind the Anchor, in the Anchor's own category colour. */
function Halo({ color }: { color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" pointerEvents="none">
      <Defs>
        {/* rx/ry are explicit: Android ignores a gradient without them. */}
        <RadialGradient id="anchor-halo" cx="50" cy="50" rx="50" ry="50" fx="50" fy="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={0.15} />
          <Stop offset="0.96" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} fill="url(#anchor-halo)" />
    </Svg>
  );
}

/** Category · 23% · drawn thread · FORMING. The one Thread Strength read on this screen. */
function ThreadMeta({
  value,
  delta,
  category,
  size,
  active,
  onPress,
}: {
  value: number | null;
  delta: number | null;
  category: string;
  size: 'centered' | 'header';
  active: boolean;
  onPress: () => void;
}) {
  const centered = size === 'centered';
  const accent = getCategoryColor(category);
  const categoryText = getCategoryTextColor(category, detailsPalette.cream, detailsPalette.ink);
  const level = value === null ? 'NOT ESTABLISHED' : resolveEvolutionStage(value).toUpperCase();
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  const deltaPhrase = typeof delta === 'number' && delta !== 0 ? `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} percent this week` : '';
  const label = `Thread Strength ${value === null ? 'not established' : `${numeric} percent, ${level.toLowerCase()}`}${deltaPhrase}. Open progress.`;

  return (
    <Pressable
      testID="v2-anchor-thread"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!active}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={[styles.meta, { gap: centered ? 10 : 8 }]}
    >
      <Text style={[styles.metaCategory, { color: categoryText, fontSize: centered ? 11 : 10.5, letterSpacing: centered ? 2.4 : 2.1 }]}>
        {categoryLabel(category).toUpperCase()}
      </Text>
      <View style={styles.metaDot} />
      <Text style={[styles.metaNumeral, { fontSize: centered ? 15 : 14 }]}>{value === null ? '—' : `${numeric}%`}</Text>
      <HandDrawnThreadLine
        percent={numeric}
        color={accent}
        trackColor={detailsPalette.ink}
        unmeasured={value === null}
        compact
        showLabel={false}
        width={centered ? 72 : 60}
        testID={`v2-thread-line-${size}`}
      />
      <Text style={[styles.metaStatus, { color: categoryText, fontSize: centered ? 10 : 9.5, letterSpacing: centered ? 1.6 : 1.4 }]} numberOfLines={1}>
        {level}
      </Text>
    </Pressable>
  );
}

function SectionHeader({ title, action, actionLabel, onAction }: { title: string; action?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <Text style={styles.viewAll}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TodayCard({
  recommendation,
  error,
  duration,
  hasVision,
  onPress,
}: {
  recommendation: Recommendation | null;
  error: boolean;
  duration: number;
  hasVision: boolean;
  onPress: (mode: V2PracticeMode) => void;
}) {
  if (!recommendation) {
    return (
      <View style={styles.todayPending}>
        <Text style={styles.todayEyebrow}>Recommended practice</Text>
        <Text style={styles.quiet}>{error ? 'Today’s recommendation is unavailable.' : 'Loading today’s recommendation…'}</Text>
      </View>
    );
  }

  const mode = recommendation.mode;
  const modeTitle = V2_PRACTICE_MODE_BY_ID[mode]?.title ?? 'Focus';
  const reason = mode === 'visualize' && hasVision ? 'Step back into your Vision.' : todayReasonCopy(recommendation.reason, mode);
  const meta = mode === 'release' ? reason : `${durationLabel(duration)} · ${reason}`;

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
        <Text style={styles.todayEyebrow}>Recommended practice</Text>
        <Text style={styles.todayTitle}>{modeTitle}</Text>
        <Text style={styles.todayMeta} numberOfLines={2}>{meta}</Text>
      </View>
      <View style={[styles.todayPlay, { backgroundColor: getPracticeColor(mode) }]}>
        <Play size={20} color={detailsPalette.ink} fill={detailsPalette.ink} />
      </View>
    </Pressable>
  );
}

function VisionSection({
  state,
  accent,
  visionTile,
  tiles,
  statement,
  seenToday,
  onOpenVision,
  onEditVision,
  onRetry,
}: {
  state: ReturnType<typeof useV2Vision>['state'];
  accent: string;
  visionTile: { imageUrl?: string | null } | null | undefined;
  tiles: Array<{ id: string; imageUrl?: string | null }>;
  statement?: string;
  seenToday?: boolean;
  onOpenVision: () => void;
  onEditVision: () => void;
  onRetry: () => void | Promise<void>;
}) {
  const hasVision = Boolean(visionTile?.imageUrl || statement?.trim());

  if (state.state === 'loading' || state.state === 'error') {
    return <View testID="v2-details-vision-section" style={styles.sectionBlock}>
      <SectionHeader title="Vision" />
      <View style={styles.visionPending}>
        <Text style={styles.quiet}>{state.state === 'error' ? state.message : 'Your Vision is loading.'}</Text>
        {state.state === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry Vision" onPress={onRetry} hitSlop={10}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable> : null}
      </View>
    </View>;
  }

  if (!hasVision) {
    return (
      <View testID="v2-details-vision-section" style={styles.sectionBlock}>
        <SectionHeader title="Vision" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vision"
          onPress={onOpenVision}
          style={({ pressed }) => [styles.visionEmpty, pressed && styles.pressed]}
        >
          <View style={{ gap: spacing[2] }}>
            <Text style={styles.emptyVisionTitle}>{DETAIL_ACTION_COPY.visionTitle}</Text>
            <Text style={styles.emptyVisionPayoff}>{DETAIL_ACTION_COPY.visionPayoff}</Text>
          </View>
          <ChevronRight size={22} color={detailsPalette.ink} />
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="v2-details-vision-section" style={styles.sectionBlock}>
      <SectionHeader title="Vision" action="Edit ›" actionLabel="Edit Vision" onAction={onEditVision} />
      <View style={styles.cardClip}>
        <VisionBoardPreview key={state.state === 'ready' ? state.visionId : 'vision'} tiles={tiles} statement={statement} variant="details" accent={accent}
          testID="v2-details-vision" accessibilityLabel="Vision" onPress={onOpenVision} />
      </View>
      {seenToday ? <Text style={styles.quiet}>Seen today ✓</Text> : null}
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
    <View testID="v2-details-recent-section" style={styles.sectionBlock}>
      <SectionHeader title="Recent practice" action="View all →" actionLabel="View all practice" onAction={onViewAll} />
      {entries.length ? (
        <View style={styles.practiceList}>
          {entries.slice(0, 4).map((entry) => {
            const isToday = isDateToday(entry.completedAt);
            const dateStr = isToday ? 'Today' : shortDate(entry.completedAt);
            return (
              <View key={entry.id} style={styles.practiceItemRow}>
                <View style={[styles.practiceIconBadge, { backgroundColor: getPracticeColor(entry.mode) }]}>
                  <Sparkle size={16} color={detailsPalette.ink} fill={detailsPalette.ink} />
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
  category,
  width,
  onOpenChart,
  onRetry,
}: {
  chart: HomeChartState;
  chartCourseId?: string;
  category?: string | null;
  width: number;
  onOpenChart: (courseId?: string) => void;
  onRetry: () => void | Promise<void>;
}) {
  const mapWidth = Math.max(1, width - SHEET_GUTTER * 2 - 2);
  return (
    <View testID="v2-details-chart-section" style={styles.sectionBlock}>
      <SectionHeader
        title="Chart"
        action={chart.state === 'ready' ? 'View all ›' : undefined}
        actionLabel="View all Chart"
        onAction={() => onOpenChart(chartCourseId)}
      />
      {chart.state === 'ready' ? (
        <ChartWorldPreview chart={chart} width={mapWidth} category={category} variant="details" onPress={() => onOpenChart(chartCourseId)} testID="v2-details-chart" />
      ) : chart.state === 'none' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Create Chart. Map the path from here."
          onPress={() => onOpenChart()} style={({ pressed }) => [styles.emptyArtCard, pressed && styles.pressed]}>
          <EmptyCardArtwork source={EMPTY_ART.chart} testID="v2-chart-empty-art" />
          <View style={styles.emptyCardContent}>
            <Text style={styles.emptyCardTitle}>{DETAIL_ACTION_COPY.chartTitle}</Text>
            <Text style={styles.emptyCardPayoff}>{DETAIL_ACTION_COPY.chartPayoff}</Text>
          </View>
          <EmptyCardChevron />
        </Pressable>
      ) : (
        <View style={[styles.chartPending, { minHeight: 270 }]}>
          <Text style={styles.quiet}>{chart.state === 'error' ? chart.message : 'Your Chart is loading.'}</Text>
          {chart.state === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel="Retry Chart" onPress={onRetry} hitSlop={10} style={styles.chartRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable> : null}
        </View>
      )}
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
  const focusTransition = useProgressiveFocusTransition();
  const backDispatchingRef = useRef(false);
  const { params } = useRoute<Route>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const viewport = useV2Responsive();
  const reduceMotion = useV2ReduceMotion();
  const intents = useV2DailyShellIntents();
  const detail = useV2AnchorDetail(params.anchorId);
  const anchorId = detail.anchor?.localId ?? detail.anchor?.id ?? '';
  const serverId = detail.anchor?.id ?? '';
  const recommendation = useRecommendation(serverId);
  const vision = useV2Vision(serverId);
  const exportActions = useAnchorExportActions(detail.anchor);

  // The Anchor is the Anchor transition's `details` place: Home's flight lands
  // here and the Practice flight leaves from here. Android moves a newly pushed
  // native screen beneath the status bar after its first layout callback, so
  // the settled position is measured one beat later.
  const place = useAnchorTransitionPlace('details', params.anchorId, 'paper', { measureDelayMs: focusTransition.reduceMotion ? 0 : 120 });

  // ── Sheet geometry: one shared value, `y` (the sheet's top edge), drives everything ──
  const snaps = useMemo(() => resolveSheetSnaps(height, insets.top), [height, insets.top]);
  const restLayout = useMemo(
    () => resolveSheetLayout({ y: snaps.rest, snaps, width, height, topInset: insets.top }),
    [height, insets.top, snaps, width],
  );
  const restSize = restLayout.anchorSize;
  const restLeft = restLayout.anchorCenterX - restSize / 2;
  const restTop = restLayout.anchorTop;
  const restCenterY = restTop + restSize / 2;

  const sheetY = useSharedValue(snaps.rest);
  const dragStartY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const bodyPanBase = useSharedValue(0);
  const settledSnapRef = useRef<'rest' | 'half' | 'full'>('rest');
  const [blockMode, setBlockMode] = useState<'centered' | 'header'>('centered');
  const [scrollOn, setScrollOn] = useState(false);
  const [barOn, setBarOn] = useState(false);

  const layout = useDerivedValue(
    () => resolveSheetLayout({ y: sheetY.value, snaps, width, height, topInset: insets.top }),
    [snaps, width, height, insets.top],
  );

  // Rotation or an inset change moves the snaps; keep the sheet on the one it was resting at.
  useEffect(() => {
    sheetY.value = snaps[settledSnapRef.current];
  }, [sheetY, snaps]);

  const onSettled = useCallback((target: number) => {
    settledSnapRef.current = target === snaps.full ? 'full' : target === snaps.half ? 'half' : 'rest';
  }, [snaps]);

  const settleTo = useCallback((target: number) => {
    'worklet';
    cancelAnimation(sheetY);
    sheetY.value = withTiming(
      target,
      { duration: reduceMotion ? 0 : SNAP_MS, easing: SNAP_EASING },
      (finished) => {
        if (finished) runOnJS(onSettled)(target);
      },
    );
  }, [onSettled, reduceMotion, sheetY]);

  const handleGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(3)
      .onStart(() => {
        cancelAnimation(sheetY);
        dragStartY.value = sheetY.value;
      })
      .onUpdate((event) => {
        sheetY.value = Math.max(snaps.full, Math.min(snaps.rest, dragStartY.value + event.translationY));
      })
      .onEnd((event) => {
        settleTo(nearestSnap(sheetY.value, event.velocityY, snaps));
      });
    const tap = Gesture.Tap().onEnd((_event, success) => {
      if (success) settleTo(nextSnapForTap(sheetY.value, snaps));
    });
    return Gesture.Race(pan, tap);
  }, [dragStartY, settleTo, sheetY, snaps]);

  /**
   * The body hands a drag back to the sheet: anywhere on it while the sheet is
   * below full (the content does not scroll then), and downward from the top of
   * the content once it is full. Everything else stays with the ScrollView.
   */
  const bodyGesture = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      touchStartX.value = touch.absoluteX;
      touchStartY.value = touch.absoluteY;
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const dy = touch.absoluteY - touchStartY.value;
      const dx = touch.absoluteX - touchStartX.value;
      if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
      const belowFull = sheetY.value > snaps.full + SHEET_SCROLL_TOLERANCE;
      if (belowFull || (dy > 0 && scrollY.value <= 0)) manager.activate();
      else manager.fail();
    })
    .onStart((event) => {
      cancelAnimation(sheetY);
      dragStartY.value = sheetY.value;
      bodyPanBase.value = event.translationY;
    })
    .onUpdate((event) => {
      sheetY.value = Math.max(snaps.full, Math.min(snaps.rest, dragStartY.value + (event.translationY - bodyPanBase.value)));
    })
    .onEnd((event) => {
      settleTo(nearestSnap(sheetY.value, event.velocityY, snaps));
    }), [bodyPanBase, dragStartY, scrollY, settleTo, sheetY, snaps, touchStartX, touchStartY]);

  useAnimatedReaction(
    () => {
      const l = layout.value;
      return {
        header: l.headerOpacity > l.centeredOpacity,
        bar: l.barOpacity > 0.5,
        scroll: sheetY.value <= snaps.full + SHEET_SCROLL_TOLERANCE,
      };
    },
    (current, previous) => {
      if (!previous || current.header !== previous.header) runOnJS(setBlockMode)(current.header ? 'header' : 'centered');
      if (!previous || current.bar !== previous.bar) runOnJS(setBarOn)(current.bar);
      if (!previous || current.scroll !== previous.scroll) runOnJS(setScrollOn)(current.scroll);
    },
    [snaps],
  );

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));
  const anchorMotionStyle = useAnimatedStyle(() => {
    const l = layout.value;
    return {
      transform: [
        { translateX: l.anchorCenterX - (restLeft + restSize / 2) },
        { translateY: l.anchorTop + l.anchorSize / 2 - restCenterY },
        { scale: l.anchorSize / restSize },
      ],
    };
  }, [restCenterY, restLeft, restSize]);
  const haloOpacityStyle = useAnimatedStyle(() => ({ opacity: layout.value.haloOpacity }));
  const centeredStyle = useAnimatedStyle(() => ({
    opacity: layout.value.centeredOpacity,
    transform: [{ translateY: layout.value.centeredTop }],
  }));
  const centeredTitleStyle = useAnimatedStyle(() => ({
    width: layout.value.centeredWidth,
    fontSize: layout.value.centeredFontSize,
    lineHeight: layout.value.centeredFontSize * 1.16,
  }));
  const headerStyle = useAnimatedStyle(() => ({
    opacity: layout.value.headerOpacity,
    width: layout.value.headerWidth,
    transform: [{ translateX: layout.value.headerLeft }, { translateY: layout.value.headerTop }],
  }));
  const practiceWrapStyle = useAnimatedStyle(() => ({
    height: layout.value.practiceHeight,
    opacity: layout.value.practiceOpacity,
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: layout.value.barOpacity }));

  // ── Menu, export, toast ──
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastText(text);
    toastTimerRef.current = setTimeout(() => setToastText(null), TOAST_MS);
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
  }, []);

  const handleMenuSelect = useCallback((action: AnchorOptionsMenuAction) => {
    setMenuOpen(false);
    if (action === 'share') exportActions.share();
    else if (action === 'wallpaper') void exportActions.saveWallpaper();
    else if (action === 'copy') void exportActions.copyIntention().then((copied) => { if (copied) showToast('Intention copied'); });
    else {
      // A second Modal cannot present while the menu's is still leaving.
      if (exportTimerRef.current) clearTimeout(exportTimerRef.current);
      exportTimerRef.current = setTimeout(() => setExportOpen(true), 250);
    }
  }, [exportActions, showToast]);

  useEffect(() => {
    VisualProfiler.record('detailsScreenMounted', { anchorId: params.anchorId });
  }, [params.anchorId]);

  useEffect(() => {
    if (!__DEV__) return undefined;
    const start = navigation.addListener('transitionStart', (event) => {
      VisualProfiler.record('screenTransition', { screen: 'details', phase: 'start', closing: event.data.closing });
    });
    const end = navigation.addListener('transitionEnd', (event) => {
      VisualProfiler.record('screenTransition', { screen: 'details', phase: 'end', closing: event.data.closing });
    });
    return () => { start(); end(); };
  }, [navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.isFocused && !navigation.isFocused()) return false;
      navigation.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [navigation]);

  const anchorChart = useAnchorChart(serverId || null);
  const focusDuration = useSettingsStore((s) => s.focusSessionDuration);
  const primeDuration = useSettingsStore((s) => s.primeSessionDuration);
  const visualizeDuration = useSettingsStore((s) => s.visualizeSessionDuration);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (backDispatchingRef.current) return;
    const state = navigation.getState();
    const previous = state.routes[state.index - 1];
    const actionType = (event.data as { action?: { type?: string } }).action?.type;
    if (previous?.name === 'V2Home' && ['GO_BACK', 'POP', 'POP_TO_TOP'].includes(actionType ?? '')) {
      event.preventDefault();
      // The travelling Anchor leaves from where Details first received it: the
      // rest position. Put the sheet back there so the hand-off has no jump.
      cancelAnimation(sheetY);
      sheetY.value = snaps.rest;
      const completeBack = () => {
        backDispatchingRef.current = true;
        navigation.dispatch(event.data.action);
      };
      if (!focusTransition.closeAnchor(params.anchorId, completeBack)) completeBack();
    }
  }), [focusTransition, navigation, params.anchorId, sheetY, snaps.rest]);

  const chart = useMemo(
    () =>
      detail.anchor
        ? resolveAnchorChartState({ data: anchorChart.data, loading: anchorChart.loading, error: anchorChart.error, includeCompleted: true })
        : ({ state: 'none' } as const),
    [anchorChart.data, anchorChart.error, anchorChart.loading, detail.anchor],
  );

  if (!detail.anchor) {
    return (
      <AnchorTransitionScene place="details">
        <V2Screen testID="v2-anchor-details-screen">
          <V2TopBar title="Anchor" onBackPress={() => navigation.goBack()} />
          <V2EmptyState title="Anchor not found" message="This Anchor may have been removed." />
        </V2Screen>
      </AnchorTransitionScene>
    );
  }

  const anchor = detail.anchor;
  const accent = getCategoryColor(anchor.category);
  const visionTile = vision.state.state === 'ready' ? vision.state.tiles.find((tile) => tile.imageUrl) : null;
  const visionTiles = vision.state.state === 'ready' ? vision.state.tiles : [];
  const visionStatement = vision.state.state === 'ready' ? vision.state.title?.trim() || vision.state.description || vision.description : '';
  const visionSeenToday = vision.state.state === 'ready' ? vision.state.seenToday : false;
  const hasVisionContent = Boolean(visionTile?.imageUrl || visionStatement?.trim());

  const hasChart = chart.state === 'ready';
  const chartCourseId = hasChart ? chart.courseId : undefined;
  const duration =
    recommendation.value?.mode === 'deep_prime'
      ? primeDuration
      : recommendation.value?.mode === 'visualize'
      ? visualizeDuration
      : focusDuration;

  const threadValue = recommendation.value?.strength ?? detail.thread?.value ?? null;
  const threadDelta = recommendation.value?.delta ?? null;
  const openProgress = () => intents.onOpenProgress(serverId);

  const openRelease = () => focusTransition.startAnchorTransition({
    anchor, from: 'details',
    to: { target: 'release', rect: releaseArtworkRect(width, height) },
    onNavigate: (withHero) => withHero ? intents.onReleaseAnchor(anchorId, { anchorTransition: true }) : intents.onReleaseAnchor(anchorId),
  });

  const openPractice = (mode: V2PracticeMode) => {
    if (mode === 'release') {
      openRelease();
      return;
    }
    // The medallion travels into the Practice setup this CTA opens.
    focusTransition.startAnchorTransition({
      anchor,
      from: 'details',
      to: {
        target: 'practiceSetup',
        rect: predictPracticeSetupAnchorRect({ viewport, topInset: insets.top, mode, hasVision: vision.state.state === 'ready' }),
      },
      onNavigate: (withHero) => intents.onOpenPractice(anchorId, mode, { anchorTransition: withHero }),
    });
  };

  const recommendedMode = recommendation.value?.mode ?? null;
  const barLabel = recommendedMode
    ? recommendedMode === 'release'
      ? 'Release'
      : `${V2_PRACTICE_MODE_BY_ID[recommendedMode]?.title ?? 'Practice'} · ${durationLabel(duration)}`
    : '';
  const barBottom = Math.max(26, insets.bottom + 10);
  const scrollHeight = height - snaps.full - SHEET_HANDLE_HEIGHT;
  const artwork = anchorRenderProps(anchor);

  return (
    <AnchorTransitionScene place="details">
      <View style={styles.stage} testID="v2-anchor-details-stage" onLayout={__DEV__ ? () => VisualProfiler.record('detailsLayoutReady', { anchorId: params.anchorId }) : undefined}>
        <StatusBar barStyle="dark-content" backgroundColor={detailsPalette.cream} />

        {/* Halo and Anchor share one transform: the halo is the Anchor's own glow. */}
        <Animated.View pointerEvents="none" style={[styles.halo, { left: restLeft - restSize * 0.075, top: restTop - restSize * 0.075, width: restSize * 1.15, height: restSize * 1.15 }, anchorMotionStyle, haloOpacityStyle]}>
          <Halo color={accent} />
        </Animated.View>
        <Animated.View
          ref={place.ref as never}
          collapsable={false}
          onLayout={place.onLayout}
          pointerEvents="none"
          style={[styles.anchor, { left: restLeft, top: restTop, width: restSize, height: restSize, opacity: place.hidden ? 0 : 1 }, anchorMotionStyle]}
        >
          <CircularAnchorRenderer
            {...artwork}
            size={restSize}
            appearance="paper"
            accessibilityLabel={categoryLabel(anchor.category) + ' Anchor artwork'}
          />
        </Animated.View>

        {/* Centered title block: the Anchor's intention under it, until the sheet rises. */}
        <Animated.View
          pointerEvents={blockMode === 'centered' ? 'box-none' : 'none'}
          accessibilityElementsHidden={blockMode !== 'centered'}
          importantForAccessibility={blockMode === 'centered' ? 'auto' : 'no-hide-descendants'}
          style={[styles.centeredBlock, { width }, centeredStyle]}
        >
          <Animated.Text accessibilityRole="header" style={[styles.centeredTitle, centeredTitleStyle]}>{anchor.intentionText}</Animated.Text>
          <ThreadMeta
            size="centered"
            value={threadValue}
            delta={threadDelta}
            category={anchor.category}
            active={blockMode === 'centered'}
            onPress={openProgress}
          />
        </Animated.View>

        {/* Header title block: the same words beside the small Anchor at full. */}
        <Animated.View
          pointerEvents={blockMode === 'header' ? 'box-none' : 'none'}
          accessibilityElementsHidden={blockMode !== 'header'}
          importantForAccessibility={blockMode === 'header' ? 'auto' : 'no-hide-descendants'}
          style={[styles.headerBlock, headerStyle]}
        >
          <Text accessibilityRole="header" numberOfLines={3} style={styles.headerTitle}>{anchor.intentionText}</Text>
          <ThreadMeta
            size="header"
            value={threadValue}
            delta={threadDelta}
            category={anchor.category}
            active={blockMode === 'header'}
            onPress={openProgress}
          />
        </Animated.View>

        <View style={[styles.navRow, { top: insets.top + 4 }]} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => navigation.goBack()} hitSlop={4} style={styles.navButton}>
            <ChevronLeft color={detailsPalette.ink} size={24} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More Anchor options"
            accessibilityHint="Share, download, wallpaper, copy intention"
            testID="v2-anchor-more"
            onPress={() => setMenuOpen(true)}
            hitSlop={4}
            style={styles.navButton}
          >
            <MoreHorizontal color={detailsPalette.ink} size={24} />
          </Pressable>
        </View>

        {/* The sheet. It is translated, never resized, so dragging does no layout. */}
        <Animated.View style={[styles.sheet, { height: height - snaps.full }, sheetStyle]}>
          <GestureDetector gesture={handleGesture}>
            <View
              collapsable={false}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Details sheet"
              accessibilityHint="Double tap to raise or lower"
              onAccessibilityTap={() => settleTo(nextSnapForTap(sheetY.value, snaps))}
              style={styles.handleZone}
              testID="v2-details-sheet-handle"
            >
              <View style={styles.handlePill} />
            </View>
          </GestureDetector>

          <GestureDetector gesture={bodyGesture}>
            <View collapsable={false} style={{ height: scrollHeight }}>
              <Animated.ScrollView
                testID="v2-anchor-details-screen"
                scrollEnabled={scrollOn}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                bounces={false}
                overScrollMode="never"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SHEET_GUTTER, paddingBottom: 150 + insets.bottom }}
              >
                <Animated.View style={[styles.practiceWrap, practiceWrapStyle]}>
                  <View style={styles.practiceInner}>
                    <TodayCard recommendation={recommendation.value} error={recommendation.error} duration={duration} hasVision={hasVisionContent} onPress={openPractice} />
                  </View>
                </Animated.View>

                <VisionSection
                  state={vision.state}
                  accent={accent}
                  visionTile={visionTile}
                  tiles={visionTiles}
                  statement={visionStatement}
                  seenToday={visionSeenToday}
                  onOpenVision={() => intents.onOpenVision(serverId)}
                  onEditVision={() => intents.onOpenVision(serverId, { edit: true })}
                  onRetry={vision.refresh}
                />

                <ChartSection
                  chart={chart}
                  chartCourseId={chartCourseId}
                  category={anchor.category}
                  width={width}
                  onRetry={anchorChart.refresh}
                  onOpenChart={(courseId) => intents.onOpenChart(serverId, courseId)}
                />

                <RecentPractice entries={detail.recentPractice} onViewAll={openProgress} />

                {!anchor.isReleased ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Release this Anchor"
                    onPress={openRelease}
                    testID="v2-details-release"
                    style={styles.releaseRow}
                  >
                    <View style={styles.releaseIconWrap}>
                      <Svg width={22} height={22} viewBox="0 0 24 24">
                        <Circle cx={12} cy={12} r={9.5} stroke={detailsPalette.releaseRose} strokeWidth={1.8} fill="none" />
                        <Path d="M9 9l6 6M15 9l-6 6" stroke={detailsPalette.releaseRose} strokeWidth={1.8} strokeLinecap="round" />
                      </Svg>
                    </View>
                    <Text style={styles.releaseText}>Release this Anchor</Text>
                    <ChevronRight size={18} color="rgba(244,237,224,.55)" />
                  </Pressable>
                ) : null}
              </Animated.ScrollView>
            </View>
          </GestureDetector>
        </Animated.View>

        {/* Pinned Visualize bar: the practice card's job once the card has scrolled away. */}
        <Animated.View pointerEvents="none" style={[styles.barFade, { height: 120 + insets.bottom }, barStyle]}>
          <LinearGradient colors={['rgba(20,22,43,0)', detailsPalette.ink]} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {recommendedMode ? (
          <Animated.View
            pointerEvents={barOn ? 'auto' : 'none'}
            accessibilityElementsHidden={!barOn}
            importantForAccessibility={barOn ? 'auto' : 'no-hide-descendants'}
            style={[styles.barWrap, { bottom: barBottom }, barStyle]}
          >
            <Pressable
              testID="v2-anchor-pinned-practice"
              accessibilityRole="button"
              accessibilityLabel={`Start ${V2_PRACTICE_MODE_BY_ID[recommendedMode]?.title ?? 'practice'}, ${durationLabel(duration)}`}
              onPress={() => openPractice(recommendedMode)}
              style={({ pressed }) => [styles.barButton, { backgroundColor: getPracticeColor(recommendedMode) }, pressed && styles.pressed]}
            >
              <Play size={18} color={detailsPalette.ink} fill={detailsPalette.ink} />
              <Text style={styles.barText}>{barLabel}</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <AnchorOptionsMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSelect={handleMenuSelect}
          top={insets.top + 54}
          busy={{ share: exportActions.isSharing, wallpaper: exportActions.isSavingWallpaper }}
        />

        <ExportAnchorSheet
          isVisible={exportOpen}
          onClose={() => setExportOpen(false)}
          sigilSvg={anchorArtworkSvg(anchor)}
          sigilUri={anchor.enhancedImageUrl ?? undefined}
          intention={anchor.intentionText}
          onSaved={showToast}
        />

        {toastText ? (
          <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 60 }]} accessibilityLiveRegion="polite">
            <View style={styles.toast}><Text style={styles.toastText}>{toastText}</Text></View>
          </View>
        ) : null}

        {/* Read by tests and the old Thread Strength QA hook; never visible. */}
        <Text testID="v2-thread-strength-value" style={styles.hiddenValueTest}>
          {threadValue === null ? '—' : threadValue}
        </Text>

        {exportActions.hiddenNodes}
      </View>
    </AnchorTransitionScene>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: detailsPalette.cream, overflow: 'hidden' },
  halo: { position: 'absolute' },
  anchor: {
    position: 'absolute',
    zIndex: 1,
  },
  centeredBlock: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  centeredTitle: {
    fontFamily: detailsFonts.serif,
    color: detailsPalette.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  headerBlock: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 2,
  },
  headerTitle: {
    fontFamily: detailsFonts.serif,
    fontSize: 19,
    lineHeight: 23,
    letterSpacing: -0.2,
    color: detailsPalette.ink,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  metaCategory: { fontFamily: detailsFonts.uiStrong },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(20,22,43,.4)' },
  metaNumeral: { fontFamily: detailsFonts.serif, color: detailsPalette.ink },
  metaStatus: { fontFamily: detailsFonts.uiStrong },
  navRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: detailsPalette.inkWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
    backgroundColor: detailsPalette.ink,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleZone: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 9,
  },
  handlePill: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(244,237,224,.34)' },
  practiceWrap: { overflow: 'hidden' },
  practiceInner: { height: PRACTICE_CARD_HEIGHT, paddingBottom: 24 },
  barFade: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6 },
  barWrap: { position: 'absolute', left: 20, right: 20, zIndex: 7 },
  barButton: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  barText: { fontFamily: detailsFonts.uiStrong, fontSize: 16, color: detailsPalette.ink },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  toast: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: detailsPalette.ink,
    shadowColor: detailsPalette.ink,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  toastText: { fontFamily: detailsFonts.uiStrong, fontSize: 14, color: detailsPalette.cream },
  hiddenValueTest: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },

  /* Recommended practice */
  todayCard: {
    borderRadius: 20,
    backgroundColor: detailsPalette.creamFaint,
    padding: 12,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  todayArtThumbnailWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.ink.deep,
    flexShrink: 0,
  },
  todayArtThumbnail: { width: '100%', height: '100%' },
  todayBody: { flex: 1, minWidth: 0 },
  todayEyebrow: {
    fontFamily: detailsFonts.ui,
    fontSize: 11,
    letterSpacing: 0.66,
    color: detailsPalette.creamMuted,
  },
  todayTitle: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 18,
    lineHeight: 22,
    color: detailsPalette.cream,
  },
  todayMeta: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    lineHeight: 17,
    color: detailsPalette.creamSoft,
  },
  todayPlay: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  todayPending: {
    minHeight: 80,
    justifyContent: 'center',
    gap: 6,
  },

  /* Sections */
  sectionBlock: { marginTop: 24 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontFamily: detailsFonts.serif,
    fontSize: 19,
    color: detailsPalette.cream,
  },
  sectionAction: { minHeight: 44, justifyContent: 'center', marginVertical: -12 },
  viewAll: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 13,
    color: detailsPalette.creamSoft,
  },
  cardClip: { borderRadius: 16, overflow: 'hidden' },
  visionEmpty: {
    minHeight: 150,
    padding: spacing[5],
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: detailsPalette.cream,
  },
  emptyVisionTitle: { fontFamily: detailsFonts.serif, fontSize: 18, lineHeight: 22, color: detailsPalette.ink },
  emptyVisionPayoff: { fontFamily: detailsFonts.ui, fontSize: 12.5, lineHeight: 16, color: 'rgba(20,22,43,.66)' },
  visionPending: { width: '100%', aspectRatio: 1 / 0.6, paddingVertical: 16 },
  practiceList: { gap: 4 },
  practiceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  practiceIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  practiceItemCopy: { flex: 1, minWidth: 0 },
  practiceItemTitle: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 15,
    color: detailsPalette.cream,
  },
  practiceItemDuration: {
    fontFamily: detailsFonts.ui,
    fontSize: 15,
    color: detailsPalette.creamMuted,
  },
  practiceItemDate: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    color: detailsPalette.creamMuted,
  },
  chartPending: { paddingVertical: 16 },
  chartRetry: { alignSelf: 'flex-start', marginTop: 8 },
  retryText: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 13,
    color: detailsPalette.creamSoft,
    textDecorationLine: 'underline',
  },

  /* Empty Chart card */
  emptyArtCard: {
    position: 'relative',
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  emptyCardImageFrame: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  emptyCardImage: { width: '100%', height: '100%' },
  emptyArtScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
  emptyCardContent: {
    zIndex: 1,
    paddingLeft: 16,
    paddingBottom: 14,
    paddingRight: 64,
  },
  emptyCardTitle: {
    fontFamily: detailsFonts.serif,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text.inverse,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyCardPayoff: {
    fontFamily: detailsFonts.ui,
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
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: detailsPalette.creamHairline,
    minHeight: 56,
    marginTop: 20,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  releaseIconWrap: { marginRight: 12 },
  releaseText: {
    flex: 1,
    fontFamily: detailsFonts.uiStrong,
    fontSize: 15,
    color: detailsPalette.releaseRose,
  },

  quiet: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    color: detailsPalette.creamMuted,
    marginTop: 4,
  },
  pressed: { opacity: 0.82 },
});
