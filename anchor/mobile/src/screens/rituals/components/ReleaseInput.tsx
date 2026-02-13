/**
 * ReleaseInput
 *
 * Controlled text input for the Release step of the Burn & Release ceremony.
 * Animates a gold border glow when value equals 'RELEASE'.
 */

import React, { useEffect } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';

export interface ReleaseInputProps {
  value: string;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
}

export const ReleaseInput: React.FC<ReleaseInputProps> = ({
  value,
  onChangeText,
  autoFocus = false,
}) => {
  const isValid = value === 'RELEASE';
  const borderGlow = useSharedValue(0);

  useEffect(() => {
    borderGlow.value = withTiming(isValid ? 1 : 0, {
      duration: isValid ? 300 : 200,
    });
  }, [isValid]);

  const animatedInputStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      borderGlow.value,
      [0, 1],
      [colors.ritual.border, colors.gold]
    );
    return {
      borderColor,
      shadowRadius: borderGlow.value * 12,
      shadowOpacity: borderGlow.value * 0.5,
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.instruction}>
        To confirm this release, type the word below
      </Text>

      <Animated.View style={[styles.inputWrapper, animatedInputStyle]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          placeholder="Type RELEASE to confirm"
          placeholderTextColor={colors.text.disabled}
          selectionColor={colors.gold}
          accessibilityLabel="Type RELEASE to confirm burn"
          accessibilityHint="Enter the word RELEASE to enable the Burn Now button"
        />
      </Animated.View>

      {isValid && (
        <Text style={styles.validLabel} accessibilityLiveRegion="polite">
          Ready to release
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  instruction: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: colors.ritual.glass,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  input: {
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 4,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  validLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.8,
    letterSpacing: 1,
  },
});
