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

  const feedbackText = value.length === 0
    ? null
    : isValid
      ? '✓  Ready'
      : 'Must match exactly';

  const feedbackColor = isValid ? colors.gold : colors.error;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inputWrapper, animatedInputStyle]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          placeholder="Type RELEASE"
          placeholderTextColor={colors.text.disabled}
          selectionColor={colors.gold}
          accessibilityLabel="Type RELEASE to confirm burn"
          accessibilityHint="Enter the word RELEASE to enable the Burn Now button"
        />
      </Animated.View>

      {feedbackText !== null && (
        <Text
          style={[styles.feedbackLabel, { color: feedbackColor }]}
          accessibilityLiveRegion="polite"
        >
          {feedbackText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
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
  feedbackLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    letterSpacing: 0.5,
  },
});
