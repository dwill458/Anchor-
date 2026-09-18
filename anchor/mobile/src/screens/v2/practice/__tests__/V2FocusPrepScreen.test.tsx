import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { V2FocusPrepScreen } from '../focus/V2FocusPrepScreen';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';

const mockAnchor = makeAnchor({
  id: 'anchor-focus-test',
  intentionText: 'Stay centered and present',
  category: 'career',
});

describe('V2FocusPrepScreen', () => {
  beforeEach(() => {
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

  it('renders prominently with correct active Anchor intention and artwork', () => {
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    expect(screen.getByText('Focus')).toBeTruthy();
    expect(screen.getByText('YOUR ANCHOR')).toBeTruthy();
    expect(screen.getByText('“Stay centered and present”')).toBeTruthy();
    expect(screen.getByText('Return to your Anchor for a few seconds.')).toBeTruthy();
    expect(screen.getByLabelText('career Anchor artwork')).toBeTruthy();
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
    expect(screen.getByLabelText('30 SEC, selected')).toBeTruthy();

    // Select 10 SEC
    fireEvent.press(screen.getByLabelText('10 SEC'));
    expect(screen.getByLabelText('10 SEC, selected')).toBeTruthy();

    // Select 1 MIN
    fireEvent.press(screen.getByLabelText('1 MIN'));
    expect(screen.getByLabelText('1 MIN, selected')).toBeTruthy();

    // Tap Begin Focus with selected 60s
    fireEvent.press(screen.getByTestId('v2-begin-focus'));
    expect(onBeginFocus).toHaveBeenCalledWith(
      expect.objectContaining({ durationSeconds: 60 })
    );
  });

  it('shows audio summary and opens the Focus Settings Sheet on tap', () => {
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    expect(screen.getByText('Female Voice · Ambient')).toBeTruthy();
    fireEvent.press(screen.getByText('Female Voice · Ambient'));

    expect(screen.getByTestId('v2-focus-settings-sheet')).toBeTruthy();
    expect(screen.getByText('Guidance')).toBeTruthy();
    expect(screen.getByText('Background')).toBeTruthy();
  });

  it('updates audio configuration in settings sheet and reflects on prep screen', () => {
    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText('Female Voice · Ambient'));

    // Switch to Male Voice and Silence
    fireEvent.press(screen.getByTestId('focus-voice-male'));
    fireEvent.press(screen.getByTestId('focus-ambient-off'));
    fireEvent.press(screen.getByTestId('focus-settings-done'));

    expect(screen.getByText('Male Voice · Silence')).toBeTruthy();
  });

  it('persists default audio preferences only when "Also make this my default" is checked', () => {
    const setSessionAudioDefaultsSpy = jest.spyOn(
      useSettingsStore.getState(),
      'setSessionAudioDefaults'
    );

    render(
      <V2FocusPrepScreen
        anchor={mockAnchor}
        source="practice_hub"
        onBack={jest.fn()}
        onBeginFocus={jest.fn()}
      />
    );

    fireEvent.press(screen.getByText('Female Voice · Ambient'));
    fireEvent.press(screen.getByTestId('focus-voice-none'));

    // Done without checking make default: spy not called
    fireEvent.press(screen.getByTestId('focus-settings-done'));
    expect(setSessionAudioDefaultsSpy).not.toHaveBeenCalled();

    // Re-open and check make default
    fireEvent.press(screen.getByText('No Voice · Ambient'));
    fireEvent.press(screen.getByTestId('focus-make-default-toggle'));
    fireEvent.press(screen.getByTestId('focus-settings-done'));

    expect(setSessionAudioDefaultsSpy).toHaveBeenCalledWith(
      'focus',
      { guidanceVoice: 'none', backgroundAudio: 'ambient' },
      undefined
    );

    setSessionAudioDefaultsSpy.mockRestore();
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

    // Switch duration to 10s and voice to male
    fireEvent.press(screen.getByLabelText('10 SEC'));

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

    fireEvent.press(screen.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
