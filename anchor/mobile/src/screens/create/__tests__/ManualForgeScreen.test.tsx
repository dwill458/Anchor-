import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PanResponder } from 'react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({
    params: {
      intentionText: 'Hold steady',
      category: 'deep_work',
      distilledLetters: ['H', 'O', 'L', 'D', 'S', 'T', 'E', 'A', 'D', 'Y'],
      isFromScratch: true,
    },
  }),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@/components/common', () => ({ ZenBackground: 'ZenBackground' }));
jest.mock('@/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

import ManualForgeScreen from '../ManualForgeScreen';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';

describe('ManualForgeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    useFirstAnchorFlowStore.getState().clearDraft();
    jest.spyOn(PanResponder, 'create').mockImplementation((config: any) => ({
      panHandlers: {
        onResponderGrant: config.onPanResponderGrant,
        onResponderMove: config.onPanResponderMove,
        onResponderRelease: config.onPanResponderRelease,
        onResponderTerminate: config.onPanResponderTerminate,
      },
    }) as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the action disabled until a stroke exists', () => {
    render(<ManualForgeScreen />);

    expect(screen.getByText('Source Letters')).toBeTruthy();
    expect(screen.getByText('H O L D S T E A D Y')).toBeTruthy();
    expect(screen.getByLabelText('Use This Structure').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Undo').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Redo').props.accessibilityState.disabled).toBe(true);
  });

  it('renders the live stroke, confirms clear, and preserves the draft into StyleSelection', () => {
    render(<ManualForgeScreen />);
    const canvas = screen.getByTestId('manual-drawing-area');

    const drawStroke = (start: number, end: number) => {
      act(() => {
        const props = canvas.props as any;
        props.onResponderGrant({ nativeEvent: { locationX: start, locationY: start } }, {});
        props.onResponderMove({ nativeEvent: { locationX: end, locationY: end } }, {});
        props.onResponderRelease({ nativeEvent: {} }, {});
      });
    };
    drawStroke(24, 48);
    drawStroke(72, 96);

    const useStructure = screen.getByLabelText('Use This Structure');
    expect(useStructure.props.accessibilityState.disabled).toBe(false);
    expect(useFirstAnchorFlowStore.getState().draft?.drawingStrokes?.length).toBe(2);

    fireEvent.press(screen.getByLabelText('Clear'));
    expect(screen.getByText('Clear all strokes?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Keep drawing'));
    expect(screen.queryByText('Clear all strokes?')).toBeNull();

    fireEvent.press(useStructure);
    fireEvent.press(screen.getByText('Continue →'));
    expect(mockNavigate).toHaveBeenCalledWith('StyleSelection', expect.objectContaining({
      intentionText: 'Hold steady',
      category: 'deep_work',
      distilledLetters: ['H', 'O', 'L', 'D', 'S', 'T', 'E', 'A', 'D', 'Y'],
      baseSigilSvg: expect.stringContaining('<svg'),
    }));
    expect(useFirstAnchorFlowStore.getState().draft?.structure).toBe('drawn');
  });
});
