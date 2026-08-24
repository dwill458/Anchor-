import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DeepPrimeCompletionScreen } from '../DeepPrimeCompletionScreen';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import type { PracticeCompleteResult } from '@/types/practice';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockMarkPostPrimeTraceAttemptStarted = jest.fn().mockResolvedValue(undefined);

let mockRouteParams: PracticeCompleteResult & { durationSeconds: number } = {
  anchorId: 'anchor-1',
  practiceMode: 'deep_prime',
  previousThreadStrength: 47,
  newThreadStrength: 59,
  previousStage: 'Kindling',
  newStage: 'Tempered',
  didCrossStage: true,
  isFirstPractice: false,
  returnTo: 'practice',
  durationSeconds: 300,
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
  name: 'Deep Prime Anchor',
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

describe('DeepPrimeCompletionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkPostPrimeTraceAttemptStarted.mockReset();
    mockMarkPostPrimeTraceAttemptStarted.mockResolvedValue(undefined);
    usePostPrimeTraceStore.setState({ activeFlow: null });
    mockRouteParams = {
      anchorId: 'anchor-1',
      practiceMode: 'deep_prime',
      previousThreadStrength: 47,
      newThreadStrength: 59,
      previousStage: 'Kindling',
      newStage: 'Tempered',
      didCrossStage: true,
      isFirstPractice: false,
      returnTo: 'practice',
      durationSeconds: 300,
    };
  });

  it('renders the shared completion screen themed for Deep Prime with the session gain, not the anchor total', () => {
    render(<DeepPrimeCompletionScreen />);

    expect(screen.getByText('DEEP PRIME COMPLETE')).toBeTruthy();
    expect(screen.getByText('Priming complete.')).toBeTruthy();
    expect(screen.getByText('5 MIN')).toBeTruthy();
    expect(screen.getByText('THREAD +12')).toBeTruthy();
    expect(screen.queryByText('THREAD 59')).toBeNull();
    expect(screen.getByText('Prime Again')).toBeTruthy();
    expect(screen.getByText('Trace')).toBeTruthy();
  });

  it('forwards the untouched PracticeCompleteResult to the Thread Strength sheet on Continue', () => {
    render(<DeepPrimeCompletionScreen />);

    fireEvent.press(screen.getByText('CONTINUE →'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
    const [routeName, params] = mockReplace.mock.calls[0];
    expect(routeName).toBe('PracticeComplete');
    expect(params.previousThreadStrength).toBe(47);
    expect(params.newThreadStrength).toBe(59);
    expect(params.didCrossStage).toBe(true);
    expect(params).not.toHaveProperty('durationSeconds');
  });

  it('restarts Deep Prime practice through the canonical entry point on repeat, preserving duration', () => {
    render(<DeepPrimeCompletionScreen />);

    fireEvent.press(screen.getByText('Prime Again'));

    expect(mockStartPractice).toHaveBeenCalledTimes(1);
    expect(mockStartPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'deepPrime',
        anchorId: 'anchor-1',
        durationSeconds: 300,
      }),
    );
  });

  it('renders the secondary Trace CTA directly without any popup modal', () => {
    render(<DeepPrimeCompletionScreen />);

    expect(screen.getByTestId('post-prime-trace-button')).toBeTruthy();
    expect(screen.getByText('Trace')).toBeTruthy();
    expect(screen.queryByTestId('post-prime-trace-modal')).toBeNull();
  });

  it('starting trace navigates to ManualReinforcement and tracks completion once the flow resolves', async () => {
    render(<DeepPrimeCompletionScreen />);

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
