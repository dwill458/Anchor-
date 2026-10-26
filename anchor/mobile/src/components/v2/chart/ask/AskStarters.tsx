import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CHART_COPY } from '@/constants/v2/chartCopy';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

export type AskStarter = { key: string; label: string; onPress: () => void };

type Props = { starters: AskStarter[]; accent: AskAccent; reducedMotion: boolean };

/**
 * Ways to start the conversation with a skill (break a move down, plan the week, find another way). Each sends a real
 * message with its skill, so Ask Chart answers with the bounded tools for that skill. The person can always type instead.
 */
export const AskStarters = memo(function AskStarters({ starters, accent, reducedMotion }: Props) {
  if (starters.length === 0) return null;
  return (
    <View style={styles.wrap} testID="ask-starters">
      <Text style={styles.label}>{CHART_COPY.ask.startersLabel}</Text>
      <View style={styles.row}>
        {starters.map((starter, index) => (
          <Animated.View key={starter.key} entering={reducedMotion ? undefined : FadeInDown.duration(180).delay(index * 45)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={starter.label}
              onPress={starter.onPress}
              style={({ pressed }) => [styles.chip, { borderColor: accent.border }, pressed && { backgroundColor: accent.wash }]}
              testID={`ask-starter-${starter.key}`}
            >
              <Text style={styles.chipText}>{starter.label}</Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing[5], paddingBottom: spacing[3], gap: spacing[2] },
  label: { ...typography.labelSM, color: colors.text.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[4], borderRadius: radii.pill, borderWidth: 1, backgroundColor: colors.surface },
  chipText: { ...typography.labelMD, color: colors.text.primary },
});
