import type { ViewInstance } from 'react-native';
import { releaseArtworkRect } from '@/components/v2/release/releaseBurn';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, MoreHorizontal, Play, Sparkle } from 'lucide-react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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
import { resolveAnchorChartState, type HomeChartState } from '@/adapters/v2/home/chartAdapter';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { getThreadStrengthLevel } from '@/constants/v2/threadEvents';
import { fetchV2RecommendationContext, type V2RecommendationContext } from '@/adapters/v2/practice';
import { isV2RecommendationContextFresh, peekV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { V2_RECOMMENDATION_ACTION_TO_MODE, V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import { resolvePracticeArtwork } from '@/components/v2/practice';
import { spacing, colors, getCategoryColor, getCategoryTextColor, getPracticeColor } from '@/theme/v2';
import { useV2DailyShellIntents, type V2DailyShellParamList } from '@/screens/v2/home/dailyShell';
import { useAnchorStore } from '@/stores/anchorStore';
import { detailsFonts, detailsPalette, withAlpha } from '@/components/v2/anchors/anchorDetailsTokens';
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
import { AnchorShareStudio } from '@/components/share/AnchorShareStudio';
import { threadQualitativeLabel } from '@/adapters/v2/home/threadAdapter';
import { AnchorTransitionScene, useAnchorTransitionPlace, useProgressiveFocusTransition } from '@/navigation/v2/ProgressiveFocusTransition';
import { ChartWorldPreview } from '@/components/v2/chart/ChartWorldPreview';
import { prefetchChartIntro } from '@/components/v2/chart/chartIntroPrefetch';
import { VisionPreviewCard } from '@/components/v2/vision/VisionPreviewCard';
import { useVisionEditorialNotes } from '@/components/v2/vision/useVisionEditorialNotes';
import { predictPracticeSetupAnchorRect } from '@/navigation/v2/anchorHeroGeometry';
import { useV2Responsive, useV2ReduceMotion } from '@/hooks/v2';
import { VisualProfiler } from '@/utils/visualProfiler';
import { useAuthStore } from '@/stores/authStore';
import { useTeachingQueue } from '@/hooks/v2/teaching/useTeachingQueue';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { DETAILS_BEATS_PER_VISIT, detailsTeachingBeats } from '@/hooks/v2/teaching/detailsTeaching';
import { ScreenTeaching } from '@/components/v2/teaching/ScreenTeaching';
import { useDevThreadStrengthStore } from '@/stores/devThreadStrengthStore';
import { measureTeachingTarget, scrollToTarget } from '@/components/v2/teaching/scrollToTarget';

type Nav = NativeStackNavigationProp<V2DailyShellParamList, 'V2AnchorDetails'>;
type Route = RouteProp<V2DailyShellParamList, 'V2AnchorDetails'>;

const DETAIL_ACTION_COPY = {
  visionTitle: 'Add Vision',
  visionPayoff: 'See where this leads.',
  chartTitle: 'Create Chart',
  chartPayoff: 'Map the path from here.',
};

const SNAP_MS = 420;
const SNAP_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const SHEET_GUTTER = 20;
const TOAST_MS = 1900;

function isDateToday(dateVal: string | Date): boolean {
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function TargetIcon({ size = 22, color = detailsPalette.focus }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={4.5} />
      <Circle cx={12} cy={12} r={1} fill={color} />
    </Svg>
  );
}

function EyeIcon({ size = 22, color = detailsPalette.visualize }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

function ReleaseIcon({ size = 22, color = detailsPalette.release }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M9 9l6 6M15 9l-6 6" />
    </Svg>
  );
}

function PlayIcon({ size = 20, color = detailsPalette.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8 5.5v13l11-6.5z" />
    </Svg>
  );
}

function EmptyImageIcon({ size = 22, color = detailsPalette.cream }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={4} width={18} height={16} rx={2.5} />
      <Circle cx={9} cy={10} r={1.6} />
      <Path d="M21 16l-5-5-8 9" />
    </Svg>
  );
}

function EmptyRouteIcon({ size = 22, color = detailsPalette.cream }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round">
      <Circle cx={5.5} cy={18} r={2} />
      <Circle cx={18.5} cy={6} r={2} />
      <Path d="M7.5 18H13a3.5 3.5 0 000-7h-2a3.5 3.5 0 010-7" strokeDasharray="2.5 3" />
    </Svg>
  );
}

export type RecommendedPractice = {
  mode: V2PracticeMode;
  name: string;
  dur: string;
  sub: string;
  bar: string;
  color: string;
  tint: string;
  fg: string;
  icon: typeof TargetIcon;
  actionIcon: typeof PlayIcon | typeof ReleaseIcon;
};

/**
 * Section 11: Recommended practice card and pinned bar follow one rule (first match wins):
 * 1. chartState === complete -> Release, color #DD5F2C, ink text, copy "Your Chart is complete."
 * 2. hasVision -> Visualize · 3 min, color #3B82C4, ink text, copy "Step back into your Vision."
 * 3. otherwise -> Focus · 10 sec, color #8B5CF6, white text, copy "Hold your anchor in focus."
 */
export function resolveRecommendedPractice({
  chartState,
  hasVision,
}: {
  chartState: 'none' | 'active' | 'complete';
  hasVision: boolean;
}): RecommendedPractice {
  if (chartState === 'complete') {
    return {
      mode: 'release',
      name: 'Release',
      dur: '',
      sub: 'Your Chart is complete.',
      bar: 'Release',
      color: detailsPalette.release,
      tint: 'rgba(221,95,44,.22)',
      fg: detailsPalette.ink,
      icon: ReleaseIcon,
      actionIcon: ReleaseIcon,
    };
  }
  if (hasVision) {
    return {
      mode: 'visualize',
      name: 'Visualize',
      dur: '3 min',
      sub: 'Step back into your Vision.',
      bar: 'Visualize · 3 min',
      color: detailsPalette.visualize,
      tint: 'rgba(59,130,196,.22)',
      fg: detailsPalette.ink,
      icon: EyeIcon,
      actionIcon: PlayIcon,
    };
  }
  return {
    mode: 'focus',
    name: 'Focus',
    dur: '10 sec',
    sub: 'Hold your anchor in focus.',
    bar: 'Focus · 10 sec',
    color: detailsPalette.focus,
    tint: 'rgba(139,92,246,.22)',
    fg: '#FFFFFF',
    icon: TargetIcon,
    actionIcon: PlayIcon,
  };
}

