import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AnchorMotion, colors, getCategoryColor } from '@/theme/v2';
import { practiceColors } from '@/theme/v2/practiceColors';
import type { SharedValue } from 'react-native-reanimated';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

type V2FocusFieldProps = {
  size: number;
  progress: SharedValue<number>;
  category?: string | null;
  reduceMotion: boolean;
  motionActive: boolean;
  imprint?: boolean;
};

const TRACE_CIRCUMFERENCE = 2 * Math.PI * 71;

/**
 * The Focus field is intentionally abstract: hand-drawn traces and contours,
 * not a second Anchor, landscape, mandala, or decorative particle system.
 * Each wrapper is animated independently so the field feels made rather than
 * generated as one perfectly synchronized digital object.
 */
export function V2FocusField({
  size,
  progress,
  category,
  reduceMotion,
  motionActive,
  imprint = false,
}: V2FocusFieldProps) {
  const categoryColor = getCategoryColor(category);
  const driftInner = useSharedValue(0);
  const driftMiddle = useSharedValue(0);
  const driftOuter = useSharedValue(0);
  const reveal = useSharedValue(imprint ? 1 : 0);

  useEffect(() => {
    reveal.value = withTiming(1, {
      duration: imprint ? AnchorMotion.duration.expressive : 700,
      easing: AnchorMotion.easing.enter,
    });
  }, [imprint, reveal]);

  useEffect(() => {
    if (!motionActive || reduceMotion) {
      cancelAnimation(driftInner);
      cancelAnimation(driftMiddle);
      cancelAnimation(driftOuter);
      return;
    }

    driftInner.value = withRepeat(
      withTiming(1, { duration: 8300, easing: AnchorMotion.easing.gentle }),
      -1,
      true,
    );
    driftMiddle.value = withRepeat(
      withTiming(1, { duration: 11200, easing: AnchorMotion.easing.gentle }),
      -1,
      true,
    );
    driftOuter.value = withRepeat(
      withTiming(1, { duration: 16800, easing: AnchorMotion.easing.gentle }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(driftInner);
      cancelAnimation(driftMiddle);
      cancelAnimation(driftOuter);
    };
  }, [driftInner, driftMiddle, driftOuter, motionActive, reduceMotion]);

  const innerStyle = useAnimatedStyle(() => ({
    opacity:
      reveal.value *
      interpolate(progress.value, [0, 0.25, 0.5, 0.75, 1], imprint ? [0.28, 0.38, 0.5, 0.62, 0.74] : [0.12, 0.28, 0.46, 0.63, 0.82]),
    transform: [
      { scale: interpolate(driftInner.value, [0, 1], [0.985, 1.018]) },
      { translateX: interpolate(driftInner.value, [0, 1], [-1, 1]) },
      { translateY: interpolate(driftInner.value, [0, 1], [1, -1]) },
      { rotate: `${interpolate(driftInner.value, [0, 1], [-0.7, 0.7])}deg` },
    ],
  }));

  const middleStyle = useAnimatedStyle(() => ({
    opacity:
      reveal.value *
      interpolate(progress.value, [0, 0.3, 0.6, 1], imprint ? [0.2, 0.32, 0.48, 0.64] : [0.08, 0.2, 0.38, 0.68]),
    transform: [
      { scale: interpolate(driftMiddle.value, [0, 1], [1.018, 0.978]) },
      { translateX: interpolate(driftMiddle.value, [0, 1], [2, -2]) },
      { rotate: `${interpolate(driftMiddle.value, [0, 1], [0.8, -0.8])}deg` },
    ],
  }));

  const outerStyle = useAnimatedStyle(() => ({
    opacity:
      reveal.value *
      interpolate(progress.value, [0, 0.45, 0.75, 1], imprint ? [0.14, 0.25, 0.4, 0.56] : [0.04, 0.14, 0.28, 0.5]),
    transform: [
      { scale: interpolate(driftOuter.value, [0, 1], [0.97, 1.035]) },
      { translateY: interpolate(driftOuter.value, [0, 1], [-2, 2]) },
      { rotate: `${interpolate(driftOuter.value, [0, 1], [-1.2, 1.2])}deg` },
    ],
  }));

  const progressProps = useAnimatedProps(() => ({
    strokeDashoffset: TRACE_CIRCUMFERENCE * (1 - progress.value),
  }));

  const stroke = imprint ? categoryColor : `${categoryColor}D0`;
  const fieldBackground = imprint ? 'transparent' : colors.ink.raised;

  return (
    <View
      testID="focus-field"
      pointerEvents="none"
      accessible={false}
      style={[styles.field, { width: size, height: size }]}
    >
      <Reanimated.View style={[styles.layer, innerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
          <AnimatedCircle
            cx="100"
            cy="100"
            r="71"
            stroke={practiceColors.focus}
            strokeWidth="1.35"
            strokeDasharray={TRACE_CIRCUMFERENCE}
            strokeLinecap="round"
            animatedProps={progressProps}
          />
          <Path
            d="M42 99C45 75 61 51 85 39C106 29 132 35 150 49C167 63 169 85 163 106C157 128 140 150 116 159C91 168 64 157 50 139C39 125 38 111 42 99Z"
            stroke={stroke}
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeDasharray="3 5 21 4 10 7"
          />
        </Svg>
      </Reanimated.View>

      <Reanimated.View style={[styles.layer, middleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
          <Path
            d="M27 80C38 54 65 29 94 25C123 21 156 38 171 64C185 89 177 121 160 145C143 168 113 181 83 174C54 167 30 145 24 117"
            stroke={stroke}
            strokeWidth="1.05"
            strokeLinecap="round"
            strokeDasharray="5 9 30 6 14 11"
          />
          <Path
            d="M58 37C72 47 81 60 82 77M143 49C129 61 121 72 119 88M155 139C139 130 126 123 111 124M48 139C64 130 76 119 84 104"
            stroke={stroke}
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeDasharray="2 8"
          />
        </Svg>
      </Reanimated.View>

      <Reanimated.View style={[styles.layer, outerStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
          <Path
            d="M17 64C30 38 55 17 83 13M108 12C137 15 165 31 181 56M188 93C190 122 176 152 153 173M119 188C90 195 59 183 38 163M16 126C10 105 11 85 17 64"
            stroke={stroke}
            strokeWidth="0.95"
            strokeLinecap="round"
            strokeDasharray="16 7 3 18"
          />
          <Path
            d="M31 51L24 43M45 31L39 22M164 38L171 29M180 76L190 73M174 151L184 157M69 179L64 189M27 118L16 121"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </Svg>
      </Reanimated.View>

      <View style={[styles.tone, { width: size * 0.7, height: size * 0.7, borderRadius: size * 0.35, backgroundColor: fieldBackground }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tone: {
    position: 'absolute',
    opacity: 0.16,
  },
});
