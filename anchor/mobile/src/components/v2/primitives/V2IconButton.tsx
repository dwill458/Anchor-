import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii } from '@/theme/v2';
type Props = { icon: React.ReactNode; accessibilityLabel: string; onPress?: () => void; disabled?: boolean; surface?: boolean; style?: StyleProp<ViewStyle>; testID?: string };
export function V2IconButton({ icon, accessibilityLabel, onPress, disabled = false, surface = false, style, testID }: Props) { return <Pressable testID={testID} onPress={onPress} disabled={disabled} hitSlop={4} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }} style={({ pressed }) => [styles.base, surface && styles.surface, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}><View pointerEvents="none">{icon}</View></Pressable>; }
const styles = StyleSheet.create({ base: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: radii.md }, surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.subtle }, disabled: { opacity: 0.45 }, pressed: { backgroundColor: colors.grouped } });
