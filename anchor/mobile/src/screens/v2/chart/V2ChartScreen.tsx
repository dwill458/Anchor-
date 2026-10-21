import React, { useCallback, useEffect, useRef, useState } from 'react';
// DEFERRED: import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChartActiveView, type ChartCelebration } from '@/components/v2/chart/ChartActiveView';
import { ChartInkButton, ChartInkScreen, ChartTopBar } from '@/components/v2/chart/ChartChrome';
import { ChartCreationFlow } from '@/components/v2/chart/ChartCreationFlow';
import { ChartDestinationReached } from '@/components/v2/chart/ChartDestinationReached';
import { ChartRevealHandoff } from '@/components/v2/chart/ChartRevealHandoff';
import { ChartWeatherHold } from '@/components/v2/chart/map/ChartWeatherHold';
import { ChartMapHeader } from '@/components/v2/chart/panel/ChartMapHeader';
import { panelAccent } from '@/components/v2/chart/panel/chartPanelColors';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import type { ChartRequestError } from '@/services/v2/chartV2Api';
import { useChartContext } from './chartScreenSupport';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import revenueCatService from '@/services/RevenueCatService';
// DEFERRED: import { ChartJourneyWorld } from '@/components/v2/chart/ChartJourneyWorld';
import { ChartStaticMap } from '@/components/v2/chart/panel/ChartStaticMap';
import { queueMilestoneAction } from '@/milestones/queueMilestoneAction';

export interface V2ChartRouteParams {
  anchorId?: string;
  /** Legacy entry points pass a Course id; the Anchor is authoritative. */
  courseId?: string;
  /** Set by the waypoint screen after a real, server-confirmed reach. */
  reached?: { completedTitle: string; nextTitle: string | null; reachedCount: number; total: number; destinationReached: boolean };
  source?: string;
  /** Development only: a one-shot opening replay from the DEV toolbar. Cleared once the opening starts. */
  introReplayMode?: 'full' | 'short';
}

export interface V2ChartScreenProps {
  anchorId?: string;
  initialWaypointId?: string | null;
  onBack?: () => void;
  testID?: string;
}

function errorTitle(error: ChartRequestError | null): string {
  if (!error) return CHART_COPY.errors.load;
  if (error.kind === 'offline') return CHART_COPY.errors.offline;
  // 'unavailable' covers a backend without Chart yet and a server that is down.
  if (error.kind === 'disabled' || error.kind === 'unavailable') return CHART_COPY.errors.disabled;
  if (error.kind === 'not_found') return CHART_COPY.errors.missingAnchor;
  return CHART_COPY.errors.load;
}

function errorSupport(error: ChartRequestError | null): string {
  if (error?.kind === 'disabled' || error?.kind === 'unavailable') return CHART_COPY.errors.disabledSupport;
  if (error?.kind === 'not_found') return '';
  return CHART_COPY.errors.loadSupport;
}

export function actionErrorCopy(error: ChartRequestError | null): string | null {
  if (!error) return null;
  if (error.kind === 'offline') return CHART_COPY.errors.offline;
  return CHART_COPY.errors.action;
}

