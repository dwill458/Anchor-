import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { V2PracticeAudioSheet } from '../V2PracticeAudioSheet';

jest.mock('@/services/VoicePreviewService', () => ({
  getActivePreviewVoice: () => null,
  startVoicePreview: jest.fn().mockResolvedValue(true),
  stopVoicePreview: jest.fn(),
  subscribeToVoicePreview: (l: (v: null) => void) => { l(null); return () => undefined; },
}));

const setup = (onApply = jest.fn(), onClose = jest.fn()) => {
  const view = render(
    <V2PracticeAudioSheet visible sessionType="focus" durationSeconds={30}
      value={{ guidanceVoice: 'female', backgroundAudio: 'ambient' }}
      accent="#8B5CF6" testIDPrefix="focus" onApply={onApply} onClose={onClose} />,
  );
  return { view, onApply, onClose };
};

describe('V2PracticeAudioSheet', () => {
  it('uses experience names and applies the draft only on Done', () => {
    const { view, onApply, onClose } = setup();
    expect(view.getByText('Grounded')).toBeTruthy();
    expect(view.getByText('Serene')).toBeTruthy();
    expect(view.getByText('No guidance')).toBeTruthy();
    expect(view.queryByText(/Male|Female/)).toBeNull();
    fireEvent.press(view.getByTestId('focus-voice-male'));
    fireEvent.press(view.getByTestId('focus-ambient-off'));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('focus-settings-done'));
    expect(onApply).toHaveBeenCalledWith({ guidanceVoice: 'male', backgroundAudio: 'off' }, false);
    expect(onClose).toHaveBeenCalled();
  });

  it('passes make-default only when ticked, and cancel applies nothing', () => {
    const first = setup();
    fireEvent.press(first.view.getByTestId('focus-make-default-toggle'));
    fireEvent.press(first.view.getByTestId('focus-settings-done'));
    expect(first.onApply).toHaveBeenCalledWith({ guidanceVoice: 'female', backgroundAudio: 'ambient' }, true);
    const second = setup();
    fireEvent.press(second.view.getByTestId('focus-voice-none'));
    fireEvent.press(second.view.getAllByLabelText('Dismiss sound settings')[0]);
    expect(second.onApply).not.toHaveBeenCalled();
    expect(second.onClose).toHaveBeenCalled();
  });
});
