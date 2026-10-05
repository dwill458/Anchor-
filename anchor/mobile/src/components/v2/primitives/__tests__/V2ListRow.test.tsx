import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { V2ListRow } from '../V2ListRow';

jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({ useV2ReduceMotion: () => false }));

const tracksPress = (root: { findAll: (predicate: (node: { props?: Record<string, unknown> }) => boolean) => unknown[] }, testID: string) =>
  root.findAll((node) => node.props?.testID === testID && typeof node.props?.onPressIn === 'function' && typeof node.props?.onPressOut === 'function').length > 0;

describe('V2ListRow', () => {
  it('presses and tracks the touch when it has an action', () => {
    const onPress = jest.fn();
    const view = render(<V2ListRow testID="row" icon={<Text>i</Text>} title="Settings" disclosure onPress={onPress} />);
    fireEvent.press(view.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('row').props.accessibilityRole).toBe('button');
    expect(tracksPress(view.UNSAFE_root, 'row')).toBe(true);
  });

  it('is inert without an action: no button role, no press tracking', () => {
    const view = render(<V2ListRow testID="row" icon={<Text>i</Text>} title="Version" />);
    expect(view.getByTestId('row').props.accessibilityRole).toBeUndefined();
    expect(tracksPress(view.UNSAFE_root, 'row')).toBe(false);
    expect(view.getByText('Version')).toBeTruthy();
  });
});
