import React, { memo, useCallback } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, type ListRenderItem } from 'react-native';
import { Reveal } from '@/components/v2/motion';
import { spacing } from '@/theme/v2';
import type { AnchorLibraryEntry } from '@/hooks/v2/anchors';
import { V2AnchorGalleryItem } from './V2AnchorGalleryItem';

type Props = {
  entries: AnchorLibraryEntry[];
  onSelectAnchor: (anchorId: string) => void;
  /** Stage the first viewport on arrival; later rows appear without a delayed entrance. */
  animateArrival?: boolean;
  header?: React.ReactElement;
  emptyState?: React.ReactElement;
};

// V2Screen provides paddingHorizontal: spacing[6] (24dp each side).
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
export function V2AnchorGalleryGrid({ entries, onSelectAnchor, animateArrival = false, header, emptyState }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth - SCREEN_HORIZONTAL_PADDING, MAX_GRID_WIDTH);
  const availableWidth = Math.max(0, contentWidth - COLUMN_GAP);
  const itemWidth = Math.floor(availableWidth / 2);
  const artworkSize = Math.min(
    MAX_ARTWORK_SIZE,
    Math.max(80, itemWidth - CELL_INTERNAL_BREATHING)
  );

  const renderItem = useCallback<ListRenderItem<AnchorLibraryEntry>>(
    ({ item: { anchor, released, isSelected }, index }) => (
      <GalleryCell
        anchor={anchor}
        released={released}
        selected={isSelected}
        artworkSize={artworkSize}
        itemWidth={itemWidth}
        // Only the first viewport stages its entrance. Scrolled-in cells are
        // already present, rather than starting delayed animations on a fling.
        animate={animateArrival && index < 8}
        index={index}
        onSelectAnchor={onSelectAnchor}
      />
    ),
    [animateArrival, artworkSize, itemWidth, onSelectAnchor],
  );

  return (
    <FlatList
      accessibilityRole="list"
      data={entries}
      numColumns={2}
      keyExtractor={anchorKey}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={emptyState}
      columnWrapperStyle={[styles.row, { width: contentWidth }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={4}
      maxToRenderPerBatch={2}
      windowSize={5}
      removeClippedSubviews={false}
    />
  );
}

const anchorKey = ({ anchor }: AnchorLibraryEntry) => anchor.localId ?? anchor.id;

const GalleryCell = memo(function GalleryCell({ anchor, released, selected, artworkSize, itemWidth, animate, index, onSelectAnchor }: {
  anchor: AnchorLibraryEntry['anchor'];
  released: boolean;
  selected: boolean;
  artworkSize: number;
  itemWidth: number;
  animate: boolean;
  index: number;
  onSelectAnchor: Props['onSelectAnchor'];
}) {
  const onPress = useCallback(() => onSelectAnchor(anchor.localId ?? anchor.id), [anchor.id, anchor.localId, onSelectAnchor]);
  return (
    <Reveal order={index + 2} enabled={animate} style={[styles.cell, { width: itemWidth }]}>
      <V2AnchorGalleryItem anchor={anchor} released={released} selected={selected} artworkSize={artworkSize} onPress={onPress} />
    </Reveal>
  );
});

const styles = StyleSheet.create({
  row: {
    columnGap: COLUMN_GAP,
    marginBottom: spacing[7],
    alignSelf: 'center',
  },
  content: { paddingTop: spacing[5], paddingBottom: spacing[9] - spacing[7] },
  cell: {
    flexShrink: 0,
  },
});
