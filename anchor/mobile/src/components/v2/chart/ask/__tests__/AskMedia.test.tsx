jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  return { __esModule: true, ...actual };
});
jest.mock('@/components/v2/anchor/CircularAnchorRenderer', () => ({ CircularAnchorRenderer: () => null }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ trackChart: jest.fn() }));
jest.mock('@/services/ApiClient', () => ({ apiClient: { defaults: {}, post: jest.fn() }, ApiClientError: class extends Error {} }));
jest.mock('@/services/AuthService', () => ({ AuthService: { getIdToken: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() } }));

const mockHandlers: Record<string, (event: unknown) => void> = {};
const mockSpeech = {
  isRecognitionAvailable: jest.fn(() => true),
  supportsOnDeviceRecognition: jest.fn(() => true),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};
let mockSpeechAvailable = true;
jest.mock('@/hooks/v2/vision/speechRecognition', () => ({
  get speechModule() { return mockSpeechAvailable ? mockSpeech : null; },
  useSpeechEvent: (name: string, handler: (event: unknown) => void) => { mockHandlers[name] = handler; },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => 'accepted'), setItem: jest.fn(async () => undefined) }));
const mockPick = jest.fn();
jest.mock('@/hooks/v2/vision/visionPhotoInput', () => ({ pickVisionPhoto: (...args: unknown[]) => mockPick(...args) }));
const mockPrepare = jest.fn();
jest.mock('@/hooks/v2/chart/askChartPhoto', () => ({ ...jest.requireActual('@/hooks/v2/chart/askChartPhoto'), prepareAskPhoto: (...args: unknown[]) => mockPrepare(...args) }));

import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { initialAskState, type AskState, type AskUiMessage } from '@/hooks/v2/chart/askChartState';
import { AskChartView } from '../AskChartView';
import { useAskMedia } from '../useAskMedia';
import { AskAttachSheet } from '../AskAttachSheet';
import { AskVoiceRecorder } from '../AskVoiceRecorder';
import { askAccent } from '../askChartTheme';

const msg = (over: Partial<AskUiMessage>): AskUiMessage => ({
  id: 'm', key: 'm', role: 'ASSISTANT', text: 'text', createdAt: '2026-10-21T00:00:00Z', attachments: [], suggestions: [], requestPhoto: null,
  readyToPlan: false, planInput: null, action: null, actionUnavailable: false, skill: null, status: 'sent', animate: false, ...over,
});

function makeAsk(state: Partial<AskState> = {}, extra: Record<string, unknown> = {}) {
  return {
    state: { ...initialAskState, status: 'ready', messages: [msg({ id: 'a', key: 'a', text: 'Hello' })], ...state } as AskState,
    send: jest.fn(() => true), retry: jest.fn(), cancel: jest.fn(), reload: jest.fn(),
    suggestions: [] as string[], requestPhoto: null as { reason: string } | null, planInput: null, busy: false, ...extra,
  };
}

type Upload = Parameters<typeof useAskMedia>[0]['uploadApi'];
function setup(ask = makeAsk()) {
  const uploads: Array<{ resolve: (id: string) => void; reject: (e: unknown) => void }> = [];
  const uploadApi = { uploadPhoto: jest.fn((..._args: unknown[]) => new Promise((resolve, reject) => { uploads.push({ resolve: id => resolve({ assetId: id, width: 1, height: 1 }), reject }); })) } as unknown as Upload;
  function Harness() {
    const media = useAskMedia({ ask: ask as never, anchorId: 'anchor-1', category: 'desire', reducedMotion: true, uploadApi });
    return <AskChartView ask={ask as never} intention="Restore my Regal" category="desire" anchorArt={null} reducedMotion {...media} />;
  }
  const screen = render(<Harness />);
  return { screen, ask, uploads, uploadApi };
}

