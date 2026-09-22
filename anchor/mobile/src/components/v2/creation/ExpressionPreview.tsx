import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import type { ExpressionSpec } from '@/components/v2/anchor/anchorExpressions';
import { expressionLayerOpacity } from './creationMotion';

const PreviewLayer = memo(function PreviewLayer({
  index,
  position,
  children,
}: {
  index: number;
  position: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: expressionLayerOpacity(position.value, index) }));
  return (
    // A cached texture makes the cross-fade a compositor operation instead of an SVG redraw per frame.
    <Animated.View style={[StyleSheet.absoluteFill, style]} renderToHardwareTextureAndroid>
      {children}
    </Animated.View>
  );
});

/**
 * The large Anchor, in every expression at once.
 *
 * Each expression is the same stored structure drawn through a different treatment, mounted
 * once and cross-faded by the rail's continuous position on the UI thread. Dragging the rail
 * therefore changes the Anchor's appearance live, frame by frame, without a React render, a
 * re-parse or a network call — and the geometry every layer draws is byte-identical.
 */
export const ExpressionPreview = memo(function ExpressionPreview({
  svg,
  category,
  size,
  specs,
  position,
  testID,
}: {
  svg: string;
  category?: string | null;
  size: number;
  specs: readonly ExpressionSpec[];
  position: SharedValue<number>;
  testID?: string;
}) {
  return (
    <View style={[styles.stack, { width: size, height: size }]} pointerEvents="none" testID={testID}>
      {specs.map((spec, index) => (
        <PreviewLayer key={spec.id} index={index} position={position}>
          <AnchorMark svg={svg} category={category} expression={spec.id} size={size} />
        </PreviewLayer>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  stack: { position: 'relative' },
});
