/**
 * Evidence metrics row + comparison sentence for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx.
 * Renders 3 clean tabular columns defending the headline with real facts,
 * followed by one contextual comparison sentence.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';

interface WeeklyEvidenceRowProps {
  evidence: [string, string, string][];
  comparison: string;
  comparisonTone?: 'neutral' | 'positive';
  accentColor: string;
  testID?: string;
}

export const WeeklyEvidenceRow: React.FC<WeeklyEvidenceRowProps> = ({
  evidence,
  comparison,
  comparisonTone = 'neutral',
  accentColor,
  testID = 'weekly-evidence-row',
}) => {
  const isPositive = comparisonTone === 'positive';

  return (
    <View style={styles.container} testID={testID}>
      {/* 3 Tabular Evidence Columns */}
      <View style={styles.evidenceRow}>
        {evidence.map(([value, label, sub], index) => (
          <View
            key={`evidence-${index}`}
            style={[
              styles.evidenceItem,
              index > 0 && styles.borderedItem,
              index === 0 && styles.firstItem,
              index === evidence.length - 1 && styles.lastItem,
            ]}
          >
            <Text style={styles.evidenceValue} numberOfLines={1}>
              {value}
            </Text>
            <Text style={styles.evidenceLabel} numberOfLines={1}>
              {label.toUpperCase()}
            </Text>
            <Text style={styles.evidenceSub} numberOfLines={2}>
              {sub}
            </Text>
          </View>
        ))}
      </View>

      {/* Comparison Statement */}
      <View style={styles.comparisonRow}>
        <Text
          style={[
            styles.comparisonIcon,
            isPositive ? { color: accentColor, fontWeight: '800' } : styles.neutralIcon,
          ]}
        >
          {isPositive ? '↗' : '•'}
        </Text>
        <Text style={styles.comparisonText}>{comparison}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  evidenceRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: 20,
  },
  evidenceItem: {
    flex: 1,
    paddingHorizontal: 12,
  },
  firstItem: {
    paddingLeft: 0,
  },
  lastItem: {
    paddingRight: 0,
  },
  borderedItem: {
    borderLeftWidth: 1,
    borderLeftColor: colors.border.default,
  },
  evidenceValue: {
    fontFamily: typography.displaySemiBold,
    fontSize: 23,
    lineHeight: 25,
    letterSpacing: -0.8,
    color: colors.text.primary,
  },
  evidenceLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    lineHeight: 13,
    color: colors.text.disabled,
    letterSpacing: 0.6,
    marginTop: 7,
  },
  evidenceSub: {
    fontFamily: typography.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingTop: 13,
  },
  comparisonIcon: {
    fontSize: 13,
    lineHeight: 16,
    marginTop: 1,
  },
  neutralIcon: {
    color: colors.text.secondary,
    fontSize: 16,
    lineHeight: 14,
  },
  comparisonText: {
    flex: 1,
    fontFamily: typography.body,
    fontSize: 12.5,
    lineHeight: 17.5,
    color: colors.text.secondary,
  },
});
