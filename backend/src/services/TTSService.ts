/**
 * Anchor App - Text-to-Speech Service
 *
 * Generates audio files for mantras using Google Cloud Text-to-Speech.
 * Supports multiple voice configurations optimized for ritual chanting.
 */

import textToSpeech from '@google-cloud/text-to-speech';
import { formatMantraForTTS } from './MantraGenerator';
import { uploadAudio } from './StorageService';

/**
 * Voice configuration options
 */
export interface VoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  pitch?: number; // -20.0 to 20.0
  speakingRate?: number; // 0.25 to 4.0
}

/**
 * Predefined voice presets optimized for mantras
 */
export const MANTRA_VOICE_PRESETS: Record<string, VoiceConfig> = {
  deep_male: {
    languageCode: 'en-US',
    name: 'en-US-Neural2-D', // Deep male voice
    ssmlGender: 'MALE',
    pitch: -4.0, // Slightly lower for gravitas
    speakingRate: 0.85, // Slower for ritual feel
  },
  mystical_female: {
    languageCode: 'en-US',
    name: 'en-US-Neural2-F', // Clear female voice
    ssmlGender: 'FEMALE',
    pitch: 2.0, // Slightly higher for ethereal quality
    speakingRate: 0.9,
  },
  neutral_calm: {
    languageCode: 'en-US',
    name: 'en-US-Neural2-C', // Neutral voice
    ssmlGender: 'NEUTRAL',
    pitch: 0.0,
    speakingRate: 0.8, // Slow and meditative
  },
};

/**
 * Initialize Google TTS client
 */
function getTTSClient(): textToSpeech.TextToSpeechClient | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

  // TTS is optional - gracefully degrade if not configured
  if (!projectId || !privateKey || !clientEmail) {
    console.warn('[TTS] Google Cloud TTS not configured. Audio generation disabled.');
    return null;
  }

  try {
    return new textToSpeech.TextToSpeechClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      },
      projectId,
    });
  } catch (error) {
    console.error('[TTS] Failed to initialize Google TTS client:', error);
    return null;
  }
}

/**
 * Generate audio for a mantra using Google TTS
 */
export async function generateMantraAudio(
  mantraText: string,
  mantraStyle: string,
  userId: string,
  anchorId: string,
  voicePreset: keyof typeof MANTRA_VOICE_PRESETS = 'neutral_calm'
): Promise<string | null> {
  const client = getTTSClient();

  if (!client) {
    console.warn('[TTS] Audio generation skipped - service not configured');
    return null;
  }

  try {
    const voiceConfig = MANTRA_VOICE_PRESETS[voicePreset];

    // Format mantra for better TTS pronunciation
    const formattedText = formatMantraForTTS(mantraText, mantraStyle as any);

    console.log('[TTS] Generating audio for mantra:', formattedText);
    console.log('[TTS] Voice:', voiceConfig.name);

    // Build TTS request
    const request = {
      input: { text: formattedText },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
        ssmlGender: voiceConfig.ssmlGender as any,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
        pitch: voiceConfig.pitch || 0.0,
        speakingRate: voiceConfig.speakingRate || 1.0,
        volumeGainDb: 0.0,
        effectsProfileId: ['small-bluetooth-speaker-class-device'], // Optimized for mobile
      },
    };

    // Call Google TTS API
    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content returned from TTS');
    }

    // Upload to R2
    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);
    const audioUrl = await uploadAudio(audioBuffer, userId, anchorId, mantraStyle);

    console.log('[TTS] Audio generated and uploaded:', audioUrl);

    return audioUrl;
  } catch (error) {
    console.error('[TTS] Audio generation failed:', error);
    throw new Error(`Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate audio for all mantra styles
 */
export async function generateAllMantraAudio(
  mantras: {
    syllabic: string;
    rhythmic: string;
    phonetic: string;
  },
  userId: string,
  anchorId: string,
  voicePreset: keyof typeof MANTRA_VOICE_PRESETS = 'neutral_calm'
): Promise<Record<string, string | null>> {
  const client = getTTSClient();

  if (!client) {
    console.warn('[TTS] Audio generation skipped - service not configured');
    return {
      syllabic: null,
      rhythmic: null,
      phonetic: null,
    };
  }

  const audioUrls: Record<string, string | null> = {};

  // Generate audio for each style
  for (const [style, text] of Object.entries(mantras)) {
    try {
      const url = await generateMantraAudio(text, style, userId, anchorId, voicePreset);
      audioUrls[style] = url;
    } catch (error) {
      console.error(`[TTS] Failed to generate audio for ${style}:`, error);
      audioUrls[style] = null; // Graceful degradation
    }
  }

  return audioUrls;
}

/**
 * Check if TTS is configured and available
 */
export function isTTSAvailable(): boolean {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

  return !!(projectId && privateKey && clientEmail);
}

/**
 * Get available voice presets
 */
export function getAvailableVoicePresets(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [
    {
      id: 'deep_male',
      name: 'Deep Male',
      description: 'Powerful and grounding. Best for strength and protection intentions.',
    },
    {
      id: 'mystical_female',
      name: 'Mystical Female',
      description: 'Ethereal and flowing. Best for love and intuition intentions.',
    },
    {
      id: 'neutral_calm',
      name: 'Calm Neutral',
      description: 'Balanced and meditative. Best for clarity and focus intentions.',
    },
  ];
}
