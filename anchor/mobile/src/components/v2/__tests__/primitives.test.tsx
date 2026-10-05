import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { CircularAnchorRenderer, V2Button, V2IconButton, V2ThreadStrength } from '@/components/v2';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';

let mockReduce = false;
jest.mock('@/hooks/v2/useV2ReduceMotion', () => ({
  useV2ReduceMotion: () => mockReduce,
  useCreationReduceMotion: () => mockReduce,
}));

const withEntering = (root: { findAll: (predicate: (node: { props?: Record<string, unknown> }) => boolean) => unknown[] }) =>
  root.findAll((node) => node.props?.entering !== undefined);

describe('V2 interactive primitives', () => {
  beforeEach(() => {
    mockReduce = false;
  });

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

  it('answers the finger: buttons track press in and out', () => {
    const handlersOn = (root: { findAll: (predicate: (node: { props?: Record<string, unknown> }) => boolean) => unknown[] }, testID: string) =>
      root.findAll((node) => node.props?.testID === testID && typeof node.props?.onPressIn === 'function' && typeof node.props?.onPressOut === 'function');
    const button = render(<V2Button testID="button" onPress={jest.fn()}>Save</V2Button>);
    expect(handlersOn(button.UNSAFE_root, 'button').length).toBeGreaterThan(0);
    const icon = render(<V2IconButton testID="icon" icon={<Text>+</Text>} accessibilityLabel="Add Anchor" onPress={jest.fn()} />);
    expect(handlersOn(icon.UNSAFE_root, 'icon').length).toBeGreaterThan(0);
  });

  it('presses an icon button, but not a disabled one', () => {
    const onPress = jest.fn();
    const { getByTestId, rerender } = render(<V2IconButton testID="icon" icon={<Text>+</Text>} accessibilityLabel="Add Anchor" onPress={onPress} />);
    fireEvent.press(getByTestId('icon'));
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<V2IconButton testID="icon" icon={<Text>+</Text>} accessibilityLabel="Add Anchor" onPress={onPress} disabled />);
    fireEvent.press(getByTestId('icon'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not press while loading, and fades the spinner in', () => {
    const onPress = jest.fn();
    const { getByTestId, UNSAFE_root } = render(<V2Button testID="button" onPress={onPress} loading>Save</V2Button>);
    fireEvent.press(getByTestId('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(withEntering(UNSAFE_root).length).toBeGreaterThan(0);
  });

  it('still renders and presses under reduced motion', () => {
    mockReduce = true;
    const onPress = jest.fn();
    const { getByTestId } = render(<V2Button testID="button" onPress={onPress}>Save</V2Button>);
    fireEvent.press(getByTestId('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
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
    expect(renderer.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 64, height: 64, backgroundColor: '#A879321F' })]));
  });

  it('clamps display values only and uses direct values in reduced-motion mode', () => {
    const { getByTestId, rerender } = render(<V2ThreadStrength testID="strength" value={108} delta={7} category="Career" trend="up" reduceMotion />);
    expect(getByTestId('v2-thread-strength-value').props.children).toBe(100);
    expect(getByTestId('strength').props.accessibilityLabel).toContain('up 7');
    rerender(<V2ThreadStrength testID="strength" value={-6} category="Career" reduceMotion />);
    expect(getByTestId('v2-thread-strength-value').props.children).toBe(0);
  });
});
