export const PRACTICE_MODES = ['deep_prime', 'visualize', 'focus', 'release'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const GUIDANCE_VOICES = ['female', 'male', 'none'] as const;
export type GuidanceVoice = (typeof GUIDANCE_VOICES)[number];

export const BACKGROUND_AUDIO_MODES = ['ambient', 'off'] as const;
export type BackgroundAudioMode = (typeof BACKGROUND_AUDIO_MODES)[number];

export const VISUALIZE_DURATIONS_SECONDS = [60, 180, 300] as const;
