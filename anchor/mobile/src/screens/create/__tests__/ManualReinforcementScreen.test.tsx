import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import ManualReinforcementScreen from '../ManualReinforcementScreen';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: Record<string, unknown> = {
  source: 'creation',
  intentionText: 'Test Intention',
  category: 'health',
  distilledLetters: ['T', 'E', 'S', 'T'],
  baseSigilSvg: '<svg></svg>',
  structureVariant: 'balanced',
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// Selector-aware store mocks, matching zustand's API shape.
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { getAnchorById: () => undefined };
    return selector ? selector(state) : state;
  },
}));
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { user: { id: 'user-1' } };
    return selector ? selector(state) : state;
  },
}));

const mockFinishPostPrimeTraceFlow = jest.fn();
jest.mock('@/stores/postPrimeTraceStore', () => ({
  usePostPrimeTraceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { activeFlow: null, finishFlow: mockFinishPostPrimeTraceFlow };
    return selector ? selector(state) : state;
  },
}));

const mockRecordTraceSkipped = jest.fn(() => 1);
const mockResetTraceSkipStreak = jest.fn();
const mockSetTraceDefaultEnabled = jest.fn();
jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      traceDefaultEnabled: true,
      recordTraceSkipped: mockRecordTraceSkipped,
      resetTraceSkipStreak: mockResetTraceSkipStreak,
      setTraceDefaultEnabled: mockSetTraceDefaultEnabled,
      soundEffectsEnabled: false,
    };
    return selector ? selector(state) : state;
  },
}));

const mockSetUserFlag = jest.fn();
const mockRecordTraceHintSeen = jest.fn();
const mockExhaustTraceHint = jest.fn();
jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      userFlags: { hasTracedBefore: false },
      setUserFlag: mockSetUserFlag,
      recordTraceHintSeen: mockRecordTraceHintSeen,
      exhaustTraceHint: mockExhaustTraceHint,
      isTraceHintExhausted: () => false,
    };
    return selector ? selector(state) : state;
  },
}));

const mockUpdateDraft = jest.fn();
jest.mock('@/stores/firstAnchorFlowStore', () => ({
  useFirstAnchorFlowStore: {
    getState: () => ({ updateDraft: mockUpdateDraft }),
  },
}));

const mockPlaySound = jest.fn();
jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({ playSound: mockPlaySound, createManagedPlayer: jest.fn() }),
}));

let mockReduceMotion = false;
jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => mockReduceMotion,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Capture the pan gesture's handlers so tests can drive them directly,
// mirroring the pattern used for SwipeableTabContainer.
let latestGesture: {
  start: (event: { x: number; y: number }) => void;
  update: (event: { x: number; y: number }) => void;
  end: () => void;
} | null = null;

jest.mock('react-native-gesture-handler', () => {
  const createPanGesture = () => {
    const gesture: any = {
      onStart: (cb: any) => {
        gesture.start = cb;
        return gesture;
      },
      onUpdate: (cb: any) => {
        gesture.update = cb;
        return gesture;
      },
      onEnd: (cb: any) => {
        gesture.end = cb;
        return gesture;
      },
    };
    latestGesture = gesture;
    return gesture;
  };

  return {
    Gesture: { Pan: createPanGesture },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

const drawOneStroke = () => {
  act(() => {
    latestGesture?.start({ x: 10, y: 10 });
  });
  act(() => {
    latestGesture?.update({ x: 40, y: 60 });
  });
  act(() => {
    latestGesture?.end();
  });
};

describe('ManualReinforcementScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockRecordTraceSkipped.mockClear();
    mockRecordTraceSkipped.mockImplementation(() => 1);
    mockResetTraceSkipStreak.mockClear();
    mockUpdateDraft.mockClear();
    mockPlaySound.mockClear();
    mockReduceMotion = false;
    mockRouteParams = {
      source: 'creation',
      intentionText: 'Test Intention',
      category: 'health',
      distilledLetters: ['T', 'E', 'S', 'T'],
      baseSigilSvg: '<svg></svg>',
      structureVariant: 'balanced',
    };
    latestGesture = null;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.clearAllTimers();
    cleanup();
    jest.useRealTimers();
  });

  it('renders the empty state with actions disabled', () => {
    render(<ManualReinforcementScreen />);

    expect(screen.getByText('Trace anywhere on the form.')).toBeTruthy();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Undo last trace stroke').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByLabelText('Clear tracing').props.accessibilityState?.disabled).toBe(true);
  });

  it('enables actions once a stroke is drawn', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();

    expect(screen.queryByText('Trace anywhere on the form.')).toBeNull();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false);
    expect(screen.getByLabelText('Undo last trace stroke').props.accessibilityState?.disabled).toBe(false);
  });

  it('undo removes the last stroke and disables Continue again', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(screen.getByLabelText('Undo last trace stroke'));

    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
  });

  it('clears directly with a single stroke (no confirmation)', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    fireEvent.press(screen.getByLabelText('Clear tracing'));

    expect(screen.queryByText('Clear your tracing?')).toBeNull();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
  });

  it('requires confirmation to clear two or more strokes', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    drawOneStroke();
    fireEvent.press(screen.getByLabelText('Clear tracing'));

    expect(screen.getByText('Clear your tracing?')).toBeTruthy();
    // Strokes remain until the destructive action is confirmed.
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false);

    fireEvent.press(screen.getByLabelText('Clear'));

    expect(screen.queryByText('Clear your tracing?')).toBeNull();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true);
  });

  it('cancelling the clear confirmation preserves the strokes', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    drawOneStroke();
    fireEvent.press(screen.getByLabelText('Clear tracing'));
    fireEvent.press(screen.getByLabelText('Cancel'));

    expect(screen.queryByText('Clear your tracing?')).toBeNull();
    expect(screen.getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false);
  });

  it('Continue completes the trace and navigates to Style Selection', () => {
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    fireEvent.press(screen.getByLabelText('Continue'));

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
      intentionText: 'Test Intention',
      category: 'health',
      reinforcementMetadata: expect.objectContaining({ completed: true, skipped: false }),
    }));
  });

  it('Skip Tracing navigates to Style Selection with skipped metadata', () => {
    render(<ManualReinforcementScreen />);

    fireEvent.press(screen.getByLabelText('Skip Tracing'));

    expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
      intentionText: 'Test Intention',
      category: 'health',
      reinforcementMetadata: expect.objectContaining({ completed: false, skipped: true }),
    }));
  });

  it('opens and dismisses the About Tracing sheet', () => {
    render(<ManualReinforcementScreen />);

    fireEvent.press(screen.getByLabelText('About tracing'));
    expect(screen.getByText('About Tracing')).toBeTruthy();
    expect(screen.getByText(/It gives you a moment to move through the form/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Got it'));
    expect(screen.queryByText('About Tracing')).toBeNull();
  });

  it('completes instantly under reduced motion', () => {
    mockReduceMotion = true;
    render(<ManualReinforcementScreen />);

    drawOneStroke();
    fireEvent.press(screen.getByLabelText('Continue'));

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
      reinforcementMetadata: expect.objectContaining({ completed: true }),
    }));
  });
});
