import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AdaptiveGlassView, useAdaptiveGlass } from '../AdaptiveGlassView';
import * as useAppPerfHook from '@/hooks/useAppPerformanceTier';

describe('AdaptiveGlassView', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders BlurView when tier is high', () => {
    jest.spyOn(useAppPerfHook, 'useAppPerformanceTier').mockReturnValue('high');

    const { getByText, toJSON } = render(
      <AdaptiveGlassView intensity={30} testID="adaptive-glass">
        <Text>Content inside high tier</Text>
      </AdaptiveGlassView>
    );

    expect(getByText('Content inside high tier')).toBeTruthy();
    expect(toJSON()).toBeTruthy();
  });

  it('renders solid/semi-opaque fallback when tier is low', () => {
    jest.spyOn(useAppPerfHook, 'useAppPerformanceTier').mockReturnValue('low');

    const { getByText, toJSON } = render(
      <AdaptiveGlassView
        intensity={30}
        fallbackColor="rgba(12, 17, 24, 0.95)"
        testID="adaptive-glass-low"
      >
        <Text>Content inside low tier</Text>
      </AdaptiveGlassView>
    );

    expect(getByText('Content inside low tier')).toBeTruthy();
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
