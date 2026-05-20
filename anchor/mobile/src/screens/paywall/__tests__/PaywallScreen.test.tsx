import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    dispatch: mockDispatch,
    reset: mockReset,
  }),
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    purchasePackageByIdentifier: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

import { PaywallScreen } from '../PaywallScreen';

describe('PaywallScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockDispatch.mockClear();
    mockReset.mockClear();
  });

  it('shows only monthly and annual plans', () => {
    render(<PaywallScreen />);

    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Annual')).toBeTruthy();
    expect(screen.queryByText('Lifetime')).toBeNull();
    expect(screen.getByText('FORGE MY PRACTICE')).toBeTruthy();
  });

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      initialTab: 'signin',
      context: 'paywall',
    });
  });

  it('calls purchasePackageByIdentifier when the CTA is pressed', async () => {
    const RevenueCatService = require('@/services/RevenueCatService').default;
    RevenueCatService.purchasePackageByIdentifier.mockResolvedValueOnce({
      status: { hasActiveEntitlement: true },
      dismissed: false,
    });

    render(<PaywallScreen />);

    const purchaseButton = screen.getByText('FORGE MY PRACTICE');
    fireEvent.press(purchaseButton);

    await waitFor(() => {
      expect(RevenueCatService.purchasePackageByIdentifier).toHaveBeenCalled();
    });
  });
});
