import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  MAP_H, MAP_W,
  type ChartMapAnimState, type ChartMapMarker, type RouteTable, type WaypointPlacement,
} from './chartMapContracts';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { ChartMapLand } from './ChartMapLand';
import { ChartMapMarkers } from './ChartMapMarkers';
import { ChartMapOverlay } from './ChartMapOverlay';

export type ChartMapProps = {
  width: number;
  table: RouteTable;
  placement: WaypointPlacement;
  anim: ChartMapAnimState;
  markers: ChartMapMarker[];
  categoryColor: string;
  /** Category name (for AA-safe numeral colour); falls back to contrast-picking from categoryColor. */
  category?: string;
  /** false = static map: markers are non-pressable images. Default true. */
  interactive?: boolean;
  reducedMotion: boolean;
  arrived: boolean;
  onMarkerPress: (index: number) => void;
  onMapPress: () => void;
  testID?: string;
};

/**
 * The treasure map: land canvas + overlay canvas + RN marker layer, all under
 * one camera derived from anim.camera. A tap anywhere that is not a marker
 * calls onMapPress. Height = width * MAP_H / MAP_W.
 */
export const ChartMap = memo(function ChartMap({
  width, table, placement, anim, markers, categoryColor, category, interactive = true, reducedMotion, arrived, onMarkerPress, onMapPress, testID,
}: ChartMapProps) {
  const height = (width * MAP_H) / MAP_W;
  const fade = useAnimatedStyle(() => ({ opacity: anim.mapOpacity.value }));

  return (
    <View testID={testID} style={[styles.root, { width, height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, fade]}>
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Canvas style={{ width, height }}>
            <ChartMapLand width={width} height={height} anim={anim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} />
          </Canvas>
        </View>
        {/* DEFERRED: separate static grain canvas (normal blend); grain is now a cached multiply image inside the land canvas. */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Canvas style={{ width, height }}>
            <ChartMapOverlay
              width={width}
              height={height}
              anim={anim}
              table={table}
              placement={placement}
              categoryColor={categoryColor}
              reducedMotion={reducedMotion}
              arrived={arrived}
            />
          </Canvas>
        </View>
        <Pressable
          testID={testID ? `${testID}-surface` : 'chart-map-surface'}
          accessible={false}
          importantForAccessibility="no"
          onPress={onMapPress}
          style={StyleSheet.absoluteFill}
        />
        <ChartMapMarkers
          width={width}
          height={height}
          anim={anim}
          placement={placement}
          markers={markers}
          categoryColor={categoryColor}
          category={category}
          interactive={interactive}
          arrived={arrived}
          onMarkerPress={onMarkerPress}
        />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
});
