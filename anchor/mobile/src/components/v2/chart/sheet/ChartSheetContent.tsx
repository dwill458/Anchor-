import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartWaypointContent, type ChartWaypointContentProps, type ChartWaypointTiers } from '../ChartWaypointContent';
import { ChartPanelDensity } from '../panel/ChartPanelCards';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { CHART_PANEL_COPY as COPY } from '../map/chartRhythm';
import { panelAccent } from '../panel/chartPanelColors';
import { ChartSheetGrabZone, ChartSheetScrollArea, ChartSheetTier } from './ChartSheet';
import { ChartRouteSegments } from './ChartRouteSegments';
import { ChartRouteList } from './ChartRouteList';

type Props = ChartWaypointContentProps & {
  stale?: boolean; stillRight?: React.ReactNode; viewWaypoint: (index: number) => void;
  isContentLocked: () => boolean; swapRevision: number;
};

/** The handler/modal owner and all three tier frames survive a content swap. */
const Content = memo(function Content({ snapshot }: { snapshot: Props }) {
  const accent = panelAccent(snapshot.category);
  const compose = useCallback((parts: ChartWaypointTiers) => {
    const state = snapshot.arrived ? CHART_COPY.sheet.stateReached : parts.waypoint.state === 'current' ? CHART_COPY.sheet.stateCurrent : parts.waypoint.state === 'completed' ? CHART_COPY.sheet.stateReached : CHART_COPY.sheet.stateUpcoming;
    const eyebrow = CHART_COPY.sheet.eyebrow.replace('{n}', String(parts.waypoint.number)).replace('{N}', String(snapshot.view.total)).replace('{state}', state);
    return <View style={styles.root} testID={parts.isCurrent && !snapshot.arrived ? 'chart-current-waypoint' : 'chart-panel-body'}>
      <ChartSheetGrabZone><View style={styles.peek} testID="chart-sheet-peek">
        <View style={styles.row}><Text style={[styles.eyebrow, { color: parts.isCurrent ? accent.text : T.muted }]} numberOfLines={1}>{eyebrow}</Text>{parts.isCurrent && parts.value ? <Text style={styles.value} numberOfLines={1}>{parts.value}</Text> : null}</View>
        {snapshot.stale ? <Text style={styles.offline} testID="chart-offline">{CHART_COPY.active.offline}</Text> : null}
        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{snapshot.arrived ? COPY.arrivedTitle : parts.waypoint.title}</Text>
        <ChartPanelDensity.Provider value="peek">{parts.peek}</ChartPanelDensity.Provider>
      </View></ChartSheetGrabZone>
      <ChartSheetScrollArea>
        <ChartSheetTier tier="half">
          {snapshot.stillRight}
          {parts.isCurrent ? <ChartRouteSegments view={snapshot.view} inputs={snapshot.inputs} hw={snapshot.hw} color={accent.text} reducedMotion={snapshot.reducedMotion} /> : null}
          {parts.half}
          {parts.edit}
        </ChartSheetTier>
        <ChartSheetTier tier="full">
          <ChartRouteList view={snapshot.view} inputs={snapshot.inputs} hw={snapshot.hw} color={accent.text} viewWaypoint={snapshot.viewWaypoint} />
          {parts.full}
        </ChartSheetTier>
      </ChartSheetScrollArea>
    </View>;
  }, [snapshot, accent.text]);
  return <ChartWaypointContent {...snapshot} renderTiers={compose} />;
});

export function ChartSheetContent(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [snapshot, setSnapshot] = useState(props);
  const revision = useRef(props.swapRevision);
  const opacity = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);
  useLayoutEffect(() => {
    const allowedStep = revision.current !== props.swapRevision;
    revision.current = props.swapRevision;
    if (props.isContentLocked() && !allowedStep) return;
    const changed = snapshot.view !== props.view || snapshot.waypointId !== props.waypointId || snapshot.commit !== props.commit || snapshot.arrived !== props.arrived || snapshot.dayClosedHold !== props.dayClosedHold;
    if (!changed) {
      // Busy/error/modal actions use fresh callbacks without swapping the content frame.
      if (!pending.current) setSnapshot(props);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    pending.current = true;
    opacity.value = withTiming(0, { duration: 120, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    timer.current = setTimeout(() => {
      // A request may start during fade-out. Keep the queued content for its next permitted call/onEnd.
      if (latest.current.isContentLocked() && !allowedStep) { pending.current = false; opacity.value = withTiming(1, { duration: 160, easing: Easing.linear, reduceMotion: ReduceMotion.Never }); return; }
      setSnapshot(props);
      pending.current = false;
      opacity.value = withTiming(1, { duration: props.reducedMotion ? 180 : 160, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    }, 120);
    // Snapshot changes finish this effect; only incoming data/call steps start it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view, props.waypointId, props.chart.busy, props.actionError, props.commit, props.arrived, props.dayClosedHold, props.swapRevision, props.stale, props.stillRight, props.inputs, props.hw, props.practiced, props.vision]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.root, style]} testID="chart-sheet-content"><Content snapshot={snapshot} /></Animated.View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, peek: { height: 134, gap: 2 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, eyebrow: { flexShrink: 1, fontFamily: T.sansStrong, fontSize: 11, lineHeight: 18 }, value: { fontFamily: T.sansStrong, fontSize: 11, color: T.light, maxWidth: '40%' }, title: { fontFamily: T.serif, fontSize: 24, lineHeight: 26, color: T.light }, offline: { fontFamily: T.sans, fontSize: 10, lineHeight: 12, color: T.muted } });
