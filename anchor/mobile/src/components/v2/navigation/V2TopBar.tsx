import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';
import { V2BackButton } from './V2BackButton';
export function V2TopBar({ title, onBackPress, utility }: { title?: string; onBackPress?: () => void; utility?: React.ReactNode }) { return <View style={styles.bar}>{onBackPress ? <V2BackButton onPress={onBackPress} /> : <View style={styles.slot} />}{title ? <Text numberOfLines={2} accessibilityRole="header" style={styles.title}>{title}</Text> : <View style={styles.title} />}{utility ? <View style={styles.utility}>{utility}</View> : <View style={styles.slot} />}</View>; }
export const V2HeaderUtilityGroup = ({ children }: { children: React.ReactNode }) => <View style={styles.utility}>{children}</View>;
const styles = StyleSheet.create({ bar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] }, slot: { width: 44 }, title: { flex: 1, ...typography.headingMD, color: colors.text.primary, textAlign: 'center' }, utility: { minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' } });
