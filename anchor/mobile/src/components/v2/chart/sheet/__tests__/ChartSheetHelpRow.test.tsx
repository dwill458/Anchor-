jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return { CircularAnchorRenderer: (props: { svg: string; category?: string }) => <View testID="sheet-anchor" accessibilityLabel={`avatar:${props.svg}:${props.category}`} /> };
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartSheetHelpRow } from '../ChartSheetHelpRow';

const art = { svg: '<svg id="mine"/>', imageUrl: null, category: 'career', expression: null };

describe('ChartSheetHelpRow', () => {
  it('shows the person’s own Anchor and Help me move forward, and routes each tap', () => {
    const onOpenAnchor = jest.fn();
    const onAskChart = jest.fn();
    const screen = render(<ChartSheetHelpRow category="career" anchorArt={art} onOpenAnchor={onOpenAnchor} onAskChart={onAskChart} />);
    expect(screen.getByLabelText('avatar:<svg id="mine"/>:career')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-open-anchor'));
    fireEvent.press(screen.getByTestId('chart-help-forward'));
    expect(onOpenAnchor).toHaveBeenCalledTimes(1);
    expect(onAskChart).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Help me move forward')).toBeTruthy();
  });

  it('offers only what can work: no Anchor art means no Anchor button, and no handlers means nothing at all', () => {
    const noArt = render(<ChartSheetHelpRow category="career" anchorArt={null} onOpenAnchor={jest.fn()} onAskChart={jest.fn()} />);
    expect(noArt.queryByTestId('chart-open-anchor')).toBeNull();
    expect(noArt.getByTestId('chart-help-forward')).toBeTruthy();
    const nothing = render(<ChartSheetHelpRow category="career" anchorArt={art} />);
    expect(nothing.queryByTestId('chart-sheet-help-row')).toBeNull();
  });

  it('is labelled for assistive tech', () => {
    const screen = render(<ChartSheetHelpRow category="health" anchorArt={art} onOpenAnchor={jest.fn()} onAskChart={jest.fn()} />);
    expect(screen.getByLabelText('Open your Anchor')).toBeTruthy();
    expect(screen.getByLabelText('Help me move forward')).toBeTruthy();
  });
});
