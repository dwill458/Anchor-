jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
import { act, fireEvent, render } from '@testing-library/react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { VisionAddSceneSheet } from '../VisionAddSceneSheet';
import { VISION_ADD_SHEET_HANDOFF_MS } from '../VisionAddSheet';

const mockPick = jest.fn();
jest.mock('@/hooks/v2/vision', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPick(...args) }));

const available = ExpoSpeechRecognitionModule.isRecognitionAvailable as jest.Mock;

function renderSheet(overrides: Partial<Parameters<typeof VisionAddSceneSheet>[0]> = {}) {
  const props = { visible: true, onClose: jest.fn(), anchorIntention: 'Buy my dream home', onSubmit: jest.fn(), onAddOwnPhoto: jest.fn(), onAddNote: jest.fn(), ...overrides };
  const view = render(<VisionAddSceneSheet {...props} />);
  return { ...view, props };
}

describe('VisionAddSceneSheet', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); available.mockReturnValue(false); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('asks the continuity question and offers the reference photo, description and CTA', () => {
    const view = renderSheet();
    expect(view.getByText('What else do you see in this future?')).toBeTruthy();
    expect(view.getByLabelText('Add a reference photo')).toBeTruthy();
    expect(view.getByTestId('vision-scene-input')).toBeTruthy();
    expect(view.getByTestId('vision-scene-generate')).toBeTruthy();
  });

  it('derives shortcuts from the goal, and shows none when the goal gives no theme', () => {
    const view = renderSheet();
    ['Inside my home', 'Getting the keys', 'Family moments', 'Backyard at night'].forEach(label => expect(view.getByLabelText(label)).toBeTruthy());
    view.unmount();
    const other = renderSheet({ anchorIntention: 'Be better' });
    expect(other.queryByTestId('vision-scene-suggestions')).toBeNull();
  });

  it('a shortcut fills the field and never generates', () => {
    const view = renderSheet();
    fireEvent.press(view.getByLabelText('Getting the keys'));
    expect(view.getByTestId('vision-scene-input').props.value).toBe('Getting the keys');
    expect(view.props.onSubmit).not.toHaveBeenCalled();
  });

  it('keeps Generate Images blocked until the description is long enough, with a hint', () => {
    const view = renderSheet();
    fireEvent.press(view.getByTestId('vision-scene-generate'));
    expect(view.props.onSubmit).not.toHaveBeenCalled();
    expect(view.getByText(/Describe the scene in 6–400 characters/)).toBeTruthy();
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

  it('a reference photo alone is enough, and travels with the request', async () => {
    mockPick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///house.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
    const view = renderSheet();
    await act(async () => { fireEvent.press(view.getByLabelText('Add a reference photo')); });
    await act(async () => { fireEvent.press(view.getByLabelText('Choose from library')); });
    await act(async () => { jest.advanceTimersByTime(VISION_ADD_SHEET_HANDOFF_MS); });
    expect(view.getByLabelText('Your reference photo')).toBeTruthy();
    await act(async () => { fireEvent.press(view.getByTestId('vision-scene-generate')); });
    expect(view.props.onSubmit).toHaveBeenCalledWith({ description: '', photo: { uri: 'file:///house.jpg', mimeType: 'image/jpeg' } });
  });

  it('refills the composer with a request taken back from generation, once', () => {
    const onDraftRestored = jest.fn();
    const draft = { description: 'The backyard at night', photo: null };
    const view = renderSheet({ restoreDraft: draft, onDraftRestored });
    expect(view.getByTestId('vision-scene-input').props.value).toBe('The backyard at night');
    expect(onDraftRestored).toHaveBeenCalledTimes(1);
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
