/**
 * Interpretation section ("What this means") for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx.
 * One short grounded explanation of why the evidence matters.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';

interface WeeklyInterpretationProps {
  interpretation: string;
  testID?: string;
}

export const WeeklyInterpretation: React.FC<WeeklyInterpretationProps> = ({
  interpretation,
  testID = 'weekly-interpretation',
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>WHAT THIS MEANS</Text>
      <Text style={styles.body}>{interpretation}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
  },
  title: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.text.disabled,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 14.5,
    lineHeight: 21.5,
    color: colors.text.secondary,
  },
});
