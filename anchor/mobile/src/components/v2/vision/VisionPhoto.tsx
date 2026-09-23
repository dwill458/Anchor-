import React, { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryColor } from '@/theme/v2';

export type VisionPhotoScrim = 'none' | 'top' | 'bottom' | 'both';

type Props = {
  /** A bundled photo or a remote Vision image URL. */
  source: ImageSourcePropType | string | null | undefined;
  category?: string | null;
  /**
   * Category wash strength (0-1). Bundled "possible future" photography uses
   * ~0.12 so it still reads as a photograph; a person's own Vision imagery is
   * never tinted.
   */
  tint?: number;
  /** Gradient protection for text laid over the photograph. */
  scrim?: VisionPhotoScrim;
  /** Scrim colour; defaults to ink so light text stays legible. */
  scrimColor?: string;
  /** Bottom scrim colour when it should dissolve into a different surface (e.g. the cream canvas). */
  bottomScrimColor?: string;
  blurRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: React.ReactNode;
  /** Enables cinematic slow-pan camera movement. */
  cinematic?: boolean;
  /** Optional normalized focal point metadata (x: 0.0-1.0, y: 0.0-1.0). */
  focalPoint?: { x: number; y: number } | null;
  /** Active during CTA handoff transition to apply a subtle push-in scale bump. */
  isExiting?: boolean;
};

function withAlpha(hex: string, alpha: number): string {
  const value = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex.slice(0, 7)}${value}`;
}

/**
 * One photograph, cropped by cover, optionally washed with the category and
 * protected by a gradient. Supports optional cinematic slow-pan animation
 * on the background photograph layer while keeping overlays stationary.
 */
export function VisionPhoto({
  source, category, tint = 0, scrim = 'none', scrimColor = colors.ink.base, bottomScrimColor, blurRadius, style, testID, children,
  cinematic = false, focalPoint, isExiting = false,
}: Props) {
  const bottomColor = bottomScrimColor ?? scrimColor;
  const imageSource = typeof source === 'string' ? { uri: source } : source;
  const wash = tint > 0 ? getCategoryColor(category) : null;
  const reduceMotion = useV2ReduceMotion();

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const exitScaleBump = useSharedValue(0);

  useEffect(() => {
    if (!cinematic || reduceMotion) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      return;
    }

    // Perceptible reference pan limits (~18-32px X, ~8-16px Y)
    let targetTxMin = -14;
    let targetTxMax = 18;
    let targetTyMin = 6;
    let targetTyMax = -10;

    // Apply normalized focal point bias if present
    if (focalPoint) {
      const biasX = (0.5 - focalPoint.x) * 24;
      const biasY = (0.5 - focalPoint.y) * 18;
      targetTxMin += biasX;
      targetTxMax += biasX;
      targetTyMin += biasY;
      targetTyMax += biasY;
    }

    const duration = 7000;
    const easing = Easing.inOut(Easing.quad);

    scale.value = 1.08;
    translateX.value = targetTxMin;
    translateY.value = targetTyMin;

    scale.value = withRepeat(withTiming(1.13, { duration, easing }), -1, true);
    translateX.value = withRepeat(withTiming(targetTxMax, { duration, easing }), -1, true);
    translateY.value = withRepeat(withTiming(targetTyMax, { duration, easing }), -1, true);

    return () => {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
    };
  }, [cinematic, reduceMotion, focalPoint?.x, focalPoint?.y, scale, translateX, translateY]);

  useEffect(() => {
    if (isExiting && cinematic && !reduceMotion) {
      exitScaleBump.value = withTiming(0.015, {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      exitScaleBump.value = 0;
    }
  }, [isExiting, cinematic, reduceMotion, exitScaleBump]);

  const animatedImageStyle = useAnimatedStyle(() => {
    if (!cinematic || reduceMotion) {
      return { transform: [{ scale: 1 }, { translateX: 0 }, { translateY: 0 }] };
    }
    return {
      transform: [
        { scale: scale.value + exitScaleBump.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });

  return (
    <View testID={testID} style={[styles.frame, style]}>
      {imageSource ? (
        <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
          <Image
            accessibilityIgnoresInvertColors
            source={imageSource}
            resizeMode="cover"
            blurRadius={blurRadius}
            style={styles.image}
          />
        </Animated.View>
      ) : null}
      {wash ? <View pointerEvents="none" style={[styles.fill, { backgroundColor: wash, opacity: tint }]} /> : null}
      {scrim === 'top' || scrim === 'both' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(scrimColor, 0.82), withAlpha(scrimColor, 0.35), withAlpha(scrimColor, 0)]}
          locations={[0, 0.42, 1]}
          style={[styles.scrim, styles.scrimTop]}
        />
      ) : null}
      {scrim === 'bottom' || scrim === 'both' ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(bottomColor, 0), withAlpha(bottomColor, 0.45), withAlpha(bottomColor, bottomScrimColor ? 1 : 0.9)]}
          locations={[0, 0.5, 1]}
          style={[styles.scrim, styles.scrimBottom]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.ink.deep },
  imageWrapper: { ...StyleSheet.absoluteFillObject },
  // Overscan protects every planned camera position, including narrow Android
  // crops where an 18px pan could otherwise reveal the frame edge.
  image: { width: '118%', height: '118%', marginLeft: '-9%', marginTop: '-9%' },
  fill: { ...StyleSheet.absoluteFillObject },
  scrim: { position: 'absolute', left: 0, right: 0, height: '55%' },
  scrimTop: { top: 0 },
  scrimBottom: { bottom: 0 },
});
