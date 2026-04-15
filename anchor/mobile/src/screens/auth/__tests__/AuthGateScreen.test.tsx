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

  it('opens account creation from the auth gate', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Forge Free for 7 Days'));

    expect(mockNavigate).toHaveBeenCalledWith('SignUp');
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
