import React from 'react';
import { Alert, Keyboard } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { VisionRefineSheet } from '../VisionRefineSheet';

jest.mock('@/components/v2/primitives/V2SheetModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return { V2SheetModal: ({ visible, children, onClose, ...props }: any) => visible ? <View {...props}><Pressable testID="modal-back" onPress={onClose} />{children}</View> : null, V2SheetGrabZone: ({ children }: any) => <>{children}</> };
});
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/components/v2/chart/ChartKeyboardFrame', () => ({ ChartKeyboardFrame: ({ children, footer }: any) => <>{children}{footer}</> }));
jest.mock('../VisionSceneField', () => ({ VisionSceneField: ({ value, onChangeText, onFocus, maxChars, testID, accessibilityLabel }: any) => {
  const { TextInput } = require('react-native');
  return <TextInput testID={testID} accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChangeText} onFocus={onFocus} maxLength={maxChars} />;
} }));
jest.mock('../VisionReferenceStrip', () => ({ VisionReferenceStrip: ({ references, collapsed, compact, testID }: any) => {
  const { Text, View } = require('react-native');
  return <View testID={testID} accessibilityLabel={collapsed ? 'Collapsed reference strip' : compact ? 'Compact thumbnail strip' : 'Full reference strip'}><Text>{references.length} references</Text></View>;
} }), { virtual: true });
jest.mock('../VisionPaperChrome', () => ({ VisionInkPill: ({ label, onPress, onDisabledPress, disabled, testID }: any) => {
  const { Pressable, Text } = require('react-native');
  return <Pressable testID={testID} accessibilityState={{ disabled }} disabled={disabled && !onDisabledPress ? true : undefined} onPress={disabled ? onDisabledPress : onPress}><Text>{label}</Text></Pressable>;
}, VISION_SERIF: 'serif', VISION_GOLD: '#B08A4A' }));

const source = { candidateId: 'candidate-2', imageUrl: 'https://example.test/vision.jpg', optionNumber: 2, roundNumber: 0 };

function renderSheet(overrides: Partial<React.ComponentProps<typeof VisionRefineSheet>> = {}) {
  const props: React.ComponentProps<typeof VisionRefineSheet> = {
    visible: true,
    source,
    references: [],
    onChangeReferences: jest.fn(),
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    ...overrides,
  };
  return { ...render(<VisionRefineSheet {...props} />), props };
}

describe('VisionRefineSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('labels an original candidate and keeps the saved-image reassurance and prompt aids', () => {
    const view = renderSheet();
    expect(view.getByText('Editing Option 2')).toBeTruthy();
    expect(view.getByText('Your current image stays saved. You can always return to it.')).toBeTruthy();
    expect(view.getByText('Change lighting')).toBeTruthy();
    expect(view.getByText('Adjust composition')).toBeTruthy();
    expect(view.getByTestId('vision-refine-input')).toBeTruthy();
  });

  it('labels later candidates with their exact source version and option', () => {
    const view = renderSheet({ source: { ...source, roundNumber: 2, optionNumber: 1 } });
    expect(view.getByText('Based on Version 2 · Option 1')).toBeTruthy();
  });

  it('keeps the selected image context and collapses references when the keyboard opens', () => {
    const references = Array.from({ length: 4 }, (_, index) => ({
      id: `reference-${index + 1}`,
      uri: `file:///reference-${index + 1}.jpg`,
      mimeType: 'image/jpeg',
      role: 'inspiration' as const,
    }));
    const view = renderSheet({ references });
    fireEvent(view.getByTestId('vision-refine-input'), 'focus');
    expect(view.getByTestId('vision-refine-compact-source')).toBeTruthy();
    expect(view.getByText('What would you like to change?')).toBeTruthy();
    expect(view.getByText('Your current image is safe')).toBeTruthy();
    expect(view.getByTestId('vision-refine-keyboard-done')).toBeTruthy();
    expect(view.getByLabelText('Compact thumbnail strip')).toBeTruthy();
    expect(view.getByText('4 references')).toBeTruthy();
    expect(view.queryByText('Your current image stays saved. You can always return to it.')).toBeNull();
    expect(view.queryByText('Replace an object')).toBeNull();
  });

  it('requires a 6-character instruction, surfaces the hint, and still enforces the 2,000-character limit', () => {
    const view = renderSheet();
    const submit = view.getByTestId('vision-refine-submit');
    expect(submit.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'short');
    fireEvent.press(submit);
    expect(view.getByText('Describe the changes in 6–2000 characters.')).toBeTruthy();
    expect(view.props.onSubmit).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'Long enough');
    expect(view.getByTestId('vision-refine-submit').props.accessibilityState.disabled).toBe(false);
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'x'.repeat(2001));
    expect(view.getByTestId('vision-refine-input').props.maxLength).toBe(2000);
  });

  it('adds a quick change to the instruction without submitting', () => {
    const onChangePrompt = jest.fn();
    const view = renderSheet({ onChangePrompt });
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'Keep the scene as it is');
    fireEvent.press(view.getByLabelText('Add someone'));
    expect(view.getByTestId('vision-refine-input').props.value).toBe('Keep the scene as it is. Add someone');
    expect(onChangePrompt).toHaveBeenCalledWith('Keep the scene as it is. Add someone');
    expect(view.props.onSubmit).not.toHaveBeenCalled();
  });

  it('trims the instruction and ignores a second submit while the first is pending', async () => {
    let resolveSubmit!: (value: boolean) => void;
    const onSubmit = jest.fn(() => new Promise<boolean>(resolve => { resolveSubmit = resolve; }));
    const view = renderSheet({ onSubmit });
    fireEvent.changeText(view.getByTestId('vision-refine-input'), '  Make it sunset.  ');
    await act(async () => {
      fireEvent.press(view.getByTestId('vision-refine-submit'));
      fireEvent.press(view.getByTestId('vision-refine-submit'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Make it sunset.');
    await act(async () => resolveSubmit(true));
    expect(view.props.onClose).toHaveBeenCalledTimes(1);
  });

  it('asks before closing when the prompt has been edited', () => {
    const view = renderSheet();
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'Add a sunny afternoon');
    fireEvent.press(view.getByLabelText('Close refinement sheet'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Discard this instruction?',
      'Your current image stays saved. The instruction will be cleared.',
      expect.any(Array),
      expect.anything(),
    );
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    act(() => buttons[1].onPress());
    expect(view.props.onClose).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalled();
  });

  it('handles Android back by dismissing the keyboard before requesting sheet close', () => {
    const view = renderSheet();
    fireEvent.changeText(view.getByTestId('vision-refine-input'), 'Add a sunny afternoon');
    fireEvent(view.getByTestId('vision-refine-input'), 'focus');
    fireEvent.press(view.getByTestId('modal-back'));
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(view.props.onClose).not.toHaveBeenCalled();
  });
});
