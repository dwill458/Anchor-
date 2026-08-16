import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NewAnchorTile } from '../NewAnchorTile';
import { safeHaptics } from '@/utils/haptics';

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    impact: jest.fn(),
  },
}));

describe('NewAnchorTile', () => {
  it('renders the New Anchor label and triggers onPress with haptic feedback', () => {
    const onPress = jest.fn();
    render(<NewAnchorTile onPress={onPress} />);

    expect(screen.getByText('New Anchor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create new anchor' })).toBeTruthy();

    fireEvent.press(screen.getByTestId('new-anchor-tile'));

    expect(safeHaptics.impact).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
