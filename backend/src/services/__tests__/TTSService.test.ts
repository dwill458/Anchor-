import {
  generateMantraAudio,
  generateAllMantraAudio,
  isTTSAvailable,
  getAvailableVoicePresets,
} from '../TTSService';
import { uploadAudio } from '../StorageService';
import { formatMantraForTTS } from '../MantraGenerator';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

// Use var to avoid TDZ issues with jest.mock hoisting.
var synthesizeSpeechMock: jest.Mock;

jest.mock('@google-cloud/text-to-speech', () => {
  synthesizeSpeechMock = jest.fn();
  return {
    TextToSpeechClient: jest.fn().mockImplementation(() => ({
      synthesizeSpeech: synthesizeSpeechMock,
    })),
  };
});
jest.mock('../StorageService', () => ({
  uploadAudio: jest.fn(),
}));
jest.mock('../MantraGenerator', () => ({
  formatMantraForTTS: jest.fn(() => 'formatted-mantra'),
}));
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const TextToSpeechClientMock = TextToSpeechClient as unknown as jest.Mock;

describe('TTSService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    synthesizeSpeechMock.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when TTS is not configured', () => {
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    delete process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

    expect(isTTSAvailable()).toBe(false);
  });

  it('returns true when TTS credentials are configured', () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'project';
    process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'key';
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'email';

    expect(isTTSAvailable()).toBe(true);
  });

  it('returns available voice presets', () => {
    const presets = getAvailableVoicePresets();

    expect(presets).toHaveLength(3);
    expect(presets.map((preset) => preset.id)).toEqual([
      'deep_male',
      'mystical_female',
      'neutral_calm',
    ]);
  });

  it('returns null when generateMantraAudio is called without configuration', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    delete process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

    const result = await generateMantraAudio(
      'test',
      'syllabic',
      'user-1',
      'anchor-1'
    );

    expect(result).toBeNull();
  });

  it('generates audio and uploads it when configured', async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'project';
    process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'line1\\nline2';
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'email';

    synthesizeSpeechMock.mockResolvedValue([
      { audioContent: Buffer.from('audio') },
    ]);
    (uploadAudio as jest.Mock).mockResolvedValue('https://audio.example.com/file.mp3');

    const result = await generateMantraAudio(
      'OM',
      'phonetic',
      'user-1',
      'anchor-1',
      'neutral_calm'
    );

    expect(formatMantraForTTS).toHaveBeenCalledWith('OM', 'phonetic');
    expect(TextToSpeechClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({
          private_key: 'line1\nline2',
        }),
      })
    );
    expect(result).toBe('https://audio.example.com/file.mp3');
  });

  it('throws when TTS returns no audio content', async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'project';
    process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'key';
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'email';

    synthesizeSpeechMock.mockResolvedValue([{}]);

    await expect(
      generateMantraAudio('OM', 'syllabic', 'user-1', 'anchor-1')
    ).rejects.toThrow('Failed to generate audio');
  });

  it('returns nulls for all styles when generateAllMantraAudio is not configured', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    delete process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

    const result = await generateAllMantraAudio(
      {
        syllabic: 'OM',
        rhythmic: 'OM',
        phonetic: 'om',
      },
      'user-1',
      'anchor-1'
    );

    expect(result).toEqual({
      syllabic: null,
      rhythmic: null,
      phonetic: null,
    });
  });

  it('continues when one style fails in generateAllMantraAudio', async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = 'project';
    process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'key';
    process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'email';

    synthesizeSpeechMock
      .mockResolvedValueOnce([{ audioContent: Buffer.from('audio1') }])
      .mockRejectedValueOnce(new Error('tts failure'))
      .mockResolvedValueOnce([{ audioContent: Buffer.from('audio3') }]);

    (uploadAudio as jest.Mock)
      .mockResolvedValueOnce('https://audio.example.com/1.mp3')
      .mockResolvedValueOnce('https://audio.example.com/3.mp3');

    const result = await generateAllMantraAudio(
      {
        syllabic: 'OM',
        rhythmic: 'OM',
        phonetic: 'OM',
      },
      'user-1',
      'anchor-1'
    );

    expect(result.syllabic).toBe('https://audio.example.com/1.mp3');
    expect(result.rhythmic).toBeNull();
    expect(result.phonetic).toBe('https://audio.example.com/3.mp3');
  });
});
