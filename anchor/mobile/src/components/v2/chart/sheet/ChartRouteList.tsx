import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { ChartViewModel, ChartWaypointView } from '@/adapters/v2/chart/chartV2Model';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import type { HighWaterMap, WaypointProgressInput } from '../map/chartMapContracts';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { chartSegmentFractions } from './ChartRouteSegments';

type Props = {
  view: ChartViewModel;
  inputs?: WaypointProgressInput[];
  hw?: HighWaterMap;
  color: string;
  /** Selects a waypoint on the map (the sheet's existing waypoint focus). Never raises or lowers the sheet. */
  viewWaypoint: (index: number) => void;
  /** The existing reach action for the current waypoint (opens its confirmation). Absent: the button stays disabled. */
  onReach?: () => void;
  reachBusy?: boolean;
  reachError?: string | null;
  /** Label for the reach button ("Mark destination reached" on the last waypoint). */
  reachLabel?: string;
};

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** One row per waypoint id; the first of any repeated id wins. Index stays the position in `view.waypoints`. */
function uniqueRows(waypoints: ChartWaypointView[]) {
  const seen = new Set<string>();
  const rows: Array<{ waypoint: ChartWaypointView; index: number }> = [];
  waypoints.forEach((waypoint, index) => {
    if (seen.has(waypoint.id)) return;
    seen.add(waypoint.id);
    rows.push({ waypoint, index });
  });
  return rows;
}

