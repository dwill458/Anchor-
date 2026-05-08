import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThreadHistory, type DayData } from '@/hooks/useThreadHistory';
import { typography } from '@/theme';

interface ThreadStrengthSheetProps {
  visible: boolean;
  onClose: () => void;
}

const HEATMAP_TIP_KEY = 'anchor-has-seen-heatmap-tip';
const CELL_SIZE = 13;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const ARC_LENGTH = 69.1;

const C = {
  navy: '#0F1419',
  navySheet: '#131c27',
  gold: '#D4AF37',
  goldDim: '#8a7120',
  silver: '#C0C0C0',
  bone: '#F5F5DC',
  purpleBright: '#7B5EA7',
  purpleMid: '#5a4080',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AnimatedPath = Animated.createAnimatedComponent(Path);

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatTooltipDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function focusColor(count: number): string {
  if (count <= 0) return 'rgba(255,255,255,0.04)';
  if (count === 1) return 'rgba(212,175,55,0.28)';
  if (count === 2) return 'rgba(212,175,55,0.58)';
  return 'rgba(212,175,55,0.88)';
}

function deepColor(count: number): string {
  if (count <= 0) return 'transparent';
  if (count === 1) return 'rgba(123,94,167,0.55)';
  return 'rgba(123,94,167,0.88)';
}

function deepSliceHeight(count: number): number {
  if (count <= 0) return 0;
  return count === 1 ? 4 : 6;
}

const StrengthArc: React.FC<{ value: number }> = ({ value }) => {
  const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
  const progress = useRef(new Animated.Value(0)).current;
  const dashOffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [ARC_LENGTH, 0],
  });

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: clampedValue,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedValue, progress]);

  return (
    <View style={styles.arcWrap}>
      <Svg width={56} height={34} viewBox="0 0 56 34">
        <Defs>
          <SvgLinearGradient id="threadArcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={C.goldDim} />
            <Stop offset="100%" stopColor={C.gold} />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M 6 28 A 22 22 0 0 1 50 28"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <AnimatedPath
          d="M 6 28 A 22 22 0 0 1 50 28"
          fill="none"
          stroke="url(#threadArcGradient)"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <Text style={styles.arcPercent}>{clampedValue}%</Text>
      <Text style={styles.arcLabel}>Strength</Text>
    </View>
  );
};

const Stat: React.FC<{
  value: string | number;
  label: string;
  isLast?: boolean;
  purple?: boolean;
}> = ({ value, label, isLast, purple }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, purple && styles.statValuePurple]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {!isLast ? <View style={styles.statDivider} /> : null}
  </View>
);

