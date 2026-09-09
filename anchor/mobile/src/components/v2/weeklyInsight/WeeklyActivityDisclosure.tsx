/**
 * Detailed Activity disclosure panel for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx:
 * Collapsed by default behind "See weekly activity".
 * Exposes:
 * - Practices, Active days, Minutes overview
 * - Thread Strength start/end movement with mini SVG curve
 * - Practice mode distribution bars
 * - Connected activity (Chart waypoint / Vision revisits) - omitted if absent
 * - Canonical events ledger
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { WeeklyDetailedActivity } from '@/adapters/v2/weeklyInsight/types';

interface WeeklyActivityDisclosureProps {
  detailedActivity: WeeklyDetailedActivity;
  isOpen: boolean;
  onToggle: () => void;
  accentColor: string;
  testID?: string;
}

export const WeeklyActivityDisclosure: React.FC<WeeklyActivityDisclosureProps> = ({
  detailedActivity,
  isOpen,
  onToggle,
  accentColor,
  testID = 'weekly-activity-disclosure',
}) => {
  const {
    totalPractices,
    activeDays,
    totalMinutes,
    threadStart,
    threadEnd,
    threadPoints,
    modeDistribution,
    connectedActivity,
    canonicalEvents,
  } = detailedActivity;

  // Compute polyline coordinates for mini-thread SVG
  const min = Math.min(...threadPoints) - 2;
  const max = Math.max(...threadPoints) + 2;
  const polylinePoints = threadPoints
    .map((v, i) => {
      const x = 8 + i * 49;
      const y = 58 - ((v - min) / (max - min || 1)) * 42;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.container} testID={testID}>
      {/* Toggle Button */}
      <Pressable
        style={styles.toggleButton}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="See weekly activity"
        accessibilityState={{ expanded: isOpen }}
        testID={`${testID}-toggle`}
      >
        <Text style={styles.toggleText}>See weekly activity</Text>
        <Text style={[styles.toggleIcon, isOpen && styles.toggleIconOpen]}>
          {isOpen ? '×' : '+'}
        </Text>
      </Pressable>

      {/* Expanded Panel */}
      {isOpen && (
        <View style={styles.panel} testID={`${testID}-panel`}>
          {/* 1. Overview Stats */}
          <View style={styles.overviewRow}>
            <View style={[styles.statItem, styles.firstStat]}>
              <Text style={styles.statValue}>{totalPractices}</Text>
              <Text style={styles.statLabel}>PRACTICES</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeDays}</Text>
              <Text style={styles.statLabel}>ACTIVE DAYS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalMinutes}</Text>
              <Text style={styles.statLabel}>MINUTES</Text>
            </View>
          </View>

          {/* 2. Thread Strength Mini-Chart */}
          <View style={styles.block}>
            <View style={styles.headingRow}>
              <Text style={styles.headingTitle}>Thread Strength</Text>
              <Text style={styles.headingSub}>
                {threadStart} → {threadEnd}
              </Text>
            </View>
            <Svg width="100%" height={64} viewBox="0 0 310 64">
              <Line x1={8} x2={302} y1={58} y2={58} stroke={colors.border.default} strokeWidth={1} />
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={accentColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          {/* 3. Practice Mix Distribution */}
          <View style={styles.block}>
            <View style={styles.headingRow}>
              <Text style={styles.headingTitle}>Practice mix</Text>
              <Text style={styles.headingSub}>Completed</Text>
            </View>
            {modeDistribution.map((item) => (
              <View key={`mode-${item.mode}`} style={styles.modeRow}>
                <Text style={styles.modeName}>{item.mode}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(0, item.percentage)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.modeVal}>{item.count}</Text>
              </View>
            ))}
          </View>

          {/* 4. Connected Activity (Only when relevant) */}
          {connectedActivity.length > 0 && (
            <View style={styles.block}>
              <View style={styles.headingRow}>
                <Text style={styles.headingTitle}>Connected activity</Text>
                <Text style={styles.headingSub}>Only when relevant</Text>
              </View>
              {connectedActivity.map((conn, idx) => (
                <View
                  key={`conn-${idx}`}
                  style={[styles.contextRow, idx > 0 && styles.contextBorder]}
                >
                  <View
                    style={[
                      styles.contextMark,
                      { backgroundColor: conn.color || accentColor },
                    ]}
                  />
                  <View style={styles.contextCopy}>
                    <Text style={styles.contextTitle}>{conn.title}</Text>
                    <Text style={styles.contextSub}>{conn.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 5. Meaningful Canonical Events */}
          {canonicalEvents.length > 0 && (
            <View style={styles.block}>
              <View style={styles.headingRow}>
                <Text style={styles.headingTitle}>Meaningful events</Text>
                <Text style={styles.headingSub}>Canonical</Text>
              </View>
              {canonicalEvents.map((evt, idx) => (
                <View
                  key={`evt-${idx}`}
                  style={[styles.eventRow, idx > 0 && styles.eventBorder]}
                >
                  <Text style={styles.eventLabel}>{evt.label}</Text>
                  <Text style={styles.eventDay}>{evt.day}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingVertical: 18,
  },
  toggleText: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  toggleIcon: {
    fontSize: 18,
    lineHeight: 18,
    color: colors.text.disabled,
  },
  toggleIconOpen: {
    fontSize: 22,
  },
  panel: {
    paddingBottom: 22,
  },
  overviewRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: colors.border.default,
  },
  firstStat: {
    paddingLeft: 0,
    borderLeftWidth: 0,
  },
  statValue: {
    fontFamily: typography.displaySemiBold,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text.primary,
  },
  statLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    color: colors.text.disabled,
    letterSpacing: 0.6,
    marginTop: 5,
  },
  block: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingVertical: 18,
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headingTitle: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headingSub: {
    fontFamily: typography.body,
    fontSize: 10.5,
    color: colors.text.disabled,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  modeName: {
    width: 74,
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.text.secondary,
  },
  barTrack: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border.default,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  modeVal: {
    width: 28,
    fontFamily: typography.body,
    fontSize: 10.5,
    color: colors.text.disabled,
    textAlign: 'right',
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
  },
  contextBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  contextMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  contextCopy: {
    flex: 1,
  },
  contextTitle: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.primary,
  },
  contextSub: {
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.text.disabled,
    marginTop: 2,
  },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  eventBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  eventLabel: {
    fontFamily: typography.body,
    fontSize: 11.5,
    color: colors.text.primary,
  },
  eventDay: {
    fontFamily: typography.body,
    fontSize: 10.5,
    color: colors.text.disabled,
  },
});
