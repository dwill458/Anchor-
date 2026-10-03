import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartContextStep } from '../ChartContextStep';
import { ChartGenerationStage } from '../ChartGenerationStage';
import { StyleSheet, View } from 'react-native';

it('requires a starting photo for Continue and keeps Skip as the explicit empty path', () => {
  const onContinue = jest.fn();
  const onSkip = jest.fn();
  const props = { vision: null, startPhoto: null, onContinue, onSkip, onStartPhoto: jest.fn(), onDescribe: jest.fn(), bottomInset: 0 };
  const screen = render(<ChartContextStep {...props} />);
  expect(screen.getByTestId('chart-context-photo-continue').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByTestId('chart-context-photo-continue'));
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.queryByTestId('chart-vision-context')).toBeNull();
  fireEvent.press(screen.getByTestId('chart-context-skip'));
  expect(onSkip).toHaveBeenCalledTimes(1);
  screen.rerender(<ChartContextStep {...props} startPhoto={{ kind: 'photo', id: 'start', uri: 'file:///start.jpg', mimeType: 'image/jpeg', role: 'start' }} />);
  expect(screen.getByTestId('chart-context-photo-continue').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByTestId('chart-context-photo-continue'));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

it.each([320, 360, 390, 430])('%idp maps without a side crop during creation', width => {
  const screen = render(<ChartGenerationStage width={width} height={680} markers={null} reducedMotion settled />);
  const map = screen.getByTestId('chart-stage-map');
  expect(StyleSheet.flatten(map.props.style).width).toBe(width);
  const frame = screen.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style)).find(style => style?.position === 'absolute' && style.width === width);
  expect(frame).toMatchObject({ left: 0, top: 0 });
  screen.unmount();
});
