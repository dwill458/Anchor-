/**
 * Next direction callout ("Next week") for Weekly Insight.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx.
 * One calm forward-looking sentence in an accent-bordered box.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/v2';

interface WeeklyNextDirectionProps {
  nextDirection: string;
  accentColor: string;
  testID?: string;
}

export const WeeklyNextDirection: React.FC<WeeklyNextDirectionProps> = ({
  nextDirection,
  accentColor,
  testID = 'weekly-next-direction',
}) => {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.title}>NEXT WEEK</Text>
      <View style={[styles.calloutBox, { borderLeftColor: accentColor }]}>
        <Text style={styles.body}>{nextDirection}</Text>
      </View>
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
  calloutBox: {
    borderLeftWidth: 2,
    paddingLeft: 14,
    paddingVertical: 2,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 14.5,
    lineHeight: 21.5,
    color: colors.text.primary,
  },
});
