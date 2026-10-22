import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import type { AnchorExpression } from '@/constants/v2/creation';

const PreviewLayer = memo(function PreviewLayer({
  incoming,
  mix,
  children,
}: {
  /** The layer being chosen (fades in with `mix`); the other one fades out. */
  incoming: boolean;
  mix: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ opacity: incoming ? mix.value : 1 - mix.value }), [incoming]);
  return (
    // A cached texture makes the cross-fade a compositor operation instead of an SVG redraw per frame.
    <Animated.View style={[StyleSheet.absoluteFill, style]} renderToHardwareTextureAndroid>
      {children}
    </Animated.View>
  );
});

/**
 * The large Anchor in its chosen expression.
 *
 * Changing expression cross-fades only the two treatments involved — the one being left and
 * the one being chosen — so the structure never flickers through unrelated treatments on the
 * way, and at most two drawings are ever mounted. The geometry every layer draws is the same
 * stored structure, byte for byte.
 */
export const ExpressionPreview = memo(function ExpressionPreview({
  svg,
  category,
  size,
  from,
  to,
  fromTint,
  toTint,
  mix,
  testID,
}: {
  svg: string;
  category?: string | null;
  size: number;
  /** The expression being left, and the one being chosen. */
  from: AnchorExpression;
  to: AnchorExpression;
  /** The chosen style's own colour, where its treatment carries one. */
  fromTint?: string;
  toTint?: string;
  /** 0 → 1 as `to` replaces `from`. */
  mix: SharedValue<number>;
  testID?: string;
}) {
  // Two stable layers, keyed by role: a change of look updates their content in place (the
  // outgoing one keeps what was on screen, the incoming one takes the new look), so a quick
  // re-selection never re-mounts a drawing mid-fade. When settled both draw the same look.
  return (
    <View style={[styles.stack, { width: size, height: size }]} pointerEvents="none" testID={testID}>
      <PreviewLayer key="outgoing" incoming={false} mix={mix}>
        <AnchorMark svg={svg} category={category} expression={from} size={size} strokeColor={fromTint} />
      </PreviewLayer>
      <PreviewLayer key="incoming" incoming mix={mix}>
        <AnchorMark svg={svg} category={category} expression={to} size={size} strokeColor={toTint} />
      </PreviewLayer>
    </View>
  );
});

const styles = StyleSheet.create({
  stack: { position: 'relative' },
});
