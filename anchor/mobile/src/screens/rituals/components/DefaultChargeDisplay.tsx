/**
 * Default Charge Display
 *
 * Shown to returning users on the ChargeSetup screen.
 * Displays their saved default charge preference with Continue/Change options.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

export interface DefaultChargeDisplayProps {
  mode: 'focus' | 'ritual';
  durationSeconds: number;
  onContinue: () => void;
  onChange: () => void;
}

/**
 * DefaultChargeDisplay Component
 *
 * Shows user's saved default charge preference.
 * Provides quick access to continue with defaults or change settings.
 */
export const DefaultChargeDisplay: React.FC<DefaultChargeDisplayProps> = ({
  mode,
  durationSeconds,
  onContinue,
  onChange,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    return mins === 1 ? '1 min' : `${mins} min`;
  };

  const formatMode = (mode: 'focus' | 'ritual'): string => {
    return mode === 'focus' ? 'Focus' : 'Ritual';
  };

  const handleContinue = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
    onContinue();
  };

  const handleChange = () => {
    void safeHaptics.selection();
    onChange();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={10} tint="dark" style={styles.blur}>
          <View style={styles.content}>
            {/* Main message */}
            <Text style={styles.mainText}>Using your default charge:</Text>

            {/* Default display */}
            <View style={styles.defaultContainer}>
              <Text style={styles.modeText}>{formatMode(mode)}</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.durationText}>{formatDuration(durationSeconds)}</Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.continueButton]}
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel="Continue with default charge"
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.changeButton]}
                onPress={handleChange}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Change charge settings"
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      ) : (
        <View style={[styles.blur, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
          <View style={styles.content}>
            {/* Main message */}
            <Text style={styles.mainText}>Using your default charge:</Text>

            {/* Default display */}
            <View style={styles.defaultContainer}>
              <Text style={styles.modeText}>{formatMode(mode)}</Text>
              <Text style={styles.separator}>·</Text>
              <Text style={styles.durationText}>{formatDuration(durationSeconds)}</Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.continueButton]}
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel="Continue with default charge"
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.changeButton]}
                onPress={handleChange}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Change charge settings"
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    margin: spacing.lg,
    borderRadius: 20,
    overflow: 'hidden',
  },

  blur: {
    overflow: 'hidden',
    borderRadius: 20,
  },

  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderWidth: 2,
    borderColor: `${colors.gold}40`,
    borderRadius: 20,
    backgroundColor: `rgba(255, 255, 255, 0.02)`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  mainText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  defaultContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: `${colors.gold}10`,
    borderWidth: 1,
    borderColor: `${colors.gold}25`,
  },

  modeText: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.3,
  },

  separator: {
    fontSize: typography.sizes.h3,
    color: colors.gold,
    opacity: 0.6,
  },

  durationText: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.3,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  button: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },

  continueButton: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  continueButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
    letterSpacing: 0.5,
  },

  changeButton: {
    backgroundColor: `rgba(192, 192, 192, 0.1)`,
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.3)`,
  },

  changeButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
});
