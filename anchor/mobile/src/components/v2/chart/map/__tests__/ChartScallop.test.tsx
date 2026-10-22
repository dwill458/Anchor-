import React from 'react';
import { render } from '@testing-library/react-native';
import { ChartScallop } from '../ChartScallop';

describe('ChartScallop', () => {
  it('is hidden from assistive tech', () => {
    const { getByTestId } = render(<ChartScallop width={390} testID="sc" />);
    const svg = getByTestId('sc', { includeHiddenElements: true });
    expect(svg.props.accessibilityElementsHidden).toBe(true);
    expect(svg.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('honours width and colour', () => {
    const { toJSON } = render(<ChartScallop width={195} color="#123456" testID="sc" />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#123456');
    expect(json).toContain('195');
  });
});
