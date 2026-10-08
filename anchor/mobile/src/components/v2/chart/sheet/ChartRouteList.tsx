import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChartViewModel } from '@/adapters/v2/chart/chartV2Model';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { HighWaterMap, WaypointProgressInput } from '../map/chartMapContracts';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { chartSegmentFractions } from './ChartRouteSegments';

export function ChartRouteList({ view, inputs, hw, color, viewWaypoint }: { view: ChartViewModel; inputs?: WaypointProgressInput[]; hw?: HighWaterMap; color: string; viewWaypoint: (index: number) => void }) {
  const fractions = chartSegmentFractions(view, inputs, hw);
  return <View testID="chart-route-list">
    <Text accessibilityRole="header" style={styles.heading}>{CHART_COPY.sheet.routeHeading}</Text>
    {view.waypoints.map((waypoint, index) => {
      const reached = waypoint.state === 'completed';
      const current = waypoint.state === 'current';
      const date = waypoint.reachedAt ? new Date(waypoint.reachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const meta = reached && date ? CHART_COPY.sheet.reachedOn.replace('{date}', date) : current ? `${Math.round(fractions[index] * 100)}%` : '';
      return <Pressable key={waypoint.id} accessibilityRole="button" accessibilityLabel={`Waypoint ${waypoint.number}: ${waypoint.title}`} onPress={() => viewWaypoint(index)} style={styles.row} testID={`chart-route-row-${index}`}>
        <View style={styles.dotColumn}>{index < view.total - 1 ? <View style={styles.connector} /> : null}<View style={[styles.dot, { borderColor: reached || current ? color : T.muted, backgroundColor: reached ? color : T.ink, borderStyle: reached || current ? 'solid' : 'dashed' }]}><Text style={[styles.number, { color: reached ? T.ink : T.light }]}>{waypoint.number}</Text></View></View>
        <Text style={[styles.title, !reached && !current && { color: T.muted }]} numberOfLines={2}>{waypoint.title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({ heading: { fontFamily: T.serif, fontSize: 24, color: T.light, marginBottom: 12 }, row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 }, dotColumn: { width: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }, dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, connector: { position: 'absolute', width: 2, top: '50%', bottom: -30, backgroundColor: '#2A3440' }, number: { fontFamily: T.sansStrong, fontSize: 11 }, title: { flex: 1, fontFamily: T.sans, fontSize: 14, color: T.light }, meta: { fontFamily: T.sans, fontSize: 11, color: T.muted } });
