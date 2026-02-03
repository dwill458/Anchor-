/**
 * Anchor App - Toggle Setting Component
 *
 * A switch control row for boolean settings.
 * Provides haptic feedback and store integration.
 */

import React from 'react';
import { View, Switch, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SettingsRow } from './SettingsRow';
import { colors } from '@/theme';
import { safeHaptics } from '@/utils/haptics';

interface ToggleSettingProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  icon?: LucideIcon;
  disabled?: boolean;
  showDivider?: boolean;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  label,
  description,
  value,
  onToggle,
  icon,
  disabled = false,
  showDivider = true,
}) => {
  const handleToggle = (newValue: boolean) => {
    if (!disabled) {
      onToggle(newValue);
      // Haptic feedback
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      disabled={disabled}
      rightElement={
        <Switch
          value={value}
          onValueChange={handleToggle}
          disabled={disabled}
          trackColor={{
            false: 'rgba(255, 255, 255, 0.2)',
            true: colors.gold,
          }}
          thumbColor={colors.bone}
          ios_backgroundColor="rgba(255, 255, 255, 0.2)"
        />
      }
      showDivider={showDivider}
    />
  );
};

const styles = StyleSheet.create({});
