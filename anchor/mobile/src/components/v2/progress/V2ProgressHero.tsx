import React from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { getCategoryColor, typography } from '@/theme/v2';
import { formatProgressDate, getProgressVerdict } from '@/adapters/v2/progress/progressAdapter';
import { formatFocusTime } from '@/adapters/v2/progress/journeyAdapter';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';
import type { Anchor } from '@/types';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { useAuraStrength } from '@/stores/devThreadStrengthStore';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useAnchorTransitionPlace, useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';
import { progressTokens } from './progressTokens';

export interface V2ProgressHeroProps {
  model: V2ProgressModel;
  anchor?: Anchor;
  /** For tests: the clock the "last practiced" copy is relative to. */
  now?: Date;
  testID?: string;
}

const MIN_ARTWORK = 190;
const MAX_ARTWORK = 256;

/**
 * Anchor artwork size: about 230–260dp on a typical phone, easing down on short screens so the
 * hero stays near 40–45% of the viewport once the header and stats are added.
 */
export function heroArtworkSize(windowWidth: number, windowHeight: number): number {
  const byWidth = windowWidth * 0.64;
  const byHeight = windowHeight * 0.3;
  return Math.round(Math.max(MIN_ARTWORK, Math.min(MAX_ARTWORK, byWidth, byHeight)));
}

export interface HeroStat {
  key: 'days' | 'time' | 'waypoints' | 'practices';
  value: string;
  label: string;
}

/**
 * Three lifetime statistics from persisted data. Waypoints only appear once at least one is
 * reached; otherwise completed practices stand in, so a permanent "0 waypoints" never shows.
 */
export function heroStats(model: V2ProgressModel): HeroStat[] {
  const lifetime = model.lifetime;
  const practices = lifetime?.practices ?? model.practiceSummary.totalSessions;
  const days = lifetime?.activeDays ?? 0;
  const seconds = lifetime?.totalSeconds ?? model.practiceSummary.totalDurationSeconds;
  const waypoints = lifetime?.waypointsReached ?? 0;
  return [
    { key: 'days', value: String(days), label: days === 1 ? 'Day invested' : 'Days invested' },
    { key: 'time', value: formatFocusTime(seconds), label: 'Total focus time' },
    waypoints > 0
      ? { key: 'waypoints', value: String(waypoints), label: waypoints === 1 ? 'Waypoint reached' : 'Waypoints reached' }
      : { key: 'practices', value: String(practices), label: practices === 1 ? 'Practice completed' : 'Practices completed' },
  ];
}

/**
 * The dark half of Progress: this Anchor large, with the existing Thread Strength glow as the only
 * strength visual, its number and level, a personal line and three lifetime figures.
 */
