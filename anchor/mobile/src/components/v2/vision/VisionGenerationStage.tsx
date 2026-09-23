import React, { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, radii } from '@/theme/v2';
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
  item, depth, width, height, reduceMotion,
}: { item: PresentedImage; depth: number; width: number; height: number; reduceMotion: boolean }) {
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const camera = useSharedValue(0);
  const pattern = cameraPattern(item.id);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: reduceMotion ? R.reducedEnterMs : R.enterMs + 220, easing: EASE });
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
  }, [camera, reduceMotion, reveal]);

  const outerStyle = useAnimatedStyle(() => ({
    // The outgoing scene remains a dim photographic underlayer while the
    // incoming scene develops above it, avoiding a hard black-frame swap.
    opacity: depth === 0 ? reveal.value : 0.42,
  }));
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
  return (
    <View testID="vision-generation-stage" style={[styles.stage, { width, height }]}
      accessibilityLabel={presented.length ? 'A moment from your future is coming into view' : 'Your future is beginning to come into view'}>
      <FormingLight width={width} height={height} accent={accent} visible={presented.length === 0} reduceMotion={reduceMotion} />
      {visible.map((item, depth) => (
        <CinematicScene key={item.id} item={item} depth={depth} width={width} height={height} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignSelf: 'center', overflow: 'hidden', borderRadius: radii.lg, backgroundColor: colors.ink.deep, justifyContent: 'center', alignItems: 'center' },
  scene: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.ink.deep },
  image: { width: '118%', height: '118%', marginLeft: '-9%', marginTop: '-9%' },
  developingVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink.base, opacity: 0.2 },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.ink.hairline },
  light: { position: 'absolute' },
});
