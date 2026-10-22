import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, radii, spacing } from '@/theme/v2';
import { chartTypography as typography } from '../chartTypography';
import type { AskAccent } from './askChartTheme';

type Props = {
  suggestions: string[];
  accent: AskAccent;
  reducedMotion: boolean;
  onPick: (text: string) => void;
};

/**
 * Tappable replies. They sit above the composer (never over it), wrap onto a second line rather than scroll, and
 * enter with a short stagger. Tapping sends at once; the person can always type something else instead.
 */
export const AskSuggestions = memo(function AskSuggestions({ suggestions, accent, reducedMotion, onPick }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.wrap} testID="ask-suggestions">
      {suggestions.map((suggestion, index) => (
        <Animated.View key={suggestion} entering={reducedMotion ? undefined : FadeInDown.duration(180).delay(index * 45)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={suggestion}
            onPress={() => onPick(suggestion)}
            style={({ pressed }) => [styles.chip, { borderColor: accent.border }, pressed && { backgroundColor: accent.wash }]}
          >
            <Text style={styles.chipText}>{suggestion}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing[4], borderRadius: radii.pill, borderWidth: 1, backgroundColor: colors.surface },
  chipText: { ...typography.labelMD, color: colors.text.primary },
});