export const V2ProgressHero: React.FC<V2ProgressHeroProps> = ({ model, anchor, now, testID = 'v2-progress-hero' }) => {
  const { intention, category, threadStrength, unmeasured, highestEvolutionStage } = model;
  const currentAnchor = anchor ?? model.anchor;
  const { width, height } = useWindowDimensions();
  const artworkSize = heroArtworkSize(width, height);
  // Null strength draws no glow, so a zero-strength Anchor never shows artificial strength.
  const glow = useAuraStrength(unmeasured ? null : threadStrength);
  const reduceMotion = useV2ReduceMotion();
  const practices = model.lifetime?.practices ?? model.practiceSummary.totalSessions;
  const verdict = getProgressVerdict(threadStrength, unmeasured, model.lastPracticedAt, now);
  const fullStrengthDate = formatProgressDate(model.fullStrengthAt);
  const fullStrengthFact = fullStrengthDate ? `Full Strength reached · First achieved ${fullStrengthDate}` : null;
  const stats = heroStats(model);
  // The Anchor flies in from Details and settles here: this view is where it lands (and leaves from).
  const place = useAnchorTransitionPlace('progress', currentAnchor?.id, 'bare', { measureDelayMs: Platform.OS === 'android' ? 120 : 0 });
  const titleReveal = useAnchorTransitionReveal('progress', 0);
  const artReveal = useAnchorTransitionReveal('progress', 1, { rise: false });
  const copyReveal = useAnchorTransitionReveal('progress', 2);
  const statsReveal = useAnchorTransitionReveal('progress', 3);
  const hasVisualArt = Boolean(
    currentAnchor && (currentAnchor.enhancedImageUrl || currentAnchor.baseSigilSvg || currentAnchor.reinforcedSigilSvg),
  );

  const message =
    practices > 0
      ? { headline: `You've returned to this intention ${practices} ${practices === 1 ? 'time' : 'times'}.`, support: 'Every practice adds to who you’re becoming.' }
      : verdict;

  return (
    <View style={styles.container} testID={testID} accessible accessibilityRole="header">
      <Animated.View style={[styles.titleBlock, titleReveal]}>
        {category ? (
          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category) }]} />
            <Text style={styles.eyebrow}>{categoryLabel(category).toUpperCase()}</Text>
          </View>
        ) : null}
        <Text style={styles.intention} numberOfLines={3}>
          {intention}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.art, { height: artworkSize + 16 }, artReveal]}>
        {hasVisualArt && currentAnchor ? (
          <View
            ref={place.ref}
            collapsable={false}
            onLayout={place.onLayout}
            style={[{ width: artworkSize, height: artworkSize }, place.hidden && styles.artworkHidden]}
          >
            <CircularAnchorRenderer
              {...anchorRenderProps(currentAnchor)}
              size={artworkSize}
              appearance="bare"
              aura={{ anchorId: `${currentAnchor.id}${glow.keySuffix}`, threadStrength: glow.strength, variant: 'details', active: true, reducedMotion: reduceMotion }}
              accessibilityLabel={`${categoryLabel(category)} Anchor artwork`}
              testID={`${testID}-artwork`}
            />
          </View>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.strengthBlock, copyReveal]}>
        {!unmeasured && threadStrength !== null ? (
          <>
            <Text style={styles.strengthNumber} testID={`${testID}-strength`}>
              {threadStrength}
            </Text>
            <Text style={styles.eyebrow}>THREAD STRENGTH</Text>
            <View style={styles.levelPill} testID={`${testID}-level`}>
              <Text style={styles.levelText}>{highestEvolutionStage.toUpperCase()}</Text>
            </View>
          </>
        ) : null}
        <Text style={styles.headline} testID={`${testID}-message`}>{message.headline}</Text>
        {message.support ? <Text style={styles.support}>{message.support}</Text> : null}
        {fullStrengthFact ? (
          <Text style={[styles.support, styles.fact]} testID={`${testID}-full-strength`}>
            {fullStrengthFact}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.stats, statsReveal]} testID={`${testID}-stats`}>
        {stats.map((stat, index) => (
          <View key={stat.key} style={[styles.stat, index > 0 && styles.statDivider]} testID={`${testID}-stat-${stat.key}`}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {stat.label}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 20 },
  titleBlock: { alignItems: 'center' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  categoryDot: { width: 7, height: 7, borderRadius: 3.5 },
  eyebrow: {
    ...typography.labelSM,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: progressTokens.heroMuted,
  },
  intention: {
    fontFamily: progressTokens.serif,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.24,
    color: progressTokens.heroText,
    textAlign: 'center',
    marginTop: 6,
  },
  // Room for the aura, which spills past the artwork; nothing here clips it.
  art: { alignItems: 'center', justifyContent: 'center', marginTop: 10, overflow: 'visible' },
  // Hidden in place (never unmounted) while the travelling copy stands in for it.
  artworkHidden: { opacity: 0 },
  strengthBlock: { alignItems: 'center', marginTop: 4 },
  strengthNumber: {
    fontFamily: progressTokens.serif,
    fontSize: 40,
    lineHeight: 44,
    color: progressTokens.heroText,
  },
  levelPill: {
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: progressTokens.gold,
  },
  levelText: { ...typography.labelSM, fontSize: 10.5, letterSpacing: 1.6, color: progressTokens.gold },
  headline: {
    ...typography.bodySM,
    color: progressTokens.heroText,
    textAlign: 'center',
    lineHeight: 18,
  },
  support: { ...typography.bodySM, color: progressTokens.heroMuted, lineHeight: 18, textAlign: 'center' },
  fact: { marginTop: 6 },
  stats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
    backgroundColor: progressTokens.heroTrack,
  },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: progressTokens.heroHairline },
  statValue: { fontFamily: progressTokens.serif, fontSize: 20, lineHeight: 24, color: progressTokens.heroText },
  statLabel: { ...typography.caption, fontSize: 10.5, color: progressTokens.heroMuted, marginTop: 2 },
});
