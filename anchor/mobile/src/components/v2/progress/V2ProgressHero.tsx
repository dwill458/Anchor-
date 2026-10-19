import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { getCategoryColor, typography } from '@/theme/v2';
import { formatProgressDate, getProgressVerdict } from '@/adapters/v2/progress/progressAdapter';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';
import type { Anchor } from '@/types';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { useAuraStrength } from '@/stores/devThreadStrengthStore';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useAnchorTransitionPlace, useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';
import { V2ProgressRing } from './V2ProgressRing';
import { progressTokens } from './progressTokens';

export interface V2ProgressHeroProps {
  model: V2ProgressModel;
  anchor?: Anchor;
  /** For tests: the clock the "last practiced" copy is relative to. */
  now?: Date;
  testID?: string;
}

/** Permanent structure stages, in order. Pip 1 = Forming … pip 5 = Reinforced. */
const STAGE_PIPS = ['Forming', 'Building', 'Established', 'Integrated', 'Reinforced'] as const;

/** Artwork diameter inside the 150dp ring. Sits cleanly within the 115dp inner stroke opening. */
const ARTWORK_SIZE = 104;

/** 1-5 for a reached stage, 0 while Unestablished. */
function stageNumber(stage: V2ProgressModel['highestEvolutionStage']): number {
  const index = STAGE_PIPS.indexOf(stage as (typeof STAGE_PIPS)[number]);
  return index + 1;
}

/**
 * The dark half of Progress: what this Anchor is, how steady it is, and the
 * current Thread stage it has reached. Header controls live in the screen.
 */
export const V2ProgressHero: React.FC<V2ProgressHeroProps> = ({ model, anchor, now, testID = 'v2-progress-hero' }) => {
  const { intention, category, threadStrength, unmeasured, highestEvolutionStage } = model;
  const currentAnchor = anchor ?? model.anchor;
  const glow = useAuraStrength(unmeasured ? null : threadStrength);
  const reduceMotion = useV2ReduceMotion();
  const verdict = getProgressVerdict(threadStrength, unmeasured, model.lastPracticedAt, now);
  const stage = unmeasured ? 0 : stageNumber(highestEvolutionStage);
  // A fact about the past, shown only when this device recorded the date. Never a status.
  const fullStrengthDate = formatProgressDate(model.fullStrengthAt);
  const fullStrengthFact = fullStrengthDate ? `Full Strength reached · First achieved ${fullStrengthDate}` : null;
  // The Anchor flies in from Details and settles in the ring: this view is where it lands (and leaves from).
  const place = useAnchorTransitionPlace('progress', currentAnchor?.id, 'bare', { measureDelayMs: Platform.OS === 'android' ? 120 : 0 });
  // Supporting UI arrives behind the Anchor in four calm groups; the ring's own group never rises (it holds the measured place).
  const titleReveal = useAnchorTransitionReveal('progress', 0);
  const ringReveal = useAnchorTransitionReveal('progress', 1, { rise: false });
  const verdictReveal = useAnchorTransitionReveal('progress', 2);
  const stagesReveal = useAnchorTransitionReveal('progress', 3);
  const hasVisualArt = Boolean(
    currentAnchor &&
      (currentAnchor.enhancedImageUrl || currentAnchor.baseSigilSvg || currentAnchor.reinforcedSigilSvg),
  );

  return (
    <View style={styles.container} testID={testID} accessible accessibilityRole="header">
      <Animated.View style={titleReveal}>
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

      <View style={styles.ringRow}>
        <Animated.View style={ringReveal}>
        <V2ProgressRing value={unmeasured ? null : threadStrength} testID={`${testID}-ring`}>
          {hasVisualArt && currentAnchor ? (
            <View
              ref={place.ref}
              collapsable={false}
              onLayout={place.onLayout}
              style={[styles.artworkPlace, place.hidden && styles.artworkHidden]}
            >
            <CircularAnchorRenderer
              {...anchorRenderProps(currentAnchor)}
              size={ARTWORK_SIZE}
              appearance="bare"
              aura={{ anchorId: `${currentAnchor.id}${glow.keySuffix}`, threadStrength: glow.strength, variant: 'details', active: true, reducedMotion: reduceMotion }}
              accessibilityLabel={`${categoryLabel(category)} Anchor artwork`}
              testID={`${testID}-artwork`}
            />
            </View>
          ) : null}
        </V2ProgressRing>
        </Animated.View>
        <Animated.View style={[styles.verdict, verdictReveal]}>
          <Text style={styles.headline}>{verdict.headline}</Text>
          {verdict.support ? <Text style={styles.support}>{verdict.support}</Text> : null}
        </Animated.View>
      </View>

      <Animated.View style={[styles.stages, stagesReveal]}>
        <View style={styles.stageRow}>
          <Text style={styles.eyebrow}>THREAD STAGE</Text>
          <Text style={styles.stageName}>{highestEvolutionStage}</Text>
        </View>
        <View style={styles.pips}>
          {STAGE_PIPS.map((name, index) => {
            const number = index + 1;
            return (
              <View
                key={name}
                testID={`${testID}-pip-${number}`}
                style={[
                  styles.pip,
                  number < stage && styles.pipReached,
                  number === stage && styles.pipCurrent,
                ]}
              />
            );
          })}
        </View>
        <View style={styles.pipLabels}>
          {STAGE_PIPS.map((name) => (
            <Text key={name} style={styles.pipLabel} numberOfLines={1}>
              {name}
            </Text>
          ))}
        </View>
        {fullStrengthFact ? (
          <Text style={styles.support} testID={`${testID}-full-strength`}>
            {fullStrengthFact}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 24 },
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
    marginTop: 6,
    marginBottom: 18,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  verdict: { flex: 1 },
  artworkPlace: { width: ARTWORK_SIZE, height: ARTWORK_SIZE },
  // Hidden in place (never unmounted) while the travelling copy stands in for it.
  artworkHidden: { opacity: 0 },
  headline: {
    fontFamily: progressTokens.serif,
    fontSize: 19,
    lineHeight: 24,
    color: progressTokens.heroText,
    marginBottom: 8,
  },
  support: { ...typography.bodySM, color: progressTokens.heroMuted, lineHeight: 18 },
  stages: { marginTop: 20 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 },
  stageName: { ...typography.labelMD, color: progressTokens.heroText },
  pips: { flexDirection: 'row', gap: 5 },
  pip: { flex: 1, height: 5, borderRadius: 3, backgroundColor: progressTokens.heroTrack },
  pipReached: { backgroundColor: progressTokens.heroText },
  pipCurrent: { backgroundColor: progressTokens.gold },
  pipLabels: { flexDirection: 'row', gap: 5, marginTop: 7 },
  pipLabel: {
    flex: 1,
    ...typography.caption,
    fontSize: 9.5,
    lineHeight: 12,
    color: progressTokens.heroFaint,
  },
});
