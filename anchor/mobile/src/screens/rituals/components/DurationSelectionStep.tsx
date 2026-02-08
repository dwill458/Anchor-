/**
 * Duration Selection Step
 *
 * Second step in the charge selection flow.
 * Displays mode-specific duration options:
 * - Focus mode: 30s, 2m, 5m
 * - Ritual mode: 5m, 10m, Custom
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { TimerPicker } from '@/components/common';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

const { width } = Dimensions.get('window');

export interface DurationSelectionStepProps {
  mode: 'focus' | 'ritual';
  onSelectDuration: (durationSeconds: number) => void;
  onContinue: () => void;
}

interface DurationOption {
  label: string;
  seconds: number;
}

const FOCUS_DURATIONS: DurationOption[] = [
  { label: '30 seconds', seconds: 30 },
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
];

const RITUAL_DURATIONS: DurationOption[] = [
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
  { label: 'Custom', seconds: 0 }, // Marker for custom picker
];

/**
 * DurationSelectionStep Component
 *
 * Allows users to select ritual duration based on selected mode.
 */
export const DurationSelectionStep: React.FC<DurationSelectionStepProps> = ({
  mode,
  onSelectDuration,
  onContinue,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  const durations = mode === 'focus' ? FOCUS_DURATIONS : RITUAL_DURATIONS;
  const isFocusMode = mode === 'focus';

  const handleDurationPress = (option: DurationOption) => {
    void safeHaptics.selection();

    if (option.seconds === 0) {
      // Custom duration - open timer picker
      setShowTimerPicker(true);
    } else {
      setSelectedDuration(option.seconds);
      onSelectDuration(option.seconds);
    }
  };

  const handleCustomDurationConfirm = (minutes: number) => {
    const durationSeconds = minutes * 60;
    setSelectedDuration(durationSeconds);
    onSelectDuration(durationSeconds);
    setShowTimerPicker(false);
  };

  const handleContinue = () => {
    if (selectedDuration !== null) {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      onContinue();
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    return mins === 1 ? '1 min' : `${mins} min`;
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Step header */}
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>STEP 2 OF 2</Text>
        <Text style={styles.title}>Duration</Text>
        <Text style={styles.subtitle}>How much time do you have?</Text>
      </View>

      {/* Duration options */}
      <View style={styles.optionsContainer}>
        {isFocusMode ? (
          /* Focus mode: Horizontal pills */
          <View style={styles.pillsContainer}>
            {durations.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.pill,
                  selectedDuration === option.seconds && styles.pillSelected,
                ]}
                onPress={() => handleDurationPress(option)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pillText,
                    selectedDuration === option.seconds && styles.pillTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Ritual mode: Vertical list */
          <View style={styles.listContainer}>
            {durations.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.listItem,
                  selectedDuration === option.seconds && styles.listItemSelected,
                ]}
                onPress={() => handleDurationPress(option)}
                activeOpacity={0.8}
              >
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemText}>
                    {option.label.replace('Custom', 'Custom Duration')}
                  </Text>
                  {option.label.includes('Custom') && (
                    <Text style={styles.listItemHint}>1–30 minutes</Text>
                  )}
                </View>
                {selectedDuration === option.seconds && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Selected duration display (if custom) */}
      {selectedDuration &&
        !durations.some((d) => d.seconds === selectedDuration) && (
          <View style={styles.customDurationDisplay}>
            <Text style={styles.customDurationLabel}>Custom Duration</Text>
            <Text style={styles.customDurationValue}>
              {formatDuration(selectedDuration)}
            </Text>
          </View>
        )}

      {/* Continue button */}
      <TouchableOpacity
        style={[
          styles.continueButton,
          !selectedDuration && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!selectedDuration}
        activeOpacity={0.8}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>

      {/* Timer Picker Modal */}
      <TimerPicker
        visible={showTimerPicker}
        onClose={() => setShowTimerPicker(false)}
        onConfirm={handleCustomDurationConfirm}
        initialMinutes={10}
        minMinutes={1}
        maxMinutes={30}
        title="Select Duration"
      />
    </ScrollView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  stepIndicator: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },

  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },

  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  optionsContainer: {
    marginBottom: spacing.xxxl,
  },

  // ─── Focus Mode: Horizontal Pills ─────────────────────────
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },

  pill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: `${colors.gold}40`,
    backgroundColor: 'transparent',
  },

  pillSelected: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}15`,
  },

  pillText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
  },

  pillTextSelected: {
    color: colors.gold,
  },

  // ─── Ritual Mode: Vertical List ──────────────────────────
  listContainer: {
    gap: spacing.sm,
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(192, 192, 192, 0.1)`,
  },

  listItemSelected: {
    backgroundColor: `${colors.gold}15`,
    borderColor: colors.gold,
    borderWidth: 2,
  },

  listItemContent: {
    flex: 1,
  },

  listItemText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  listItemHint: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
  },

  checkmark: {
    fontSize: 20,
    color: colors.gold,
    marginLeft: spacing.md,
  },

  // ─── Custom Duration Display ──────────────────────────────
  customDurationDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: 12,
    backgroundColor: `${colors.gold}10`,
    borderWidth: 1,
    borderColor: `${colors.gold}30`,
  },

  customDurationLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },

  customDurationValue: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },

  // ─── Continue Button ───────────────────────────────────────
  continueButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  continueButtonDisabled: {
    opacity: 0.5,
  },

  continueButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
    letterSpacing: 0.5,
  },
});
