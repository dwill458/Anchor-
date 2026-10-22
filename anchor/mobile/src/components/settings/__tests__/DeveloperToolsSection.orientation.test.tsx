import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeveloperToolsSection } from '../DeveloperToolsSection';
import * as devOrientation from '@/utils/devOrientation';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: any) =>
    selector({
      anchors: [],
      currentAnchorId: null,
      setCurrentAnchor: jest.fn(),
      updateAnchor: jest.fn(),
    }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      hasCompletedOnboarding: true,
      setHasCompletedOnboarding: jest.fn(),
      user: { id: 'test-user' },
    }),
}));

jest.mock('@/stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (selector: any) =>
      selector({
        developerModeEnabled: true,
        setDeveloperModeEnabled: jest.fn(),
        developerMasterAccountEnabled: false,
        setDeveloperMasterAccountEnabled: jest.fn(),
        developerSkipOnboardingEnabled: false,
        setDeveloperSkipOnboardingEnabled: jest.fn(),
        developerForceStreakBreakEnabled: false,
        setDeveloperForceStreakBreakEnabled: jest.fn(),
        developerDeleteWithoutBurnEnabled: false,
        setDeveloperDeleteWithoutBurnEnabled: jest.fn(),
        devPerfTierOverride: 'auto',
        setDevPerfTierOverride: jest.fn(),
        triggerDeveloperWeeklySummaryPreview: jest.fn(),
      }),
    {
      getState: () => ({
        setDevPerfTierOverride: jest.fn(),
      }),
    }
  ),
}));

jest.mock('@/stores/subscriptionStore', () => ({
  useSubscriptionStore: () => ({
    tier: 'pro',
    devOverrideEnabled: false,
    setDevTierOverride: jest.fn(),
    resetOverrides: jest.fn(),
  }),
}));

jest.mock('@/hooks/usePerformanceTier', () => ({
  useDetectedPerformanceTier: () => 'high',
  usePerformanceTier: () => 'high',
}));

jest.mock('@/utils/devOrientation', () => {
  const actual = jest.requireActual('@/utils/devOrientation');
  return {
    ...actual,
    setDevOrientation: jest.fn().mockResolvedValue({ ok: true }),
  };
});

describe('DeveloperToolsSection - Orientation controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  it('renders orientation section and allows switching to landscape', async () => {
    render(<DeveloperToolsSection />);

    // Expand developer tools
    const devToolsHeader = screen.getByLabelText(/Developer Tools, expand/i);
    fireEvent.press(devToolsHeader);

    // Expand Orientation & Layout section
    const orientationHeader = screen.getByLabelText(/Orientation & Layout \(Dev Only\) section/i);
    fireEvent.press(orientationHeader);

    // Find Landscape button and press it
    const landscapeButton = screen.getByLabelText('Set orientation to Landscape');
    fireEvent.press(landscapeButton);

    expect(devOrientation.setDevOrientation).toHaveBeenCalledWith('landscape');
  });

  it('allows switching to Auto (Sensor)', async () => {
    render(<DeveloperToolsSection />);

    const devToolsHeader = screen.getByLabelText(/Developer Tools, expand/i);
    fireEvent.press(devToolsHeader);

    const orientationHeader = screen.getByLabelText(/Orientation & Layout \(Dev Only\) section/i);
    fireEvent.press(orientationHeader);

    const autoButton = screen.getByLabelText('Set orientation to Auto (Sensor)');
    fireEvent.press(autoButton);

    expect(devOrientation.setDevOrientation).toHaveBeenCalledWith('sensor');
  });

  it('renders nothing when not in __DEV__', () => {
    (global as any).__DEV__ = false;
    const { toJSON } = render(<DeveloperToolsSection />);
    expect(toJSON()).toBeNull();
  });
});
