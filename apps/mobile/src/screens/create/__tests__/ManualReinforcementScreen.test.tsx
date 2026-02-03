import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ManualReinforcementScreen from '../ManualReinforcementScreen';

const mockNavigate = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/components/common', () => ({
  ZenBackground: () => null,
  SigilSvg: () => null,
}));

const mockUseAuthStore = jest.fn();
mockUseAuthStore.getState = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockUseAuthStore(),
}));

jest.mock('react-native-reanimated', () => ({
  runOnJS: (fn: any) => fn,
}));

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  return {
    GestureDetector: ({ children }: any) => <>{children}</>,
    Gesture: {
      Pan: () => {
        const api: any = {};
        api.onStart = () => api;
        api.onUpdate = () => api;
        api.onEnd = () => api;
        return api;
      },
    },
  };
});

describe('ManualReinforcementScreen', () => {
  const getDisabledState = (node: any): boolean | undefined => {
    let current = node;
    while (current) {
      const accessibilityDisabled = current.props?.accessibilityState?.disabled;
      if (accessibilityDisabled !== undefined) {
        return accessibilityDisabled;
      }
      if (current.props?.disabled !== undefined) {
        return current.props.disabled;
      }
      current = current.parent;
    }
    return undefined;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRoute.mockReturnValue({
      params: {
        intentionText: 'Test intention',
        category: 'personal_growth',
        distilledLetters: ['A', 'B'],
        baseSigilSvg: '<svg></svg>',
        structureVariant: 'balanced',
      },
    });

    mockUseAuthStore.mockReturnValue({
      anchorCount: 0,
    });
  });

  it('renders the header copy', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    expect(getByText('Trace Your Structure')).toBeTruthy();
    expect(getByText('Move slowly over the lines. Let your hand remember.')).toBeTruthy();
  });

  it('shows the drawing hint for first-time users', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    expect(getByText('Touch and draw over the lines')).toBeTruthy();
  });

  it('hides the drawing hint for returning users', () => {
    mockUseAuthStore.mockReturnValue({
      anchorCount: 3,
    });

    const { queryByText } = render(<ManualReinforcementScreen />);

    expect(queryByText('Touch and draw over the lines')).toBeNull();
  });

  it('opens the skip confirmation modal', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    fireEvent.press(getByText('Continue without tracing').parent as any);

    expect(getByText('Continue Without Tracing')).toBeTruthy();
    expect(getByText("Some find tracing deepens their focus. It's completely optional.")).toBeTruthy();
  });

  it('closes the modal when choosing to stay and trace', () => {
    const { getByText, queryByText } = render(<ManualReinforcementScreen />);

    fireEvent.press(getByText('Continue without tracing').parent as any);
    fireEvent.press(getByText('Stay and Trace').parent as any);

    expect(queryByText('Continue Without Tracing')).toBeNull();
  });

  it('navigates with skip metadata when confirming skip', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    fireEvent.press(getByText('Continue without tracing').parent as any);
    fireEvent.press(getByText('Continue').parent as any);

    expect(mockNavigate).toHaveBeenCalledWith('LockStructure', {
      intentionText: 'Test intention',
      category: 'personal_growth',
      distilledLetters: ['A', 'B'],
      baseSigilSvg: '<svg></svg>',
      reinforcedSigilSvg: undefined,
      structureVariant: 'balanced',
      reinforcementMetadata: expect.objectContaining({
        completed: false,
        skipped: true,
        strokeCount: 0,
        fidelityScore: 0,
      }),
    });
  });

  it('keeps undo and start over disabled when no strokes exist', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    const undoButton = getByText('Undo');
    const startOverButton = getByText('Start Over');

    expect(getDisabledState(undoButton)).toBe(true);
    expect(getDisabledState(startOverButton)).toBe(true);
  });

  it('keeps Lock Structure disabled before any strokes', () => {
    const { getByText } = render(<ManualReinforcementScreen />);

    const lockButton = getByText('Lock Structure');
    expect(getDisabledState(lockButton)).toBe(true);
  });

  it('does not render the skip modal by default', () => {
    const { queryByText } = render(<ManualReinforcementScreen />);

    expect(queryByText('Continue Without Tracing')).toBeNull();
  });
});
