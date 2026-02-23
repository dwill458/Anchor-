import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { PRACTICE_COPY } from '@/constants/copy';

interface DailyThreadPillProps {
  progressLabel: string;
  streakDays: number;
  onPress: () => void;
}

export const DailyThreadPill: React.FC<DailyThreadPillProps> = ({
  progressLabel,
  streakDays,
  onPress,
}) => {
  const resolvedStreakDays = Math.max(streakDays, 0);
  const filledDots = Math.min(resolvedStreakDays, 7);
  const streakUnitLabel = resolvedStreakDays === 1 ? 'DAY' : 'DAYS';

  return (
    <Pressable onPress={onPress} style={styles.pressable} accessibilityRole="button">
      <View style={styles.card}>
        <View style={styles.streakIconWrap}>
          <Flame size={18} color={colors.gold} />
        </View>

        <View style={styles.streakInfo}>
          <Text style={styles.streakTrackerTitle}>{PRACTICE_COPY.dailyThreadTitle}</Text>
          <Text style={styles.streakTrackerSub}>{PRACTICE_COPY.dailyThreadBody}</Text>
          <View style={styles.streakDots}>
            {Array.from({ length: 7 }).map((_, index) => (
              <View key={`streak-dot-${index}`} style={[styles.sDot, index < filledDots && styles.sDotFilled]} />
            ))}
          </View>
        </View>

        <View style={styles.streakCountDisplay}>
          <Text style={styles.progress}>{progressLabel}</Text>
          <Text style={styles.streakNumber}>{resolvedStreakDays}</Text>
          <Text style={styles.streakDaysLabel}>{streakUnitLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 18,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.practice.threadSurface,
    borderWidth: 1,
    borderColor: colors.practice.threadBorder,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  streakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.practice.threadIconSurface,
    borderWidth: 1,
    borderColor: colors.practice.threadIconBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  streakInfo: {
    flex: 1,
  },
  streakTrackerTitle: {
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.bone,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  streakTrackerSub: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: colors.silver,
    fontStyle: 'italic',
  },
  streakDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  sDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.practice.threadDotSurface,
  },
  sDotFilled: {
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  streakCountDisplay: {
    alignItems: 'flex-end',
  },
  progress: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.gold,
  },
  streakNumber: {
    marginTop: 2,
    fontFamily: typography.fontFamily.serifBold,
    fontSize: 26,
    color: colors.gold,
    lineHeight: 28,
    textShadowColor: colors.practice.heroGlowStrong,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  streakDaysLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.bronze,
    textTransform: 'uppercase',
  },
});
