import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import {
  V2_PRACTICE_MODE_BY_ID,
  V2_RECOMMENDATION_WHY,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import { getPracticeCardTheme, practiceDarkText, radii, spacing, typography } from '@/theme/v2';
import { V2PracticeArtwork } from './V2PracticeArtwork';

type Props = {
  mode: V2PracticeMode;
  reason?: string | null;
  isCompletedToday?: boolean;
  completedDurationSeconds?: number;
  active?: boolean;
  onPress: () => void;
  onPracticeAgain?: () => void;
  testID?: string;
};

const MODE_EDITORIAL_HEADLINES: Record<V2PracticeMode, string> = {
  release: 'This intention is complete.',
  visualize: 'Your Vision hasn’t been part of today yet.',
  // Deep Focus is recommended both for a Consistency dip and on rotation, so
  // this headline must not claim a dip; the reason line carries that.
  deep_prime: 'Go deeper with a longer session.',
  focus: 'Build consistency today.',
};

const MODE_DEFAULT_DURATIONS: Record<V2PracticeMode, string> = {
  focus: '30 sec',
  deep_prime: '5 min',
  visualize: '3 min',
  release: 'When ready',
};

const ARTWORK_HEIGHT = 190;
/**
 * The hero runs the same dissolve as the practice-library cards, given room to
 * breathe: a taller ramp over a taller scene, so the illustration enters the
 * body as atmosphere rather than meeting it at a visible seam. The artwork
 * keeps its own colour across the upper two thirds.
 */
function formatDuration(seconds: number | undefined, fallback: string): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return fallback;
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const wholeMinutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0
    ? `${wholeMinutes} min ${remainingSeconds} sec`
    : `${wholeMinutes} min`;
}

export function V2TodayPracticeCard({
  mode,
  reason: _reason,
  isCompletedToday = false,
  completedDurationSeconds,
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
    const formattedDuration = formatDuration(completedDurationSeconds, durationText);
    return (
      <View testID={testID} style={styles.card}>
        {/* Featured Artwork Hero Banner */}
        <View style={styles.heroArtworkContainer}>
          <V2PracticeArtwork mode={mode} height={ARTWORK_HEIGHT} variant="featured" active={active} completed={true} />
          <View style={styles.floatingBadgesRow}>
            <View style={[styles.badge, { backgroundColor: '#287D57' }]}>
              <Check size={11} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.badgeText}>TODAY COMPLETE</Text>
            </View>
            {mode !== 'release' ? (
              <View style={styles.durationPill}>
                <Text style={styles.durationBadge}>{formattedDuration}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Featured Content Body - Cream Split Surface */}
        <View style={styles.body}>
          <View style={styles.heroCopy}>
            <Text style={[styles.modeName, { color: theme.labelColor }]}>
              {definition.title}
            </Text>
            <Text style={styles.headline}>You reinforced your Anchor today.</Text>
            <Text style={styles.subExplanation}>
              {definition.title}{mode === 'release' ? '' : ` · ${formattedDuration}`}
            </Text>
          </View>

          <View style={styles.ctaRow}>
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
      </View>
    );
  }

  const ctaLabel = mode === 'release' ? 'Begin Release' : `Begin ${definition.title}`;
  const subhead = mode === 'release' ? 'Close it with intention.' : whyCopy;

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
        <V2PracticeArtwork mode={mode} height={ARTWORK_HEIGHT} variant="featured" active={active} />
        <View style={styles.floatingBadgesRow}>
          <View style={[styles.badge, { backgroundColor: theme.heroBadgeBg ?? theme.accent }]}>
            <Text style={styles.badgeText}>TODAY</Text>
          </View>
          {mode !== 'release' ? (
            <View style={styles.durationPill}>
              <Text style={styles.durationBadge}>{durationText}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Featured Content Body - Cream Split Surface */}
      <View style={styles.body}>
        <View style={styles.heroCopy}>
          <Text style={[styles.modeName, { color: theme.labelColor }]}>
            {definition.title}
          </Text>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subExplanation}>{subhead}</Text>
        </View>

        <View style={styles.ctaRow}>
          <V2Button
            variant="primary"
            size="medium"
            accessibilityLabel={ctaLabel}
            onPress={onPress}
            textColor={theme.ctaText}
            style={{ backgroundColor: theme.accent, borderColor: theme.accent }}
          >
            {ctaLabel}
          </V2Button>
        </View>
      </View>
    </Pressable>
  );
}

/** The large-format counterpart to the library card's body inset. */
const BODY_INSET = 18;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F4EFE6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  heroArtworkContainer: {
    position: 'relative',
    width: '100%',
    height: ARTWORK_HEIGHT,
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
    position: 'relative',
    backgroundColor: '#F4EFE6',
    paddingHorizontal: BODY_INSET,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroCopy: {
    // Spacing between these lines is deliberate, not uniform.
  },
  modeName: {
    ...typography.labelSM,
    letterSpacing: 0.9,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: typography.displayBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: '#121820',
  },
  subExplanation: {
    ...typography.bodySM,
    color: '#5C6470',
    lineHeight: 19,
    fontSize: 13.5,
    marginTop: 6,
  },
  ctaRow: {
    marginTop: 16,
  },
  completedBadgeText: {
    ...typography.labelSM,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  completedTitle: {
    fontFamily: typography.displayBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: '#121820',
  },
  completedCard: {
    backgroundColor: '#F4EFE6',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 4,
  },
  completedStatusRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedPractice: {
    ...typography.labelLG,
    fontFamily: typography.bodyBold,
    color: '#121820',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 1,
  },
  practiceAgainButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  practiceAgainText: {
    color: '#2E271F',
    fontFamily: typography.bodySemiBold,
    fontSize: 13,
  },
});
