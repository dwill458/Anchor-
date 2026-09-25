import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';
import { ChartPreview } from '@/components/v2/chart/ChartPreview';
import type { ChartMarker } from '@/components/v2/chart/ChartLandscape';
import { CHART_WINDOWS } from '@/components/v2/chart/chartRouteGeometry';
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

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={17} height={11} viewBox="0 0 17 11" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M0.8 5.5H15.4M10.9 1L15.4 5.5L10.9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Chart on Home is strictly conditional, and the absent/unknown/in-flight
 * distinction is load-bearing:
 *
 * - `none`      confirmed absence. Show only category terrain and the real
 *               Chart entry action: no route, waypoint, or progress.
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
    return (
      <Pressable
        testID={testID ?? 'v2-home-chart-empty'}
        accessibilityRole="button"
        accessibilityLabel="Create Chart. Map the path from here."
        onPress={onOpenChart}
        disabled={!onOpenChart}
        style={({ pressed }) => [styles.container, pressed && onOpenChart ? styles.pressed : null]}
      >
        <View style={styles.kickerRow}><Text style={styles.kicker}>YOUR CHART</Text></View>
        <View style={styles.route}>
          <ChartPreview
            width={mapWidth}
            category={category}
            window={CHART_WINDOWS.home}
            showRoute={false}
            testID="v2-home-chart-map"
            style={{ alignSelf: 'center' }}
          />
        </View>
        <Text style={styles.waypointTitle}>Map the path from here.</Text>
        <View style={styles.link}>
          <Text style={styles.linkText}>Create Chart</Text>
          <ArrowRight color={colors.graphite.text.tertiary} />
        </View>
      </Pressable>
    );
  }

  if (chart.state === 'loading') {
    return (
      <View testID="v2-home-chart-loading" style={styles.container}>
        <Text style={styles.kicker}>CHART</Text>
        <View style={styles.skeletonGroup}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonCopy]} />
        </View>
      </View>
    );
  }

  if (chart.state === 'error') {
    return (
      <View testID="v2-home-chart-error" style={styles.container}>
        <Text style={styles.kicker}>CHART</Text>
        <Text style={styles.errorCopy}>{chart.message}</Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Chart" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const current = chart.waypoints.find((waypoint) => waypoint.isCurrent) ?? null;
  const markers: ChartMarker[] = chart.waypoints.map((waypoint, index) => ({
    id: waypoint.id,
    number: index + 1,
    state: waypoint.reached ? 'completed' : waypoint.isCurrent ? 'current' : 'upcoming',
    accessibilityLabel: waypoint.title,
  }));
  const travelled = chart.waypointCount > 0 ? Math.min(1, chart.reachedCount / chart.waypointCount) : 0;

  return (
    <Pressable
      testID={testID ?? 'v2-home-chart'}
      accessibilityRole="button"
      accessibilityLabel={
        current
          ? `Open Chart. Waypoint ${(chart.currentWaypointIndex ?? 0) + 1} of ${chart.waypointCount}: ${current.title}. Toward: ${chart.destinationText}.${chart.nextMove ? ` One Move: ${chart.nextMove}` : ''}`
          : chart.isFinished
            ? `Open Chart. Destination reached: ${chart.destinationText}.`
            : 'Open Chart'
      }
      onPress={onOpenChart}
      disabled={!onOpenChart}
      style={({ pressed }) => [styles.container, pressed && onOpenChart ? styles.pressed : null]}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>YOUR CHART</Text>
      </View>

      <View style={styles.route}>
        <ChartPreview
          width={mapWidth}
          category={category}
          window={CHART_WINDOWS.home}
          showRoute={chart.waypointCount > 0}
          markers={markers}
          travelledFraction={travelled}
          testID="v2-home-chart-map"
          style={{ alignSelf: 'center' }}
        />
      </View>

      {current ? (
        <View style={styles.waypointBlock}>
          <Text style={styles.waypointLabel}>{chart.isFinished ? 'DESTINATION REACHED' : `WAYPOINT ${(chart.currentWaypointIndex ?? 0) + 1} OF ${chart.waypointCount}`}</Text>
          <Text testID="v2-home-chart-waypoint" style={styles.waypointTitle}>
            {current.title}
          </Text>
          <Text testID="v2-home-chart-destination" style={styles.toward}>Toward: {chart.destinationText}</Text>
        </View>
      ) : chart.isFinished ? (
        <View style={styles.waypointBlock}>
          <Text style={styles.waypointLabel}>DESTINATION REACHED</Text>
          <Text testID="v2-home-chart-destination" style={styles.waypointTitle}>{chart.destinationText}</Text>
        </View>
      ) : chart.waypointCount === 0 ? (
        <View style={styles.waypointBlock}>
          <Text style={styles.waypointTitle}>{chart.destinationText}</Text>
        </View>
      ) : null}

      {chart.nextMove ? (
        <View style={styles.waypointBlock}>
          <Text style={styles.waypointLabel}>ONE MOVE</Text>
          <Text testID="v2-home-chart-one-move" style={styles.oneMove}>
            {chart.nextMove}
          </Text>
        </View>
      ) : null}

      <View style={styles.link}>
        <Text style={styles.linkText}>Open Chart</Text>
        <ArrowRight color={colors.graphite.text.tertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.graphite.text.tertiary,
  },
  route: { height: 154, overflow: 'hidden', marginTop: 8, marginBottom: 8 },
  waypointBlock: {
    marginTop: 16,
  },
  waypointLabel: {
    fontFamily: typography.bodyBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.graphite.text.tertiary,
  },
  waypointTitle: {
    fontFamily: typography.bodySemiBold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.graphite.text.primary,
    marginTop: 4,
  },
  toward: {
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.graphite.text.tertiary,
    marginTop: 3,
  },
  oneMove: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  linkText: {
    fontFamily: typography.bodyMedium,
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
