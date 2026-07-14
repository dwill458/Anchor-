import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { CompletionModal } from '../CompletionModal';
import { createMockAnchor } from '@/__tests__/utils/testUtils';

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  Reanimated.useSharedValue = (initialValue: unknown) => {
    const ref = React.useRef({ value: initialValue });
    return ref.current;
  };
  return Reanimated;
});

jest.mock('@/components/common', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    OptimizedImage: (props: any) => <View {...props} />,
    PremiumAnchorGlow: () => <View />,
  };
});

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => false,
}));

jest.mock('@/stores/teachingStore', () => ({
  useTeachingStore: () => ({ recordShown: jest.fn() }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

describe('CompletionModal', () => {
  it('submits only once across rapid Done and Skip presses', () => {
    const onDone = jest.fn();
    const anchor = createMockAnchor({
      id: 'test-anchor-id',
      baseSigilSvg: '<svg></svg>',
    });
    const { getByLabelText, getByTestId } = render(
      <CompletionModal
        visible
        sessionType="activate"
        anchor={anchor}
        onDone={onDone}
      />
    );

    const done = getByTestId('completion-modal-done');
    const skip = getByLabelText('Skip reflection');
    fireEvent.press(done);
    fireEvent.press(skip);
    fireEvent.press(done);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(getByTestId('completion-modal-done').props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});
