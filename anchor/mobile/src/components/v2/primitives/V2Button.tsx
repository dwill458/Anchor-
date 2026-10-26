import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AnimatedPressable, usePressScale } from '@/components/v2/motion';
import { AnchorMotion, colors, spacing, typography } from '@/theme/v2';

export type V2ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: V2ButtonVariant;
  size?: 'large' | 'medium' | 'compact';
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Overrides the label colour when the container background is overridden
   *  too — a light accent fill cannot carry the default inverse label. */
  textColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  numberOfLines?: number;
};

export function V2Button({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  textColor: textColorOverride,
  accessibilityLabel,
  style,
  testID,
  numberOfLines,
}: Props) {
  const inactive = disabled || loading;
  const press = usePressScale();
  // The label and the spinner trade places rather than swap.
  const loadingLevel = useSharedValue(loading ? 1 : 0);
  useEffect(() => {
    loadingLevel.value = withTiming(loading ? 1 : 0, { duration: AnchorMotion.duration.quick, reduceMotion: ReduceMotion.Never });
  }, [loading, loadingLevel]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: 1 - loadingLevel.value }));
  const textColor = inactive
    ? colors.text.disabled
    : textColorOverride ??
      (variant === 'primary' || variant === 'destructive'
        ? colors.text.inverse
        : colors.text.primary);

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        styles[size],
        styles[variant],
        inactive && styles.disabled,
        style,
        press.style,
      ]}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <View>{iconLeft}</View>
        <Text style={[styles.label, { color: textColor }]} numberOfLines={numberOfLines}>
          {children}
        </Text>
        <View>{iconRight}</View>
      </Animated.View>
      {loading ? (
        <Animated.View
          entering={FadeIn.duration(AnchorMotion.duration.quick).easing(AnchorMotion.easing.enter)}
          pointerEvents="none"
          style={styles.spinner}
        >
          <ActivityIndicator testID={`${testID ?? 'v2-button'}-loading`} color={textColor} />
        </Animated.View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  large: {
    minHeight: 52,
    paddingHorizontal: spacing[6],
    borderRadius: 26,
  },
  medium: {
    minHeight: 48,
    paddingHorizontal: spacing[5],
    borderRadius: 24,
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: 20,
  },
  primary: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border.strong,
  },
  tertiary: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  destructive: {
    backgroundColor: colors.semantic.error,
    borderColor: colors.semantic.error,
  },
  disabled: {
    backgroundColor: colors.grouped,
    borderColor: colors.border.subtle,
  },
  content: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: typography.utilitySemibold.fontFamily,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  spinner: {
    position: 'absolute',
  },
});
