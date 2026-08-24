/**
 * WeeklyReviewScreen
 *
 * Full-page weekly digest: Thread Strength movement, 7-day Weave chart,
 * practice metrics, top Anchors, pattern insight, optional Chart course
 * progress, and a Carry It Forward recommendation.
 *
 * Entry: navigate('WeeklyReview') from Sanctuary Home (no required params).
 * Defaults to last completed week (offset = 1), except on Sunday — when the
 * in-app review window opens per weeklyReviewWindow.ts — where it defaults
 * to the current, wrapping-up week (offset = 0).
 *
 * Visual reference: Weekly Review (Standalone).html
 * Spec: Weekly Review Implementation Prompt.md
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import type { PracticeStackParamList } from '@/types';
import type { PracticeMode } from '@/types/practice';
import { useCourseStore } from '@/stores/courseStore';
import { useAuthStore } from '@/stores/authStore';
import { SigilSvg } from '@/components/common/SigilSvg';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { usePracticeEntry } from '@/hooks/usePracticeEntry';
import { useWeeklyReview, MAX_WEEK_OFFSET, type WeeklyReviewData } from '@/hooks/useWeeklyReview';
import { canViewChart, type CourseDetail, type WaypointSummary } from '@/types/chart';
import {
  WeaveCanvas,
  buildWeaveGeometry,
  WEAVE_PLOT_PADDING,
  type WeaveNode,
} from '@/screens/weave';

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  midnight: '#0B1015',
  navy: '#0F1419',
  steel: '#18222B',
  harbor: '#1E2A33',
  gold: '#D9B36C',
  lightGold: '#F2DFA8',
  bone: '#F4EFE6',
  ash: '#87939D',
  rule: 'rgba(135,147,157,0.16)',
  hairline: 'rgba(217,179,108,0.11)',
  slack: 'rgba(135,147,157,0.26)',
} as const;

const MODE_COLORS: Record<PracticeMode, string> = {
  focus: 'oklch(72% 0.09 300)',
  visualize: 'oklch(74% 0.08 235)',
  deep_prime: 'oklch(82% 0.11 98)',
  release: 'oklch(62% 0.12 45)',
};

// Safe RGB fallbacks for React Native SVG (oklch not supported in RN SVG)
const MODE_COLORS_RN: Record<PracticeMode, string> = {
  focus: '#AD99D2',
  visualize: '#78B4D1',
  deep_prime: '#F0CB6A',
  release: '#C8875A',
};

const MODE_LABELS: Record<PracticeMode, string> = {
  focus: 'Focus',
  visualize: 'Visualize',
  deep_prime: 'Deep Prime',
  release: 'Release',
};

const MODE_ORDER: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];

const FONTS = {
  ritual: 'Cinzel-Regular' as const,
  ritualBold: 'Cinzel-SemiBold' as const,
  voice: 'EBGaramond-Italic' as const,
  voiceReg: 'EBGaramond-Regular' as const,
  inst: 'Inter-Regular' as const,
};

const { width: SCREEN_W } = Dimensions.get('window');
const WEAVE_W = Math.min(334, SCREEN_W - 48);
const WEAVE_H = 136;
const SECTION_PAD = 24;

// ─── Entrance animation helpers ───────────────────────────────────────────────

const STAGGER_DELAYS = [50, 80, 140, 200, 240, 280, 320, 360, 400];

function useFadeIn(delayMs: number, reducedMotion: boolean) {
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 14);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = withDelay(delayMs, withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delayMs, withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) }));
  }, [delayMs, reducedMotion, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── Skeleton screen ──────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 0.6 : 0.45);

  useEffect(() => {
    if (reducedMotion) { opacity.value = 0.6; return; }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.45, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [reducedMotion, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: 6, backgroundColor: C.steel },
        style,
        animStyle,
      ]}
    />
  );
}

function WeeklyReviewSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top }]}
      accessibilityLabel="Loading your Weekly Review"
    >
      <View style={styles.skeletonInner}>
        {/* eyebrow + title */}
        <SkeletonBlock width={120} height={12} style={{ marginBottom: 10, marginTop: 24 }} />
        <SkeletonBlock width={200} height={28} style={{ marginBottom: 8 }} />
        {/* nav */}
        <SkeletonBlock width={160} height={20} style={{ alignSelf: 'center', marginBottom: 16 }} />
        {/* reflection */}
        <SkeletonBlock width="90%" height={14} style={{ alignSelf: 'center', marginBottom: 4 }} />
        <SkeletonBlock width="70%" height={14} style={{ alignSelf: 'center', marginBottom: 32 }} />
        {/* thread numeral */}
        <SkeletonBlock width={80} height={64} style={{ alignSelf: 'center', marginBottom: 12 }} />
        <SkeletonBlock width={160} height={14} style={{ alignSelf: 'center', marginBottom: 32 }} />
        {/* weave */}
        <SkeletonBlock width="100%" height={WEAVE_H} style={{ marginBottom: 32 }} />
        {/* metrics */}
        <View style={{ flexDirection: 'row', gap: 1, marginBottom: 32 }}>
          <SkeletonBlock width="50%" height={70} />
          <SkeletonBlock width="50%" height={70} />
        </View>
      </View>
    </View>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>
        Couldn't refresh this week — showing your last saved summary.
      </Text>
      <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.errorBannerRetry}>RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function TopBackBar({ onBack }: { onBack: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Return to Sanctuary"
      onPress={onBack}
      style={styles.topBackBar}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <ChevronLeft size={18} color={C.lightGold} />
      <Text style={styles.topBackText}>Sanctuary</Text>
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionEyebrow}>{label}</Text>;
}

function SectionRule() {
  return <View style={styles.rule} />;
}

