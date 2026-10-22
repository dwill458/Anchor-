import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockCanGoBack = jest.fn(() => false);
const mockParentGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, canGoBack: mockCanGoBack, goBack: jest.fn(), getParent: () => ({ goBack: mockParentGoBack }) }),
}));

import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { ProfileScreen } from '../ProfileScreen';

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAuthStore.setState({ user: { id: 'user-1', displayName: 'Deontrez' } as never });
    useProfileStore.setState({ name: 'Deontrez', photo: null });
  });

  it('provides a Settings row that opens the existing Settings route', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('profile-settings-row'));
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });
});
