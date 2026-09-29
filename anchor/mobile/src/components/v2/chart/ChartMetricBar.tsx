import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { colors, spacing, typography } from '@/theme/v2';

export function ChartMetricBar({ metric, color, tone = 'ink' }: {
  metric: NonNullable<ChartViewModel['waypoints'][number]['metric']>;
  color: string;
  tone?: 'ink' | 'cream';
}) {
  const fraction = metric.fraction ?? 0;
  const onInk = tone === 'ink';
  return (
    <View
      style={styles.metric}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${metric.display}${metric.label ? ` ${metric.label}` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    >
      <Text style={[styles.metricText, { color: onInk ? colors.ink.text.primary : colors.text.primary }]}>{metric.display}</Text>
      <View style={styles.metricRow}>
        <View style={[styles.metricTrack, { backgroundColor: onInk ? colors.ink.hairlineStrong : colors.border.subtle }]}>
          <View style={[styles.metricFill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
        </View>
        {metric.percentLabel ? <Text style={[styles.metricPercent, { color: onInk ? colors.ink.text.secondary : colors.text.secondary }]}>{metric.percentLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: { marginTop: spacing[3], gap: spacing[2] },
  metricText: { ...typography.bodyMD },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  metricTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  metricFill: { height: 6, borderRadius: 3 },
  metricPercent: { ...typography.labelMD, minWidth: 38, textAlign: 'right' },
});
