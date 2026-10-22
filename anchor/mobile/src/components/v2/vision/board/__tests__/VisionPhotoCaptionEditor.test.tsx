import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VisionPhotoCaptionEditor } from '../VisionPhotoCaptionEditor';

jest.mock('@/components/v2/primitives/V2SheetModal', () => ({
  V2SheetModal: ({ visible, children }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return visible ? React.createElement(View, null, children) : null;
  },
  V2SheetGrabZone: ({ children }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, null, children);
  },
  V2_SHEET_SKIRT: 48,
}));

it('saves trimmed scene caption text and closes after persistence succeeds', async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  const onClose = jest.fn();
  const view = render(<VisionPhotoCaptionEditor visible caption="Initial line" onSave={onSave} onClose={onClose} />);

  fireEvent.changeText(view.getByTestId('vision-photo-caption-editor-input'), '  A quiet new scene  ');
  await act(async () => { fireEvent.press(view.getByTestId('vision-photo-caption-editor-save')); });

  expect(onSave).toHaveBeenCalledWith('A quiet new scene');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps the editor open when persistence fails and allows a blank optional caption', async () => {
  const onSave = jest.fn().mockResolvedValue(false);
  const onClose = jest.fn();
  const view = render(<VisionPhotoCaptionEditor visible caption="Remove me" onSave={onSave} onClose={onClose} />);

  fireEvent.changeText(view.getByTestId('vision-photo-caption-editor-input'), '   ');
  await act(async () => { fireEvent.press(view.getByTestId('vision-photo-caption-editor-save')); });

  expect(onSave).toHaveBeenCalledWith(null);
  expect(onClose).not.toHaveBeenCalled();
  expect(view.getByText('Could not save this caption. Try again.')).toBeTruthy();
});

it('enforces the caption limit and disables controls while the save is pending', () => {
  const view = render(<VisionPhotoCaptionEditor visible caption="A caption" saving onSave={jest.fn()} onClose={jest.fn()} />);

  expect(view.getByTestId('vision-photo-caption-editor-input').props.maxLength).toBe(80);
  expect(view.getByTestId('vision-photo-caption-editor-save').props.accessibilityState.disabled).toBe(true);
  expect(view.getByTestId('vision-photo-caption-editor-cancel').props.accessibilityState.disabled).toBe(true);
});

it('lifts the sheet when keyboard appears and restores padding when dismissed', () => {
  const { Keyboard } = require('react-native');
  let showHandler: any;
  let hideHandler: any;
  jest.spyOn(Keyboard, 'addListener').mockImplementation((...args: unknown[]) => {
    const [event, handler] = args;
    if (typeof event !== 'string') return { remove: jest.fn() };
    if (event.includes('Show')) showHandler = handler;
    if (event.includes('Hide')) hideHandler = handler;
    return { remove: jest.fn() } as any;
  });

  const view = render(<VisionPhotoCaptionEditor visible onSave={jest.fn()} onClose={jest.fn()} testID="test-editor" />);
  const surface = view.getByTestId('test-editor-surface');

  // Baseline padding at rest (16px spacing + 48px skirt = 64px)
  expect(surface.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingBottom: 64 })]));

  // Simulate keyboard appearing (e.g. 300px keyboard on Android/iOS)
  act(() => {
    showHandler?.({ endCoordinates: { height: 300 } });
  });

  // Elevated padding to lift above keyboard (300 + 16 + 48 = 364px)
  expect(surface.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingBottom: 364 })]));

  // Simulate keyboard dismissing
  act(() => {
    hideHandler?.();
  });

  // Restored padding at rest
  expect(surface.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingBottom: 64 })]));
});

it('dismisses keyboard when canceling', () => {
  const { Keyboard } = require('react-native');
  const dismissSpy = jest.spyOn(Keyboard, 'dismiss');
  const onClose = jest.fn();
  const view = render(<VisionPhotoCaptionEditor visible onSave={jest.fn()} onClose={onClose} />);

  fireEvent.press(view.getByTestId('vision-photo-caption-editor-cancel'));

  expect(dismissSpy).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
