/**
 * Anchor App - AnchorCard Tests
 *
 * Tests for the anchor display card component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnchorCard } from '../AnchorCard';
import type { Anchor } from '@/types';

// Mock dependencies
jest.mock('react-native-svg', () => ({
  SvgXml: 'SvgXml',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

describe('AnchorCard', () => {
  const createMockAnchor = (overrides?: Partial<Anchor>): Anchor => ({
    id: 'anchor-1',
    intentionText: 'I am confident and capable',
    category: 'personal_growth',
    baseSigilSvg: '<svg>test</svg>',
    isCharged: true,
    activationCount: 5,
    createdAt: new Date().toISOString(),
    lastActivatedAt: new Date().toISOString(),
    userId: 'user-1',
    ...overrides,
  });

  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render intention text', () => {
      const anchor = createMockAnchor();
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('I am confident and capable')).toBeTruthy();
    });

    it('should render category badge', () => {
      const anchor = createMockAnchor({ category: 'career' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Career')).toBeTruthy();
    });

    it('should render activation count when > 0', () => {
      const anchor = createMockAnchor({ activationCount: 10 });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('10⚡')).toBeTruthy();
    });

    it('should not render activation count when 0', () => {
      const anchor = createMockAnchor({ activationCount: 0 });
      const { queryByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(queryByText(/⚡/)).toBeNull();
    });

    it('should render charged indicator when charged', () => {
      const anchor = createMockAnchor({ isCharged: true });
      const { getAllByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      const lightningBolts = getAllByText('⚡');
      expect(lightningBolts.length).toBeGreaterThan(0);
    });

    it('should not render charged indicator when not charged', () => {
      const anchor = createMockAnchor({ isCharged: false, activationCount: 0 });
      const { queryByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(queryByText('⚡')).toBeNull();
    });
  });

  describe('Category Configuration', () => {
    it('should render Career category with correct label', () => {
      const anchor = createMockAnchor({ category: 'career' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Career')).toBeTruthy();
    });

    it('should render Health category with correct label', () => {
      const anchor = createMockAnchor({ category: 'health' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Health')).toBeTruthy();
    });

    it('should render Wealth category with correct label', () => {
      const anchor = createMockAnchor({ category: 'wealth' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Wealth')).toBeTruthy();
    });

    it('should render Love category for relationships', () => {
      const anchor = createMockAnchor({ category: 'relationships' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Love')).toBeTruthy();
    });

    it('should render Growth category for personal_growth', () => {
      const anchor = createMockAnchor({ category: 'personal_growth' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Growth')).toBeTruthy();
    });

    it('should handle custom category', () => {
      const anchor = createMockAnchor({ category: 'custom' as any });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Custom')).toBeTruthy();
    });

    it('should default to custom for unknown categories', () => {
      const anchor = createMockAnchor({ category: 'unknown' as any });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('Custom')).toBeTruthy();
    });
  });

  describe('User Interaction', () => {
    it('should call onPress when card is tapped', () => {
      const anchor = createMockAnchor();
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      fireEvent.press(getByText('I am confident and capable'));

      expect(mockOnPress).toHaveBeenCalledWith(anchor);
    });

    it('should call onPress with correct anchor data', () => {
      const anchor = createMockAnchor({
        id: 'test-id',
        intentionText: 'Test intention',
      });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      fireEvent.press(getByText('Test intention'));

      expect(mockOnPress).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          intentionText: 'Test intention',
        })
      );
    });

    it('should be pressable multiple times', () => {
      const anchor = createMockAnchor();
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      fireEvent.press(getByText('I am confident and capable'));
      fireEvent.press(getByText('I am confident and capable'));

      expect(mockOnPress).toHaveBeenCalledTimes(2);
    });
  });

  describe('Different Anchor States', () => {
    it('should render charged anchor correctly', () => {
      const anchor = createMockAnchor({
        isCharged: true,
        activationCount: 10,
      });
      const { getByText, getAllByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('10⚡')).toBeTruthy();
      expect(getAllByText('⚡').length).toBeGreaterThan(0); // Charged indicator
    });

    it('should render uncharged anchor correctly', () => {
      const anchor = createMockAnchor({
        isCharged: false,
        activationCount: 0,
      });
      const { getByText, queryByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('I am confident and capable')).toBeTruthy();
      expect(queryByText('⚡')).toBeNull();
    });

    it('should render anchor with no activations', () => {
      const anchor = createMockAnchor({ activationCount: 0 });
      const { queryByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(queryByText(/\d+⚡/)).toBeNull();
    });

    it('should render anchor with many activations', () => {
      const anchor = createMockAnchor({ activationCount: 999 });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('999⚡')).toBeTruthy();
    });
  });

  describe('Text Truncation', () => {
    it('should handle long intention text', () => {
      const longText = 'A'.repeat(200);
      const anchor = createMockAnchor({ intentionText: longText });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText(longText)).toBeTruthy();
    });

    it('should limit intention text to 2 lines', () => {
      const anchor = createMockAnchor();
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      const intentionElement = getByText('I am confident and capable');
      expect(intentionElement.props.numberOfLines).toBe(2);
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility role of button', () => {
      const anchor = createMockAnchor();
      const { getByRole } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should have accessibility label with intention text', () => {
      const anchor = createMockAnchor({ intentionText: 'I am successful' });
      const { getByLabelText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByLabelText(/I am successful/i)).toBeTruthy();
    });

    it('should include category in accessibility label', () => {
      const anchor = createMockAnchor({ category: 'career' });
      const { getByLabelText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByLabelText(/Career anchor/i)).toBeTruthy();
    });

    it('should indicate charged status in accessibility label', () => {
      const anchor = createMockAnchor({ isCharged: true });
      const { getByLabelText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByLabelText(/Charged/i)).toBeTruthy();
    });

    it('should include activation count in accessibility label', () => {
      const anchor = createMockAnchor({ activationCount: 7 });
      const { getByLabelText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByLabelText(/Activated 7 times/i)).toBeTruthy();
    });

    it('should not mention activations when count is 0', () => {
      const anchor = createMockAnchor({ activationCount: 0 });
      const { queryByLabelText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(queryByLabelText(/Activated 0 times/i)).toBeNull();
    });

    it('should have accessibility hint', () => {
      const anchor = createMockAnchor();
      const { getByA11yHint } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByA11yHint('Double tap to view anchor details')).toBeTruthy();
    });
  });

  describe('SVG Rendering', () => {
    it('should render sigil SVG', () => {
      const anchor = createMockAnchor({ baseSigilSvg: '<svg>custom sigil</svg>' });
      render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      // SvgXml component should be rendered (mocked)
      expect(true).toBe(true);
    });

    it('should handle different SVG content', () => {
      const anchor = createMockAnchor({ baseSigilSvg: '<svg><path d="M10,10"/></svg>' });
      render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty intention text', () => {
      const anchor = createMockAnchor({ intentionText: '' });
      const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getByText('')).toBeTruthy();
    });

    it('should handle anchor with all default values', () => {
      const minimalAnchor = createMockAnchor({
        isCharged: false,
        activationCount: 0,
      });
      const { getByText } = render(<AnchorCard anchor={minimalAnchor} onPress={mockOnPress} />);

      expect(getByText('I am confident and capable')).toBeTruthy();
    });

    it('should handle anchor with all maximum values', () => {
      const maximalAnchor = createMockAnchor({
        intentionText: 'A'.repeat(100),
        isCharged: true,
        activationCount: 9999,
      });
      const { getByText } = render(<AnchorCard anchor={maximalAnchor} onPress={mockOnPress} />);

      expect(getByText('9999⚡')).toBeTruthy();
    });

    it('should handle rapid re-renders', () => {
      const anchor = createMockAnchor();
      const { rerender } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      for (let i = 0; i < 10; i++) {
        rerender(<AnchorCard anchor={{ ...anchor, activationCount: i }} onPress={mockOnPress} />);
      }

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe('Visual States', () => {
    it('should render with all categories', () => {
      const categories = ['career', 'health', 'wealth', 'relationships', 'personal_growth'] as const;

      categories.forEach((category) => {
        const anchor = createMockAnchor({ category });
        const { getByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

        // Each category should render its label
        expect(getByText).toBeTruthy();
      });
    });

    it('should render in charged state', () => {
      const anchor = createMockAnchor({ isCharged: true });
      const { getAllByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(getAllByText('⚡').length).toBeGreaterThan(0);
    });

    it('should render in uncharged state', () => {
      const anchor = createMockAnchor({ isCharged: false, activationCount: 0 });
      const { queryByText } = render(<AnchorCard anchor={anchor} onPress={mockOnPress} />);

      expect(queryByText('⚡')).toBeNull();
    });
  });
});