export function V2ChartScreen(props: V2ChartScreenProps) {
  const { width } = useWindowDimensions();
  const route = useRoute<RouteProp<Record<string, V2ChartRouteParams>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = props.anchorId ?? route.params?.anchorId ?? '';
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  // Saved Charts remain available after expiry. A new Chart requires a
  // hydrated RevenueCat entitlement before its creation flow can mount.
  const { entitlementReady, hasActiveEntitlement } = useTrialStatus();
  const creationLocked = !entitlementReady || !hasActiveEntitlement;
  const [celebration, setCelebration] = useState<ChartCelebration | null>(null);
  const [spatialFocused, setSpatialFocused] = useState(Boolean(props.initialWaypointId));
  // The creation flow stays on screen through its reveal ("Your route is
  // ready.") even though the saved Chart is already in the shared cache.
  const [revealing, setRevealing] = useState(false);
  // "Explore your Chart": the permanent Chart mounts under the creation flow, which fades once the Chart has drawn.
  const [handingOff, setHandingOff] = useState(false);
  // "Explore your Chart" continues into the permanent Chart without replaying the map.
  const arrivedFromReveal = useRef(false);
  const opened = useRef(false);
  const paywallOpened = useRef(false);
  const [entitlementRefreshAttempt, setEntitlementRefreshAttempt] = useState(0);

  useEffect(() => {
    if (!opened.current && anchorId) {
      opened.current = true;
      trackChart('chart_opened', { source: route.params?.source ?? 'direct' });
    }
  }, [anchorId, route.params?.source]);

  // Returning from a waypoint the server confirmed as reached: play the travel once.
  const reachedParam = route.params?.reached;
  const handledReached = useRef<unknown>(null);
  useEffect(() => {
    if (!reachedParam || handledReached.current === reachedParam) return;
    handledReached.current = reachedParam;
    setCelebration({
        completedTitle: reachedParam.completedTitle,
        nextTitle: reachedParam.nextTitle,
        fromFraction: reachedParam.total > 0 ? Math.max(0, (reachedParam.reachedCount - 1) / reachedParam.total) : 0,
    });
    navigation.setParams({ reached: undefined });
  }, [navigation, reachedParam]);

  // Re-read on focus so completions made elsewhere (Home, Practice) show here.
  const refresh = chart.refresh;
  const hasData = Boolean(chart.data);
  // Keep the focus callback stable while letting it see the latest error. If
  // an initial read failed before any Chart was cached, reopening this screen
  // must retry rather than leave the old unavailable message in place.
  const shouldRefreshOnFocus = useRef(false);
  const milestoneBoundaryActive = useRef(true);
  shouldRefreshOnFocus.current = hasData || Boolean(chart.error);
  useFocusEffect(
    useCallback(() => {
      milestoneBoundaryActive.current = true;
      if (shouldRefreshOnFocus.current) void refresh();
      return () => { milestoneBoundaryActive.current = false; };
    }, [refresh])
  );

  const handleBack = () => {
    if (props.onBack) props.onBack();
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('V2DevelopmentHome');
  };

  useEffect(() => {
    // DEFERRED: hard cut on push/pop: navigation.setOptions?.({ gestureEnabled: !spatialFocused, animation: 'none' });
    navigation.setOptions?.({ gestureEnabled: !spatialFocused });
  }, [navigation, spatialFocused]);

  const openVision = () => {
    trackChart('chart_vision_opened', { from: 'chart' });
    navigation.navigate('V2Vision', { anchorId });
  };

  const openPaywall = () => {
    trackChart('chart_paywall_opened', { from: 'chart' });
    navigation.replace('V2Paywall', { context: 'CHART', resumeIntent: { type: 'open_chart', anchorId } });
  };

  const entitlementRefreshStarted = useRef(false);
  useEffect(() => {
    if (entitlementReady || entitlementRefreshStarted.current) return;
    entitlementRefreshStarted.current = true;
    void revenueCatService.refreshTrialStatus().finally(() => {
      entitlementRefreshStarted.current = false;
    });
  }, [entitlementReady, entitlementRefreshAttempt]);

  useEffect(() => {
    if (chart.loading || chart.error || !chart.data || chart.data.chart || !entitlementReady || hasActiveEntitlement || paywallOpened.current) return;
    paywallOpened.current = true;
    if (chart.data.history.length > 0) {
      navigation.replace('V2ChartJourney', { anchorId });
      return;
    }
    trackChart('chart_paywall_opened', { from: route.params?.source ?? 'create_chart' });
    navigation.replace('V2Paywall', { context: 'CHART', resumeIntent: { type: 'open_chart', anchorId } });
  }, [anchorId, chart.data, chart.error, chart.loading, entitlementReady, hasActiveEntitlement, navigation, route.params?.source]);

  const openPractice = (mode?: 'focus' | 'deep_prime') => {
    trackChart('chart_practice_opened', { from: 'chart', mode: mode ?? null });
    navigation.navigate('V2Practice', { anchorId, recommendedMode: mode, source: 'chart', returnRoute: 'V2Chart' });
  };

  if (!anchorId) {
    return (
      <ChartInkScreen testID="v2-chart-screen-missing">
        <ChartTopBar title={CHART_COPY.title} onBack={handleBack} />
        <CenteredMessage title={CHART_COPY.errors.missingAnchor} />
      </ChartInkScreen>
    );
  }

  if (chart.loading && !chart.data) {
    // Closed weather, not a spinner: when the data lands the map mounts under the same cloud cover and the clouds part.
    // DEFERRED: <ChartInkScreen testID="v2-chart-screen-loading"><ChartTopBar ... /><ActivityIndicator accessibilityLabel="Opening your Chart" /></ChartInkScreen>
    const category = context.identity?.category ?? null;
    return (
      <ChartWeatherHold
        testID="v2-chart-screen-loading"
        accessibilityLabel="Opening your Chart"
        reducedMotion={reducedMotion}
        header={
          <ChartMapHeader
            categoryLabel={(category ?? 'custom').toUpperCase()}
            category={category}
            accent={panelAccent(category)}
            visionImageUrl={context.vision?.imageUrl ?? null}
            hasVision={Boolean(context.vision)}
            onBack={handleBack}
            onOpenVision={openVision}
          />
        }
      />
    );
  }

  if (chart.error && !chart.data) {
    return (
      <ChartInkScreen testID="v2-chart-screen-error">
        <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={context.identity} />
        <CenteredMessage
          title={errorTitle(chart.error)}
          support={errorSupport(chart.error)}
          action={chart.error.kind === 'not_found' ? undefined : { label: CHART_COPY.errors.retry, onPress: () => void chart.refresh() }}
        />
      </ChartInkScreen>
    );
  }

  const data = chart.data;
  const identity = context.identity ?? {
    intention: data?.anchor.intentionText ?? '',
    category: data?.anchor.category ?? null,
  };
  const view = chart.view;

  const canShowActive = Boolean(data && view && !data.anchor.released && view.total > 0);
  const renderActive = () => {
    if (!data || !view) return null;
    return (
      <ChartActiveView
        view={view}
        identity={identity}
        anchorArt={context.anchorArt}
        vision={context.vision}
        stale={chart.stale}
        busyKey={chart.busy}
        reducedMotion={reducedMotion}
        celebration={celebration}
        onCelebrationDone={() => setCelebration(null)}
        onMilestoneBoundary={(waypointId) => {
          if (data.chart?.id) void queueMilestoneAction(anchorId, { kind: 'chart', sourceEntityId: data.chart.id, eventId: waypointId }, () => milestoneBoundaryActive.current);
        }}
        onBack={handleBack}
        chartActions={chart}
        course={data.chart ?? undefined}
        initialWaypointId={props.initialWaypointId}
        onSpatialModeChange={setSpatialFocused}
        onWaypointReached={(result, previousReachedCount, total) => {
          if (!result.destinationReached) {
            setCelebration({
              completedTitle: result.completedTitle,
              nextTitle: result.nextTitle,
              fromFraction: total > 0 ? previousReachedCount / total : 0,
            });
          }
        }}
        onCompleteMove={async (moveId) => {
          chart.clearLastError();
          return chart.completeMove(moveId);
        }}
        onOpenVision={openVision}
        onOpenPractice={openPractice}
        onOpenLog={() => navigation.navigate('V2ChartJourney', { anchorId })}
        onAdjust={() => navigation.navigate('V2ChartAdjust', { anchorId })}
        onRelease={() => view.isStretch ? navigation.navigate('V2ChartAdjust', { anchorId }) : navigation.navigate('V2Release', { anchorId, reason: 'destination_completed' })}
        actionError={actionErrorCopy(chart.lastError)}
        entrance={arrivedFromReveal.current ? 'reveal' : 'open'}
        testID={props.testID ?? 'v2-chart-screen'}
      />
    );
  };

  // DEFERRED: if (!data || !view || revealing) {
  if (!data || !view || revealing || handingOff) {
    if (data?.anchor.released && !revealing && !handingOff) {
      return (
        <ChartInkScreen testID="v2-chart-screen-released">
          <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={identity} />
          <CenteredMessage title={CHART_COPY.errors.released} support={CHART_COPY.errors.releasedSupport} />
        </ChartInkScreen>
      );
    }
    if (creationLocked && !revealing && !handingOff) {
      return (
        <ChartInkScreen testID={entitlementReady ? 'v2-chart-screen-premium-gate' : 'v2-chart-screen-entitlement-loading'}>
          <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={identity} />
          <CenteredMessage
            title={entitlementReady ? 'Opening Anchor Pro' : 'Checking subscription access'}
            action={!entitlementReady ? { label: 'Try again', onPress: () => setEntitlementRefreshAttempt((attempt) => attempt + 1) } : undefined}
          />
        </ChartInkScreen>
      );
    }
    // The creation flow and the permanent Chart share one host, each in a fixed slot, so neither remounts.
    return (
      <ChartRevealHandoff
        testID="v2-chart-handoff"
        reducedMotion={reducedMotion}
        releasing={handingOff}
        onReleased={() => setHandingOff(false)}
        under={handingOff && canShowActive ? renderActive() : null}
        over={
          <ChartCreationFlow
            anchorId={anchorId}
            identity={identity}
            anchorArt={context.anchorArt}
            introReplayMode={__DEV__ ? route.params?.introReplayMode : undefined}
            onIntroStarted={route.params?.introReplayMode ? () => navigation.setParams({ introReplayMode: undefined }) : undefined}
            vision={context.vision}
            reducedMotion={reducedMotion}
            onBack={handleBack}
            onOpenVision={openVision}
            onPremiumRequired={openPaywall}
            onCreated={(created) => {
              setRevealing(true);
              chart.commitChart(created);
            }}
            onExplore={() => {
              arrivedFromReveal.current = true;
              setHandingOff(true);
              setRevealing(false);
              void chart.refresh();
            }}
            testID="v2-chart-screen-empty"
          />
        }
      />
    );
  }

  if (view.total === 0 && !data.anchor.released) {
    return <ChartInkScreen testID="v2-chart-screen-no-waypoints">
      <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={identity} />
      {/*
      // DEFERRED: <ChartJourneyWorld width={width} height={220} />
      */}
      <View style={styles.emptyMap}>
        <ChartStaticMap width={width} categoryColor={getCategoryColor(identity.category)} category={identity.category} mode="empty" waypointCount={1} reducedMotion={reducedMotion} testID="chart-empty-map" />
      </View>
      <CenteredMessage title="Add the first waypoint to your Chart." action={{ label:'Add waypoints',onPress:()=>navigation.navigate('V2ChartAdjust',{anchorId}) }} />
    </ChartInkScreen>;
  }

  if (data.anchor.released) {
    return (
      <ChartDestinationReached
        view={view}
        identity={identity}
        anchorArt={context.anchorArt}
        vision={context.vision}
        released={data.anchor.released}
        reducedMotion={reducedMotion}
        onBack={handleBack}
        onViewJourney={() => navigation.navigate('V2ChartJourney', { anchorId })}
        onRelease={() => view.isStretch ? navigation.navigate('V2ChartAdjust', { anchorId }) : navigation.navigate('V2Release', { anchorId, reason: 'destination_completed' })}
        testID="v2-chart-screen-reached"
      />
    );
  }

  // DEFERRED: the active Chart rendered at the root; it now keeps the hand-off host's lower slot, where it
  // mounted under the creation flow, so finishing the hand-off never remounts it.
  return (
    <ChartRevealHandoff
      testID="v2-chart-handoff"
      reducedMotion={reducedMotion}
      releasing={false}
      onReleased={noop}
      under={renderActive()}
    />
  );
}

function noop() {
  return undefined;
}

export function CenteredMessage({
  title,
  support,
  action,
}: {
  title: string;
  support?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {support ? <Text style={styles.support}>{support}</Text> : null}
      {action ? <ChartInkButton label={action.label} onPress={action.onPress} style={styles.action} testID="chart-retry" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyMap: { height: 220, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  title: { ...typography.headingLG, color: colors.ink.text.primary, textAlign: 'center' },
  support: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing[3] },
});
