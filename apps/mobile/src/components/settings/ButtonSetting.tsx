/**
 * Anchor App - Button Setting Component
 *
 * An action button row for settings that perform actions (sign out, export, etc.)
 * or navigate to other screens. Supports primary and destructive variants.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LucideIcon, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SettingsRow } from './SettingsRow';
import { colors, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonSettingProps {
  label: string;
  description?: string;
  onPress: () => void;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  isLoading?: boolean;
  showDivider?: boolean;
  badge?: string;
}

export const ButtonSetting: React.FC<ButtonSettingProps> = ({
  label,
  description,
  onPress,
  icon,
  variant = 'primary',
  isLoading = false,
  showDivider = true,
  badge,
}) => {
  const isDestructive = variant === 'destructive';

  const getButtonColor = () => {
    switch (variant) {
      case 'destructive':
        return colors.error;
      case 'secondary':
        return colors.gold;
      default:
        return colors.gold;
    }
  };

  const getBackgroundColor = () => {
    switch (variant) {
      case 'destructive':
        return 'transparent';
      case 'secondary':
        return 'transparent';
      default:
        return 'transparent';
    }
  };

  const buttonColor = getButtonColor();

  // For primary variant with gradient
  if (variant === 'primary' && !description) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isLoading}
        activeOpacity={0.8}
        style={styles.primaryButtonWrapper}
      >
        <LinearGradient
          colors={[colors.gold, '#B8941F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryButtonGradient}
        >
          <Text style={styles.primaryButtonText}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // For other variants or settings with description
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      onPress={onPress}
      disabled={isLoading}
      rightElement={
        <View style={styles.rightContainer}>
          {badge && <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>}
          <ChevronRight color={buttonColor} size={16} />
        </View>
      }
      showDivider={showDivider}
    />
  );
};

const styles = StyleSheet.create({
  primaryButtonWrapper: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    fontWeight: '600',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 1,
    borderColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
