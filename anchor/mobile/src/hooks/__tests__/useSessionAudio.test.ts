import { act, renderHook } from '@testing-library/react-native';
import { createAudioPlayer, type AudioStatus } from 'expo-audio';
import { useSessionAudio } from '../useSessionAudio';

jest.mock('@/services/audio/AudioSession', () => ({ setAudioSessionMode: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/audio/remoteAudio', () => ({ hydrateRemoteAudioCache: jest.fn().mockResolvedValue(undefined), resolvePlayableAudioSource: (source: unknown) => source }));

it('reports a native source error once and releases the failed player without completing it', () => {
  let publish!: (status: AudioStatus) => void;
  const removeSubscription = jest.fn();
  const player = { id: 'failed-stream', loop: false, volume: 1, pause: jest.fn(), remove: jest.fn(),
    addListener: jest.fn((_event: string, callback: typeof publish) => { publish = callback; return { remove: removeSubscription }; }) };
  jest.mocked(createAudioPlayer).mockReturnValueOnce(player as unknown as ReturnType<typeof createAudioPlayer>);
  const onFailure = jest.fn();
  const onFinish = jest.fn();
  const { result } = renderHook(() => useSessionAudio());
  act(() => { result.current.createSessionAudioPlayer({ uri: 'https://example.invalid/audio.mp3' }, { onFailure, onFinish }); });
  act(() => { publish({ error: 'Source error', didJustFinish: false } as AudioStatus); });
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(onFinish).not.toHaveBeenCalled();
  expect(player.pause).toHaveBeenCalledTimes(1);
  expect(player.remove).toHaveBeenCalledTimes(1);
  expect(removeSubscription).toHaveBeenCalledTimes(1);
});
