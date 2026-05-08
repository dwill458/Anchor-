/**
 * BakedGlow — low-cost radial glow for the low/medium performance tier.
 *
 * Renders a single pre-rasterized radial gradient (via react-native-svg) and
 * animates only `scale` + `opacity` on the UI thread with Reanimated. The SVG
 * is composited as one hardware-cached texture (`renderToHardwareTextureAndroid`
 * on Android, `shouldRasterizeIOS` on iOS) so the GPU never re-rasterizes the
 * gradient — it just blends a single textured quad per frame.
 *
 * This is the "fake the shader" fallback for devices that can't afford the
 * per-frame Skia particle/ray canvases. Callers can later swap the inline SVG
 * for a pre-exported PNG/WebP asset without changing the API.
 */
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

interface BakedGlowProps {
  /** Diameter of the glow area in px. */
  size: number;
  /** Base opacity (trough of the breathing cycle). Defaults to 0.55. */
  baseOpacity?: number;
  /** Peak opacity (crest of the breathing cycle). Defaults to 0.85. */
  peakOpacity?: number;
  /** Center color of the radial gradient. Defaults to theme gold. */
  color?: string;
  /** Breathing cycle duration in ms (one direction). Defaults to 1600. */
  cycleMs?: number;
  /** If true, freezes the glow at peak opacity with no animation. */
  reduceMotionEnabled?: boolean;
}

const HEX_TO_RGBA = (hex: string, alpha: number): string => {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return `rgba(255,215,80,${alpha})`;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const BakedGlow: React.FC<BakedGlowProps> = ({
  size,
  baseOpacity = 0.55,
  peakOpacity = 0.85,
  color = colors.gold,
  cycleMs = 1600,
  reduceMotionEnabled = false,
}) => {
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotionEnabled) {
      cancelAnimation(breath);
      breath.value = 1;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, {
        duration: cycleMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breath);
    };
  }, [breath, cycleMs, reduceMotionEnabled]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = breath.value;
    return {
      opacity: baseOpacity + (peakOpacity - baseOpacity) * t,
      transform: [{ scale: 0.96 + 0.12 * t }],
    };
  });

  const inner = HEX_TO_RGBA(color, 0.95);
  const mid = HEX_TO_RGBA(color, 0.35);
  const edge = HEX_TO_RGBA(color, 0);

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
      ]}
      renderToHardwareTextureAndroid={Platform.OS === 'android'}
      shouldRasterizeIOS={Platform.OS === 'ios'}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="bakedGlow" cx="50" cy="50" r="50">
            <Stop offset="0%" stopColor={inner} />
            <Stop offset="45%" stopColor={mid} />
            <Stop offset="100%" stopColor={edge} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#bakedGlow)" />
      </Svg>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
