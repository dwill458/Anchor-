import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown } from 'lucide-react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import type { PracticeSessionRecord } from '@/types/practice';
import { calculateStreak } from '@/utils/streakHelpers';
import { colors, spacing, typography } from '@/theme';

export interface ThreadStrengthSheetProps {
  visible: boolean;
  onClose: () => void;
  anchorId: string;
  onOpenSensitivity?: () => void;
}

type SessionDisplayType = 'focus' | 'deep' | 'visualize';
type WeekDayType = SessionDisplayType | 'empty';

interface WeekDay {
  day: string;
  type: WeekDayType;
  isToday: boolean;
}

interface DerivedThreadStrengthData {
  strengthPct: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  deepPrimePct: number;
  focusCount: number;
  deepCount: number;
  visualizeCount: number;
  thisWeekDays: WeekDay[];
  sensitivityMode: string;
}

interface PrimingLikeEntry {
  id: string;
  anchorId: string;
  type: 'activate' | 'reinforce' | 'visualize';
  completedAt: string;
}

interface ClassifiedEntry extends PrimingLikeEntry {
  dateKey: string;
  timestamp: number;
  displayType: SessionDisplayType;
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DUPLICATE_WINDOW_MS = 5 * 1000;
const GAUGE_RADIUS = 45;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const C = {
  sheet: '#131820',
  overlay: 'rgba(8,11,16,0.72)',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(212,175,55,0.12)',
  gold: colors.gold,
  goldDim: '#8a7120',
  goldSoft: 'rgba(212,175,55,0.35)',
  silver: colors.silver,
  bone: colors.bone,
  silverDim: 'rgba(245,245,220,0.68)',
  silverMuted: 'rgba(245,245,220,0.55)',
  silverSoft: 'rgba(245,245,220,0.28)',
  hairline: 'rgba(245,245,220,0.10)',
};

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeStrength(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildFallbackPrimingHistory(sessionLog: SessionLogEntry[]): PrimingLikeEntry[] {
  return sessionLog
    .filter(
      (entry): entry is SessionLogEntry & { type: 'activate' | 'reinforce' | 'visualize' } =>
        entry.type === 'activate' || entry.type === 'reinforce' || entry.type === 'visualize'
    )
    .map((entry) => ({
      id: entry.id,
      anchorId: entry.anchorId,
      type: entry.type,
      completedAt: entry.completedAt,
    }));
}

function classifyAnchorEntries(entries: PrimingLikeEntry[], anchorId: string): ClassifiedEntry[] {
  const seenIds = new Set<string>();
  const lastSignatureTime = new Map<string, number>();
  const sorted = entries
    .filter((entry) => entry.anchorId === anchorId)
    .map((entry) => {
      const parsed = new Date(entry.completedAt);
      if (Number.isNaN(parsed.getTime())) {
        return null;
      }

      return {
        ...entry,
        dateKey: localDateString(parsed),
        timestamp: parsed.getTime(),
      };
    })
    .filter((entry): entry is PrimingLikeEntry & { dateKey: string; timestamp: number } => entry !== null)
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      if (left.type !== right.type) {
        return left.type === 'activate' ? -1 : 1;
      }

      return left.id.localeCompare(right.id);
    });

  let hasPriorPrime = false;
  const classified: ClassifiedEntry[] = [];

  for (const entry of sorted) {
    if (seenIds.has(entry.id)) {
      continue;
    }
    seenIds.add(entry.id);

    const previousSignatureTime = lastSignatureTime.get(entry.type);
    if (
      previousSignatureTime != null &&
      Math.abs(entry.timestamp - previousSignatureTime) <= DUPLICATE_WINDOW_MS
    ) {
      continue;
    }
    lastSignatureTime.set(entry.type, entry.timestamp);

    const displayType: SessionDisplayType = entry.type === 'visualize'
      ? 'visualize'
      : entry.type === 'reinforce' && hasPriorPrime ? 'deep' : 'focus';

    classified.push({
      ...entry,
      displayType,
    });
    hasPriorPrime = true;
  }

  return classified;
}

type DayCounts = { focusCount: number; deepCount: number; visualizeCount: number };

