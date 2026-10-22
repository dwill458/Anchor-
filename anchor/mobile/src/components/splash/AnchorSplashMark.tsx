import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  SPLASH_GOLD,
  SPLASH_INK_COLOR,
  SPLASH_MARK_HEIGHT,
  SPLASH_MARK_WIDTH,
  SPLASH_SIGIL_INK_ASSET,
  SPLASH_STAR_ASSET,
} from './splashAnimation.constants';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The master artwork's canvas; every coordinate below is in these units. */
const VIEW_W = 1127;
const VIEW_H = 1396;
const STROKE = 56;
/** Where the two diagonals cross, under the gold star. */
const CX = 562;
const CY = 731;

type Stroke = { d: string; length: number; start: number; end: number };

const line = (x1: number, y1: number, x2: number, y2: number, start: number, end: number): Stroke => ({
  d: `M${x1} ${y1}L${x2} ${y2}`,
  length: Math.hypot(x2 - x1, y2 - y1),
  start,
  end,
});

const RING_CY = 145;
const RING_R = 82;

/**
 * A clean vector trace of the brand sigil, drawn outward from the star: the cross and stem
 * first, then the bars, the lower diamond, and the ring last. It only has to read during the
 * draw; the hand-drawn texture takes over as it completes.
 */
const STROKES: Stroke[] = [
  line(CX, CY, 171, 405, 0, 0.36),
  line(CX, CY, 953, 405, 0, 0.36),
  line(CX, CY, 957, 1060, 0, 0.36),
  line(CX, CY, 167, 1060, 0, 0.36),
  line(CX, CY, CX, RING_CY + RING_R, 0.04, 0.4),
  line(CX, CY, CX, 1385, 0.04, 0.4),
  // Bar ends stop a cap's radius short of the artwork's, so round caps never peek past the
  // hand-drawn strokes during the texture crossfade.
  line(CX, 405, 158, 405, 0.32, 0.6),
  line(CX, 405, 972, 405, 0.32, 0.6),
  line(CX, 1060, 178, 1060, 0.36, 0.64),
  line(CX, 1060, 947, 1060, 0.36, 0.64),
  line(293, 1060, 563, 1385, 0.58, 0.82),
  line(833, 1060, 563, 1385, 0.58, 0.82),
  {
    // Starts where the stem meets the ring and closes on itself.
    d: `M${CX} ${RING_CY + RING_R}A${RING_R} ${RING_R} 0 1 1 ${CX + 0.1} ${RING_CY + RING_R}`,
    length: 2 * Math.PI * RING_R,
    start: 0.76,
    end: 1,
  },
];

function TracedStroke({ stroke, progress }: { stroke: Stroke; progress: SharedValue<number> }) {
  const { d, length, start, end } = stroke;
  const animatedProps = useAnimatedProps(() => {
    const local = Math.min(1, Math.max(0, (progress.value - start) / (end - start)));
    // Untraced, a round cap would still paint a dot at the stroke's origin.
    return { strokeDashoffset: length * (1 - local), opacity: local > 0 ? 1 : 0 };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={SPLASH_INK_COLOR}
      strokeWidth={STROKE}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

const SCALE = SPLASH_MARK_WIDTH / VIEW_W;
const STAR_X = CX * SCALE;
const STAR_Y = CY * SCALE;
const GLOW_SIZE = SPLASH_MARK_WIDTH * 1.25;

export type AnchorSplashMarkProps = {
  /** 0 → 1 traces the vector sigil. */
  draw: SharedValue<number>;
  /** 0 → 1 crossfades the vector trace into the hand-drawn texture. */
  texture: SharedValue<number>;
  /** Gold glow behind the star, 0 → 1. */
  glow: SharedValue<number>;
  /** Star scale; 1 is the resting size that matches the native splash. */
  starScale: SharedValue<number>;
  onStarReady: () => void;
};

/**
 * The 2.0 sigil in its splash form. The star is the same image, on the same canvas, at the same
 * width as the native launch screen, so the hand-off from the OS frame is invisible; everything
 * else grows out of it.
 */
function AnchorSplashMarkComponent({ draw, texture, glow, starScale, onStarReady }: AnchorSplashMarkProps) {
  const vectorStyle = useAnimatedStyle(() => ({ opacity: 1 - texture.value }));
  const textureStyle = useAnimatedStyle(() => ({ opacity: texture.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.8 + glow.value * 0.2 }] }));
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: starScale.value }] }));

  return (
    <View style={styles.frame} pointerEvents="none">
      <Animated.View style={[styles.glow, glowStyle]}>
        <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
          <Defs>
            {/* rx/ry are explicit: Android ignores `r` alone on a radial gradient. */}
            <RadialGradient id="splashGlow" cx="50%" cy="50%" rx="50%" ry="50%" r="50%">
              <Stop offset="0" stopColor={SPLASH_GOLD} stopOpacity={0.55} />
              <Stop offset="0.45" stopColor={SPLASH_GOLD} stopOpacity={0.16} />
              <Stop offset="1" stopColor={SPLASH_GOLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#splashGlow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, vectorStyle]}>
        <Svg width={SPLASH_MARK_WIDTH} height={SPLASH_MARK_HEIGHT} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {STROKES.map((stroke) => (
            <TracedStroke key={stroke.d} stroke={stroke} progress={draw} />
          ))}
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, textureStyle]}>
        <Image source={SPLASH_SIGIL_INK_ASSET} style={styles.layer} resizeMode="contain" fadeDuration={0} />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, starStyle, styles.starOrigin]}>
        <Image
          testID="splash-star"
          source={SPLASH_STAR_ASSET}
          style={styles.layer}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={onStarReady}
          onError={onStarReady}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: SPLASH_MARK_WIDTH, height: SPLASH_MARK_HEIGHT },
  layer: { width: SPLASH_MARK_WIDTH, height: SPLASH_MARK_HEIGHT },
  glow: {
    position: 'absolute',
    left: STAR_X - GLOW_SIZE / 2,
    top: STAR_Y - GLOW_SIZE / 2,
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  // Scale the star about its own centre, not the canvas centre.
  starOrigin: { transformOrigin: [STAR_X, STAR_Y, 0] },
});

export const AnchorSplashMark = memo(AnchorSplashMarkComponent);
