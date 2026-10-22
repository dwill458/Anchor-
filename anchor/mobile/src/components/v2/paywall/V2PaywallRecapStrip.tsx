import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';

export type V2PaywallRecap = { anchors: number; practices: number; visions: number };

type Props = { recap: V2PaywallRecap; testID?: string };

/** Personal history, not points — shown on the trial-ended state to reassure. */
export function V2PaywallRecapStrip({ recap, testID }: Props) {
  const cells = [
    { value: recap.anchors, label: 'Anchors' },
    { value: recap.practices, label: 'Practices' },
    { value: recap.visions, label: recap.visions === 1 ? 'Vision' : 'Visions' },
  ];
  return (
    <View testID={testID ?? 'v2-paywall-recap'}>
      <View style={styles.strip}>
        {cells.map((cell, index) => (
          <View key={cell.label} style={[styles.cell, index > 0 && styles.cellBorder]}>
            <Text style={styles.value}>{cell.value}</Text>
            <Text style={styles.label}>{cell.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.foot}>Kept as personal history, not points.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: spacing[4], paddingHorizontal: spacing[1] },
  cellBorder: { borderLeftWidth: 1, borderLeftColor: colors.border.default },
  value: { ...typography.numericMedium, color: colors.text.primary },
  label: { ...typography.labelSM, textTransform: 'uppercase', color: colors.text.disabled, marginTop: 4 },
  foot: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[3] },
});