function buildThisWeekDays(countsByDate: Map<string, DayCounts>): WeekDay[] {
  const today = new Date();
  const monday = addDays(today, -((today.getDay() + 6) % 7));

  return WEEKDAY_LABELS.map((day, index) => {
    const date = addDays(monday, index);
    const dateKey = localDateString(date);
    const counts = countsByDate.get(dateKey) ?? { focusCount: 0, deepCount: 0, visualizeCount: 0 };
    let type: WeekDayType = 'empty';

    if (counts.visualizeCount > 0) {
      type = 'visualize';
    } else if (counts.deepCount > 0) {
      type = 'deep';
    } else if (counts.focusCount > 0) {
      type = 'focus';
    }

    return {
      day,
      type,
      isToday: dateKey === localDateString(today),
    };
  });
}

import {
  calculateAnchorThreadStrength,
  type AnchorThreadStrengthResult,
} from '@/utils/practiceMetrics';
import { getThreadStrengthTagline } from '@/utils/threadStrength';

export function getTagline(pct: number, totalSessions: number): string {
  return getThreadStrengthTagline({ score: pct, totalSessions }).tagline;
}

export function resolveAnchorStrengthPct(params: {
  storedStrength?: number | null;
  totalSessions: number;
  currentStreak: number;
  thisWeekDays: WeekDay[];
  anchorId?: string;
  practiceHistory?: PracticeSessionRecord[];
}): number {
  if (params.anchorId) {
    const sessionState = typeof useSessionStore.getState === 'function' ? useSessionStore.getState() : {} as any;
    const settingsState = typeof useSettingsStore.getState === 'function' ? useSettingsStore.getState() : {} as any;
    const events = params.practiceHistory ?? sessionState.practiceHistory ?? [];
    const baseline = sessionState.getAnchorV2Baseline?.(params.anchorId) ?? null;
    if (events.length > 0 || baseline) {
      return calculateAnchorThreadStrength({
        events,
        anchorId: params.anchorId,
        sensitivity: settingsState.threadStrengthSensitivity,
        sensitivityHistory: settingsState.sensitivityHistory,
        restDays: settingsState.restDays,
        restDaysHistory: settingsState.restDaysHistory,
        baseline,
      }).score;
    }
  }

  const storedStrength = normalizeStrength(params.storedStrength);
  if (storedStrength != null) {
    return storedStrength;
  }

  const primedDaysThisWeek = params.thisWeekDays.filter((day) => day.type !== 'empty').length;

  return Math.max(
    0,
    Math.min(
      100,
      Math.max(
        Math.round((primedDaysThisWeek / 7) * 100),
        params.totalSessions > 0 ? Math.round((params.currentStreak / 7) * 100) : 0
      )
    )
  );
}

function deriveThreadStrengthData(params: {
  anchorId: string;
  anchorThreadStrength?: number | null;
  primingHistory: PrimingHistoryEntry[];
  sessionLog: SessionLogEntry[];
  practiceHistory?: PracticeSessionRecord[];
  sensitivityMode: string;
}): DerivedThreadStrengthData {
  const sourceEntries =
    params.primingHistory.length > 0 ? params.primingHistory : buildFallbackPrimingHistory(params.sessionLog);
  const classifiedEntries = classifyAnchorEntries(sourceEntries, params.anchorId);
  const countsByDate = new Map<string, DayCounts>();

  for (const entry of classifiedEntries) {
    const current = countsByDate.get(entry.dateKey) ?? { focusCount: 0, deepCount: 0, visualizeCount: 0 };
    if (entry.displayType === 'focus') {
      current.focusCount += 1;
    } else if (entry.displayType === 'deep') {
      current.deepCount += 1;
    } else {
      current.visualizeCount += 1;
    }
    countsByDate.set(entry.dateKey, current);
  }

  let focusCount = 0;
  let deepCount = 0;
  let visualizeCount = 0;
  countsByDate.forEach((counts) => {
    focusCount += counts.focusCount;
    deepCount += counts.deepCount;
    visualizeCount += counts.visualizeCount;
  });

  const totalSessions = focusCount + deepCount + visualizeCount;
  const streak = calculateStreak(
    classifiedEntries.map((entry) => ({ createdAt: entry.completedAt }))
  );
  const thisWeekDays = buildThisWeekDays(countsByDate);
  const strengthPct = resolveAnchorStrengthPct({
    storedStrength: params.anchorThreadStrength,
    totalSessions,
    currentStreak: streak.currentStreak,
    thisWeekDays,
    anchorId: params.anchorId,
    practiceHistory: params.practiceHistory,
  });

  return {
    strengthPct,
    totalSessions,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    deepPrimePct: totalSessions > 0 ? Math.round((deepCount / totalSessions) * 100) : 0,
    focusCount,
    deepCount,
    visualizeCount,
    thisWeekDays,
    sensitivityMode: capitalize(params.sensitivityMode),
  };
}

