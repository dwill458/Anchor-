import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

import { PaywallScreen } from '../PaywallScreen';

describe('PaywallScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });
});
