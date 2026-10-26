import React, { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { ChartWaypointContent, type ChartWaypointContentProps, type ChartWaypointTiers } from '../ChartWaypointContent';
import { ChartPanelDensity } from '../panel/ChartPanelCards';
import { CHART_MAP_TOKENS as T } from '../map/chartMapTokens';
import { CHART_PANEL_COPY as COPY } from '../map/chartRhythm';
import { panelAccent } from '../panel/chartPanelColors';
import { ChartSheetGrabZone, ChartSheetScrollArea, ChartSheetTier, type ChartSheetViewport } from './ChartSheet';
import { ChartRouteSegments } from './ChartRouteSegments';
import { ChartRouteList } from './ChartRouteList';
import { ChartSheetHelpRow } from './ChartSheetHelpRow';
import { ChartSheetAnchorCard } from './ChartSheetAnchorCard';
import type { ChartAnchorArt } from '../ChartLandscape';

type Props = ChartWaypointContentProps & {
  stale?: boolean; stillRight?: React.ReactNode; viewWaypoint: (index: number) => void;
  isContentLocked: () => boolean; swapRevision: number;
  onReplayTeaching?: () => void;
  scrollViewportRef?: React.Ref<ChartSheetViewport>;
  onScrollViewportLayout?: () => void;
  onContentApplied?: (showingCommit: boolean) => void;
  anchorArt?: ChartAnchorArt | null;
  onOpenAnchor?: () => void;
  onAskChart?: () => void;
  /** The Anchor's stored Thread Strength (0–100), shown on the Anchor card. Display only. */
  threadStrength?: number | null;
};

/** The handler/modal owner and all three tier frames survive a content swap. */
const Content = memo(function Content({ snapshot }: { snapshot: Props }) {
  const accent = panelAccent(snapshot.category);
  const compose = useCallback((parts: ChartWaypointTiers) => {
    const showAnchorCard = parts.isCurrent && !snapshot.arrived && Boolean(snapshot.anchorArt?.svg);
    const state = snapshot.arrived ? CHART_COPY.sheet.stateReached : parts.waypoint.state === 'current' ? CHART_COPY.sheet.stateCurrent : parts.waypoint.state === 'completed' ? CHART_COPY.sheet.stateReached : CHART_COPY.sheet.stateUpcoming;
    const eyebrow = CHART_COPY.sheet.eyebrow.replace('{n}', String(parts.waypoint.number)).replace('{N}', String(snapshot.view.total)).replace('{state}', state);
    return <View style={styles.root} testID={parts.isCurrent && !snapshot.arrived ? 'chart-current-waypoint' : 'chart-panel-body'}>
      <ChartSheetGrabZone><View style={styles.peek} testID="chart-sheet-peek">
        <View style={styles.row}>
          <Text style={[styles.eyebrow, { color: parts.isCurrent ? accent.text : T.muted }]}>{eyebrow}</Text>
          <View style={styles.actions}>
            {parts.edit}
            {parts.isCurrent && snapshot.onReplayTeaching ? <Pressable accessibilityRole="button" accessibilityLabel={CHART_COPY.sheet.teachingHelp} onPress={snapshot.onReplayTeaching} hitSlop={8} style={styles.help}><Text style={styles.helpText}>?</Text></Pressable> : null}
          </View>
        </View>
        {parts.isCurrent && parts.value && !parts.oneMove ? <Text style={styles.value}>{parts.value}</Text> : null}
        {snapshot.stale ? <Text style={styles.offline} testID="chart-offline">{CHART_COPY.active.offline}</Text> : null}
        <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>{snapshot.arrived ? COPY.arrivedTitle : parts.waypoint.title}</Text>
        <ChartPanelDensity.Provider value="peek">{parts.peek}</ChartPanelDensity.Provider>
      </View></ChartSheetGrabZone>
      <ChartSheetScrollArea viewportRef={snapshot.scrollViewportRef} onLayout={snapshot.onScrollViewportLayout}>
        <View style={styles.moveStack} onLayout={snapshot.onScrollViewportLayout}>
          <ChartPanelDensity.Provider value="peek">{parts.completionNotice}</ChartPanelDensity.Provider>
          {parts.oneMove}
        </View>
        <ChartSheetTier tier="half">
          {snapshot.stillRight}
          {showAnchorCard ? <ChartSheetAnchorCard category={snapshot.category} anchorArt={snapshot.anchorArt!} threadStrength={snapshot.threadStrength ?? null} practiced={parts.practiced} onOpenAnchor={snapshot.onOpenAnchor} onOpenPractice={snapshot.onOpenPractice} /> : null}
          {parts.isCurrent && !snapshot.arrived ? <ChartSheetHelpRow category={snapshot.category} onAskChart={snapshot.onAskChart} /> : null}
          {parts.isCurrent ? <ChartRouteSegments view={snapshot.view} inputs={snapshot.inputs} hw={snapshot.hw} color={accent.text} reducedMotion={snapshot.reducedMotion} /> : null}
          {parts.half}
          {/* DEFERRED: the pencil sat alone under the route segments; it now lives in the header row beside the ? button. */}
        </ChartSheetTier>
        <ChartSheetTier tier="full">
          <ChartRouteList view={snapshot.view} inputs={snapshot.inputs} hw={snapshot.hw} color={accent.text} viewWaypoint={snapshot.viewWaypoint} onReach={parts.requestReach} reachBusy={parts.reachBusy} reachError={parts.reachError} reachLabel={parts.waypoint.isDestination ? COPY.ctaMarkDestination : COPY.ctaMark} />
          {parts.full}
        </ChartSheetTier>
      </ChartSheetScrollArea>
    </View>;
  }, [snapshot, accent.text]);
  return <ChartWaypointContent {...snapshot} hidePracticeRow={Boolean(snapshot.anchorArt?.svg)} renderTiers={compose} />;
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
    if (props.isContentLocked() && !allowedStep) return;
    const changed = snapshot.view !== props.view || snapshot.waypointId !== props.waypointId || snapshot.commit !== props.commit || snapshot.arrived !== props.arrived || snapshot.dayClosedHold !== props.dayClosedHold;
    if (!changed) {
      // Busy/error/modal actions use fresh callbacks without swapping the content frame.
      if (!pending.current) { revision.current = props.swapRevision; setSnapshot(props); }
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    pending.current = true;
    opacity.value = withTiming(0, { duration: 120, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    timer.current = setTimeout(() => {
      // A request may start during fade-out. Keep the queued content for its next permitted call/onEnd.
      if (latest.current.isContentLocked() && !allowedStep) { pending.current = false; opacity.value = withTiming(1, { duration: 160, easing: Easing.linear, reduceMotion: ReduceMotion.Never }); return; }
      // Consume the permission only after the frame applies. A render during fade-out may
      // replace this timer; it must retain the pending sequence/dismissal boundary.
      revision.current = props.swapRevision;
      setSnapshot(props);
      pending.current = false;
      opacity.value = withTiming(1, { duration: props.reducedMotion ? 180 : 160, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    }, 120);
    // Snapshot changes finish this effect; only incoming data/call steps start it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view, props.waypointId, props.chart.busy, props.actionError, props.commit, props.arrived, props.dayClosedHold, props.swapRevision, props.stale, props.stillRight, props.inputs, props.hw, props.practiced, props.vision]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { latest.current.onContentApplied?.(Boolean(snapshot.commit)); }, [snapshot]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.root, style]} testID="chart-sheet-content"><Content snapshot={snapshot} /></Animated.View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, moveStack: { gap: 12 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, peek: { gap: 2, paddingBottom: 12, flexShrink: 0 }, row: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, eyebrow: { flex: 1, flexShrink: 1, fontFamily: T.sansStrong, fontSize: 11, lineHeight: 16 }, help: { width: 26, height: 26, borderWidth: 1, borderColor: 'rgba(239,234,223,.28)', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, helpText: { color: T.muted, fontFamily: T.sansStrong, fontSize: 14 }, value: { alignSelf: 'flex-start', fontFamily: T.sansStrong, fontSize: 11, lineHeight: 14, color: T.light, flexWrap: 'wrap' }, title: { fontFamily: T.serif, fontSize: 24, lineHeight: 26, color: T.light }, offline: { fontFamily: T.sans, fontSize: 10, lineHeight: 12, color: T.muted } });
