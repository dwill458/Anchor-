import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FlatList, StyleSheet } from 'react-native';
import { Reveal } from '@/components/v2/motion';
import { V2AnchorGalleryGrid } from '../V2AnchorGalleryGrid';
import { V2AnchorGalleryItem } from '../V2AnchorGalleryItem';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import type { AnchorLibraryEntry } from '@/hooks/v2/anchors';

// Helper to mock useWindowDimensions
const mockUseWindowDimensions = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockUseWindowDimensions(),
}));

describe('V2AnchorGalleryGrid and V2AnchorGalleryItem layout', () => {
  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 667, scale: 2, fontScale: 1 });
  });

  const createEntries = (count: number, titles?: string[]): AnchorLibraryEntry[] =>
    Array.from({ length: count }, (_, i) => ({
      anchor: makeAnchor({
        id: `anchor-${i}`,
        intentionText: titles?.[i] ?? `Intention ${i + 1}`,
        category: (['career', 'health', 'abundance', 'mindset'][i % 4]) as any,
      }),
      released: i === 3,
      isSelected: i === 0,
    }));

  describe('Responsive grid calculations across viewports', () => {
    it.each([
      [375, 155, 327],
      [360, 148, 312],
      [390, 163, 342],
      [430, 183, 382],
      [768, 212, 440],
    ])('preserves two-column geometry at width %i', (width, itemWidth, gridWidth) => {
      mockUseWindowDimensions.mockReturnValue({ width, height: 844, scale: 2, fontScale: 1 });
      const view = render(<V2AnchorGalleryGrid entries={createEntries(4)} onSelectAnchor={jest.fn()} />);
      const list = view.UNSAFE_getByType(FlatList);
      expect(list.props.numColumns).toBe(2);
      expect(StyleSheet.flatten(list.props.columnWrapperStyle)).toMatchObject({ width: gridWidth, columnGap: 16, marginBottom: 32 });
      const cells = view.UNSAFE_getAllByType(Reveal);
      expect(cells).toHaveLength(4);
      cells.forEach((cell) => expect(StyleSheet.flatten(cell.props.style).width).toBe(itemWidth));
      expect(itemWidth * 2 + 16).toBeLessThanOrEqual(gridWidth);
    });
  });

  describe('Item counts and layout stability', () => {
    it('keeps a single Anchor at the normal column width', () => {
      const view = render(<V2AnchorGalleryGrid entries={createEntries(1)} onSelectAnchor={jest.fn()} />);
      const cells = view.UNSAFE_getAllByType(Reveal);
      expect(cells).toHaveLength(1);
      expect(StyleSheet.flatten(cells[0].props.style).width).toBe(155);
    });

    it('renders both Anchors in a row', () => {
      render(<V2AnchorGalleryGrid entries={createEntries(2)} onSelectAnchor={jest.fn()} />);
      expect(screen.getByText('Intention 1')).toBeTruthy();
      expect(screen.getByText('Intention 2')).toBeTruthy();
    });

    it('preserves mixed intention lengths and release/current metadata', () => {
      render(<V2AnchorGalleryGrid entries={createEntries(4, [
        'Short', 'A moderately long intention that wraps to two full lines',
        'Single line again', 'Another intention text with multiple words for testing',
      ])} onSelectAnchor={jest.fn()} />);
      expect(screen.getByText('Short')).toBeTruthy();
      expect(screen.getByText('A moderately long intention that wraps to two full lines')).toBeTruthy();
      expect(screen.getByText('Single line again')).toBeTruthy();
      expect(screen.getByText('Another intention text with multiple words for testing')).toBeTruthy();
      expect(screen.getByText('Career · Current')).toBeTruthy();
      expect(screen.getByText('Mindset · Released')).toBeTruthy();
    });

    it('renders an offscreen entry when its row enters the window and selects its local id', () => {
      const entries = createEntries(60);
      entries[59].anchor.localId = 'local-last';
      const onSelect = jest.fn();
      const view = render(<V2AnchorGalleryGrid entries={entries} animateArrival onSelectAnchor={onSelect} />);
      expect(view.UNSAFE_getAllByType(V2AnchorGalleryItem)).toHaveLength(8);
      expect(screen.queryByText('Intention 60')).toBeNull();
      const list = view.UNSAFE_getByType(FlatList);
      // Exercise the same renderer FlatList uses when scrolling exposes a later row.
      const last = render(list.props.renderItem({ item: entries[59], index: 59 }));
      expect(last.UNSAFE_getByType(Reveal).props.enabled).toBe(false);
      fireEvent.press(last.getByLabelText(/Intention 60/));
      expect(onSelect).toHaveBeenCalledWith('local-last');
    });
  });
  describe('Text wrapping and alignment stability', () => {
    it('reserves 36dp intention height for consistent vertical metadata alignment', () => {
      const anchor = makeAnchor({ intentionText: 'Short' });
      const { toJSON } = render(
        <V2AnchorGalleryItem anchor={anchor} released={false} artworkSize={128} />
      );
      const json = toJSON() as any;
      // Intention container has minHeight: 36
      const intentionContainer = json.children[1];
      expect(intentionContainer.props.style).toEqual(
        expect.objectContaining({ minHeight: 36 })
      );
      // Intention text has numberOfLines: 2, ellipsizeMode: 'tail'
      const titleText = intentionContainer.children[0];
      expect(titleText.props.numberOfLines).toBe(2);
      expect(titleText.props.ellipsizeMode).toBe('tail');
    });

    it('ellipsizes very long intention beyond 2 lines gracefully', () => {
      const anchor = makeAnchor({
        intentionText: 'This is an exceptionally long intention designed to test what happens when text far exceeds two displayable lines on mobile screens and must truncate cleanly',
      });
      render(<V2AnchorGalleryItem anchor={anchor} released={false} artworkSize={128} />);
      const textElement = screen.getByText(/This is an exceptionally long intention/);
      expect(textElement.props.numberOfLines).toBe(2);
      expect(textElement.props.ellipsizeMode).toBe('tail');
    });
  });
});
