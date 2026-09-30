import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { HomeChartState } from '@/adapters/v2/home/chartAdapter';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { ChartJourneyWorld } from './ChartJourneyWorld';
import { getJourneyRouteProgress } from './chartJourneyGeometry';
import type { ChartMarker } from './ChartLandscape';
import { chartArtFor, pointAt, routePathData, toFramePoint, waypointFractions } from './chartRouteGeometry';

type Props = {
  chart: Extract<HomeChartState, { state: 'ready' }>;
  width: number;
  category?: string | null;
  variant?: 'home' | 'details';
  onPress?: () => void;
  testID?: string;
};

/** Shared read-only Chart world, retaining canonical art, route and nodes.
 * The camera window is explicit so a future transition can use this frame.
 * Copy flows below the route instead of covering nodes or clipping long Moves. */
export const ChartWorldPreview = memo(function ChartWorldPreview({ chart, width, category, variant = 'home', onPress, testID = 'v2-home-chart' }: Props) {
  const current = chart.waypoints.find(waypoint => waypoint.isCurrent);
  const markers = useMemo<ChartMarker[]>(() => chart.waypoints.map((waypoint, index) => ({
    id: waypoint.id, number: index + 1, accessibilityLabel: waypoint.title,
    state: waypoint.reached || (variant === 'details' && waypoint.state === 'SKIPPED') ? 'completed' : waypoint.isCurrent ? 'current' : 'upcoming',
  })), [chart.waypoints, variant]);
  const fractions = waypointFractions(chart.waypoints.length);
  const art = chartArtFor(category);
  // Details matches the Vision board's 0.6 aspect height; the compact copy overlays the image.
  const mapHeight = variant === 'home' ? Math.min(230, width * 0.6) : width * 0.6;
  const homeRouteHeight = Math.min(84, Math.max(68, width * 0.19));
  const routePoints = Array.from({ length: 49 }, (_, index) => pointAt(index / 48, art));
  const minY = Math.min(...routePoints.map(point => point.y));
  const maxY = Math.max(...routePoints.map(point => point.y));
  const homeFrame = { width, imageHeight: homeRouteHeight / Math.max(0.01, maxY - minY), window: { top: minY, bottom: maxY }, height: homeRouteHeight };
  const route = chart.waypointCount > 0 ? routePathData(homeFrame, art) : '';
  const travelled = chart.waypointCount > 0
    ? Math.min(1, chart.isFinished ? 1 : (chart.reachedCount + 1) / chart.waypointCount)
    : 0;
  const traveledRoute = travelled > 0 ? routePathData(homeFrame, art, 0, travelled) : '';
  const accent = getCategoryColor(category ?? 'custom');
  const label = current
    ? variant === 'home'
      ? `Open Chart. Waypoint ${(chart.currentWaypointIndex ?? 0) + 1} of ${chart.waypointCount}: ${current.title}.${chart.nextMove ? ` Next move: ${chart.nextMove}` : ''}`
      : `Open Chart. Waypoint ${(chart.currentWaypointIndex ?? 0) + 1} of ${chart.waypointCount}: ${current.title}. Toward: ${chart.destinationText}.${chart.nextMove ? ` Next move: ${chart.nextMove}` : ''}`
    : chart.isFinished ? `Chart complete. Destination: ${chart.destinationText}. Open Chart.` : `Open Chart. Destination: ${chart.destinationText}.`;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress}
      style={({ pressed }) => [styles.frame, pressed && styles.pressed]}>
      {variant === 'home' ? (
        <View testID="v2-home-chart-map" pointerEvents="none" style={[styles.instrument, { height: homeRouteHeight }]}>
          <Svg testID="v2-home-chart-route" width={width} height={homeRouteHeight} viewBox={`0 0 ${width} ${homeRouteHeight}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d={`M0 ${homeRouteHeight * 0.28} C${width * 0.18} ${homeRouteHeight * 0.08} ${width * 0.28} ${homeRouteHeight * 0.44} ${width * 0.48} ${homeRouteHeight * 0.25} S${width * 0.78} ${homeRouteHeight * 0.08} ${width} ${homeRouteHeight * 0.34}`} stroke="rgba(222, 213, 196, 0.08)" strokeWidth={0.8} fill="none" />
            <Path d={`M0 ${homeRouteHeight * 0.78} C${width * 0.2} ${homeRouteHeight * 0.57} ${width * 0.35} ${homeRouteHeight * 0.92} ${width * 0.58} ${homeRouteHeight * 0.68} S${width * 0.84} ${homeRouteHeight * 0.55} ${width} ${homeRouteHeight * 0.78}`} stroke="rgba(222, 213, 196, 0.07)" strokeWidth={0.8} fill="none" />
            <Path d={route} stroke="rgba(242, 230, 203, 0.72)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {traveledRoute ? <Path d={traveledRoute} stroke="#F2E6CB" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
            {chart.waypoints.map((waypoint, index) => {
              const point = toFramePoint(pointAt(fractions[index] ?? 1, art), homeFrame);
              const currentNode = waypoint.isCurrent;
              const destination = waypoint.isDestination;
              const radius = currentNode ? 9 : destination ? 5 : 4.2;
              return <React.Fragment key={waypoint.id}>
                {currentNode ? <Circle cx={point.x} cy={point.y} r={14} fill={accent} opacity={0.14} /> : null}
                <Circle cx={point.x} cy={point.y} r={radius} fill={waypoint.reached ? '#F2E6CB' : colors.ink.deep} stroke={currentNode ? accent : '#E8DDC8'} strokeWidth={currentNode ? 2 : 1.4} />
                {currentNode ? <Circle cx={point.x} cy={point.y} r={2.6} fill={accent} /> : null}
                {destination ? <>
                  <Path d={`M${point.x} ${point.y - 5}v-12l11 2.5-11 2.5`} stroke="#E8DDC8" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </> : null}
              </React.Fragment>;
            })}
          </Svg>
        </View>
      ) : (
        <View pointerEvents="none" style={{ height: mapHeight, overflow: 'hidden' }}>
          <ChartJourneyWorld width={width} height={mapHeight} category={category} markers={markers}
            staticProgress={getJourneyRouteProgress(chart.waypointCount, chart.currentWaypointIndex ?? -1, chart.journeyMetricFraction, chart.journeyConfirmedComplete === true)}
            testID="v2-details-chart-map" />
          <LinearGradient colors={['transparent', colors.ink.deep]} style={styles.scrim} />
        </View>
      )}
      <View style={[styles.copy, variant === 'home' ? styles.homeCopy : styles.detailsCopy]}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.eyebrow}>{chart.isFinished ? 'DESTINATION REACHED' : current ? `WAYPOINT ${(chart.currentWaypointIndex ?? 0) + 1} OF ${chart.waypointCount}` : 'YOUR DESTINATION'}</Text>
            <Text testID={current ? 'v2-home-chart-waypoint' : 'v2-home-chart-destination'} numberOfLines={variant === 'details' ? 2 : undefined} style={[styles.title, variant === 'details' && styles.detailsTitle]}>{current?.title ?? chart.destinationText}</Text>
          </View>
          <View style={styles.arrow}><ChevronRight size={22} color={colors.text.inverse} /></View>
        </View>
        {chart.nextMove && variant === 'home' ? <View style={[styles.move, styles.homeMove]}>
          <Text style={styles.moveLabel}>Next move</Text>
          <Text testID="v2-home-chart-one-move" style={styles.moveText}>{chart.nextMove}</Text>
        </View> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.ink.deep, borderWidth: 1, borderColor: colors.graphite.hairline },
  instrument: { justifyContent: 'center', overflow: 'hidden' },
  scrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110 },
  copy: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2 },
  homeCopy: { paddingBottom: 10, paddingTop: 0 },
  detailsCopy: { position:'absolute',left:0,right:0,bottom:0,paddingTop:12,paddingBottom:12 },
  detailsTitle: { fontSize:16,lineHeight:20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: 'Figtree-SemiBold', fontSize: 10, letterSpacing: 0.8, color: colors.graphite.text.secondary },
  title: { fontFamily: 'BricolageGrotesque-SemiBold', fontSize: 19, lineHeight: 24, marginTop: 4, color: colors.text.inverse },
  destination: { fontFamily: 'Figtree-Regular', fontSize: 12, lineHeight: 17, marginTop: 3, color: colors.graphite.text.secondary },
  arrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.graphite.hairlineStrong, justifyContent: 'center', alignItems: 'center' },
  move: { marginTop: 8 },
  homeMove: { marginTop: 4 },
  moveLabel: { fontFamily: 'Figtree-SemiBold', fontSize: 13, color: '#E0A038' },
  moveText: { fontFamily: 'Figtree-Regular', fontSize: 13, lineHeight: 18, color: colors.graphite.text.primary, marginTop: 2 },
  pressed: { opacity: 0.88 },
});