export function ChartRouteList({ view, inputs, hw, color, viewWaypoint, onReach, reachBusy = false, reachError = null, reachLabel }: Props) {
  const fractions = chartSegmentFractions(view, inputs, hw);
  const rows = useMemo(() => uniqueRows(view.waypoints), [view.waypoints]);
  const currentIndex = view.waypoints.findIndex(waypoint => waypoint.state === 'current');
  const [open, setOpen] = useState(currentIndex);
  // A new current waypoint (after a reach, or another course) reopens on the new current row.
  useEffect(() => { setOpen(currentIndex); }, [currentIndex, view.courseId]);

  const press = (index: number) => {
    setOpen(previous => (previous === index && index !== currentIndex ? -1 : index));
    viewWaypoint(index);
  };

  return <View testID="chart-route-list">
    <Text accessibilityRole="header" style={styles.heading}>{CHART_COPY.sheet.routeHeading}</Text>
    {rows.map(({ waypoint, index }, position) => {
      const reached = waypoint.state === 'completed';
      const current = waypoint.state === 'current';
      const isOpen = open === index;
      const last = position === rows.length - 1;
      const date = waypoint.reachedAt ? new Date(waypoint.reachedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const meta = reached && date ? CHART_COPY.sheet.reachedOn.replace('{date}', date) : current ? `${Math.round(fractions[index] * 100)}%` : '';
      const criteria = waypoint.completionCriteria?.trim() || null;
      const undone = waypoint.moves.filter(move => move.status !== 'COMPLETED');
      const nextId = (view.oneMove && undone.some(move => move.id === view.oneMove!.id) ? view.oneMove.id : undone[0]?.id) ?? null;
      const left = undone.length;
      const canReach = current && left === 0 && Boolean(onReach) && !reachBusy;
      const label = reachLabel ?? 'Mark waypoint reached';
      return <View key={waypoint.id} style={styles.item} testID={`chart-route-item-${index}`}>
        {!last ? <View style={[styles.connector, current && { backgroundColor: color }]} /> : null}
        <View style={[styles.dot, { borderColor: reached || current ? color : T.muted, backgroundColor: reached ? color : T.ink, borderStyle: reached || current ? 'solid' : 'dashed' }]}>
          {reached ? <Check size={14} color={T.ink} strokeWidth={3} /> : <Text style={styles.number}>{waypoint.number}</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Waypoint ${waypoint.number}: ${waypoint.title}`} accessibilityState={{ expanded: isOpen }} onPress={() => press(index)} style={styles.head} testID={`chart-route-row-${index}`}>
          <Text style={[styles.title, current && styles.titleCurrent, !reached && !current && { color: T.muted }]}>{waypoint.title}</Text>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </Pressable>
        {isOpen ? <View style={styles.body} testID={`chart-route-body-${index}`}>
          {criteria ? <Text style={styles.reach} testID={`chart-route-reached-when-${index}`}><Text style={styles.reachLabel}>{CHART_COPY.sheet.reachedWhenLabel}</Text> {lowerFirst(criteria)}</Text> : null}
          {current ? <>
            {waypoint.moves.length ? <View style={styles.moves} testID="chart-route-moves">
              {waypoint.moves.map(move => {
                const done = move.status === 'COMPLETED';
                const next = move.id === nextId;
                return <View key={move.id} style={styles.move} testID={`chart-route-move-${move.id}`}>
                  <View style={[styles.moveDot, done && styles.moveDotDone, next && !done && { borderColor: color }]}>{done ? <Check size={11} color={T.ink} strokeWidth={3} /> : null}</View>
                  <Text style={[styles.moveTitle, done && styles.moveDone]}>{move.title}</Text>
                  {next && !done ? <Text style={[styles.nextTag, { color }]}>{CHART_COPY.sheet.next}</Text> : null}
                </View>;
              })}
            </View> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: !canReach, busy: reachBusy }}
              disabled={!canReach}
              onPress={onReach}
              style={[styles.reachButton, canReach ? styles.reachReady : styles.reachDisabled]}
              testID="chart-route-reach"
            >
              <Text style={[styles.reachButtonText, canReach && styles.reachButtonTextReady]}>{label}</Text>
              <Text style={[styles.reachHint, canReach && styles.reachHintReady]}>{left === 0 ? CHART_COPY.sheet.ready : (left === 1 ? CHART_COPY.sheet.movesLeftOne : CHART_COPY.sheet.movesLeftMany).replace('{n}', String(left))}</Text>
            </Pressable>
            {reachError ? <Text accessibilityLiveRegion="polite" style={styles.error} testID="chart-reach-error">{reachError}</Text> : null}
          </> : null}
        </View> : null}
      </View>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  heading: { fontFamily: T.serif, fontSize: 24, color: T.light, marginBottom: 12 },
  item: { position: 'relative', paddingLeft: 44 },
  connector: { position: 'absolute', left: 15, top: 36, bottom: -4, width: 2, backgroundColor: '#2A3440' },
  dot: { position: 'absolute', left: 0, top: 7, width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: T.sansStrong, fontSize: 13, color: T.light },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  title: { flex: 1, minWidth: 0, fontFamily: T.sans, fontSize: 15, lineHeight: 20, color: T.light },
  titleCurrent: { fontFamily: T.sansStrong },
  meta: { fontFamily: T.sans, fontSize: 12, color: T.muted },
  body: { paddingBottom: 18, gap: 10 },
  reach: { fontFamily: T.sans, fontSize: 14, lineHeight: 20, color: T.muted },
  reachLabel: { fontFamily: T.sansStrong, color: T.light },
  moves: { gap: 2 },
  move: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#5A6380', alignItems: 'center', justifyContent: 'center' },
  moveDotDone: { backgroundColor: T.muted, borderColor: T.muted },
  moveTitle: { flex: 1, minWidth: 0, fontFamily: T.sans, fontSize: 15, lineHeight: 20, color: T.light },
  moveDone: { color: T.muted, textDecorationLine: 'line-through' },
  nextTag: { fontFamily: T.sansStrong, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  reachButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  reachDisabled: { borderColor: T.line, backgroundColor: T.panel, opacity: 0.6 },
  reachReady: { borderColor: T.light, backgroundColor: T.light },
  reachButtonText: { flexShrink: 1, fontFamily: T.sansStrong, fontSize: 15, lineHeight: 20, color: T.light },
  reachButtonTextReady: { color: T.ink },
  reachHint: { fontFamily: T.sans, fontSize: 13, color: T.muted },
  reachHintReady: { color: '#4B4F60' },
  error: { fontFamily: T.sans, fontSize: 13, lineHeight: 18, color: '#E7A19C' },
});
