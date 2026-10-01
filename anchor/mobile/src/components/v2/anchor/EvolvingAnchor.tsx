import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { AnchorMark } from './AnchorMark';
import { parseAnchorStructure } from './anchorStructure';
import type { AnchorExpression } from '@/constants/v2/creation';
import { getCategoryColor } from '@/theme/v2';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
let anchorInstanceSerial = 0;

export type AnchorPresence = 'Surface' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';

const PRESENCES: AnchorPresence[] = ['Surface', 'Grounded', 'Rooted', 'Embedded', 'Sovereign'];
const STATE_VALUES = {
  // These values describe a material treatment. All layers reuse the stored path strings.
  matteInk: [0.84, 0.48, 0.22, 0.08, 0.02],
  recess: [0, 0.16, 0.34, 0.49, 0.64],
  secondRecess: [0, 0, 0.08, 0.2, 0.28],
  highlight: [0, 0.025, 0.2, 0.3, 0.38],
  sheen: [0, 0.015, 0.07, 0.11, 0.09],
};
const SWEEP_DURATION: Record<AnchorPresence, number> = {
  Surface: 0,
  Grounded: 18000,
  Rooted: 16000,
  Embedded: 19000,
  Sovereign: 26000,
};
const TRANSITION_DURATION = 1900;

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

