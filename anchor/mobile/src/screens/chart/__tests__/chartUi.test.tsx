import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

import { ChartScreenFrame } from '../chartUi';

describe('ChartScreenFrame', () => {
  it('keeps its header below the device safe area', () => {
    const screen = render(
      <ChartScreenFrame title="CHART" headerTopInset={8}>
        <Text>Content</Text>
      </ChartScreenFrame>,
    );

    const titleRow = screen.getByTestId('chart-screen-header');
    expect(StyleSheet.flatten(titleRow?.props.style)).toMatchObject({ marginTop: 32 });
  });
});