/** 76pt dashed dark row for empty Vision and Chart states. No cream fill. */
function EmptyDashedRow({
  icon,
  title,
  payoff,
  onPress,
  onPressIn,
  accessibilityLabel,
  testID,
}: {
  icon: React.ReactNode;
  title: string;
  payoff: string;
  onPress: () => void;
  onPressIn?: () => void;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={onPressIn}
      style={({ pressed }) => [styles.emptyDashedRow, pressed && styles.pressed]}
    >
      <View style={styles.emptyDashedIconCircle}>
        {icon}
      </View>
      <View style={styles.emptyDashedCopy}>
        <Text style={styles.emptyDashedTitle}>{title}</Text>
        <Text style={styles.emptyDashedPayoff}>{payoff}</Text>
      </View>
      <ChevronRight size={18} color={withAlpha(detailsPalette.cream, 0.7)} />
    </Pressable>
  );
}

/** Compact drawn thread row: 23% / — · wave · FORMING / NOT ESTABLISHED. Never clips. */
function ThreadRow({
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
  const isEstablished = value !== null && typeof value === 'number' && Number.isFinite(value);
  const numeric = isEstablished ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  const level = isEstablished ? getThreadStrengthLevel(numeric).toUpperCase() : 'NOT ESTABLISHED';
  const deltaPhrase = typeof delta === 'number' && delta !== 0 ? `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} percent this week` : '';
  const label = `Thread Strength ${!isEstablished ? 'not established' : `${numeric} percent, ${level.toLowerCase()}`}${deltaPhrase}. Open progress.`;

  return (
    <Pressable
      testID="v2-anchor-thread"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!active}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={styles.threadRow}
    >
      <Text style={[styles.metaNumeral, { fontSize: centered ? 15 : 14, color: isEstablished ? detailsPalette.ink : withAlpha(detailsPalette.ink, 0.5) }]}>
        {!isEstablished ? '—' : `${numeric}%`}
      </Text>
      <Text style={[styles.metaStatus, styles.threadStrengthLabel]}>Thread Strength</Text>
      <HandDrawnThreadLine
        percent={numeric}
        color={accent}
        trackColor={withAlpha(detailsPalette.ink, 0.25)}
        unmeasured={!isEstablished}
        compact
        showLabel={false}
        width={centered ? 72 : 56}
        testID={`v2-thread-line-${size}`}
      />
      <Text
        style={[
          styles.metaStatus,
          {
            color: isEstablished ? accent : withAlpha(detailsPalette.ink, 0.55),
            fontSize: 10,
            letterSpacing: 1.6,
          },
        ]}
      >
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
  recommended,
  onPress,
}: {
  recommended: RecommendedPractice;
  onPress: (mode: V2PracticeMode) => void;
}) {
  const ActionIcon = recommended.actionIcon;

  return (
    <Pressable
      testID="v2-anchor-today"
      accessibilityRole="button"
      accessibilityLabel={`Practice this Anchor: ${recommended.name}`}
      onPress={() => onPress(recommended.mode)}
      style={({ pressed }) => [styles.todayCard, pressed && styles.pressed]}
    >
      <View style={styles.todayArtThumbnailWrap}>
        <Image
          testID="v2-anchor-today-art"
          source={resolvePracticeArtwork(recommended.mode)}
          style={styles.todayArtThumbnail}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={styles.todayBody}>
        <Text style={styles.todayEyebrow}>Recommended practice</Text>
        <View style={styles.todayTitleRow}>
          <Text style={styles.todayTitle}>{recommended.name}</Text>
          {recommended.dur ? (
            <Text style={styles.todayDuration}>· {recommended.dur}</Text>
          ) : null}
        </View>
        <Text style={styles.todayMeta} numberOfLines={1}>{recommended.sub}</Text>
      </View>
      <View style={[styles.todayPlay, { backgroundColor: recommended.color }]}>
        <ActionIcon size={20} color={recommended.fg} />
      </View>
    </Pressable>
  );
}

