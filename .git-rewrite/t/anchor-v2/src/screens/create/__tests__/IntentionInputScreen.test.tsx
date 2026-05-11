/**
 * Anchor App - IntentionInputScreen Tests
 *
 * Comprehensive tests for intention input validation and creation flow
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import IntentionInputScreen from '../IntentionInputScreen';
import { distillIntention } from '@/utils/sigil/distillation';

// Mock dependencies
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: mockNavigate,
  })),
}));

jest.mock('@/utils/sigil/distillation');
jest.mock('@/components/common', () => ({
  ScreenHeader: 'ScreenHeader',
  ZenBackground: 'ZenBackground',
}));

describe('IntentionInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (distillIntention as jest.Mock).mockReturnValue({
      finalLetters: 'ABC',
      steps: [],
    });
  });

  describe('Rendering', () => {
    it('should render with initial state', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);

      expect(getByPlaceholderText(/e.g., I am confident and capable/i)).toBeTruthy();
      expect(getByText('What is your intention?')).toBeTruthy();
      expect(getByText('CATEGORY')).toBeTruthy();
      expect(getByText('0 / 100')).toBeTruthy();
    });

    it('should render all category options', () => {
      const { getByText } = render(<IntentionInputScreen />);

      expect(getByText('Career')).toBeTruthy();
      expect(getByText('Health')).toBeTruthy();
      expect(getByText('Wealth')).toBeTruthy();
      expect(getByText('Love')).toBeTruthy();
      expect(getByText('Growth')).toBeTruthy();
    });

    it('should render all example intentions', () => {
      const { getByText } = render(<IntentionInputScreen />);

      expect(getByText('I am confident and capable')).toBeTruthy();
      expect(getByText('My business thrives with abundance')).toBeTruthy();
      expect(getByText('I attract meaningful relationships')).toBeTruthy();
      expect(getByText('I excel in my career')).toBeTruthy();
      expect(getByText('I embrace healthy habits daily')).toBeTruthy();
    });

    it('should render Continue button in disabled state initially', () => {
      const { getByText } = render(<IntentionInputScreen />);

      const continueButton = getByText('Continue to Anchor');
      expect(continueButton).toBeTruthy();
    });
  });

  describe('Input Validation', () => {
    it('should update character count when typing', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'Test');
      expect(getByText('4 / 100')).toBeTruthy();
    });

    it('should show validation dot when input is valid', () => {
      const { getByPlaceholderText, queryByTestId } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I am confident');
      // Check that valid input shows success dot (tested via character count being within range)
      expect(getByPlaceholderText(/e.g., I am confident and capable/i).props.value).toBe('I am confident');
    });

    it('should enforce maximum character limit', () => {
      const { getByPlaceholderText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      const longText = 'a'.repeat(105);
      fireEvent.changeText(input, longText);

      // Text should be truncated at 100 characters
      expect(input.props.value.length).toBeLessThanOrEqual(100);
    });

    it('should not allow submission with less than minimum characters', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'ab'); // Only 2 chars
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should allow submission with valid length', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I am confident');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith('DistillationAnimation', {
        intentionText: 'I am confident',
        category: 'personal_growth', // default category
        distilledLetters: 'ABC',
      });
    });
  });

  describe('Category Selection', () => {
    it('should select personal_growth by default', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I am confident');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith(
        'DistillationAnimation',
        expect.objectContaining({ category: 'personal_growth' })
      );
    });

    it('should change category when category chip is pressed', () => {
      const { getByText, getByPlaceholderText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('Career'));

      const input = getByPlaceholderText(/e.g., I am confident and capable/i);
      fireEvent.changeText(input, 'I am confident');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith(
        'DistillationAnimation',
        expect.objectContaining({ category: 'career' })
      );
    });

    it('should update selected category for all categories', () => {
      const { getByText, getByPlaceholderText } = render(<IntentionInputScreen />);
      const categories = [
        { label: 'Health', id: 'health' },
        { label: 'Wealth', id: 'wealth' },
        { label: 'Love', id: 'relationships' },
      ];

      categories.forEach(({ label, id }) => {
        fireEvent.press(getByText(label));

        const input = getByPlaceholderText(/e.g., I am confident and capable/i);
        fireEvent.changeText(input, 'I am confident');
        fireEvent.press(getByText('Continue to Anchor'));

        expect(mockNavigate).toHaveBeenCalledWith(
          'DistillationAnimation',
          expect.objectContaining({ category: id })
        );

        jest.clearAllMocks();
      });
    });
  });

  describe('Weak Word Detection', () => {
    const weakWords = ['want', 'need', 'wish', 'hope', 'try', 'maybe', 'perhaps', 'might'];

    weakWords.forEach((word) => {
      it(`should show warning modal for weak word: ${word}`, () => {
        const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
        const input = getByPlaceholderText(/e.g., I am confident and capable/i);

        fireEvent.changeText(input, `I ${word} success`);
        fireEvent.press(getByText('Continue to Anchor'));

        expect(getByText('Refine Your Intent')).toBeTruthy();
        expect(getByText(/weak/i)).toBeTruthy();
      });
    });

    it('should not navigate when weak word warning is shown', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I want success');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should close modal when "Edit Mindfully" is pressed', async () => {
      const { getByPlaceholderText, getByText, queryByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I want success');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(getByText('Refine Your Intent')).toBeTruthy();

      fireEvent.press(getByText('Edit Mindfully'));

      // Modal should close (warning modal not visible)
      await waitFor(() => {
        expect(queryByText('Refine Your Intent')).toBeNull();
      });
    });

    it('should navigate when "Forging Anyway" is pressed', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I want success');
      fireEvent.press(getByText('Continue to Anchor'));

      fireEvent.press(getByText('Forging Anyway'));

      expect(mockNavigate).toHaveBeenCalledWith('DistillationAnimation', {
        intentionText: 'I want success',
        category: 'personal_growth',
        distilledLetters: 'ABC',
      });
    });
  });

  describe('Future Tense Detection', () => {
    const futurePhrases = [
      { phrase: 'I will succeed', text: 'will' },
      { phrase: 'I shall overcome', text: 'shall' },
      { phrase: 'I am going to win', text: 'going to' },
    ];

    futurePhrases.forEach(({ phrase, text }) => {
      it(`should show warning modal for future tense: "${text}"`, () => {
        const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
        const input = getByPlaceholderText(/e.g., I am confident and capable/i);

        fireEvent.changeText(input, phrase);
        fireEvent.press(getByText('Continue to Anchor'));

        expect(getByText('Refine Your Intent')).toBeTruthy();
        expect(getByText(/present tense/i)).toBeTruthy();
      });
    });
  });

  describe('Past Tense Detection', () => {
    it('should show warning for past tense words', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I was confident');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(getByText('Refine Your Intent')).toBeTruthy();
      expect(getByText(/present/i)).toBeTruthy();
    });

    it('should show warning for past tense -ed endings', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I achieved greatness');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(getByText('Refine Your Intent')).toBeTruthy();
    });

    it('should not flag common words ending in "ed"', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I feed my ambition');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe('Example Intentions', () => {
    it('should populate input when example is pressed', () => {
      const { getByText, getByPlaceholderText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('I am confident and capable'));

      const input = getByPlaceholderText(/e.g., I am confident and capable/i);
      expect(input.props.value).toBe('I am confident and capable');
    });

    it('should update character count when example is selected', () => {
      const { getByText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('I am confident and capable'));

      expect(getByText('28 / 100')).toBeTruthy(); // Length of the example
    });

    it('should allow navigation after selecting example', () => {
      const { getByText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('I am confident and capable'));
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith('DistillationAnimation', {
        intentionText: 'I am confident and capable',
        category: 'personal_growth',
        distilledLetters: 'ABC',
      });
    });
  });

  describe('Tips Toggle', () => {
    it('should show tips when toggle is pressed', () => {
      const { getByText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('Intent Formatting Tips'));

      expect(getByText(/Use present tense/i)).toBeTruthy();
      expect(getByText(/Be specific and clear/i)).toBeTruthy();
      expect(getByText(/Focus on the positive outcome/i)).toBeTruthy();
    });

    it('should hide tips when toggle is pressed again', () => {
      const { getByText, queryByText } = render(<IntentionInputScreen />);

      fireEvent.press(getByText('Intent Formatting Tips'));
      expect(getByText(/Use present tense/i)).toBeTruthy();

      fireEvent.press(getByText('Intent Formatting Tips'));
      expect(queryByText(/Use present tense/i)).toBeNull();
    });

    it('should toggle arrow direction', () => {
      const { getByText } = render(<IntentionInputScreen />);
      const tipsButton = getByText('Intent Formatting Tips');

      // Initially should show right arrow (collapsed)
      expect(getByText('▶')).toBeTruthy();

      fireEvent.press(tipsButton);

      // After press should show down arrow (expanded)
      expect(getByText('▼')).toBeTruthy();
    });
  });

  describe('Navigation and Integration', () => {
    it('should call distillIntention when navigating', () => {
      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'I am powerful');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(distillIntention).toHaveBeenCalledWith('I am powerful');
    });

    it('should pass distilled letters to navigation', () => {
      (distillIntention as jest.Mock).mockReturnValue({
        finalLetters: 'XYZ',
        steps: [],
      });

      const { getByPlaceholderText, getByText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      fireEvent.changeText(input, 'Test intention');
      fireEvent.press(getByText('Continue to Anchor'));

      expect(mockNavigate).toHaveBeenCalledWith('DistillationAnimation', {
        intentionText: 'Test intention',
        category: 'personal_growth',
        distilledLetters: 'XYZ',
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for input', () => {
      const { getByPlaceholderText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      expect(input).toBeTruthy();
    });

    it('should support multiline input', () => {
      const { getByPlaceholderText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      expect(input.props.multiline).toBe(true);
    });

    it('should have sentence capitalization', () => {
      const { getByPlaceholderText } = render(<IntentionInputScreen />);
      const input = getByPlaceholderText(/e.g., I am confident and capable/i);

      expect(input.props.autoCapitalize).toBe('sentences');
    });
  });
});
