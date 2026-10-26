import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { getCategoryColor, typography } from '@/theme/v2';
import { formatProgressDate, getProgressVerdict } from '@/adapters/v2/progress/progressAdapter';
import { formatFocusTime } from '@/adapters/v2/progress/journeyAdapter';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';
import type { Anchor } from '@/types';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { useAuraStrength, useThreadStrengthPreview } from '@/stores/devThreadStrengthStore';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useAnchorTransitionPlace, useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';
import {
  THREAD_STRENGTH_LEVELS,
  getThreadStrengthLevel,
  type ThreadStrengthLevel,
} from '@/constants/v2/threadEvents';
import { ThreadStrengthExplainerSheet } from '@/components/v2/thread/ThreadStrengthExplainerSheet';
import { progressTokens } from './progressTokens';

export interface V2ProgressHeroProps {
  model: V2ProgressModel;
  anchor?: Anchor;
  /** For tests: the clock the "last practiced" copy is relative to. */
  now?: Date;
  testID?: string;
}

/** Compact artwork retains room for the real aura without dominating the viewport. */
export function heroArtworkSize(windowWidth: number, _windowHeight: number): number {
  return Math.round(Math.max(100, Math.min(120, windowWidth * 0.28)));
}

export const LEVELS: { value: number; label: ThreadStrengthLevel }[] = [
  { value: 0, label: 'Surface' },
  { value: 20, label: 'Grounded' },
  { value: 40, label: 'Rooted' },
  { value: 60, label: 'Embedded' },
  { value: 80, label: 'Sovereign' },
];

export function format7DayChange(
  model: V2ProgressModel,
  anchor?: Anchor,
  now: Date = new Date(),
): string {
  if (model.delta7dStatus === 'FIRST_WEEK') {
    return 'Building your first week';
  }
  const currentAnchor = anchor ?? model.anchor;
  if (currentAnchor?.createdAt) {
    const createdTime = new Date(currentAnchor.createdAt).getTime();
    if (!Number.isNaN(createdTime)) {
      const nowTime = now.getTime();
      const diffDays = (nowTime - createdTime) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        return 'Building your first week';
      }
    }
  }
  if (typeof model.delta7d === 'number' && Number.isFinite(model.delta7d)) {
    const signed = model.delta7d > 0 ? `+${model.delta7d}` : `${model.delta7d}`;
    return `${signed} this week`;
  }
  return '7-day change unavailable';
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
 * The compact navy hero retains real artwork, aura, score, progression and lifetime figures.
 */
