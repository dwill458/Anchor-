/**
 * Duration Picker Component
 *
 * Inline duration selection that appears when depth is chosen.
 * Layout adapts based on charging mode:
 * - Light (Focus): Horizontal pills (30s, 2m, 5m)
 * - Deep (Ritual): Vertical list (5m, 10m, Custom)
 *
 * Fades in smoothly when depth is selected.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { TimerPicker } from '@/components/common/TimerPicker';
import { safeHaptics } from '@/utils/haptics';
import type { DepthType } from '../utils/transitionConstants';

interface DurationOption {
  label: string;
  seconds: number;
  isCustom?: boolean;
}

interface DurationPickerProps {
  depth: DepthType;
  selectedDuration: number | null;
  onSelectDuration: (seconds: number) => void;
  opacity: Animated.Value;
}

// ══════════════════════════════════════════════════════════════
// DURATION OPTIONS
// ══════════════════════════════════════════════════════════════

const LIGHT_DURATIONS: DurationOption[] = [
  { label: '30 seconds', seconds: 30 },
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
];

const DEEP_DURATIONS: DurationOption[] = [
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
  { label: 'Custom', seconds: 0, isCustom: true },
];

export const DurationPicker: React.FC<DurationPickerProps> = ({
  depth,
  selectedDuration,
  onSelectDuration,
  opacity,
}) => {
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(12);

  const isLight = depth === 'light';
  const durations = isLight ? LIGHT_DURATIONS : DEEP_DURATIONS;

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleSelectDuration = (option: DurationOption) => {
    void safeHaptics.selection();

    if (option.isCustom) {
      // Open custom timer picker
      setShowTimerPicker(true);
    } else {
      // Direct selection
      onSelectDuration(option.seconds);
    }
  };

  const handleCustomDurationConfirm = (minutes: number) => {
    setCustomMinutes(minutes);
    const seconds = minutes * 60;
    onSelectDuration(seconds);
  };

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  const isSelected = (option: DurationOption): boolean => {
    if (!selectedDuration) return false;

    if (option.isCustom) {
      // Custom is selected if duration doesn't match presets
      return !durations.some(
        (d) => !d.isCustom && d.seconds === selectedDuration
      );
    }

    return option.seconds === selectedDuration;
  };

  const getCustomLabel = (): string => {
    // If custom duration is selected, show it
    if (
      selectedDuration &&
      !durations.some((d) => !d.isCustom && d.seconds === selectedDuration)
    ) {
      return `${Math.floor(selectedDuration / 60)} min`;
    }
    return 'Custom';
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <Animated.View style={[styles.container, { opacity }]}>
        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {isLight ? 'Quick durations' : 'Choose your depth'}
        </Text>

        {/* Duration options */}
        {isLight ? (
          // Light mode: Horizontal pills
          <View style={styles.horizontalContainer}>
            {durations.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleSelectDuration(option)}
                style={[
                  styles.pill,
                  isSelected(option) && styles.pillSelected,
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select ${option.label}`}
                accessibilityState={{ selected: isSelected(option) }}
              >
                <Text
                  style={[
                    styles.pillText,
                    isSelected(option) && styles.pillTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Deep mode: Vertical list
          <View style={styles.verticalContainer}>
            {durations.map((option, index) => {
              const selected = isSelected(option);
              const displayLabel = option.isCustom
                ? getCustomLabel()
                : option.label;

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleSelectDuration(option)}
                  style={[
                    styles.listItem,
                    selected && styles.listItemSelected,
                  ]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${displayLabel}`}
                  accessibilityState={{ selected }}
                >
                  <View style={styles.listItemContent}>
                    <View
                      style={[
                        styles.radio,
                        selected && styles.radioSelected,
                      ]}
                    >
                      {selected && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.listItemText,
                        selected && styles.listItemTextSelected,
                      ]}
                    >
                      {displayLabel}
                    </Text>
                  </View>

                  {selected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* Custom Duration Picker Modal */}
      <TimerPicker
        visible={showTimerPicker}
        onClose={() => setShowTimerPicker(false)}
        onConfirm={handleCustomDurationConfirm}
        initialMinutes={customMinutes}
        minMinutes={1}
        maxMinutes={30}
        title="Custom Duration"
      />
    </>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },

  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },

  // ══════════════════════════════════════════════════════════════
  // LIGHT MODE: Horizontal Pills
  // ══════════════════════════════════════════════════════════════

  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: `rgba(212, 175, 55, 0.4)`,
    backgroundColor: 'transparent',
  },

  pillSelected: {
    borderColor: colors.gold,
    backgroundColor: `rgba(212, 175, 55, 0.15)`,
  },

  pillText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },

  pillTextSelected: {
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
  },

  // ══════════════════════════════════════════════════════════════
  // DEEP MODE: Vertical List
  // ══════════════════════════════════════════════════════════════

  verticalContainer: {
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
    borderColor: 'rgba(192, 192, 192, 0.1)',
    backgroundColor: 'transparent',
  },

  listItemSelected: {
    borderWidth: 2,
    borderColor: colors.bronze,
    backgroundColor: `rgba(205, 127, 50, 0.15)`,
  },

  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioSelected: {
    borderColor: colors.bronze,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.bronze,
  },

  listItemText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },

  listItemTextSelected: {
    color: colors.bronze,
    fontFamily: typography.fonts.bodyBold,
  },

  checkmark: {
    fontSize: 18,
    color: colors.bronze,
  },
});