function VisionSection({
  state,
  accent,
  hasVision,
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
  hasVision: boolean;
  visionTile: { imageUrl?: string | null } | null | undefined;
  tiles: Array<{ id: string; imageUrl?: string | null }>;
  statement?: string;
  seenToday?: boolean;
  onOpenVision: () => void;
  onEditVision: () => void;
  onRetry: () => void | Promise<void>;
}) {
  const noteElements = useVisionEditorialNotes(state.state === 'ready' ? state.raw.notes : undefined);
  if (state.state === 'loading' || state.state === 'error') {
    return (
      <View testID="v2-details-vision-section" style={styles.sectionBlock}>
        <SectionHeader title="Vision" />
        <View style={styles.visionPending}>
          <Text style={styles.quiet}>{state.state === 'error' ? state.message : 'Your Vision is loading.'}</Text>
          {state.state === 'error' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Retry Vision" onPress={onRetry} hitSlop={10}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  if (!hasVision) {
    return (
      <View testID="v2-details-vision-section" style={styles.sectionBlock}>
        <SectionHeader title="Vision" />
        <EmptyDashedRow
          icon={<EmptyImageIcon size={22} color={detailsPalette.cream} />}
          title={DETAIL_ACTION_COPY.visionTitle}
          payoff={DETAIL_ACTION_COPY.visionPayoff}
          onPress={onOpenVision}
          accessibilityLabel="Vision"
        />
      </View>
    );
  }

  return (
    <View testID="v2-details-vision-section" style={styles.sectionBlock}>
      <SectionHeader title="Vision" action="Edit ›" actionLabel="Edit Vision" onAction={onEditVision} />
      <View style={styles.cardClip}>
        <VisionPreviewCard key={state.state === 'ready' ? state.visionId : 'vision'} variant="details" tiles={tiles}
          noteCount={noteElements.length} title={null} statement={statement} accent={accent}
          featuredTileId={state.state === 'ready' ? state.featuredTileId : undefined}
          testID="v2-details-vision" accessibilityLabel="Vision" onPress={onOpenVision} />
      </View>
      {seenToday ? <Text style={[styles.quiet, { marginTop: 10 }]}>Seen today ✓</Text> : null}
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
  const hasPractice = entries.length > 0;
  return (
    <View testID="v2-details-recent-section" style={styles.sectionBlock}>
      <SectionHeader
        title="Recent practice"
        action={hasPractice ? 'View all →' : undefined}
        actionLabel="View all practice"
        onAction={hasPractice ? onViewAll : undefined}
      />
      {hasPractice ? (
        <View style={styles.practiceList}>
          {entries.slice(0, 3).map((entry) => {
            const isToday = isDateToday(entry.completedAt);
            const dateStr = isToday ? 'Today' : shortDate(entry.completedAt);
            const modeColor = getPracticeColor(entry.mode);
            const Icon = entry.mode === 'release' ? ReleaseIcon : (entry.mode === 'visualize' ? EyeIcon : TargetIcon);
            const fg = entry.mode === 'focus' ? '#FFFFFF' : detailsPalette.ink;
            return (
              <View key={entry.id} style={styles.practiceItemRow}>
                <View style={[styles.practiceIconBadge, { backgroundColor: modeColor }]}>
                  <Icon size={18} color={fg} />
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

/**
 * Create Chart row. Mounting it (and pressing it) starts the intro's decode, shader, and seen-flag work, so the
 * opening can begin on its first frame. Same window width and caches as the creation flow.
 */
function ChartCreateRow({ onPress }: { onPress: () => void }) {
  const { width } = useWindowDimensions();
  const prefetch = useCallback(() => {
    void prefetchChartIntro(width).catch(() => undefined);
  }, [width]);
  useEffect(() => { prefetch(); }, [prefetch]);
  return (
    <EmptyDashedRow
      icon={<EmptyRouteIcon size={22} color={detailsPalette.cream} />}
      title={DETAIL_ACTION_COPY.chartTitle}
      payoff={DETAIL_ACTION_COPY.chartPayoff}
      onPress={onPress}
      onPressIn={prefetch}
      accessibilityLabel="Create Chart. Map the path from here."
    />
  );
}

function ChartSection({
  chart,
  width,
  category,
  chartCourseId,
  onOpenChart,
  onRetry,
}: {
  chart: HomeChartState;
  width: number;
  category: string;
  chartCourseId?: string;
  onOpenChart: (courseId?: string) => void;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <View testID="v2-details-chart-section" style={styles.sectionBlock}>
      <SectionHeader
        title="Chart"
        action={chart.state === 'ready' ? 'View all ›' : undefined}
        actionLabel="View all Chart"
        onAction={() => onOpenChart(chartCourseId)}
      />
      {chart.state === 'ready' ? (
        <ChartWorldPreview chart={chart} width={width} category={category} variant="details" onPress={() => onOpenChart(chartCourseId)} testID="v2-details-chart" />
      ) : chart.state === 'error' ? (
        <View style={[styles.chartPending, { minHeight: 165 }]}>
          <Text style={styles.quiet}>{chart.message}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Chart" onPress={onRetry} hitSlop={10} style={styles.chartRetry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : chart.state === 'resolving' || chart.state === 'loading' ? (
        <View style={[styles.chartPending, { minHeight: 165 }]}>
          <Text style={styles.quiet}>Your Chart is loading.</Text>
        </View>
      ) : (
        <ChartCreateRow onPress={() => onOpenChart()} />
      )}
    </View>
  );
}


type Recommendation = { mode: V2PracticeMode; reason: string; delta: number | null; strength: number | null };

function toRecommendation(context: V2RecommendationContext): Recommendation {
  return {
    mode: V2_RECOMMENDATION_ACTION_TO_MODE[context.recommendation.action],
    reason: context.recommendation.reason,
    delta: context.thread.delta7dStatus === 'AVAILABLE' ? context.thread.delta7d ?? null : null,
    strength: context.thread.status === 'AVAILABLE' ? context.thread.strength ?? null : null,
  };
}

function cachedRecommendation(anchorId: string) {
  const cached = peekV2RecommendationContext(anchorId);
  return { id: anchorId, value: cached ? toRecommendation(cached) : null, error: false };
}

function useRecommendation(anchorId: string) {
  const [result, setResult] = useState<{ id: string; value: Recommendation | null; error: boolean }>(() => cachedRecommendation(anchorId));

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setResult((previous) => (previous.id === anchorId && previous.value ? previous : cachedRecommendation(anchorId)));
    if (isV2RecommendationContextFresh(anchorId)) return;
    fetchV2RecommendationContext(anchorId, controller.signal).then((context) => {
      if (cancelled) return;
      setResult({ id: anchorId, error: false, value: toRecommendation(context) });
    }).catch(() => {
      if (cancelled) return;
      setResult((previous) => (previous.id === anchorId && previous.value ? previous : { id: anchorId, value: null, error: true }));
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [anchorId]);

  return result.id === anchorId ? result : cachedRecommendation(anchorId);
}

export function V2AnchorDetailsScreen() {
  const teachingFocus = useTeachingFocus();
  const teachingAccountId = useAuthStore(state => state.user?.id ?? null);
  const visionTeachingRef = useRef<ViewInstance>(null);
  const chartTeachingRef = useRef<ViewInstance>(null);
  const teachingScrollRef = useRef<Animated.ScrollView>(null);
  const teachingViewportRef = useRef<ViewInstance>(null);
  const teachingScrollSize = useRef({ content: 0, viewport: 0 });
  const sheetTeachingMoving = useSharedValue(false);
  const teachingPreparing = useSharedValue(false);
  const [detailsMoving, setDetailsMoving] = useState(false);
  const navigation = useNavigation<Nav>();
  const focusTransition = useProgressiveFocusTransition();
  const route = useRoute<Route>();
  const params = route.params ?? {};
  const anchorId = params.anchorId ?? '';
  const place = useAnchorTransitionPlace('details', params.anchorId, 'paper', { measureDelayMs: focusTransition.reduceMotion ? 0 : 120 });
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const intents = useV2DailyShellIntents();
  const responsive = useV2Responsive();
  const reduceMotion = useV2ReduceMotion();

  const detail = useV2AnchorDetail(anchorId);
  const anchor = detail.anchor;
  const serverId = anchor?.id ?? anchorId;
  const vision = useV2Vision(serverId);
  const anchorChart = useAnchorChart(serverId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Back to Home (header back, Android hardware back, the back gesture). The
   * Anchor flies from its place here to its place on Home, both measured now,
   * and the route pops under the copy once it starts. With no flight (Reduce
   * Motion, nothing measurable) the route simply pops.
   */
  const leavingRef = useRef(false);
  const backToHome = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const navigateHome = () => {
      if (serverId) useAnchorStore.getState().setCurrentAnchor(serverId);
      const routeNames = (navigation as any).getState?.()?.routeNames as string[] | undefined;
      if (routeNames?.includes('V2Home')) {
        (navigation as any).navigate('V2Home');
      } else {
        (navigation as any).navigate('V2DevelopmentHome');
      }
    };
    if (!anchor) {
      navigateHome();
      return;
    }
    const accepted = focusTransition.returnAnchor({ anchor, from: 'details', to: 'home', onNavigate: navigateHome });
    // Another flight owns the Anchor: this back is swallowed and can be pressed again.
    if (!accepted) leavingRef.current = false;
  }, [anchor, focusTransition, navigation, serverId]);

  // The back gesture pops Details natively, before any flight could start. The pop is held here and the flight runs instead; the pop itself is dispatched by the flight's navigation.
  useEffect(() => (navigation as any).addListener?.('beforeRemove', (event: { preventDefault: () => void; data: { action: { type: string } } }) => {
    const type = event.data?.action?.type;
    if (type !== 'GO_BACK' && type !== 'POP') return;
    event.preventDefault();
    backToHome();
  }), [backToHome, navigation]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (typeof (navigation as any).isFocused === 'function' && !(navigation as any).isFocused()) return false;
      backToHome();
      return true;
    });
    return () => subscription.remove();
  }, [backToHome, navigation]);

  const showToast = useCallback((message: string) => {
    setToastText(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastText(null), TOAST_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const chart = useMemo(() => resolveAnchorChartState({ ...anchorChart, includeCompleted: true }), [anchorChart]);
  const chartCourseId = anchorChart.data?.chart?.id;

  const chartState: 'none' | 'active' | 'complete' = useMemo(() => {
    if (chart.state === 'ready') {
      if (chart.isFinished || chart.journeyConfirmedComplete === true) {
        return 'complete';
      }
      return 'active';
    }
    return 'none';
  }, [chart]);

  const recommendation = useRecommendation(serverId);
  const visionTile = vision.tiles.find(tile => tile.imageUrl?.trim()) ?? vision.tiles[0];
  const visionTiles = vision.tiles;
  const visionDescription = vision.state.state === 'ready' ? vision.state.description || vision.description || '' : '';
  const visionStatement = visionDescription.trim() === anchor?.intentionText.trim() ? '' : visionDescription;
  const visionSeenToday = vision.state.state === 'ready' ? Boolean(vision.state.seenToday) : false;
  const hasVisionContent = Boolean(visionTile?.imageUrl || visionDescription.trim() ||
    (vision.state.state === 'ready' && (vision.state.title?.trim() || vision.state.raw.notes?.some(note => note.content.text.trim()))));

  const shareStateValue = recommendation.value?.strength ?? detail.thread?.value ?? null;
  const exportActions = useAnchorExportActions(anchor, {
    visionImageUrl: visionTile?.imageUrl ?? null,
    visionTiles: vision.tiles,
    visionNotes: vision.state.state === 'ready' ? vision.state.raw.notes ?? [] : [],
    visionAnnotation: vision.vision?.title ?? null,
    stateLabel: typeof shareStateValue === 'number' ? threadQualitativeLabel(shareStateValue, false) : null,
  });

  const recommended = useMemo(() => {
    return resolveRecommendedPractice({
      chartState,
      hasVision: hasVisionContent,
    });
  }, [chartState, hasVisionContent]);

  const snaps = useMemo(() => resolveSheetSnaps(height, insets.top), [height, insets.top]);
  const sheetY = useSharedValue(snaps.rest);
  const scrollOffset = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const bodyPanBase = useSharedValue(0);
  const settledSnapRef = useRef<'rest' | 'half' | 'full'>('rest');
  const [scrollOn, setScrollOn] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const [blockMode, setBlockMode] = useState<'centered' | 'header'>('centered');

  const onSettled = useCallback((target: number) => {
    sheetTeachingMoving.value = false;
    settledSnapRef.current = target === snaps.full ? 'full' : target === snaps.half ? 'half' : 'rest';
  }, [snaps, sheetTeachingMoving]);

  useEffect(() => { sheetY.value = snaps[settledSnapRef.current]; }, [snaps, sheetY]);

  const settleTo = useCallback((target: number) => {
    'worklet';
    sheetTeachingMoving.value = true;
    cancelAnimation(sheetY);
    sheetY.value = withTiming(target, { duration: reduceMotion ? 0 : SNAP_MS, easing: SNAP_EASING }, finished => {
      if (finished) runOnJS(onSettled)(target);
    });
  }, [sheetY, reduceMotion, onSettled, sheetTeachingMoving]);

  const layoutProps = useMemo(() => ({ snaps, width, height, topInset: insets.top }), [snaps, width, height, insets.top]);
  const currentLayout = useDerivedValue(() => resolveSheetLayout({ y: sheetY.value, ...layoutProps }), [layoutProps]);

  const snapRest = snaps.rest;
  const snapHalf = snaps.half;
  const snapFull = snaps.full;

  useAnimatedReaction(
    () => {
      const y = sheetY.value;
      const canScroll = y <= snapFull + SHEET_SCROLL_TOLERANCE;
      const showBar = currentLayout.value.barOpacity > 0.5;
      const mode: 'header' | 'centered' = currentLayout.value.headerOpacity > currentLayout.value.centeredOpacity ? 'header' : 'centered';
      return { canScroll, showBar, mode };
    },
    (current, previous) => {
      if (!previous || current.canScroll !== previous.canScroll) {
        runOnJS(setScrollOn)(current.canScroll);
      }
      if (!previous || current.showBar !== previous.showBar) {
        runOnJS(setBarOn)(current.showBar);
      }
      if (!previous || current.mode !== previous.mode) {
        runOnJS(setBlockMode)(current.mode);
      }
    },
    [snapRest, snapHalf, snapFull]
  );

  const startY = useSharedValue(snaps.rest);

  const handleGesture = useMemo(() => Gesture.Pan()
    .minDistance(3)
    .onStart(() => {
      'worklet';
      sheetTeachingMoving.value = true;
      cancelAnimation(sheetY);
      startY.value = sheetY.value;
    })
    .onUpdate((event) => {
      'worklet';
      const raw = startY.value + event.translationY;
      sheetY.value = Math.max(snaps.full, Math.min(snaps.rest, raw));
    })
    .onEnd((event) => {
      'worklet';
      const target = nearestSnap(sheetY.value, event.velocityY, snaps);
      settleTo(target);
    }).onFinalize((_event, success) => { if (!success) sheetTeachingMoving.value = false; }), [sheetY, startY, snaps, settleTo, sheetTeachingMoving]);

  const handleTap = useMemo(() => Gesture.Tap().onEnd((_event, success) => {
    if (success) settleTo(nextSnapForTap(sheetY.value, snaps));
  }), [sheetY, snaps, settleTo]);
  const handleGestures = useMemo(() => Gesture.Race(handleGesture, handleTap), [handleGesture, handleTap]);

  const bodyGesture = useMemo(() => Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown(event => {
      const touch = event.allTouches[0];
      if (!touch) return;
      touchStartX.value = touch.absoluteX;
      touchStartY.value = touch.absoluteY;
    })
    .onTouchesMove((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) return;
      const dx = touch.absoluteX - touchStartX.value;
      const dy = touch.absoluteY - touchStartY.value;
      if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return;
      // Claim sheet drags only. At full height, let upward gestures scroll
      // and leave stationary touches available to the Vision/Chart buttons.
      if (sheetY.value > snaps.full + SHEET_SCROLL_TOLERANCE || (dy > 0 && scrollOffset.value <= 0)) manager.activate();
      else manager.fail();
    })
    .onStart(event => {
      'worklet';
      sheetTeachingMoving.value = true;
      cancelAnimation(sheetY);
      startY.value = sheetY.value;
      bodyPanBase.value = event.translationY;
    })
    .onUpdate((event) => {
      'worklet';
      const raw = startY.value + event.translationY - bodyPanBase.value;
      sheetY.value = Math.max(snaps.full, Math.min(snaps.rest, raw));
    })
    .onEnd((event) => {
      'worklet';
      settleTo(nearestSnap(sheetY.value, event.velocityY, snaps));
    }).onFinalize((_event, success) => { if (!success) sheetTeachingMoving.value = false; }), [sheetY, snaps, scrollOffset, startY, bodyPanBase, touchStartX, touchStartY, settleTo, sheetTeachingMoving]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollOffset.value = event.contentOffset.y;
    },
  });

  const restLayout = useMemo(() => resolveSheetLayout({ y: snaps.rest, ...layoutProps }), [layoutProps, snaps.rest]);
  const restSize = restLayout.anchorSize;
  const restLeft = restLayout.anchorCenterX - restSize / 2;
  const restTop = restLayout.anchorTop;

  const anchorMotionStyle = useAnimatedStyle(() => {
    const l = currentLayout.value;
    const scale = l.anchorSize / restSize;
    // RN scales around the view's center. Move the center to the resolved
    // target before scaling so the Anchor lands beside the compact header.
    const dx = l.anchorCenterX - (restLeft + restSize / 2);
    const dy = l.anchorTop + l.anchorSize / 2 - (restTop + restSize / 2);
    return {
      transform: [
        { translateX: dx },
        { translateY: dy },
        { scale },
      ],
    };
  });

  const centeredStyle = useAnimatedStyle(() => ({
    top: currentLayout.value.centeredTop,
    opacity: currentLayout.value.centeredOpacity,
  }));

  const centeredTitleStyle = useAnimatedStyle(() => ({
    width: currentLayout.value.centeredWidth,
    fontSize: currentLayout.value.centeredFontSize,
    lineHeight: currentLayout.value.centeredFontSize * 1.16,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    left: currentLayout.value.headerLeft,
    top: currentLayout.value.headerTop,
    width: currentLayout.value.headerWidth,
    opacity: currentLayout.value.headerOpacity,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  const practiceWrapStyle = useAnimatedStyle(() => ({
    height: currentLayout.value.practiceHeight,
    opacity: currentLayout.value.practiceOpacity,
  }));

  const barStyle = useAnimatedStyle(() => ({
    opacity: currentLayout.value.barOpacity,
  }));

  const barPointerEvents = barOn ? 'auto' : 'none';

  useAnimatedReaction(() => sheetTeachingMoving.value && !teachingPreparing.value,
    (moving, previous) => { if (moving !== previous) runOnJS(setDetailsMoving)(moving); });
  const teachingQueue = useTeachingQueue({ screenId: 'details', accountId: teachingAccountId,
    eligible: detailsTeachingBeats(!hasVisionContent && vision.state.state !== 'loading' && vision.state.state !== 'error', chart.state === 'none'), cap: DETAILS_BEATS_PER_VISIT,
    blocked: !anchor || teachingFocus.transitioning || focusTransition.active || detailsMoving || menuOpen || shareOpen || exportActions.isDownloading || exportActions.isSavingWallpaper || vision.loading || chart.state === 'loading' || chart.state === 'resolving',
    isFocused: teachingFocus.isFocused });
  const getTeachingRect = useCallback(async (target: React.RefObject<ViewInstance | null>) => {
    teachingPreparing.value = true;
    try {
      // Open the existing sheet before measuring its scroll content, without changing its gestures.
      if (sheetY.value > snaps.full + SHEET_SCROLL_TOLERANCE) {
        settleTo(snaps.full);
        await new Promise(resolve => setTimeout(resolve, reduceMotion ? 0 : SNAP_MS + 40));
      }
      const viewport = await measureTeachingTarget(teachingViewportRef.current);
      return await scrollToTarget(target, teachingScrollRef, () => ({ y: scrollOffset.value, max: Math.max(0, teachingScrollSize.current.content - teachingScrollSize.current.viewport), viewportTop: viewport?.y ?? 0 }), reduceMotion);
    } finally { teachingPreparing.value = false; }
  }, [reduceMotion, scrollOffset, settleTo, sheetY, snaps.full, teachingPreparing]);

  if (!anchor) {
    return (
      <V2Screen testID="v2-anchor-details-screen">
        <V2TopBar title="Anchor" onBackPress={backToHome} />
        <V2EmptyState title="Anchor not found" message="This Anchor may have been deleted or archived." />
      </V2Screen>
    );
  }

  const threadValue = recommendation.value?.strength ?? detail.thread?.value ?? null;
  // Dev-only glow simulator (affects the aura only, not the displayed number); inert outside __DEV__.
  const devStrength = useDevThreadStrengthStore();
  const auraStrength = __DEV__ && devStrength.value !== null ? devStrength.value : threadValue;
  const threadDelta = recommendation.value?.delta ?? null;

  const openProgress = () => {
    if (!serverId) return;
    if (!anchor) {
      intents.onOpenProgress(serverId);
      return;
    }
    // The Anchor travels into the Thread Strength ring. Without a measurable
    // artwork on screen (scrolled away, not laid out) the route opens ordinarily.
    focusTransition.startAnchorTransition({
      anchor,
      from: 'details',
      to: { target: 'progress' },
      onNavigate: (withHero) => (withHero ? intents.onOpenProgress(serverId, { anchorTransition: true }) : intents.onOpenProgress(serverId)),
    });
  };

  const openVision = (options?: { edit?: boolean }) => {
    if (options) intents.onOpenVision(serverId, options);
    else intents.onOpenVision(serverId);
  };

  const openChart = (courseId?: string) => {
    intents.onOpenChart(serverId, courseId);
  };

  const openRelease = () => {
    if (!anchor) {
      if (serverId) intents.onReleaseAnchor(serverId);
      return;
    }
    focusTransition.startAnchorTransition({
      anchor,
      from: 'details',
      to: { target: 'release', rect: releaseArtworkRect(width, height) },
      onNavigate: (withHero) => (withHero ? intents.onReleaseAnchor(serverId, { anchorTransition: true }) : intents.onReleaseAnchor(serverId)),
    });
  };

  const handlePracticePress = (mode: V2PracticeMode) => {
    if (mode === 'release') {
      openRelease();
      return;
    }
    if (!anchor) {
      if (serverId) intents.onOpenPractice(serverId, mode, { anchorTransition: false });
      return;
    }
    focusTransition.startAnchorTransition({
      anchor,
      from: 'details',
      to: {
        target: 'practiceSetup',
        rect: predictPracticeSetupAnchorRect({ viewport: responsive, topInset: insets.top, mode, hasVision: hasVisionContent }),
      },
      onNavigate: (withHero) => intents.onOpenPractice(serverId, mode, { anchorTransition: withHero }),
    });
  };

  const handleOpenAllPractices = useCallback(() => {
    const targetAnchorId = serverId || anchor?.localId;
    if (!targetAnchorId) return;
    if (focusTransition.active) {
      focusTransition.reset();
    }
    useAnchorStore.getState().setCurrentAnchor(targetAnchorId);
    intents.onOpenPractice(targetAnchorId, undefined, {
      anchorTransition: false,
      returnRoute: 'V2AnchorDetails',
      source: 'anchor_details',
    });
  }, [anchor?.localId, focusTransition, intents, serverId]);

  const handleMenuSelect = (action: AnchorOptionsMenuAction) => {
    setMenuOpen(false);
    if (action === 'share') {
      setShareOpen(true);
    } else if (action === 'download') {
      void exportActions.downloadPng().then((saved) => {
        if (saved) showToast('Saved to Photos');
      });
    } else if (action === 'wallpaper') {
      void exportActions.saveWallpaper();
    } else if (action === 'copy') {
      void exportActions.copyIntention().then(() => showToast('Intention copied'));
    }
  };

  const accent = getCategoryColor(anchor.category);
  const barBottom = Math.max(26, insets.bottom + 10);
  const scrollHeight = height - snaps.full - SHEET_HANDLE_HEIGHT;
  const artwork = anchorRenderProps(anchor);
  const ActionIcon = recommended.actionIcon;

  return (
    <AnchorTransitionScene place="details">
      <View style={styles.stage} testID="v2-anchor-details-stage" onLayout={__DEV__ ? () => VisualProfiler.record('detailsLayoutReady', { anchorId: params.anchorId }) : undefined}>
        <StatusBar barStyle="dark-content" />

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
            aura={{ anchorId: devStrength.nonce ? `${anchor.id}#dev${devStrength.nonce}` : anchor.id, threadStrength: auraStrength, variant: 'details', active: teachingFocus.isFocused && !focusTransition.active && !place.hidden, reducedMotion: reduceMotion }}
            appearance="paper"
            accessibilityLabel={categoryLabel(anchor.category) + ' Anchor artwork'}
          />
        </Animated.View>

        {/* Centered title block: title, category, then Thread Strength row, each on its own line */}
        <Animated.View
          pointerEvents={blockMode === 'centered' ? 'box-none' : 'none'}
          accessibilityElementsHidden={blockMode !== 'centered'}
          importantForAccessibility={blockMode === 'centered' ? 'auto' : 'no-hide-descendants'}
          style={[styles.centeredBlock, { width }, centeredStyle]}
        >
          <Animated.Text accessibilityRole="header" numberOfLines={2} style={[styles.centeredTitle, centeredTitleStyle]}>
            {anchor.intentionText}
          </Animated.Text>
          <Text style={[styles.centeredCategory, { color: accent }]}>
            {categoryLabel(anchor.category).toUpperCase()}
          </Text>
          <ThreadRow
            size="centered"
            value={threadValue}
            delta={threadDelta}
            category={anchor.category}
            active={blockMode === 'centered'}
            onPress={openProgress}
          />
        </Animated.View>

        {/* Header title block: title max 2 lines with ellipsis, category on its own line, Thread Strength row on its own line below */}
        <Animated.View
          pointerEvents={blockMode === 'header' ? 'box-none' : 'none'}
          accessibilityElementsHidden={blockMode !== 'header'}
          importantForAccessibility={blockMode === 'header' ? 'auto' : 'no-hide-descendants'}
          style={[styles.headerBlock, headerStyle]}
        >
          <Text accessibilityRole="header" numberOfLines={2} ellipsizeMode="tail" style={styles.headerTitle}>
            {anchor.intentionText}
          </Text>
          <Text style={[styles.headerCategory, { color: accent }]}>
            {categoryLabel(anchor.category).toUpperCase()}
          </Text>
          <ThreadRow
            size="header"
            value={threadValue}
            delta={threadDelta}
            category={anchor.category}
            active={blockMode === 'header'}
            onPress={openProgress}
          />
        </Animated.View>

        <View style={[styles.navRow, { top: insets.top + 4 }]} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={backToHome} hitSlop={4} style={styles.navButton}>
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
          <GestureDetector gesture={handleGestures}>
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
            <View ref={teachingViewportRef} collapsable={false} style={{ height: scrollHeight }}>
              <Animated.ScrollView
                ref={teachingScrollRef}
                onLayout={event => { teachingScrollSize.current.viewport = event.nativeEvent.layout.height; }}
                onContentSizeChange={(_width, height) => { teachingScrollSize.current.content = height; }}
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
                    <TodayCard recommended={recommended} onPress={handlePracticePress} />
                    <Pressable
                      testID="v2-anchor-all-practices"
                      accessibilityRole="button"
                      accessibilityLabel="All practice modes"
                      accessibilityHint="View all practice modes for this Anchor"
                      onPress={handleOpenAllPractices}
                      hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                      style={({ pressed }) => [styles.allPracticesLink, pressed && styles.pressed]}
                    >
                      <Text style={styles.allPracticesText}>All practice modes</Text>
                      <ChevronRight size={13} color={detailsPalette.creamMuted} strokeWidth={2} />
                    </Pressable>
                  </View>
                </Animated.View>

                <View ref={visionTeachingRef} collapsable={false}>
                <VisionSection
                  state={vision.state}
                  accent={accent}
                  hasVision={hasVisionContent}
                  visionTile={visionTile}
                  tiles={visionTiles}
                  statement={visionStatement}
                  seenToday={visionSeenToday}
                  onOpenVision={() => openVision()}
                  onEditVision={() => openVision({ edit: true })}
                  onRetry={vision.refresh}
                />
                </View>

                <View ref={chartTeachingRef} collapsable={false}>
                <ChartSection
                  chart={chart}
                  width={width - SHEET_GUTTER * 2}
                  category={anchor.category}
                  chartCourseId={chartCourseId}
                  onRetry={anchorChart.refresh}
                  onOpenChart={openChart}
                />
                </View>

                <RecentPractice entries={detail.recentPractice} onViewAll={openProgress} />

                {!anchor.isReleased ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Release this Anchor"
                    onPress={openRelease}
                    testID="v2-details-release"
                    style={styles.releaseRow}
                  >
                    <ReleaseIcon size={20} color={detailsPalette.releaseRose} />
                    <Text style={styles.releaseText}>Release this Anchor</Text>
                    <ChevronRight size={18} color={withAlpha(detailsPalette.cream, 0.55)} />
                  </Pressable>
                ) : null}
              </Animated.ScrollView>
            </View>
          </GestureDetector>
        </Animated.View>

        {/* Pinned Visualize bar: 52pt pill fading in toward full */}
        <Animated.View pointerEvents="none" style={[styles.barFade, { height: 120 + insets.bottom }, barStyle]}>
          <LinearGradient colors={[withAlpha(detailsPalette.ink, 0), detailsPalette.ink]} locations={[0, 0.52]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          pointerEvents={barPointerEvents}
          accessibilityElementsHidden={!barOn}
          importantForAccessibility={barOn ? 'auto' : 'no-hide-descendants'}
          style={[styles.barWrap, { bottom: barBottom }, barStyle]}
        >
          <Pressable
            testID="v2-anchor-pinned-practice"
            accessibilityRole="button"
            accessibilityLabel={`Start ${recommended.name}`}
            onPress={() => handlePracticePress(recommended.mode)}
            style={({ pressed }) => [styles.barButton, { backgroundColor: recommended.color }, pressed && styles.pressed]}
          >
            <ActionIcon size={20} color={recommended.fg} />
            <Text style={[styles.barText, { color: recommended.fg }]}>{recommended.bar}</Text>
          </Pressable>
        </Animated.View>

        <ScreenTeaching screen="details" queue={teachingQueue} reducedMotion={reduceMotion} targets={{
          'details.vision': { getRect: () => getTeachingRect(visionTeachingRef) },
          'details.chart': { getRect: () => getTeachingRect(chartTeachingRef) },
        }} />
        <AnchorOptionsMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onSelect={handleMenuSelect}
          top={insets.top + 54}
          busy={{ download: exportActions.isDownloading, wallpaper: exportActions.isSavingWallpaper }}
        />

        {exportActions.shareData ? (
          <AnchorShareStudio visible={shareOpen} onClose={() => setShareOpen(false)} data={exportActions.shareData} />
        ) : null}
        {exportActions.hiddenNodes}

        {toastText ? (
          <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + 60 }]} accessibilityLiveRegion="polite">
            <View style={styles.toast}><Text style={styles.toastText}>{toastText}</Text></View>
          </View>
        ) : null}

        {/* Read by tests and legacy QA hooks */}
        <Text testID="v2-thread-strength-value" style={styles.hiddenValueTest}>
          {threadValue === null ? '—' : threadValue}
        </Text>
        <Text testID="anchor-detail-streak-value" style={styles.hiddenValueTest}>
          {threadValue === null ? '—' : threadValue}
        </Text>
      </View>
    </AnchorTransitionScene>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: detailsPalette.cream,
  },
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
  centeredCategory: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
    textAlign: 'center',
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
  },
  headerCategory: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 2.0,
    marginTop: 6,
  },
  threadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
    minHeight: 20,
  },
  metaNumeral: {
    fontFamily: detailsFonts.serif,
  },
  metaStatus: {
    fontFamily: detailsFonts.uiStrong,
  },
  threadStrengthLabel: { color: withAlpha(detailsPalette.ink, 0.5), fontSize: 10, letterSpacing: 1.6 },
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
    shadowColor: detailsPalette.ink,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -10 },
  },
  handleZone: {
    height: SHEET_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 9,
  },
  handlePill: { width: 40, height: 4, borderRadius: 2, backgroundColor: withAlpha(detailsPalette.cream, 0.34) },
  practiceWrap: { overflow: 'hidden' },
  practiceInner: { height: PRACTICE_CARD_HEIGHT, paddingBottom: 18 },
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
  barText: { fontFamily: detailsFonts.uiStrong, fontSize: 16 },
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
    backgroundColor: withAlpha(detailsPalette.cream, 0.07),
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
    backgroundColor: detailsPalette.ink,
    flexShrink: 0,
  },
  todayArtThumbnail: {
    width: '100%',
    height: '100%',
  },
  todayBody: { flex: 1, minWidth: 0 },
  todayEyebrow: {
    fontFamily: detailsFonts.ui,
    fontSize: 11,
    letterSpacing: 0.66,
    color: detailsPalette.creamMuted,
  },
  todayTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  todayTitle: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 18,
    lineHeight: 22,
    color: detailsPalette.cream,
  },
  todayDuration: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    color: detailsPalette.creamMuted,
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
  allPracticesLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  allPracticesText: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.15,
    color: detailsPalette.creamMuted,
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
    fontFamily: detailsFonts.display,
    fontSize: 18,
    lineHeight: 23,
    color: detailsPalette.cream,
  },
  sectionAction: { minHeight: 44, justifyContent: 'center', marginVertical: -12 },
  viewAll: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    color: detailsPalette.creamMuted,
  },
  quiet: {
    fontFamily: detailsFonts.ui,
    fontSize: 14,
    color: detailsPalette.creamMuted,
  },
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: detailsPalette.cream,
  },
  visionPending: { width: '100%', aspectRatio: 1 / 0.6, paddingVertical: 16 },
  practiceList: { gap: 4 },
  practiceItemRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 4,
  },
  practiceIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  practiceItemCopy: { flex: 1, minWidth: 0 },
  practiceItemTitle: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 15,
    color: detailsPalette.cream,
  },
  practiceItemDuration: {
    fontFamily: detailsFonts.ui,
    color: detailsPalette.creamMuted,
  },
  practiceItemDate: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    color: detailsPalette.creamMuted,
  },
  chartPending: { justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 24 },
  chartRetry: { minHeight: 44, justifyContent: 'center' },
  retryText: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 14,
    color: detailsPalette.visualize,
  },

  /* Empty 76pt dashed rows */
  emptyDashedRow: {
    minHeight: 76,
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(detailsPalette.cream, 0.32),
    backgroundColor: withAlpha(detailsPalette.cream, 0.04),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    marginTop: 12,
  },
  emptyDashedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(detailsPalette.cream, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDashedCopy: {
    flex: 1,
    minWidth: 0,
  },
  emptyDashedTitle: {
    fontFamily: detailsFonts.uiStrong,
    fontSize: 16,
    lineHeight: 20,
    color: detailsPalette.cream,
  },
  emptyDashedPayoff: {
    fontFamily: detailsFonts.ui,
    fontSize: 13,
    lineHeight: 17,
    color: detailsPalette.creamSoft,
    marginTop: 1,
  },

  /* Release */
  releaseRow: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: detailsPalette.creamHairline,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  releaseText: {
    flex: 1,
    fontFamily: detailsFonts.ui,
    fontSize: 15,
    color: detailsPalette.releaseRose,
  },
  pressed: { opacity: 0.82 },
});
