import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme/v2';
import { VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { VISION_PHOTO_TARGET_ASPECT, computeFitCanvas } from './visionPhotoFit';

const AnimatedLine = Animated.createAnimatedComponent(Line);

export type VisionPhotoExtendingProps = {
  uri: string;
  size: { width: number; height: number };
  /** Width available for the destination frame, in points. */
  maxWidth: number;
  maxHeight: number;
  onCancel: () => void;
  reducedMotion?: boolean;
  /** Low-tier devices keep a gentle opacity breath and skip the moving shimmer. */
  lowPower?: boolean;
  /** True once the request has run long enough to say so honestly. No stage or percentage is implied. */
  slow?: boolean;
  testID?: string;
};

/**
 * The wait while a photo is extended. The person's own photograph sits still at its true place inside the frame it is
 * being extended to (9:16), and only the paper around it moves: a soft shimmer over the areas being created and a slow
 * dashed guide along the edges that are growing. Nothing here claims progress the server has not reported.
 */
export function VisionPhotoExtending({ uri, size, maxWidth, maxHeight, onCancel, reducedMotion = false, lowPower = false, slow = false, testID = 'vision-photo-extending' }: VisionPhotoExtendingProps) {
  const frameWidth = Math.min(maxWidth, maxHeight * VISION_PHOTO_TARGET_ASPECT);
  const frameHeight = frameWidth / VISION_PHOTO_TARGET_ASPECT;
  const fit = computeFitCanvas(size, VISION_PHOTO_TARGET_ASPECT, 100000);
  const k = fit ? frameWidth / fit.canvas.width : 1;
  const photo = fit ? { x: fit.draw.x * k, y: fit.draw.y * k, width: fit.draw.width * k, height: fit.draw.height * k } : { x: 0, y: 0, width: frameWidth, height: frameHeight };
  // Bands: the areas outside the photograph. Wider photographs grow top and bottom; taller ones left and right.
  const vertical = photo.y > 1;
  const bands = vertical
    ? [{ x: 0, y: 0, width: frameWidth, height: photo.y }, { x: 0, y: photo.y + photo.height, width: frameWidth, height: frameHeight - photo.y - photo.height }]
    : [{ x: 0, y: 0, width: photo.x, height: frameHeight }, { x: photo.x + photo.width, y: 0, width: frameWidth - photo.x - photo.width, height: frameHeight }];

  const sweep = useSharedValue(0), breath = useSharedValue(0), dash = useSharedValue(0);
  const animate = !reducedMotion;
  useEffect(() => {
    if (!animate) return;
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (!lowPower) {
      sweep.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, false);
      dash.value = withRepeat(withTiming(-24, { duration: 1600, easing: Easing.linear }), -1, false);
    }
    return () => { cancelAnimation(sweep); cancelAnimation(breath); cancelAnimation(dash); };
  }, [animate, lowPower]);
  const bandStyle = useAnimatedStyle(() => ({ opacity: animate ? 0.55 + 0.35 * breath.value : 0.75 }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (sweep.value * 2 - 1) * frameWidth }, { translateY: (sweep.value * 2 - 1) * frameHeight * (vertical ? 0.15 : 0) }] }));
  const dashProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
  const edges = vertical
    ? [{ x1: photo.x, y1: photo.y, x2: photo.x + photo.width, y2: photo.y }, { x1: photo.x, y1: photo.y + photo.height, x2: photo.x + photo.width, y2: photo.y + photo.height }]
    : [{ x1: photo.x, y1: photo.y, x2: photo.x, y2: photo.y + photo.height }, { x1: photo.x + photo.width, y1: photo.y, x2: photo.x + photo.width, y2: photo.y + photo.height }];

  return (
    <View testID={testID} style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>Extending your photo…</Text>
      <Text style={styles.sub}>Your original stays exactly as it is.</Text>
      <View accessible accessibilityLabel="Your photo, being extended to the Vision frame" style={[styles.frame, { width: frameWidth, height: frameHeight }]} testID={`${testID}-frame`}>
        {bands.map((band, index) => band.width > 0.5 && band.height > 0.5 ? (
          <Animated.View key={index} pointerEvents="none" testID={`${testID}-band-${index}`} style={[styles.band, { left: band.x, top: band.y, width: band.width, height: band.height }, bandStyle]}>
            {animate && !lowPower ? <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
              <LinearGradient colors={['transparent', 'rgba(255,250,238,0.85)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View> : null}
          </Animated.View>
        ) : null)}
        <Image testID={`${testID}-photo`} source={{ uri }} resizeMode="cover" resizeMethod="resize" accessible={false}
          style={{ position: 'absolute', left: photo.x, top: photo.y, width: photo.width, height: photo.height }} />
        <Svg pointerEvents="none" width={frameWidth} height={frameHeight} style={StyleSheet.absoluteFill}>
          {edges.map((edge, index) => <AnimatedLine key={index} {...edge} stroke={VISION_GOLD} strokeWidth={1.5} strokeDasharray="6 6" animatedProps={dashProps} />)}
        </Svg>
      </View>
      <View style={styles.chip}><Text style={styles.chipText}>Portrait · 9:16 Vision frame</Text></View>
      <Text accessibilityLiveRegion="polite" style={styles.slow}>{slow ? 'Still working. This can take a minute, and you can leave it running.' : ' '}</Text>
      <Pressable testID={`${testID}-cancel`} accessibilityRole="button" accessibilityLabel="Cancel" onPress={onCancel} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[3] },
  title: { fontFamily: VISION_SERIF, fontSize: 28, lineHeight: 33, color: colors.text.primary, textAlign: 'center' },
  sub: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: colors.text.secondary, textAlign: 'center' },
  frame: { overflow: 'hidden', borderRadius: 3, backgroundColor: '#F4EEE2', borderWidth: 1, borderColor: 'rgba(176,138,74,0.45)', shadowColor: '#2A1E10', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  band: { position: 'absolute', overflow: 'hidden', backgroundColor: 'rgba(214,194,150,0.35)' },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(176,138,74,0.14)' },
  chipText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: colors.text.secondary },
  slow: { fontFamily: 'Inter-Regular', fontSize: 13, color: colors.text.secondary, textAlign: 'center', minHeight: 18 },
  cancel: { minHeight: 44, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: 'Inter-Regular', fontSize: 15, color: colors.text.secondary, textDecorationLine: 'underline' },
});