const StrengthGauge: React.FC<{ value: number; reduceMotion: boolean }> = ({ value, reduceMotion }) => {
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion]);

  const animatedCircleProps = useAnimatedProps(() => {
    const strokeDashoffset = GAUGE_CIRCUMFERENCE * (1 - (clampedValue / 100) * progress.value);
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={104} height={104} viewBox="0 0 104 104">
        <Circle
          cx={52}
          cy={52}
          r={GAUGE_RADIUS}
          stroke="rgba(245,245,220,0.08)"
          strokeWidth={8}
          fill="none"
        />
        <AnimatedCircle
          cx={52}
          cy={52}
          r={GAUGE_RADIUS}
          stroke={C.gold}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`}
          animatedProps={animatedCircleProps}
          transform="rotate(-90 52 52)"
        />
      </Svg>
      <View style={styles.gaugeInner}>
        <View style={styles.gaugeScoreRow}>
          <Text style={styles.gaugeScoreNumber}>{clampedValue}</Text>
          <Text style={styles.gaugeScoreOutOf}>/100</Text>
        </View>
        <Text style={styles.gaugeScoreCaption}>STRENGTH</Text>
      </View>
    </View>
  );
};

interface StatRowProps {
  label: string;
  value: string | number;
  fillPct: number;
  fillColor: string;
  delayMs: number;
  reduceMotion: boolean;
}

const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  fillPct,
  fillColor,
  delayMs,
  reduceMotion,
}) => {
  const clampedPct = Math.max(0, Math.min(100, fillPct));
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withTiming(1, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [delayMs, reduceMotion]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * clampedPct}%`,
  }));

  return (
    <View style={styles.statRow}>
      <View style={styles.statRowTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <View style={styles.statBarTrack}>
        <Animated.View
          style={[
            styles.statBarFill,
            { backgroundColor: fillColor },
            animatedBarStyle,
          ]}
        />
      </View>
    </View>
  );
};

const SENSITIVITY_COPY: Record<string, { title: string; note: string }> = {
  balanced: {
    title: 'SENSITIVITY: BALANCED',
    note: 'One grace day before gradual decay.',
  },
  lenient: {
    title: 'SENSITIVITY: LENIENT',
    note: 'Two grace days before gradual decay.',
  },
  strict: {
    title: 'SENSITIVITY: STRICT',
    note: 'Decay begins after the first missed practice day.',
  },
};

interface HowItWorksAccordionProps {
  anchorId: string;
  reduceMotion: boolean;
}

const PRINCIPLES = [
  {
    title: 'RETURN OVER TIME',
    body: 'Your first practice with this Anchor each day has the strongest effect. Returning across different days builds Thread Strength most effectively.',
  },
  {
    title: 'REPEAT PRACTICE',
    body: 'Practicing the same Anchor again can still reinforce it, but additional practices in the same day contribute less Thread Strength.',
  },
  {
    title: 'PRACTICE DEPTH',
    body: 'Different practices reinforce your Anchor differently. Deeper practices can have a stronger effect than shorter Focus sessions.',
  },
  {
    title: 'TIME AWAY',
    body: 'Thread Strength gradually eases when you stop returning. Rest days are protected, and your Sensitivity setting controls how soon strength begins to loosen.',
  },
] as const;

