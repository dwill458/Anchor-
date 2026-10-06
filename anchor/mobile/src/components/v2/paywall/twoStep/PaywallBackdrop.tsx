import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { colors } from '@/theme/v2';
import { PAYWALL_LAYOUT } from './paywallMotion';

type Props = {
  /** Full screen width (the curve always spans edge to edge). */
  screenWidth: number;
  /** Design width W the ratios resolve against. */
  designWidth: number;
  /** Scroll-content height the ink field must cover. */
  contentHeight: number;
  /** Cream edge (centre) y for each step, in content coordinates. */
  edgeY: readonly [number, number];
  /** 0 = step 1, 1 = step 2. */
  step: SharedValue<number>;
};

const CONTOUR_LINES = 9;

/** Faint topographic lines on the ink field. Static: drawn once per size. */
const InkContours = memo(function InkContours({ width, height, top }: { width: number; height: number; top: number }) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const span = Math.max(height - top, 1);
    for (let line = 0; line < CONTOUR_LINES; line += 1) {
      const baseY = top + (span * (line + 0.5)) / CONTOUR_LINES;
      const amp = 10 + (line % 3) * 6;
      const phase = line * 0.9;
      p.moveTo(-10, baseY);
      for (let x = -10; x <= width + 10; x += 12) {
        const y = baseY + Math.sin(x / (width * 0.18) + phase) * amp + Math.sin(x / (width * 0.07) + phase * 2) * 3;
        p.lineTo(x, y);
      }
    }
    return p;
  }, [height, top, width]);
  return (
    <Canvas style={[StyleSheet.absoluteFill, { height }]} pointerEvents="none">
      <Path path={path} style="stroke" strokeWidth={1} color="rgba(244, 237, 224, 0.035)" />
    </Canvas>
  );
});

/**
 * The cream header with its curved gold edge, over the ink field. The shape is
 * drawn once at its step-1 position; moving to step 2 is a pure translateY of
 * the canvas (the canvas extends one W above the screen so the top never
 * uncovers), so the step change never re-lays-out or re-records a path.
 */
export function PaywallBackdrop({ screenWidth, designWidth: W, contentHeight, edgeY, step }: Props) {
  const overhang = W;
  const sag = PAYWALL_LAYOUT.creamSag * W;
  const line = Math.max(1, PAYWALL_LAYOUT.goldLine * W);
  const canvasHeight = overhang + edgeY[0] + line * 2;
  const bottom = overhang + edgeY[0];
  const travel = edgeY[1] - edgeY[0];

  const { fill, edge } = useMemo(() => {
    const side = bottom - sag;
    const control = bottom + sag;
    const f = Skia.Path.Make();
    f.moveTo(0, 0);
    f.lineTo(screenWidth, 0);
    f.lineTo(screenWidth, side);
    f.quadTo(screenWidth / 2, control, 0, side);
    f.close();
    const e = Skia.Path.Make();
    e.moveTo(0, side);
    e.quadTo(screenWidth / 2, control, screenWidth, side);
    return { fill: f, edge: e };
  }, [bottom, sag, screenWidth]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: step.value * travel }] }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height: contentHeight, backgroundColor: colors.paywall.ink }]}>
      <InkContours width={screenWidth} height={contentHeight} top={edgeY[1]} />
      <Animated.View style={[styles.cream, { top: -overhang, height: canvasHeight }, moving]}>
        <Canvas style={StyleSheet.absoluteFill}>
          <Path path={fill} color={colors.paywall.cream} />
          <Path path={edge} style="stroke" strokeWidth={line}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(screenWidth, 0)}
              colors={[colors.paywall.goldDeep, colors.paywall.gold, colors.paywall.goldDeep]}
            />
          </Path>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cream: { position: 'absolute', left: 0, right: 0 },
});
