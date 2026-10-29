import { StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { VisionReferenceStrip } from '../VisionReferenceStrip';
import type { VisionReferenceAttachment } from '@/types/visionConversation';

const mockPickVisionPhoto = jest.fn();
const mockPickVisionReferences = jest.fn();

jest.mock('@/hooks/v2/vision', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPickVisionPhoto(...args), pickVisionReferences: (...args: unknown[]) => mockPickVisionReferences(...args) }));
jest.mock('@/hooks/v2', () => ({ v2Haptics: { selection: jest.fn() } }));
jest.mock('../VisionChoiceSheet', () => ({
  VisionChoiceSheet: (props: { visible: boolean; actions: Array<{ key: string; label: string }>; onChoose: (key: string) => void; testID: string }) => {
    const React = require('react');
    const { Pressable: MockPressable, Text: MockText, View: MockView } = require('react-native');
    return props.visible ? React.createElement(MockView, { testID: props.testID }, props.actions.map(action => React.createElement(
      MockPressable,
      { key: action.key, accessibilityRole: 'button', accessibilityLabel: action.label, onPress: () => props.onChoose(action.key) },
      React.createElement(MockText, null, action.label),
    ))) : null;
  },
}));

const reference = (id: string, role: VisionReferenceAttachment['role'] = 'place'): VisionReferenceAttachment => ({
  id,
  uri: `file:///${id}.jpg`,
  mimeType: 'image/jpeg',
  role,
});

