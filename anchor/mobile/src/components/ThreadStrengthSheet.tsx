import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSessionStore, type SessionLogEntry } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { PrimingHistoryEntry } from '@/utils/primingAnalytics';
import { calculateStreak } from '@/utils/streakHelpers';
import { colors, spacing, typography } from '@/theme';

export interface ThreadStrengthSheetProps {
  visible: boolean;
  onClose: () => void;
  anchorId: string;
}

type SessionDisplayType = 'focus' | 'deep';
type WeekDayType = 'focus' | 'deep' | 'empty';

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
  thisWeekDays: WeekDay[];
  sensitivityMode: string;
}

interface PrimingLikeEntry {
  id: string;
  anchorId: string;
  type: 'activate' | 'reinforce';
  completedAt: string;
}

interface ClassifiedEntry extends PrimingLikeEntry {
  dateKey: string;
  timestamp: number;
  displayType: SessionDisplayType;
}

const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const DUPLICATE_WINDOW_MS = 5 * 1000;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 30;

const C = {
  sheet: '#131820',
  overlay: 'rgba(8,11,16,0.72)',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(212,175,55,0.12)',
  gold: '#D4AF37',
  goldDim: '#8a7120',
  purple: '#9B7FD4',
  purpleDark: '#3E2C5B',
  bone: '#F5F5DC',
  silver: 'rgba(245,245,220,0.68)',
  silverDim: 'rgba(245,245,220,0.4)',
  silverSoft: 'rgba(245,245,220,0.28)',
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
      (entry): entry is SessionLogEntry & { type: 'activate' | 'reinforce' } =>
        entry.type === 'activate' || entry.type === 'reinforce'
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

    const displayType: SessionDisplayType =
      entry.type === 'reinforce' && hasPriorPrime ? 'deep' : 'focus';

    classified.push({
      ...entry,
      displayType,
    });
    hasPriorPrime = true;
  }

  return classified;
}

