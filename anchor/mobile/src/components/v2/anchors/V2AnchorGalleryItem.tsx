import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import type { Anchor } from '@/types';
import { anchorArtworkSvg, categoryLabel } from './anchorPresentation';

type Props = {
  anchor: Anchor;
  released: boolean;
  selected?: boolean;
  onPress?: () => void;
};

/** One circular gallery cell: artwork, concise intention, category + state cue. */
export function V2AnchorGalleryItem({ anchor, released, selected = false, onPress }: Props) {
  const state = categoryLabel(anchor.category);
  const status = released ? 'Released' : selected ? 'Current' : 'Active';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${anchor.intentionText}. ${state}, ${status}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
    >
      <CircularAnchorRenderer
        svg={anchorArtworkSvg(anchor)}
        category={anchor.category}
        size="large"
        state={released ? 'inactive' : 'active'}
        accessibilityLabel={`${state} Anchor`}
      />
      <Text numberOfLines={2} style={styles.title}>
        {anchor.intentionText}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {state} · {status}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  pressed: { opacity: 0.7 },
  title: { ...typography.labelMD, color: colors.text.primary, textAlign: 'center', textTransform: 'none' },
  meta: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
});
