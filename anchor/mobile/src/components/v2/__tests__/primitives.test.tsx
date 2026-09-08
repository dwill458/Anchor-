import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { CircularAnchorRenderer, V2Button, V2IconButton, V2ThreadStrength } from '@/components/v2';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';

describe('V2 interactive primitives', () => {
  it('presses a button, protects disabled/loading state, and exposes semantics', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(<V2Button testID="button" accessibilityLabel="Save Anchor" onPress={onPress}>Save</V2Button>);
    fireEvent.press(getByTestId('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<V2Button testID="button" accessibilityLabel="Save Anchor" onPress={onPress} disabled>Save</V2Button>);
    fireEvent.press(getByTestId('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<V2Button testID="button" accessibilityLabel="Save Anchor" onPress={onPress} loading>Save</V2Button>);
    expect(getByTestId('button-loading')).toBeTruthy();
    expect(getByTestId('button').props.accessibilityState.busy).toBe(true);
  });

  it('enforces a 44px icon target and requires a usable label', () => {
    const { getByTestId } = render(<V2IconButton testID="icon" icon={<Text>+</Text>} accessibilityLabel="Add Anchor" />);
    expect(getByTestId('icon').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 44, height: 44 })]));
    expect(getByTestId('icon').props.accessibilityLabel).toBe('Add Anchor');
  });

  it('renders an accessible, category-field Anchor at tokenized sizes', () => {
    const { getByTestId } = render(<CircularAnchorRenderer testID="anchor" svg={V2_SAMPLE_ANCHOR_SVGS.medium} category="Career" size="thumbnail" />);
    const renderer = getByTestId('anchor');
    expect(renderer.props.accessibilityRole).toBe('image');
    expect(renderer.props.accessibilityLabel).toContain('Career');
    expect(renderer.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 64, height: 64, backgroundColor: '#3157D81F' })]));
  });

  it('clamps display values only and uses direct values in reduced-motion mode', () => {
    const { getByTestId, rerender } = render(<V2ThreadStrength testID="strength" value={108} delta={7} category="Career" trend="up" reduceMotion />);
    expect(getByTestId('v2-thread-strength-value').props.children).toBe(100);
    expect(getByTestId('strength').props.accessibilityLabel).toContain('up 7');
    rerender(<V2ThreadStrength testID="strength" value={-6} category="Career" reduceMotion />);
    expect(getByTestId('v2-thread-strength-value').props.children).toBe(0);
  });
});
