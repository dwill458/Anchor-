import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';
import { ChartWorldPreview } from '@/components/v2/chart/ChartWorldPreview';
import { useV2Responsive } from '@/hooks/v2/useV2Responsive';

type Props = {
  chart: HomeChartState;
  expanded?: boolean;
  categoryColor?: string;
  category?: string | null;
  onOpenChart?: () => void;
  onRetry?: () => void | Promise<void>;
  testID?: string;
};

/**
 * Chart on Home is strictly conditional, and the absent/unknown/in-flight
 * distinction is load-bearing:
 *
 * - `none`      confirmed absence. Home has no Chart section for this Anchor.
 * - `resolving` the relationship is not yet knowable. Also render nothing; an
 *               unknown relationship must never surface as "Loading…".
 * - `loading`   a Course link for THIS Anchor is known and its detail is in
 *               flight. Only this earns a visible placeholder.
 * - `error`     a known relationship failed to load. Show it and allow retry;
 *               never silently substitute fallback content.
 */
function V2HomeChartSectionComponent({ chart, category, onOpenChart, onRetry, testID }: Props) {
  const { width: windowWidth, gutter } = useV2Responsive();
  const mapWidth = Math.max(1, windowWidth - gutter * 2);

  if (chart.state === 'resolving') return null;

  if (chart.state === 'none') {
    return null;
  }

  if (chart.state === 'loading') {
    return (
      <View testID="v2-home-chart-loading" style={styles.container}>
        <Text style={styles.title}>Your Chart</Text>
        <View style={[styles.skeletonGroup, { minHeight: 124 }]}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonCopy]} />
        </View>
      </View>
    );
  }

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
        <ChartWorldPreview chart={chart} width={mapWidth - 2} category={category} onPress={onOpenChart} testID={testID ?? 'v2-home-chart'} />
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
  skeletonGroup: {
    marginTop: 14,
    gap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.graphite.hairlineStrong,
  },
  skeletonTitle: {
    width: '58%',
    height: 18,
  },
  skeletonCopy: {
    width: '40%',
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
