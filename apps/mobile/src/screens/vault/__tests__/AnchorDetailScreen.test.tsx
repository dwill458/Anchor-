import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnchorDetailScreen } from '../AnchorDetailScreen';
import { createMockAnchor } from '@/__tests__/utils/testUtils';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';

const mockNavigate = jest.fn();
const mockUseRoute = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => mockUseRoute(),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: jest.fn(),
}));

jest.mock('@/services/AnalyticsService');
jest.mock('@/services/ErrorTrackingService');

const { useAnchorStore } = require('@/stores/anchorStore');

describe('AnchorDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseRoute.mockReturnValue({
      params: {
        anchorId: 'anchor-123',
      },
    });
  });

  it('renders error state when anchor is missing', () => {
    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => undefined),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    expect(getByText('Anchor not found')).toBeTruthy();
    expect(ErrorTrackingService.captureException).toHaveBeenCalled();
  });

  it('renders intention text and category badge', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      intentionText: 'Stay calm',
      category: 'health',
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    expect(getByText('"Stay calm"')).toBeTruthy();
    expect(getByText('Health')).toBeTruthy();
  });

  it('shows Charge Anchor for uncharged anchors and navigates to ChargeSetup', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      isCharged: false,
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    fireEvent.press(getByText('Charge Anchor'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.CHARGE_STARTED,
      expect.objectContaining({
        anchor_id: 'anchor-123',
        charge_type: 'initial_quick',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('ChargeSetup', { anchorId: 'anchor-123' });
  });

  it('renders charged actions and badge when anchor is charged', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      isCharged: true,
      chargedAt: new Date('2024-02-01'),
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    expect(getByText('Charged')).toBeTruthy();
    expect(getByText('Activate Anchor')).toBeTruthy();
    expect(getByText('Charge Again')).toBeTruthy();
    expect(getByText(/Burn & Release/)).toBeTruthy();
  });

  it('navigates to ActivationRitual when activating a charged anchor', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      isCharged: true,
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    fireEvent.press(getByText('Activate Anchor'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.ACTIVATION_STARTED,
      expect.objectContaining({ anchor_id: 'anchor-123' })
    );

    expect(mockNavigate).toHaveBeenCalledWith('ActivationRitual', {
      anchorId: 'anchor-123',
      activationType: 'visual',
    });
  });

  it('tracks recharge type when charging again', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      isCharged: true,
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    fireEvent.press(getByText('Charge Again'));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.CHARGE_STARTED,
      expect.objectContaining({
        anchor_id: 'anchor-123',
        charge_type: 'recharge',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('ChargeSetup', { anchorId: 'anchor-123' });
  });

  it('navigates to burn flow with correct params', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      isCharged: true,
      intentionText: 'Let go',
      baseSigilSvg: '<svg>sigil</svg>',
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    fireEvent.press(getByText(/Burn & Release/));

    expect(AnalyticsService.track).toHaveBeenCalledWith(
      AnalyticsEvents.BURN_INITIATED,
      expect.objectContaining({ anchor_id: 'anchor-123' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('ConfirmBurn', {
      anchorId: 'anchor-123',
      intention: 'Let go',
      sigilSvg: '<svg>sigil</svg>',
    });
  });

  it('renders activation stats when available', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      activationCount: 4,
      lastActivatedAt: new Date('2024-03-01'),
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);

    expect(getByText('4')).toBeTruthy();
    expect(getByText('Last Activated')).toBeTruthy();
  });

  it('renders a placeholder symbol when no sigil svg exists', () => {
    const anchor = createMockAnchor({
      id: 'anchor-123',
      baseSigilSvg: '',
    });

    useAnchorStore.mockReturnValue({
      getAnchorById: jest.fn(() => anchor),
    });

    const { getByText } = render(<AnchorDetailScreen />);
    const placeholderSymbol = String.fromCharCode(9672);

    expect(getByText(placeholderSymbol)).toBeTruthy();
  });
});
