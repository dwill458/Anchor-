import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Anchor } from '@/types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockTrack = jest.fn();

let mockAnchorState: {
  anchors: Anchor[];
  primeStreak: number;
};

let mockProgressionData: {
  forgedCount: number;
  totalPrimes: number;
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
  }),
  useRoute: () => ({ params: undefined }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: any) => selector(mockAnchorState),
}));

jest.mock('@/hooks/useProgressionData', () => ({
  useProgressionData: () => mockProgressionData,
}));

jest.mock('@/hooks/useReduceMotionEnabled', () => ({
  useReduceMotionEnabled: () => true,
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: {
    track: (...args: any[]) => mockTrack(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

jest.mock('@/services/RevenueCatService', () => ({
  __esModule: true,
  default: {
    getOfferingDisplayMetadata: jest.fn(),
    purchasePackageByIdentifier: jest.fn(),
    restorePurchases: jest.fn(),
    getPackagePresentations: jest.fn().mockResolvedValue({}),
  },
}));

import revenueCatService from '@/services/RevenueCatService';
import { PaywallScreen } from '../PaywallScreen';

const buildAnchor = (overrides: Partial<Anchor>): Anchor => ({
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Stay focused',
  category: 'career',
  distilledLetters: ['S', 'F'],
  baseSigilSvg: '<svg><path d="base" /></svg>',
  reinforcedSigilSvg: undefined,
  enhancedImageUrl: undefined,
  structureVariant: 'balanced',
  isCharged: false,
  activationCount: 0,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
  ...overrides,
});

const trialStatus = (hasActiveEntitlement: boolean) => ({
  isInTrial: false,
  isSubscribed: hasActiveEntitlement,
  hasActiveEntitlement,
  daysRemaining: null,
  trialExpired: !hasActiveEntitlement,
});

describe('PaywallScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockReset.mockClear();
    mockTrack.mockClear();
    mockAnchorState = {
      anchors: [
        buildAnchor({
          id: 'anchor-primary',
          activationCount: 5,
          reinforcedSigilSvg: '<svg><path d="primary" /></svg>',
        }),
      ],
      primeStreak: 7,
    };
    mockProgressionData = {
      forgedCount: 4,
      totalPrimes: 11,
    };

    jest.mocked(revenueCatService.getOfferingDisplayMetadata).mockReset();
    jest.mocked(revenueCatService.getOfferingDisplayMetadata).mockResolvedValue({});
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockReset();
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValue({
      status: trialStatus(false),
      dismissed: true,
    });
    jest.mocked(revenueCatService.restorePurchases).mockReset();
    jest.mocked(revenueCatService.restorePurchases).mockResolvedValue(trialStatus(false));
  });

  it('renders monthly and annual plans plus the CTA', () => {
    render(<PaywallScreen />);

    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Annual')).toBeTruthy();
    expect(screen.queryByText('Lifetime')).toBeNull();
    expect(screen.getByText('Continue my practice')).toBeTruthy();
  });

  it('selects annual by default', () => {
    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-plan-annual').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('paywall-plan-monthly').props.accessibilityState.selected).toBe(false);
    expect(
      StyleSheet.flatten(screen.getByTestId('paywall-plan-check-annual').props.style).backgroundColor
    ).toBe('#f0cb6a');
  });

  it('changes plan selection without purchasing on card press', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByTestId('paywall-plan-monthly'));

    expect(screen.getByTestId('paywall-plan-monthly').props.accessibilityState.selected).toBe(true);
    expect(revenueCatService.purchasePackageByIdentifier).not.toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('paywall_plan_selected', { plan: 'monthly' });
  });

  it('purchases the selected plan from the CTA', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValueOnce({
      status: trialStatus(false),
      dismissed: true,
    });

    render(<PaywallScreen />);

    fireEvent.press(screen.getByTestId('paywall-plan-monthly'));
    fireEvent.press(screen.getByLabelText('Continue my practice, Monthly selected'));

    await waitFor(() => {
      expect(revenueCatService.purchasePackageByIdentifier).toHaveBeenCalledWith('$rc_monthly');
    });
  });

  it('resets to Main after entitlement confirmation', async () => {
    jest.mocked(revenueCatService.purchasePackageByIdentifier).mockResolvedValueOnce({
      status: trialStatus(true),
      dismissed: false,
    });

    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Continue my practice, Annual selected'));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
  });

  it('restores and unlocks when an active entitlement is found', async () => {
    jest.mocked(revenueCatService.restorePurchases).mockResolvedValueOnce(trialStatus(true));

    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Restore purchase'));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
  });

  it('does not unlock when restore finds no active entitlement', async () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Restore purchase'));

    await waitFor(() => {
      expect(revenueCatService.restorePurchases).toHaveBeenCalled();
    });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('renders the most reinforced active anchor as the hero', () => {
    mockAnchorState.anchors = [
      buildAnchor({
        id: 'recent-less-used',
        activationCount: 2,
        reinforcedSigilSvg: '<svg><path d="recent" /></svg>',
        lastActivatedAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'older-more-used',
        activationCount: 8,
        reinforcedSigilSvg: '<svg><path d="winner" /></svg>',
        lastActivatedAt: new Date('2026-06-02T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'released-most-used',
        activationCount: 99,
        reinforcedSigilSvg: '<svg><path d="released" /></svg>',
        isReleased: true,
      }),
    ];

    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-primary-anchor-svg').props.xml).toContain('winner');
  });

  it('uses recency as the primary-anchor tie breaker', () => {
    mockAnchorState.anchors = [
      buildAnchor({
        id: 'older',
        activationCount: 4,
        reinforcedSigilSvg: '<svg><path d="older" /></svg>',
        lastActivatedAt: new Date('2026-06-01T12:00:00.000Z'),
      }),
      buildAnchor({
        id: 'newer',
        activationCount: 4,
        reinforcedSigilSvg: '<svg><path d="newer" /></svg>',
        lastActivatedAt: new Date('2026-06-08T12:00:00.000Z'),
      }),
    ];

    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-primary-anchor-svg').props.xml).toContain('newer');
  });

  it('renders recap stats from progression and anchor state', () => {
    render(<PaywallScreen />);

    expect(screen.getByTestId('paywall-recap')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Anchors forged')).toBeTruthy();
    expect(screen.getByText('Sessions primed')).toBeTruthy();
    expect(screen.getByText('Day streak')).toBeTruthy();
  });

  it('opens sign in from the paywall', () => {
    render(<PaywallScreen />);

    fireEvent.press(screen.getByLabelText('Already subscribed? Sign in'));

    expect(mockNavigate).toHaveBeenCalledWith('Settings', {
      screen: 'Login',
      params: {
        initialTab: 'signin',
        context: 'paywall',
      },
    });
  });
});
