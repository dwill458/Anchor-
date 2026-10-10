import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { V2VisionNoteComposer } from '../V2VisionNoteComposer';
import { useSettingsStore } from '@/stores/settingsStore';
import { VISION_NOTE_PRESETS } from '@/components/v2/vision/notes/visionNoteStyles';

const goBack = jest.fn();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
const renderScreen = (platform: 'ios' | 'android' = 'ios') => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  return render(<V2VisionNoteComposer route={{ params: { anchorId: 'a1', visionId: 'v1' } }} navigation={{ goBack }} />);
};

describe('V2VisionNoteComposer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalPlatformDescriptor) Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    goBack.mockClear(); useSettingsStore.setState({ reduceMotion: 'system' });
  });

  it('shows a live preview and keeps Add to Vision honestly unavailable', () => {
    const view = renderScreen();
    expect(view.getByText('Add a Note')).toBeTruthy();
    const input = view.getByTestId('vision-note-input');
    fireEvent.changeText(input, 'A little note for my future self.');
    expect(view.getByTestId('vision-note-preview').props.accessibilityLabel).toContain('A little note');
    const add = view.getByLabelText('Add to Vision');
    expect(add.props.accessibilityState.disabled).toBe(true);
    expect(view.getByText('Preview only. Saving notes will be available in a future update.')).toBeTruthy();
    fireEvent.press(add);
    expect(goBack).not.toHaveBeenCalled();
  });

  it('limits the draft to 200 characters and switches preset families', () => {
    const view = renderScreen();
    const input = view.getByTestId('vision-note-input');
    expect(input.props.maxLength).toBe(400);
    fireEvent.press(view.getByLabelText('Paper styles'));
    expect(view.getByTestId('vision-note-style-grid').props.accessibilityLabel).toContain('paper');
    expect(view.getByLabelText('Ivory Torn note style').props.accessibilityState.selected).toBe(true);
    fireEvent.press(view.getByLabelText('Editorial styles'));
    expect(view.getByTestId('vision-note-style-grid').props.accessibilityLabel).toContain('editorial');
    expect(view.getByLabelText('Classic Cream note style').props.accessibilityState.selected).toBe(true);
  });

  it('keeps the same draft while all 20 material styles can be selected', () => {
    const view = renderScreen();
    const input = view.getByTestId('vision-note-input');
    fireEvent.changeText(input, 'Words I want to keep.');
    for (const family of ['sticky', 'paper', 'editorial'] as const) {
      fireEvent.press(view.getByLabelText(`${family === 'sticky' ? 'Sticky Notes' : family[0].toUpperCase() + family.slice(1)} styles`));
      for (const preset of VISION_NOTE_PRESETS.filter(item => item.family === family)) {
        const choice = view.getByLabelText(`${preset.label} note style`);
        fireEvent.press(choice);
        expect(view.getByLabelText(`${preset.label} note style`).props.accessibilityState.selected).toBe(true);
        expect(view.getByTestId('vision-note-current-renderer').props.accessibilityLabel).toBe('Words I want to keep.');
      }
    }
    expect(view.getByTestId('vision-note-input').props.value).toBe('Words I want to keep.');
  });

  it('skips the prior-material crossfade when reduced motion is enabled', () => {
    useSettingsStore.setState({ reduceMotion: 'on' });
    const view = renderScreen();
    fireEvent.press(view.getByLabelText('Paper styles'));
    expect(view.queryByTestId('vision-note-previous-material')).toBeNull();
  });

  it('preserves whitespace, caps paste at 200 code points and does not split emoji', () => {
    const view = renderScreen();
    const input = view.getByTestId('vision-note-input');
    fireEvent.changeText(input, '  \n ');
    expect(view.getByTestId('vision-note-input').props.value).toBe('  \n ');
    fireEvent.changeText(input, 'x'.repeat(205));
    expect(view.getByTestId('vision-note-input').props.value).toBe('x'.repeat(200));
    expect(view.getByText('200 / 200')).toBeTruthy();
    fireEvent.changeText(input, '🙂'.repeat(205));
    expect(view.getByTestId('vision-note-input').props.value).toBe('🙂'.repeat(200));
    expect(view.getByText('200 / 200')).toBeTruthy();
  });

  it.each([
    ['ios', 'padding'],
    ['android', 'height'],
  ] as const)('uses keyboard avoidance on %s', (platform, behavior) => {
    const view = renderScreen(platform);
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(behavior);
  });

  it('returns only through navigation goBack', () => {
    const view = renderScreen();
    fireEvent.press(view.getByLabelText('Go back'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
