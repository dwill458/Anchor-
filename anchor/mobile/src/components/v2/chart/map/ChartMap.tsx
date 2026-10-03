import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  MAP_H, MAP_W,
  type ChartMapAnimState, type ChartMapMarker, type RouteTable, type WaypointPlacement,
} from './chartMapContracts';
import { CHART_MAP_TOKENS } from './chartMapTokens';
import { ChartMapLand, hasDecodedChartLandscape } from './ChartMapLand';
import { ChartMapMarkers } from './ChartMapMarkers';
import { ChartMapOverlay } from './ChartMapOverlay';

export type ChartMapProps = {
  width: number;
  height?: number;
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
  /** Fog of war clouds over undiscovered ground (the permanent Chart and creation after mapping). */
  clouds?: boolean;
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
  width, height: viewportHeight, table, placement, anim, markers, categoryColor, category, interactive = true, reducedMotion, arrived, clouds = false, onMarkerPress, onMapPress, testID,
}: ChartMapProps) {
  const height = viewportHeight ?? (width * MAP_H) / MAP_W;
  const [artReady, setArtReady] = useState(hasDecodedChartLandscape);
  const onArtReady = useCallback((ready: boolean) => setArtReady(ready), []);
  // One visibility gate covers land, route, flag, and native markers.
  const fade = useAnimatedStyle(() => ({ opacity: artReady ? anim.mapOpacity.value : 0 }));

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
            <ChartMapLand width={width} height={height} anim={anim} table={table} categoryColor={categoryColor} reducedMotion={reducedMotion} clouds={clouds} onArtReady={onArtReady} />
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
            {artReady ? <ChartMapOverlay
              width={width}
              height={height}
              anim={anim}
              table={table}
              placement={placement}
              categoryColor={categoryColor}
              reducedMotion={reducedMotion}
              arrived={arrived}
              clouds={clouds}
            /> : null}
          </Canvas>
        </View>
        <Pressable
          testID={testID ? `${testID}-surface` : 'chart-map-surface'}
          accessible={false}
          importantForAccessibility="no"
          onPress={onMapPress}
          style={StyleSheet.absoluteFill}
        />
        {artReady ? <ChartMapMarkers
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
        /> : null}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: CHART_MAP_TOKENS.paper },
});
