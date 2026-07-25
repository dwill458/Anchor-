import React, { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { ChevronLeft, Eye, Flame, Target, Zap } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";

import { colors, typography } from "@/theme";
import type { PracticeStackParamList } from "@/types";
import { PRACTICE_MODE_THEME, type PracticeMode } from "@/types/practice";
import { usePracticeMetrics } from "@/hooks/usePracticeMetrics";

const MODE_META = {
  deep_prime: {
    label: "Deep Prime",
    color: PRACTICE_MODE_THEME.deep_prime.primary,
    Icon: Zap,
  },
  visualize: {
    label: "Visualize",
    color: PRACTICE_MODE_THEME.visualize.primary,
    Icon: Eye,
  },
  focus: {
    label: "Focus Session",
    color: PRACTICE_MODE_THEME.focus.primary,
    Icon: Target,
  },
  release: {
    label: "Release",
    color: PRACTICE_MODE_THEME.release.primary,
    Icon: Flame,
  },
} as const;

function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionLabel({ children }: React.PropsWithChildren) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Stat({
  value,
  label,
  sub,
}: {
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function StrengthRing({ value }: { value: number }) {
  const size = 108;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      style={styles.ring}
      accessibilityLabel={`Thread Strength ${value} out of 100`}
    >
      <Svg width={size} height={size} style={styles.ringSvg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.gold}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </Svg>
      <View style={styles.ringCopy}>
        <Text style={styles.ringValue}>{value}</Text>
        <Text style={styles.ringLabel}>STRENGTH</Text>
      </View>
    </View>
  );
}

function BreakdownRow({
  mode,
  count,
  percent,
  last,
}: {
  mode: PracticeMode;
  count: number;
  percent: number;
  last: boolean;
}) {
  const { label, color, Icon } = MODE_META[mode];
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${count} sessions. ${percent} percent.`}
      style={[styles.breakdownRow, last && styles.noBorder]}
    >
      <View
        style={[
          styles.breakdownIcon,
          { backgroundColor: `${color}1F`, borderColor: `${color}5C` },
        ]}
      >
        <Icon size={15} color={color} />
      </View>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownTrack}>
        <View
          style={[
            styles.breakdownFill,
            { width: `${percent}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.breakdownValue}>
        {count} <Text style={styles.muted}>·</Text> {percent}%
      </Text>
    </View>
  );
}

function heatMapDayLabel(
  day: ReturnType<typeof usePracticeMetrics>["heatMap"][number][number],
): string {
  const date = new Date(`${day.localDateKey}T12:00:00Z`).toLocaleDateString(
    "en-US",
    {
      timeZone: "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
    },
  );
  const detail = (Object.keys(MODE_META) as PracticeMode[])
    .filter((mode) => day.byMode[mode] > 0)
    .map((mode) => `${day.byMode[mode]} ${MODE_META[mode].label}`)
    .join(", ");
  return `${date}. ${day.total} session${day.total === 1 ? "" : "s"}${detail ? `. ${detail}.` : "."}`;
}

