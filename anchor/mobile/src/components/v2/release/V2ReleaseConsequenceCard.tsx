import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { V2ReleaseConsequence } from '@/adapters/v2/release';
import { releaseTypography } from './releaseTypography';

interface Props {
  consequences: V2ReleaseConsequence[];
  testID?: string;
}

export function V2ReleaseConsequenceCard({ consequences, testID }: Props) {
  return (
    <View style={styles.section} testID={testID ?? 'v2-release-consequences'}>
      <Text style={styles.heading}>What changes when you release</Text>
      {consequences.filter(row => row.id !== 'reminders').map((row) => {
        const text =
          row.id === 'intention'
            ? 'Daily reinforcement and reminders stop'
            : row.id === 'anchor'
              ? 'The Anchor remains in your history'
              : row.id === 'reminders'
                ? 'Active reminders stop'
                : row.id === 'history'
                  ? 'Completed practice stays recorded'
                  : row.detail;
        return (
          <Text key={row.id} style={styles.row} testID={`v2-release-consequence-${row.id}`}>
            •  {text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6 },
  heading: { ...releaseTypography.label, color: 'rgba(244,237,224,0.76)', fontSize: 13, lineHeight: 18, marginBottom: 2 },
  row: { ...releaseTypography.small, fontSize: 12, lineHeight: 17, color: 'rgba(244,237,224,0.52)' },
});