async function attachPhoto(screen: ReturnType<typeof render>, uploads: Array<{ resolve: (id: string) => void }>, index = 0, id = 'asset-1') {
  fireEvent.press(screen.getByTestId('ask-plus'));
  await act(async () => { fireEvent.press(screen.getByTestId('ask-attach-library')); });
  await waitFor(() => expect(uploads.length).toBeGreaterThan(index));
  await act(async () => uploads[index].resolve(id));
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach(key => delete mockHandlers[key]);
  mockSpeechAvailable = true;
  mockPick.mockResolvedValue({ status: 'picked', photo: { uri: 'file:///picked.jpg', mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } });
  mockPrepare.mockResolvedValue({ base64Image: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg', uri: 'file:///out.jpg' });
});

describe('composer controls', () => {
  it('offers the microphone only where speech recognition exists', () => {
    expect(setup().screen.getByTestId('ask-mic')).toBeTruthy();
    mockSpeechAvailable = false;
    expect(setup().screen.queryByTestId('ask-mic')).toBeNull();
  });

  it('always offers the attach control, and opens the sheet with camera and library', () => {
    const { screen } = setup();
    expect(screen.queryByTestId('ask-attach-sheet')).toBeNull();
    fireEvent.press(screen.getByTestId('ask-plus'));
    expect(screen.getByTestId('ask-attach-sheet')).toBeTruthy();
    expect(screen.getByText('Take photo')).toBeTruthy();
    expect(screen.getByText('Photo library')).toBeTruthy();
    expect(screen.getByText(/deleted within a day/)).toBeTruthy();
  });
});

describe('photos', () => {
  it('Take photo opens the camera and closes the sheet; the photo shows as uploading, then ready', async () => {
    const { screen, uploads } = setup();
    fireEvent.press(screen.getByTestId('ask-plus'));
    await act(async () => { fireEvent.press(screen.getByTestId('ask-attach-camera')); });
    expect(mockPick).toHaveBeenCalledWith('camera', expect.any(Number));
    expect(screen.queryByTestId('ask-attach-sheet')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('ask-attachment-uploading')).toBeTruthy());
    expect(screen.getByTestId('ask-attachment-progress')).toBeTruthy();
    await act(async () => uploads[0].resolve('asset-1'));
    expect(screen.getByTestId('ask-attachment-ready')).toBeTruthy();
  });

  it('holds the send while a photo uploads, then sends with the uploaded photo and clears the strip', async () => {
    const { screen, ask, uploads } = setup();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Here is the rust');
    fireEvent.press(screen.getByTestId('ask-plus'));
    await act(async () => { fireEvent.press(screen.getByTestId('ask-attach-library')); });
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(ask.send).not.toHaveBeenCalled();
    await act(async () => uploads[0].resolve('asset-1'));
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(ask.send).toHaveBeenCalledWith('Here is the rust', { attachments: ['asset-1'], previewUris: ['file:///picked.jpg'] });
    expect(screen.getByTestId('ask-input').props.value).toBe('');
    expect(screen.queryByTestId('ask-attachments')).toBeNull();
  });

  it('can send a photo with no text', async () => {
    const { screen, ask, uploads } = setup();
    await attachPhoto(screen, uploads);
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(ask.send).toHaveBeenCalledWith('', expect.objectContaining({ attachments: ['asset-1'] }));
  });

  it('shows a failed upload, blocks the send, and lets the person retry or remove it', async () => {
    const { screen, ask, uploads, uploadApi } = setup();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'text');
    fireEvent.press(screen.getByTestId('ask-plus'));
    await act(async () => { fireEvent.press(screen.getByTestId('ask-attach-library')); });
    await waitFor(() => expect(uploads).toHaveLength(1));
    await act(async () => uploads[0].reject(new Error('boom')));
    expect(screen.getByTestId('ask-attachment-failed')).toBeTruthy();
    expect(screen.getByText(/didn’t upload/)).toBeTruthy();
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('ask-attachment-failed'));
    await waitFor(() => expect((uploadApi as unknown as { uploadPhoto: jest.Mock }).uploadPhoto).toHaveBeenCalledTimes(2));
    expect(mockPick).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('ask-attachment-remove'));
    expect(screen.queryByTestId('ask-attachments')).toBeNull();
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
    expect(ask.send).not.toHaveBeenCalled();
  });

  it('previews a photo full screen and closes it again', async () => {
    const { screen, uploads } = setup();
    await attachPhoto(screen, uploads);
    fireEvent.press(screen.getByTestId('ask-attachment-ready'));
    expect(screen.getByTestId('ask-photo-preview')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-photo-preview-close'));
    expect(screen.queryByTestId('ask-photo-preview')).toBeNull();
  });

  it('keeps a message with no photos working normally', () => {
    const { screen, ask } = setup();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'just text');
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(ask.send).toHaveBeenCalledWith('just text', { attachments: [], previewUris: [] });
  });
});

