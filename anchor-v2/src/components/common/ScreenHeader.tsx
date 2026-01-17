/**
 * ScreenHeader Component
 *
 * Standardized header for all screens with consistent styling
 * Follows the Zen Architect design system
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBackButton?: boolean;
  rightElement?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBackButton = true,
  rightElement,
}) => {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        {showBackButton ? (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Navigate to previous screen"
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}

        <View style={styles.centerContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {rightElement ? (
          rightElement
        ) : (
          <View style={styles.backButton} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
  },
  backIcon: {
    fontSize: 22,
    color: colors.gold,
  },
  centerContainer: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: 2,
    opacity: 0.7,
  },
});
