import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';

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
}: Props) {
  const inactive = disabled || loading;
  const textColor = inactive
    ? colors.text.disabled
    : textColorOverride ??
      (variant === 'primary' || variant === 'destructive'
        ? colors.text.inverse
        : colors.text.primary);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={loading ? styles.hidden : undefined}>{iconLeft}</View>
        <Text style={[styles.label, { color: textColor }, loading && styles.hidden]}>
          {children}
        </Text>
        <View style={loading ? styles.hidden : undefined}>{iconRight}</View>
      </View>
      {loading ? (
        <ActivityIndicator
          testID={`${testID ?? 'v2-button'}-loading`}
          color={textColor}
          style={styles.spinner}
        />
      ) : null}
    </Pressable>
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
  pressed: {
    opacity: 0.82,
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
  hidden: {
    opacity: 0,
  },
  spinner: {
    position: 'absolute',
  },
});
