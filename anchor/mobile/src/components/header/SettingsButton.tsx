/**
 * Anchor App - Settings Header Button
 *
 * Premium settings button for header navigation
 * Replaces avatar button with soft-gold gear icon
 * Matches Zen Architect theme
 */

import React from 'react';
import { Pressable, View, StyleSheet, Animated, Platform } from 'react-native';
import { SettingsIcon } from '../icons/SettingsIcon';
import { colors } from '@/theme';

interface SettingsButtonProps {
  onPress: () => void;
  size?: number;
  testID?: string;
}

export const SettingsButton: React.FC<SettingsButtonProps> = ({
  onPress,
  size = 28,
  testID = 'settings-button',
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      testID={testID}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressed,
      ]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Glassmorphic background chip */}
        <View style={styles.glassChip} />

        {/* Settings icon */}
        <SettingsIcon
          size={size}
          color={colors.gold}
          glow={true}
          testID="settings-icon"
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginRight: 16,
    // Ensure minimum 44x44 touch target
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 40,
  },
  glassChip: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(26, 26, 29, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    // Subtle shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: colors.gold,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pressed: {
    opacity: 0.8,
  },
});
