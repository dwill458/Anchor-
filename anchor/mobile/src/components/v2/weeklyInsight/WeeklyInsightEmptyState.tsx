/**
 * First-week empty state for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx:
 * Calm, encouraging, no guilt or gamification shaming.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';
import { V2Button } from '@/components/v2/primitives';

interface WeeklyInsightEmptyStateProps {
  onBack?: () => void;
  testID?: string;
}

export const WeeklyInsightEmptyState: React.FC<WeeklyInsightEmptyStateProps> = ({
  onBack,
  testID = 'weekly-insight-empty-state',
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.kicker}>WEEKLY INSIGHT</Text>
      <Text style={styles.title}>Building your first pattern.</Text>
      <Text style={styles.body}>
        Weekly Insight forms at the end of each completed week. As you complete practices and move
        with your Anchor, your weekly understanding will take shape here.
      </Text>
      {onBack && (
        <V2Button
          variant="secondary"
          onPress={onBack}
          style={styles.backBtn}
          testID={`${testID}-back-btn`}
        >
          Return to Home
        </V2Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  kicker: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.88,
    color: colors.text.disabled,
    marginBottom: 8,
  },
  title: {
    fontFamily: typography.displaySemiBold,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing[6],
  },
  backBtn: {
    minWidth: 160,
  },
});
