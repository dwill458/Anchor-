import { memo, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { v2Haptics } from '@/hooks/v2';
import { getCategoryColor } from '@/theme/v2';
import { BOARD_FRAME_WINDOW, type BoardFrameKind, type SceneRect } from './board/visionBoardLayouts';

const W = BOARD_FRAME_WINDOW;
const BLEED = 0;

export interface VisionDevelopingPhotoProps {
  rect: SceneRect;
  sceneId: string;
  category?: string | null;
  imageUrl?: string | null;
  isReady?: boolean;
  frame?: BoardFrameKind;
  reduceMotion?: boolean;
  delayMs?: number;
  testID?: string;
}

export const VisionDevelopingPhoto = memo(function VisionDevelopingPhoto({
  rect,
  sceneId,
  category,
  imageUrl,
  isReady = false,
  frame = 'landscape',
  reduceMotion = false,
  delayMs = 0,
  testID = 'vision-developing-photo',
}: VisionDevelopingPhotoProps) {
  const categoryColor = getCategoryColor(category);
  const windowMetrics = W[frame];

  // Motion values
  const developProgress = useSharedValue(reduceMotion ? 1 : 0);
  const shimmer = useSharedValue(0.4);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const decoded = Boolean(imageUrl && loadedUrl === imageUrl);
  const didTriggerHaptic = useRef(false);

  // Abstract breathing shimmer before image arrives
  useEffect(() => {
    if (reduceMotion || isReady) return;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [isReady, reduceMotion, shimmer]);

  // Image development reveal
  useEffect(() => {
    if (!isReady || !imageUrl || !decoded) return;

    const timer = setTimeout(() => {

      if (!didTriggerHaptic.current) {
        didTriggerHaptic.current = true;
        v2Haptics.selection();
      }

      if (reduceMotion) {
        developProgress.value = 1;
        return;
      }

      developProgress.value = withTiming(1, {
        duration: 1250,
        easing: Easing.out(Easing.cubic),
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, developProgress, imageUrl, isReady, reduceMotion, decoded]);

  // Animated styles
  const windowLeft = (windowMetrics.left - BLEED) * rect.width;
  const windowTop = (windowMetrics.top - BLEED) * rect.height;
  const windowWidth = (windowMetrics.right - windowMetrics.left + BLEED * 2) * rect.width;
  const windowHeight = (windowMetrics.bottom - windowMetrics.top + BLEED * 2) * rect.height;

  const imageAnimStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: decoded && isReady ? 1 : 0 };
    }
    const opacity = developProgress.value;
    const scale = interpolate(developProgress.value, [0, 1], [1.035, 1]);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  const abstractAnimStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: decoded && isReady ? 0 : 1 };
    }
    return {
      opacity: 1 - developProgress.value,
    };
  });

  const washAnimStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    // A soft warm light exposure wash that flares briefly as development begins, then clears
    const washOpacity = interpolate(
      developProgress.value,
      [0, 0.25, 0.7, 1],
      [0, 0.45, 0.15, 0],
    );
    return {
      opacity: washOpacity,
    };
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          transform: [{ rotate: `${rect.rotation}deg` }],
          zIndex: rect.zIndex ?? 15,
        },
      ]}
    >
      {/* Photographic Window */}
      <View
        style={[
          styles.window,
          {
            left: windowLeft,
            top: windowTop,
            width: windowWidth,
            height: windowHeight,
          },
        ]}
      >
        {/* Real photo (revealing) */}
        {imageUrl ? (
          <Animated.View style={[StyleSheet.absoluteFill, imageAnimStyle]}>
            <Image
              source={{ uri: imageUrl }} onLoad={() => setLoadedUrl(imageUrl)} onError={() => setLoadedUrl(null)}
              resizeMode="cover"
              accessible={false}
              accessibilityIgnoresInvertColors
              style={styles.fill}
            />
          </Animated.View>
        ) : null}

        {/* Developing Exposure Wash */}
        <Animated.View pointerEvents="none" style={[styles.wash, washAnimStyle]} />

        {/* Abstract developing photographic paper (visible before image is developed) */}
        <Animated.View pointerEvents="none" style={[styles.abstractSurface, abstractAnimStyle]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id={`dev-glow-${sceneId}`} cx="50%" cy="50%" r="55%">
                <Stop offset="0%" stopColor={categoryColor} stopOpacity="0.28" />
                <Stop offset="65%" stopColor={categoryColor} stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#1C1917" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="#1C1917" />
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#dev-glow-${sceneId})`} />
          </Svg>
        </Animated.View>
      </View>

    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  shadow: {
    opacity: 0.22,
    transform: [{ translateX: 2 }, { translateY: 5 }],
  },
  window: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#1C1917',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FDE68A',
  },
  abstractSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerBloom: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    opacity: 0.18,
    borderWidth: 1,
  },
  attachment: {
    position: 'absolute',
    zIndex: 30,
  },
});
