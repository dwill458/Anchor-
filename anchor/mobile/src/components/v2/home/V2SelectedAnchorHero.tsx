import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer, V2Badge } from '@/components/v2';
import { colors, getCategoryColor, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';

type Props = {
  anchor: Anchor;
  threadValue?: number;
  onPress?: () => void;
  testID?: string;
};

/**
 * The selected Anchor is the visual center of Home: circular artwork on a flat
 * category field, the intention as the display line, restrained category cue.
 * No coin, rim, aura, or rotating ring.
 */
export function V2SelectedAnchorHero({ anchor, threadValue, onPress, testID }: Props) {
  const label =
    `${anchor.intentionText}. ${categoryLabel(anchor.category)}.` +
    (threadValue !== undefined ? ` Thread Strength ${threadValue}.` : '') +
    ' View Anchor details.';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.container, pressed && onPress && styles.pressed]}
    >
      <Text style={styles.intention}>{anchor.intentionText}</Text>
      <View style={styles.categoryRow}>
        <View style={[styles.categoryDash, { backgroundColor: getCategoryColor(anchor.category) }]} />
        <V2Badge label={categoryLabel(anchor.category)} tone="category" value={anchor.category} />
      </View>
      <View style={styles.artwork}>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          category={anchor.category}
          size="hero"
          accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing[4], paddingVertical: spacing[2] },
  pressed: { opacity: 0.82 },
  intention: {
    ...typography.displayMedium,
    color: colors.text.primary,
    alignSelf: 'stretch',
  },
  categoryRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryDash: { width: 18, height: 2, borderRadius: 2 },
  artwork: { paddingVertical: spacing[4] },
});
