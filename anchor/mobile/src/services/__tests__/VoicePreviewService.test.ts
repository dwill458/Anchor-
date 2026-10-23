const mockPlay = jest.fn();
const mockPause = jest.fn();
const mockRemove = jest.fn();
const mockRelease = jest.fn();
const mockSubscriptionRemove = jest.fn();
let playbackListener: ((status: { didJustFinish: boolean }) => void) | null = null;

jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    addListener: jest.fn((_event: string, listener: typeof playbackListener) => {
      playbackListener = listener;
      return { remove: mockSubscriptionRemove };
    }),
    pause: mockPause,
    play: mockPlay,
    remove: mockRemove,
    release: mockRelease,
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/AnalyticsService', () => ({
  AnalyticsService: { track: jest.fn() },
}));

import {
  getActivePreviewVoice,
  startVoicePreview,
  stopVoicePreview,
} from '../VoicePreviewService';

describe('VoicePreviewService', () => {
  beforeEach(() => {
    stopVoicePreview();
    jest.clearAllMocks();
    playbackListener = null;
  });

  it('allows only one preview and cleans up the previous player', async () => {
    await expect(startVoicePreview('female')).resolves.toBe(true);
    expect(getActivePreviewVoice()).toBe('female');
    await expect(startVoicePreview('female')).resolves.toBe(true);
    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['male', 1],
    ['female', 1],
    ['warm', 1],
    ['soothing', 0.415],
  ] as const)('plays the current %s preview at its mastered gain', async (voice, gain) => {
    const { createAudioPlayer } = jest.requireMock('expo-audio');
    await expect(startVoicePreview(voice)).resolves.toBe(true);
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);
    expect(createAudioPlayer.mock.results[0].value.volume).toBe(gain);
    expect(getActivePreviewVoice()).toBe(voice);
  });

  it('cleans up when playback finishes', async () => {
    await startVoicePreview('female');
    playbackListener?.({ didJustFinish: true });
    expect(getActivePreviewVoice()).toBeNull();
    expect(mockSubscriptionRemove).toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockRelease).toHaveBeenCalled();
  });
});
