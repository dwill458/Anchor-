/**
 * ReleaseInput
 *
 * Controlled text input for the Release step of the Burn & Release ceremony.
 * Renders ritualized typed display with hidden system input.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated as RNAnimated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const inputRef = useRef<TextInput>(null);
  const isValid = value === 'RELEASE';
  const borderGlow = useSharedValue(0);
  const cursorOpacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    borderGlow.value = withTiming(isValid ? 1 : 0, {
      duration: isValid ? 300 : 200,
    });
  }, [isValid]);

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        RNAnimated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [cursorOpacity]);

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

  const displayValue = useMemo(() => (value.length > 0 ? value.split('').join(' ') : ''), [value]);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <Pressable style={styles.container} onPress={focusInput}>
      <Animated.View style={[styles.stage, animatedInputStyle]}>
        <View style={styles.typedRow}>
          <Text style={styles.typedDisplay}>{displayValue}</Text>
          <RNAnimated.View style={[styles.cursor, { opacity: cursorOpacity }]} />
        </View>
        <Text style={styles.targetDisplay}>R · E · L · E · A · S · E</Text>
        {isValid && (
          <Text style={styles.readyLabel} accessibilityLiveRegion="polite">
            ✓  Ready to release
          </Text>
        )}
        {!isValid && value.length > 0 && (
          <Text style={styles.pendingLabel} accessibilityLiveRegion="polite">
            Must match exactly
          </Text>
        )}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          style={styles.hiddenInput}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="done"
          placeholder="Type RELEASE"
          placeholderTextColor="transparent"
          selectionColor={colors.gold}
          spellCheck={false}
          maxLength={7}
          caretHidden={true}
          accessibilityLabel="Type RELEASE to confirm burn"
          accessibilityHint="Enter the word RELEASE to enable the Burn Now button"
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  stage: {
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
    borderColor: 'rgba(201, 168, 76, 0.25)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 12,
  },
  typedRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typedDisplay: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 30,
    color: '#E8C97A',
    textAlign: 'center',
    letterSpacing: 8,
  },
  cursor: {
    width: 2,
    height: 30,
    marginLeft: 4,
    backgroundColor: colors.gold,
  },
  targetDisplay: {
    fontFamily: typography.fonts.body,
    fontSize: 11,
    color: colors.text.tertiary,
    letterSpacing: 3.5,
  },
  readyLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: '#6dbb72',
    letterSpacing: 1,
  },
  pendingLabel: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.text.tertiary,
    letterSpacing: 0.6,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    fontSize: 16,
  },
});
