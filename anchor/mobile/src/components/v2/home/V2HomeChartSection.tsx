import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeChartState } from '@/adapters/v2/home';

type Props = {
  chart: HomeChartState;
  categoryColor?: string;
  onOpenChart?: () => void;
  onCreateChart?: () => void;
  onRetry?: () => void | Promise<void>;
};

function ChartStarSvg({ done }: { done: boolean }) {
  return (
    <Svg width={38} height={42} viewBox="0 0 52 58" fill="none" accessibilityElementsHidden>
      <Path d="M26 3L25 9M42 8L37 14M49 25L42 26M8 10L12 16M2 28L10 29M16 46L12 51M45 44L49 49" stroke="#F9A733" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M26 14L32 26L45 28L35 37L37 51L25 44L13 50L16 36L6 27L20 26Z" fill="#F9A72F" />
      <Path d="M26 18L28 31L39 30L29 36L31 45L24 39L16 44L21 34L13 30L24 31Z" fill="#FFC257" opacity={0.75} />
      {done ? <Path d="m17 31 7 7 13-15" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

function MiniRouteRibbon({
  waypoints,
  accentColor = '#3157D8',
}: {
  waypoints: NonNullable<Extract<HomeChartState, { state: 'ready' }>['waypoints']>;
  accentColor?: string;
}) {
  if (waypoints.length === 0) return null;
  const completed = waypoints.filter((waypoint) => waypoint.reached).length;
  const currentIndex = waypoints.findIndex((waypoint) => waypoint.isCurrent);
  const progressIndex = currentIndex >= 0 ? currentIndex : completed === waypoints.length ? waypoints.length - 1 : Math.max(0, completed - 1);
  const strokePercent = waypoints.length > 1 ? Math.min(100, Math.max(0, (progressIndex / (waypoints.length - 1)) * 100)) : completed > 0 ? 100 : 0;
  const routeWidth = Math.max(320, waypoints.length * 76);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ minWidth: routeWidth }} accessibilityLabel="Chart waypoints">
      <View style={[styles.routeContainer, { width: routeWidth }]}>
        <Svg width="100%" height={54} viewBox="0 0 320 54" preserveAspectRatio="none" style={styles.ribbonSvg} accessibilityElementsHidden>
          <Defs>
            <LinearGradient id="homeRouteGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#58C9C3" />
              <Stop offset="50%" stopColor={accentColor} />
              <Stop offset="100%" stopColor="#D8D4CE" />
            </LinearGradient>
          </Defs>
          <Path d="M16 35C57 5 74 54 112 34S171 13 205 28S266 47 305 19" stroke="#E4E0D8" strokeWidth={6} strokeDasharray="9 7" strokeLinecap="round" fill="none" />
          <Path d="M16 35C57 5 74 54 112 34S171 13 205 28S266 47 305 19" stroke="url(#homeRouteGradient)" strokeWidth={7} strokeDasharray={`${(strokePercent * 3.1).toFixed(0)} 400`} strokeLinecap="round" fill="none" />
          <Path d="M16 33C57 3 74 52 112 32S171 11 205 26" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
        </Svg>

        <View style={styles.waypointsRow}>
          {waypoints.map((waypoint, index) => (
            <View key={waypoint.id} style={styles.waypointCol}>
              <View style={styles.symbolHolder}>
                {waypoint.isDestination ? (
                  <ChartStarSvg done={waypoint.reached} />
                ) : waypoint.reached ? (
                  <View style={styles.nodeDone}><Text style={styles.doneCheck}>✓</Text></View>
                ) : waypoint.isCurrent ? (
                  <View style={styles.nodeCurrentOuter}><View style={styles.nodeCurrentInner} /></View>
                ) : (
                  <View style={styles.nodeUpcoming} />
                )}
              </View>
              <Text numberOfLines={2} style={[styles.waypointTitle, waypoint.isCurrent && styles.waypointTitleCurrent]}>{waypoint.title}</Text>
              <Text style={styles.waypointNum}>{index + 1} · waypoint</Text>
              {waypoint.isCurrent ? <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>CURRENT</Text></View> : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

/** Home Chart preview, driven entirely by the active CourseDetail. */
export function V2HomeChartSection({ chart, categoryColor, onOpenChart, onRetry }: Props) {
  if (chart.state === 'none') return null;

  if (chart.state === 'loading' || chart.state === 'error') {
    return (
      <View testID={`v2-home-chart-${chart.state}`} style={styles.statusContainer}>
        <Text style={styles.statusLabel}>{chart.state === 'loading' ? 'CHART' : 'CHART UNAVAILABLE'}</Text>
        {chart.state === 'loading' ? <Text style={styles.statusCopy}>Loading your current Course…</Text> : <Text numberOfLines={2} style={styles.statusCopy}>{chart.message}</Text>}
        {chart.state === 'error' && onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Retry Chart" onPress={onRetry}><Text style={styles.retry}>Retry</Text></Pressable> : null}
      </View>
    );
  }

  return (
    <View testID="v2-home-chart" style={styles.container}>
      <View style={styles.card}>
        <View style={styles.heading}>
          <Text style={styles.kicker}>NEXT ON YOUR CHART <Text style={styles.kickerStar}>✦</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="View Chart" onPress={onOpenChart} style={({ pressed }) => [styles.viewChartLink, pressed && styles.pressed]}>
            <Text style={styles.viewChartText}>View Chart</Text><Text style={styles.viewChartChevron}>›</Text>
          </Pressable>
        </View>
        <Text style={styles.destination}>{chart.destinationText}</Text>
        {chart.nextMove ? <Text style={styles.description}>{chart.nextMove}</Text> : null}
        <Text style={styles.waypointCount}>{chart.reachedCount} of {chart.waypointCount} waypoints</Text>
        <MiniRouteRibbon waypoints={chart.waypoints} accentColor={categoryColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 12, marginTop: 14 },
  statusContainer: { marginHorizontal: 22, marginTop: 14, minHeight: 54, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#DAD6CD', backgroundColor: '#FBF9F4', flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLabel: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, color: '#8054DC' },
  statusCopy: { flex: 1, fontFamily: typography.utility.fontFamily, fontSize: 12, lineHeight: 17, color: '#62738B' },
  retry: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 12, color: '#3157D8' },
  card: { paddingVertical: 16, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#FBF9F4', borderWidth: 1, borderColor: '#EBE5DA', shadowColor: '#5C5130', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  kicker: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, color: '#8054DC', textTransform: 'uppercase' },
  kickerStar: { color: '#F28A2E', fontSize: 13 },
  viewChartLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6 },
  viewChartText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 11.5, fontWeight: '600', color: '#647188' },
  viewChartChevron: { fontSize: 16, lineHeight: 14, color: '#647188', fontWeight: '600' },
  destination: { fontFamily: typography.displayBold, fontSize: 23, lineHeight: 27, letterSpacing: -0.7, color: colors.text.primary, marginTop: 9 },
  description: { fontFamily: typography.utility.fontFamily, fontSize: 13, lineHeight: 18, color: '#62738B', marginTop: 5, maxWidth: 300 },
  waypointCount: { fontFamily: typography.utilityMedium.fontFamily, fontSize: 12, color: '#3D51A0', marginTop: 12, marginBottom: 4 },
  routeContainer: { minHeight: 118, position: 'relative', marginTop: 8 },
  ribbonSvg: { position: 'absolute', top: 0, left: 0, right: 0 },
  waypointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 },
  waypointCol: { flex: 1, alignItems: 'center', minWidth: 68, paddingHorizontal: 3 },
  symbolHolder: { height: 57, width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  nodeDone: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#227889', alignItems: 'center', justifyContent: 'center' },
  doneCheck: { color: '#56E2CD', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  nodeCurrentOuter: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3157F6', borderWidth: 4, borderColor: '#B7C8FE', alignItems: 'center', justifyContent: 'center' },
  nodeCurrentInner: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  nodeUpcoming: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: '#BFC0BB', backgroundColor: '#FBF9F4' },
  waypointTitle: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 10.5, lineHeight: 13, fontWeight: '600', color: colors.text.primary, textAlign: 'center', minHeight: 26 },
  waypointTitleCurrent: { fontWeight: '800', color: '#334BE4' },
  waypointNum: { fontFamily: typography.utility.fontFamily, fontSize: 9.5, lineHeight: 13, color: '#60718A', textAlign: 'center' },
  currentBadge: { backgroundColor: '#E9E3FF', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, marginTop: 4 },
  currentBadgeText: { fontFamily: typography.utilitySemibold.fontFamily, fontSize: 8, fontWeight: '700', letterSpacing: 0.2, color: '#334BE4' },
  pressed: { opacity: 0.75 },
});
