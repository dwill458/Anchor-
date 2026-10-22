import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useV2ReduceMotion } from '@/hooks/v2';
import { colors, getCategoryPalette, motion, typography } from '@/theme/v2';

type Props = {
  value: number | null | undefined;
  previousValue?: number;
  delta?: number;
  category?: string | null;
  trend?: 'up' | 'down' | 'flat';
  detail?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  reduceMotion?: boolean;
  testID?: string;
};

const clampDisplayValue = (value: number) =>
  Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));

function ArrowUpRightIcon({ color = colors.text.secondary }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" accessibilityElementsHidden>
      <Path
        d="M3.5 10.5L10.5 3.5M10.5 3.5H5M10.5 3.5V9"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Presentation-only. `value`, `delta`, and `trend` are supplied by progression authority. */
export function V2ThreadStrength({
  value,
  previousValue: _previousValue,
  delta,
  category,
  trend = 'flat',
  detail,
  onPress,
  accessibilityLabel,
  reduceMotion: reduceMotionOverride,
  testID,
}: Props) {
  const systemReduceMotion = useV2ReduceMotion();
  const reduceMotion = reduceMotionOverride ?? systemReduceMotion;
  const measured = typeof value === 'number' && Number.isFinite(value);
  const target = measured ? clampDisplayValue(value) : 0;
  const animated = useRef(new Animated.Value(reduceMotion ? target : 0)).current;
  const [displayed, setDisplayed] = useState(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      animated.setValue(target);
      setDisplayed(target);
      return;
    }
    const listener = animated.addListener(({ value: next }) =>
      setDisplayed(clampDisplayValue(next))
    );
    const animation = Animated.timing(animated, {
      toValue: target,
      duration: motion.slow,
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      animated.removeListener(listener);
    };
  }, [animated, reduceMotion, target]);

  const palette = getCategoryPalette(category);
  const accent = palette.base;

  const displayDelta = measured &&
    delta !== undefined
      ? `${delta > 0 ? '+' : ''}${delta}${detail ? ` ${detail}` : ' this week'}`
      : detail;

  const content = (
    <>
      <View style={styles.heading}>
        <Text style={styles.label}>Consistency</Text>
        <View style={styles.arrowIcon}>
          <ArrowUpRightIcon color={colors.text.secondary} />
        </View>
      </View>
      <View style={styles.valueRow}>
        <Text
          testID="v2-thread-strength-value"
          style={[styles.value, { color: accent }, !measured && styles.unmeasuredValue]}
        >
          {measured ? displayed : 'Not established'}
        </Text>
        {measured ? <Text style={styles.outOf}>/ 100</Text> : null}
        {displayDelta ? (
          <Text
            style={[
              styles.delta,
              { color: (delta ?? 0) >= 0 ? accent : colors.text.secondary },
            ]}
          >
            {displayDelta}
          </Text>
        ) : !measured ? (
          <Text style={[styles.delta, { color: colors.text.secondary }]}>
            Begin reinforcing
          </Text>
        ) : target <= 10 ? (
          <Text style={[styles.delta, { color: colors.text.secondary }]}>
            Ready to rebuild
          </Text>
        ) : null}
      </View>
      {measured ? (
        <View style={styles.track} accessibilityElementsHidden>
          <View
            style={[
              styles.fill,
              { width: `${target}%`, backgroundColor: accent },
            ]}
          />
        </View>
      ) : (
        <View style={styles.track} accessibilityElementsHidden>
          <View style={[styles.fill, { width: '0%', backgroundColor: colors.text.tertiary }]} />
        </View>
      )}
    </>
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        accessibilityLabel ??
        measured ? `Consistency ${target}${
          delta !== undefined
            ? `, ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged'} ${Math.abs(delta)}`
            : ''
        }` : 'Consistency not established yet'
      }
      style={({ pressed }) => [
        styles.container,
        pressed && onPress && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginHorizontal: 26,
  },
  pressed: {
    opacity: 0.75,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text.primary,
  },
  arrowIcon: {
    paddingLeft: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 2,
  },
  value: {
    fontFamily: typography.displayBold,
    fontSize: 53,
    lineHeight: 58,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  unmeasuredValue: {
    fontFamily: typography.utilityMedium.fontFamily,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
    color: '#7B8189',
  },
  outOf: {
    fontFamily: typography.utility.fontFamily,
    fontSize: 16,
    color: '#7B8189',
  },
  delta: {
    marginLeft: 'auto',
    fontFamily: typography.utilityMedium.fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  track: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#DDD8CE',
    overflow: 'hidden',
    marginTop: 6,
  },
  fill: {
    height: 5,
    borderRadius: 2.5,
  },
});
