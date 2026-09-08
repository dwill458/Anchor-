import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2';
import { colors, spacing, typography } from '@/theme/v2';
import { v2Haptics } from '@/hooks/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';

type Props = {
  anchors: V2HomeAnchorSummary[];
  onSelect: (anchorId: string) => void;
};

/**
 * Open-canvas circular rail. Inactive Anchors stay visually subordinate. Tap
 * updates the selected Anchor in place — no modal.
 */
export function V2AnchorQuickSwitch({ anchors, onSelect }: Props) {
  if (anchors.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      accessibilityRole="tablist"
      accessibilityLabel="Switch selected Anchor"
    >
      {anchors.map(({ anchor, isSelected, thread }) => {
        const id = anchor.localId ?? anchor.id;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Select ${anchor.intentionText}, Thread Strength ${thread.value}`}
            onPress={() => {
              if (isSelected) return;
              v2Haptics.selection();
              onSelect(id);
            }}
            style={styles.item}
          >
            <CircularAnchorRenderer
              svg={anchorArtworkSvg(anchor)}
              category={anchor.category}
              size="thumbnail"
              state={isSelected ? 'active' : 'inactive'}
              accessibilityLabel={`${categoryLabel(anchor.category)} Anchor`}
            />
            <Text
              numberOfLines={1}
              style={[styles.label, isSelected ? styles.labelSelected : styles.labelInactive]}
            >
              {anchor.intentionText}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rail: { gap: spacing[4], paddingVertical: spacing[1], paddingRight: spacing[4] },
  item: { width: 72, alignItems: 'center', gap: spacing[2] },
  label: { ...typography.caption, textAlign: 'center', width: 72 },
  labelSelected: { color: colors.text.primary },
  labelInactive: { color: colors.text.disabled },
});
