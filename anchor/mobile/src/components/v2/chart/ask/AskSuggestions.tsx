import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import { ASK_TOKENS, type AskAccent } from './askChartTheme';

type Props = {
  suggestions: string[];
  accent: AskAccent;
  reducedMotion: boolean;
  onPick: (text: string) => void;
  /** Sits in the conversation under the question (aligned with the Anchor's bubble) instead of above the composer. */
  inline?: boolean;
};

/**
 * Tappable replies. They sit above the composer (never over it), wrap onto a second line rather than scroll, and
 * enter with a short stagger. Tapping sends at once; the person can always type something else instead.
 */
export const AskSuggestions = memo(function AskSuggestions({ suggestions, accent, reducedMotion, onPick, inline }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <View style={[styles.wrap, inline && styles.inline]} testID="ask-suggestions">
      {suggestions.map((suggestion, index) => (
        <Animated.View key={suggestion} entering={reducedMotion ? undefined : FadeInDown.duration(180).delay(index * 45)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={suggestion}
            onPress={() => onPick(suggestion)}
            style={({ pressed }) => [styles.chip, { borderColor: accent.border }, pressed && { backgroundColor: accent.wash }]}
          >
            <View style={[styles.dot, { backgroundColor: accent.fill }]} />
            <Text style={styles.chipText}>{suggestion}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  inline: { paddingHorizontal: 0, paddingLeft: 46, paddingTop: spacing[3], paddingBottom: 0 },
  chip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], borderRadius: radii.pill, borderWidth: 1, backgroundColor: ASK_TOKENS.ivory, ...ASK_TOKENS.shadow, shadowOpacity: 0.08, shadowRadius: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...typography.labelMD, color: ASK_TOKENS.ink },
});
