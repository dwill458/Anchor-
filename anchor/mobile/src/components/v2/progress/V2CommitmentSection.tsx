import type { ViewInstance } from 'react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { typography } from '@/theme/v2';
import type { V2ProgressModel, V2ProgressRange } from '@/adapters/v2/progress/types';
import { V2ProgressWeekCard } from './V2ProgressWeek';
import { V2ProgressRhythm } from './V2ProgressRhythm';
import { V2EvidenceSummary } from './V2EvidenceSummary';
import { V2ProgressGhostCard } from './V2ProgressGhostCard';
import { progressTokens } from './progressTokens';

export interface V2CommitmentSectionProps {
  model: V2ProgressModel;
  range: V2ProgressRange;
  onRangeChange: (range: V2ProgressRange) => void;
  onRangeMotionChange?: (moving: boolean) => void;
  weekRef?: React.Ref<ViewInstance>;
  rhythmRef?: React.Ref<ViewInstance>;
  testID?: string;
}

/**
 * "Your Commitment": this week and the longer Rhythm in one section, an earned record of days
 * practiced. It keeps the existing Thread Strength grace rules (read from the model, never
 * recomputed) and never shows a lifetime figure the hero already carries. The detailed mode
 * breakdown sits behind a secondary "Practice insights" toggle.
 */
export const V2CommitmentSection: React.FC<V2CommitmentSectionProps> = ({
  model,
  range,
  onRangeChange,
  onRangeMotionChange,
  weekRef,
  rhythmRef,
  testID = 'v2-progress-commitment',
}) => {
  const [insightsOpen, setInsightsOpen] = React.useState(false);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.heading}>YOUR COMMITMENT</Text>
        <Text style={styles.subtitle}>An honest record of the days you showed up.</Text>
      </View>

      {model.unmeasured ? (
        <V2ProgressGhostCard
          testID={`${testID}-empty`}
          title="Your rhythm will draw itself here."
          body="A calendar, minutes practiced and how steady you are, all from sessions you actually complete."
        />
      ) : (
        <>
          {model.week ? (
            <View ref={weekRef} collapsable={false}>
              <V2ProgressWeekCard
                week={model.week}
                streak={model.streak}
                longestRhythm={model.rhythm?.Year.bestRun}
                testID={`${testID}-week`}
              />
            </View>
          ) : null}
          {model.rhythm && model.heatmap ? (
            <View ref={rhythmRef} collapsable={false}>
              <V2ProgressRhythm
                model={model}
                range={range}
                onRangeChange={onRangeChange}
                onRangeMotionChange={onRangeMotionChange}
                testID={`${testID}-rhythm`}
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => setInsightsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: insightsOpen }}
            style={styles.insightsToggle}
            testID={`${testID}-insights-toggle`}
          >
            <Text style={styles.insightsLabel}>Practice insights</Text>
            {insightsOpen ? (
              <ChevronUp size={16} color={progressTokens.muted} />
            ) : (
              <ChevronDown size={16} color={progressTokens.muted} />
            )}
          </Pressable>
          {insightsOpen ? <V2EvidenceSummary model={model} testID={`${testID}-insights`} /> : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { gap: 2 },
  heading: { ...typography.labelSM, fontSize: 11, letterSpacing: 1.6, color: progressTokens.text },
  subtitle: { ...typography.bodySM, color: progressTokens.muted },
  insightsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  insightsLabel: { ...typography.labelMD, color: progressTokens.text },
});