describe('VisionReferenceStrip', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('adds a picked photo as an inspiration reference at quality 0.6', async () => {
    mockPickVisionReferences.mockResolvedValue({ status: 'picked', photos: [{ uri: 'file:///new.jpg', mimeType: 'image/jpeg' }, { uri: 'file:///second.jpg', mimeType: 'image/jpeg' }] });
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={[]} onChange={onChange} />);

    expect(view.getByText('Add reference photos')).toBeTruthy();
    expect(view.getByText('Optional · Up to 5')).toBeTruthy();
    expect(view.getByText('Add photos from library or camera')).toBeTruthy();
    expect(view.getByText('Include yourself, a place, a vehicle, or visual inspiration')).toBeTruthy();
    const emptyTile = view.getByTestId('vision-reference-strip-add');
    const emptyTileStyle = StyleSheet.flatten(typeof emptyTile.props.style === 'function'
      ? emptyTile.props.style({ pressed: false })
      : emptyTile.props.style);
    expect(emptyTileStyle.width).toBe('100%');
    expect(emptyTileStyle.minHeight).toBe(88);

    fireEvent.press(view.getByLabelText('Add reference photo'));
    expect(view.getByLabelText('Take photo')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Choose from library'));

    expect(mockPickVisionReferences).toHaveBeenCalledWith(5, 0.6);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({
      uri: 'file:///new.jpg', mimeType: 'image/jpeg', role: 'inspiration',
    }), expect.objectContaining({ uri: 'file:///second.jpg', role: 'inspiration' })]));
  });

  it('lets a full gallery replace a selected photo in place and preserve its role', async () => {
    const references = [reference('a', 'identity'), reference('b'), reference('c'), reference('d'), reference('e')];
    mockPickVisionPhoto.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///replacement.jpg', mimeType: 'image/jpeg' } });
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={references} onChange={onChange} />);

    fireEvent.press(view.getByLabelText('Person reference photo 1. Replace or remove'));
    fireEvent.press(view.getByLabelText('Replace from library'));

    expect(mockPickVisionPhoto).toHaveBeenCalledWith('library', 0.6);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a', uri: 'file:///replacement.jpg', role: 'identity' }),
      ...references.slice(1),
    ]));
  });

  it('opens an inline role editor for the tapped photo and updates only that reference', () => {
    const references = [reference('a', 'identity'), reference('b', 'place'), reference('c', 'object')];
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={references} onChange={onChange} />);

    expect(view.queryByTestId('vision-reference-strip-role-editor')).toBeNull();
    fireEvent.press(view.getByTestId('vision-reference-strip-role-1'));

    expect(view.getByText('Photo 2 role:')).toBeTruthy();
    expect(view.queryByTestId('vision-reference-strip-role-1-chooser')).toBeNull();
    fireEvent.press(view.getByLabelText('Set photo 2 role to Inspiration'));

    expect(onChange).toHaveBeenCalledWith([
      references[0],
      { ...references[1], role: 'inspiration' },
      references[2],
    ]);
    expect(view.getByTestId('vision-reference-strip-role-editor')).toBeTruthy();
  });

  it('keeps the compact gallery role action on its existing choice sheet', () => {
    const references = [reference('a', 'place')];
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={references} onChange={onChange} compact />);

    fireEvent.press(view.getByTestId('vision-reference-strip-select-0'));
    fireEvent.press(view.getByLabelText('Change role'));
    fireEvent.press(view.getByLabelText('Object'));

    expect(onChange).toHaveBeenCalledWith([{ ...references[0], role: 'object' }]);
  });

  it('offers removal from a full-slot action and from the 44-point remove control', () => {
    const references = Array.from({ length: 5 }, (_, index) => reference(String(index)));
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={references} onChange={onChange} />);

    const removeHit = view.getByTestId('vision-reference-strip-remove-0');
    const hitStyle = StyleSheet.flatten(typeof removeHit.props.style === 'function'
      ? removeHit.props.style({ pressed: false })
      : removeHit.props.style);
    const removeVisualStyle = StyleSheet.flatten(view.getByTestId('vision-reference-strip-remove-visual-0').props.style);
    expect(hitStyle.width).toBe(44);
    expect(hitStyle.height).toBe(44);
    expect(removeVisualStyle.width).toBe(22);
    expect(removeVisualStyle.height).toBe(22);

    fireEvent.press(view.getByLabelText('Place reference photo 1. Replace or remove'));
    fireEvent.press(view.getByLabelText('Remove photo'));
    expect(onChange).toHaveBeenLastCalledWith(references.slice(1));

    fireEvent.press(view.getByLabelText('Remove reference photo 2'));
    expect(onChange).toHaveBeenLastCalledWith([references[0], references[2], references[3], references[4]]);
  });

  it('shows the one-line keyboard summary and an add action while below the limit', () => {
    const view = render(<VisionReferenceStrip references={[reference('a'), reference('b', 'object')]} onChange={jest.fn()} collapsed />);
    expect(view.getByText('2 references attached')).toBeTruthy();
    expect(view.getByText('Place · Object')).toBeTruthy();
    expect(view.getByLabelText('Add reference photo')).toBeTruthy();
    expect(view.queryByText('Reference photos')).toBeNull();
  });

  it('keeps a compact gallery as mini thumbnails plus Add until it is explicitly collapsed', () => {
    const references = [reference('a'), reference('b', 'object')];
    const view = render(<VisionReferenceStrip references={references} onChange={jest.fn()} compact />);

    expect(view.getByLabelText('Place reference photo 1. Change role, replace, or remove')).toBeTruthy();
    expect(view.getByLabelText('Object reference photo 2. Change role, replace, or remove')).toBeTruthy();
    expect(view.getByText('+ Add (2/5)')).toBeTruthy();
    expect(view.queryByText('2 references attached')).toBeNull();
    expect(view.queryByText('Reference photos')).toBeNull();

    view.rerender(<VisionReferenceStrip references={references} onChange={jest.fn()} compact collapsed />);
    expect(view.getByText('2 references attached')).toBeTruthy();
    expect(view.queryByLabelText('Place reference photo 1. Change role, replace, or remove')).toBeNull();
    expect(view.queryByText('+ Add (2/5)')).toBeNull();
  });

  it('does not open the picker when disabled', () => {
    const view = render(<VisionReferenceStrip references={[]} onChange={jest.fn()} disabled />);
    fireEvent.press(view.getByLabelText('Add reference photo'));
    expect(view.queryByLabelText('Choose from library')).toBeNull();
    expect(mockPickVisionPhoto).not.toHaveBeenCalled();
  });
});
