import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { V2VisionNoteComposer } from '../V2VisionNoteComposer';
import { useSettingsStore } from '@/stores/settingsStore';
import { VISION_NOTE_PRESETS } from '@/components/v2/vision/notes/visionNoteStyles';
import { useV2Vision } from '@/hooks/v2/vision';
import { ApiClientError } from '@/services/ApiClient';

jest.mock('@/hooks/v2/vision', () => ({ useV2Vision: jest.fn() }));

const FAMILY_LABELS_FOR_TEST = { sticky: 'Sticky Notes', paper: 'Paper', editorial: 'Editorial' };
const goBack = jest.fn();
const createNote = jest.fn();
const updateNote = jest.fn();
const refresh = jest.fn();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
const note = { id: 'n1', visionId: 'v1', content: { text: 'Saved words' }, presentation: { styleId: 'editorial_rose_editorial' as const, x: .4, y: .55, width: .3, height: .24, rotation: 0, scale: 1, layerOrder: 2 }, createdAt: '', updatedAt: '' };
const model = { vision: { id: 'v1', notes: [note] }, tiles: [], loading: false, error: null, createNote, updateNote, refresh };
const mockedUseV2Vision = useV2Vision as jest.Mock;
const renderScreen = (platform: 'ios' | 'android' = 'ios', noteId?: string) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  return render(<V2VisionNoteComposer route={{ params: { anchorId: 'a1', visionId: 'v1', noteId } }} navigation={{ goBack }} />);
};

