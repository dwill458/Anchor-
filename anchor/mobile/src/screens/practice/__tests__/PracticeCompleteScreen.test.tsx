import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { PracticeCompleteScreen } from '../PracticeCompleteScreen';
import type { PracticeCompleteResult } from '@/types/practice';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockPopToTop = jest.fn();

let mockRouteParams: PracticeCompleteResult = {
  anchorId: 'anchor-1',
  practiceMode: 'focus',
  previousThreadStrength: 62,
  newThreadStrength: 68,
  previousStage: 'Kindling',
  newStage: 'Kindling',
  didCrossStage: false,
  isFirstPractice: false,
  returnTo: 'practice',
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
    popToTop: mockPopToTop,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockGetAnchorById = jest.fn(() => ({
  id: 'anchor-1',
  name: 'Focus Anchor',
  baseSigilSvg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { getAnchorById: mockGetAnchorById };
    return selector ? selector(state) : state;
  },
}));

const mockNavigateToPractice = jest.fn();
const mockNavigateToSanctuary = jest.fn();
const mockReturnToAnchorDetail = jest.fn();
jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToPractice: mockNavigateToPractice,
    navigateToSanctuary: mockNavigateToSanctuary,
    navigateToVault: mockNavigateToSanctuary,
    returnToAnchorDetail: mockReturnToAnchorDetail,
  }),
}));

const mockReturnToChart = jest.fn(() => false);
jest.mock('@/hooks/useChartPracticeReturn', () => ({
  useChartPracticeReturn: () => mockReturnToChart,
}));

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

const mockCanOfferFirstAnchorReminder = jest.fn().mockResolvedValue(true);
const mockCanOfferPracticeReminder = jest.fn().mockResolvedValue(true);
const mockSetDailyPrimeReminder = jest.fn().mockResolvedValue('granted');
const mockMarkReminderPromptShown = jest.fn().mockResolvedValue(undefined);
const mockCompleteReminderPrompt = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    canOfferFirstAnchorReminder: mockCanOfferFirstAnchorReminder,
    canOfferPracticeReminder: mockCanOfferPracticeReminder,
    setDailyPrimeReminder: mockSetDailyPrimeReminder,
    markReminderPromptShown: mockMarkReminderPromptShown,
    completeReminderPrompt: mockCompleteReminderPrompt,
  }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: jest.fn(),
  },
}));

import { useTeachingStore } from '@/stores/teachingStore';
import { useAuthStore } from '@/stores/authStore';

