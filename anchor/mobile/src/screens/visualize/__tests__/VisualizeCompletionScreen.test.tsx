import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { VisualizeCompletionScreen } from '../VisualizeCompletionScreen';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();

let mockRouteParams = {
  anchorId: 'anchor-1',
  sessionId: 'session-1',
  durationSeconds: 60 as 60 | 180 | 300,
  returnTo: 'practice' as const,
};

jest.mock('@react-navigation/native-stack', () => jest.requireActual('@react-navigation/native-stack'));

jest.mock('@/utils/practiceCompletionCoordinator', () => ({
  calculatePracticeCompleteResult: jest.fn(() => ({
    anchorId: 'anchor-1',
    practiceMode: 'visualize',
    previousThreadStrength: 40,
    newThreadStrength: 55,
    previousStage: 'Kindling',
    newStage: 'Kindling',
    didCrossStage: false,
    isFirstPractice: false,
    returnTo: 'practice',
  })),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
  AnalyticsEvents: {
    VISUALIZE_PRACTICE_AGAIN_SELECTED: 'visualize_practice_again_selected',
    VISUALIZE_NEXT_ACTION_SAVED: 'visualize_next_action_saved',
  },
}));

jest.mock('@/services/PracticeCompletionService', () => ({
  PracticeCompletionService: { saveNextAction: jest.fn() },
}));

jest.mock('@/utils/postPrimeTraceEligibility', () => ({
  isPostPrimeTraceEligible: jest.fn().mockResolvedValue(false),
  markPostPrimeTraceAttemptStarted: jest.fn(),
}));

const mockReturnToChart = jest.fn(() => false);
jest.mock('@/hooks/useChartPracticeReturn', () => ({
  useChartPracticeReturn: () => mockReturnToChart,
}));

jest.mock('@/contexts/TabNavigationContext', () => ({
  useTabNavigation: () => ({
    navigateToSanctuary: jest.fn(),
    navigateToVault: jest.fn(),
    returnToAnchorDetail: jest.fn(),
  }),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

describe('VisualizeCompletionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {
      anchorId: 'anchor-1',
      sessionId: 'session-1',
      durationSeconds: 60,
      returnTo: 'practice',
    };

    useAnchorStore.setState({
      getAnchorById: () =>
        ({
          id: 'anchor-1',
          baseSigilSvg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
        }) as any,
      updateAnchor: jest.fn(),
    } as any);
    useAuthStore.setState({ user: { id: 'user-1' } } as any);
    useSessionStore.setState({ practiceHistory: [] } as any);
    useSettingsStore.setState({
      traceDefaultEnabled: false,
      threadStrengthSensitivity: 'balanced',
      restDays: [],
    } as any);
  });

  const renderScreen = () =>
    render(
      <VisualizeCompletionScreen
        navigation={{ navigate: mockNavigate, replace: mockReplace } as any}
        route={{ params: mockRouteParams } as any}
      />,
    );

  it('shows the Thread Strength gained by this session, not the Anchor total', () => {
    renderScreen();

    expect(screen.getByText('VISUALIZE COMPLETE')).toBeTruthy();
    expect(screen.getByText('Rehearsal complete.')).toBeTruthy();
    expect(screen.getByText('1 MIN')).toBeTruthy();
    expect(screen.getByText('THREAD +15')).toBeTruthy();
    expect(screen.queryByText('THREAD 55')).toBeNull();
  });

  it('forwards the computed result to the Thread Strength sheet on Continue', () => {
    renderScreen();

    fireEvent.press(screen.getByText('CONTINUE →'));

    expect(mockReplace).toHaveBeenCalledWith(
      'PracticeComplete',
      expect.objectContaining({ previousThreadStrength: 40, newThreadStrength: 55 }),
    );
  });

  it('renders the secondary Trace CTA and navigates to ManualReinforcement when tapped', async () => {
    renderScreen();

    const traceButton = screen.getByTestId('post-prime-trace-button');
    expect(traceButton).toBeTruthy();
    expect(screen.getByText('Trace to Deepen')).toBeTruthy();

    fireEvent.press(traceButton);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ManualReinforcement', {
        source: 'post_prime_trace',
        anchorId: 'anchor-1',
      }),
    );
  });
});
