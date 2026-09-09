import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Activity, Award, Compass, Sparkles } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';

export interface V2EvidenceSummaryProps {
  model: V2ProgressModel;
  testID?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

export const V2EvidenceSummary: React.FC<V2EvidenceSummaryProps> = ({
  model,
  testID = 'v2-evidence-summary',
}) => {
  const { practiceSummary, waypointsReachedCount, highestEvolutionStage } = model;

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.sectionHeader}>VERIFIABLE EVIDENCE</Text>

      <View style={styles.grid}>
        {/* Practice Sessions Card */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Activity size={16} color="#41C8C6" />
            <Text style={styles.cardLabel}>Practice</Text>
          </View>
          <Text style={styles.cardValue}>{practiceSummary.totalSessions}</Text>
          <Text style={styles.cardSubtext}>
            {formatDuration(practiceSummary.totalDurationSeconds)} total dedicated
          </Text>
        </View>

        {/* Waypoints Reached Card */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Compass size={16} color="#6C90F3" />
            <Text style={styles.cardLabel}>Waypoints</Text>
          </View>
          <Text style={styles.cardValue}>{waypointsReachedCount}</Text>
          <Text style={styles.cardSubtext}>Milestones reached on route</Text>
        </View>

        {/* Mode Breakdown Card */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Sparkles size={16} color="#8EE0CF" />
            <Text style={styles.cardLabel}>Modes</Text>
          </View>
          <View style={styles.modeRow}>
            <Text style={styles.modeItem}>Focus: {practiceSummary.focusCount}</Text>
            <Text style={styles.modeItem}>Prime: {practiceSummary.deepPrimeCount}</Text>
          </View>
          <View style={styles.modeRow}>
            <Text style={styles.modeItem}>Vision: {practiceSummary.visualizeCount}</Text>
            <Text style={styles.modeItem}>Release: {practiceSummary.releaseCount}</Text>
          </View>
        </View>

        {/* Structural Stage Card */}
        <View style={styles.card}>
          <View style={styles.cardIconRow}>
            <Award size={16} color="#FFA32C" />
            <Text style={styles.cardLabel}>Evolution</Text>
          </View>
          <Text style={[styles.cardValue, styles.stageValue]}>{highestEvolutionStage}</Text>
          <Text style={styles.cardSubtext}>Permanent structural state</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#141820',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  cardLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  cardValue: {
    ...typography.headingMD,
    color: colors.text.primary,
    marginBottom: 2,
  },
  stageValue: {
    ...typography.headingSM,
    color: '#FFA32C',
  },
  cardSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  modeItem: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});
