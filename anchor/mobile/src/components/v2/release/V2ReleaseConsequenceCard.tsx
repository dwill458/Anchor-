import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { V2ReleaseConsequence } from '@/adapters/v2/release';
import { colors } from '@/theme/v2';
import { RELEASE_COPY } from '@/constants/v2/release';
import { releaseTypography } from './releaseTypography';

interface Props {
  consequences: V2ReleaseConsequence[];
  testID?: string;
}

/** One row per real consequence, label and detail from the snapshot; never clipped, the parent scrolls. */
export function V2ReleaseConsequenceCard({ consequences, testID }: Props) {
  return (
    <View style={styles.section} testID={testID ?? 'v2-release-consequences'}>
      <Text style={styles.heading}>{RELEASE_COPY.consequenceHeading}</Text>
      {consequences.map((row) => (
        <View key={row.id} style={styles.row} testID={`v2-release-consequence-${row.id}`}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.detail}>{row.detail}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { ...releaseTypography.label, color: colors.text.primary },
  row: { gap: 2, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.frameEdge },
  label: { ...releaseTypography.label, color: colors.ink.base },
  detail: { ...releaseTypography.small, color: colors.text.secondary },
});
