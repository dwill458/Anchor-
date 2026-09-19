import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';

type Props = {
  chart: HomeChartState;
  categoryColor?: string;
  onOpenChart?: () => void;
  onRetry?: () => void | Promise<void>;
  testID?: string;
};

const ROUTE_WIDTH = 300;
const ROUTE_HEIGHT = 40;

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={17} height={11} viewBox="0 0 17 11" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M0.8 5.5H15.4M10.9 1L15.4 5.5L10.9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * An abstract contour of the route with physical character: a single thin,
 * slightly uneven line, the travelled part struck in the category accent and
 * the remainder left faint. Reached points are small filled marks and the
 * current point is one restrained ring. No ribbon, no gradient, no ornament.
 * The drift is deterministic, so the line never jitters between renders.
 */
function RouteContour({
  waypoints,
  accent,
}: {
  waypoints: NonNullable<Extract<HomeChartState, { state: 'ready' }>['waypoints']>;
  accent: string;
}) {
  if (waypoints.length === 0) return null;

  const inset = 6;
  const span = ROUTE_WIDTH - inset * 2;
  const step = waypoints.length > 1 ? span / (waypoints.length - 1) : 0;
  const drift = (index: number) => [0, -4.5, 3, -2.5, 4, -3.5][index % 6];
  const pointAt = (index: number) => ({
    x: inset + step * index,
    y: ROUTE_HEIGHT / 2 + drift(index),
  });

  const path = waypoints
    .map((_, index) => {
      const point = pointAt(index);
      if (index === 0) return 'M ' + point.x + ' ' + point.y;
      const previous = pointAt(index - 1);
      const midX = (previous.x + point.x) / 2;
      return 'C ' + midX + ' ' + previous.y + ', ' + midX + ' ' + point.y + ', ' + point.x + ' ' + point.y;
    })
    .join(' ');

  const currentIndex = waypoints.findIndex((waypoint) => waypoint.isCurrent);
  const reachedCount = waypoints.filter((waypoint) => waypoint.reached).length;
  const travelledIndex = currentIndex >= 0 ? currentIndex : reachedCount > 0 ? reachedCount - 1 : 0;
  const travelledLength = waypoints.length > 1 ? (travelledIndex / (waypoints.length - 1)) * ROUTE_WIDTH * 1.06 : 0;

  return (
    <Svg
      width="100%"
      height={ROUTE_HEIGHT}
      viewBox={'0 0 ' + ROUTE_WIDTH + ' ' + ROUTE_HEIGHT}
      preserveAspectRatio="xMidYMid meet"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={path} stroke={colors.graphite.hairlineStrong} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {travelledLength > 0 ? (
        <Path
          d={path}
          stroke={accent}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={travelledLength.toFixed(1) + ' ' + ROUTE_WIDTH * 2}
          opacity={0.85}
        />
      ) : null}
      {waypoints.map((waypoint, index) => {
        const point = pointAt(index);
        if (waypoint.isCurrent) {
          return <Circle key={waypoint.id} cx={point.x} cy={point.y} r={4.2} fill="none" stroke={accent} strokeWidth={1.8} />;
        }
        return (
          <Circle
            key={waypoint.id}
            cx={point.x}
            cy={point.y}
            r={waypoint.isDestination ? 2.8 : 2.1}
            fill={waypoint.reached ? accent : colors.graphite.hairlineStrong}
            opacity={waypoint.reached ? 0.8 : 1}
          />
        );
      })}
    </Svg>
  );
}

/**
 * Chart on Home is strictly conditional, and the absent/unknown/in-flight
 * distinction is load-bearing:
 *
 * - `none`      this Anchor has no Course. Render nothing at all: no heading,
 *               no pill, no route, no waypoint, no reserved space.
 * - `resolving` the relationship is not yet knowable. Also render nothing; an
 *               unknown relationship must never surface as "Loading…".
 * - `loading`   a Course link for THIS Anchor is known and its detail is in
 *               flight. Only this earns a visible placeholder.
 * - `error`     a known relationship failed to load. Show it and allow retry;
 *               never silently substitute fallback content.
 */
export function V2HomeChartSection({ chart, categoryColor, onOpenChart, onRetry, testID }: Props) {
  const accent = categoryColor ?? colors.semantic.info;

  if (chart.state === 'none' || chart.state === 'resolving') return null;

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

  return (
    <Pressable
      testID={testID ?? 'v2-home-chart'}
      accessibilityRole="button"
      accessibilityLabel="View Chart"
      onPress={onOpenChart}
      disabled={!onOpenChart}
      style={({ pressed }) => [styles.container, pressed && onOpenChart ? styles.pressed : null]}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>CHART</Text>
        <Text testID="v2-home-chart-progress" style={styles.progress}>
          {chart.reachedCount + ' of ' + chart.waypointCount + ' reached'}
        </Text>
      </View>

      <Text testID="v2-home-chart-destination" style={styles.destination}>
        {chart.destinationText}
      </Text>

      <View style={styles.route}>
        <RouteContour waypoints={chart.waypoints} accent={accent} />
      </View>

      {current ? (
        <View style={styles.waypointBlock}>
          <Text style={styles.waypointLabel}>CURRENT WAYPOINT</Text>
          <Text testID="v2-home-chart-waypoint" style={styles.waypointTitle}>
            {current.title}
          </Text>
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
        <Text style={styles.linkText}>View Chart</Text>
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
  progress: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  destination: {
    fontFamily: typography.displayBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: colors.graphite.text.primary,
    marginTop: 12,
  },
  route: {
    marginTop: 18,
    marginBottom: 2,
  },
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
