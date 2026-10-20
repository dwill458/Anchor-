import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/utils/v2DevSeeder', () => ({ seedV2DemoAnchor: jest.fn(), DEMO_ANCHOR_ID: 'demo-anchor' }));
jest.mock('@/stores/anchorStore', () => ({
  useAnchorStore: (selector: (s: unknown) => unknown) => selector({ anchors: [{ id: 'anchor-dev-1', intentionText: 'I am steady' }] }),
}));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ setHasCompletedOnboarding: jest.fn() }) } }));
jest.mock('@/stores/settingsStore', () => ({ useSettingsStore: { getState: () => ({ setDeveloperSkipOnboardingEnabled: jest.fn() }) } }));
jest.mock('@/components/v2/chart/chartIntroSeen', () => ({ resetChartIntroSeen: jest.fn(async () => undefined) }));

import { V2DevFloatingToolbar } from '../V2DevFloatingToolbar';
import { useMilestoneCelebrationStore } from '@/stores/v2/milestoneCelebrationStore';
import { MILESTONE_SPECS } from '@/milestones/registry';

describe('V2DevFloatingToolbar milestone trigger', () => {
  const devGlobal = globalThis as unknown as { __DEV__: boolean };
  const originalDev = devGlobal.__DEV__;

  beforeEach(() => {
    jest.useFakeTimers();
    devGlobal.__DEV__ = true;
    useMilestoneCelebrationStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
    devGlobal.__DEV__ = originalDev;
  });

  const open = () => {
    render(<V2DevFloatingToolbar />);
    fireEvent.press(screen.getByTestId('v2-dev-pill'));
  };

  it('offers every milestone', () => {
    open();
    for (const spec of MILESTONE_SPECS) expect(screen.getByTestId(`v2-dev-milestone-${spec.id}`)).toBeTruthy();
  });

  it('plays the chosen celebration as a non-awarding replay, after the dialog has closed', () => {
    open();
    fireEvent.press(screen.getByTestId('v2-dev-milestone-strength.reinforced'));
    // Not queued while the dialog could still be on screen.
    expect(useMilestoneCelebrationStore.getState().queue).toEqual([]);
    act(() => {
      jest.advanceTimersByTime(450);
    });
    const queue = useMilestoneCelebrationStore.getState().queue;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ mode: 'replay', accountId: null });
    expect(queue[0].record).toMatchObject({
      definitionId: 'strength.reinforced',
      anchorId: 'anchor-dev-1',
      sourceKind: 'DEV_TRIGGER',
      metadata: { threshold: 90, strength: 90 },
    });
  });

  it('is absent outside development', () => {
    devGlobal.__DEV__ = false;
    render(<V2DevFloatingToolbar />);
    expect(screen.queryByTestId('v2-dev-pill')).toBeNull();
  });
});
