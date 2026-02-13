/**
 * RitualRail
 *
 * Left-side vertical step indicator for the Burn & Release 3-step ceremony.
 * Reflect → Confirm → Release with animated gold dots.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';

export type RitualRailStep = 'reflect' | 'confirm' | 'release';

export interface RitualRailProps {
  currentStep: RitualRailStep;
}

const STEPS: { key: RitualRailStep; label: string }[] = [
  { key: 'reflect', label: 'Reflect' },
  { key: 'confirm', label: 'Confirm' },
  { key: 'release', label: 'Release' },
];

const STEP_ORDER: Record<RitualRailStep, number> = {
  reflect: 0,
  confirm: 1,
  release: 2,
};

type StepStatus = 'completed' | 'active' | 'pending';

function getStepStatus(step: RitualRailStep, current: RitualRailStep): StepStatus {
  const s = STEP_ORDER[step];
  const c = STEP_ORDER[current];
  if (s < c) return 'completed';
  if (s === c) return 'active';
  return 'pending';
}

interface StepDotProps {
  status: StepStatus;
  animate: boolean;
}

const StepDot: React.FC<StepDotProps> = ({ status, animate }) => {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (animate && !reducedMotion) {
      scale.value = withSequence(
        withTiming(1.1, { duration: 150 }),
        withTiming(1.0, { duration: 150 })
      );
    }
  }, [animate, reducedMotion]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const filled = status === 'active' || status === 'completed';

  return (
    <Animated.View style={[styles.dot, filled ? styles.dotFilled : styles.dotOutline, dotStyle]}>
      {status === 'completed' && <Text style={styles.check}>✓</Text>}
    </Animated.View>
  );
};

export const RitualRail: React.FC<RitualRailProps> = ({ currentStep }) => {
  return (
    <View
      style={styles.container}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      {STEPS.map((step, i) => {
        const status = getStepStatus(step.key, currentStep);
        const isLast = i === STEPS.length - 1;

        return (
          <View key={step.key} style={styles.stepWrapper}>
            <View
              style={styles.stepRow}
              accessible={true}
              accessibilityLabel={`Step ${i + 1}: ${step.label}, ${status}`}
            >
              <StepDot status={status} animate={status === 'active'} />
              <Text
                style={[
                  styles.label,
                  status === 'active' && styles.labelActive,
                  status === 'completed' && styles.labelCompleted,
                  status === 'pending' && styles.labelPending,
                ]}
              >
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.connector,
                  status === 'completed' ? styles.connectorDone : styles.connectorPending,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    top: 0,
    bottom: 0,
    width: 76,
    justifyContent: 'center',
    zIndex: 10,
  },
  stepWrapper: {
    alignItems: 'flex-start',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  dotFilled: {
    backgroundColor: colors.gold,
  },
  dotOutline: {
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'transparent',
  },
  check: {
    fontSize: 7,
    color: colors.background.primary,
    fontWeight: '700',
    lineHeight: 9,
  },
  label: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  labelActive: { color: colors.gold },
  labelCompleted: { color: colors.text.secondary },
  labelPending: { color: colors.text.disabled },
  connector: {
    width: 1,
    height: 20,
    marginLeft: 4.5,
  },
  connectorDone: {
    backgroundColor: 'rgba(212, 175, 55, 0.5)',
  },
  connectorPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
});