export const V2ProgressHero: React.FC<V2ProgressHeroProps> = ({ model, anchor, now, testID = 'v2-progress-hero' }) => {
  const { intention, category } = model;
  const threadStrength = useThreadStrengthPreview(model.unmeasured ? null : model.threadStrength);
  const unmeasured = threadStrength === null;
  const currentAnchor = anchor ?? model.anchor;
  const [explanationOpen, setExplanationOpen] = React.useState(false);
  const levelLabel = threadStrength !== null ? getThreadStrengthLevel(threadStrength) : 'Surface';
  const activeLevel = LEVELS.find((item) => item.label === levelLabel) ?? LEVELS[0];
  const { width, height } = useWindowDimensions();
  React.useEffect(() => setExplanationOpen(false), [model.anchorId]);
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
    <View style={styles.container} testID={testID}>
      <Animated.View style={[styles.titleBlock, titleReveal]}>
        {category ? (
          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(category) }]} />
            <Text style={styles.eyebrow}>{categoryLabel(category).toUpperCase()}</Text>
          </View>
        ) : null}
        <Text style={styles.intention}>
          {intention}
        </Text>
      </Animated.View>

      <View style={styles.heroRow}>
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
              <Pressable onPress={() => setExplanationOpen(true)} accessibilityRole="button" accessibilityLabel="Explain Thread Strength" style={styles.explain} testID={`${testID}-explain`}>
                <Text style={styles.eyebrow}>THREAD STRENGTH</Text>
              </Pressable>
              <Pressable onPress={() => setExplanationOpen(true)} accessibilityRole="button" accessibilityLabel={`Thread Strength ${threadStrength}, ${levelLabel}. Explain Thread Strength`} style={styles.scoreRow} testID={`${testID}-score`}>
                <Text style={styles.strengthNumber} testID={`${testID}-strength`}>
                  {threadStrength}
                </Text>
                <View style={styles.levelPill} testID={`${testID}-level`}>
                  <Text style={styles.levelText}>{levelLabel.toUpperCase()}</Text>
                </View>
              </Pressable>
              <Text style={styles.support}>{format7DayChange(model, currentAnchor, now ?? new Date())}</Text>
            </>
          ) : null}
        </Animated.View>

      </View>
      <Animated.View style={copyReveal}>
        <Text style={styles.headline} testID={`${testID}-message`}>{message.headline}</Text>
        {unmeasured && message.support ? <Text style={styles.support}>{message.support}</Text> : null}
        {fullStrengthFact ? (
          <Text style={[styles.support, styles.fact]} testID={`${testID}-full-strength`}>
            {fullStrengthFact}
          </Text>
        ) : null}
      </Animated.View>
      {!unmeasured && threadStrength !== null ? (
        <View style={styles.levels} accessibilityLabel={`Current level ${levelLabel}`}>
          {LEVELS.map(item => (
            <View key={item.value} style={styles.levelStep}>
              <View style={[styles.levelTrack, threadStrength >= item.value && styles.levelReached]} />
              <Text style={[styles.levelLabel, activeLevel.value === item.value && styles.levelActive]}>{item.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {explanationOpen ? <ThreadStrengthExplainerSheet visible onClose={() => setExplanationOpen(false)} strength={threadStrength} accentColor={category ? getCategoryColor(category) : undefined} /> : null}
      <Animated.View style={[styles.stats, statsReveal]} testID={`${testID}-stats`}>
        {stats.map((stat, index) => (
          <View key={stat.key} style={[styles.stat, index > 0 && styles.statDivider]} testID={`${testID}-stat-${stat.key}`}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>
              {stat.label}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingBottom: 14 },
  titleBlock: { alignItems: 'flex-start', marginBottom: 6 },
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
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.24,
    color: progressTokens.heroText,
    textAlign: 'left',
    marginTop: 2,
  },
  // Room for the aura, which spills past the artwork; nothing here clips it.
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  art: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  // Hidden in place (never unmounted) while the travelling copy stands in for it.
  artworkHidden: { opacity: 0 },
  strengthBlock: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  explain: { minHeight: 44, justifyContent: 'center' },
  levels: { flexDirection: 'row', gap: 4, marginTop: 8 },
  levelStep: { flex: 1, minWidth: 0 },
  levelTrack: { height: 4, borderRadius: 2, backgroundColor: progressTokens.heroTrack, marginBottom: 5 },
  levelReached: { backgroundColor: progressTokens.gold },
  levelLabel: { ...typography.caption, fontSize: 9, color: progressTokens.heroMuted, textAlign: 'center' },
  levelActive: { color: progressTokens.gold },
  strengthNumber: {
    fontFamily: progressTokens.serif,
    fontSize: 40,
    lineHeight: 44,
    color: progressTokens.heroText,
  },
  levelPill: {
    flexShrink: 1,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: progressTokens.gold,
  },
  levelText: { ...typography.labelSM, fontSize: 10.5, letterSpacing: 1.6, color: progressTokens.gold },
  headline: {
    ...typography.bodySM,
    color: progressTokens.heroText,
    textAlign: 'left',
    marginTop: 4,
    lineHeight: 18,
  },
  support: { ...typography.bodySM, color: progressTokens.heroMuted, lineHeight: 18, textAlign: 'left' },
  fact: { marginTop: 6 },
  stats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: progressTokens.heroHairline,
    backgroundColor: progressTokens.heroTrack,
  },
  stat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: progressTokens.heroHairline },
  statValue: { fontFamily: progressTokens.serif, fontSize: 20, lineHeight: 24, color: progressTokens.heroText },
  statLabel: { textAlign: 'center', ...typography.caption, fontSize: 10.5, color: progressTokens.heroMuted, marginTop: 2 },
});
