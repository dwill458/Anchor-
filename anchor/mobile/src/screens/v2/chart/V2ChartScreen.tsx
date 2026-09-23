import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChartActiveView, type ChartCelebration } from '@/components/v2/chart/ChartActiveView';
import { ChartInkButton, ChartInkScreen, ChartTopBar } from '@/components/v2/chart/ChartChrome';
import { ChartCreationFlow } from '@/components/v2/chart/ChartCreationFlow';
import { ChartDestinationReached } from '@/components/v2/chart/ChartDestinationReached';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { colors, spacing, typography } from '@/theme/v2';
import type { ChartRequestError } from '@/services/v2/chartV2Api';
import { useChartContext } from './chartScreenSupport';

export interface V2ChartRouteParams {
  anchorId?: string;
  /** Legacy entry points pass a Course id; the Anchor is authoritative. */
  courseId?: string;
  /** Set by the waypoint screen after a real, server-confirmed reach. */
  reached?: { completedTitle: string; nextTitle: string | null; reachedCount: number; total: number; destinationReached: boolean };
  source?: string;
}

export interface V2ChartScreenProps {
  anchorId?: string;
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
  const route = useRoute<RouteProp<Record<string, V2ChartRouteParams>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = props.anchorId ?? route.params?.anchorId ?? '';
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const [celebration, setCelebration] = useState<ChartCelebration | null>(null);
  // The creation flow stays on screen through its reveal ("Your route is
  // ready.") even though the saved Chart is already in the shared cache.
  const [revealing, setRevealing] = useState(false);
  const opened = useRef(false);

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
    if (!reachedParam.destinationReached) {
      setCelebration({
        completedTitle: reachedParam.completedTitle,
        nextTitle: reachedParam.nextTitle,
        fromFraction: reachedParam.total > 0 ? Math.max(0, (reachedParam.reachedCount - 1) / reachedParam.total) : 0,
      });
    }
    navigation.setParams({ reached: undefined });
  }, [navigation, reachedParam]);

  // Re-read on focus so completions made elsewhere (Home, Practice) show here.
  const refresh = chart.refresh;
  const hasData = Boolean(chart.data);
  useFocusEffect(
    useCallback(() => {
      if (hasData) void refresh();
    }, [hasData, refresh])
  );

  const handleBack = () => {
    if (props.onBack) props.onBack();
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('V2DevelopmentHome');
  };

  const openVision = () => {
    trackChart('chart_vision_opened', { from: 'chart' });
    navigation.navigate('V2Vision', { anchorId });
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
    return (
      <ChartInkScreen testID="v2-chart-screen-loading">
        <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={context.identity} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink.text.secondary} accessibilityLabel="Opening your Chart" />
        </View>
      </ChartInkScreen>
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

  if (!data || !view || revealing) {
    if (data?.anchor.released && !revealing) {
      return (
        <ChartInkScreen testID="v2-chart-screen-released">
          <ChartTopBar title={CHART_COPY.title} onBack={handleBack} identity={identity} />
          <CenteredMessage title={CHART_COPY.errors.released} support={CHART_COPY.errors.releasedSupport} />
        </ChartInkScreen>
      );
    }
    return (
      <ChartCreationFlow
        anchorId={anchorId}
        identity={identity}
        anchorArt={context.anchorArt}
        vision={context.vision}
        reducedMotion={reducedMotion}
        onBack={handleBack}
        onOpenVision={openVision}
        onCreated={(created) => {
          setRevealing(true);
          chart.commitChart(created);
        }}
        onExplore={() => {
          setRevealing(false);
          void chart.refresh();
        }}
        testID="v2-chart-screen-empty"
      />
    );
  }

  if (view.isFinished || data.anchor.released) {
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
        onRelease={() => navigation.navigate('V2Release', { anchorId, reason: 'destination_completed' })}
        testID="v2-chart-screen-reached"
      />
    );
  }

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
      onBack={handleBack}
      onOpenWaypoint={(waypointId) => navigation.navigate('V2ChartWaypoint', { anchorId, waypointId })}
      onCompleteMove={async (moveId) => {
        chart.clearLastError();
        return chart.completeMove(moveId);
      }}
      onOpenVision={openVision}
      onOpenLog={() => navigation.navigate('V2ChartJourney', { anchorId })}
      onAdjust={() => navigation.navigate('V2ChartAdjust', { anchorId })}
      actionError={actionErrorCopy(chart.lastError)}
      testID={props.testID ?? 'v2-chart-screen'}
    />
  );
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[6], gap: spacing[3] },
  title: { ...typography.headingLG, color: colors.ink.text.primary, textAlign: 'center' },
  support: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing[3] },
});
