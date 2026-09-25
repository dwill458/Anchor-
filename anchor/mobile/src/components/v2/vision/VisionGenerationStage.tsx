import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii } from '@/theme/v2';
import { v2Haptics } from '@/hooks/v2';
import type { PresentedImage } from './useVisionPresentationQueue';
import { VISION_REVEAL_TIMING as R } from './useVisionPresentationQueue';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

function cameraPattern(id: string) {
  let value = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    value ^= id.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  const pattern = Math.abs(value) % 5;
  return [
    { x: 18, y: 8, scale: 1.12 },
    { x: -20, y: 6, scale: 1.11 },
    { x: 12, y: -12, scale: 1.105 },
    { x: -14, y: -9, scale: 1.115 },
    { x: 22, y: -7, scale: 1.108 },
  ][pattern];
}

/** One large scene: it develops softly, then keeps moving on the UI thread. */
const CinematicScene = memo(function CinematicScene({
  item, depth, width, height, reduceMotion, incoming = false,
}: { item: PresentedImage; depth: number; width: number; height: number; reduceMotion: boolean; incoming?: boolean }) {
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const enter = useSharedValue(incoming && !reduceMotion ? 0 : 1);
  const shift = useSharedValue(depth === 1 && !reduceMotion ? 1 : 0);
  const camera = useSharedValue(0);
  const pattern = cameraPattern(item.id);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: reduceMotion ? R.reducedEnterMs : R.enterMs + 180, easing: EASE });
    enter.value = reduceMotion
      ? withTiming(1, { duration: R.reducedEnterMs, easing: EASE })
      : withSpring(1, { damping: 22, stiffness: 140, mass: 0.85 });

    if (!reduceMotion) {
      camera.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 7600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    }
    return () => cancelAnimation(camera);
  }, [camera, enter, reduceMotion, reveal]);

  useEffect(() => {
    shift.value = withTiming(depth === 1 ? 1 : 0, {
      duration: reduceMotion ? R.reducedEnterMs : R.enterMs,
      easing: EASE,
    });
  }, [depth, reduceMotion, shift]);

  const outerStyle = useAnimatedStyle(() => {
    // Arrival motion:
    // - opacity 0 -> 1
    // - scale ~0.94 -> 1
    // - small vertical translation into position (10px -> 0px)
    // - horizontal sequence expansion: incoming card enters from right (+28% -> 0),
    //   while previous card shifts left (-28%) to briefly expose the growing sequence.
    const horizontalShift = reduceMotion
      ? 0
      : (depth === 1 ? -width * 0.28 * shift.value : (incoming ? width * 0.28 * (1 - enter.value) : 0));
    const verticalShift = reduceMotion ? 0 : (depth === 0 ? 10 * (1 - enter.value) : 0);
    const cardScale = reduceMotion
      ? 1
      : (depth === 1 ? 0.94 : 0.94 + 0.06 * enter.value);

    return {
      opacity: depth === 0 ? reveal.value : 0.58,
      transform: [
        { translateX: horizontalShift },
        { translateY: verticalShift },
        { scale: cardScale },
      ],
    };
  });

  const imageStyle = useAnimatedStyle(() => {
    const travel = reduceMotion ? 0 : camera.value;
    return {
      transform: [
        { translateX: interpolate(travel, [0, 1], [-pattern.x, pattern.x]) },
        { translateY: interpolate(travel, [0, 1], [-pattern.y, pattern.y]) },
        { scale: interpolate(travel, [0, 1], [1.08, pattern.scale]) },
      ],
    };
  });
  const developingStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.scene, { width, height, zIndex: depth === 0 ? 2 : 1 }, outerStyle]}>
      <Animated.Image source={{ uri: item.imageUrl }} resizeMode="cover" style={[styles.image, imageStyle]} accessibilityIgnoresInvertColors />
      {!reduceMotion ? (
        <Animated.View style={[StyleSheet.absoluteFill, developingStyle]}>
          <Image source={{ uri: item.imageUrl }} blurRadius={15} resizeMode="cover" style={styles.image} />
          <View style={styles.developingVeil} />
        </Animated.View>
      ) : null}
      {depth === 0 ? <View style={styles.vignette} /> : null}
    </Animated.View>
  );
});

function FormingLight({ width, height, accent, visible, reduceMotion }: {
  width: number; height: number; accent: string; visible: boolean; reduceMotion: boolean;
}) {
  const breath = useSharedValue(0.54);
  const presence = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) {
      breath.value = withRepeat(withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.54, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ), -1, false);
    }
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);
  useEffect(() => { presence.value = withTiming(visible ? 1 : 0, { duration: reduceMotion ? 180 : 700 }); }, [presence, reduceMotion, visible]);
  const style = useAnimatedStyle(() => ({ opacity: presence.value * (reduceMotion ? 0.68 : breath.value) }));
  const size = Math.max(width, height) * 1.18;
  return (
    <Animated.View pointerEvents="none" style={[styles.light, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs><RadialGradient id="vision-forming" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={accent} stopOpacity="0.42" />
          <Stop offset="0.48" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </RadialGradient></Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#vision-forming)" />
      </Svg>
    </Animated.View>
  );
}

export function VisionGenerationStage({ presented, width, height, accent, reduceMotion }: {
  presented: PresentedImage[]; width: number; height: number; accent: string; reduceMotion: boolean;
}) {
  const visible = presented.slice(-2).reverse();
  const latestId = presented[presented.length - 1]?.id;
  const previousIds = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Subtle haptic on successful image arrival
    if (latestId && !previousIds.current.has(latestId)) {
      v2Haptics.selection();
    }
    previousIds.current = new Set(presented.map(item => item.id));
  }, [latestId, presented]);

  return (
    <View testID="vision-generation-stage" style={[styles.stage, { width, height }]}
      accessibilityLabel={presented.length ? 'A moment from your future is coming into view' : 'Your future is beginning to come into view'}>
      <FormingLight width={width} height={height} accent={accent} visible={presented.length === 0} reduceMotion={reduceMotion} />
      {visible.map((item, depth) => (
        <CinematicScene
          key={item.id}
          item={item}
          depth={depth}
          width={width}
          height={height}
          reduceMotion={reduceMotion}
          incoming={depth === 0 && presented.length > 1 && item.id === latestId}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.ink.deep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scene: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.ink.deep,
    borderWidth: 1,
    borderColor: colors.ink.hairlineStrong,
    shadowColor: colors.ink.base,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.35,
  },
  image: { width: '118%', height: '118%', marginLeft: '-9%', marginTop: '-9%' },
  developingVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink.base, opacity: 0.2 },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.ink.hairline },
  light: { position: 'absolute' },
});
