import React from 'react';
import { render, screen } from '@testing-library/react-native';
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
    it('adapts to small iPhone viewport (width: 375)', () => {
      mockUseWindowDimensions.mockReturnValue({ width: 375, height: 667 });
      const entries = createEntries(4);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      expect(json).toBeTruthy();
      // Grid has role list and columnGap
      expect(json.props.accessibilityRole).toBe('list');
      expect(json.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ columnGap: 16 })])
      );
      // Each cell has deterministic width (available = 375 - 48 - 16 = 311, itemWidth = 155)
      const cells = json.children;
      expect(cells).toHaveLength(4);
      expect(cells[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 155 })])
      );
    });

    it('adapts to compact Android / iPhone mini viewport (width: 360)', () => {
      mockUseWindowDimensions.mockReturnValue({ width: 360, height: 800 });
      const entries = createEntries(2);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      // available = 360 - 48 - 16 = 296, itemWidth = 148
      expect(json.children[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 148 })])
      );
    });

    it('adapts to iPhone 14/15/16 viewport (width: 390)', () => {
      mockUseWindowDimensions.mockReturnValue({ width: 390, height: 844 });
      const entries = createEntries(2);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      // available = 390 - 48 - 16 = 326, itemWidth = 163
      expect(json.children[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 163 })])
      );
    });

    it('adapts to Pro Max / Plus viewport (width: 430)', () => {
      mockUseWindowDimensions.mockReturnValue({ width: 430, height: 932 });
      const entries = createEntries(2);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      // available = 430 - 48 - 16 = 366, itemWidth = 183
      expect(json.children[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 183 })])
      );
    });

    it('caps grid container width safely on tablet viewports (width: 768)', () => {
      mockUseWindowDimensions.mockReturnValue({ width: 768, height: 1024 });
      const entries = createEntries(2);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      // maxContent = 440, available = 440 - 16 = 424, itemWidth = 212
      expect(json.children[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 212 })])
      );
    });
  });

  describe('Item counts and layout stability', () => {
    it('renders single Anchor in 2-column grid without stretching full width', () => {
      const entries = createEntries(1);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      expect(json.children).toHaveLength(1);
      expect(json.children[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ width: 155 })])
      );
    });

    it('renders 2 Anchors side-by-side cleanly', () => {
      const entries = createEntries(2);
      const { toJSON } = render(
        <V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />
      );
      const json = toJSON() as any;
      expect(json.children).toHaveLength(2);
      expect(cellsFitWithinContent(json.children[0].props.style, json.children[1].props.style, 16, 327)).toBe(true);
    });

    it('renders 4+ Anchors (screenshot scenario with mixed styles)', () => {
      const entries = createEntries(4, [
        'Short',
        'A moderately long intention that wraps to two full lines',
        'Single line again',
        'Another intention text with multiple words for testing',
      ]);
      render(<V2AnchorGalleryGrid entries={entries} onSelectAnchor={jest.fn()} />);

      expect(screen.getByText('Short')).toBeTruthy();
      expect(screen.getByText('A moderately long intention that wraps to two full lines')).toBeTruthy();
      expect(screen.getByText('Single line again')).toBeTruthy();
      expect(screen.getByText('Another intention text with multiple words for testing')).toBeTruthy();
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

function cellsFitWithinContent(style1: any[], style2: any[], gap: number, maxContent: number) {
  const w1 = style1.find((s) => s?.width)?.width ?? 0;
  const w2 = style2.find((s) => s?.width)?.width ?? 0;
  return w1 + w2 + gap <= maxContent;
}
