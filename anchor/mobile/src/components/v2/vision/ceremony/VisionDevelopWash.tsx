import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Blur, Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';

/** What an empty print window shows while it develops. Never a preview of the result: only the person's own reference, blurred, or their category's colour. */
export type VisionDevelopPlaceholder = { uri?: string | null; color?: string | null };

const WASH_OPACITY = 0.9;
const TINT_OPACITY = 0.35;
const DRIFT_MS = 5000;
const BLUR = 18;

function BlurredReference({ uri, width, height }: { uri: string; width: number; height: number }) {
  const image = useImage(uri);
  if (!image || width <= 0 || height <= 0) return null;
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="cover">
        <Blur blur={BLUR} />
      </SkiaImage>
    </Canvas>
  );
}

/**
 * The develop wash: the first reference photo, cover-fit and heavily blurred, drifting slowly in scale;
 * with no reference, the Anchor's category colour over the ink window. Static under Reduce Motion or on a low tier.
 */
export function VisionDevelopWash({ placeholder, still, testID }: { placeholder: VisionDevelopPlaceholder; still: boolean; testID?: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const drift = useSharedValue(0);
  useEffect(() => {
    if (still) { cancelAnimation(drift); drift.value = 0; return; }
    drift.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(drift);
  }, [still]);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1.12 + drift.value * 0.12 }, { translateY: -drift.value * 6 }] }));
  const uri = placeholder.uri ?? null;
  return (
    <View pointerEvents="none" testID={testID} style={StyleSheet.absoluteFill}
      onLayout={event => { const { width, height } = event.nativeEvent.layout; setSize(current => current.width === width && current.height === height ? current : { width, height }); }}>
      {uri ? (
        <Animated.View testID={testID ? `${testID}-reference` : undefined} style={[StyleSheet.absoluteFill, { opacity: WASH_OPACITY }, driftStyle]}>
          <BlurredReference uri={uri} width={size.width} height={size.height} />
        </Animated.View>
      ) : placeholder.color ? (
        <View testID={testID ? `${testID}-tint` : undefined} style={[StyleSheet.absoluteFill, { backgroundColor: placeholder.color, opacity: TINT_OPACITY }]} />
      ) : null}
    </View>
  );
}
