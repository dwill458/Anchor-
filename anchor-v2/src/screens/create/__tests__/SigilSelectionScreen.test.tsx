/**
 * Anchor App - SigilSelectionScreen Tests
 *
 * Tests for sigil variant selection (Dense, Balanced, Minimal)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SigilSelectionScreen from '../SigilSelectionScreen';
import { generateAllVariants } from '@/utils/sigil/abstract-symbol-generator';

// Mock dependencies
const mockNavigate = jest.fn();
const mockRoute = {
  params: {
    intentionText: 'I am confident',
    category: 'personal_growth' as const,
    distilledLetters: ['I', 'A', 'M'],
  },
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
  useRoute: jest.fn(() => mockRoute),
}));

jest.mock('@/utils/sigil/abstract-symbol-generator');
jest.mock('@/components/common', () => ({
  ZenBackground: 'ZenBackground',
}));
jest.mock('react-native-svg', () => ({
  SvgXml: 'SvgXml',
}));

const mockVariants = [
  {
    variant: 'dense' as const,
    svg: '<svg>dense svg</svg>',
    complexity: 0.9,
  },
  {
    variant: 'balanced' as const,
    svg: '<svg>balanced svg</svg>',
    complexity: 0.6,
  },
  {
    variant: 'minimal' as const,
    svg: '<svg>minimal svg</svg>',
    complexity: 0.3,
  },
];

describe('SigilSelectionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (generateAllVariants as jest.Mock).mockReturnValue(mockVariants);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      const { getByText } = render(<SigilSelectionScreen />);

      expect(getByText('Crafting your sigils...')).toBeTruthy();
    });

    it('should hide loading state after variants are generated', async () => {
      const { queryByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(queryByText('Crafting your sigils...')).toBeNull();
      });
    });
  });

  describe('Rendering', () => {
    it('should render header text', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('Choose Your Anchor')).toBeTruthy();
        expect(getByText(/Each style channels your intention/i)).toBeTruthy();
      });
    });

    it('should display distilled letters', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('Distilled Letters')).toBeTruthy();
        expect(getByText('I')).toBeTruthy();
        expect(getByText('A')).toBeTruthy();
        expect(getByText('M')).toBeTruthy();
      });
    });

    it('should render all three variant cards', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('Dense')).toBeTruthy();
        expect(getByText('Balanced')).toBeTruthy();
        expect(getByText('Minimal')).toBeTruthy();
      });
    });

    it('should render variant descriptions', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText(/Ornate, intricate design/i)).toBeTruthy();
        expect(getByText(/Classic sigil aesthetic/i)).toBeTruthy();
        expect(getByText(/Clean, modern lines/i)).toBeTruthy();
      });
    });

    it('should render Continue button', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('Continue')).toBeTruthy();
      });
    });
  });

  describe('Variant Selection', () => {
    it('should select balanced variant by default', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('Balanced Style')).toBeTruthy();
      });
    });

    it('should show checkmark on selected variant', async () => {
      const { getAllByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        const checkmarks = getAllByText('✓');
        expect(checkmarks.length).toBeGreaterThan(0);
      });
    });

    it('should change selection when dense variant is pressed', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        const denseCard = getByText('Dense');
        fireEvent.press(denseCard);
      });

      await waitFor(() => {
        expect(getByText('Dense Style')).toBeTruthy();
      });
    });

    it('should change selection when minimal variant is pressed', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        const minimalCard = getByText('Minimal');
        fireEvent.press(minimalCard);
      });

      await waitFor(() => {
        expect(getByText('Minimal Style')).toBeTruthy();
      });
    });

    it('should update preview when selection changes', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        // Initially showing balanced
        expect(getByText('Balanced Style')).toBeTruthy();
      });

      fireEvent.press(getByText('Dense'));

      await waitFor(() => {
        expect(getByText('Dense Style')).toBeTruthy();
      });
    });
  });

  describe('Sigil Generation', () => {
    it('should call generateAllVariants with distilled letters', async () => {
      render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(generateAllVariants).toHaveBeenCalledWith(['I', 'A', 'M']);
      });
    });

    it('should handle different distilled letters', async () => {
      const customRoute = {
        params: {
          intentionText: 'Success',
          category: 'career' as const,
          distilledLetters: ['S', 'U', 'C', 'E'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(generateAllVariants).toHaveBeenCalledWith(['S', 'U', 'C', 'E']);
      });
    });

    it('should render all three variants from generator', async () => {
      render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(generateAllVariants).toHaveBeenCalled();
      });

      // Should have rendered all 3 variant cards
      const { getByText } = render(<SigilSelectionScreen />);
      await waitFor(() => {
        expect(getByText('Dense')).toBeTruthy();
        expect(getByText('Balanced')).toBeTruthy();
        expect(getByText('Minimal')).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to MantraCreation when Continue is pressed', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        const continueButton = getByText('Continue');
        fireEvent.press(continueButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('MantraCreation', {
        intentionText: 'I am confident',
        category: 'personal_growth',
        distilledLetters: ['I', 'A', 'M'],
        sigilSvg: '<svg>balanced svg</svg>', // Default selection is balanced
      });
    });

    it('should pass correct SVG for dense variant', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        fireEvent.press(getByText('Dense'));
      });

      fireEvent.press(getByText('Continue'));

      expect(mockNavigate).toHaveBeenCalledWith('MantraCreation', {
        intentionText: 'I am confident',
        category: 'personal_growth',
        distilledLetters: ['I', 'A', 'M'],
        sigilSvg: '<svg>dense svg</svg>',
      });
    });

    it('should pass correct SVG for minimal variant', async () => {
      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        fireEvent.press(getByText('Minimal'));
      });

      fireEvent.press(getByText('Continue'));

      expect(mockNavigate).toHaveBeenCalledWith('MantraCreation', {
        intentionText: 'I am confident',
        category: 'personal_growth',
        distilledLetters: ['I', 'A', 'M'],
        sigilSvg: '<svg>minimal svg</svg>',
      });
    });

    it('should preserve all route params when navigating', async () => {
      const customRoute = {
        params: {
          intentionText: 'I excel in my career',
          category: 'career' as const,
          distilledLetters: ['I', 'E', 'X', 'L'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        fireEvent.press(getByText('Continue'));
      });

      expect(mockNavigate).toHaveBeenCalledWith('MantraCreation', {
        intentionText: 'I excel in my career',
        category: 'career',
        distilledLetters: ['I', 'E', 'X', 'L'],
        sigilSvg: expect.any(String),
      });
    });
  });

  describe('Route Params Validation', () => {
    it('should receive and display intentionText from params', async () => {
      const customRoute = {
        params: {
          intentionText: 'Custom intention',
          category: 'wealth' as const,
          distilledLetters: ['C', 'U', 'S'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        fireEvent.press(getByText('Continue'));
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'MantraCreation',
        expect.objectContaining({ intentionText: 'Custom intention' })
      );
    });

    it('should receive and display category from params', async () => {
      const customRoute = {
        params: {
          intentionText: 'Test',
          category: 'health' as const,
          distilledLetters: ['T', 'E'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        fireEvent.press(getByText('Continue'));
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        'MantraCreation',
        expect.objectContaining({ category: 'health' })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle single distilled letter', async () => {
      const customRoute = {
        params: {
          intentionText: 'I',
          category: 'personal_growth' as const,
          distilledLetters: ['I'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('I')).toBeTruthy();
      });
    });

    it('should handle many distilled letters', async () => {
      const customRoute = {
        params: {
          intentionText: 'Long intention',
          category: 'personal_growth' as const,
          distilledLetters: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        },
      };

      const navigation = require('@react-navigation/native');
      navigation.useRoute.mockReturnValue(customRoute);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        expect(getByText('A')).toBeTruthy();
        expect(getByText('G')).toBeTruthy();
      });
    });

    it('should not navigate if no variant is selected', async () => {
      (generateAllVariants as jest.Mock).mockReturnValue([]);

      const { getByText } = render(<SigilSelectionScreen />);

      await waitFor(() => {
        const continueButton = getByText('Continue');
        fireEvent.press(continueButton);
      });

      // Should not navigate if variants array is empty
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