describe('AI-requested photo', () => {
  const asking = () => makeAsk({ messages: [msg({ id: 'a', key: 'a', text: 'Could you show me the rusted section?', requestPhoto: { reason: 'to suggest a better next step' } })] }, { requestPhoto: { reason: 'to suggest a better next step' } });

  it('appears under the assistant message that asked, as a request and not a requirement', () => {
    const { screen } = setup(asking());
    expect(screen.getByTestId('ask-photo-request')).toBeTruthy();
    expect(screen.getByText('Continue without a photo')).toBeTruthy();
    // The composer still works with no photo at all.
    fireEvent.changeText(screen.getByTestId('ask-input'), 'It is on the rear panel');
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('Take photo from the request opens the camera', async () => {
    const { screen } = setup(asking());
    await act(async () => { fireEvent.press(screen.getByTestId('ask-request-camera')); });
    expect(mockPick).toHaveBeenCalledWith('camera', expect.any(Number));
  });

  it('can be waved off, and goes away once a photo is attached', async () => {
    const first = setup(asking());
    fireEvent.press(first.screen.getByTestId('ask-request-skip'));
    expect(first.screen.queryByTestId('ask-photo-request')).toBeNull();
    first.screen.unmount();
    const second = setup(asking());
    await act(async () => { fireEvent.press(second.screen.getByTestId('ask-request-library')); });
    await waitFor(() => expect(second.uploads).toHaveLength(1));
    expect(second.screen.queryByTestId('ask-photo-request')).toBeNull();
  });

  it('is not shown on an old message or when nothing was requested', () => {
    expect(setup(makeAsk()).screen.queryByTestId('ask-photo-request')).toBeNull();
    const stale = makeAsk(
      { messages: [msg({ id: 'a', key: 'a', requestPhoto: { reason: 'x' } }), msg({ id: 'u', key: 'u', role: 'USER', text: 'no thanks' })] },
      { requestPhoto: null }
    );
    expect(setup(stale).screen.queryByTestId('ask-photo-request')).toBeNull();
  });
});

describe('voice input', () => {
  it('replaces the composer with the recorder while recording, and cancel brings the composer back', async () => {
    const { screen } = setup();
    await act(async () => { fireEvent.press(screen.getByTestId('ask-mic')); });
    expect(mockSpeech.start).toHaveBeenCalled();
    act(() => mockHandlers.start?.({}));
    await waitFor(() => expect(screen.getByTestId('ask-recorder')).toBeTruthy());
    expect(screen.queryByTestId('ask-input')).toBeNull();
    expect(screen.getByText('Listening…')).toBeTruthy();
    expect(screen.getByTestId('ask-waveform', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByTestId('ask-record-cancel'));
    expect(mockSpeech.abort).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('ask-input')).toBeTruthy());
  });

  it('finishing puts the words in the composer to edit, and never sends them', async () => {
    const { screen, ask } = setup();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Already typed');
    await act(async () => { fireEvent.press(screen.getByTestId('ask-mic')); });
    act(() => mockHandlers.start?.({}));
    await waitFor(() => expect(screen.getByTestId('ask-recorder')).toBeTruthy());
    act(() => mockHandlers.result?.({ results: [{ transcript: 'the hood is bubbling' }], isFinal: true }));
    fireEvent.press(screen.getByTestId('ask-record-finish'));
    expect(mockSpeech.stop).toHaveBeenCalled();
    act(() => mockHandlers.end?.({}));
    await waitFor(() => expect(screen.getByTestId('ask-input').props.value).toBe('Already typed the hood is bubbling'));
    expect(ask.send).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByTestId('ask-input'), 'Already typed the hood is bubbling a lot');
    fireEvent.press(screen.getByTestId('ask-send'));
    expect(ask.send).toHaveBeenCalledWith('Already typed the hood is bubbling a lot', expect.any(Object));
  });
});

