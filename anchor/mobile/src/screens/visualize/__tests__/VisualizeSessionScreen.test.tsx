import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { VisualizeSessionScreen } from '../VisualizeSessionScreen';
import { useVisualizeSessionAudio } from '../useVisualizeSessionAudio';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

jest.mock('../useVisualizeSessionAudio');
jest.mock('@/stores/anchorStore');
jest.mock('@/stores/authStore');
jest.mock('@/stores/settingsStore');
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
}));

const mockFadeOutAndStop = jest.fn().mockResolvedValue(undefined);
const mockUseVisualizeSessionAudio = useVisualizeSessionAudio as jest.Mock;

describe('VisualizeSessionScreen audio integration', () => {
  const mockNavigation: any = {
    replace: jest.fn(),
    popToTop: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };

  const mockRoute: any = {
    params: {
      anchorId: 'anchor-123',
      durationSeconds: 180,
      sceneText: 'A quiet forest path in morning light',
      guidanceVoice: 'female',
      backgroundAudio: 'ambient',
      returnTo: 'practice',
      practiceMode: 'visualize',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnchorStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        getAnchorById: () => ({
          id: 'anchor-123',
          intentionText: 'Peace and clarity',
          baseSigilSvg: '<svg />',
        }),
      }),
    );
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        user: { id: 'user-123' },
      }),
    );
    const settingsState = {
      hapticIntensity: 1,
      debugLoggingEnabled: false,
    };
    (useSettingsStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      typeof selector === 'function' ? selector(settingsState) : settingsState,
    );
    (useSettingsStore as any).getState = jest.fn(() => settingsState);

    mockUseVisualizeSessionAudio.mockReturnValue({
      fadeOutAndStop: mockFadeOutAndStop,
      finishCompletion: jest.fn().mockResolvedValue(undefined),
      hasVoiceGuidance: true,
    });
  });

  it('wires up audio plan and manifest to useVisualizeSessionAudio', () => {
    render(<VisualizeSessionScreen navigation={mockNavigation} route={mockRoute} />);

    expect(mockUseVisualizeSessionAudio).toHaveBeenCalled();
    const lastCall = mockUseVisualizeSessionAudio.mock.calls[mockUseVisualizeSessionAudio.mock.calls.length - 1][0];

    expect(lastCall.plan).toBeDefined();
    expect(lastCall.plan.sessionType).toBe('visualize');
    expect(lastCall.plan.durationSeconds).toBe(180);
    expect(lastCall.plan.configuration.guidanceVoice).toBe('female');
    expect(lastCall.plan.configuration.backgroundAudio).toBe('ambient');
    expect(lastCall.manifest).toBeDefined();
    expect(lastCall.manifest.durationSeconds).toBe(180);
    expect(lastCall.isActive).toBe(true);
  });

  it('triggers fadeOutAndStop when ending session early', async () => {
    const { getAllByLabelText, getByText } = render(
      <VisualizeSessionScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Open confirmation modal
    fireEvent.press(getAllByLabelText('End session')[0]);

    // Modal renders canonical title and Exit button
    expect(getByText('Exit Visualize?')).toBeTruthy();
    expect(getByText('Keep Practicing')).toBeTruthy();

    // Press Exit confirm button
    await act(async () => {
      fireEvent.press(getByText('Exit'));
    });

    expect(mockFadeOutAndStop).toHaveBeenCalledTimes(1);
    expect(mockNavigation.popToTop).toHaveBeenCalledTimes(1);
  });

  it('keeps practicing when dismissing the exit confirmation modal', () => {
    const { getAllByLabelText, getByText, queryByText } = render(
      <VisualizeSessionScreen navigation={mockNavigation} route={mockRoute} />,
    );

    // Open confirmation modal
    fireEvent.press(getAllByLabelText('End session')[0]);
    expect(getByText('Exit Visualize?')).toBeTruthy();

    // Press Keep Practicing
    fireEvent.press(getByText('Keep Practicing'));

    expect(mockFadeOutAndStop).not.toHaveBeenCalled();
    expect(mockNavigation.popToTop).not.toHaveBeenCalled();
  });
});
