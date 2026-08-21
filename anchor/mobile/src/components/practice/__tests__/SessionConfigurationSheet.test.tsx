import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  DEEP_PRIME_MODE,
  FOCUS_SESSION_MODE,
  SessionConfigurationSheet,
  VISUALIZE_MODE,
  type SessionDraft,
} from '../SessionConfigurationSheet';

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

const focusConfig: SessionDraft = {
  durationSeconds: 30,
  guidanceVoice: 'female',
  backgroundAudio: 'ambient',
  makeDefault: false,
};

describe('SessionConfigurationSheet', () => {
  it('closes without returning a temporary selection', () => {
    const onClose = jest.fn();
    const onApply = jest.fn();
    render(
      <SessionConfigurationSheet
        visible
        mode={FOCUS_SESSION_MODE}
        config={focusConfig}
        onApply={onApply}
        onClose={onClose}
      />
    );

    fireEvent.press(screen.getByLabelText(`No Voice. ${FOCUS_SESSION_MODE.guidance[2].sub}`));
    fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the draft including the explicit make-default choice', () => {
    const onApply = jest.fn();
    render(
      <SessionConfigurationSheet
        visible
        mode={DEEP_PRIME_MODE}
        config={{
          durationSeconds: 300,
          guidanceVoice: 'female',
          backgroundAudio: 'ambient',
          makeDefault: false,
        }}
        onApply={onApply}
        onClose={jest.fn()}
      />
    );

    fireEvent.press(screen.getByLabelText(`No Voice. ${DEEP_PRIME_MODE.guidance[2].sub}`));
    fireEvent.press(screen.getByLabelText('Silence background'));
    fireEvent.press(screen.getByLabelText('Make this my new default'));
    fireEvent.press(screen.getByText(/Apply to This Session/i));

    expect(onApply).toHaveBeenCalledWith({
      durationSeconds: 300,
      guidanceVoice: 'none',
      backgroundAudio: 'off',
      makeDefault: true,
    });
  });

  it('shows the make-default helper only once the checkbox is checked', () => {
    render(
      <SessionConfigurationSheet
        visible
        mode={VISUALIZE_MODE}
        config={{
          durationSeconds: 180,
          guidanceVoice: 'female',
          backgroundAudio: 'ambient',
          makeDefault: false,
        }}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText(VISUALIZE_MODE.makeDefaultHelper)).toBeNull();
    fireEvent.press(screen.getByLabelText('Make this my new default'));
    expect(screen.getByText(VISUALIZE_MODE.makeDefaultHelper)).toBeTruthy();
  });

  it('updates the live recap line as selections change', () => {
    render(
      <SessionConfigurationSheet
        visible
        mode={FOCUS_SESSION_MODE}
        config={focusConfig}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('30 sec · Female Voice · Ambient')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('1 MIN duration'));
    fireEvent.press(screen.getByLabelText('Silence background'));
    expect(screen.getByText('1 min · Female Voice · Silence')).toBeTruthy();
  });
});