describe('V2VisionNoteComposer', () => {
  beforeEach(() => {
    mockedUseV2Vision.mockReturnValue(model);
    createNote.mockReset().mockResolvedValue({ id: 'v1' });
    updateNote.mockReset().mockResolvedValue({ id: 'v1' });
    refresh.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalPlatformDescriptor) Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    goBack.mockClear(); useSettingsStore.setState({ reduceMotion: 'system' });
  });

  it('pops directly to the existing board only after persistence, without a duplicate tap', async () => {
    let complete!: (result: unknown) => void;
    createNote.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const popTo = jest.fn();
    const view = render(<V2VisionNoteComposer route={{ params: { anchorId: 'a1' } }} navigation={{ goBack, popTo }} />);
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'New words');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(popTo).not.toHaveBeenCalled();
    complete({ id: 'v1', notes: [{ ...note, id: 'new-note', content: { text: 'New words' } }] });
    await waitFor(() => expect(popTo).toHaveBeenCalledWith('V2Vision', { anchorId: 'a1', savedNoteId: 'new-note' }, { merge: true }));
    expect(goBack).not.toHaveBeenCalled();
  });

  it('previews text and persists a new note before returning', async () => {
    const view = renderScreen();
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'A little note for my future self.');
    expect(view.getByTestId('vision-note-preview').props.accessibilityLabel).toContain('A little note');
    fireEvent.press(view.getByTestId('vision-note-font-modern'));
    expect(view.getByTestId('vision-note-input').props.value).toBe('A little note for my future self.');
    expect(view.getByTestId('vision-note-current-renderer').findByType(require('react-native').Text).props.style.fontFamily).toBe('Inter-Regular');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(1));
    expect(createNote.mock.calls[0][0]).toEqual(expect.objectContaining({
      clientRequestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i), content: { text: 'A little note for my future self.' },
      presentation: expect.objectContaining({ styleId: 'sticky_blush_pink', fontId: 'modern', x: expect.any(Number), y: expect.any(Number), rotation: -2 }),
    }));
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  });
  it('returns to the existing React Navigation 6 board with its confirmed reveal ID', async () => {
    const navigate = jest.fn();
    createNote.mockResolvedValue({ id: 'v1', notes: [{ ...note, id: 'created-note' }] });
    const view = render(<V2VisionNoteComposer route={{ params: { anchorId: 'a1' } }} navigation={{ goBack, navigate }} />);
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'Native navigation check');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('V2Vision', { anchorId: 'a1', savedNoteId: 'created-note' }));
    expect(goBack).not.toHaveBeenCalled();
  });

  it('does not leave the composer on a failed save and offers a retry', async () => {
    createNote.mockRejectedValueOnce(new Error('Network error. Please check your connection.'));
    const view = renderScreen();
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'Keep this thought');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(await view.findByText('No connection. Your draft is still here; reconnect and try again.')).toBeTruthy();
    expect(view.getByTestId('vision-note-input').props.value).toBe('Keep this thought');
    const firstRequestId = createNote.mock.calls[0][0].clientRequestId;
    expect(firstRequestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(goBack).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Add to Vision'));
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
    expect(createNote.mock.calls[1][0].clientRequestId).toBe(firstRequestId);
  });

  it.each([
    [new ApiClientError('content.text: Note text cannot be blank', 'VALIDATION_ERROR', 400), 'content.text: Note text cannot be blank'],
    [new ApiClientError('A Vision can contain up to 24 active notes', 'VISION_NOTE_LIMIT', 400), 'A Vision can contain up to 24 active notes'],
    [new ApiClientError('Request id was already used for a different note', 'IDEMPOTENCY_CONFLICT', 409), 'This note was saved with an earlier version. Return to your Vision board and edit the saved note.'],
    [new ApiClientError('The server failed', 'INTERNAL_SERVER_ERROR', 500), 'The server could not save your note. Your draft is still here; try again shortly.'],
    [new Error('Session expired. Please sign in again.'), 'Session expired. Please sign in again.'],
  ])('shows actionable save feedback for %s', async (error, message) => {
    createNote.mockRejectedValueOnce(error);
    const view = renderScreen();
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'Keep this thought');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(await view.findByText(message)).toBeTruthy();
    expect(view.getByTestId('vision-note-input').props.value).toBe('Keep this thought');
    expect(goBack).not.toHaveBeenCalled();
  });

  it('blocks duplicate rapid submissions while one create request is pending', async () => {
    let resolveSave!: (value: { id: string }) => void;
    createNote.mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
    const view = renderScreen();
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'One careful request');
    fireEvent.press(view.getByLabelText('Add to Vision'));
    fireEvent.press(view.getByLabelText('Add to Vision'));
    expect(createNote).toHaveBeenCalledTimes(1);
    resolveSave({ id: 'v1' });
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  });

  it('loads and updates an existing note, preserving its board geometry', async () => {
    const view = renderScreen('ios', 'n1');
    await waitFor(() => expect(view.getByTestId('vision-note-input').props.value).toBe('Saved words'));
    expect(view.getByLabelText('Rose Editorial note style').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'Edited words');
    fireEvent.press(view.getByLabelText('Save note'));
    await waitFor(() => expect(updateNote).toHaveBeenCalledWith('n1', expect.objectContaining({
      content: { text: 'Edited words' }, presentation: expect.objectContaining({ styleId: 'editorial_rose_editorial', x: .4, y: .55, layerOrder: 2 }),
    })));
    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
  });

  it('never turns a missing edit into a new note and offers a read retry on failure', () => {
    mockedUseV2Vision.mockReturnValue({ ...model, vision: { id: 'v1', notes: [] }, loading: false, error: null });
    const missing = renderScreen('ios', 'missing-note');
    expect(missing.getByText('This note is no longer available. It has not been replaced.')).toBeTruthy();
    expect(missing.getByLabelText('Save note').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(missing.getByLabelText('Save note'));
    expect(createNote).not.toHaveBeenCalled();
    missing.unmount();

    mockedUseV2Vision.mockReturnValue({ ...model, vision: null, loading: false, error: 'Network unavailable' });
    const failedRead = renderScreen('ios', 'n1');
    expect(failedRead.getByText('Could not load this note.')).toBeTruthy();
    fireEvent.press(failedRead.getByLabelText('Retry loading note'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(createNote).not.toHaveBeenCalled();
  });

  it('limits text to 200 Unicode code points and offers all 26 styles', () => {
    const view = renderScreen();
    const input = view.getByTestId('vision-note-input');
    expect(input.props.maxLength).toBe(400);
    fireEvent.press(view.getByLabelText('Editorial styles'));
    for (const preset of VISION_NOTE_PRESETS.filter(item => item.family === 'editorial')) {
      fireEvent.press(view.getByLabelText(`${preset.label} note style`));
      expect(view.getByLabelText(`${preset.label} note style`).props.accessibilityState.selected).toBe(true);
    }
    fireEvent.changeText(input, '🙂'.repeat(205));
    expect(view.getByTestId('vision-note-input').props.value).toBe('🙂'.repeat(200));
    expect(view.getByText('200 / 200')).toBeTruthy();
  });

  it.each(VISION_NOTE_PRESETS)('persists the $id material without replacing its presentation', async preset => {
    const view = renderScreen();
    fireEvent.changeText(view.getByTestId('vision-note-input'), 'Material check');
    fireEvent.press(view.getByLabelText(`${FAMILY_LABELS_FOR_TEST[preset.family]} styles`));
    fireEvent.press(view.getByLabelText(`${preset.label} note style`));
    fireEvent.press(view.getByLabelText('Add to Vision'));
    await waitFor(() => expect(createNote).toHaveBeenCalledWith(expect.objectContaining({
      content: { text: 'Material check' }, presentation: expect.objectContaining({ styleId: preset.id }),
    })));
  });

  it('skips the prior-material crossfade when reduced motion is enabled', () => {
    useSettingsStore.setState({ reduceMotion: 'on' });
    const view = renderScreen();
    fireEvent.press(view.getByLabelText('Paper styles'));
    expect(view.queryByTestId('vision-note-previous-material')).toBeNull();
  });

  it.each([['ios', 'padding'], ['android', 'height']] as const)('uses keyboard avoidance on %s', (platform, behavior) => {
    const view = renderScreen(platform);
    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(behavior);
  });
});
