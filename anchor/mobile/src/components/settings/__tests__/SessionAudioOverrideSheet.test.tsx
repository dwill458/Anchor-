import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SessionAudioOverrideSheet } from '../SessionAudioOverrideSheet';

jest.mock('@/services/VoicePreviewService', () => ({
  getActivePreviewVoice: jest.fn(() => null),
  startVoicePreview: jest.fn().mockResolvedValue(true),
  stopVoicePreview: jest.fn(),
  subscribeToVoicePreview: jest.fn((listener: (voice: null) => void) => {
    listener(null);
    return jest.fn();
  }),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

describe('SessionAudioOverrideSheet', () => {
  it('cancels without returning a temporary selection', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <SessionAudioOverrideSheet
        visible
        sessionType="focus"
        durationSeconds={30}
        initialValue={{ guidanceVoice: 'female', backgroundAudio: 'ambient' }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(screen.getByLabelText('No Voice. Visual and haptic guidance only'));
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('returns the confirmed override and explicit make-default choice', () => {
    const onConfirm = jest.fn();
    render(
      <SessionAudioOverrideSheet
        visible
        sessionType="deep_prime"
        durationSeconds={300}
        initialValue={{ guidanceVoice: 'female', backgroundAudio: 'ambient' }}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.press(screen.getByLabelText('No Voice. Visual and haptic guidance only'));
    fireEvent.press(screen.getByLabelText('Silence background'));
    fireEvent.press(screen.getByLabelText('Make this my new default'));
    fireEvent.press(screen.getByText('Apply'));
    expect(onConfirm).toHaveBeenCalledWith(
      { guidanceVoice: 'none', backgroundAudio: 'off' },
      true
    );
  });
});
