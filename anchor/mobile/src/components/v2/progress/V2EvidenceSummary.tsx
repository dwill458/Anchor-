import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, getPracticeColor, radii, typography } from '@/theme/v2';
import { V2SectionHeader } from '@/components/v2/primitives';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';
import { PROGRESS_MODE_LABELS, progressTokens } from './progressTokens';

export interface V2EvidenceSummaryProps {
  model: V2ProgressModel;
  testID?: string;
}

// DEFERRED: formatDuration fed the old Practice card ("{n} total dedicated"). Minutes now live in the Rhythm card.
// function formatDuration(seconds: number): string {
//   if (seconds < 60) return `${seconds}s`;
//   const mins = Math.floor(seconds / 60);
//   if (mins < 60) return `${mins}m`;
//   const hours = Math.floor(mins / 60);
//   const remMins = mins % 60;
//   return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
// }

/**
 * How you practice: one stacked bar and four rows (dot, label, share, count).
 * The counts are the four mode counts, so they always sum to the total.
 */
export const V2EvidenceSummary: React.FC<V2EvidenceSummaryProps> = ({
  model,
  testID = 'v2-evidence-summary',
}) => {
  const { practiceSummary } = model;
  const total = practiceSummary.totalSessions;

  const modes = [
    { key: 'focus', label: PROGRESS_MODE_LABELS.focus, count: practiceSummary.focusCount, color: getPracticeColor('focus') },
    { key: 'deepPrime', label: PROGRESS_MODE_LABELS.deepPrime, count: practiceSummary.deepPrimeCount, color: getPracticeColor('deepPrime') },
    { key: 'visualize', label: PROGRESS_MODE_LABELS.visualize, count: practiceSummary.visualizeCount, color: getPracticeColor('visualize') },
    { key: 'release', label: PROGRESS_MODE_LABELS.release, count: practiceSummary.releaseCount, color: getPracticeColor('release') },
  ];

  return (
    <View style={styles.container} testID={testID}>
      <V2SectionHeader title="How you practice" supportingCopy={`${total} total`} />

      <View style={styles.card}>
        <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {total > 0
            ? modes
                .filter((mode) => mode.count > 0)
                .map((mode) => (
                  <View key={mode.key} style={{ flex: mode.count, backgroundColor: mode.color }} />
                ))
            : null}
        </View>

        {modes.map((mode, index) => (
          <View
            key={mode.key}
            style={[styles.row, index > 0 && styles.rowDivider]}
            testID={`${testID}-row-${mode.key}`}
            accessible
            accessibilityLabel={`${mode.label}: ${total > 0 ? Math.round((mode.count / total) * 100) : 0} percent, ${mode.count} practices`}
          >
            <View style={[styles.dot, { backgroundColor: mode.color }]} />
            <Text style={styles.label}>{mode.label}</Text>
            <Text style={styles.share}>{total > 0 ? Math.round((mode.count / total) * 100) : 0}%</Text>
            <Text style={styles.count}>{mode.count}</Text>
          </View>
        ))}
      </View>

      {/* DEFERRED: the old four-up evidence grid. Practice moved to this card and Rhythm; Waypoints and Evolution now live in Your route and the hero.
        <View style={styles.grid}>
          <View style={styles.card}> Practice: {practiceSummary.totalSessions} + formatDuration(totalDurationSeconds) total dedicated </View>
          <View style={styles.card}> Waypoints: {waypointsReachedCount} "Milestones reached on route" </View>
          <View style={styles.card}> Modes: Focus / Deep Focus / Visualize / Release counts </View>
          <View style={styles.card}> Evolution: {highestEvolutionStage} "Current stage" </View>
        </View>
      */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 11 },
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    padding: 16,
  },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: radii.pill,
    overflow: 'hidden',
    gap: 2,
    marginBottom: 14,
    backgroundColor: progressTokens.inkWash(0.06),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: progressTokens.hairline },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1, ...typography.labelLG, color: colors.text.primary },
  share: { ...typography.bodySM, color: progressTokens.muted },
  count: { ...typography.labelLG, color: colors.text.primary, minWidth: 26, textAlign: 'right' },
});
