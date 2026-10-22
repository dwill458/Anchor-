import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusPrepScreen } from '../focus/V2FocusPrepScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

jest.mock('@/utils/haptics', () => ({
  safeHaptics: {
    notification: jest.fn(),
    impact: jest.fn(),
    selection: jest.fn(),
  },
}));

const mockAnchor = makeAnchor({
  id: 'anchor-focus-test',
  intentionText: 'Stay centered and present',
  category: 'career',
});
describe('V2FocusPrepScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSubscriptionStore.setState({
      rcTier: 'pro',
      hasActiveEntitlement: true,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
    });
    useSettingsStore.setState({
      focusSessionDuration: 30,
      sessionAudioDefaults: {
        focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
        deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
        visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      },
    });
  });

  it('renders prominently with FOCUS eyebrow, active Anchor intention and artwork', () => {
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    expect(screen.getByText('FOCUS')).toBeTruthy();
    expect(screen.getByText('Stay centered and present')).toBeTruthy();
    expect(screen.getByText('Career')).toBeTruthy();
    expect(screen.getByLabelText('Career Anchor artwork')).toBeTruthy();
  });

  it('supports duration switching between 10s, 30s, and 60s (1 min)', () => {
    const onBeginFocus = jest.fn();
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={onBeginFocus}
      />
    );

    // Initial default is 30 SEC
    expect(screen.getByLabelText('30 sec, selected')).toBeTruthy();

    // Select 10 SEC
    fireEvent.press(screen.getByLabelText('10 sec'));
    expect(screen.getByLabelText('10 sec, selected')).toBeTruthy();

    // Select 1 MIN
    fireEvent.press(screen.getByLabelText('1 min'));
    expect(screen.getByLabelText('1 min, selected')).toBeTruthy();

    // Tap Begin Focus with selected 60s
    fireEvent.press(screen.getByTestId('v2-begin-focus'));
    expect(onBeginFocus).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 60 })
    );
  });

  it('provides interactive Sound toggle controlling voice and ambient audio', () => {
    const onBeginFocus = jest.fn();
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={onBeginFocus}
      />
    );

    // Sound toggle is on initially
    const soundToggle = screen.getByTestId('focus-sound-toggle');
    expect(soundToggle.props.accessibilityState.checked).toBe(true);

    // Toggle sound off
    fireEvent.press(soundToggle);
    expect(soundToggle.props.accessibilityState.checked).toBe(false);

    // Tap Begin Focus: passes voice: 'none' and ambient: false
    fireEvent.press(screen.getByTestId('v2-begin-focus'));
    expect(onBeginFocus).toHaveBeenCalledWith(
      expect.objectContaining({
        voice: 'none',
        ambient: false,
      })
    );
  });

  it('provides interactive Haptics toggle controlling device vibration cues', () => {
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    const hapticsToggle = screen.getByTestId('focus-haptics-toggle');
    expect(hapticsToggle.props.accessibilityState.checked).toBe(true);

    // Toggle haptics off
    fireEvent.press(hapticsToggle);
    expect(hapticsToggle.props.accessibilityState.checked).toBe(false);

    // Toggle back on
    fireEvent.press(hapticsToggle);
    expect(hapticsToggle.props.accessibilityState.checked).toBe(true);
  });

  it('gates unentitled users at "Begin Focus" and preserves user selections', () => {
    useSubscriptionStore.setState({
      rcTier: 'free',
      hasActiveEntitlement: false,
      remoteCompedAccess: false,
      devOverrideEnabled: false,
    });

    const onPremiumRequired = jest.fn();
    const onBeginFocus = jest.fn();

    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="recommended_today"
        onBack={jest.fn()}
        onBeginFocus={onBeginFocus}
        onPremiumRequired={onPremiumRequired}
      />
    );

    // Switch duration to 10s
    fireEvent.press(screen.getByLabelText('10 sec'));

    fireEvent.press(screen.getByTestId('v2-begin-focus'));

    // Does NOT begin focus immediately
    expect(onBeginFocus).not.toHaveBeenCalled();

    // Dispatches premium required with preserved selections
    expect(onPremiumRequired).toHaveBeenCalledWith({
      anchorId: mockAnchor.id,
      durationSeconds: 10,
      voice: 'female',
      ambient: true,
      source: 'recommended_today',
    });
  });

  it('back button calls onBack to return to originating screen', () => {
    const onBack = jest.fn();
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={onBack}
        onBeginFocus={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId('focus-prep-back-button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
