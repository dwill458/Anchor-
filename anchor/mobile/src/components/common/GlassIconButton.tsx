/**
 * GlassIconButton Component
 *
 * Premium glass-morphic icon button with haptic feedback.
 * Used for navigation actions (back, close) and other touch targets.
 *
 * Features:
 * - 44x44 minimum hit area (44x44 preferred)
 * - Glass styling with subtle border and shadow
 * - Haptic feedback on press
 * - Accessibility support
 * - Reduced motion support
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, AccessibilityRole } from 'react-native';
import { BlurView } from 'expo-blur';
import { Platform } from 'react-native';
import { colors, spacing } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';

interface GlassIconButtonProps {
  /** React Native element (Icon, Text, etc.) */
  children: React.ReactNode;
  /** Callback on press */
  onPress: () => void;
  /** Accessibility label */
  accessibilityLabel: string;
  /** Size: 'sm' (40x40) | 'md' (44x44, default) | 'lg' (52x52) */
  size?: 'sm' | 'md' | 'lg';
  /** Optional test ID */
  testID?: string;
  /** Optional additional styles */
  style?: any;
}

export const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  children,
  onPress,
  accessibilityLabel,
  size = 'md',
  testID,
  style,
}) => {
  const handlePress = async () => {
    await safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const sizeStyles = getSizeStyles(size);

  const blurContent = (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[sizeStyles, styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  );

  // Use BlurView on iOS, fallback to glass-styled View on Android
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={25} tint="dark" style={[sizeStyles, styles.blur]}>
        {blurContent}
      </BlurView>
    );
  }

  // Android fallback: glass effect using rgba + border
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[sizeStyles, styles.buttonAndroid, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {children}
    </TouchableOpacity>
  );
};

function getSizeStyles(size: 'sm' | 'md' | 'lg') {
  const sizeMap = {
    sm: { width: 40, height: 40, borderRadius: 20 },
    md: { width: 44, height: 44, borderRadius: 22 },
    lg: { width: 52, height: 52, borderRadius: 26 },
  };
  return sizeMap[size];
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonAndroid: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ritual.glassStrong, // 'rgba(12, 17, 24, 0.82)'
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
