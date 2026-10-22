import React, { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ChartRouteUpdated } from '@/components/v2/chart/ask/ChartRouteUpdated';
import type { RouteUpdatedChange } from '@/components/v2/chart/ask/routeUpdatedCopy';
import { trackChart, useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { useChartContext } from './chartScreenSupport';

export type V2ChartRouteUpdatedParams = {
  anchorId: string;
  change: RouteUpdatedChange;
  /** Where the change was approved. Keep chatting is only offered when there is a conversation to return to. */
  source: 'ask' | 'adjust';
};

/**
 * Shown only after a change the person approved has been saved by the server. It is not a practice completion, a
 * completed move or a milestone, and it plays no celebration of progress.
 */
export function V2ChartRouteUpdatedScreen() {
  const route = useRoute<RouteProp<Record<string, V2ChartRouteUpdatedParams>, string>>();
  const navigation = useNavigation<any>();
  const { anchorId, change, source } = route.params;
  const reducedMotion = useV2ReduceMotion();
  const chart = useAnchorChart(anchorId);
  const context = useChartContext(anchorId, chart.data);
  const category = context.identity?.category ?? chart.data?.anchor.category ?? null;

  const viewChart = useCallback(() => {
    trackChart('route_updated_view_chart', { source, kind: change.kind });
    navigation.navigate('V2Chart', { anchorId });
  }, [anchorId, change.kind, navigation, source]);
  const keepChatting = useCallback(() => {
    trackChart('route_updated_keep_chatting', { kind: change.kind });
    if (navigation.canGoBack()) navigation.goBack();
  }, [change.kind, navigation]);

  return (
    <>
      <StatusBar barStyle="dark-content" animated />
      <ChartRouteUpdated
        anchorArt={context.anchorArt}
        category={category}
        change={change}
        reducedMotion={reducedMotion}
        onViewChart={viewChart}
        onKeepChatting={source === 'ask' ? keepChatting : null}
        testID="v2-chart-route-updated"
      />
    </>
  );
}
