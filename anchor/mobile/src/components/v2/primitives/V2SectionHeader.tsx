import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';
type Props = { title: string; supportingCopy?: string; actionLabel?: string; onActionPress?: () => void; };
export function V2SectionHeader({ title, supportingCopy, actionLabel, onActionPress }: Props) { return <View style={styles.row}><View style={styles.copy}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{supportingCopy ? <Text style={styles.support}>{supportingCopy}</Text> : null}</View>{actionLabel ? <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onActionPress} hitSlop={8}><Text style={styles.action}>{actionLabel}</Text></Pressable> : null}</View>; }
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3] }, copy: { flex: 1, gap: 2 }, title: { ...typography.headingMD, color: colors.text.primary }, support: { ...typography.bodySM, color: colors.text.secondary }, action: { ...typography.labelMD, color: colors.semantic.info, paddingVertical: spacing[2] } });
