import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockPendingFirstAnchorDraft: { tempAnchorId: string } | null = null;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      clearPendingForgeIntent: jest.fn(),
      clearPendingForgeResumeTarget: jest.fn(),
      pendingFirstAnchorDraft: mockPendingFirstAnchorDraft,
    }),
}));

import AuthGateScreen from '../AuthGateScreen';

describe('AuthGateScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockPendingFirstAnchorDraft = null;
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

    expect(mockNavigate).toHaveBeenCalledWith('Login', { context: undefined });
  });

  it('routes first-anchor account creation through the account-finalization flow', () => {
    mockPendingFirstAnchorDraft = { tempAnchorId: 'pending-first-anchor-1' };

    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Start with Monthly, Monthly selected'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      initialTab: 'signup',
      context: 'first_anchor_gate',
    });
  });

  it('dismisses the auth gate when Close is pressed', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