function buildThisWeekDays(countsByDate: Map<string, { focusCount: number; deepCount: number }>): WeekDay[] {
  const today = new Date();
  const monday = addDays(today, -((today.getDay() + 6) % 7));

  return WEEKDAY_LABELS.map((day, index) => {
    const date = addDays(monday, index);
    const dateKey = localDateString(date);
    const counts = countsByDate.get(dateKey) ?? { focusCount: 0, deepCount: 0 };
    let type: WeekDayType = 'empty';

    if (counts.deepCount > 0) {
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

export function getTagline(pct: number, totalSessions: number): string {
  if (totalSessions === 0) return 'No sessions yet. Forge the first prime.';
  if (pct === 0) return 'Anchor is dormant.';
  if (pct < 20) return 'Thread is fraying. Prime today.';
  if (pct < 40) return 'Slipping. Prime today.';
  if (pct < 70) return 'Thread is holding.';
  if (pct < 90) return 'Thread is holding strong.';
  return 'Thread is fully tensioned.';
}

export function resolveAnchorStrengthPct(params: {
  storedStrength?: number | null;
  totalSessions: number;
  currentStreak: number;
  thisWeekDays: WeekDay[];
}): number {
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
  sensitivityMode: string;
}): DerivedThreadStrengthData {
  const sourceEntries =
    params.primingHistory.length > 0 ? params.primingHistory : buildFallbackPrimingHistory(params.sessionLog);
  const classifiedEntries = classifyAnchorEntries(sourceEntries, params.anchorId);
  const countsByDate = new Map<string, { focusCount: number; deepCount: number }>();

  for (const entry of classifiedEntries) {
    const current = countsByDate.get(entry.dateKey) ?? { focusCount: 0, deepCount: 0 };
    if (entry.displayType === 'focus') {
      current.focusCount += 1;
    } else {
      current.deepCount += 1;
    }
    countsByDate.set(entry.dateKey, current);
  }

  let focusCount = 0;
  let deepCount = 0;
  countsByDate.forEach((counts) => {
    focusCount += counts.focusCount;
    deepCount += counts.deepCount;
  });

  const totalSessions = focusCount + deepCount;
  const streak = calculateStreak(
    classifiedEntries.map((entry) => ({ createdAt: entry.completedAt }))
  );
  const thisWeekDays = buildThisWeekDays(countsByDate);
  const strengthPct = resolveAnchorStrengthPct({
    storedStrength: params.anchorThreadStrength,
    totalSessions,
    currentStreak: streak.currentStreak,
    thisWeekDays,
  });

  return {
    strengthPct,
    totalSessions,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    deepPrimePct: totalSessions > 0 ? Math.round((deepCount / totalSessions) * 100) : 0,
    focusCount,
    deepCount,
    thisWeekDays,
    sensitivityMode: capitalize(params.sensitivityMode),
  };
}

const StrengthGauge: React.FC<{ value: number }> = ({ value }) => {
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
  const strokeDashoffset = GAUGE_CIRCUMFERENCE * (1 - clampedValue / 100);

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={76} height={76} viewBox="0 0 76 76">
        <Circle
          cx={38}
          cy={38}
          r={30}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={5.5}
          fill="none"
        />
        <Circle
          cx={38}
          cy={38}
          r={30}
          stroke={C.gold}
          strokeWidth={5.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 38 38)"
        />
      </Svg>
      <View style={styles.gaugeInner}>
        <Text style={styles.gaugePct}>{clampedValue}</Text>
        <Text style={styles.gaugeLabel}>STRENGTH</Text>
      </View>
    </View>
  );
};

export const ThreadStrengthSheet: React.FC<ThreadStrengthSheetProps> = ({
  visible,
  onClose,
  anchorId,
}) => {
  const insets = useSafeAreaInsets();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const primingHistory = useSessionStore((state) => state.primingHistory ?? []);
  const sessionLog = useSessionStore((state) => state.sessionLog);
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
        sensitivityMode,
      }),
    [anchor?.threadStrength, anchorId, primingHistory, sensitivityMode, sessionLog]
  );

  const tagline = useMemo(
    () => getTagline(data.strengthPct, data.totalSessions),
    [data.strengthPct, data.totalSessions]
  );
  const intention = anchor?.intentionText ?? 'This anchor';

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
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <View style={styles.thumb}>
                <Zap size={18} color={colors.gold} />
              </View>

              <View style={styles.headerMeta}>
                <Text style={styles.headerSup}>This Anchor · Thread Strength</Text>
                <Text numberOfLines={1} style={styles.headerTitle}>
                  {intention}
                </Text>
              </View>

              <Text style={styles.headerPct}>{data.strengthPct}%</Text>
            </View>

            <View style={styles.gaugeRow}>
              <StrengthGauge value={data.strengthPct} />
              <View style={styles.gaugeText}>
                <Text style={styles.gaugeTitle}>This Anchor Only</Text>
                <Text style={styles.gaugeBody}>
                  {data.totalSessions} {data.totalSessions === 1 ? 'session' : 'sessions'} total.
                  {'\n'}
                  {tagline}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.totalSessions}</Text>
                <Text style={styles.statLabel}>Total Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.currentStreak}</Text>
                <Text style={styles.statLabel}>Current Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.longestStreak}</Text>
                <Text style={styles.statLabel}>Longest Streak</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, styles.statValuePurple]}>{data.deepPrimePct}%</Text>
                <Text style={styles.statLabel}>Deep Primes</Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Session Breakdown</Text>
                <Text style={styles.sectionValue}>{data.deepPrimePct}% Deep Primes</Text>
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
              </View>
              <View style={styles.breakdownLegend}>
                <Text style={styles.breakdownText}>{data.focusCount} Focus</Text>
                <Text style={styles.breakdownText}>{data.deepCount} Deep Primes</Text>
              </View>
            </View>

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
                        day.isToday && styles.weekDotToday,
                      ]}
                    >
                      {day.type === 'deep' ? <View style={styles.deepPip} /> : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sensitivity}>
              <View style={styles.sensitivityDot} />
              <Text style={styles.sensitivityText}>
                {/* DEFERRED: Per-anchor sensitivity override — Phase 3+ */}
                {/* sensitivityMode is currently read from global settings only. */}
                {/* Future: allow per-anchor sensitivity stored alongside anchor record. */}
                Sensitivity: <Text style={styles.sensitivityStrong}>{data.sensitivityMode}</Text> — Any missed day begins decay.
              </Text>
            </View>
          </ScrollView>
        </Pressable>
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
    maxHeight: '78%',
    backgroundColor: C.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.18)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.25)',
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.1)',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.26)',
  },
  headerMeta: {
    flex: 1,
    minWidth: 0,
  },
  headerSup: {
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: 'rgba(212,175,55,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 3,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 14,
    color: C.bone,
  },
  headerPct: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    fontFamily: typography.fonts.headingBold,
    fontSize: 12,
    color: C.gold,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  gaugeWrap: {
    width: 76,
    height: 76,
  },
  gaugeInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugePct: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 17,
    color: C.gold,
    lineHeight: 18,
  },
  gaugeLabel: {
    marginTop: 2,
    fontFamily: typography.fonts.body,
    fontSize: 8,
    color: C.silverSoft,
    letterSpacing: 0.9,
  },
  gaugeText: {
    flex: 1,
  },
  gaugeTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 13,
    color: C.bone,
    letterSpacing: 0.5,
  },
  gaugeBody: {
    marginTop: 4,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    lineHeight: 18,
    color: C.silver,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  statValue: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 20,
    color: C.gold,
    lineHeight: 22,
  },
  statValuePurple: {
    color: C.purple,
  },
  statLabel: {
    marginTop: 3,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    color: C.silverSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: C.silverSoft,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionValue: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: C.purple,
  },
  breakdownTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
  },
  breakdownFocus: {
    height: '100%',
  },
  breakdownDeep: {
    height: '100%',
    backgroundColor: C.purpleDark,
  },
  breakdownLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  breakdownText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: C.silverDim,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekDay: {
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  weekLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 8,
    color: C.silverSoft,
    letterSpacing: 0.5,
  },
  weekDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weekDotFocus: {
    backgroundColor: 'rgba(212,175,55,0.16)',
    borderColor: 'rgba(212,175,55,0.45)',
  },
  weekDotDeep: {
    backgroundColor: 'rgba(62,44,91,0.7)',
    borderColor: C.purple,
  },
  weekDotToday: {
    shadowColor: C.gold,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  deepPip: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(155,127,212,0.85)',
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
  sensitivityText: {
    flex: 1,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    lineHeight: 16,
    color: C.silverDim,
  },
  sensitivityStrong: {
    color: C.gold,
  },
});
