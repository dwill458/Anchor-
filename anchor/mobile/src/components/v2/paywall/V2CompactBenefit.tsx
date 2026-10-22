import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme/v2';

type Props = { label: string; accent?: string; testID?: string };

/** A single-line confirmation row — not a feature-marketing card. */
export function V2CompactBenefit({ label, accent = colors.text.primary, testID }: Props) {
  return (
    <View style={styles.row} testID={testID}>
      <View style={[styles.chip, { backgroundColor: accent }]}>
        <Check size={9} color={colors.text.inverse} strokeWidth={3} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  chip: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.labelLG, color: colors.text.primary },
});
