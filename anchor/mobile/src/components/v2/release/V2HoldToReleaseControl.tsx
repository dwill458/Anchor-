import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';

interface Props {
  artworkSvg: string;
  category?: string | null;
  /** 0 → 1 fill of the radial progress ring. */
  progress: number;
  isHolding: boolean;
  /** Accessible name for the hold target, e.g. the intention text. */
  accessibilityLabel: string;
  disabled?: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  testID?: string;
}

const DIAMETER = 248;
const STROKE = 6;
const RADIUS = (DIAMETER - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The Anchor artwork wrapped by a radial progress ring that fills during the
 * 1.8s hold. Releasing before the ring completes retreats it to zero with no
 * side effects.
 */
export function V2HoldToReleaseControl({
  artworkSvg,
  category,
  progress,
  isHolding,
  accessibilityLabel,
  disabled = false,
  onHoldStart,
  onHoldEnd,
  testID,
}: Props) {
  const ringColor = getCategoryColor(category);
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = CIRCUMFERENCE * (1 - clamped);
  const label = clamped > 0 || isHolding ? RELEASE_COPY.holdSustainPrompt : RELEASE_COPY.holdPrompt;

  const ringOpacity = useMemo(() => {
    if (clamped <= 0) return 0.28;
    return 0.28 + clamped * 0.72;
  }, [clamped]);

  return (
    <View style={styles.wrapper} testID={testID ?? 'v2-hold-to-release'}>
      <Pressable
        onPressIn={disabled ? undefined : onHoldStart}
        onPressOut={disabled ? undefined : onHoldEnd}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${RELEASE_COPY.holdPrompt}: ${accessibilityLabel}`}
        accessibilityHint={RELEASE_COPY.holdHint}
        accessibilityState={{ disabled, busy: isHolding }}
        style={styles.pressable}
        testID="v2-hold-to-release-target"
      >
        <View style={[styles.ringBox, { width: DIAMETER, height: DIAMETER }]}>
          <Svg
            width={DIAMETER}
            height={DIAMETER}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Circle
              cx={DIAMETER / 2}
              cy={DIAMETER / 2}
              r={RADIUS}
              stroke={colors.border.default}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={DIAMETER / 2}
              cy={DIAMETER / 2}
              r={RADIUS}
              stroke={ringColor}
              strokeOpacity={ringOpacity}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              fill="none"
              rotation={-90}
              origin={`${DIAMETER / 2}, ${DIAMETER / 2}`}
              testID="v2-hold-progress-arc"
            />
          </Svg>
          <CircularAnchorRenderer
            svg={artworkSvg}
            category={category}
            size="hero"
            state={disabled ? 'inactive' : 'active'}
            accessibilityLabel={`${category ?? 'Custom'} Anchor artwork`}
          />
        </View>
      </Pressable>

      <Text style={styles.label} testID="v2-hold-to-release-label">
        {label}
      </Text>
      <Text style={styles.hint}>{RELEASE_COPY.holdHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing[3],
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[2],
  },
  ringBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  hint: {
    ...typography.bodySM,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
