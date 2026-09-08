import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/v2';
import type { AnchorLibraryEntry } from '@/hooks/v2/anchors';
import { V2AnchorGalleryItem } from './V2AnchorGalleryItem';

type Props = {
  entries: AnchorLibraryEntry[];
  onSelectAnchor: (anchorId: string) => void;
};

/**
 * 3-column circular gallery. Visual first, minimal metadata. Wraps rather than
 * virtualizes so it composes inside the screen's single scroll view; Anchor
 * counts in practice stay well within a comfortable range for this.
 */
export function V2AnchorGalleryGrid({ entries, onSelectAnchor }: Props) {
  return (
    <View style={styles.grid} accessibilityRole="list">
      {entries.map(({ anchor, released, isSelected }) => (
        <View key={anchor.localId ?? anchor.id} style={styles.cell}>
          <V2AnchorGalleryItem
            anchor={anchor}
            released={released}
            selected={isSelected}
            onPress={() => onSelectAnchor(anchor.localId ?? anchor.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[6], columnGap: spacing[3] },
  cell: { width: '31%' },
});
