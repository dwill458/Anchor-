import React from 'react';
import { render } from '@testing-library/react-native';
import { ChartGenerationStage } from '../ChartGenerationStage';
import { StyleSheet, View } from 'react-native';

it.each([320, 360, 390, 430])('%idp maps without a side crop during creation', width => {
  const screen = render(<ChartGenerationStage width={width} height={680} markers={null} reducedMotion settled />);
  const map = screen.getByTestId('chart-stage-map');
  expect(StyleSheet.flatten(map.props.style).width).toBe(width);
  const frame = screen.UNSAFE_getAllByType(View).map(node => StyleSheet.flatten(node.props.style)).find(style => style?.position === 'absolute' && style.width === width);
  expect(frame).toMatchObject({ left: 0, top: 0 });
  screen.unmount();
});
