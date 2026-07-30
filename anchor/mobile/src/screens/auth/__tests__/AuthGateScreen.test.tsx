import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();
const mockGetOfferingDisplayMetadata = jest.fn();
const mockSetPreferredPlanId = jest.fn();

let mockPendingFirstAnchorDraft: { tempAnchorId: string } | null = null;
let mockPendingForgeResumeTarget: string | null = 'CreateAnchor';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      clearPendingForgeIntent: jest.fn(),
      pendingForgeResumeTarget: mockPendingForgeResumeTarget,
      clearPendingForgeResumeTarget: jest.fn(),
      pendingFirstAnchorDraft: mockPendingFirstAnchorDraft,
    }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      anchors: [],
    }),
}));

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setPreferredPlanId: mockSetPreferredPlanId,
    }),
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    getOfferingDisplayMetadata: (...args: any[]) => mockGetOfferingDisplayMetadata(...args),
  },
}));

import AuthGateScreen from '../AuthGateScreen';

describe('AuthGateScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReplace.mockClear();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockGetOfferingDisplayMetadata.mockReset();
    mockGetOfferingDisplayMetadata.mockResolvedValue({});
    mockSetPreferredPlanId.mockClear();
    mockPendingFirstAnchorDraft = null;
    mockPendingForgeResumeTarget = 'CreateAnchor';
  });

  it('shows only monthly and annual plans', () => {
    render(<AuthGateScreen />);

    expect(screen.getAllByText('Monthly').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Annual').length).toBeGreaterThan(0);
    expect(screen.queryByText('Lifetime')).toBeNull();
  });

  it('loads live annual pricing metadata when available', async () => {
    mockGetOfferingDisplayMetadata.mockResolvedValueOnce({
      annual: {
        planId: 'annual',
        packageId: '$rc_annual',
        price: 59.99,
        priceString: '$59.99',
        currencyCode: 'USD',
        subscriptionPeriod: 'P1Y',
        pricePerMonthString: '$5.00',
      },
    });

    render(<AuthGateScreen />);

    await waitFor(() => {
      expect(screen.getByText('$5.00/mo · best value')).toBeTruthy();
    });
  });

  it('opens account creation from the auth gate', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Create account to continue, Annual selected'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      initialTab: 'signup',
      context: undefined,
      preferredPlanId: 'annual',
    });
    expect(mockSetPreferredPlanId).toHaveBeenCalledWith('annual');
  });

  it('opens sign in from the auth gate', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Already forging? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      context: undefined,
      preferredPlanId: 'annual',
    });
  });

  it('routes first-anchor account creation through the account-finalization flow', () => {
    mockPendingFirstAnchorDraft = { tempAnchorId: 'pending-first-anchor-1' };

    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Create account to continue, Annual selected'));

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      initialTab: 'signup',
      context: 'first_anchor_gate',
      preferredPlanId: 'annual',
    });
  });

  it('returns to the previous creation flow when a resume target exists', () => {
    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the vault when there is no safe resume target', () => {
    mockPendingForgeResumeTarget = null;

    render(<AuthGateScreen />);

    fireEvent.press(screen.getByLabelText('Close'));

    expect(mockReplace).toHaveBeenCalledWith('Vault');
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
