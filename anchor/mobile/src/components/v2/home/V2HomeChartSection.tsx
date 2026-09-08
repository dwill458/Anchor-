import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { V2Button, V2SectionHeader } from '@/components/v2';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';

type Props = {
  chart: HomeChartState;
  onOpenChart?: () => void;
  onCreateChart?: () => void;
};

/** Consumes the real Course/Waypoint data. Read-only; never advances progress. */
export function V2HomeChartSection({ chart, onOpenChart, onCreateChart }: Props) {
  if (chart.state === 'none') {
    return (
      <View style={styles.section}>
        <V2SectionHeader title="Chart" supportingCopy="Where is this Anchor taking you?" />
        <V2Button variant="secondary" accessibilityLabel="Start a Chart" onPress={onCreateChart}>
          Start a Chart
        </V2Button>
      </View>
    );
  }
  const progress = `${chart.reachedCount} of ${chart.waypointCount} waypoints`;
  return (
    <View style={styles.section}>
      <V2SectionHeader title="Next on your Chart" actionLabel="View Chart" onActionPress={onOpenChart} />
      <View style={styles.card}>
        <Text style={styles.destination}>{chart.destinationText}</Text>
        {chart.nextMove ? (
          <View style={styles.moveRow}>
            <Text style={styles.moveLabel}>NEXT MOVE</Text>
            <Text style={styles.move}>{chart.nextMove}</Text>
          </View>
        ) : null}
        <Text style={styles.progress}>{progress}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  card: {
    gap: spacing[2],
    padding: spacing[4],
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  destination: { ...typography.headingSM, color: colors.text.primary },
  moveRow: { gap: 2 },
  moveLabel: { ...typography.labelSM, color: colors.text.secondary },
  move: { ...typography.bodyMD, color: colors.text.primary },
  progress: { ...typography.caption, color: colors.text.secondary },
});
