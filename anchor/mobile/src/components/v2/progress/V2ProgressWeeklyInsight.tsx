import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { radii, typography } from '@/theme/v2';
import type { V2ProgressInsight } from '@/adapters/v2/progress/types';
import { progressTokens } from './progressTokens';

export interface V2ProgressWeeklyInsightProps {
  insight: V2ProgressInsight;
  /** Opens the full Weekly Insight. Without it the card is a plain read. */
  onPress?: () => void;
  testID?: string;
}

/** Three small bars in gold: the Weekly Insight mark. */
const Mark: React.FC = () => (
  <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={[styles.bar, { height: 10 }]} />
    <View style={[styles.bar, { height: 18 }]} />
    <View style={[styles.bar, { height: 14 }]} />
  </View>
);

/**
 * The Weekly Insight card: it interprets the week (rhythm against movement)
 * rather than restating numbers. The words come from `buildProgressInsight`.
 */
export const V2ProgressWeeklyInsight: React.FC<V2ProgressWeeklyInsightProps> = ({
  insight,
  onPress,
  testID = 'v2-progress-weekly-insight',
}) => {
  const label = `Weekly Insight. ${insight.headline} ${insight.support}`;
  const content = (
    <>
      <Mark />
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>WEEKLY INSIGHT</Text>
        <Text style={styles.headline}>{insight.headline}</Text>
        <Text style={styles.support}>{insight.support}</Text>
      </View>
      {onPress ? <ChevronRight size={20} color={progressTokens.heroMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.card} testID={testID} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} style={styles.card} testID={testID} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: progressTokens.heroBg,
    borderRadius: radii.xl,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, width: 22, height: 20 },
  bar: { width: 4, borderRadius: 2, backgroundColor: progressTokens.gold },
  copy: { flex: 1 },
  eyebrow: { ...typography.labelSM, fontSize: 10, letterSpacing: 1.4, color: progressTokens.heroFaint },
  headline: { fontFamily: progressTokens.serif, fontSize: 18, lineHeight: 23, color: progressTokens.heroText, marginTop: 5 },
  support: { ...typography.bodySM, color: progressTokens.heroMuted, marginTop: 5 },
});
