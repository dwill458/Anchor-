import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radii, typography } from '@/theme/v2';
import type { V2ProgressStreak, V2ProgressWeek } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressWeekProps {
  week: V2ProgressWeek;
  streak?: V2ProgressStreak;
  /** The longest run of practice days this Anchor has on record, shown as "Longest rhythm". */
  longestRhythm?: number;
  embedded?: boolean;
  testID?: string;
}

const DAY_LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/**
 * This week at a glance: seven dots, then the rhythm line. Done is ink with a
 * check; today is outlined in gold; anything else is a dashed outline. Thread
 * Strength is the measure here, so the line describes rhythm and never a streak.
 */
export const V2ProgressWeekCard: React.FC<V2ProgressWeekProps> = ({
  week,
  streak,
  longestRhythm = 0,
  embedded = false,
  testID = 'v2-progress-week',
}) => {
  const activeDays = week.days.filter(Boolean).length;
  const hasHistory = activeDays > 0 || longestRhythm > 0;

  return (
    <View style={embedded ? styles.embedded : styles.card} testID={testID}>
      <View style={styles.week}>
        {DAY_LETTERS.map((letter, index) => {
          const done = week.days[index] === true;
          const today = index === week.todayIndex;
          return (
            <View
              key={`${letter}-${index}`}
              style={styles.day}
              accessible
              accessibilityLabel={`${DAY_NAMES[index]}${today ? ', today' : ''}: ${done ? 'practiced' : 'no practice'}`}
            >
              <Text style={styles.dayLetter}>{letter}</Text>
              <View
                testID={`${testID}-dot-${index}`}
                style={[styles.dot, done && styles.dotDone, today && styles.dotToday]}
              >
                {done ? <Check size={15} color={colors.cream} strokeWidth={2.6} /> : null}
              </View>
            </View>
          );
        })}
      </View>

      {hasHistory ? (
        <View style={styles.runLine} testID={`${testID}-run`}>
          <Text style={styles.run}>{`${activeDays} active ${activeDays === 1 ? 'day' : 'days'}`}</Text>
          {longestRhythm > 0 ? <Text style={styles.best}>{`Longest rhythm ${longestRhythm}`}</Text> : null}

        </View>
      ) : null}
    </View>
  );
};

const DOT = 24;

const styles = StyleSheet.create({
  embedded: { paddingTop: 12 },
  card: {
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.xl,
    padding: 16,
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: progressTokens.inkWash(0.28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.ink.base, borderStyle: 'solid', borderColor: colors.ink.base },
  dotToday: { borderStyle: 'solid', borderColor: progressTokens.gold },
  dayLetter: { ...typography.labelMD, fontSize: 11, color: progressTokens.muted },
  runLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: progressTokens.hairline,
  },
  run: { ...typography.labelMD, color: progressTokens.text },
  best: { ...typography.bodySM, color: progressTokens.muted },
  grace: {
    marginLeft: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: progressTokens.chip,
  },
  graceText: { ...typography.caption, color: progressTokens.text },
});
