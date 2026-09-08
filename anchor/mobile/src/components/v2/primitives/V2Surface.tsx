import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows, spacing } from '@/theme/v2';

type Props = { children: React.ReactNode; variant?: 'surface' | 'grouped'; padded?: boolean; style?: StyleProp<ViewStyle>; testID?: string };
export function V2Surface({ children, variant = 'surface', padded = true, style, testID }: Props) { return <View testID={testID} style={[styles.base, variant === 'grouped' ? styles.grouped : styles.surface, padded && styles.padded, style]}>{children}</View>; }
export const V2GroupedSurface = (props: Omit<Props, 'variant'>) => <V2Surface {...props} variant="grouped" />;
const styles = StyleSheet.create({ base: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.subtle }, surface: { backgroundColor: colors.surface, ...shadows.subtle }, grouped: { backgroundColor: colors.grouped, shadowOpacity: 0 }, padded: { padding: spacing[5] } });
