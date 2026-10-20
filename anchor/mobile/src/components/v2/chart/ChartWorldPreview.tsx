import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { HomeChartState } from '@/adapters/v2/home/chartAdapter';
import { colors, radii } from '@/theme/v2';
import { ChartMapCrop } from '@/components/chart/ChartMapCrop';
import { CHART_MAP_GOLD, CHART_MAP_TOKENS } from './map/chartMapTokens';
import { useChartWeatherCoverArc } from './map/chartPreviewWeather';

type Props = {
  chart: Extract<HomeChartState, { state: 'ready' }>;
  width: number;
  category?: string | null;
  variant?: 'home' | 'details';
  onPress?: () => void;
  testID?: string;
};

/** A static window into the same etched map and weather as Full Chart. */
export const ChartWorldPreview = memo(function ChartWorldPreview({ chart, width, category, variant = 'home', onPress, testID = 'v2-home-chart' }: Props) {
  const weatherCoverArc = useChartWeatherCoverArc(chart.weatherProgress);
  const height = variant === 'home' ? 145 : 165;
  const currentIndex = chart.waypoints.findIndex(waypoint => waypoint.isCurrent);
  // A confirmed reach may precede the server selecting the next waypoint.
  const reachedIndex = chart.waypoints.reduce((last, waypoint, index) => waypoint.reached ? index : last, -1);
  const focusIndex = chart.isFinished ? chart.waypoints.length - 1 : currentIndex >= 0 ? currentIndex : reachedIndex;
  const focus = chart.waypoints[focusIndex];
  const title = focus?.title ?? chart.destinationText;
  const data = useMemo(() => ({
    category: category ?? null,
    status: chart.isFinished ? 'complete' as const : 'active' as const,
    waypointIndex: focusIndex + 1,
    waypointTotal: chart.waypointCount,
    title,
  }), [category, chart.isFinished, chart.waypointCount, focusIndex, title]);
  const label = chart.isFinished
    ? `Chart complete. Destination: ${chart.destinationText}. Open Chart.`
    : `Open Chart. ${focus ? `Waypoint ${focusIndex + 1} of ${chart.waypointCount}: ${title}. ` : ''}Toward: ${chart.destinationText}.${chart.nextMove ? ` Next move: ${chart.nextMove}` : ''}`;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress}
      style={({ pressed }) => [styles.frame, { height }, pressed && styles.pressed]}>
      <View testID={`v2-${variant}-chart-map`} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ChartMapCrop full={false} data={data} height={height} initialWidth={width}
          waypoints={chart.waypoints} coverArc={weatherCoverArc} weatherComplete={chart.weatherProgress?.isFinished} />
      </View>
      <LinearGradient pointerEvents="none" colors={['transparent', 'rgba(10,15,20,0.72)', CHART_MAP_TOKENS.void]}
        locations={[0, 0.42, 1]} style={styles.scrim} />
      {focus && chart.waypointCount > 0 ? <Text style={styles.count}>{focusIndex + 1} of {chart.waypointCount}</Text> : null}
      <View pointerEvents="none" style={styles.copy}>
        <View style={styles.titleCopy}>
          <Text testID={focus ? 'v2-home-chart-waypoint' : 'v2-home-chart-destination'} numberOfLines={2} ellipsizeMode="tail" style={styles.title}>{title}</Text>
          {chart.waypoints.length > 0 ? <View testID="chart-preview-segments" style={styles.progress}>
            {chart.waypoints.map(waypoint => <View key={waypoint.id} testID={`chart-preview-segment-${waypoint.id}`}
              accessibilityState={{ checked: waypoint.reached, selected: waypoint.isCurrent }}
              style={[styles.segment, waypoint.reached ? styles.reached : waypoint.isCurrent ? styles.current : null]} />)}
          </View> : null}
        </View>
        <View style={styles.arrow}><ChevronRight size={22} color={colors.text.inverse} /></View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radii.lg, backgroundColor: CHART_MAP_TOKENS.paper, borderWidth: 1, borderColor: colors.graphite.hairline },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 96 },
  count: { position: 'absolute', top: 8, right: 12, fontFamily: CHART_MAP_TOKENS.sans, fontSize: 13, lineHeight: 18,
    color: CHART_MAP_TOKENS.ink, backgroundColor: 'rgba(244,241,233,0.82)', paddingHorizontal: 4, borderRadius: 4 },
  copy: { position: 'absolute', left: 14, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: CHART_MAP_TOKENS.serif, fontSize: 18, lineHeight: 21, color: colors.text.inverse },
  progress: { flexDirection: 'row', gap: 3, marginTop: 6, maxWidth: 210 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(239,234,223,0.24)' },
  reached: { backgroundColor: CHART_MAP_GOLD },
  current: { backgroundColor: 'rgba(224,160,56,0.55)' },
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(239,234,223,0.5)',
    backgroundColor: 'rgba(239,234,223,0.12)', justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.88 },
});
