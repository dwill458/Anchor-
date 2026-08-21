// Anchor – Visualize session configuration pill.
// The sheet itself now lives in `@/components/practice/SessionConfigurationSheet`
// (shared across Focus Session, Deep Prime, and Visualize). This file keeps only
// the pill trigger, which stays as-is per screen.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';

import { colors, typography } from '@/theme';
import { formatSessionAudioSummary, type SessionAudioDefaults } from '@/types/sessionAudio';

export const SessionConfigurationPill: React.FC<{
  value: SessionAudioDefaults;
  durationSeconds?: number;
  onPress: () => void;
}> = ({ value, durationSeconds, onPress }) => (
  <Pressable accessibilityRole="button" accessibilityLabel="Edit session configuration" onPress={onPress} style={styles.pill}>
    <SlidersHorizontal color={colors.gold} size={14} />
    <Text style={styles.pillText} numberOfLines={1}>
      {durationSeconds ? `${durationSeconds / 60} min · ` : ''}{formatSessionAudioSummary(value)}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,.28)', backgroundColor: 'rgba(14,31,55,.78)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: '92%' },
  pillText: { color: 'rgba(245,245,220,.78)', fontFamily: typography.fonts.body, fontSize: 12 },
});
