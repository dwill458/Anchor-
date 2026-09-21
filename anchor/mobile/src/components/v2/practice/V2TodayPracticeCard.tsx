import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const ARTWORK_HEIGHT = 190;
/**
 * The hero runs the same dissolve as the practice-library cards, given room to
 * breathe: a taller ramp over a taller scene, so the illustration enters the
 * body as atmosphere rather than meeting it at a visible seam. The artwork
 * keeps its own colour across the upper two thirds.
 */
const ARTWORK_FADE_HEIGHT = 62;
const ARTWORK_FADE_LOCATIONS = [0, 0.52, 1] as const;

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

  /** One surface for the whole object: artwork bed, dissolve target and body. */
  const surfaceStyle = {
    backgroundColor: theme.dark.surface,
    borderColor: theme.dark.border,
  };

  if (isCompletedToday) {
    return (
      <View testID={testID} style={[styles.card, surfaceStyle]}>
        {/* Featured Artwork Hero Banner - Preserved & Settled */}
        <View style={[styles.heroArtworkContainer, { backgroundColor: theme.dark.surface }]}>
          <V2PracticeArtwork
            mode={mode}
            height={ARTWORK_HEIGHT}
            variant="featured"
            active={false}
            completed={true}
          />
          {/* Subtle calm settling overlay */}
          <View style={styles.completedArtworkOverlay} />
          <LinearGradient
            pointerEvents="none"
            colors={[...theme.dark.fade]}
            locations={[...ARTWORK_FADE_LOCATIONS]}
            style={styles.heroArtworkFade}
          />

          <View style={styles.floatingBadgesRow}>
            <View style={styles.completedBadge}>
              <Check size={11} color={practiceDarkText.title} strokeWidth={2.6} />
              <Text style={styles.completedBadgeText}>TODAY COMPLETE ✓</Text>
            </View>
            <View style={styles.durationPill}>
              <Text style={styles.durationBadge}>{durationText}</Text>
            </View>
          </View>
        </View>

        {/* Featured Content Body - Completed State */}
        <View style={styles.body}>
          <View style={styles.heroCopy}>
            <Text style={styles.completedTitle}>
              You reinforced your Anchor today.
            </Text>
            <Text style={styles.completedSubtitle}>
              Your intention is holding strong.
            </Text>
          </View>

          <View style={styles.completedActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Practice again"
              onPress={onPracticeAgain ?? onPress}
              style={({ pressed }) => [
                styles.practiceAgainButton,
                { backgroundColor: theme.dark.actionBg, borderColor: theme.dark.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.practiceAgainText}>Practice again</Text>
            </Pressable>
          </View>
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
        surfaceStyle,
        pressed && styles.pressed,
      ]}
    >
      {/* Featured Artwork Hero Banner */}
      <View style={[styles.heroArtworkContainer, { backgroundColor: theme.dark.surface }]}>
        <V2PracticeArtwork mode={mode} height={ARTWORK_HEIGHT} variant="featured" active={active} />
        {/* Atmospheric dissolve so the scene and the body are one object. */}
        <LinearGradient
          pointerEvents="none"
          colors={[...theme.dark.fade]}
          locations={[...ARTWORK_FADE_LOCATIONS]}
          style={styles.heroArtworkFade}
        />
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
          <Text style={[styles.modeName, { color: theme.dark.label }]}>
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
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    // Slightly deeper than a library card: the hero sits closest to the reader.
    shadowColor: '#000000',
    shadowOpacity: 0.13,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
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
    paddingHorizontal: BODY_INSET,
    // The dissolve has already carried the scene into the surface, so the body
    // opens close beneath it rather than restating that gap.
    paddingTop: 14,
    paddingBottom: spacing[5],
  },
  heroArtworkFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ARTWORK_FADE_HEIGHT,
    zIndex: 5,
  },
  heroCopy: {
    // Spacing between these lines is deliberate, not uniform.
  },
  modeName: {
    ...typography.labelSM,
    letterSpacing: 0.9,
    fontSize: 11,
    fontWeight: '700',
    // Small gap: the mode labels the recommendation beneath it.
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: typography.displayBold,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: practiceDarkText.title,
  },
  subExplanation: {
    ...typography.bodySM,
    color: practiceDarkText.body,
    lineHeight: 19,
    fontSize: 13.5,
    // Medium gap: the explanation trails the recommendation.
    marginTop: 8,
  },
  ctaRow: {
    // Largest gap on the card: the action separates from the copy.
    marginTop: spacing[5],
  },
  completedArtworkOverlay: {
    ...StyleSheet.absoluteFillObject,
    // Settles the scene into the dark body instead of washing it toward cream.
    backgroundColor: 'rgba(10, 8, 14, 0.30)',
  },
  completedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12, 10, 16, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(242, 238, 228, 0.24)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  completedBadgeText: {
    ...typography.labelSM,
    color: practiceDarkText.title,
    fontWeight: '700',
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  completedTitle: {
    fontFamily: typography.displayBold,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: practiceDarkText.title,
  },
  completedSubtitle: {
    ...typography.bodySM,
    color: practiceDarkText.body,
    lineHeight: 20,
    fontSize: 14,
    marginTop: 8,
  },
  completedActions: {
    marginTop: spacing[5],
    alignSelf: 'flex-start',
  },
  practiceAgainButton: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  practiceAgainText: {
    ...typography.labelMD,
    color: practiceDarkText.title,
    fontWeight: '600',
    fontSize: 13.5,
  },
});
