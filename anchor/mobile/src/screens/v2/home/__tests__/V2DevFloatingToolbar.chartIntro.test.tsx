import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, reset: jest.fn() }),
}));
jest.mock('@/utils/v2DevSeeder', () => ({ seedV2DemoAnchor: jest.fn(), DEMO_ANCHOR_ID: 'demo-anchor' }));
jest.mock('@/stores/anchorStore', () => ({ useAnchorStore: (selector: (s: unknown) => unknown) => selector({ anchors: [] }) }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ setHasCompletedOnboarding: jest.fn() }) } }));
jest.mock('@/stores/settingsStore', () => ({ useSettingsStore: { getState: () => ({ setDeveloperSkipOnboardingEnabled: jest.fn() }) } }));
jest.mock('@/components/v2/chart/chartIntroSeen', () => ({ resetChartIntroSeen: jest.fn(async () => undefined) }));

import { resetChartIntroSeen } from '@/components/v2/chart/chartIntroSeen';
import { V2DevFloatingToolbar } from '../V2DevFloatingToolbar';

const reset = resetChartIntroSeen as unknown as jest.Mock;

function openToolbar() {
  render(<V2DevFloatingToolbar />);
  fireEvent.press(screen.getByTestId('v2-dev-pill'));
}

describe('V2DevFloatingToolbar chart opening entries', () => {
  const devGlobal = globalThis as unknown as { __DEV__: boolean };
  const originalDev = devGlobal.__DEV__;

  beforeEach(() => {
    mockNavigate.mockClear();
    reset.mockClear();
    devGlobal.__DEV__ = true;
  });

  afterEach(() => {
    devGlobal.__DEV__ = originalDev;
  });

  it('offers full replay, short replay, and reset in development', () => {
    openToolbar();
    expect(screen.getByText('Replay opening (full)')).toBeTruthy();
    expect(screen.getByText('Replay opening (short)')).toBeTruthy();
    expect(screen.getByText('Reset intro seen')).toBeTruthy();
  });

  it('full replay clears the seen flag and opens Chart with a one-shot full replay', async () => {
    openToolbar();
    fireEvent.press(screen.getByText('Replay opening (full)'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'demo-anchor', introReplayMode: 'full' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('short replay clears the seen flag and opens Chart with a one-shot short replay', async () => {
    openToolbar();
    fireEvent.press(screen.getByText('Replay opening (short)'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('V2Chart', { anchorId: 'demo-anchor', introReplayMode: 'short' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('reset only clears the seen flag and does not navigate', async () => {
    openToolbar();
    fireEvent.press(screen.getByText('Reset intro seen'));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders neither the pill nor any chart opening entry when __DEV__ is false', () => {
    devGlobal.__DEV__ = false;
    render(<V2DevFloatingToolbar />);
    expect(screen.queryByTestId('v2-dev-pill')).toBeNull();
    expect(screen.queryByText('Replay opening (full)')).toBeNull();
    expect(screen.queryByText('Replay opening (short)')).toBeNull();
    expect(screen.queryByText('Reset intro seen')).toBeNull();
  });
});
