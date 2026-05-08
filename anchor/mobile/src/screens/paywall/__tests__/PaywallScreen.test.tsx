import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockDispatch = jest.fn();
const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    dispatch: mockDispatch,
    reset: mockReset,
  }),
}));

import { PaywallScreen } from '../PaywallScreen';

describe('PaywallScreen', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockReset.mockClear();
  });

  it('shows only monthly and annual plans', () => {
    render(<PaywallScreen />);

    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Annual')).toBeTruthy();
    expect(screen.queryByText('Lifetime')).toBeNull();
    expect(screen.getByText('Get Monthly Access')).toBeTruthy();
  });

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockDispatch).toHaveBeenCalled();
  });
});
