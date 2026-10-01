import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, getCategoryColor, spacing } from '@/theme/v2';

export function ChartProgressBar({ progress, category }: { progress: number; category?: string | null }) {
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Waypoint progress"
      accessibilityValue={{ min: 0, max: 100, now: value * 100 }} style={styles.track}>
      <View testID="chart-progress-fill" style={[styles.fill,
        { width: `${value * 100}%`, minWidth: value > 0 ? spacing[1] : 0, backgroundColor: getCategoryColor(category) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: spacing[1], borderRadius: spacing[1], overflow: 'hidden', backgroundColor: colors.ink.hairlineStrong },
  fill: { height: '100%', maxWidth: '100%', borderRadius: spacing[1] },
});
