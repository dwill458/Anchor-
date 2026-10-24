jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => {
  const { View } = require('react-native');
  return { CircularAnchorRenderer: (props: { svg: string; category?: string }) => <View testID="sheet-anchor" accessibilityLabel={`avatar:${props.svg}:${props.category}`} /> };
});

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChartSheetAnchorCard } from '../ChartSheetAnchorCard';
import { panelAccent } from '../../panel/chartPanelColors';

const art = { svg: '<svg id="mine"/>', imageUrl: null, category: 'career', expression: null };

describe('ChartSheetAnchorCard', () => {
  it('shows the person’s real Anchor, its stored Thread Strength, and routes each tap', () => {
    const onOpenAnchor = jest.fn();
    const onOpenPractice = jest.fn();
    const screen = render(<ChartSheetAnchorCard category="career" anchorArt={art} threadStrength={53} practiced={false} onOpenAnchor={onOpenAnchor} onOpenPractice={onOpenPractice} />);
    expect(screen.getByLabelText('avatar:<svg id="mine"/>:career')).toBeTruthy();
    expect(screen.getByTestId('chart-anchor-strength').props.accessibilityLabel).toBe('Thread Strength 53 percent');
    expect(screen.getByText('Thread Strength · 53%')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-open-anchor'));
    fireEvent.press(screen.getByTestId('chart-practice-row'));
    expect(onOpenAnchor).toHaveBeenCalledTimes(1);
    expect(onOpenPractice).toHaveBeenCalledWith('focus');
  });

  it('rounds and clamps the stored value, and hides the line while the Anchor is unmeasured', () => {
    expect(render(<ChartSheetAnchorCard category="career" anchorArt={art} threadStrength={53.6} practiced={false} />).getByText('Thread Strength · 54%')).toBeTruthy();
    expect(render(<ChartSheetAnchorCard category="career" anchorArt={art} threadStrength={140} practiced={false} />).getByText('Thread Strength · 100%')).toBeTruthy();
    expect(render(<ChartSheetAnchorCard category="career" anchorArt={art} threadStrength={null} practiced={false} />).queryByTestId('chart-anchor-strength')).toBeNull();
  });

  it('after practicing today it says so and offers Deep Focus through the same existing practice entry', () => {
    const onOpenPractice = jest.fn();
    const screen = render(<ChartSheetAnchorCard category="career" anchorArt={art} threadStrength={40} practiced onOpenPractice={onOpenPractice} />);
    expect(screen.getByText('Practiced today')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chart-practice-row'));
    expect(onOpenPractice).toHaveBeenCalledWith('deep_prime');
  });

  it('takes its colour from the Anchor’s category, never a fixed one', () => {
    const career = render(<ChartSheetAnchorCard category="career" anchorArt={art} practiced={false} onOpenPractice={jest.fn()} />);
    const health = render(<ChartSheetAnchorCard category="health" anchorArt={art} practiced={false} onOpenPractice={jest.fn()} />);
    const flat = (node: { props: { style?: unknown } }) => JSON.stringify(typeof node.props.style === 'function' ? (node.props.style as (s: { pressed: boolean }) => unknown)({ pressed: false }) : node.props.style);
    expect(flat(career.getByTestId('chart-practice-row'))).toContain(panelAccent('career').fill);
    expect(flat(health.getByTestId('chart-practice-row'))).toContain(panelAccent('health').fill);
    expect(panelAccent('career').fill).not.toBe(panelAccent('health').fill);
  });

  it('is not interactive where there is nothing to open', () => {
    const screen = render(<ChartSheetAnchorCard category="career" anchorArt={art} practiced={false} />);
    expect(screen.queryByTestId('chart-open-anchor')).toBeNull();
    expect(screen.queryByTestId('chart-practice-row')).toBeNull();
  });
});
