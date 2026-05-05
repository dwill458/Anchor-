import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

import AuthGateScreen from '../AuthGateScreen';

describe('AuthGateScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  it('shows only monthly and annual plans', () => {
    render(<AuthGateScreen />);

    expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Annual').length).toBeGreaterThan(0);
    expect(screen.queryByText('Lifetime')).toBeNull();
  });

  it('opens account creation from the auth gate', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Start with Monthly, Monthly selected'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', { initialTab: 'signup' });
  });

  it('opens sign in from the auth gate', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('dismisses the auth gate when Close is pressed', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
