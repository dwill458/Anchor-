/**
 * Reflection feedback widget for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx:
 * Prompt: "Did this match how the week felt?" with Yes / Mostly / Not really chips.
 * Feedback never rewrites the historical snapshot.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { WeeklyInsightFeedbackRating } from '@/constants/v2/weeklyInsightRoutes';

interface WeeklyFeedbackWidgetProps {
  selectedRating?: WeeklyInsightFeedbackRating | null;
  onSelectRating: (rating: WeeklyInsightFeedbackRating) => void;
  testID?: string;
}

const RATINGS: WeeklyInsightFeedbackRating[] = ['Yes', 'Mostly', 'Not really'];

export const WeeklyFeedbackWidget: React.FC<WeeklyFeedbackWidgetProps> = ({
  selectedRating,
  onSelectRating,
  testID = 'weekly-feedback-widget',
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.line}>
        <Text style={styles.question}>Did this match how the week felt?</Text>
        <View style={styles.actions}>
          {RATINGS.map((rating) => {
            const isSelected = selectedRating === rating;
            return (
              <Pressable
                key={`rating-${rating}`}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => onSelectRating(rating)}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${rating}`}
                accessibilityState={{ selected: isSelected }}
                testID={`${testID}-chip-${rating.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {rating}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[1],
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: 18,
    gap: 12,
  },
  question: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.text.secondary,
    maxWidth: 160,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: 'transparent',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  chipText: {
    fontFamily: typography.bodyMedium,
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.text.primary,
  },
  chipTextSelected: {
    color: colors.canvas,
  },
});
