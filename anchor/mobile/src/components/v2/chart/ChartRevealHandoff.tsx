import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CHART_TRANSITION_TIMING as TT } from './chartMotion';

type Props = {
  /** The permanent Chart (mounted once the hand-off starts, and kept in this slot afterwards). */
  under?: React.ReactNode;
  /** The creation flow (kept in this slot from its first frame, so it never remounts). */
  over?: React.ReactNode;
  /** "Explore your Chart" finished: hold `over` until `under` has drawn, then fade it out. */
  releasing: boolean;
  /** `over` is gone: the host stops rendering it. */
  onReleased: () => void;
  reducedMotion: boolean;
  testID?: string;
};

/**
 * Creation → permanent Chart without a blank frame. Skia canvases draw their first frame a few frames after
 * they mount, so the permanent Chart mounts UNDER the creation flow, which already shows the same map (same
 * position, ink, cover and drift). Creation holds for TT.handoffHold, then fades out over TT.handoffFade.
 *
 * Both slots keep their tree positions for the whole life of the host, so neither the creation flow nor the
 * permanent Chart ever remounts across the hand-off.
 */
export function ChartRevealHandoff({ under = null, over = null, releasing, onReleased, reducedMotion, testID }: Props) {
  const opacity = useSharedValue(1);
  const onReleasedRef = useRef(onReleased);
  onReleasedRef.current = onReleased;

  useEffect(() => {
    if (!releasing) {
      opacity.value = 1;
      return undefined;
    }
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const fade = reducedMotion ? 0 : TT.handoffFade;
    const holdTimer = setTimeout(() => {
      if (fade <= 0) {
        opacity.value = 0;
        onReleasedRef.current();
        return;
      }
      opacity.value = withTiming(0, { duration: fade, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
      fadeTimer = setTimeout(() => onReleasedRef.current(), fade);
    }, TT.handoffHold);
    return () => {
      clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [releasing, reducedMotion, opacity]);

  const overStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View testID={testID} style={styles.root}>
      {under ? <View style={StyleSheet.absoluteFill}>{under}</View> : null}
      {over ? (
        <Animated.View
          testID={testID ? `${testID}-over` : 'chart-reveal-handoff-over'}
          style={[StyleSheet.absoluteFill, overStyle]}
          // Fade creation as ONE image. Without an offscreen layer Android applies the opacity to each child view
          // (land, weather and overlay canvases) separately, so half-faded clouds let the uncharted land show through.
          needsOffscreenAlphaCompositing={releasing}
          renderToHardwareTextureAndroid={releasing}
          pointerEvents={releasing ? 'none' : 'auto'}
          accessibilityElementsHidden={releasing}
          importantForAccessibility={releasing ? 'no-hide-descendants' : 'auto'}
        >
          {over}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