const HowItWorksAccordion: React.FC<HowItWorksAccordionProps> = ({ anchorId, reduceMotion }) => {
  const [expanded, setExpanded] = useState(false);
  const animationProgress = useSharedValue(0);

  const toggleExpand = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      AnalyticsService.track('thread_strength_education_opened', {
        anchor_id: anchorId,
      });
    } else {
      AnalyticsService.track('thread_strength_education_closed', {
        anchor_id: anchorId,
      });
    }
  }, [anchorId, expanded]);

  useEffect(() => {
    if (reduceMotion) {
      animationProgress.value = expanded ? 1 : 0;
      return;
    }
    animationProgress.value = withTiming(expanded ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [expanded, reduceMotion, animationProgress]);

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${animationProgress.value * 180}deg` }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : animationProgress.value,
  }));

  return (
    <View style={styles.accordionContainer}>
      <Pressable
        style={styles.accordionHeader}
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityLabel="How Thread Strength works, Built through return, depth, and consistency."
        accessibilityState={{ expanded }}
        testID="thread-strength-education-toggle"
      >
        <View style={styles.accordionHeaderTextWrap}>
          <Text style={styles.accordionTitle}>HOW THREAD STRENGTH WORKS</Text>
          <Text style={styles.accordionSubtitle}>
            Built through return, depth, and consistency.
          </Text>
        </View>
        <Animated.View style={[styles.accordionChevronWrap, chevronAnimatedStyle]}>
          <ChevronDown size={16} color={C.gold} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View style={[styles.principlesList, contentAnimatedStyle]}>
          {PRINCIPLES.map((principle, index) => (
            <View key={principle.title} style={styles.principleRow}>
              <View style={styles.principleMarkerCol}>
                <View style={styles.principleDot} />
                {index < PRINCIPLES.length - 1 && <View style={styles.principleLine} />}
              </View>
              <View style={styles.principleTextCol}>
                <Text style={styles.principleTitle}>{principle.title}</Text>
                <Text style={styles.principleBody}>{principle.body}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

export const ThreadStrengthSheet: React.FC<ThreadStrengthSheetProps> = ({
  visible,
  onClose,
  anchorId,
  onOpenSensitivity,
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const primingHistory = useSessionStore((state) => state.primingHistory ?? []);
  const sessionLog = useSessionStore((state) => state.sessionLog);
  const practiceHistory = useSessionStore((state) => state.practiceHistory ?? []);
  const sensitivityMode = useSettingsStore(
    (state) => state.threadStrengthSensitivity ?? 'balanced'
  );

  const anchor = useMemo(() => (anchorId ? getAnchorById(anchorId) : undefined), [anchorId, getAnchorById]);

  const data = useMemo(
    () =>
      deriveThreadStrengthData({
        anchorId,
        anchorThreadStrength: anchor?.threadStrength ?? null,
        primingHistory,
        sessionLog,
        practiceHistory,
        sensitivityMode,
      }),
    [anchor?.threadStrength, anchorId, practiceHistory, primingHistory, sensitivityMode, sessionLog]
  );

  const tagline = useMemo(
    () => getTagline(data.strengthPct, data.totalSessions),
    [data.strengthPct, data.totalSessions]
  );
  const intention = anchor?.intentionText ?? 'This anchor';
  const sigilUri =
    ((anchor as { sigilUri?: string | null } | undefined)?.sigilUri ?? anchor?.enhancedImageUrl) || null;
  const sigilSvg = anchor?.baseSigilSvg ?? '';

  const currentSensitivityKey = (sensitivityMode ?? 'balanced').toLowerCase();
  const currentSensitivity = SENSITIVITY_COPY[currentSensitivityKey] ?? SENSITIVITY_COPY.balanced;

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            decelerationRate="normal"
            scrollEventThrottle={16}
            bounces={true}
            overScrollMode="always"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 28, 44) },
            ]}
          >
            {/* 1. Header with seal & quote (duplicate % pill removed) */}
            <View style={styles.header}>
              <View style={styles.thumb} testID="thread-strength-sheet-sigil">
                {sigilUri ? (
                  <Image
                    source={{ uri: sigilUri }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                ) : sigilSvg ? (
                  <SvgXml
                    xml={sigilSvg}
                    width="72%"
                    height="72%"
                  />
                ) : (
                  <View style={styles.thumbFallback} />
                )}
              </View>

              <View style={styles.headerMeta}>
                <Text style={styles.headerSup}>This Anchor · Thread Strength</Text>
                <Text numberOfLines={2} style={styles.headerTitle}>
                  {intention}
                </Text>
              </View>
            </View>

            <View style={styles.hr} />

            {/* 2. Score row: Ring + Promoted State Headline */}
            <View style={styles.scoreRow}>
              <StrengthGauge value={data.strengthPct} reduceMotion={reduceMotion} />
              <View style={styles.scoreCopy}>
                <Text style={styles.stateHeadline}>{tagline}</Text>
                <Text style={styles.stateExplainer}>
                  Grows when you come back to this anchor consistently.
                </Text>
              </View>
            </View>

            <View style={styles.hr} />

            {/* 3. Stat rows (replaces 2x2 tile grid) */}
            {/* DEFERRED: 2x2 stat tile grid replaced with ordered weighted rows (v2 redesign).
                To restore the 2x2 grid, render:
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}><Text style={styles.statValue}>{data.totalSessions}</Text><Text style={styles.statLabel}>Total Sessions</Text></View>
                  <View style={styles.statCard}><Text style={styles.statValue}>{data.currentStreak}</Text><Text style={styles.statLabel}>Current Constancy</Text></View>
                  <View style={styles.statCard}><Text style={styles.statValue}>{data.longestStreak}</Text><Text style={styles.statLabel}>Longest Constancy</Text></View>
                  <View style={styles.statCard}><Text style={[styles.statValue, { color: C.silver }]}>{data.deepPrimePct}%</Text><Text style={styles.statLabel}>Deep Primes</Text></View>
                </View>
            */}
            <View style={styles.statRows}>
              <StatRow
                label="Total Sessions"
                value={data.totalSessions}
                fillPct={Math.min(100, Math.round((data.totalSessions / 35) * 100))}
                fillColor={C.gold}
                delayMs={150}
                reduceMotion={reduceMotion}
              />
              <StatRow
                label="Longest Constancy"
                value={data.longestStreak}
                fillPct={Math.min(100, Math.round((data.longestStreak / 10) * 100))}
                fillColor={C.gold}
                delayMs={240}
                reduceMotion={reduceMotion}
              />
              <StatRow
                label="Current Constancy"
                value={data.currentStreak}
                fillPct={Math.min(100, Math.round((data.currentStreak / 10) * 100))}
                fillColor={data.currentStreak > 0 ? C.gold : 'rgba(245,245,220,0.18)'}
                delayMs={330}
                reduceMotion={reduceMotion}
              />
              <StatRow
                label="Deep Primes"
                value={`${data.deepPrimePct}%`}
                fillPct={data.deepPrimePct}
                fillColor={C.silver}
                delayMs={420}
                reduceMotion={reduceMotion}
              />
            </View>

            {/* 4. Session Breakdown (Deep Primes colored Silver, zero Deep Purple token usage) */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Session Breakdown</Text>
                <Text style={styles.sectionValueSilver}>{data.deepPrimePct}% Deep Primes</Text>
              </View>
              <View style={styles.breakdownTrack}>
                <LinearGradient
                  colors={[C.goldDim, C.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.breakdownFocus,
                    { width: `${data.totalSessions > 0 ? (data.focusCount / data.totalSessions) * 100 : 0}%` },
                  ]}
                />
                <View
                  style={[
                    styles.breakdownDeep,
                    { width: `${data.deepPrimePct}%` },
                  ]}
                />
                <View
                  style={[
                    styles.breakdownVisualize,
                    { width: `${data.totalSessions > 0 ? (data.visualizeCount / data.totalSessions) * 100 : 0}%` },
                  ]}
                />
              </View>
              <View style={styles.breakdownLegend}>
                <Text style={styles.breakdownText}>{data.focusCount} Focus</Text>
                <Text style={styles.breakdownText}>{data.deepCount} Deep Primes</Text>
                <Text style={styles.breakdownText}>{data.visualizeCount} Visualize</Text>
              </View>
            </View>

            {/* 5. Week Row */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>This Week</Text>
              <View style={styles.weekRow}>
                {data.thisWeekDays.map((day) => (
                  <View key={day.day} style={styles.weekDay}>
                    <Text style={styles.weekLabel}>{day.day}</Text>
                    <View
                      style={[
                        styles.weekDot,
                        day.type === 'focus' && styles.weekDotFocus,
                        day.type === 'deep' && styles.weekDotDeep,
                        day.type === 'visualize' && styles.weekDotVisualize,
                        day.isToday && styles.weekDotToday,
                      ]}
                    >
                      {day.type === 'deep' ? <View style={styles.deepPip} /> : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 6. How Thread Strength Works */}
            <HowItWorksAccordion anchorId={anchorId} reduceMotion={reduceMotion} />

            {/* 7. Sensitivity row */}
            <Pressable
              style={styles.sensitivity}
              onPress={() => onOpenSensitivity?.()}
              accessibilityRole="button"
              accessibilityLabel={`${currentSensitivity.title}. ${currentSensitivity.note}`}
              testID="thread-strength-sensitivity-row"
            >
              <View style={styles.sensitivityDot} />
              <View style={styles.sensitivityContent}>
                <Text style={styles.sensitivityTitle}>{currentSensitivity.title}</Text>
                <Text style={styles.sensitivityNote}>{currentSensitivity.note}</Text>
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },
  sheet: {
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.18)',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: C.goldSoft,
    alignSelf: 'center',
    marginTop: 12,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,13,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.26)',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    width: '68%',
    height: '68%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headerSup: {
    fontFamily: typography.fonts.heading,
    fontSize: 10.5,
    color: C.gold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  headerTitle: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 16,
    color: C.bone,
    lineHeight: 21,
  },
  hr: {
    height: 1,
    backgroundColor: C.hairline,
    marginVertical: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  gaugeWrap: {
    width: 104,
    height: 104,
    position: 'relative',
    flexShrink: 0,
  },
  gaugeInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  gaugeScoreNumber: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 28,
    color: C.bone,
    lineHeight: 30,
  },
  gaugeScoreOutOf: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: C.bone,
    opacity: 0.55,
    marginLeft: 2,
    marginBottom: 2,
  },
  gaugeScoreCaption: {
    marginTop: 4,
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: C.silverMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  scoreCopy: {
    flex: 1,
    gap: 6,
  },
  stateHeadline: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 18,
    color: C.gold,
    lineHeight: 22,
  },
  stateExplainer: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 14,
    lineHeight: 19,
    color: C.silverMuted,
  },
  statRows: {
    gap: 12,
  },
  statRow: {
    gap: 5,
  },
  statRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  statLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: C.silverMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 15,
    color: C.bone,
  },
  statBarTrack: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(245,245,220,0.07)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.fonts.heading,
    fontSize: 10.5,
    color: C.silverMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionValueSilver: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: C.silver,
  },
  breakdownTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,245,220,0.07)',
    flexDirection: 'row',
  },
  breakdownFocus: {
    height: '100%',
  },
  breakdownDeep: {
    height: '100%',
    backgroundColor: C.silver,
  },
  breakdownVisualize: {
    height: '100%',
    backgroundColor: '#183B65',
  },
  breakdownLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  breakdownText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: C.silverMuted,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDay: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weekLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: C.silverMuted,
    letterSpacing: 0.5,
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(245,245,220,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weekDotFocus: {
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderColor: C.gold,
  },
  weekDotDeep: {
    backgroundColor: 'rgba(192,192,192,0.18)',
    borderColor: C.silver,
  },
  weekDotVisualize: {
    backgroundColor: 'rgba(24,59,101,0.8)',
    borderColor: '#6E9BC8',
  },
  weekDotToday: {
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  deepPip: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.silver,
  },
  accordionContainer: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  accordionHeaderTextWrap: {
    flex: 1,
    gap: 3,
    paddingRight: spacing.sm,
  },
  accordionTitle: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: C.gold,
    textTransform: 'uppercase',
  },
  accordionSubtitle: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12.5,
    lineHeight: 17,
    color: C.silverMuted,
  },
  accordionChevronWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principlesList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.08)',
  },
  principleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  principleMarkerCol: {
    alignItems: 'center',
    width: 8,
    paddingTop: 4,
  },
  principleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  principleLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(212,175,55,0.18)',
    marginTop: 4,
    marginBottom: -8,
  },
  principleTextCol: {
    flex: 1,
    gap: 3,
  },
  principleTitle: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  principleBody: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12.5,
    lineHeight: 17.5,
    color: C.silverMuted,
  },
  sensitivity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: 'rgba(212,175,55,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  sensitivityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  sensitivityContent: {
    flex: 1,
    gap: 2,
  },
  sensitivityTitle: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  sensitivityNote: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    lineHeight: 17,
    color: C.silverMuted,
  },
});
