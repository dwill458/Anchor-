import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { GlassCard } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

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
  const completed = progressLabel === '1/1';

  return (
    <Pressable onPress={onPress} style={styles.pressable} accessibilityRole="button">
      <GlassCard style={styles.card} contentStyle={styles.content}>
        <View style={styles.left}>
          <View style={styles.flameWrap}>
            <Flame size={14} color={colors.gold} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Daily thread</Text>
            <Text style={styles.subtitle}>1 session today keeps the current alive.</Text>
          </View>
        </View>
        <View style={styles.right}>
          <View style={styles.progressWrap}>
            <View style={[styles.progressRing, completed && styles.progressRingDone]}>
              <View style={[styles.progressDot, completed && styles.progressDotDone]} />
            </View>
            <Text style={styles.progress}>{progressLabel}</Text>
          </View>
          <Text style={styles.streak}>{`${Math.max(streakDays, 0)}d`}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 999,
  },
  card: {
    borderRadius: 999,
    borderColor: 'rgba(212,175,55,0.26)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  flameWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.text.primary,
  },
  subtitle: {
    marginTop: 1,
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 15,
  },
  right: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressRing: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingDone: {
    borderColor: 'rgba(212,175,55,0.82)',
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.38)',
  },
  progressDotDone: {
    backgroundColor: colors.gold,
  },
  progress: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.gold,
    lineHeight: 16,
  },
  streak: {
    marginTop: 3,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 10,
    color: colors.text.tertiary,
  },
});
