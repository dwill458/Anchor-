import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, typography } from '@/theme/v2';
import { V2SectionHeader } from '@/components/v2/primitives';
import type { V2ProgressReflection } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressReflectionsProps {
  reflections: V2ProgressReflection[];
  /** For tests: the clock the relative dates are measured against. */
  now?: Date;
  testID?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_MS = 86_400_000;

/** "Today", a weekday within the last week, otherwise "Oct 4" (local days). */
export function formatReflectionDay(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(at)) / DAY_MS);
  if (diff <= 0) return 'Today';
  if (diff < 7) return WEEKDAYS[at.getDay()];
  return `${MONTHS[at.getMonth()]} ${at.getDate()}`;
}

/** The words the user chose after a practice. Renders nothing when there are none; it never shows sample words. */
export const V2ProgressReflections: React.FC<V2ProgressReflectionsProps> = ({
  reflections,
  now,
  testID = 'v2-progress-reflections',
}) => {
  if (reflections.length === 0) return null;

  return (
    <View style={styles.container} testID={testID}>
      <V2SectionHeader title="In your words" />
      <View style={styles.chips}>
        {reflections.map((reflection) => (
          <View key={reflection.id} style={styles.chip}>
            <Text style={styles.word}>{reflection.word}</Text>
            <Text style={styles.when}>{formatReflectionDay(reflection.occurredAt, now)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  word: { fontFamily: progressTokens.serif, fontSize: 15, lineHeight: 20, color: progressTokens.text },
  when: { ...typography.caption, fontSize: 10.5, color: progressTokens.muted },
});
