import { act, renderHook } from '@testing-library/react-native';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useVisionDictation } from '../useVisionDictation';

jest.mock('expo-speech-recognition', () => {
  const React = require('react');
  const handlerMap: Record<string, (event: any) => void> = {};
  return {
    __handlers: handlerMap,
    ExpoSpeechRecognitionModule: {
      isRecognitionAvailable: jest.fn(() => true),
      supportsOnDeviceRecognition: jest.fn(() => false),
      requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    },
    useSpeechRecognitionEvent: (name: string, handler: (event: any) => void) => { React.useEffect(() => { handlerMap[name] = handler; }); },
  };
});
const speech = require('expo-speech-recognition');
const mockModule = speech.ExpoSpeechRecognitionModule;
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const emit = (name: string, event: any = {}) => act(() => { speech.__handlers[name]?.(event); });

describe('useVisionDictation', () => {
  let text = 'A bright kitchen';
  const onText = jest.fn((next: string) => { text = next; });
  const setup = () => renderHook(() => useVisionDictation({ getText: () => text, onText, maxChars: 400 }));

  beforeEach(() => {
    text = 'A bright kitchen';
    jest.clearAllMocks();
    mockModule.isRecognitionAvailable.mockReturnValue(true);
    mockModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('accepted');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  it('asks permission, records, and adds speech after the typed text without submitting', async () => {
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    expect(mockModule.requestPermissionsAsync).toHaveBeenCalled();
    expect(mockModule.start).toHaveBeenCalledWith(expect.objectContaining({ interimResults: true, recordingOptions: { persist: false } }));
    emit('start');
    expect(result.current.listening).toBe(true);
    emit('result', { results: [{ transcript: 'with my family' }] });
    expect(text).toBe('A bright kitchen with my family');
    emit('result', { results: [{ transcript: 'with my family at dawn' }] });
    expect(text).toBe('A bright kitchen with my family at dawn');
    emit('end');
    expect(result.current.listening).toBe(false);
  });

  it('shows the disclosure before the first recording and records nothing if declined', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Alert.alert as jest.Mock).mockImplementation((_t, _b, buttons) => buttons?.[0]?.onPress?.());
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    expect(Alert.alert).toHaveBeenCalledWith('Describe it with your voice', expect.stringMatching(/Apple or Google/), expect.any(Array), expect.any(Object));
    expect(mockModule.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockModule.start).not.toHaveBeenCalled();
    expect(result.current.state).toBe('idle');
  });

  it('remembers acceptance of the disclosure', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Alert.alert as jest.Mock).mockImplementation((_t, _b, buttons) => buttons?.[1]?.onPress?.());
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.any(String), 'accepted');
    expect(mockModule.start).toHaveBeenCalled();
  });

  it('keeps typed text and offers Settings when permission is denied', async () => {
    mockModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    expect(mockModule.start).not.toHaveBeenCalled();
    expect(text).toBe('A bright kitchen');
    expect(result.current.notice).toMatch(/keep typing/);
    expect(Alert.alert).toHaveBeenCalledWith('Voice input is off', expect.any(String), expect.any(Array));
  });

  it('leaves typed text alone on a recognition error and stays silent for no-speech', async () => {
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    emit('start');
    emit('error', { error: 'no-speech' });
    expect(result.current.notice).toBeNull();
    expect(text).toBe('A bright kitchen');
    await act(async () => { await result.current.toggle(); });
    emit('start');
    emit('error', { error: 'network' });
    expect(result.current.notice).toMatch(/connection/);
    expect(text).toBe('A bright kitchen');
    expect(result.current.state).toBe('idle');
  });

  it('reports an unsupported device without recording', async () => {
    mockModule.isRecognitionAvailable.mockReturnValue(false);
    const { result } = setup();
    await act(async () => { await result.current.toggle(); });
    expect(result.current.notice).toMatch(/isn’t available on this device/);
    expect(mockModule.start).not.toHaveBeenCalled();
  });

  it('releases the microphone on unmount and when the app leaves the foreground', async () => {
    let appStateHandler: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: any) => {
      appStateHandler = handler;
      return { remove: jest.fn() };
    }) as any);
    const { result, unmount } = setup();
    await act(async () => { await result.current.toggle(); });
    emit('start');
    act(() => appStateHandler?.('background'));
    expect(mockModule.abort).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockModule.abort).toHaveBeenCalledTimes(2);
  });

  it('ignores a second tap while starting, and stops on the next tap while listening', async () => {
    const { result } = setup();
    await act(async () => { await Promise.all([result.current.toggle(), result.current.toggle()]); });
    expect(mockModule.start).toHaveBeenCalledTimes(1);
    emit('start');
    act(() => result.current.toggle());
    expect(mockModule.stop).toHaveBeenCalledTimes(1);
  });
});
