import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, getCategoryColor, spacing } from '@/theme/v2';
import { ChartJourneyWorld } from '@/components/v2/chart/ChartJourneyWorld';
import type { ChartMarker } from '@/components/v2/chart/ChartLandscape';
import { ROAD_TABLE, getCameraTransform, getPointAtNormalizedDistance, getRoadParallax,
  getWaypointRoutePositions, getNodeVisualScale, worldToViewport } from '@/components/v2/chart/chartJourneyGeometry';
import type { ChartPreviewData } from '@/hooks/useChartPreview';

/** Uses the current Chart's registered artwork, road and camera, centered on the
 * selected waypoint. Category comes exclusively from the preview selection. */
export function ChartMapCrop({ data, full }: { data: ChartPreviewData; full: boolean }) {
  const [width, setWidth] = useState(320);
  const [ready, setReady] = useState(false);
  const height = width * (full ? 4 / 3 : 9 / 16);
  const positions = getWaypointRoutePositions(data.waypointTotal);
  const active = positions[data.waypointIndex - 1] ?? 0;
  const camera = getCameraTransform(active, { width, height });
  const offset = getRoadParallax(active);
  const point = worldToViewport(getPointAtNormalizedDistance(active), camera, offset);
  const accent = getCategoryColor(data.category);
  const markers = useMemo<ChartMarker[]>(() => Array.from({ length: data.waypointTotal }, (_, i) => ({
    id: `preview-waypoint-${i + 1}`, number: i + 1,
    state: data.status === 'complete' ? 'completed' : i + 1 === data.waypointIndex ? 'current' : 'upcoming',
    accessibilityLabel: `Waypoint ${i + 1} of ${data.waypointTotal}`,
  })), [data.status, data.waypointIndex, data.waypointTotal]);
  const nodeClearance = positions.map((position, index) => {
    const sample = getPointAtNormalizedDistance(position);
    return { ...worldToViewport(sample, camera, offset),
      radius: (data.status === 'active' && index + 1 === data.waypointIndex ? 30 : 23)
        * getNodeVisualScale(sample.depth) / 2 + spacing[1] };
  });
  const path = (from: number, to: number) => {
    let connected = false;
    return ROAD_TABLE.filter(sample => sample.distance >= from && sample.distance <= to)
      .map(sample => {
        const p = worldToViewport(sample, camera, offset);
        if (nodeClearance.some(node => Math.hypot(p.x - node.x, p.y - node.y) < node.radius)) {
          connected = false;
          return '';
        }
        const command = connected ? 'L' : 'M';
        connected = true;
        return `${command}${p.x},${p.y}`;
      }).join(' ');
  };
  return (
    <View testID="chart-map-crop" pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={[styles.crop, { height }]}
      onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0) setWidth(next); }}>
      {/* Reset the static camera with its viewport so native worklets and the SVG
          overlay cannot retain different transforms after a waypoint change. */}
      <ChartJourneyWorld key={`${active}:${width}:${height}`} width={width} height={height} staticProgress={active} markers={markers}
        category={data.category} onReady={setReady} />
      {ready ? <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path testID="chart-preview-dotted-route" d={path(0, 1)} stroke={colors.ink.text.secondary}
          strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" fill="none" />
        {data.status === 'active' && data.waypointIndex > 0 ? <>
          <Circle testID="chart-preview-active-region" cx={point.x} cy={point.y}
            r={spacing[7]} fill="none" stroke={accent} strokeWidth={spacing[1]} opacity={0.3} />
          <Path testID="chart-preview-active-route" d={path(Math.max(0, active - 0.045), Math.min(1, active + 0.045))}
            stroke={accent} strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" fill="none" />
        </> : null}
      </Svg> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  crop: { overflow: 'hidden', backgroundColor: colors.ink.deep },
});
