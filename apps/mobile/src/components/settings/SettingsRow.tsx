/**
 * Anchor App - Settings Row Component
 *
 * Base component for all setting rows.
 * Provides left side (icon + label + description) and right side (control/value).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

interface SettingsRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  showDivider?: boolean;
}

export const SettingsRow: React.FC<SettingsRowProps> = ({
  icon: Icon,
  label,
  description,
  onPress,
  rightElement,
  disabled = false,
  style,
  showDivider = true,
}) => {
  const content = (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {Icon && <Icon color={colors.gold} size={20} style={styles.icon} />}
        <View style={styles.textContainer}>
          <Text
            style={[styles.label, disabled && styles.labelDisabled]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={[styles.description, disabled && styles.descriptionDisabled]}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}
        </View>
      </View>

      {rightElement && <View style={styles.right}>{rightElement}</View>}

      {showDivider && <View style={styles.divider} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.6}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  labelDisabled: {
    opacity: 0.5,
  },
  description: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  descriptionDisabled: {
    opacity: 0.5,
  },
  right: {
    marginLeft: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
  },
});
