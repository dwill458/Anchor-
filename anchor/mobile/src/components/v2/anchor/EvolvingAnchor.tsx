import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { AnchorMark } from './AnchorMark';
import { parseAnchorStructure } from './anchorStructure';
import type { AnchorExpression } from '@/constants/v2/creation';
import { getCategoryColor } from '@/theme/v2';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type AnchorPresence = 'Surface' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';

const PRESENCE: Record<AnchorPresence, { intensity: number; pace: number }> = {
  Surface: { intensity: 0, pace: 0 },
  Grounded: { intensity: 0.12, pace: 49000 },
  Rooted: { intensity: 0.2, pace: 42000 },
  Embedded: { intensity: 0.29, pace: 36000 },
  Sovereign: { intensity: 0.38, pace: 33000 },
};

type Props = {
  svg: string;
  imageUrl?: string | null;
  category?: string | null;
  expression?: AnchorExpression;
  presence: AnchorPresence;
  size: number;
  active?: boolean;
  reduceMotion?: boolean;
  strengthening?: boolean;
  testID?: string;
};

/** Visual presence is masked by the stored Anchor paths; no path data is changed. */
export function EvolvingAnchor({ svg, imageUrl, category, expression = 'original', presence, size, active = true, reduceMotion = false, strengthening = false, testID }: Props) {
  const structure = useMemo(() => parseAnchorStructure(svg), [svg]);
  const [imageFailed, setImageFailed] = useState(false);
  const config = PRESENCE[presence];
  const color = getCategoryColor(category);
  const travel = useSharedValue(0);
  const event = useSharedValue(0);
  const gradientId = `evolving-anchor-${presence.toLowerCase()}-${size}`;
  const maskId = `evolving-anchor-mask-${presence.toLowerCase()}-${size}`;
  const showImage = Boolean(imageUrl && !imageFailed);
  const fieldStyle = useAnimatedStyle(() => ({ opacity: Math.min(0.92, config.intensity + event.value * 0.56) }));
  const animatedRectProps = useAnimatedProps(() => ({ x: -structure!.box.width + (travel.value * structure!.box.width) }));

  useEffect(() => {
    cancelAnimation(travel);
    if (active && !reduceMotion && config.pace > 0) {
      travel.value = withRepeat(withTiming(2, { duration: config.pace }), -1, false);
    } else {
      travel.value = 0;
    }
    return () => cancelAnimation(travel);
  }, [active, config.pace, reduceMotion, travel]);

  useEffect(() => {
    cancelAnimation(event);
    event.value = strengthening && active && !reduceMotion
      ? withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 1650 }))
      : 0;
    return () => cancelAnimation(event);
  }, [active, event, reduceMotion, strengthening]);

  useEffect(() => setImageFailed(false), [imageUrl]);

  if (!structure) return (
    <View testID={testID} style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={`${category ?? 'Personal'} Anchor, ${presence} material`}>
      {showImage ? <Image
        accessible={false}
        source={{ uri: imageUrl as string }}
        resizeMode="cover"
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      /> : <AnchorMark svg={svg} category={category} expression={expression} size={size} />}
    </View>
  );

  const scale = size / structure.box.width;
  return (
    <View testID={testID} style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={`${category ?? 'Personal'} Anchor, ${presence} material`}>
      {showImage ? <Image
        accessible={false}
        source={{ uri: imageUrl as string }}
        resizeMode="cover"
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      /> : <AnchorMark svg={svg} category={category} expression={expression} size={size} />}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fieldStyle]}>
      <Svg width={size} height={size} viewBox={structure.viewBox}>
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x={structure.box.minX} y={structure.box.minY} width={structure.box.width} height={structure.box.height}>
            <Rect x={structure.box.minX} y={structure.box.minY} width={structure.box.width} height={structure.box.height} fill="black" />
            <G fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
              {structure.strokes.map((stroke, index) => <Path key={index} d={stroke.d} strokeWidth={stroke.strokeWidth * Math.min(3, Math.max(1, 1.35 / (stroke.strokeWidth * scale)))} opacity={stroke.opacity} />)}
            </G>
          </Mask>
          <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={structure.box.minX} y1={structure.box.minY + structure.box.height * 0.2} x2={structure.box.minX + structure.box.width} y2={structure.box.minY + structure.box.height * 0.8}>
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0.42" />
            <Stop offset="0.58" stopColor={color} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <AnimatedRect animatedProps={animatedRectProps} y={structure.box.minY} width={structure.box.width * 2} height={structure.box.height} fill={`url(#${gradientId})`} mask={`url(#${maskId})`} />
      </Svg>
      </Animated.View>
    </View>
  );
}
