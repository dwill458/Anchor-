const mockHandlers: Record<string, (event: any) => void> = {};
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
  useSpeechEvent: (name: string, handler: (event: any) => void) => { mockHandlers[name] = handler; },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => 'accepted'), setItem: jest.fn(async () => undefined) }));
jest.mock('@/utils/haptics', () => ({ safeHaptics: { impact: jest.fn(), selection: jest.fn(), notification: jest.fn() } }));

import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAskDictation } from '../useAskDictation';

const emit = (name: string, event: unknown = {}) => act(() => { mockHandlers[name]?.(event); });

function setup(initialText = '') {
  const text = { current: initialText };
  const onText = jest.fn((value: string) => { text.current = value; });
  const hook = renderHook(() => useAskDictation({ getText: () => text.current, onText, maxChars: 1000 }));
  return { hook, onText, text };
}

async function startListening(hook: ReturnType<typeof setup>['hook']) {
  await act(async () => { await hook.result.current.start(); });
  emit('start');
  await waitFor(() => expect(hook.result.current.state).toBe('listening'));
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockHandlers).forEach(key => delete mockHandlers[key]);
  mockSpeechAvailable = true;
  mockSpeech.isRecognitionAvailable.mockReturnValue(true);
  mockSpeech.requestPermissionsAsync.mockResolvedValue({ granted: true });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('accepted');
});

describe('useAskDictation', () => {
  it('is not offered where speech recognition does not exist, and starting does nothing', async () => {
    mockSpeechAvailable = false;
    const { hook } = setup();
    expect(hook.result.current.available).toBe(false);
    await act(async () => { await hook.result.current.start(); });
    expect(hook.result.current.state).toBe('idle');
    mockSpeechAvailable = true;
    mockSpeech.isRecognitionAvailable.mockReturnValue(false);
    expect(setup().hook.result.current.available).toBe(false);
  });

  it('records, then puts the spoken words after what was typed, once, without sending anything', async () => {
    const { hook, onText } = setup('Typed already');
    await startListening(hook);
    expect(mockSpeech.start).toHaveBeenCalledWith(expect.objectContaining({ interimResults: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 }, recordingOptions: { persist: false } }));
    emit('result', { results: [{ transcript: 'the rust' }], isFinal: false });
    emit('result', { results: [{ transcript: 'the rust is on the rear panel' }], isFinal: true });
    expect(onText).not.toHaveBeenCalled(); // nothing lands in the composer until the person finishes
    act(() => hook.result.current.finish());
    expect(hook.result.current.state).toBe('finishing');
    expect(mockSpeech.stop).toHaveBeenCalledTimes(1);
    emit('end');
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith('Typed already the rust is on the rear panel');
    expect(hook.result.current.state).toBe('idle');
  });

  it('cancelling throws the recording away and leaves the typed text alone', async () => {
    const { hook, onText } = setup('Typed');
    await startListening(hook);
    emit('result', { results: [{ transcript: 'something said' }], isFinal: true });
    act(() => hook.result.current.cancel());
    expect(mockSpeech.abort).toHaveBeenCalled();
    expect(hook.result.current.state).toBe('idle');
    emit('end');
    expect(onText).not.toHaveBeenCalled();
  });

  it('keeps a recording that ends with no words from touching the composer', async () => {
    const { hook, onText } = setup('Typed');
    await startListening(hook);
    act(() => hook.result.current.finish());
    emit('end');
    expect(onText).not.toHaveBeenCalled();
    expect(hook.result.current.state).toBe('idle');
  });

  it('feeds the waveform with the microphone level and reports that the device measures it', async () => {
    const { hook } = setup();
    await startListening(hook);
    expect(hook.result.current.volumeSupported).toBeNull();
    emit('volumechange', { value: 10 });
    emit('volumechange', { value: 0 });
    const levels = hook.result.current.levels.value;
    expect(levels[levels.length - 2]).toBe(1);
    expect(levels[levels.length - 1]).toBe(0);
    expect(hook.result.current.volumeSupported).toBe(true);
  });

  it('shows the elapsed time while listening', async () => {
    jest.useFakeTimers();
    try {
      const { hook } = setup();
      await startListening(hook);
      act(() => { jest.advanceTimersByTime(2600); });
      expect(hook.result.current.elapsedMs).toBeGreaterThanOrEqual(2500);
    } finally {
      jest.useRealTimers();
    }
  });

  it('asks for permission, and explains and offers Settings when it is denied', async () => {
    mockSpeech.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { hook } = setup();
    await act(async () => { await hook.result.current.start(); });
    expect(mockSpeech.start).not.toHaveBeenCalled();
    expect(hook.result.current.state).toBe('idle');
    expect(hook.result.current.notice).toMatch(/off/i);
    expect(alert).toHaveBeenCalledWith('Voice input is off', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
    alert.mockRestore();
  });

  it('shows a one-time disclosure before the first recording and respects a refusal', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => { buttons?.find(button => button.text === 'Not now')?.onPress?.(); });
    const { hook } = setup();
    await act(async () => { await hook.result.current.start(); });
    expect(alert).toHaveBeenCalledWith('Talk to Ask Chart', expect.stringContaining('does not keep the audio'), expect.any(Array), expect.anything());
    expect(mockSpeech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(hook.result.current.state).toBe('idle');
    alert.mockRestore();
  });

  it('on an error keeps what was heard, says why, and returns to idle', async () => {
    const { hook, onText } = setup();
    await startListening(hook);
    emit('result', { results: [{ transcript: 'half a thought' }], isFinal: false });
    emit('error', { error: 'network' });
    expect(onText).toHaveBeenCalledWith('half a thought');
    expect(hook.result.current.notice).toMatch(/connection/i);
    expect(hook.result.current.state).toBe('idle');
  });

  it('says nothing for silence, which is not a failure', async () => {
    const { hook } = setup();
    await startListening(hook);
    emit('error', { error: 'no-speech' });
    expect(hook.result.current.notice).toBeNull();
    expect(hook.result.current.state).toBe('idle');
  });

  it('stops when the app leaves the foreground and keeps the words', async () => {
    let appStateListener: ((state: string) => void) | undefined;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, listener: (state: string) => void) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    }) as never);
    const { hook, onText } = setup();
    await startListening(hook);
    emit('result', { results: [{ transcript: 'before the call' }], isFinal: true });
    act(() => appStateListener?.('background'));
    expect(mockSpeech.stop).toHaveBeenCalled();
    expect(hook.result.current.notice).toMatch(/left/i);
    emit('end');
    expect(onText).toHaveBeenCalledWith('before the call');
    spy.mockRestore();
  });

  it('releases the microphone when the screen goes away mid-recording', async () => {
    const { hook } = setup();
    await startListening(hook);
    hook.unmount();
    expect(mockSpeech.abort).toHaveBeenCalled();
  });

  it('does not start twice from a double tap', async () => {
    const { hook } = setup();
    await act(async () => { await Promise.all([hook.result.current.start(), hook.result.current.start()]); });
    expect(mockSpeech.start).toHaveBeenCalledTimes(1);
  });
});