/** Material depth is drawn from the stored paths; the Anchor's geometry is never changed. */
export function EvolvingAnchor({ svg, imageUrl, category, expression = 'original', presence, size, active = true, reduceMotion = false, strengthening = false, testID }: Props) {
  const structure = useMemo(() => parseAnchorStructure(svg), [svg]);
  const [imageFailed, setImageFailed] = useState(false);
  const color = getCategoryColor(category);
  const presenceIndex = PRESENCES.indexOf(presence);
  const travel = useSharedValue(0);
  const progress = useSharedValue(presenceIndex);
  const event = useSharedValue(0);
  const breath = useSharedValue(0);
  const instanceId = useRef(`evolving-anchor-${++anchorInstanceSerial}`).current;
  const gradientId = `${instanceId}-sheen`;
  const maskId = `${instanceId}-paths`;
  const showImage = Boolean(imageUrl && !imageFailed);
  const indexRange = [0, 1, 2, 3, 4];

  useEffect(() => {
    cancelAnimation(progress);
    if (!active || reduceMotion) {
      progress.value = presenceIndex;
    } else {
      progress.value = withTiming(presenceIndex, { duration: TRANSITION_DURATION, easing: Easing.inOut(Easing.cubic) });
    }
    return () => cancelAnimation(progress);
  }, [active, presenceIndex, progress, reduceMotion]);

  useEffect(() => {
    cancelAnimation(travel);
    const duration = SWEEP_DURATION[presence];
    if (active && !reduceMotion && duration > 0) {
      travel.value = withRepeat(withTiming(2, { duration, easing: Easing.linear }), -1, false);
    } else {
      travel.value = 0;
    }
    return () => cancelAnimation(travel);
  }, [active, presence, reduceMotion, travel]);

  useEffect(() => {
    cancelAnimation(event);
    event.value = strengthening && active && !reduceMotion
      ? withSequence(withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 1650, easing: Easing.inOut(Easing.cubic) }))
      : 0;
    return () => cancelAnimation(event);
  }, [active, event, reduceMotion, strengthening]);

  useEffect(() => {
    cancelAnimation(breath);
    if (presence === 'Sovereign' && active && !reduceMotion) {
      breath.value = withRepeat(withSequence(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.sin) })), -1, false);
    } else {
      breath.value = 0;
    }
    return () => cancelAnimation(breath);
  }, [active, breath, presence, reduceMotion]);

  useEffect(() => setImageFailed(false), [imageUrl]);

  const recessStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.76, interpolate(progress.value, indexRange, STATE_VALUES.recess) + event.value * 0.09),
  }));
  const secondRecessStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, indexRange, STATE_VALUES.secondRecess) + event.value * 0.06,
  }));
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.48, interpolate(progress.value, indexRange, STATE_VALUES.highlight) + breath.value * 0.025),
  }));
  const matteInkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, indexRange, STATE_VALUES.matteInk),
  }));
  const boxWidth = structure?.box.width ?? 0;
  const boxMinX = structure?.box.minX ?? 0;
  const animatedRectProps = useAnimatedProps(() => ({
    x: boxMinX - boxWidth + (travel.value * boxWidth),
    opacity: Math.min(0.14, interpolate(progress.value, indexRange, STATE_VALUES.sheen) + event.value * 0.025),
  }));

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
  const boost = Math.min(3, Math.max(1, 1.35 / (structure.markWidth * scale)));
  const recessOffset = structure.markWidth * 0.24;
  const secondRecessOffset = structure.markWidth * 0.46;
  const highlightOffset = structure.markWidth * 0.12;

  return (
    <View testID={testID} style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={`${category ?? 'Personal'} Anchor, ${presence} material`}>
      {showImage ? <Image
        accessible={false}
        source={{ uri: imageUrl as string }}
        resizeMode="cover"
        onError={() => setImageFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      /> : <AnchorMark svg={svg} category={category} expression={expression} size={size} />}

      {/* Each bevel follows the saved paths; translated copies only suggest the carved edge. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, matteInkStyle]}>
        <Svg width={size} height={size} viewBox={structure.viewBox}>
          <G fill="none" stroke="#30383B" strokeLinecap="round" strokeLinejoin="round">
            {structure.strokes.map((stroke, index) => <Path key={`surface-ink-${index}`} d={stroke.d} strokeWidth={stroke.strokeWidth * boost} opacity={stroke.opacity} />)}
          </G>
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, recessStyle]}>
        <Svg width={size} height={size} viewBox={structure.viewBox}>
          <G transform={`translate(${recessOffset} ${recessOffset})`} fill="none" stroke="#101820" strokeLinecap="round" strokeLinejoin="round">
            {structure.strokes.map((stroke, index) => <Path key={`recess-${index}`} d={stroke.d} strokeWidth={stroke.strokeWidth * boost * 1.18} opacity={stroke.opacity} />)}
          </G>
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, secondRecessStyle]}>
        <Svg width={size} height={size} viewBox={structure.viewBox}>
          <G transform={`translate(${secondRecessOffset} ${secondRecessOffset})`} fill="none" stroke="#26323A" strokeLinecap="round" strokeLinejoin="round">
            {structure.strokes.map((stroke, index) => <Path key={`deep-recess-${index}`} d={stroke.d} strokeWidth={stroke.strokeWidth * boost} opacity={stroke.opacity} />)}
          </G>
        </Svg>
      </Animated.View>

      {/* The highlight and slow sheen are clipped to the exact stored path geometry. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, highlightStyle]}>
        <Svg width={size} height={size} viewBox={structure.viewBox}>
          <G transform={`translate(${-highlightOffset} ${-highlightOffset})`} fill="none" stroke="#FFF0CE" strokeLinecap="round" strokeLinejoin="round">
            {structure.strokes.map((stroke, index) => <Path key={`edge-highlight-${index}`} d={stroke.d} strokeWidth={stroke.strokeWidth * boost * 0.5} opacity={stroke.opacity} />)}
          </G>
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox={structure.viewBox}>
          <Defs>
            <Mask id={maskId} maskUnits="userSpaceOnUse" x={structure.box.minX} y={structure.box.minY} width={structure.box.width} height={structure.box.height}>
              <Rect x={structure.box.minX} y={structure.box.minY} width={structure.box.width} height={structure.box.height} fill="black" />
              <G fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
                {structure.strokes.map((stroke, index) => <Path key={`mask-${index}`} d={stroke.d} strokeWidth={stroke.strokeWidth * boost} opacity={stroke.opacity} />)}
              </G>
            </Mask>
            <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={structure.box.minX} y1={structure.box.minY + structure.box.height * 0.2} x2={structure.box.minX + structure.box.width} y2={structure.box.minY + structure.box.height * 0.8}>
              <Stop offset="0" stopColor={color} stopOpacity="0" />
              <Stop offset="0.42" stopColor="#FFF2D7" stopOpacity="0.68" />
              <Stop offset="0.58" stopColor={color} stopOpacity="0.3" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <AnimatedRect animatedProps={animatedRectProps} y={structure.box.minY} width={structure.box.width * 2} height={structure.box.height} fill={`url(#${gradientId})`} mask={`url(#${maskId})`} />
        </Svg>
      </View>
    </View>
  );
}
