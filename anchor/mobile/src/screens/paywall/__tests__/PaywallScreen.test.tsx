import React from 'react';
import { StyleSheet } from 'react-native';
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
    const RevenueCatService = require('@/services/RevenueCatService').default;
    RevenueCatService.purchasePackageByIdentifier.mockReset();
    RevenueCatService.purchasePackageByIdentifier.mockResolvedValue({
      status: { hasActiveEntitlement: false },
      dismissed: true,
    });
    RevenueCatService.restorePurchases.mockReset();
    RevenueCatService.restorePurchases.mockResolvedValue({
      hasActiveEntitlement: false,
    });
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

    expect(mockNavigate).toHaveBeenCalledWith('Settings', {
      screen: 'Login',
      params: {
        initialTab: 'signin',
        context: 'paywall',
      },
    });
  });

  it('applies a full-card selected fill to the chosen plan', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByTestId('paywall-plan-annual'));

    expect(
      StyleSheet.flatten(screen.getByTestId('paywall-plan-overlay-annual').props.style).backgroundColor
    ).toContain('0.12');
    expect(
      StyleSheet.flatten(screen.getByTestId('paywall-plan-overlay-monthly').props.style).backgroundColor
    ).toContain('0.03');
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

  it('purchases the plan immediately when a plan card is pressed', async () => {
    const RevenueCatService = require('@/services/RevenueCatService').default;
    RevenueCatService.purchasePackageByIdentifier.mockResolvedValueOnce({
      status: { hasActiveEntitlement: false },
      dismissed: true,
    });

    render(<PaywallScreen />);

    fireEvent.press(screen.getByTestId('paywall-plan-annual'));

    await waitFor(() => {
      expect(RevenueCatService.purchasePackageByIdentifier).toHaveBeenCalledWith('$rc_annual');
    });
  });
});
