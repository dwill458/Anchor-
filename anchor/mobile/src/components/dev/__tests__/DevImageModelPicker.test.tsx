import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { DevImageModelPicker } from '../DevImageModelPicker';
import { DEV_IMAGE_MODELS, selectedDevImageModel, useDevImageModelStore } from '@/stores/devImageModelStore';

describe('developer image model picker', () => {
  const originalDev = __DEV__;
  beforeEach(() => { global.__DEV__ = true; useDevImageModelStore.setState({ anchor: null, vision: null }); });
  afterEach(() => { global.__DEV__ = originalDev; useDevImageModelStore.setState({ anchor: null, vision: null }); });

  it.each(DEV_IMAGE_MODELS)('selects $label for Anchor without changing Vision', option => {
    const screen = render(<DevImageModelPicker purpose="anchor" />);
    fireEvent.press(screen.getByLabelText('Dev model: Auto'));
    fireEvent.press(screen.getByLabelText(option.label));
    expect(selectedDevImageModel('anchor')).toBe(option.id);
    expect(selectedDevImageModel('vision')).toBeUndefined();
    expect(screen.getByLabelText(`Dev model: ${option.label}`)).toBeTruthy();
  });

  it('dismisses the keyboard before opening the selector', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const screen = render(<DevImageModelPicker purpose="vision" tone="paper" />);
    fireEvent.press(screen.getByTestId('dev-image-model-vision'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Compare image models')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('dev-image-model-vision').props.style).backgroundColor).toBe('transparent');
    dismiss.mockRestore();
  });

  it('keeps the compact paper control small while exposing the selected model accessibly', () => {
    const screen = render(<DevImageModelPicker purpose="vision" tone="paper" compact />);
    const trigger = screen.getByLabelText('Dev model: Auto');
    const style = StyleSheet.flatten(trigger.props.style);
    expect(style.width).toBe(44);
    expect(style.height).toBe(44);
    fireEvent.press(trigger);
    expect(screen.getByText('Compare image models')).toBeTruthy();
  });

  it('returns to Auto and never exposes or sends a saved selection in production', () => {
    useDevImageModelStore.getState().select('vision', 'gemini-nano-banana-2.1');
    const screen = render(<DevImageModelPicker purpose="vision" />);
    fireEvent.press(screen.getByLabelText('Dev model: Nano Banana 2.1'));
    fireEvent.press(screen.getByLabelText('Auto — normal routing'));
    expect(selectedDevImageModel('vision')).toBeUndefined();
    useDevImageModelStore.getState().select('vision', 'gpt-image-2.5-flare');
    global.__DEV__ = false;
    screen.rerender(<DevImageModelPicker purpose="vision" />);
    expect(screen.queryByTestId('dev-image-model-vision')).toBeNull();
    expect(selectedDevImageModel('vision')).toBeUndefined();
  });
});
