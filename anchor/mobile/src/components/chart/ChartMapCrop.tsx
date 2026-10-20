import React, { memo, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getCategoryColor } from '@/theme/v2';
import { ChartMap } from '@/components/v2/chart/map/ChartMap';
import { MAP_H, MAP_W, type ChartMapMarker } from '@/components/v2/chart/map/chartMapContracts';
import { buildRouteTable, waypointPlacement } from '@/components/v2/chart/map/chartMapGeometry';
import { useChartMapAnimState } from '@/components/v2/chart/map/useChartMapAnimState';
import { CHART_MAP_TOKENS } from '@/components/v2/chart/map/chartMapTokens';
import { ChartWeatherVeilPrimer } from '@/components/v2/chart/map/ChartWeatherNativeVeil';
import type { ChartPreviewData } from '@/hooks/useChartPreview';

const table = buildRouteTable();
const noop = () => undefined;

/** Reuses the etched map introduced in 663ce64e, including its category tint,
 * fog field, brush route, dotted future route and registered waypoint positions. */
export const ChartMapCrop = memo(function ChartMapCrop({ data, full, coverArc, weatherComplete, height: viewportHeight, initialWidth = 320, waypoints }: {
  data: Pick<ChartPreviewData, 'category' | 'status' | 'waypointIndex' | 'waypointTotal' | 'title'>;
  full: boolean;
  coverArc?: number;
  weatherComplete?: boolean;
  height?: number;
  initialWidth?: number;
  waypoints?: ReadonlyArray<{ id: string; title: string; reached: boolean; isCurrent: boolean }>;
}) {
  const [width, setWidth] = useState(initialWidth);
  const placement = useMemo(() => waypointPlacement(Math.max(1, data.waypointTotal)), [data.waypointTotal]);
  const index = Math.max(0, Math.min(placement.n - 1, data.waypointIndex - 1));
  const anim = useChartMapAnimState({ revealArc: placement.arcs[index], flagIndex: index });
  const arrived = data.status === 'complete';
  useLayoutEffect(() => {
    anim.revealArc.value = arrived ? table.total : data.waypointIndex > 0 ? placement.arcs[index] : 0;
    anim.coverArc.value = coverArc ?? (arrived ? table.total : data.waypointIndex > 0 ? placement.arcs[index] : 0);
    anim.flagIndex.value = index;
    anim.flagOpacity.value = arrived || data.waypointIndex === 0 ? 0 : 1;
    anim.fog.value = (weatherComplete ?? arrived) ? 1 : 0;
    anim.glyph.value = arrived ? 1 : 0;
    anim.goldDot.value = arrived ? 1 : 0;
  }, [anim, arrived, coverArc, data.waypointIndex, index, placement, weatherComplete]);
  const markers = useMemo<ChartMapMarker[]>(() => Array.from({ length: data.waypointTotal }, (_, i) => ({
    id: waypoints?.[i]?.id ?? `preview-waypoint-${i + 1}`, index: i, number: i + 1,
    title: waypoints?.[i]?.title ?? (i === index ? data.title : `Waypoint ${i + 1}`),
    state: waypoints?.[i]?.reached ? 'done' : waypoints?.[i]?.isCurrent ? 'current'
      : waypoints ? 'upcoming' : arrived ? 'done' : i + 1 === data.waypointIndex ? 'current' : 'upcoming',
    selected: !arrived && (waypoints?.[i]?.isCurrent ?? (i + 1 === data.waypointIndex)),
    accessibilityLabel: `Waypoint ${i + 1} of ${data.waypointTotal}`,
  })), [arrived, data.title, data.waypointIndex, data.waypointTotal, index, waypoints]);
  const mapHeight = width * MAP_H / MAP_W;
  const height = full ? mapHeight : viewportHeight ?? width * 9 / 16;
  const activeY = placement.points[index].y * width / MAP_W;
  // Compact cards leave room below the active flag for the title and progress.
  const top = full ? 0 : Math.max(0, Math.min(mapHeight - height, activeY - height * (viewportHeight ? 0.42 : 0.5)));
  return <View testID="chart-map-crop" pointerEvents="none" accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={[styles.crop, { height }]}
    onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setWidth(next); }}>
    <View testID="chart-preview-map-offset" style={{ position: 'absolute', top: top === 0 ? 0 : -top }}>
      <ChartMap testID="chart-preview-etched-map" width={width} table={table} placement={placement}
        anim={anim} markers={markers} categoryColor={getCategoryColor(data.category)}
        category={data.category ?? undefined} interactive={false} reducedMotion arrived={arrived} clouds weather="textured"
        onMarkerPress={noop} onMapPress={noop} weatherComplete={weatherComplete} />
    </View>
    {/* Invisible: keeps the Chart's cloud bitmaps decoded, so opening this Chart shows its weather on frame one. */}
    <ChartWeatherVeilPrimer />
  </View>;
});

const styles = StyleSheet.create({
  crop: { overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
});