export const ThreadStrengthDetailScreen: React.FC = () => {
  const navigation =
    useNavigation<
      StackNavigationProp<PracticeStackParamList, "ThreadStrengthDetail">
    >();
  const metrics = usePracticeMetrics();
  const heatMapScrollRef = useRef<ScrollView>(null);
  const thisWeekTotal = metrics.currentWeek.reduce(
    (sum, day) => sum + day.count,
    0,
  );
  const weeklyMax = Math.max(
    0,
    ...metrics.currentWeek.map((day) => day.count),
  );
  let maxScale = 5;
  if (weeklyMax > 25) {
    maxScale = Math.ceil(weeklyMax / 10) * 10;
  } else if (weeklyMax > 12) {
    maxScale = 30;
  } else if (weeklyMax > 5) {
    maxScale = 15;
  } else {
    maxScale = 5;
  }
  const midScale = Math.round(maxScale / 2);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Practice"
            onPress={() => navigation.goBack()}
            style={styles.back}
          >
            <ChevronLeft size={16} color="rgba(245,240,232,0.62)" />
            <Text style={styles.backText}>Practice</Text>
          </Pressable>
          <Text style={styles.title}>THREAD STRENGTH</Text>
          <Text style={styles.subtitle}>Your overall practice momentum</Text>

          <Card style={styles.summaryCard}>
            <StrengthRing value={metrics.score} />
            <View style={styles.statsGrid}>
              <Stat value={metrics.totalSessions} label="TOTAL SESSIONS" />
              <Stat
                value={`${metrics.constancyPercent}%`}
                label="CONSTANCY"
                sub="30 days"
              />
              <Stat
                value={metrics.primeRecordDays}
                label="PRIME RECORD"
                sub="days"
              />
              <Stat value={`${metrics.deepPrimePercent}%`} label="DEEP PRIME" />
            </View>
          </Card>

          <View style={styles.section}>
            <SectionLabel>SESSION BREAKDOWN</SectionLabel>
            <Card style={styles.breakdownCard}>
              {metrics.sessionBreakdown.map((row, index) => (
                <BreakdownRow
                  key={row.mode}
                  {...row}
                  last={index === metrics.sessionBreakdown.length - 1}
                />
              ))}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionLabel>SESSION HISTORY</SectionLabel>
            <Card style={styles.heatCard}>
              <ScrollView
                ref={heatMapScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                accessibilityLabel={`Practice history over ${metrics.heatMap.length} weeks`}
                contentContainerStyle={styles.heatMap}
                onContentSizeChange={() =>
                  heatMapScrollRef.current?.scrollToEnd({ animated: false })
                }
              >
                {metrics.heatMap.map((week, weekIndex) => (
                  <View key={weekIndex} style={styles.heatColumn}>
                    {week.map((day) => {
                      const color = day.dominantMode
                        ? MODE_META[day.dominantMode].color
                        : "#FFFFFF";
                      const alpha =
                        day.densityLevel === 0
                          ? "0D"
                          : ["00", "66", "8F", "B8", "E0"][day.densityLevel];
                      return (
                        <View
                          key={day.localDateKey}
                          accessible
                          accessibilityLabel={heatMapDayLabel(day)}
                          style={[
                            styles.heatCell,
                            { backgroundColor: `${color}${alpha}` },
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
              <View style={styles.legend}>
                {(Object.keys(MODE_META) as PracticeMode[]).map((mode) => (
                  <View key={mode} style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: MODE_META[mode].color },
                      ]}
                    />
                    <Text style={styles.legendText}>
                      {MODE_META[mode].label}
                    </Text>
                  </View>
                ))}
              </View>
              <View style={styles.density}>
                <Text style={styles.legendText}>Density</Text>
                <Text style={styles.legendText}>Less</Text>
                {[0, 1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.densityCell,
                      {
                        backgroundColor:
                          level === 0
                            ? "rgba(255,255,255,0.05)"
                            : `${colors.gold}${["00", "66", "8F", "B8", "E0"][level]}`,
                      },
                    ]}
                  />
                ))}
                <Text style={styles.legendText}>More</Text>
              </View>
            </Card>
          </View>

          <View style={styles.section}>
            <SectionLabel>WEEKLY ACTIVITY</SectionLabel>
            <Card style={styles.weekCard}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekHeaderTitle}>
                  This Week:{" "}
                  <Text style={styles.weekHeaderCount}>{thisWeekTotal}</Text>{" "}
                  session{thisWeekTotal === 1 ? "" : "s"}
                </Text>
              </View>

              <View style={styles.weekChartArea}>
                <View style={styles.yAxis}>
                  <Text style={styles.yAxisLabel}>{maxScale}</Text>
                  <Text style={styles.yAxisLabel}>{midScale}</Text>
                  <Text style={styles.yAxisLabel}>0</Text>
                </View>

                <View style={styles.chartGrid}>
                  <View style={styles.gridLineTop} />
                  <View style={styles.gridLineMid} />
                  <View style={styles.gridLineBot} />

                  <View style={styles.weekColumns}>
                    {metrics.currentWeek.map((day) => {
                      const totalBarHeight =
                        day.count > 0
                          ? Math.max(
                              12,
                              Math.round((day.count / maxScale) * 100),
                            )
                          : 0;
                      return (
                        <View key={day.localDateKey} style={styles.weekColumn}>
                          <View style={styles.barArea}>
                            {day.count > 0 ? (
                              <View
                                style={[
                                  styles.stackedBar,
                                  { height: totalBarHeight },
                                ]}
                              >
                                {(
                                  [
                                    "deep_prime",
                                    "visualize",
                                    "focus",
                                    "release",
                                  ] as PracticeMode[]
                                ).map((mode) => {
                                  const modeCount = day.byMode[mode];
                                  if (modeCount <= 0) return null;
                                  return (
                                    <View
                                      key={mode}
                                      style={{
                                        flex: modeCount,
                                        backgroundColor: MODE_META[mode].color,
                                      }}
                                    />
                                  );
                                })}
                              </View>
                            ) : (
                              <View style={styles.emptyBarBase} />
                            )}
                          </View>
                          <Text
                            style={[
                              styles.weekDayLabel,
                              day.isToday && styles.todayLabel,
                            ]}
                          >
                            {day.label.slice(0, 3).toUpperCase()}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </Card>
          </View>

          <View style={styles.footer}>
            <SectionLabel>SENSITIVITY & DECAY</SectionLabel>
            <Text style={styles.footerCopy}>
              Thread Strength rises with each session tied to your practice and
              eases down gradually when you miss days. It never resets to zero.
              Depth compounds faster than it fades.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F1419" },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  back: {
    minHeight: 44,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  backText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: "rgba(245,240,232,0.62)",
  },
  title: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 23,
    letterSpacing: 0.7,
    color: colors.bone,
  },
  subtitle: {
    marginTop: 5,
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: "rgba(245,240,232,0.32)",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.065)",
    backgroundColor: "rgba(255,255,255,0.022)",
    overflow: "hidden",
  },
  summaryCard: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  ring: { width: 108, height: 108 },
  ringSvg: { transform: [{ rotate: "-90deg" }] },
  ringCopy: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringValue: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 30,
    lineHeight: 32,
    color: colors.gold,
  },
  ringLabel: {
    marginTop: 4,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 8,
    letterSpacing: 1,
    color: "rgba(245,240,232,0.32)",
  },
  statsGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  stat: { width: "50%" },
  statValue: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 19,
    lineHeight: 21,
    color: colors.gold,
  },
  statLabel: {
    marginTop: 5,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    color: "rgba(245,240,232,0.32)",
  },
  statSub: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    fontSize: 9.5,
    color: "rgba(245,240,232,0.36)",
  },
  section: { marginTop: 18 },
  sectionLabel: {
    marginBottom: 9,
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 1.5,
    color: "rgba(212,175,55,0.58)",
  },
  breakdownCard: { paddingHorizontal: 16 },
  breakdownRow: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.055)",
  },
  noBorder: { borderBottomWidth: 0 },
  breakdownIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownLabel: {
    width: 96,
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: colors.bone,
  },
  breakdownTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  breakdownFill: { height: "100%", borderRadius: 2 },
  breakdownValue: {
    width: 62,
    textAlign: "right",
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: "rgba(245,240,232,0.62)",
  },
  muted: { color: "rgba(245,240,232,0.32)" },
  heatCard: { paddingHorizontal: 14, paddingTop: 15, paddingBottom: 13 },
  heatMap: { flexDirection: "row", gap: 3.5 },
  heatColumn: { gap: 3.5 },
  heatCell: { width: 11, height: 11, borderRadius: 2.5 },
  legend: {
    marginTop: 13,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 14,
    rowGap: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 2 },
  legendText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 9.5,
    color: "rgba(245,240,232,0.32)",
  },
  density: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  densityCell: { width: 7, height: 7, borderRadius: 2 },
  weekCard: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  weekHeaderTitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: "rgba(245,240,232,0.42)",
  },
  weekHeaderCount: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 14,
    color: colors.gold,
  },
  weekChartArea: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  yAxis: {
    width: 22,
    height: 100,
    justifyContent: "space-between",
  },
  yAxisLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    color: "rgba(245,240,232,0.32)",
    textAlign: "right",
  },
  chartGrid: {
    flex: 1,
    height: 124,
    justifyContent: "space-between",
    position: "relative",
  },
  gridLineTop: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  gridLineMid: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  gridLineBot: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  weekColumns: {
    flexDirection: "row",
    height: "100%",
    zIndex: 1,
  },
  weekColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  barArea: {
    height: 100,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  stackedBar: {
    width: 20,
    borderRadius: 4,
    overflow: "hidden",
    flexDirection: "column-reverse",
  },
  emptyBarBase: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  weekDayLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: "rgba(245,240,232,0.36)",
  },
  todayLabel: {
    color: colors.gold,
    fontFamily: typography.fontFamily.sansBold,
  },
  footer: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  footerCopy: {
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(245,240,232,0.5)",
  },
});
