/**
 * Anchor App - StatsGrid Component
 *
 * Orchestrates 5 StatPill components in a specific layout.
 * Row 1: Anchors Created | Charged (highlighted)
 * Row 2: Total Activations (full width)
 * Row 3: Current Streak | Longest Streak
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '@/theme';
import { StatPill } from './StatPill';
import { UserStats } from '@/types';

interface StatsGridProps {
  stats: UserStats;
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <View style={styles.container}>
      {/* Row 1: Anchors Created | Charged */}
      <View style={styles.row}>
        <StatPill label="Anchors Created" value={stats.totalAnchorsCreated} style={styles.pill} />
        <StatPill
          label="Charged"
          value={stats.totalCharged}
          style={styles.pill}
          highlight
        />
      </View>

      {/* Row 2: Total Activations (full width) */}
      <View style={styles.row}>
        <StatPill label="Total Activations" value={stats.totalActivations} />
      </View>

      {/* Row 3: Current Streak | Longest Streak */}
      <View style={styles.row}>
        <StatPill label="Current Streak" value={stats.currentStreak} unit="days" style={styles.pill} />
        <StatPill label="Longest Streak" value={stats.longestStreak} unit="days" style={styles.pill} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
  },
});
