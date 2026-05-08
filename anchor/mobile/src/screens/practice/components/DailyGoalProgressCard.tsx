import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface DailyGoalProgressCardProps {
  completedCount: number;
  goal: number;
}

export const DailyGoalProgressCard: React.FC<DailyGoalProgressCardProps> = ({
  completedCount,
  goal,
}) => {
  const remainingCount = Math.max(goal - completedCount, 0);
  const isComplete = remainingCount === 0;
  const progress = goal > 0 ? Math.min(completedCount / goal, 1) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>TODAY&apos;S GOAL</Text>
          <Text style={styles.bodyCopy}>
            {isComplete
              ? 'Goal complete for today'
              : `${remainingCount} ${remainingCount === 1 ? 'session' : 'sessions'} remaining today`}
          </Text>
        </View>
        <Text style={styles.metric}>
          {completedCount} / {goal}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.helperCopy}>Focus and reinforce sessions count toward this goal.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.16)',
    backgroundColor: 'rgba(16,21,28,0.88)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.bronze,
  },
  bodyCopy: {
    marginTop: 4,
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  metric: {
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 28,
    lineHeight: 30,
    color: colors.gold,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  helperCopy: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text.tertiary,
  },
});
