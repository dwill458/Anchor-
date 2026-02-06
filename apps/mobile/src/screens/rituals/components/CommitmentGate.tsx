/**
 * Commitment Gate Component
 *
 * Sacred CTA button that gates entry to the ritual.
 * Only enables when user has made depth and duration selections.
 *
 * Design Principles:
 * - Disabled until commitment is complete (depth + duration selected)
 * - Soft gold glow appears when enabled
 * - Dynamic label based on depth: "Begin Charging" vs "Enter Ritual"
 * - Reassuring microcopy: "You can stop anytime."
 * - Haptic feedback on enable and press
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import type { DepthType } from '../utils/transitionConstants';

interface CommitmentGateProps {
  depth: DepthType | null;
  duration: number | null;
  onBegin: () => void;
  glowValue: Animated.Value;
  buttonTextOpacity: Animated.Value;
}

export const CommitmentGate: React.FC<CommitmentGateProps> = ({
  depth,
  duration,
  onBegin,
  glowValue,
  buttonTextOpacity,
}) => {
  const isEnabled = depth !== null && duration !== null;
  const wasEnabledRef = useRef(false);

  // ══════════════════════════════════════════════════════════════
  // ENABLE HAPTIC FEEDBACK
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isEnabled && !wasEnabledRef.current) {
      // First time becoming enabled - gentle haptic
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
      wasEnabledRef.current = true;
    } else if (!isEnabled) {
      wasEnabledRef.current = false;
    }
  }, [isEnabled]);

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handlePress = () => {
    if (!isEnabled) return;

    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onBegin();
  };

  // ══════════════════════════════════════════════════════════════
  // LABELS
  // ══════════════════════════════════════════════════════════════

  const getButtonLabel = (): string => {
    if (!depth) return 'Select a depth';

    return depth === 'light' ? 'Begin Charging' : 'Enter Ritual';
  };

  const getAccessibilityHint = (): string => {
    if (!isEnabled) {
      return 'Select a charging mode and duration to continue';
    }

    const durationMinutes = Math.floor((duration || 0) / 60);
    const durationText =
      durationMinutes === 0
        ? `${duration} seconds`
        : durationMinutes === 1
        ? '1 minute'
        : `${durationMinutes} minutes`;

    return `Starts your ${durationText} ${depth} charging ritual`;
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  // Interpolate glow shadow radius
  const shadowRadius = glowValue.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 24],
  });

  const shadowOpacity = glowValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={!isEnabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={getButtonLabel()}
        accessibilityHint={getAccessibilityHint()}
        accessibilityState={{ disabled: !isEnabled }}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.button,
            {
              opacity: isEnabled ? 1 : 0.4,
              shadowRadius: isEnabled ? shadowRadius : 0,
              shadowOpacity: isEnabled ? shadowOpacity : 0,
            },
          ]}
        >
          <Animated.Text
            style={[
              styles.buttonText,
              {
                opacity: buttonTextOpacity,
              },
            ]}
          >
            {getButtonLabel()}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>

      {/* Reassuring microcopy */}
      {isEnabled && (
        <Text style={styles.microcopy}>
          You can stop anytime.
        </Text>
      )}
    </View>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },

  touchable: {
    width: '100%',
  },

  button: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  buttonText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.background.primary,
    letterSpacing: 0.5,
  },

  microcopy: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    fontStyle: 'italic',
  },
});
