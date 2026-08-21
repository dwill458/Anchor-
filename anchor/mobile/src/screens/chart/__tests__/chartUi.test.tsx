import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

import { ChartGhostButton, ChartIconButton, ChartScreenFrame } from '../chartUi';

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

  it('keeps compact Chart controls at least 44 points tall', () => {
    const screen = render(
      <>
        <ChartGhostButton label="Text action" />
        <ChartIconButton label="Icon action" icon={<Text>+</Text>} />
      </>,
    );

    const ghost = screen.getByLabelText('Text action');
    const ghostStyle = typeof ghost.props.style === 'function'
      ? ghost.props.style({ pressed: false })
      : ghost.props.style;
    expect(StyleSheet.flatten(ghostStyle).minHeight).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(screen.getByLabelText('Icon action').props.style)).toMatchObject({
      width: 44,
      height: 44,
    });
  });
});