const WeekDot: React.FC<{
  day: ThreadHistorySheetWeekDay;
}> = ({ day }) => {
  const content = day.hasFocus || day.hasDeep || day.isToday ? '✓' : '—';
  const dotStyle = [
    styles.weekDot,
    day.hasFocus && !day.hasDeep ? styles.weekDotFocus : null,
    day.isToday ? styles.weekDotToday : null,
    day.isFuture ? styles.future : null,
  ];

  return (
    <View style={styles.weekDay}>
      <Text style={styles.weekDayLabel}>{day.label}</Text>
      {day.hasDeep && !day.isToday ? (
        <ExpoLinearGradient
          colors={['rgba(212,175,55,0.12)', 'rgba(123,94,167,0.20)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.weekDot, styles.weekDotDeep, day.isFuture && styles.future]}
        >
          <Text style={styles.weekCheck}>{content}</Text>
          <View style={styles.deepPip} />
        </ExpoLinearGradient>
      ) : (
        <View style={dotStyle}>
          <Text style={[styles.weekCheck, day.isToday && styles.weekCheckToday]}>{content}</Text>
        </View>
      )}
    </View>
  );
};

type ThreadHistorySheetWeekDay = ReturnType<typeof useThreadHistory>['currentWeekDays'][number];

const HeatmapCell: React.FC<{
  day: DayData;
  weekIndex: number;
  dayIndex: number;
  onPress: (day: DayData, weekIndex: number, dayIndex: number) => void;
  pulseOpacity: Animated.Value;
}> = ({ day, weekIndex, dayIndex, onPress, pulseOpacity }) => {
  const deepHeight = deepSliceHeight(day.deepCount);
  const cell = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${day.date}, ${day.focusCount} Focus sessions, ${day.deepCount} Deep Primes`}
      onPress={() => onPress(day, weekIndex, dayIndex)}
      style={[styles.hmCell, day.isFuture && styles.hmCellFuture]}
    >
      <View
        style={[
          styles.deepSlice,
          {
            height: deepHeight,
            backgroundColor: deepColor(day.deepCount),
          },
        ]}
      />
      <View
        style={[
          styles.focusSlice,
          {
            backgroundColor: day.isToday ? C.gold : focusColor(day.focusCount),
          },
        ]}
      />
    </Pressable>
  );

  if (!day.isToday) {
    return cell;
  }

  return (
    <Animated.View
      style={[
        styles.todayPulse,
        {
          shadowOpacity: pulseOpacity,
          opacity: pulseOpacity.interpolate({
            inputRange: [0.35, 0.85],
            outputRange: [0.82, 1],
          }),
        },
      ]}
    >
      {cell}
    </Animated.View>
  );
};

const ThreadStrengthSheetContent: React.FC<ThreadStrengthSheetProps> = ({
  visible,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const history = useThreadHistory();
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const [tooltip, setTooltip] = useState<{
    day: DayData;
    left: number;
    top: number;
  } | null>(null);
  const [showHeatmapTip, setShowHeatmapTip] = useState(false);

  const monthLabels = useMemo(() => {
    const labels: { month: string; left: number }[] = [];
    let lastMonth = -1;
    let previousCol = -999;

    history.weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (!firstDay || firstDay.isFuture) {
        return;
      }

      const month = parseDateKey(firstDay.date).getMonth();
      if (month !== lastMonth && weekIndex - previousCol >= 3) {
        labels.push({
          month: MONTHS[month],
          left: weekIndex * CELL_STEP,
        });
        previousCol = weekIndex;
      }
      lastMonth = month;
    });

    return labels;
  }, [history.weeks]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulseOpacity, visible]);

  useEffect(() => {
    if (!visible) {
      setTooltip(null);
      return;
    }

    let cancelled = false;
    AsyncStorage.getItem(HEATMAP_TIP_KEY).then((seen) => {
      if (!seen && !cancelled) {
        tipOpacity.setValue(0);
        setShowHeatmapTip(true);
        Animated.timing(tipOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tipOpacity, visible]);

  const dismissTip = useCallback(async () => {
    Animated.timing(tipOpacity, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShowHeatmapTip(false));

    try {
      await AsyncStorage.setItem(HEATMAP_TIP_KEY, 'true');
    } catch (_error) {
      // Non-blocking UI state.
    }
  }, [tipOpacity]);

  useEffect(() => {
    if (!showHeatmapTip) {
      return undefined;
    }

    const timer = setTimeout(() => {
      void dismissTip();
    }, 3000);

    return () => clearTimeout(timer);
  }, [dismissTip, showHeatmapTip]);

  useEffect(() => {
    if (!tooltip) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setTooltip(null);
    }, 2000);

    return () => clearTimeout(timer);
  }, [tooltip]);

  const showTooltip = useCallback((day: DayData, weekIndex: number, dayIndex: number) => {
    if (day.isFuture) {
      return;
    }

    setTooltip({
      day,
      left: 20 + weekIndex * CELL_STEP,
      top: 30 + dayIndex * CELL_STEP,
    });
  }, []);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Thread Strength</Text>
                <Text style={styles.subtitle}>Your practice, compounded</Text>
              </View>
              <StrengthArc value={history.threadStrength} />
            </View>

            <View style={styles.statsRow}>
              <Stat value={history.totalSessions} label="Total Sessions" />
              <Stat value={history.currentStreak} label="Current Streak" />
              <Stat value={history.longestStreak} label="Longest Streak" />
              <Stat
                value={`${history.deepPrimePercent}%`}
                label="Deep Primes"
                purple
                isLast
              />
            </View>

            <View style={styles.sensitivityNote}>
              <View style={styles.sensitivityDot} />
              <Text style={styles.sensitivityText}>
                Sensitivity:{' '}
                <Text style={styles.sensitivityStrong}>{history.sensitivityLabel}</Text>
                {' — '}
                {history.sensitivityNote}
              </Text>
            </View>

            <View style={styles.ratioSection}>
              <View style={styles.ratioLabelRow}>
                <Text style={styles.sectionLabel}>Session Breakdown</Text>
                <Text style={styles.ratioRight}>{history.deepPrimePercent}% Deep Primes</Text>
              </View>
              <View style={styles.ratioTrack}>
                <ExpoLinearGradient
                  colors={[C.goldDim, C.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.ratioFocus,
                    { width: `${100 - history.deepPrimePercent}%` },
                  ]}
                />
                <ExpoLinearGradient
                  colors={[C.purpleMid, C.purpleBright]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.ratioDeep,
                    { width: `${history.deepPrimePercent}%` },
                  ]}
                />
              </View>
              <View style={styles.ratioSubRow}>
                <Text style={styles.ratioSub}>{history.focusCount} Focus sessions</Text>
                <Text style={styles.ratioSub}>{history.deepCount} Deep Primes</Text>
              </View>
            </View>

            <View style={styles.weekSection}>
              <Text style={styles.sectionLabel}>This Week</Text>
              <View style={styles.weekStrip}>
                {history.currentWeekDays.map((day) => (
                  <WeekDot key={day.date} day={day} />
                ))}
              </View>
            </View>

            <View style={styles.heatmapSection}>
              <View style={styles.hmTop}>
                <Text style={styles.sectionLabel}>Session History</Text>
                <Text style={styles.hmRight}>Last 24 weeks</Text>
              </View>

              <View style={styles.hmBody}>
                <View style={styles.hmOuter}>
                  <View style={styles.hmDayLabels}>
                    <Text style={styles.hmDayLabel} />
                    <Text style={styles.hmDayLabel}>M</Text>
                    <Text style={styles.hmDayLabel} />
                    <Text style={styles.hmDayLabel}>W</Text>
                    <Text style={styles.hmDayLabel} />
                    <Text style={styles.hmDayLabel}>F</Text>
                    <Text style={styles.hmDayLabel} />
                  </View>

                  <View style={styles.hmGrid}>
                    {history.weeks.map((week, weekIndex) => (
                      <View key={`week-${weekIndex}`} style={styles.hmColumn}>
                        {week.map((day, dayIndex) => (
                          <HeatmapCell
                            key={day.date}
                            day={day}
                            weekIndex={weekIndex}
                            dayIndex={dayIndex}
                            onPress={showTooltip}
                            pulseOpacity={pulseOpacity}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>

                {tooltip ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.tooltip,
                      {
                        left: Math.max(8, Math.min(tooltip.left, 240)),
                        top: tooltip.top,
                      },
                    ]}
                  >
                    <Text style={styles.tooltipDate}>{formatTooltipDate(tooltip.day.date)}</Text>
                    <View style={styles.tooltipRow}>
                      <View style={[styles.tooltipDot, { backgroundColor: 'rgba(212,175,55,0.85)' }]} />
                      <Text style={styles.tooltipLabel}>Focus</Text>
                      <Text style={styles.tooltipValue}>{tooltip.day.focusCount}</Text>
                    </View>
                    {tooltip.day.deepCount > 0 ? (
                      <View style={styles.tooltipRow}>
                        <View style={[styles.tooltipDot, { backgroundColor: C.purpleBright }]} />
                        <Text style={styles.tooltipLabel}>Deep Prime</Text>
                        <Text style={styles.tooltipValue}>{tooltip.day.deepCount}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={styles.monthLabels}>
                {monthLabels.map((label) => (
                  <Text
                    key={`${label.month}-${label.left}`}
                    style={[styles.monthLabel, { left: label.left }]}
                  >
                    {label.month}
                  </Text>
                ))}
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItems}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: 'rgba(212,175,55,0.8)' }]} />
                    <Text style={styles.legendText}>Focus</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: C.purpleBright }]} />
                    <Text style={styles.legendText}>Deep Prime</Text>
                  </View>
                </View>
                <View style={styles.legendScale}>
                  <Text style={styles.legendScaleLabel}>Less</Text>
                  {[0, 1, 2, 3].map((level) => (
                    <View
                      key={level}
                      style={[styles.legendScaleCell, { backgroundColor: focusColor(level) }]}
                    />
                  ))}
                  <Text style={styles.legendScaleLabel}>More</Text>
                </View>
              </View>

              {showHeatmapTip ? (
                <Pressable onPress={() => void dismissTip()}>
                  <Animated.View style={[styles.heatmapTip, { opacity: tipOpacity }]}>
                    <Text style={styles.heatmapTipArrow}>↑</Text>
                    <Text style={styles.heatmapTipText}>
                      Purple = Deep Prime · Gold = Focus
                    </Text>
                  </Animated.View>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const ThreadStrengthSheet: React.FC<ThreadStrengthSheetProps> = (props) => {
  if (!props.visible) {
    return null;
  }

  return <ThreadStrengthSheetContent {...props} />;
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: C.navySheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.18)',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(212,175,55,0.25)',
    alignSelf: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 18,
    color: C.bone,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 13,
    color: C.silver,
    marginTop: 3,
  },
  arcWrap: {
    alignItems: 'center',
    minWidth: 58,
  },
  arcPercent: {
    position: 'absolute',
    top: 18,
    fontFamily: typography.fonts.headingBold,
    fontSize: 10,
    color: C.gold,
  },
  arcLabel: {
    marginTop: -2,
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 1.3,
    color: C.silver,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 4,
  },
  statValue: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 21,
    lineHeight: 25,
    color: C.gold,
  },
  statValuePurple: {
    color: C.purpleBright,
  },
  statLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 0.8,
    color: C.silver,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
  },
  statDivider: {
    position: 'absolute',
    right: 0,
    top: '10%',
    height: '80%',
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  sensitivityNote: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.12)',
    backgroundColor: 'rgba(212,175,55,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sensitivityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
  },
  sensitivityText: {
    flex: 1,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 12,
    lineHeight: 17,
    color: C.silver,
  },
  sensitivityStrong: {
    color: C.gold,
    fontFamily: typography.fonts.bodySerif,
  },
  ratioSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  ratioLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.silver,
    textTransform: 'uppercase',
  },
  ratioRight: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    letterSpacing: 0.7,
    color: C.purpleBright,
  },
  ratioTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  ratioFocus: {
    height: 6,
  },
  ratioDeep: {
    height: 6,
  },
  ratioSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ratioSub: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: 'rgba(192,192,192,0.5)',
  },
  weekSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 10,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 9,
    color: 'rgba(192,192,192,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  weekDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  weekDotFocus: {
    backgroundColor: 'rgba(212,175,55,0.10)',
    borderColor: 'rgba(212,175,55,0.30)',
  },
  weekDotDeep: {
    borderColor: 'rgba(212,175,55,0.35)',
  },
  weekDotToday: {
    backgroundColor: C.gold,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  weekCheck: {
    fontFamily: typography.fonts.headingBold,
    fontSize: 11,
    color: C.gold,
  },
  weekCheckToday: {
    color: C.navy,
  },
  deepPip: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.purpleBright,
    borderWidth: 1.5,
    borderColor: C.navySheet,
  },
  future: {
    opacity: 0.3,
  },
  heatmapSection: {
    paddingTop: 16,
  },
  hmTop: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hmRight: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    letterSpacing: 0.4,
    color: 'rgba(192,192,192,0.35)',
    textTransform: 'uppercase',
  },
  hmBody: {
    position: 'relative',
  },
  hmOuter: {
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 2,
  },
  hmDayLabels: {
    width: 10,
    gap: CELL_GAP,
  },
  hmDayLabel: {
    width: 10,
    height: CELL_SIZE,
    fontFamily: typography.fonts.body,
    fontSize: 8,
    color: 'rgba(192,192,192,0.28)',
    lineHeight: CELL_SIZE,
  },
  hmGrid: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  hmColumn: {
    gap: CELL_GAP,
  },
  hmCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  hmCellFuture: {
    opacity: 0.15,
  },
  deepSlice: {
    width: '100%',
    flexShrink: 0,
  },
  focusSlice: {
    width: '100%',
    flex: 1,
  },
  todayPulse: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
    shadowColor: C.gold,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  tooltip: {
    position: 'absolute',
    minWidth: 138,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: '#1a2a3a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 20,
  },
  tooltipDate: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: C.silver,
    marginBottom: 5,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  tooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tooltipLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: 'rgba(192,192,192,0.7)',
  },
  tooltipValue: {
    marginLeft: 'auto',
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    color: C.bone,
  },
  monthLabels: {
    position: 'relative',
    height: 14,
    marginTop: 4,
    marginLeft: 20,
  },
  monthLabel: {
    position: 'absolute',
    fontFamily: typography.fonts.body,
    fontSize: 8,
    letterSpacing: 0.5,
    color: 'rgba(192,192,192,0.28)',
  },
  legendRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItems: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 10,
    color: C.silver,
  },
  legendScale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendScaleLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 9,
    letterSpacing: 0.5,
    color: 'rgba(192,192,192,0.3)',
  },
  legendScaleCell: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  heatmapTip: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(212,175,55,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heatmapTipArrow: {
    fontFamily: typography.fonts.body,
    fontSize: 13,
    color: 'rgba(212,175,55,0.5)',
  },
  heatmapTipText: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 11,
    color: C.silver,
  },
});
