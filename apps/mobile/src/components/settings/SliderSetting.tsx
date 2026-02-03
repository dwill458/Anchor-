/**
 * Anchor App - Slider Setting Component
 *
 * A slider control row for numeric settings (e.g., haptic intensity, daily goal).
 * Displays current value and provides haptic feedback.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SettingsRow } from './SettingsRow';
import { colors, spacing } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

interface SliderSettingProps {
  label: string;
  description?: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step: number;
  icon?: LucideIcon;
  valueFormatter?: (value: number) => string;
  showDivider?: boolean;
}

export const SliderSetting: React.FC<SliderSettingProps> = ({
  label,
  description,
  value,
  onValueChange,
  minimumValue,
  maximumValue,
  step,
  icon,
  valueFormatter,
  showDivider = true,
}) => {
  const handleValueChange = (newValue: number) => {
    const snappedValue = Math.round(newValue / step) * step;
    onValueChange(snappedValue);
    // Haptic feedback on value changes
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
  };

  const displayValue = valueFormatter ? valueFormatter(value) : String(value);

  return (
    <View>
      <SettingsRow
        icon={icon}
        label={label}
        description={description}
        rightElement={<View />}
        showDivider={false}
      />

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          step={step}
          value={value}
          onValueChange={handleValueChange}
          minimumTrackTintColor={colors.gold}
          maximumTrackTintColor="rgba(192, 192, 192, 0.3)"
          thumbTintColor={colors.gold}
        />
      </View>

      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  sliderContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
    marginHorizontal: spacing.lg,
  },
});