describe('PracticeCompleteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotion = false;
    mockCanOfferFirstAnchorReminder.mockResolvedValue(true);
    mockCanOfferPracticeReminder.mockResolvedValue(true);
    useTeachingStore.getState().reset();
    useAuthStore.getState().setWallpaperPromptSeen(false);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 62,
      newThreadStrength: 68,
      previousStage: 'Kindling',
      newStage: 'Kindling',
      didCrossStage: false,
      isFirstPractice: false,
      returnTo: 'practice',
    };
  });

  it('renders normal returning practice when reminders are already active', async () => {
    mockCanOfferPracticeReminder.mockResolvedValue(false);
    mockCanOfferFirstAnchorReminder.mockResolvedValue(false);

    render(<PracticeCompleteScreen />);

    expect(screen.getByText('PRACTICE COMPLETE')).toBeTruthy();
    expect(screen.getByText('THREAD STRENGTH')).toBeTruthy();
    expect(screen.getAllByText('62').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('REINFORCED')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();

    // In normal returning practice, first practice banner is NOT rendered
    expect(screen.queryByText('YOUR THREAD HAS BEGUN')).toBeNull();
    // Reminder opportunity is NOT rendered when not eligible
    expect(screen.queryByText('KEEP BUILDING THE THREAD')).toBeNull();
  });

  it('renders practice reminder opportunity on returning practice when reminders are not yet active', async () => {
    mockCanOfferPracticeReminder.mockResolvedValue(true);

    render(<PracticeCompleteScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('PRACTICE COMPLETE')).toBeTruthy();
    expect(screen.getByText('KEEP BUILDING THE THREAD')).toBeTruthy();
    expect(screen.getByText('Set a practice reminder ›')).toBeTruthy();
  });

  it('renders first practice teaching state and reminder prompt', async () => {
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 0,
      newThreadStrength: 25,
      previousStage: 'Nascent',
      newStage: 'Kindling',
      didCrossStage: true,
      isFirstPractice: true,
      returnTo: 'practice',
    };

    render(<PracticeCompleteScreen />);

    expect(screen.getByText('YOUR THREAD HAS BEGUN')).toBeTruthy();
    expect(
      screen.getByText(
        'Practice strengthens your connection to this Anchor. Thread Strength grows as you return to it over time.',
      ),
    ).toBeTruthy();

    // Status text is omitted on first practice in favor of the teaching banner
    expect(screen.queryByText('REINFORCED')).toBeNull();
    expect(screen.queryByText('THREAD STRENGTHENED')).toBeNull();

    // Reminder prompt is available
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('KEEP BUILDING THE THREAD')).toBeTruthy();
    expect(screen.getByText('Set a practice reminder ›')).toBeTruthy();

    // Tap to expand reminder
    fireEvent.press(screen.getByTestId('practice-reminder-link'));

    expect(screen.getByText('Morning')).toBeTruthy();
    expect(screen.getByText('Evening')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText('SET PRACTICE REMINDER')).toBeTruthy();
    expect(screen.getByText('Not now')).toBeTruthy();

    // Tap set reminder
    await act(async () => {
      fireEvent.press(screen.getByTestId('set-practice-reminder-button'));
    });

    expect(mockSetDailyPrimeReminder).toHaveBeenCalledWith(
      '08:00',
      'first_anchor',
    );
    expect(screen.getByText(/Reminder set — Morning/)).toBeTruthy();
  });

  it('renders stage transition banner and stage name', () => {
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'deep_prime',
      previousThreadStrength: 68,
      newThreadStrength: 72,
      previousStage: 'Kindling',
      newStage: 'Tempered',
      didCrossStage: true,
      isFirstPractice: false,
      returnTo: 'detail',
    };

    render(<PracticeCompleteScreen />);

    expect(screen.getByText('THREAD STRENGTHENED')).toBeTruthy();
    expect(screen.getByText('Tempered')).toBeTruthy();
  });

  it('handles Done tap and navigates back to practice origin', () => {
    render(<PracticeCompleteScreen />);

    const doneButton = screen.getByTestId('practice-complete-done-button');
    fireEvent.press(doneButton);

    expect(mockPopToTop).toHaveBeenCalled();
    expect(mockNavigateToPractice).toHaveBeenCalled();
  });

  it('handles Done tap for Anchor Detail return target', () => {
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 62,
      newThreadStrength: 68,
      previousStage: 'Kindling',
      newStage: 'Kindling',
      didCrossStage: false,
      isFirstPractice: false,
      returnTo: 'detail',
    };

    render(<PracticeCompleteScreen />);

    const doneButton = screen.getByTestId('practice-complete-done-button');
    fireEvent.press(doneButton);

    expect(mockPopToTop).toHaveBeenCalled();
    expect(mockReturnToAnchorDetail).toHaveBeenCalledWith('anchor-1');
  });

  it('respects reduceMotion by displaying final values immediately', () => {
    mockReduceMotion = true;
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 40,
      newThreadStrength: 65,
      previousStage: 'Kindling',
      newStage: 'Kindling',
      didCrossStage: false,
      isFirstPractice: false,
      returnTo: 'practice',
    };

    render(<PracticeCompleteScreen />);

    expect(screen.getByText('65')).toBeTruthy();
  });

  it('presents the wallpaper sheet after a first practice reveal', () => {
    mockReduceMotion = true;
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 0,
      newThreadStrength: 25,
      previousStage: 'Nascent',
      newStage: 'Kindling',
      didCrossStage: true,
      isFirstPractice: true,
      returnTo: 'practice',
    };

    render(<PracticeCompleteScreen />);

    expect(screen.getByTestId('set-as-wallpaper-button')).toBeTruthy();
  });

  it('also presents the wallpaper sheet after a stage transition', () => {
    mockReduceMotion = true;
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'deep_prime',
      previousThreadStrength: 68,
      newThreadStrength: 72,
      previousStage: 'Kindling',
      newStage: 'Tempered',
      didCrossStage: true,
      isFirstPractice: false,
      returnTo: 'detail',
    };

    render(<PracticeCompleteScreen />);

    expect(screen.getByTestId('set-as-wallpaper-button')).toBeTruthy();
  });

  describe('Same-Day Contextual Education', () => {
    it('does NOT show contextual teaching on first practice of the day', () => {
      mockRouteParams = {
        anchorId: 'anchor-1',
        practiceMode: 'focus',
        previousThreadStrength: 62,
        newThreadStrength: 68,
        previousStage: 'Kindling',
        newStage: 'Kindling',
        didCrossStage: false,
        isFirstPractice: false,
        sameDayGainReduced: false,
        returnTo: 'practice',
      };

      render(<PracticeCompleteScreen />);

      expect(screen.queryByText('RETURNING TOMORROW HAS THE GREATEST EFFECT')).toBeNull();
      expect(
        screen.queryByText(
          'Additional practices today still reinforce this Anchor, but Thread Strength grows most when you return over time.'
        )
      ).toBeNull();
    });

    it('shows contextual teaching on same-day second practice when gain was reduced', () => {
      mockRouteParams = {
        anchorId: 'anchor-1',
        practiceMode: 'focus',
        previousThreadStrength: 62,
        newThreadStrength: 65,
        previousStage: 'Kindling',
        newStage: 'Kindling',
        didCrossStage: false,
        isFirstPractice: false,
        sameDayGainReduced: true,
        returnTo: 'practice',
      };

      render(<PracticeCompleteScreen />);

      expect(screen.getByText('RETURNING TOMORROW HAS THE GREATEST EFFECT')).toBeTruthy();
      expect(
        screen.getByText(
          'Additional practices today still reinforce this Anchor, but Thread Strength grows most when you return over time.'
        )
      ).toBeTruthy();
    });

    it('does not show contextual teaching if already seen / exhausted', () => {
      // First render exhausts the teaching
      mockRouteParams = {
        anchorId: 'anchor-1',
        practiceMode: 'focus',
        previousThreadStrength: 62,
        newThreadStrength: 65,
        previousStage: 'Kindling',
        newStage: 'Kindling',
        didCrossStage: false,
        isFirstPractice: false,
        sameDayGainReduced: true,
        returnTo: 'practice',
      };

      const { unmount } = render(<PracticeCompleteScreen />);
      expect(screen.getByText('RETURNING TOMORROW HAS THE GREATEST EFFECT')).toBeTruthy();
      unmount();

      // Second render on subsequent same-day practice
      render(<PracticeCompleteScreen />);
      expect(screen.queryByText('RETURNING TOMORROW HAS THE GREATEST EFFECT')).toBeNull();
    });
  });
});
