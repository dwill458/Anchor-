import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HandDrawnThreadLine, buildThreadRibbonPath } from '../HandDrawnThreadLine';

const layout = (testID: string, width: number) =>
  fireEvent(screen.getByTestId(`${testID}-track`), 'layout', { nativeEvent: { layout: { width, height: 18 } } });

describe('buildThreadRibbonPath', () => {
  const dims = { height: 18, weight: 3.6, taper: 20 };

  it('is deterministic: identical inputs give an identical path', () => {
    expect(buildThreadRibbonPath(240, dims)).toBe(buildThreadRibbonPath(240, dims));
  });

  it('returns nothing for a non-positive length', () => {
    expect(buildThreadRibbonPath(0, dims)).toBe('');
  });

  it('keeps the fill on the track: the fill shares its centre line with a longer stroke', () => {
    const fill = buildThreadRibbonPath(120, dims);
    const track = buildThreadRibbonPath(240, dims);
    // Both start at the same point (x = 0) because wobble is a function of absolute x.
    expect(fill.split(' L ')[0]).toBe(track.split(' L ')[0]);
  });
});

describe('HandDrawnThreadLine', () => {
  it('shows the percentage label at the end of the line', () => {
    render(<HandDrawnThreadLine percent={50} color="#B8324A" testID="tl" />);
    layout('tl', 300);
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByLabelText('Consistency 50%')).toBeTruthy();
  });

  it('renders a visible fill at very low values', () => {
    render(<HandDrawnThreadLine percent={5} color="#B8324A" testID="tl" />);
    layout('tl', 300);
    expect(screen.getByText('5%')).toBeTruthy();
  });

  it('renders no percentage and no fill when the baseline is not established', () => {
    render(<HandDrawnThreadLine percent={0} unmeasured color="#B8324A" testID="tl" />);
    layout('tl', 300);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(screen.getByLabelText('Consistency not established yet')).toBeTruthy();
  });

  it('clamps out-of-range values', () => {
    render(<HandDrawnThreadLine percent={180} color="#B8324A" compact width={70} testID="tl" />);
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
