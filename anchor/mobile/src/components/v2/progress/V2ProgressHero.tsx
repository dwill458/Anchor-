import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '@/theme/v2';
import { formatProgressDate, getProgressVerdict } from '@/adapters/v2/progress/progressAdapter';
import type { V2ProgressModel } from '@/adapters/v2/progress/types';
import { categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { V2ProgressRing } from './V2ProgressRing';
import { progressTokens } from './progressTokens';

export interface V2ProgressHeroProps {
  model: V2ProgressModel;
  /** For tests: the clock the "last practiced" copy is relative to. */
  now?: Date;
  testID?: string;
}

/** Permanent structure stages, in order. Pip 1 = Forming … pip 5 = Reinforced. */
const STAGE_PIPS = ['Forming', 'Building', 'Established', 'Integrated', 'Reinforced'] as const;

/** 1-5 for a reached stage, 0 while Unestablished. */
function stageNumber(stage: V2ProgressModel['highestEvolutionStage']): number {
  const index = STAGE_PIPS.indexOf(stage as (typeof STAGE_PIPS)[number]);
  return index + 1;
}

/**
 * The dark half of Progress: what this Anchor is, how steady it is, and the
 * permanent structure it has reached. Header controls live in the screen.
 */
export const V2ProgressHero: React.FC<V2ProgressHeroProps> = ({ model, now, testID = 'v2-progress-hero' }) => {
  const { intention, category, threadStrength, unmeasured, highestEvolutionStage } = model;
  const verdict = getProgressVerdict(threadStrength, unmeasured, model.lastPracticedAt, now);
  const stage = unmeasured ? 0 : stageNumber(highestEvolutionStage);
  // A fact about the past, shown only when this device recorded the date. Never a status.
  const fullStrengthDate = formatProgressDate(model.fullStrengthAt);
  const fullStrengthFact = fullStrengthDate ? `Full Strength reached · First achieved ${fullStrengthDate}` : null;

  return (
    <View style={styles.container} testID={testID} accessible accessibilityRole="header">
      {category ? <Text style={styles.eyebrow}>{categoryLabel(category).toUpperCase()}</Text> : null}
      <Text style={styles.intention} numberOfLines={3}>
        {intention}
      </Text>

      <View style={styles.ringRow}>
        <V2ProgressRing value={unmeasured ? null : threadStrength} testID={`${testID}-ring`} />
        <View style={styles.verdict}>
          <Text style={styles.headline}>{verdict.headline}</Text>
          {verdict.support ? <Text style={styles.support}>{verdict.support}</Text> : null}
        </View>
      </View>

      <View style={styles.stages}>
        <View style={styles.stageRow}>
          <Text style={styles.eyebrow}>PERMANENT STRUCTURE</Text>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, paddingBottom: 30 },
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
    marginBottom: 22,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  verdict: { flex: 1 },
  headline: {
    fontFamily: progressTokens.serif,
    fontSize: 19,
    lineHeight: 24,
    color: progressTokens.heroText,
    marginBottom: 8,
  },
  support: { ...typography.bodySM, color: progressTokens.heroMuted },
  stages: { marginTop: 24 },
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
