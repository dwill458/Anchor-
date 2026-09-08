import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { V2Divider } from '@/components/v2';
import { colors, getPracticeColor, radii, spacing, typography } from '@/theme/v2';
import { durationLabel, shortDate } from './anchorPresentation';
import type { V2RecentPracticeEntry } from '@/hooks/v2/anchors';

type Props = {
  entries: V2RecentPracticeEntry[];
  totalCount: number;
  onSeeAll?: () => void;
};

export function V2AnchorRecentPractice({ entries, totalCount, onSeeAll }: Props) {
  if (entries.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>RECENT PRACTICE</Text>
      {entries.map((entry, index) => (
        <View key={entry.id}>
          {index > 0 ? <V2Divider /> : null}
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: getPracticeColor(entry.mode) }]} />
            <Text style={styles.mode}>{entry.label}</Text>
            <Text style={styles.meta}>
              {shortDate(entry.completedAt)} · {durationLabel(entry.durationSeconds)}
            </Text>
          </View>
        </View>
      ))}
      {totalCount > entries.length && onSeeAll ? (
        <Text accessibilityRole="button" onPress={onSeeAll} style={styles.seeAll}>
          See all sessions
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[2] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary, marginBottom: spacing[1] },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dot: { width: 8, height: 8, borderRadius: radii.round },
  mode: { flex: 1, ...typography.labelLG, color: colors.text.primary },
  meta: { ...typography.bodySM, color: colors.text.secondary },
  seeAll: { ...typography.labelMD, color: colors.semantic.info, paddingVertical: spacing[2] },
});
