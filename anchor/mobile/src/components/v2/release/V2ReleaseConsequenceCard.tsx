import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2ReleaseConsequence } from '@/adapters/v2/release';

interface Props {
  consequences: V2ReleaseConsequence[];
  testID?: string;
}

const TONE_COLOR: Record<V2ReleaseConsequence['tone'], string> = {
  neutral: colors.text.secondary,
  preserved: colors.semantic.success,
  ceases: colors.semantic.warning,
};

/**
 * Preflight consequence snapshot — "What releasing this Anchor means".
 * Every row is derived from real Anchor data by the snapshot builder.
 */
export function V2ReleaseConsequenceCard({ consequences, testID }: Props) {
  return (
    <View style={styles.card} testID={testID ?? 'v2-release-consequences'}>
      {consequences.map((row, index) => (
        <View
          key={row.id}
          style={[styles.row, index > 0 && styles.rowDivider]}
          testID={`v2-release-consequence-${row.id}`}
        >
          <View style={styles.markerColumn}>
            <ToneMarker tone={row.tone} />
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.detail}>{row.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ToneMarker({ tone }: { tone: V2ReleaseConsequence['tone'] }) {
  const color = TONE_COLOR[tone];
  if (tone === 'ceases') {
    return (
      <Svg width={14} height={14} viewBox="0 0 14 14" accessibilityRole="none">
        <Path d="M3 7h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" accessibilityRole="none">
      <Path
        d="M3 7.5l2.5 2.5L11 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing[4],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  markerColumn: {
    width: 18,
    paddingTop: 3,
    alignItems: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.labelMD,
    color: colors.text.primary,
  },
  detail: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
});
