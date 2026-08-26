import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FocusCompletionScreen } from '../FocusCompletionScreen';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import type { PracticeCompleteResult } from '@/types/practice';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockMarkPostPrimeTraceAttemptStarted = jest.fn().mockResolvedValue(undefined);

let mockRouteParams: PracticeCompleteResult & { durationSeconds: number } = {
  anchorId: 'anchor-1',
  practiceMode: 'focus',
  previousThreadStrength: 40,
  newThreadStrength: 48,
  previousStage: 'Kindling',
  newStage: 'Kindling',
  didCrossStage: false,
  isFirstPractice: false,
  returnTo: 'practice',
  durationSeconds: 30,
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ replace: mockReplace, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/utils/postPrimeTraceEligibility', () => ({
  markPostPrimeTraceAttemptStarted: (...args: any[]) =>
    mockMarkPostPrimeTraceAttemptStarted(...args),
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

const mockStartPractice = jest.fn();
jest.mock('@/hooks/usePracticeEntry', () => ({
  usePracticeEntry: () => ({
    startPractice: mockStartPractice,
    isNavigationLocked: false,
    releaseNavigationLock: jest.fn(),
  }),
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

describe('FocusCompletionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkPostPrimeTraceAttemptStarted.mockReset();
    mockMarkPostPrimeTraceAttemptStarted.mockResolvedValue(undefined);
    usePostPrimeTraceStore.setState({ activeFlow: null });
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 40,
      newThreadStrength: 48,
      previousStage: 'Kindling',
      newStage: 'Kindling',
      didCrossStage: false,
      isFirstPractice: false,
      returnTo: 'practice',
      durationSeconds: 30,
    };
  });

  it('renders the shared completion screen themed for Focus with the session gain, not the anchor total', () => {
    render(<FocusCompletionScreen />);

    expect(screen.getByText('FOCUS COMPLETE')).toBeTruthy();
    expect(screen.getByText('Focus complete.')).toBeTruthy();
    expect(screen.getByText('30 SEC')).toBeTruthy();
    expect(screen.getByText('THREAD +8')).toBeTruthy();
    expect(screen.queryByText('THREAD 48')).toBeNull();
    expect(screen.getByText('Focus Again')).toBeTruthy();
    expect(screen.getByText('Trace to Deepen')).toBeTruthy();
  });

  it('shows THREAD +0 when the session produced no gain, never a negative or bare total', () => {
    mockRouteParams = { ...mockRouteParams, previousThreadStrength: 48, newThreadStrength: 48 };
    render(<FocusCompletionScreen />);

    expect(screen.getByText('THREAD +0')).toBeTruthy();
  });

  it('forwards the untouched PracticeCompleteResult to the Thread Strength sheet on Continue', () => {
    render(<FocusCompletionScreen />);

    fireEvent.press(screen.getByText('CONTINUE →'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const [routeName, params] = mockReplace.mock.calls[0];
    expect(routeName).toBe('PracticeComplete');
    expect(params).toEqual({
      anchorId: 'anchor-1',
      practiceMode: 'focus',
      previousThreadStrength: 40,
      newThreadStrength: 48,
      previousStage: 'Kindling',
      newStage: 'Kindling',
      didCrossStage: false,
      isFirstPractice: false,
      returnTo: 'practice',
    });
    expect(params).not.toHaveProperty('durationSeconds');
  });

  it('restarts Focus practice through the canonical entry point on repeat, preserving duration', () => {
    render(<FocusCompletionScreen />);

    fireEvent.press(screen.getByText('Focus Again'));

    expect(mockStartPractice).toHaveBeenCalledTimes(1);
    expect(mockStartPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'focus',
        anchorId: 'anchor-1',
        durationSeconds: 30,
      }),
    );
  });

  it('renders the secondary Trace CTA directly without any popup modal', () => {
    render(<FocusCompletionScreen />);

    expect(screen.getByTestId('post-prime-trace-button')).toBeTruthy();
    expect(screen.getByText('Trace to Deepen')).toBeTruthy();
    expect(screen.queryByTestId('post-prime-trace-modal')).toBeNull();
  });

  it('starting trace navigates to ManualReinforcement and tracks completion once the flow resolves', async () => {
    render(<FocusCompletionScreen />);

    const traceButton = screen.getByTestId('post-prime-trace-button');
    expect(traceButton).toBeTruthy();
    fireEvent.press(traceButton);

    expect(mockMarkPostPrimeTraceAttemptStarted).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ManualReinforcement', {
        source: 'post_prime_trace',
        anchorId: 'anchor-1',
      }),
    );

    const flowId = usePostPrimeTraceStore.getState().activeFlow?.flowId;
    expect(flowId).toBeTruthy();

    act(() => {
      usePostPrimeTraceStore.getState().finishFlow(flowId!, 'completed');
    });

    await waitFor(() => expect(usePostPrimeTraceStore.getState().activeFlow).toBeNull());
  });
});
