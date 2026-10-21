import React from 'react';
import { Alert, Dimensions, Keyboard, StyleSheet } from 'react-native';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { VisionRefineSheet } from '../VisionRefineSheet';
import { V2_SHEET_SKIRT } from '@/components/v2/primitives/V2SheetModal';

const mockFieldLifecycle = jest.fn();
const mockKeyboardListeners = new Map<string, (event: any) => void>();

jest.mock('@/components/v2/primitives/V2SheetModal', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  return { V2SheetModal: ({ visible, children, onClose, ...props }: any) => visible ? <View {...props}><Pressable testID="modal-back" onPress={onClose} />{children}</View> : null, V2SheetGrabZone: ({ children }: any) => <>{children}</> };
});
jest.mock('@/hooks/v2', () => ({ useV2ReduceMotion: () => true }));
jest.mock('@/components/v2/chart/ChartKeyboardFrame', () => ({ ChartKeyboardFrame: ({ children, footer, style, testID, externalKeyboard }: any) => {
  const { View } = require('react-native');
  return <View testID={testID} style={style} externalKeyboard={externalKeyboard}><View testID="vision-refine-body">{children}</View>{footer}</View>;
} }));
jest.mock('../VisionSceneField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return { VisionSceneField: ({ value, onChangeText, onFocus, maxChars, testID, accessibilityLabel, compact }: any) => {
    React.useEffect(() => {
      mockFieldLifecycle('mount');
      return () => mockFieldLifecycle('unmount');
    }, []);
    return <TextInput testID={testID} accessibilityLabel={accessibilityLabel} accessibilityHint={compact ? 'Compact prompt' : undefined} value={value} onChangeText={onChangeText} onFocus={onFocus} maxLength={maxChars} />;
  } };
});
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
    mockKeyboardListeners.clear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((eventName: string, listener: (event: any) => void) => {
      mockKeyboardListeners.set(eventName, listener);
      return { remove: jest.fn() } as any;
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('labels an original candidate and keeps the saved-image reassurance and prompt aids', () => {
    const view = renderSheet();
    expect(view.UNSAFE_getByProps({ testID: 'vision-refine-source-label' }).props.children).toBe('Editing Option 2');
    expect(view.getByText('Your current image stays saved. You can always return to it.')).toBeTruthy();
    expect(view.getByText('Change lighting')).toBeTruthy();
    expect(view.getByText('Adjust composition')).toBeTruthy();
    expect(view.getByTestId('vision-refine-input')).toBeTruthy();
  });

  it('labels later candidates with their exact source version and option', () => {
    const view = renderSheet({ source: { ...source, roundNumber: 2, optionNumber: 1 } });
    expect(view.UNSAFE_getByProps({ testID: 'vision-refine-source-label' }).props.children).toBe('Based on Version 2 · Option 1');
  });

  it('keeps the source label outside the cream surface under the selected print', () => {
    const view = renderSheet();
    const sourceStyle = StyleSheet.flatten(view.UNSAFE_getByProps({ testID: 'vision-refine-source-label' }).props.style);

    expect(sourceStyle.position).toBe('absolute');
    expect(sourceStyle.top).toBe(-34);
    expect(view.UNSAFE_getByProps({ testID: 'vision-refine-references' }).props.density).toBe('refine');
  });

  it('gives the sheet an explicit bounded height and lets the scroll/footer frame fill its remaining space', () => {
    const view = renderSheet();
    const surfaceStyle = StyleSheet.flatten(view.getByTestId('vision-refine-surface').props.style);
    const frameStyle = StyleSheet.flatten(view.getByTestId('vision-refine-keyboard-frame').props.style);

    expect(surfaceStyle.height).toEqual(expect.any(Number));
    expect(surfaceStyle.height).toBe(Math.floor(Dimensions.get('window').height * 0.7) - 12 + V2_SHEET_SKIRT);
    expect(frameStyle).toEqual(expect.objectContaining({ flex: 1, minHeight: 0 }));
    expect(view.getByTestId('vision-refine-submit')).toBeTruthy();
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
    expect(view.getByTestId('vision-refine-fixed-references')).toBeTruthy();
    expect(view.getByText('What would you like to change?')).toBeTruthy();
    expect(view.getByText('Your current image is safe')).toBeTruthy();
    expect(view.getByTestId('vision-refine-keyboard-done')).toBeTruthy();
    expect(view.getByLabelText('Compact thumbnail strip')).toBeTruthy();
    expect(within(view.getByTestId('vision-refine-body')).queryByTestId('vision-refine-references')).toBeNull();
    expect(view.getByText('4 references')).toBeTruthy();
    expect(view.queryByText('Your current image stays saved. You can always return to it.')).toBeNull();
    expect(view.queryByText('Replace an object')).toBeNull();
  });

  it('preserves the focused prompt instance and draft through the keyboard show transition', () => {
    const view = renderSheet();
    const field = view.getByTestId('vision-refine-input');
    const nativeFrame = view.getByTestId('vision-refine-native-frame');

    expect(nativeFrame.props.collapsable).toBe(false);

    fireEvent.changeText(field, 'Keep my current wording');
    fireEvent(field, 'focus');
    expect(mockFieldLifecycle).toHaveBeenCalledTimes(1);
    expect(mockFieldLifecycle).toHaveBeenLastCalledWith('mount');

    act(() => mockKeyboardListeners.get('keyboardDidShow')?.({ endCoordinates: { screenY: Dimensions.get('window').height - 240 } }));

    expect(view.getByTestId('vision-refine-input').props.value).toBe('Keep my current wording');
    expect(view.getByTestId('vision-refine-input').props.accessibilityHint).toBe('Compact prompt');
    expect(mockFieldLifecycle).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('vision-refine-native-frame').props.collapsable).toBe(false);
    expect(StyleSheet.flatten(view.getByTestId('vision-refine-native-frame').props.style).transform).toEqual([{ translateY: -240 }]);
    expect(view.getByTestId('vision-refine-keyboard-frame').props.externalKeyboard).toBe(true);
    expect(StyleSheet.flatten(view.getByTestId('vision-refine-compact-source').props.style)).toEqual(expect.objectContaining({ position: 'absolute', top: -120 }));
    expect(StyleSheet.flatten(view.getByTestId('vision-refine-compact-source').props.style)).toEqual(expect.objectContaining({ minHeight: 72, backgroundColor: 'transparent' }));
    expect(view.getByTestId('vision-refine-sheet').props.scrimColor).toBe('#14162B');
    expect(within(view.getByTestId('vision-refine-stable-header')).getByTestId('vision-refine-fixed-references')).toBeTruthy();
    expect(view.getByTestId('vision-refine-stable-header')).toBeTruthy();
    expect(view.getAllByText('What would you like to change?')).toHaveLength(1);
    expect(view.queryByText('Quick changes')).toBeNull();
    const quick = within(view.getByTestId('vision-refine-keyboard-quick-changes'));
    fireEvent.press(quick.getByLabelText('Change lighting'));
    expect(view.getByTestId('vision-refine-input').props.value).toContain('Change lighting');
    expect(view.props.onSubmit).not.toHaveBeenCalled();
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
    fireEvent.press(view.UNSAFE_getByProps({ testID: 'modal-back' }));
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(view.props.onClose).not.toHaveBeenCalled();
  });
});
