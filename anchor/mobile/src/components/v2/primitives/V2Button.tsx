import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';

export type V2ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type Props = { children: React.ReactNode; onPress?: () => void; variant?: V2ButtonVariant; size?: 'large' | 'medium' | 'compact'; iconLeft?: React.ReactNode; iconRight?: React.ReactNode; loading?: boolean; disabled?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle>; testID?: string };
export function V2Button({ children, onPress, variant = 'primary', size = 'medium', iconLeft, iconRight, loading = false, disabled = false, accessibilityLabel, style, testID }: Props) {
  const inactive = disabled || loading;
  const textColor = inactive ? colors.text.disabled : (variant === 'primary' || variant === 'destructive' ? colors.text.inverse : colors.text.primary);
  return <Pressable testID={testID} onPress={onPress} disabled={inactive} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: inactive, busy: loading }} style={({ pressed }) => [styles.base, styles[size], styles[variant], inactive && styles.disabled, pressed && !inactive && styles.pressed, style]}>
    <View style={styles.content}><View style={loading ? styles.hidden : undefined}>{iconLeft}</View><Text style={[styles.label, { color: textColor }, loading && styles.hidden]}>{children}</Text><View style={loading ? styles.hidden : undefined}>{iconRight}</View></View>
    {loading ? <ActivityIndicator testID={`${testID ?? 'v2-button'}-loading`} color={textColor} style={styles.spinner} /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, large: { minHeight: 52, paddingHorizontal: spacing[6] }, medium: { minHeight: 46, paddingHorizontal: spacing[5] }, compact: { minHeight: 44, paddingHorizontal: spacing[3] }, primary: { backgroundColor: colors.text.primary, borderColor: colors.text.primary }, secondary: { backgroundColor: colors.surface, borderColor: colors.border.strong }, tertiary: { backgroundColor: 'transparent', borderColor: 'transparent' }, destructive: { backgroundColor: colors.semantic.error, borderColor: colors.semantic.error }, disabled: { backgroundColor: colors.grouped, borderColor: colors.border.subtle }, pressed: { opacity: 0.78 }, content: { flexDirection: 'row', gap: spacing[2], alignItems: 'center', justifyContent: 'center' }, label: { ...typography.labelLG, textAlign: 'center' }, hidden: { opacity: 0 }, spinner: { position: 'absolute' } });
