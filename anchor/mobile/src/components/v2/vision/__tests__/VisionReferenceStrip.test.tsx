import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { VisionReferenceStrip } from '../VisionReferenceStrip';
import type { VisionReferenceAttachment } from '@/types/visionConversation';

const mockPickVisionPhoto = jest.fn();

jest.mock('@/hooks/v2/vision', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPickVisionPhoto(...args) }));
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
    mockPickVisionPhoto.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///new.jpg', mimeType: 'image/jpeg' } });
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={[]} onChange={onChange} />);

    fireEvent.press(view.getByLabelText('Add reference photo'));
    fireEvent.press(view.getByLabelText('Choose from library'));

    expect(mockPickVisionPhoto).toHaveBeenCalledWith('library', 0.6);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({
      uri: 'file:///new.jpg', mimeType: 'image/jpeg', role: 'inspiration',
    })]));
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

  it('offers removal from a full-slot action and from the 44-point remove control', () => {
    const references = Array.from({ length: 5 }, (_, index) => reference(String(index)));
    const onChange = jest.fn();
    const view = render(<VisionReferenceStrip references={references} onChange={onChange} />);

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