// ─── Week nav ─────────────────────────────────────────────────────────────────

function WeekNav({
  label,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  label: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <View style={styles.weekNav}>
      <TouchableOpacity
        style={styles.weekNavBtn}
        onPress={onBack}
        disabled={!canGoBack}
        accessibilityLabel="Previous week"
        accessibilityState={{ disabled: !canGoBack }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronLeft size={18} color={canGoBack ? C.gold : C.ash} />
      </TouchableOpacity>
      <Text style={styles.weekNavLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.weekNavBtn}
        onPress={onForward}
        disabled={!canGoForward}
        accessibilityLabel="Next week"
        accessibilityState={{ disabled: !canGoForward }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ChevronRight size={18} color={canGoForward ? C.gold : C.ash} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Thread Strength block ────────────────────────────────────────────────────

function ThreadStrengthNumeral({
  value,
  reducedMotion,
}: {
  value: number;
  reducedMotion: boolean;
}) {
  const shimmer = useSharedValue(reducedMotion ? 1 : 0.85);

  useEffect(() => {
    if (reducedMotion) { shimmer.value = 1; return; }
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.78, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [reducedMotion, shimmer]);

  const animStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <View style={styles.threadNumeralWrap}>
      {/* Radial glow behind numeral */}
      <Svg
        width={120}
        height={120}
        style={StyleSheet.absoluteFillObject}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={C.gold} stopOpacity="0.18" />
            <Stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="60" cy="60" r="60" fill="url(#glow)" />
      </Svg>
      <Animated.Text style={[styles.threadNumeral, animStyle]}>
        {value}
      </Animated.Text>
    </View>
  );
}

function ThreadStrengthBlock({
  data,
  reducedMotion,
}: {
  data: WeeklyReviewData;
  reducedMotion: boolean;
}) {
  const momentumText =
    data.momentum.kind === 'strengthened'
      ? `STRENGTHENED · +${data.momentum.change}`
      : data.momentum.kind === 'softened'
        ? `SOFTENED SLIGHTLY · −${data.momentum.change}`
        : 'HELD STEADY THIS WEEK';

  const momentumColor =
    data.momentum.kind === 'strengthened'
      ? C.lightGold
      : data.momentum.kind === 'softened'
        ? C.ash
        : C.ash;

  return (
    <View style={styles.threadBlock}>
      <Text style={styles.threadSectionEyebrow}>THREAD STRENGTH</Text>
      <ThreadStrengthNumeral value={data.threadStrength} reducedMotion={reducedMotion} />
      <Text style={[styles.momentumLabel, { color: momentumColor }]}>
        — {momentumText} —
      </Text>
      <Text style={styles.threadMeta}>
        {data.returnCount} return{data.returnCount !== 1 ? 's' : ''} · {data.practiceDays} practice day{data.practiceDays !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

// ─── 7-day Weave chart ────────────────────────────────────────────────────────

type DayDetailData = {
  day: WeeklyReviewData['days'][number];
  visible: boolean;
};

function WeeklyWeaveChart({
  data,
  reducedMotion,
  onViewFullWeave,
}: {
  data: WeeklyReviewData;
  reducedMotion: boolean;
  onViewFullWeave: () => void;
}) {
  const [dayDetail, setDayDetail] = useState<DayDetailData>({ day: data.days[0], visible: false });

  // Convert 7-day review data to Weave nodes
  const { nodes, nodesByMode } = useMemo(() => {
    const nodeList: WeaveNode[] = [];
    const byMode: Record<PracticeMode, WeaveNode[]> = {
      focus: [],
      visualize: [],
      deep_prime: [],
      release: [],
    };

    data.days.forEach((day, bucketIndex) => {
      MODE_ORDER.forEach((mode) => {
        const count = day.byMode[mode] || 0;
        if (count > 0) {
          const node: WeaveNode = {
            id: `week:${data.weekStart}:${day.date}:${mode}`,
            mode,
            bucketIndex,
            startDateKey: day.date,
            endDateKey: day.date,
            events: [],
            sessionCount: count,
            durationSeconds: day.byModeDuration?.[mode] || 0,
          };
          nodeList.push(node);
          byMode[mode].push(node);
        }
      });
    });

    return { nodes: nodeList, nodesByMode: byMode };
  }, [data.days, data.weekStart]);

  const geometry = useMemo(() => {
    return buildWeaveGeometry({
      modes: MODE_ORDER,
      nodesByMode,
      bucketCount: 7,
      width: WEAVE_W,
      height: WEAVE_H,
    });
  }, [nodesByMode]);

  // Accessible text summary
  const totalSessions = data.returnCount;
  const totalDays = data.practiceDays;
  const modeText = MODE_ORDER
    .map((m) => `${MODE_LABELS[m]}: ${data.days.reduce((a, d) => a + d.byMode[m], 0)}`)
    .filter((s) => !s.endsWith(': 0'))
    .join(', ');
  const a11ySummary = `${totalSessions} completed Practice session${totalSessions !== 1 ? 's' : ''} across ${totalDays} day${totalDays !== 1 ? 's' : ''}${modeText ? `. ${modeText}.` : '.'}`;

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <View style={styles.weaveSection}>
      <SectionHeader label="THIS WEEK" />

      {/* Visually-hidden accessibility summary */}
      <Text style={styles.srOnly} accessibilityLabel={a11ySummary} importantForAccessibility="yes">
        {a11ySummary}
      </Text>

      <View style={{ width: WEAVE_W, height: WEAVE_H, position: 'relative' }} accessible={false}>
        <WeaveCanvas
          width={WEAVE_W}
          height={WEAVE_H}
          geometry={geometry}
          nodes={nodes}
          modeColors={MODE_COLORS_RN}
          backgroundColor={C.navy}
          animationKey={`${data.weekStart}-${data.weekOffset}`}
          still={reducedMotion}
        />
        {nodes.map((node) => {
          const position = geometry.nodePositions[node.id];
          if (!position) return null;
          const day = data.days[node.bucketIndex];
          if (!day) return null;
          return (
            <Pressable
              key={`${node.id}:target`}
              accessibilityRole="button"
              accessibilityLabel={`${MODE_LABELS[node.mode]}, ${day.label}, ${node.sessionCount} ${node.sessionCount === 1 ? 'session' : 'sessions'}`}
              onPress={() => setDayDetail({ day, visible: true })}
              style={[styles.nodeTarget, { left: position.left - 20, top: position.top - 20 }]}
            />
          );
        })}
      </View>

      {/* Day labels */}
      <View style={styles.weaveDayLabels}>
        {DAY_LABELS.map((l, i) => (
          <Text key={i} style={styles.weaveDayLabel}>{l}</Text>
        ))}
      </View>

      {/* Mode legend */}
      <View style={styles.weaveLegend}>
        {MODE_ORDER.map((mode) => (
          <View key={mode} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MODE_COLORS_RN[mode] }]} />
            <Text style={styles.legendLabel}>{MODE_LABELS[mode]}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={onViewFullWeave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.viewLink}>View Full Weave →</Text>
      </TouchableOpacity>

      {/* Day detail sheet */}
      {dayDetail.visible && (
        <DayDetailSheet
          day={dayDetail.day}
          onClose={() => setDayDetail((s) => ({ ...s, visible: false }))}
        />
      )}
    </View>
  );
}

// ─── Day detail bottom sheet ──────────────────────────────────────────────────

function DayDetailSheet({
  day,
  onClose,
}: {
  day: WeeklyReviewData['days'][number];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(200);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [translateY]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const dayName = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const modeBreakdown = MODE_ORDER.filter((m) => day.byMode[m] > 0);

  return (
    <Pressable
      style={styles.sheetBackdrop}
      onPress={onClose}
      accessibilityLabel="Close session detail"
    >
      <Animated.View
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, sheetStyle]}
        accessibilityViewIsModal
        accessibilityLabel="Session detail"
      >
        <Pressable onPress={() => { /* prevent bubble */ }} style={{ flex: 1 }}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetDay}>{dayName}</Text>
          <Text style={styles.sheetMeta}>
            {day.sessionCount} session{day.sessionCount !== 1 ? 's' : ''}
          </Text>
          {modeBreakdown.length > 0 ? (
            modeBreakdown.map((m) => (
              <View key={m} style={styles.sheetModeRow}>
                <View style={[styles.sheetModeDot, { backgroundColor: MODE_COLORS_RN[m] }]} />
                <Text style={styles.sheetModeLabel}>{MODE_LABELS[m]}</Text>
                <Text style={styles.sheetModeCount}>
                  {day.byMode[m]} session{day.byMode[m] !== 1 ? 's' : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.sheetEmpty}>No sessions recorded.</Text>
          )}
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

// ─── Metrics grid ─────────────────────────────────────────────────────────────

function MetricsGrid({ data }: { data: WeeklyReviewData }) {
  const cells = [
    { value: String(data.returnCount), label: 'RETURNS' },
    { value: String(data.practiceDays), label: 'PRACTICE DAYS' },
    { value: `${data.minutesInPractice} min`, label: 'IN PRACTICE' },
    { value: String(data.anchorCount), label: 'ANCHORS' },
  ];

  return (
    <View style={styles.metricsSection}>
      <SectionHeader label="YOUR PRACTICE" />
      <View style={styles.metricsGrid}>
        {cells.map((cell, i) => (
          <View
            key={cell.label}
            style={[
              styles.metricCell,
              i % 2 === 0 && styles.metricCellBorderRight,
              i < 2 && styles.metricCellBorderBottom,
            ]}
          >
            <Text style={styles.metricValue}>{cell.value}</Text>
            <Text style={styles.metricLabel}>{cell.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Practice mix ─────────────────────────────────────────────────────────────

function PracticeMix({ data }: { data: WeeklyReviewData }) {
  const hasAny = Object.values(data.modeMix).some((v) => v > 0);

  const sorted = MODE_ORDER
    .map((m) => ({ mode: m, pct: data.modeMix[m] }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <View style={styles.mixSection}>
      {!hasAny ? (
        <Text style={styles.mixEmpty}>
          Your Practice Mix will take shape as you return.
        </Text>
      ) : (
        sorted.map(({ mode, pct }) => (
          <View key={mode} style={styles.mixRow}>
            <View style={[styles.mixDot, { backgroundColor: MODE_COLORS_RN[mode] }]} />
            <Text style={styles.mixModeName}>{MODE_LABELS[mode]}</Text>
            <View style={styles.mixTrack}>
              <View
                style={[
                  styles.mixFill,
                  {
                    width: `${Math.round(pct * 100)}%` as `${number}%`,
                    backgroundColor: MODE_COLORS_RN[mode],
                  },
                ]}
              />
            </View>
            <Text style={styles.mixPct}>{Math.round(pct * 100)}%</Text>
          </View>
        ))
      )}
    </View>
  );
}

// ─── Anchor list ──────────────────────────────────────────────────────────────

function AnchorList({
  data,
  onAnchorPress,
  onViewAll,
}: {
  data: WeeklyReviewData;
  onAnchorPress: (anchorId: string) => void;
  onViewAll: () => void;
}) {
  const PLACEHOLDER_SVG = `<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="18" r="12" stroke="${C.gold}" stroke-width="1" fill="none" opacity="0.5"/></svg>`;

  if (data.anchorRows.length === 0) {
    return (
      <View style={styles.anchorSection}>
        <SectionHeader label="ANCHORS YOU RETURNED TO" />
        <Text style={styles.anchorEmpty}>No Anchors practiced this week.</Text>
      </View>
    );
  }

  return (
    <View style={styles.anchorSection}>
      <SectionHeader label="ANCHORS YOU RETURNED TO" />
      {data.anchorRows.map((row) => (
        <TouchableOpacity
          key={row.id}
          style={styles.anchorRow}
          onPress={() => onAnchorPress(row.id)}
          activeOpacity={0.75}
        >
          <View style={styles.anchorSigil}>
            {row.enhancedImageUrl ? (
              <Image
                source={{ uri: row.enhancedImageUrl }}
                style={styles.anchorSigilImage}
                resizeMode="cover"
              />
            ) : (
              <SigilSvg
                xml={row.baseSigilSvg || PLACEHOLDER_SVG}
                width={40}
                height={40}
              />
            )}
          </View>
          <View style={styles.anchorInfo}>
            <Text style={styles.anchorAffirmation} numberOfLines={2}>
              "{row.intention}"
            </Text>
            <Text style={styles.anchorMeta}>
              {row.returnCount} return{row.returnCount !== 1 ? 's' : ''} · Thread {row.threadStrength}
              {row.threadDelta > 0 ? ` · +${row.threadDelta}` : ''}
            </Text>
          </View>
          <ChevronRight size={14} color={C.ash} />
        </TouchableOpacity>
      ))}
      {data.totalAnchorCount > 5 && (
        <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.viewLink}>View all {data.totalAnchorCount} practiced Anchors →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Pattern block ────────────────────────────────────────────────────────────

function PatternBlock({ line }: { line: string }) {
  return (
    <View style={styles.patternSection}>
      <SectionHeader label="A PATTERN THIS WEEK" />
      <Text style={styles.patternLine}>{line}</Text>
    </View>
  );
}

// ─── Course section ───────────────────────────────────────────────────────────

type RouteNodeState = 'reached' | 'current' | 'upcoming' | 'destination';

function RouteNode({
  state,
  reducedMotion,
}: {
  state: RouteNodeState;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(reducedMotion ? 1 : 0.6);

  useEffect(() => {
    if (state !== 'current' || reducedMotion) { pulse.value = 1; return; }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 2750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [state, reducedMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (state === 'destination') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5Z"
          fill="none" stroke={C.gold} strokeWidth={1.5} />
      </Svg>
    );
  }

  if (state === 'reached') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Circle cx="10" cy="10" r="9" fill={C.gold} />
        <Path d="M6 10.5L9 13.5L14 8" stroke={C.midnight} strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }

  if (state === 'current') {
    return (
      <Animated.View style={pulseStyle}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          <Circle cx="10" cy="10" r="9" fill="none" stroke={C.gold} strokeWidth={2} />
          <Circle cx="10" cy="10" r="4" fill={C.gold} fillOpacity={0.5} />
        </Svg>
      </Animated.View>
    );
  }

  // upcoming
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="9" fill="none" stroke={C.ash} strokeWidth={1} strokeOpacity={0.4} />
    </Svg>
  );
}

function CourseSection({
  course,
  reducedMotion,
  onViewChart,
}: {
  course: CourseDetail;
  reducedMotion: boolean;
  onViewChart: () => void;
}) {
  const waypoints = course.waypoints ?? [];
  // Find the current waypoint index
  const currentIdx = waypoints.findIndex((w) => w.id === course.currentWaypointId);
  // Show a window of 5 nodes around current
  const windowStart = Math.max(0, Math.min(currentIdx - 2, waypoints.length - 5));
  const windowEnd = Math.min(waypoints.length, windowStart + 5);
  const windowNodes = waypoints.slice(windowStart, windowEnd);

  const currentWaypoint = course.currentWaypointId
    ? waypoints.find((w) => w.id === course.currentWaypointId)
    : null;

  const waypointState = (w: WaypointSummary): RouteNodeState => {
    if (w.state === 'REACHED') return 'reached';
    if (w.id === course.currentWaypointId) return 'current';
    // Check if this is the destination (last waypoint or destination anchor link)
    if (w.position === Math.max(...waypoints.map((wp) => wp.position))) return 'destination';
    return 'upcoming';
  };

  const waypointTitle =
    currentWaypoint?.title ??
    (course.reachedCount === course.waypointCount
      ? 'Destination reached'
      : 'On course');

  return (
    <View style={styles.courseSection}>
      <SectionHeader label="ON YOUR COURSE" />

      <Text style={styles.courseDestination} numberOfLines={2}>
        {course.destinationText}
      </Text>

      {currentWaypoint && (
        <Text style={styles.courseWaypoint}>
          Current Waypoint: {waypointTitle}
        </Text>
      )}

      {/* Mini route */}
      <View style={styles.miniRoute}>
        {windowNodes.map((w, i) => {
          const nodeState = waypointState(w);
          const isLast = i === windowNodes.length - 1;
          return (
            <React.Fragment key={w.id}>
              <RouteNode state={nodeState} reducedMotion={reducedMotion} />
              {!isLast && (
                <View
                  style={{
                    width: 24,
                    height: 1,
                    alignSelf: 'center',
                    backgroundColor: nodeState === 'reached' ? C.gold : C.ash,
                    opacity: nodeState === 'reached' ? 0.6 : 0.25,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <TouchableOpacity onPress={onViewChart} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.viewLink}>View Chart →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Carry It Forward ─────────────────────────────────────────────────────────

function CarryItForward({
  data,
  activeCourse,
  onPractice,
  onSecondary,
}: {
  data: WeeklyReviewData;
  activeCourse: CourseDetail | null;
  onPractice: (anchorId: string) => void;
  onSecondary: () => void;
}) {
  const PLACEHOLDER_SVG = `<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="18" r="12" stroke="${C.gold}" stroke-width="1" fill="none" opacity="0.5"/></svg>`;

  // Determine priority scenario
  const currentWaypoint = activeCourse?.currentWaypointId
    ? activeCourse.waypoints?.find((w) => w.id === activeCourse.currentWaypointId)
    : null;
  const linkedAnchorId = currentWaypoint?.anchorLink?.anchorId ?? null;

  const scenario: 'waypoint' | 'course' | 'none' =
    activeCourse && linkedAnchorId
      ? 'waypoint'
      : activeCourse
        ? 'course'
        : 'none';

  const anchor = data.recommendedAnchor;
  if (!anchor) return null;

  const ctaLabel =
    scenario === 'waypoint'
      ? 'PRACTICE THIS WAYPOINT →'
      : 'PRACTICE THIS ANCHOR →';

  const secondaryLabel =
    scenario === 'none' ? 'Return to Sanctuary' : 'View Chart';

  const heading =
    scenario === 'waypoint'
      ? 'CURRENT WAYPOINT'
      : 'CARRY IT FORWARD';

  const supportingLine =
    scenario === 'none'
      ? 'Take one thing from this week into the next.'
      : undefined;

  return (
    <View style={styles.carrySection}>
      <SectionHeader label={heading} />
      {supportingLine && <Text style={styles.carrySupportLine}>{supportingLine}</Text>}

      {/* Anchor card */}
      <View style={styles.carryCard}>
        <View style={styles.carrySigil}>
          {anchor.enhancedImageUrl ? (
            <Image
              source={{ uri: anchor.enhancedImageUrl }}
              style={styles.carrySigilImage}
              resizeMode="cover"
            />
          ) : (
            <SigilSvg xml={anchor.baseSigilSvg || PLACEHOLDER_SVG} width={60} height={60} />
          )}
        </View>
        <Text style={styles.carryAffirmation} numberOfLines={3}>
          "{anchor.intention}"
        </Text>
        <Text style={styles.carryMeta}>
          Thread {anchor.threadStrength}
          {anchor.returnCount > 0
            ? ` · ${anchor.returnCount} return${anchor.returnCount !== 1 ? 's' : ''} this week`
            : ''}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.carryCtaPill}
        onPress={() => onPractice(linkedAnchorId ?? anchor.id)}
        activeOpacity={0.82}
      >
        <Text style={styles.carryCtaLabel}>{ctaLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSecondary}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.carrySecondaryWrap}
      >
        <Text style={styles.carrySecondary}>{secondaryLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Quiet Week screen ────────────────────────────────────────────────────────

function QuietWeekLayout({
  data,
  activeCourse,
  insets,
  reducedMotion,
  onPractice,
  onSanctuary,
}: {
  data: WeeklyReviewData;
  activeCourse: CourseDetail | null;
  insets: ReturnType<typeof useSafeAreaInsets>;
  reducedMotion: boolean;
  onPractice: (anchorId: string) => void;
  onSanctuary: () => void;
}) {
  const anchor = data.recommendedAnchor;
  const currentWaypoint = activeCourse?.currentWaypointId
    ? activeCourse.waypoints?.find((w) => w.id === activeCourse.currentWaypointId)
    : null;
  const linkedAnchorId = currentWaypoint?.anchorLink?.anchorId ?? null;
  const PLACEHOLDER_SVG = `<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="18" r="12" stroke="${C.gold}" stroke-width="1" fill="none" opacity="0.5"/></svg>`;

  const ctaLabel = activeCourse && linkedAnchorId
    ? 'RETURN TO THIS WAYPOINT'
    : 'RETURN TO PRACTICE';

  const quietGeometry = useMemo(() => {
    return buildWeaveGeometry({
      modes: MODE_ORDER,
      nodesByMode: { focus: [], visualize: [], deep_prime: [], release: [] },
      bucketCount: 7,
      width: WEAVE_W,
      height: WEAVE_H,
    });
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <TopBackBar onBack={onSanctuary} />
      <View style={styles.sectionPad}>
        <Text style={styles.eyebrow}>WEEK IN REVIEW</Text>
        <Text style={styles.title}>Your Week, Woven</Text>
        <View style={styles.divider} />

        <Text style={styles.quietHeadline}>A quiet week.</Text>
        <Text style={styles.quietBody}>
          Nothing was lost. Your Practice is here when you're ready to return.
        </Text>

        {/* Empty Weave (still mode) */}
        <View style={styles.weaveSection}>
          <SectionHeader label="THIS WEEK" />
          <WeaveCanvas
            width={WEAVE_W}
            height={WEAVE_H}
            geometry={quietGeometry}
            nodes={[]}
            modeColors={MODE_COLORS_RN}
            backgroundColor={C.navy}
            still={true}
          />
          <View style={styles.weaveDayLabels}>
            {['M','T','W','T','F','S','S'].map((l, i) => (
              <Text key={i} style={styles.weaveDayLabel}>{l}</Text>
            ))}
          </View>
        </View>

        {anchor && (
          <TouchableOpacity
            style={[styles.carryCtaPill, { marginTop: 24 }]}
            onPress={() => onPractice(linkedAnchorId ?? anchor.id)}
            activeOpacity={0.82}
          >
            <Text style={styles.carryCtaLabel}>{ctaLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Carry It Forward (quiet variant) */}
        {anchor && (
          <View style={[styles.carrySection, { marginTop: 32 }]}>
            <SectionHeader label="CARRY IT FORWARD" />
            <View style={styles.carryCard}>
              <View style={styles.carrySigil}>
                {anchor.enhancedImageUrl ? (
                  <Image source={{ uri: anchor.enhancedImageUrl }}
                    style={styles.carrySigilImage} resizeMode="cover" />
                ) : (
                  <SigilSvg xml={anchor.baseSigilSvg || PLACEHOLDER_SVG} width={60} height={60} />
                )}
              </View>
              <Text style={styles.carryAffirmation} numberOfLines={3}>
                "{anchor.intention}"
              </Text>
              <Text style={styles.carryMeta}>Thread {anchor.threadStrength} · 0 returns this week</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={onSanctuary}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.carrySecondaryWrap, { marginTop: 16 }]}
        >
          <Text style={styles.carrySecondary}>Return to Sanctuary</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── First Week screen ────────────────────────────────────────────────────────

function FirstWeekLayout({
  data,
  reducedMotion,
  insets,
  onViewFullWeave,
  onAnchorPress,
  onPractice,
  onSanctuary,
}: {
  data: WeeklyReviewData;
  reducedMotion: boolean;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onViewFullWeave: () => void;
  onAnchorPress: (anchorId: string) => void;
  onPractice: (anchorId: string) => void;
  onSanctuary: () => void;
}) {
  const fadeStyle = useFadeIn(50, reducedMotion);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <TopBackBar onBack={onSanctuary} />
      <Animated.View style={[styles.sectionPad, fadeStyle]}>
        <Text style={styles.eyebrow}>WEEK IN REVIEW</Text>
        <Text style={styles.title}>Your Week, Woven</Text>
        <Text style={styles.reflectionLine}>
          This is your first Weekly Review. Thread Strength and the Weave will grow richer each time you return.
        </Text>
      </Animated.View>

      <SectionRule />

      <Animated.View style={[styles.threadBlock, useFadeIn(80, reducedMotion)]}>
        <Text style={styles.threadSectionEyebrow}>THREAD STRENGTH</Text>
        <View style={styles.threadNumeralWrap}>
          <Text style={[styles.threadNumeral, { opacity: 0.7 }]}>{data.threadStrength}</Text>
        </View>
        <Text style={[styles.momentumLabel, { color: C.ash }]}>JUST BEGINNING</Text>
      </Animated.View>

      <SectionRule />
      <WeeklyWeaveChart data={data} reducedMotion={reducedMotion} onViewFullWeave={onViewFullWeave} />
      <SectionRule />
      <AnchorList data={data} onAnchorPress={onAnchorPress} onViewAll={() => {}} />
      <SectionRule />
      <PatternBlock line="Keep returning. Patterns will become visible here as your Practice grows." />
      <SectionRule />
      <CarryItForward
        data={data}
        activeCourse={null}
        onPractice={onPractice}
        onSecondary={onSanctuary}
      />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type WeeklyReviewNavigation = NativeStackNavigationProp<PracticeStackParamList>;

export function WeeklyReviewScreen() {
  const navigation = useNavigation<WeeklyReviewNavigation>();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion() ?? false;

  const { navigateToSanctuary, navigateToChart } = useTabNavigation();
  const { startPractice } = usePracticeEntry();

  // Default: last completed week — except on Sunday, when the in-app review
  // window opens for the week that's wrapping up today (offset 0). Without
  // this, opening the review on a Sunday shows the prior, already-reviewed
  // week instead of the one the user just practiced in.
  const [weekOffset, setWeekOffset] = useState(() => (new Date().getDay() === 0 ? 0 : 1));
  const [showError, setShowError] = useState(false);

  // Course data (optional, may not be available)
  const activeCourse = useCourseStore((s) => s.activeCourse);
  const chartFlags = useAuthStore((s) => s.user?.chartFlags);
  const chartCapabilities = useAuthStore((s) => s.user?.chartCapabilities);

  const data = useWeeklyReview(weekOffset);

  // ── Navigation handlers ────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (data.canGoBack) setWeekOffset((o) => Math.min(o + 1, MAX_WEEK_OFFSET));
  }, [data.canGoBack]);

  const handleForward = useCallback(() => {
    if (data.canGoForward) setWeekOffset((o) => Math.max(o - 1, 0));
  }, [data.canGoForward]);

  const handleViewFullWeave = useCallback(() => {
    navigation.navigate('TheWeave', {
      origin: 'practice',
      initialScope: { kind: 'all' },
    });
  }, [navigation]);

  const handleAnchorPress = useCallback((anchorId: string) => {
    // Navigate to Anchor detail — for now navigate to practice with that anchor
    navigation.navigate('PracticeHome', { anchorId });
  }, [navigation]);

  const handlePractice = useCallback((anchorId: string) => {
    startPractice({
      mode: 'deepPrime',
      anchorId,
      source: 'practice_hero',
    });
  }, [startPractice]);

  const handleSanctuary = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigateToSanctuary();
    }
  }, [navigation, navigateToSanctuary]);

  const handleViewChart = useCallback(() => {
    navigateToChart();
  }, [navigateToChart]);

  // Hoisted above the early returns below: data.state (and therefore which
  // branch renders) can change between renders of this same component
  // instance as the user pages between weeks, so every hook this component
  // calls — including these staggered fade-ins, only used by the 'live'
  // branch — must run unconditionally on every render or React throws a
  // "rendered fewer hooks than expected" error when the branch changes.
  const fadeStyle0 = useFadeIn(STAGGER_DELAYS[0], reducedMotion);
  const fadeStyle1 = useFadeIn(STAGGER_DELAYS[1], reducedMotion);
  const fadeStyle2 = useFadeIn(STAGGER_DELAYS[2], reducedMotion);
  const fadeStyle3 = useFadeIn(STAGGER_DELAYS[3], reducedMotion);
  const fadeStyle4 = useFadeIn(STAGGER_DELAYS[4], reducedMotion);
  const fadeStyle5 = useFadeIn(STAGGER_DELAYS[5], reducedMotion);
  const fadeStyle6 = useFadeIn(STAGGER_DELAYS[6], reducedMotion);
  const fadeStyle7 = useFadeIn(STAGGER_DELAYS[7], reducedMotion);
  const fadeStyle8 = useFadeIn(STAGGER_DELAYS[8], reducedMotion);

  // ── Quiet Week ────────────────────────────────────────────────────────────
  if (data.state === 'none') {
    return (
      <QuietWeekLayout
        data={data}
        activeCourse={activeCourse}
        insets={insets}
        reducedMotion={reducedMotion}
        onPractice={handlePractice}
        onSanctuary={handleSanctuary}
      />
    );
  }

  // ── First Week ────────────────────────────────────────────────────────────
  if (data.state === 'first') {
    return (
      <FirstWeekLayout
        data={data}
        reducedMotion={reducedMotion}
        insets={insets}
        onViewFullWeave={handleViewFullWeave}
        onAnchorPress={handleAnchorPress}
        onPractice={handlePractice}
        onSanctuary={handleSanctuary}
      />
    );
  }

  // ── Live (normal) ─────────────────────────────────────────────────────────
  const showCourse =
    canViewChart(chartFlags, chartCapabilities) && activeCourse?.status === 'ACTIVE';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <TopBackBar onBack={handleSanctuary} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Error banner */}
        {showError && <ErrorBanner onRetry={() => setShowError(false)} />}

        {/* ── Header ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle0]}>
          <Text style={styles.eyebrow}>WEEK IN REVIEW</Text>
          <Text style={styles.title}>Your Week, Woven</Text>
          <WeekNav
            label={data.weekLabel}
            canGoBack={data.canGoBack}
            canGoForward={data.canGoForward}
            onBack={handleBack}
            onForward={handleForward}
          />
          {data.reflectionLine ? (
            <Text style={styles.reflectionLine}>{data.reflectionLine}</Text>
          ) : null}
        </Animated.View>

        <SectionRule />

        {/* ── Thread Strength ── */}
        <Animated.View style={fadeStyle1}>
          <ThreadStrengthBlock data={data} reducedMotion={reducedMotion} />
        </Animated.View>

        <SectionRule />

        {/* ── Weave Chart ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle2]}>
          <WeeklyWeaveChart
            data={data}
            reducedMotion={reducedMotion}
            onViewFullWeave={handleViewFullWeave}
          />
        </Animated.View>

        <SectionRule />

        {/* ── Metrics ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle3]}>
          <MetricsGrid data={data} />
        </Animated.View>

        <SectionRule />

        {/* ── Practice Mix ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle4]}>
          <PracticeMix data={data} />
        </Animated.View>

        <SectionRule />

        {/* ── Anchor List ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle5]}>
          <AnchorList
            data={data}
            onAnchorPress={handleAnchorPress}
            onViewAll={() => navigation.navigate('PracticeHome', {})}
          />
        </Animated.View>

        <SectionRule />

        {/* ── Pattern ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle6]}>
          <PatternBlock line={data.patternLine} />
        </Animated.View>

        {/* ── Course Section (conditional) ── */}
        {showCourse && activeCourse && (
          <>
            <SectionRule />
            <Animated.View style={[styles.sectionPad, fadeStyle7]}>
              <CourseSection
                course={activeCourse}
                reducedMotion={reducedMotion}
                onViewChart={handleViewChart}
              />
            </Animated.View>
          </>
        )}

        <SectionRule />

        {/* ── Carry It Forward ── */}
        <Animated.View style={[styles.sectionPad, fadeStyle8]}>
          <CarryItForward
            data={data}
            activeCourse={activeCourse}
            onPractice={handlePractice}
            onSecondary={showCourse ? handleViewChart : handleSanctuary}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.navy,
  },
  skeletonInner: {
    paddingHorizontal: SECTION_PAD,
  },
  sectionPad: {
    paddingHorizontal: SECTION_PAD,
  },
  topBackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SECTION_PAD,
    paddingVertical: 10,
    minHeight: 44,
    gap: 4,
  },
  topBackText: {
    fontFamily: FONTS.inst,
    fontSize: 13,
    color: C.lightGold,
  },

  // Accessibility: visually hidden but readable by screen readers
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },

  // ── Eyebrow / Title ──
  eyebrow: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.22 * 11,
    color: C.ash,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.voice,
    fontSize: 32,
    lineHeight: 38,
    color: C.bone,
    marginBottom: 12,
  },
  reflectionLine: {
    fontFamily: FONTS.voice,
    fontSize: 16,
    lineHeight: 24,
    color: C.bone,
    opacity: 0.8,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    fontStyle: 'italic',
  },

  // ── Section rule ──
  rule: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: C.rule,
    marginVertical: 16,
  },

  // ── Section eyebrow ──
  sectionEyebrow: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.22 * 11,
    color: C.ash,
    textTransform: 'uppercase',
    marginBottom: 16,
  },

  // ── Week nav ──
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  weekNavBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavLabel: {
    fontFamily: FONTS.inst,
    fontSize: 14,
    color: C.bone,
    minWidth: 120,
    textAlign: 'center',
  },

  // ── Thread Strength ──
  threadBlock: {
    paddingHorizontal: SECTION_PAD,
    paddingVertical: 28,
    alignItems: 'center',
  },
  threadSectionEyebrow: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.22 * 11,
    color: C.ash,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  threadNumeralWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  threadNumeral: {
    fontFamily: FONTS.inst,
    fontSize: 64,
    fontWeight: '200',
    color: C.bone,
    letterSpacing: -0.045 * 64,
    lineHeight: 72,
  },
  momentumLabel: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.08 * 11,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  threadMeta: {
    fontFamily: FONTS.inst,
    fontSize: 13,
    color: C.ash,
  },

  // ── Weave chart ──
  weaveSection: {
    paddingVertical: 16,
  },
  weaveDayLabels: {
    flexDirection: 'row',
    marginTop: 6,
    width: WEAVE_W,
    paddingHorizontal: WEAVE_PLOT_PADDING,
  },
  weaveDayLabel: {
    fontFamily: FONTS.inst,
    fontSize: 10,
    color: C.ash,
    opacity: 0.6,
    flex: 1,
    textAlign: 'center',
  },
  nodeTarget: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  weaveLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: FONTS.inst,
    fontSize: 10,
    color: C.ash,
  },
  viewLink: {
    fontFamily: FONTS.inst,
    fontSize: 13,
    color: C.lightGold,
    marginTop: 12,
    minHeight: 44,
    lineHeight: 44,
  },

  // ── Metrics grid ──
  metricsSection: {
    paddingVertical: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    width: '50%',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  metricCellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: C.hairline,
  },
  metricCellBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  metricValue: {
    fontFamily: FONTS.inst,
    fontSize: 24,
    fontWeight: '200',
    color: C.bone,
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.2 * 11,
    color: C.gold,
    textTransform: 'uppercase',
  },

  // ── Practice mix ──
  mixSection: {
    paddingVertical: 8,
    gap: 10,
  },
  mixEmpty: {
    fontFamily: FONTS.voice,
    fontSize: 14,
    color: C.ash,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mixDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mixModeName: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.bone,
    width: 76,
  },
  mixTrack: {
    flex: 1,
    height: 1,
    backgroundColor: C.slack,
  },
  mixFill: {
    height: 1,
  },
  mixPct: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.ash,
    width: 32,
    textAlign: 'right',
  },

  // ── Anchor list ──
  anchorSection: {
    paddingVertical: 16,
  },
  anchorEmpty: {
    fontFamily: FONTS.voiceReg,
    fontSize: 14,
    color: C.ash,
    fontStyle: 'italic',
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  anchorSigil: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.harbor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorSigilImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  anchorInfo: {
    flex: 1,
  },
  anchorAffirmation: {
    fontFamily: FONTS.voice,
    fontSize: 15,
    color: C.bone,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  anchorMeta: {
    fontFamily: FONTS.inst,
    fontSize: 11,
    color: C.ash,
  },

  // ── Pattern ──
  patternSection: {
    paddingVertical: 16,
  },
  patternLine: {
    fontFamily: FONTS.voice,
    fontSize: 16,
    lineHeight: 24,
    color: C.bone,
    fontStyle: 'italic',
    opacity: 0.85,
  },

  // ── Course section ──
  courseSection: {
    paddingVertical: 16,
  },
  courseDestination: {
    fontFamily: FONTS.voice,
    fontSize: 16,
    color: C.bone,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  courseWaypoint: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.ash,
    marginBottom: 16,
  },
  miniRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 12,
  },

  // ── Carry It Forward ──
  carrySection: {
    paddingVertical: 16,
  },
  carrySupportLine: {
    fontFamily: FONTS.voice,
    fontSize: 14,
    color: C.ash,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  carryCard: {
    backgroundColor: C.harbor,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.hairline,
    marginBottom: 16,
  },
  carrySigil: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: C.steel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  carrySigilImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  carryAffirmation: {
    fontFamily: FONTS.voice,
    fontSize: 15,
    color: C.bone,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  carryMeta: {
    fontFamily: FONTS.inst,
    fontSize: 11,
    color: C.ash,
  },
  carryCtaPill: {
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(217,179,108,0.12)',
    borderWidth: 1,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  carryCtaLabel: {
    fontFamily: FONTS.ritualBold,
    fontSize: 13,
    letterSpacing: 0.09 * 13,
    color: C.gold,
    textTransform: 'uppercase',
  },
  carrySecondaryWrap: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carrySecondary: {
    fontFamily: FONTS.inst,
    fontSize: 13,
    color: C.lightGold,
  },

  // ── Quiet week ──
  quietHeadline: {
    fontFamily: FONTS.voice,
    fontSize: 28,
    color: C.bone,
    marginBottom: 8,
  },
  quietBody: {
    fontFamily: FONTS.voice,
    fontSize: 16,
    lineHeight: 24,
    color: C.ash,
    fontStyle: 'italic',
    marginBottom: 24,
  },

  // ── Error banner ──
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.harbor,
    paddingHorizontal: SECTION_PAD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
    gap: 12,
  },
  errorBannerText: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.ash,
    flex: 1,
  },
  errorBannerRetry: {
    fontFamily: FONTS.ritual,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: C.gold,
    textTransform: 'uppercase',
  },

  // ── Day detail sheet ──
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,20,0.7)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  sheet: {
    backgroundColor: C.steel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
    paddingHorizontal: SECTION_PAD,
    paddingTop: 16,
    minHeight: 200,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.ash,
    opacity: 0.3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetDay: {
    fontFamily: FONTS.voice,
    fontSize: 18,
    color: C.bone,
    marginBottom: 4,
  },
  sheetMeta: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.ash,
    marginBottom: 16,
  },
  sheetModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  sheetModeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sheetModeLabel: {
    fontFamily: FONTS.inst,
    fontSize: 14,
    color: C.bone,
    flex: 1,
  },
  sheetModeCount: {
    fontFamily: FONTS.inst,
    fontSize: 12,
    color: C.ash,
  },
  sheetEmpty: {
    fontFamily: FONTS.voiceReg,
    fontSize: 14,
    color: C.ash,
    fontStyle: 'italic',
  },
});
