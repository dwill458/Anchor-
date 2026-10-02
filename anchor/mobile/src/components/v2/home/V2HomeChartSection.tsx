import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';
// DEFERRED: import { ChartWorldPreview } from '@/components/v2/chart/ChartWorldPreview';
import { ChartPreview } from '@/components/chart/ChartPreview';

type Props = {
  chart: HomeChartState;
  anchorId: string;
  onOpenChart: () => void;
  onRetry?: () => void | Promise<void>;
};

/**
 * Chart on Home is strictly conditional, and the absent/unknown/in-flight
 * distinction is load-bearing:
 *
 * - `none`      confirmed absence. Home renders nothing and the next section closes
 *               the gap.
 * - `resolving` the relationship is not yet knowable. Also render nothing; an
 *               unknown relationship must never surface as "Loading…".
 * - `loading`   a Course link for THIS Anchor is known and its detail is in
 *               flight. Only this earns a visible placeholder.
 * - `error`     a known relationship failed to load. Show it and allow retry;
 *               never silently substitute fallback content.
 */
function V2HomeChartSectionComponent({ chart, anchorId, onOpenChart, onRetry }: Props) {
  if (chart.state === 'resolving' || chart.state === 'none') return null;

  if (chart.state === 'error') {
    return (
      <View testID="v2-home-chart-error" style={styles.container}>
        <Text style={styles.title}>Your Chart</Text>
        <Text style={styles.errorCopy}>{chart.message}</Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Chart" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.kickerRow}>
        <Text style={styles.title}>Your Chart</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all Chart" onPress={onOpenChart} disabled={!onOpenChart} hitSlop={8}>
          <Text style={styles.linkText}>View all ›</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 10 }}>
        {/* DEFERRED: <ChartWorldPreview chart={chart} width={mapWidth - 2} category={category} onPress={onOpenChart} testID={testID ?? 'v2-home-chart'} /> */}
        <ChartPreview variant="card" anchorId={anchorId} onPress={onOpenChart} testID="v2-home-chart" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontFamily: 'BricolageGrotesque-SemiBold', fontSize: 18, lineHeight: 23, color: colors.graphite.text.primary },
  linkText: {
    fontFamily: 'Figtree-Regular',
    fontSize: 13.5,
    color: colors.graphite.text.secondary,
  },
  errorCopy: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 12,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  retryText: {
    fontFamily: typography.bodySemiBold,
    fontSize: 13.5,
    color: colors.graphite.text.primary,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.78,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeChartSection = memo(V2HomeChartSectionComponent);
