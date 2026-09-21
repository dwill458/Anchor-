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
  artworkSize?: number;
  onPress?: () => void;
};

// Line height of typography.labelMD is 18dp. Reserving 2 lines (36dp) ensures
// 1-line and 2-line intentions align metadata across the row identically.
const INTENTION_BOX_HEIGHT = 36;

/** One circular gallery cell: artwork, concise intention, category + state cue. */
export function V2AnchorGalleryItem({
  anchor,
  released,
  selected = false,
  artworkSize = 128,
  onPress,
}: Props) {
  const state = categoryLabel(anchor.category);
  const status = released ? 'Released' : selected ? 'Current' : 'Active';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${anchor.intentionText}. ${state}, ${status}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={[styles.artworkContainer, { width: '100%', height: artworkSize }]}>
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(anchor)}
          imageUrl={anchor.enhancedImageUrl}
          category={anchor.category}
          size={artworkSize}
          state={released ? 'inactive' : 'active'}
          accessibilityLabel={`${state} Anchor`}
        />
      </View>
      <View style={styles.intentionContainer}>
        <Text numberOfLines={2} ellipsizeMode="tail" style={styles.title}>
          {anchor.intentionText}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.meta}>
        {state} · {status}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { width: '100%', alignItems: 'center' },
  pressed: { opacity: 0.7 },
  artworkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  intentionContainer: {
    width: '100%',
    minHeight: INTENTION_BOX_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[1],
  },
  title: { ...typography.labelMD, color: colors.text.primary, textAlign: 'center', textTransform: 'none' },
  meta: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
});
