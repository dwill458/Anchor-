import { act, fireEvent, render } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { VisionAddSceneSheet } from '../VisionAddSceneSheet';
import { VISION_ADD_SHEET_HANDOFF_MS } from '../VisionAddSheet';
import { Keyboard, Platform } from 'react-native';
import { V2SheetModal } from '@/components/v2/primitives/V2SheetModal';

const mockPick = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPick(...args) }));

const available = ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock;
const mockReferenceRoleRender = jest.fn();
jest.mock('../VisionRoleChip', () => {
  const actual = jest.requireActual('../VisionRoleChip');
  return { ...actual, VisionRoleChip: (props: any) => {
    mockReferenceRoleRender();
    return require('react').createElement(actual.VisionRoleChip, props);
  } };
});

function renderSheet(overrides: Partial<Parameters<typeof VisionAddSceneSheet>[0]> = {}) {
  const props = { visible: true, onClose: jest.fn(), anchorIntention: 'Buy my dream home', onSubmit: jest.fn(), onAddOwnPhoto: jest.fn(), onAddNote: jest.fn(), ...overrides };
  const view = render(<VisionAddSceneSheet {...props} />);
  return { ...view, props };
}

describe('VisionAddSceneSheet', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); available.mockReturnValue(false); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('does not rebuild the five-photo reference gallery on each typed character', () => {
    const references = Array.from({ length: 5 }, (_, i) => ({ id: `photo-${i}`, uri: `file:///${i}.jpg`, mimeType: 'image/jpeg', role: 'place' as const }));
    const view = renderSheet({ restoreDraft: { description: 'A quiet home', photo: null, references } });
    const renders = mockReferenceRoleRender.mock.calls.length;
    expect(renders).toBeGreaterThanOrEqual(5);
    ['A quiet home a', 'A quiet home at', 'A quiet home at sunset'].forEach(value => {
      fireEvent.changeText(view.getByTestId('vision-scene-input'), value);
    });
    expect(mockReferenceRoleRender).toHaveBeenCalledTimes(renders);
    expect(view.getByTestId('vision-scene-input').props.value).toBe('A quiet home at sunset');
  });

  it('moves Android keyboard clearance into the measured modal root instead of translating its input outside the parent', () => {
    const platform = jest.replaceProperty(Platform, 'OS', 'android');
    const listeners = new Map<string, (event: any) => void>();
    const listener = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
      listeners.set(name, callback);
      return { remove: jest.fn() };
    });
    try {
      const view = renderSheet();
      const height = require('react-native').Dimensions.get('window').height;
      act(() => { listeners.get('keyboardDidShow')?.({ endCoordinates: { screenY: height - 280 } }); });
      expect(view.UNSAFE_getByType(V2SheetModal).props.bottomInset).toBe(280);
      act(() => { listeners.get('keyboardDidHide')?.({}); });
      expect(view.UNSAFE_getByType(V2SheetModal).props.bottomInset).toBe(0);
    } finally { listener.mockRestore(); platform.restore(); }
  });

  it('uses the approved add-scene copy, the description and Generate Images', () => {
    const view = renderSheet();
    expect(view.getByText('What Else Do You See?')).toBeTruthy();
    expect(view.getByText('Imagine another moment from your future.')).toBeTruthy();
    expect(view.getByTestId('vision-scene-input')).toBeTruthy();
    expect(view.getByTestId('vision-scene-generate')).toBeTruthy();
    expect(view.getByText('Generate Images')).toBeTruthy();
  });

  it('keeps the five-slot reference gallery visible and accessible', () => {
    const view = renderSheet();
    expect(view.getByTestId('vision-add-scene-reference')).toBeTruthy();
    expect(view.getByText('Optional · Up to 5')).toBeTruthy();
    expect(view.queryAllByLabelText(/^Remove reference photo [1-5]$/)).toHaveLength(0);
    expect(view.getByLabelText('Add reference photo')).toBeTruthy();
  });

  it('derives shortcuts from the goal, and shows none when the goal gives no theme', () => {
    const view = renderSheet();
    fireEvent.press(view.getByTestId('vision-add-scene-show-suggestions'));
    expect(view.getByText('Suggested for your vision')).toBeTruthy();
    ['Inside my home', 'Getting the keys', 'Family moments', 'Backyard at night'].forEach(label => expect(view.getByLabelText(label)).toBeTruthy());
    view.unmount();
    const other = renderSheet({ anchorIntention: 'Be better' });
    fireEvent.press(other.getByTestId('vision-add-scene-show-suggestions'));
    expect(other.getByLabelText('The day it arrives')).toBeTruthy();
    expect(other.queryByLabelText('Inside my home')).toBeNull();
  });

  it('a shortcut fills the field and never generates', () => {
    const view = renderSheet();
    fireEvent.press(view.getByTestId('vision-add-scene-show-suggestions'));
    fireEvent.press(view.getByLabelText('Getting the keys'));
    expect(view.getByTestId('vision-scene-input').props.value).toBe('Getting the keys');
    expect(view.props.onSubmit).not.toHaveBeenCalled();
  });

  it('keeps generation blocked until the description is long enough, with a 2000-character hint', () => {
    const view = renderSheet();
    fireEvent.press(view.getByTestId('vision-scene-generate'));
    expect(view.props.onSubmit).not.toHaveBeenCalled();
    expect(view.getByText(/Describe the scene in 6–2000 characters/)).toBeTruthy();
  });

  it('hands one prepared request to the ceremony, closes, clears, and ignores a second tap', async () => {
    const view = renderSheet();
    fireEvent.changeText(view.getByTestId('vision-scene-input'), '  The kitchen with a big island.  ');
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); fireEvent.press(view.getByTestId('vision-scene-generate')); });
    expect(view.props.onSubmit).toHaveBeenCalledTimes(1);
    expect(view.props.onSubmit).toHaveBeenCalledWith({ description: 'The kitchen with a big island.', photo: null });
    expect(view.props.onClose).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('vision-scene-input').props.value).toBe('');
  });

  it('sends structured references and omits the legacy photo when a gallery photo is present', async () => {
    mockPick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///house.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    const view = renderSheet();
    await act(async () => { fireEvent.press(view.getByLabelText('Add reference photo')); });
    await act(async () => { fireEvent.press(view.getByLabelText('Choose from library')); });
    await act(async () => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(view.getByTestId('vision-add-scene-reference-item-0')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    expect(view.props.onSubmit).toHaveBeenCalledWith({
      description: '', photo: null,
      references: [expect.objectContaining({ uri: 'file:///house.jpg', mimeType: 'image/jpeg', role: 'inspiration' })],
    });
  });

  it('refills the composer with a request taken back from generation, once', () => {
    const onDraftRestored = jest.fn();
    const onDraftChange = jest.fn();
    const refs = [{ id: 'saved-ref', uri: 'file:///garden.jpg', mimeType: 'image/jpeg', role: 'place' as const }];
    const draft = { description: 'The backyard at night', photo: null, references: refs };
    const view = renderSheet({ restoreDraft: draft, onDraftRestored, onDraftChange });
    expect(view.getByTestId('vision-scene-input').props.value).toBe('The backyard at night');
    expect(view.getByTestId('vision-add-scene-reference-item-0')).toBeTruthy();
    expect(view.getByText('1 of 5 · Roles are optional')).toBeTruthy();
    expect(onDraftRestored).toHaveBeenCalledTimes(1);
    expect(onDraftChange).toHaveBeenCalledWith({ description: draft.description, photo: null, references: refs });
  });

  it('converts a restored legacy photo into an inspiration reference', async () => {
    const draft = { description: 'The backyard at night', photo: { uri: 'file:///legacy.jpg', mimeType: 'image/jpeg' } };
    const view = renderSheet({ restoreDraft: draft });
    expect(view.getByTestId('vision-add-scene-reference-item-0')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    expect(view.props.onSubmit).toHaveBeenCalledWith({
      description: 'The backyard at night', photo: null,
      references: [expect.objectContaining({ uri: 'file:///legacy.jpg', role: 'inspiration' })],
    });
  });

  it('reports text and structured reference changes through the draft callback', async () => {
    const onDraftChange = jest.fn();
    mockPick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///draft.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    const view = renderSheet({ onDraftChange });
    fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A bright room with plants.');
    expect(onDraftChange).toHaveBeenLastCalledWith({ description: 'A bright room with plants.', photo: null });
    await act(async () => { fireEvent.press(view.getByLabelText('Add reference photo')); });
    await act(async () => { fireEvent.press(view.getByLabelText('Choose from library')); });
    await act(async () => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      description: 'A bright room with plants.', photo: null,
      references: [expect.objectContaining({ uri: 'file:///draft.jpg', role: 'inspiration' })],
    }));
  });

  it('keeps an unsent draft when closed and reopened', () => {
    const view = renderSheet();
    fireEvent.changeText(view.getByTestId('vision-scene-input'), 'A backyard at night with string lights.');
    view.rerender(<VisionAddSceneSheet {...view.props} visible={false} />);
    view.rerender(<VisionAddSceneSheet {...view.props} visible />);
    expect(view.getByTestId('vision-scene-input').props.value).toBe('A backyard at night with string lights.');
  });

  it('at the image limit it explains, blocks generation, and still offers a note', () => {
    const view = renderSheet({ canAddImage: false });
    expect(view.getByTestId('vision-add-scene-full')).toBeTruthy();
    expect(view.queryByTestId('vision-scene-generate')).toBeNull();
    fireEvent.press(view.getByLabelText('Add a note'));
    act(() => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(view.props.onAddNote).toHaveBeenCalledTimes(1);
  });

  it('closes first and opens the photo picker only once the sheet has left', () => {
    const view = renderSheet();
    fireEvent.press(view.getByLabelText('Use my own photo'));
    expect(view.props.onClose).toHaveBeenCalled(); expect(view.props.onAddOwnPhoto).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(view.props.onAddOwnPhoto).toHaveBeenCalledWith('library');
  });

  it('puts the microphone in the description field only when speech recognition exists', () => {
    const without = renderSheet();
    expect(without.queryByTestId('vision-dictate')).toBeNull();
    without.unmount();
    available.mockReturnValue(true);
    const withMic = renderSheet();
    expect(withMic.getByLabelText('Describe it with your voice')).toBeTruthy();
    // Voice only fills the field: pressing it never submits.
    expect(withMic.props.onSubmit).not.toHaveBeenCalled();
  });
});
