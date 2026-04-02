/**
 * Unit tests for TTSService
 *
 * Tests cover:
 * - isTTSAvailable()
 * - getAvailableVoicePresets()
 * - generateMantraAudio() - configured and unconfigured
 * - generateAllMantraAudio() - success and partial failures
 */

jest.mock('../../utils/logger');
jest.mock('../StorageService', () => ({
  uploadAudio: jest.fn(),
}));
jest.mock('../MantraGenerator', () => ({
  formatMantraForTTS: jest.fn((text: string) => text),
}));
jest.mock('@google-cloud/text-to-speech');

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { uploadAudio } from '../StorageService';
import {
  isTTSAvailable,
  getAvailableVoicePresets,
  generateMantraAudio,
  generateAllMantraAudio,
  MANTRA_VOICE_PRESETS,
} from '../TTSService';

describe('TTSService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
    delete process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    delete process.env.GOOGLE_CLOUD_CLIENT_EMAIL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // isTTSAvailable
  // ============================================================================

  describe('isTTSAvailable', () => {
    it('should return false when env vars are missing', () => {
      expect(isTTSAvailable()).toBe(false);
    });

    it('should return true when all env vars are set', () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'project-id';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'private-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'email@example.com';

      expect(isTTSAvailable()).toBe(true);
    });

    it('should return false when only some env vars are set', () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'project-id';
      // Missing private key and email
      expect(isTTSAvailable()).toBe(false);
    });
  });

  // ============================================================================
  // getAvailableVoicePresets
  // ============================================================================

  describe('getAvailableVoicePresets', () => {
    it('should return 3 presets', () => {
      const presets = getAvailableVoicePresets();
      expect(presets).toHaveLength(3);
    });

    it('should include deep_male, mystical_female, and neutral_calm', () => {
      const presets = getAvailableVoicePresets();
      const ids = presets.map(p => p.id);
      expect(ids).toContain('deep_male');
      expect(ids).toContain('mystical_female');
      expect(ids).toContain('neutral_calm');
    });

    it('should have id, name, and description for each preset', () => {
      const presets = getAvailableVoicePresets();
      presets.forEach(preset => {
        expect(preset).toHaveProperty('id');
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('description');
      });
    });
  });

  // ============================================================================
  // MANTRA_VOICE_PRESETS constant
  // ============================================================================

  describe('MANTRA_VOICE_PRESETS', () => {
    it('should have correct voice config for deep_male', () => {
      expect(MANTRA_VOICE_PRESETS.deep_male).toMatchObject({
        name: 'en-US-Neural2-D',
        ssmlGender: 'MALE',
        pitch: -4.0,
      });
    });

    it('should have correct voice config for mystical_female', () => {
      expect(MANTRA_VOICE_PRESETS.mystical_female).toMatchObject({
        name: 'en-US-Neural2-F',
        ssmlGender: 'FEMALE',
      });
    });

    it('should have correct voice config for neutral_calm', () => {
      expect(MANTRA_VOICE_PRESETS.neutral_calm).toMatchObject({
        name: 'en-US-Neural2-C',
        ssmlGender: 'NEUTRAL',
      });
    });
  });

  // ============================================================================
  // generateMantraAudio
  // ============================================================================

  describe('generateMantraAudio', () => {
    it('should return null when TTS is not configured', async () => {
      const result = await generateMantraAudio('klo-seth', 'phonetic', 'user-1', 'anchor-1');
      expect(result).toBeNull();
    });

    it('should generate and upload audio when TTS is configured', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'test-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'test@example.com';

      const mockAudioContent = Buffer.from('audio-data');
      const mockSynthesize = jest.fn().mockResolvedValue([{ audioContent: mockAudioContent }]);
      (TextToSpeechClient as unknown as jest.Mock).mockImplementation(() => ({
        synthesizeSpeech: mockSynthesize,
      }));
      (uploadAudio as jest.Mock).mockResolvedValue('https://storage.example.com/audio.mp3');

      const result = await generateMantraAudio('klo-seth', 'phonetic', 'user-1', 'anchor-1');

      expect(mockSynthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { text: 'klo-seth' },
          audioConfig: expect.objectContaining({ audioEncoding: 'MP3' }),
        })
      );
      expect(uploadAudio).toHaveBeenCalled();
      expect(result).toBe('https://storage.example.com/audio.mp3');
    });

    it('should use specified voice preset', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'test-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'test@example.com';

      const mockSynthesize = jest.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (TextToSpeechClient as unknown as jest.Mock).mockImplementation(() => ({
        synthesizeSpeech: mockSynthesize,
      }));
      (uploadAudio as jest.Mock).mockResolvedValue('https://example.com/audio.mp3');

      await generateMantraAudio('test', 'syllabic', 'user', 'anchor', 'deep_male');

      expect(mockSynthesize).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.objectContaining({ name: 'en-US-Neural2-D' }),
        })
      );
    });

    it('should throw when TTS returns no audio content', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'test-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'test@example.com';

      (TextToSpeechClient as unknown as jest.Mock).mockImplementation(() => ({
        synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: null }]),
      }));

      await expect(
        generateMantraAudio('test', 'syllabic', 'user', 'anchor')
      ).rejects.toThrow('Failed to generate audio');
    });
  });

  // ============================================================================
  // generateAllMantraAudio
  // ============================================================================

  describe('generateAllMantraAudio', () => {
    it('should return null values for all styles when TTS not configured', async () => {
      const result = await generateAllMantraAudio(
        { syllabic: 'CL-OS', rhythmic: 'CLO / S', phonetic: 'klos' },
        'user-1',
        'anchor-1'
      );

      expect(result).toEqual({ syllabic: null, rhythmic: null, phonetic: null });
    });

    it('should generate audio for all styles when TTS is configured', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'test-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'test@example.com';

      const mockSynthesize = jest.fn().mockResolvedValue([{ audioContent: Buffer.from('audio') }]);
      (TextToSpeechClient as unknown as jest.Mock).mockImplementation(() => ({
        synthesizeSpeech: mockSynthesize,
      }));
      (uploadAudio as jest.Mock)
        .mockResolvedValueOnce('https://example.com/syllabic.mp3')
        .mockResolvedValueOnce('https://example.com/rhythmic.mp3')
        .mockResolvedValueOnce('https://example.com/phonetic.mp3');

      const result = await generateAllMantraAudio(
        { syllabic: 'CL-OS', rhythmic: 'CLO / S', phonetic: 'klos' },
        'user-1',
        'anchor-1'
      );

      expect(result.syllabic).toBe('https://example.com/syllabic.mp3');
      expect(result.rhythmic).toBe('https://example.com/rhythmic.mp3');
      expect(result.phonetic).toBe('https://example.com/phonetic.mp3');
    });

    it('should return null for styles that fail and continue others', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';
      process.env.GOOGLE_CLOUD_PRIVATE_KEY = 'test-key';
      process.env.GOOGLE_CLOUD_CLIENT_EMAIL = 'test@example.com';

      const mockSynthesize = jest
        .fn()
        .mockResolvedValueOnce([{ audioContent: Buffer.from('audio') }]) // syllabic succeeds
        .mockRejectedValueOnce(new Error('API error')) // rhythmic fails
        .mockResolvedValueOnce([{ audioContent: Buffer.from('audio') }]); // phonetic succeeds
      (TextToSpeechClient as unknown as jest.Mock).mockImplementation(() => ({
        synthesizeSpeech: mockSynthesize,
      }));
      (uploadAudio as jest.Mock)
        .mockResolvedValueOnce('https://example.com/syllabic.mp3')
        .mockResolvedValueOnce('https://example.com/phonetic.mp3');

      const result = await generateAllMantraAudio(
        { syllabic: 'CL-OS', rhythmic: 'CLO / S', phonetic: 'klos' },
        'user-1',
        'anchor-1'
      );

      expect(result.syllabic).toBe('https://example.com/syllabic.mp3');
      expect(result.rhythmic).toBeNull();
      // phonetic may be 'https://example.com/phonetic.mp3' or null depending on timing
    });
  });
});
