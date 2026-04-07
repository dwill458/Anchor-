/**
 * Anchor App - Intent Format Feedback Component
 *
 * Provides real-time feedback on intention formatting.
 * Detects weak language patterns and suggests optimal phrasing.
 * Based on Phil Cooper's methodology: present tense, declarative statements.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface IntentFormatFeedbackProps {
  intentionText: string;
}

interface IntentAnalysis {
  isOptimal: boolean;
  hasWantingWords: boolean;
  hasFutureTense: boolean;
  hasDoubtWords: boolean;
  hasPresentTense: boolean;
  suggestions: string[];
}

/**
 * Analyzes intention text for optimal formatting
 */
const analyzeIntent = (text: string): IntentAnalysis => {
  const lowercaseText = text.toLowerCase();

  const hasWantingWords = /\b(want|need|wish|desire|hope|pray)\b/.test(lowercaseText);
  const hasFutureTense = /\b(will|shall|going to|gonna|someday|eventually)\b/.test(lowercaseText);
  const hasDoubtWords = /\b(maybe|might|could|perhaps|hopefully|try)\b/.test(lowercaseText);
  const hasPresentTense = /\b(am|is|are|have|has|being|exists?)\b/.test(lowercaseText);

  const suggestions: string[] = [];

  if (hasWantingWords) {
    suggestions.push("Replace 'want/need/wish' with 'am/have/is'");
  }
  if (hasFutureTense) {
    suggestions.push("Use present tense ('I am' not 'I will')");
  }
  if (hasDoubtWords) {
    suggestions.push("Remove doubt words like 'maybe/might/try'");
  }

  const isOptimal = hasPresentTense && !hasWantingWords && !hasFutureTense && !hasDoubtWords;

  return {
    isOptimal,
    hasWantingWords,
    hasFutureTense,
    hasDoubtWords,
    hasPresentTense,
    suggestions,
  };
};

/**
 * IntentFormatFeedback Component
 */
export const IntentFormatFeedback: React.FC<IntentFormatFeedbackProps> = ({
  intentionText
}) => {
  // Don't show feedback until user has typed something meaningful
  if (!intentionText || intentionText.length < 3) {
    console.log('[IntentFormatFeedback] Text too short:', intentionText.length);
    return null;
  }

  const analysis = analyzeIntent(intentionText);
  console.log('[IntentFormatFeedback] Analysis:', {
    text: intentionText,
    isOptimal: analysis.isOptimal,
    suggestions: analysis.suggestions.length
  });

  if (analysis.isOptimal) {
    return (
      <View style={[styles.feedbackContainer, styles.successFeedback]}>
        <Text style={styles.successIcon}>✨</Text>
        <Text style={styles.successText}>
          Your intention is powerful and clear!
        </Text>
      </View>
    );
  }

  if (analysis.suggestions.length === 0) {
    return null;
  }

  return (
    <View style={[styles.feedbackContainer, styles.suggestionFeedback]}>
      <Text style={styles.suggestionIcon}>💡</Text>
      <View style={styles.suggestionTextContainer}>
        {analysis.suggestions.map((suggestion, index) => (
          <Text key={index} style={styles.suggestionText}>
            • {suggestion}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  successFeedback: {
    backgroundColor: `${colors.success}15`, // 15% opacity
    borderColor: colors.success,
  },
  suggestionFeedback: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  successIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  successText: {
    flex: 1,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.success,
    fontWeight: '600',
  },
  suggestionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.warning,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
});
