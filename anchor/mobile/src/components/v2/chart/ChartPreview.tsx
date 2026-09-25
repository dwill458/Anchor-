import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { cancelAnimation, useSharedValue } from 'react-native-reanimated';
import { useV2ReduceMotion } from '@/hooks/v2/useV2ReduceMotion';
import { ChartLandscape, ROUTE_REVEAL_END, type ChartMarker } from './ChartLandscape';
import { CHART_EASING, CHART_PROGRESS_TIMING, chartTiming } from './chartMotion';
import type { ChartWindow } from './chartRouteGeometry';

type Props = {
  width: number;
  category?: string | null;
  window: ChartWindow;
  markers?: ChartMarker[];
  travelledFraction?: number;
  showRoute?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/** Shared Home/Details snapshot motion: a brief, reduced-motion-aware route reveal. */
export function ChartPreview({
  width,
  category,
  window,
  markers = [],
  travelledFraction = 0,
  showRoute = true,
  testID,
  accessibilityLabel,
  style,
}: Props) {
  const reduceMotion = useV2ReduceMotion();
  const routeReveal = useSharedValue(reduceMotion || !showRoute ? 1 : 0);

  useEffect(() => {
    if (!showRoute) {
      routeReveal.value = 1;
      return undefined;
    }
    if (reduceMotion) {
      routeReveal.value = 1;
      return undefined;
    }
    routeReveal.value = 0;
    routeReveal.value = chartTiming(ROUTE_REVEAL_END, {
      duration: Math.min(680, CHART_PROGRESS_TIMING.entryRoute),
      easing: CHART_EASING.draw,
    });
    return () => cancelAnimation(routeReveal);
  }, [reduceMotion, routeReveal, showRoute]);

  return (
    <ChartLandscape
      width={width}
      category={category}
      window={window}
      showRoute={showRoute}
      markers={markers}
      travelledFraction={travelledFraction}
      routeReveal={showRoute ? routeReveal : undefined}
      markersFollowRoute={showRoute}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}
