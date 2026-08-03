import React from 'react';
import { render } from '@testing-library/react-native';
import { DestinationMarker } from '../DestinationMarker';

const baseProps = { x: 160, y: 40, mapWidth: 320, mapHeight: 400, reducedMotion: false };

describe('DestinationMarker', () => {
  it('renders the destination text when provided', () => {
    const { getByText } = render(<DestinationMarker {...baseProps} destinationText="Become a published author" completed={false} />);
    expect(getByText('Become a published author')).toBeTruthy();
  });

  it('renders without a label when destinationText is null (malformed/missing data)', () => {
    const { queryByText, getByTestId } = render(
      <DestinationMarker {...baseProps} destinationText={null} completed={false} testID="destination" />,
    );
    expect(getByTestId('destination')).toBeTruthy();
    expect(queryByText(/./)).toBeNull();
  });

  it('is decorative — non-interactive and does not intercept touches', () => {
    const { getByTestId } = render(<DestinationMarker {...baseProps} destinationText="Destination" completed={false} testID="destination" />);
    expect(getByTestId('destination').props.pointerEvents).toBe('none');
  });

  it('grows more prominent once the Course is completed (culmination)', () => {
    const { getByText, rerender } = render(
      <DestinationMarker {...baseProps} destinationText="Destination" completed={false} />,
    );
    const contextualStyle = getByText('Destination').props.style;
    const contextualFlat = Array.isArray(contextualStyle) ? Object.assign({}, ...contextualStyle) : contextualStyle;

    rerender(<DestinationMarker {...baseProps} destinationText="Destination" completed />);
    const completedStyle = getByText('Destination').props.style;
    const completedFlat = Array.isArray(completedStyle) ? Object.assign({}, ...completedStyle) : completedStyle;

    expect(completedFlat.fontFamily).not.toBe(contextualFlat.fontFamily);
    expect(completedFlat.color).not.toBe(contextualFlat.color);
  });
});
