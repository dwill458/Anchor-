import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { VisionPhoto } from '../VisionPhoto';

jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));

it('uses measured pixel dimensions for native image overscan without changing the source', () => {
  const source = { uri: 'https://example.com/vision.jpg' };
  const view = render(<VisionPhoto source={source} testID="photo" />);
  fireEvent(view.getByTestId('photo'), 'layout', { nativeEvent: { layout: { width: 320, height: 360 } } });
  const image = view.UNSAFE_getByType(Image);
  expect(image.props.source).toBe(source);
  expect(image.props.resizeMode).toBe('cover');
  const style = StyleSheet.flatten(image.props.style);
  expect(style.width).toBeCloseTo(377.6);
  expect(style.height).toBeCloseTo(424.8);
  expect(style.marginLeft).toBeCloseTo(-28.8);
  expect(style.marginTop).toBeCloseTo(-32.4);
});
