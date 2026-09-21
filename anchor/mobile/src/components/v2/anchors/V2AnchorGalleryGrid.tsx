import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { spacing } from '@/theme/v2';
import type { AnchorLibraryEntry } from '@/hooks/v2/anchors';
import { V2AnchorGalleryItem } from './V2AnchorGalleryItem';

type Props = {
  entries: AnchorLibraryEntry[];
  onSelectAnchor: (anchorId: string) => void;
};

// V2Screen scrollContent uses paddingHorizontal: spacing[6] (24dp each side).
const SCREEN_HORIZONTAL_PADDING = spacing[6] * 2;
// 16dp negative space between the two columns.
const COLUMN_GAP = spacing[4];
// Maximum Anchor artwork diameter (matches circularAnchorSizes.large).
const MAX_ARTWORK_SIZE = 152;
// Internal horizontal breathing room within each cell (12dp each side).
const CELL_INTERNAL_BREATHING = spacing[3] * 2;
// Maximum container width to maintain gallery proportions on tablets.
const MAX_GRID_WIDTH = 440;

/**
 * Responsive 2-column circular gallery.
 *
 * Cell width is computed deterministically from the available screen width minus
 * safe horizontal padding and column gap. Artwork scales cleanly within the cell
 * with dedicated negative space, preventing collisions or edge-clipping across
 * all device viewports.
 */
export function V2AnchorGalleryGrid({ entries, onSelectAnchor }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth - SCREEN_HORIZONTAL_PADDING, MAX_GRID_WIDTH);
  const availableWidth = Math.max(0, contentWidth - COLUMN_GAP);
  const itemWidth = Math.floor(availableWidth / 2);
  const artworkSize = Math.min(
    MAX_ARTWORK_SIZE,
    Math.max(80, itemWidth - CELL_INTERNAL_BREATHING)
  );

  return (
    <View style={[styles.grid, { columnGap: COLUMN_GAP }]} accessibilityRole="list">
      {entries.map(({ anchor, released, isSelected }) => (
        <View key={anchor.localId ?? anchor.id} style={[styles.cell, { width: itemWidth }]}>
          <V2AnchorGalleryItem
            anchor={anchor}
            released={released}
            selected={isSelected}
            artworkSize={artworkSize}
            onPress={() => onSelectAnchor(anchor.localId ?? anchor.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing[7], // 32dp deliberate separation between rows
    alignSelf: 'center',
    width: '100%',
  },
  cell: {
    flexShrink: 0,
  },
});
