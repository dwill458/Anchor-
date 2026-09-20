import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import {
  V2_PRACTICE_MODE_BY_ID,
  V2_RECOMMENDATION_WHY,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import { colors, getPracticeCardTheme, radii, spacing, typography } from '@/theme/v2';
import { V2PracticeArtwork } from './V2PracticeArtwork';

type Props = {
  mode: V2PracticeMode;
  reason?: string | null;
  isCompletedToday?: boolean;
  active?: boolean;
  onPress: () => void;
  onPracticeAgain?: () => void;
  testID?: string;
};

const MODE_EDITORIAL_HEADLINES: Record<V2PracticeMode, string> = {
  release: 'Your next waypoint is closed — this one’s ready.',
  visualize: 'Your Vision hasn’t been part of today yet.',
  deep_prime: 'You’ve slipped this week — deepen it today.',
  focus: 'Build the thread today.',
};

const MODE_DEFAULT_DURATIONS: Record<V2PracticeMode, string> = {
  focus: '30 sec',
  deep_prime: '5 min',
  visualize: '3 min',
  release: 'When ready',
};

export function V2TodayPracticeCard({
  mode,
  reason: _reason,
  isCompletedToday = false,
  active = true,
  onPress,
  onPracticeAgain,
  testID = 'v2-recommended-today',
}: Props) {
  const definition = V2_PRACTICE_MODE_BY_ID[mode];
  const headline = MODE_EDITORIAL_HEADLINES[mode];
  const whyCopy = V2_RECOMMENDATION_WHY[mode];
  const durationText = MODE_DEFAULT_DURATIONS[mode];
  const theme = getPracticeCardTheme(mode);

  if (isCompletedToday) {
    return (
      <View testID={testID} style={[styles.card, styles.completedCard]}>
        <View style={styles.completedHeaderRow}>
          <View style={[styles.badge, styles.completedBadge]}>
            <Check size={12} color="#22C55E" strokeWidth={2.5} />
            <Text style={styles.completedBadgeText}>TODAY COMPLETE ✓</Text>
          </View>
        </View>

        <View style={styles.completedBody}>
          <Text style={styles.completedTitle}>You reinforced your Anchor today.</Text>
          <Text style={styles.completedSubtitle}>
            Your intention is holding strong. Settle into the rest of your day.
          </Text>
        </View>

        <View style={styles.completedActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Practice again"
            onPress={onPracticeAgain ?? onPress}
            style={({ pressed }) => [styles.practiceAgainButton, pressed && styles.pressed]}
          >
            <Text style={styles.practiceAgainText}>Practice again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const ctaLabel = `Begin ${definition.title}`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Recommended today: ${definition.title}. ${whyCopy}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      {/* Featured Artwork Hero Banner */}
      <View style={styles.heroArtworkContainer}>
        <V2PracticeArtwork mode={mode} height={190} variant="featured" active={active} />
        <View style={styles.floatingBadgesRow}>
          <View style={[styles.badge, { backgroundColor: theme.heroBadgeBg ?? theme.accent }]}>
            <Text style={styles.badgeText}>TODAY</Text>
          </View>
          <View style={styles.durationPill}>
            <Text style={styles.durationBadge}>{durationText}</Text>
          </View>
        </View>
      </View>

      {/* Featured Content Body */}
      <View style={styles.body}>
        <View style={styles.heroCopy}>
          <Text style={[styles.modeName, { color: theme.labelColor }]}>
            {definition.title}
          </Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subExplanation}>{whyCopy}</Text>
        </View>

        <View style={styles.ctaRow}>
          <V2Button
            variant="primary"
            size="medium"
            accessibilityLabel={ctaLabel}
            onPress={onPress}
            style={{ backgroundColor: theme.accent, borderColor: theme.accent }}
          >
            {ctaLabel}
          </V2Button>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  completedCard: {
    backgroundColor: `${colors.surface}CC`,
    borderColor: '#22C55E33',
    padding: spacing[4],
    gap: spacing[3],
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  heroArtworkContainer: {
    position: 'relative',
    width: '100%',
    height: 190,
    backgroundColor: colors.surface,
  },
  floatingBadgesRow: {
    position: 'absolute',
    top: spacing[3],
    left: spacing[3],
    right: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  badgeText: {
    ...typography.labelSM,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  durationPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  durationBadge: {
    ...typography.caption,
    color: '#374151',
    fontWeight: '600',
    fontSize: 11.5,
  },
  body: {
    padding: spacing[4],
    gap: spacing[3],
  },
  heroCopy: {
    gap: 4,
  },
  modeName: {
    ...typography.labelSM,
    letterSpacing: 0.9,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: typography.displayBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: colors.text.primary,
  },
  subExplanation: {
    ...typography.bodySM,
    color: colors.text.secondary,
    lineHeight: 19,
    fontSize: 13.5,
  },
  ctaRow: {
    paddingTop: spacing[1],
  },
  completedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedBadge: {
    backgroundColor: '#22C55E1A',
  },
  completedBadgeText: {
    ...typography.labelSM,
    color: '#22C55E',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  completedBody: {
    gap: 4,
    paddingVertical: spacing[1],
  },
  completedTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
  },
  completedSubtitle: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
  completedActions: {
    paddingTop: spacing[1],
    alignSelf: 'flex-start',
  },
  practiceAgainButton: {
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  practiceAgainText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
});
