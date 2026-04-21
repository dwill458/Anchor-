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

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockDispatch).toHaveBeenCalled();
  });
});