describe('AskVoiceRecorder', () => {
  const accent = askAccent('desire');
  const dictation = (state: 'idle' | 'starting' | 'listening' | 'finishing') => ({
    state, elapsedMs: 4200, levels: { value: Array(28).fill(0.5) } as never, volumeSupported: true as boolean | null, finish: jest.fn(), cancel: jest.fn(),
  });

  it('shows the time and the two controls, and does not allow finishing before it is listening', () => {
    const starting = dictation('starting');
    const screen = render(<AskVoiceRecorder dictation={starting} accent={accent} reducedMotion />);
    expect(screen.getByText('Starting…')).toBeTruthy();
    expect(screen.getByTestId('ask-record-finish').props.accessibilityState).toMatchObject({ disabled: true });
    screen.rerender(<AskVoiceRecorder dictation={dictation('listening')} accent={accent} reducedMotion />);
    expect(screen.getByTestId('ask-record-time').props.children).toBe('0:04');
    expect(screen.getByTestId('ask-record-finish').props.accessibilityState).toMatchObject({ disabled: false });
    screen.rerender(<AskVoiceRecorder dictation={dictation('finishing')} accent={accent} reducedMotion />);
    expect(screen.getByText('Finishing…')).toBeTruthy();
  });

  it('renders nothing while idle', () => {
    expect(render(<AskVoiceRecorder dictation={dictation('idle')} accent={accent} reducedMotion />).toJSON()).toBeNull();
  });

  it('draws a bar per level, and still draws when the device reports no level', () => {
    const live = render(<AskVoiceRecorder dictation={dictation('listening')} accent={accent} reducedMotion={false} />);
    expect(live.getByTestId('ask-waveform', { includeHiddenElements: true }).children).toHaveLength(28);
    const quiet = render(<AskVoiceRecorder dictation={{ ...dictation('listening'), volumeSupported: false }} accent={accent} reducedMotion={false} />);
    expect(quiet.getByTestId('ask-waveform', { includeHiddenElements: true }).children).toHaveLength(28);
  });
});

describe('AskAttachSheet', () => {
  const accent = askAccent('health');

  it('closes on a tap outside, on Cancel and on the hardware back button', () => {
    let back: (() => boolean) | undefined;
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_name: string, handler: () => boolean) => { back = handler; return { remove: jest.fn() }; }) as never);
    const onClose = jest.fn();
    const screen = render(<AskAttachSheet visible accent={accent} reducedMotion onClose={onClose} onCamera={jest.fn()} onLibrary={jest.fn()} />);
    fireEvent.press(screen.getByTestId('ask-attach-scrim'));
    fireEvent.press(screen.getByTestId('ask-attach-cancel'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(back?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('routes the two choices and renders nothing when hidden', () => {
    const onCamera = jest.fn();
    const onLibrary = jest.fn();
    const screen = render(<AskAttachSheet visible accent={accent} reducedMotion onClose={jest.fn()} onCamera={onCamera} onLibrary={onLibrary} />);
    fireEvent.press(screen.getByTestId('ask-attach-camera'));
    fireEvent.press(screen.getByTestId('ask-attach-library'));
    expect(onCamera).toHaveBeenCalledTimes(1);
    expect(onLibrary).toHaveBeenCalledTimes(1);
    screen.rerender(<AskAttachSheet visible={false} accent={accent} reducedMotion onClose={jest.fn()} onCamera={onCamera} onLibrary={onLibrary} />);
    expect(screen.queryByTestId('ask-attach-sheet')).toBeNull();
  });
});
