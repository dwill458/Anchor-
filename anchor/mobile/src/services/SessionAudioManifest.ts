import type { AudioSource } from 'expo-audio';
import type {
  GuidanceVoice,
  SessionAudioConfiguration,
  SessionAudioDefaults,
  SessionAudioSessionType,
} from '@/types/sessionAudio';
import {
  VISUALIZE_AUDIO_MANIFEST,
  VISUALIZE_CUES,
  VISUALIZE_DURATIONS_SECONDS,
} from '@/services/visualizeAudioManifest';

export const SESSION_AUDIO_LOCALE = 'en-US';
export const VISUALIZE_VOICE_PLAYBACK_GAIN = 0.19;

export type AudioAssetReference = AudioSource;

export interface SessionVoiceCue {
  phaseId: string;
  triggerAtRemainingMs: number;
}

export interface GuidedAudioTrack {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  phaseId: string;
  voice: Exclude<GuidanceVoice, 'none'>;
  locale: string;
  asset: AudioAssetReference;
  /** Linear playback gain used to loudness-match this recording to the reference voice. */
  playbackGain: number;
  version: number;
}

export interface AmbientAudioTrack {
  sessionType: SessionAudioSessionType;
  durationSeconds?: number;
  locale: string;
  asset: AudioAssetReference;
  version: number;
}

export interface VoicePreviewTrack {
  voice: Exclude<GuidanceVoice, 'none'>;
  locale: string;
  asset: AudioAssetReference;
  playbackGain: number;
  version: number;
}

type SessionCueSheet = {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale: string;
  cues: readonly SessionVoiceCue[];
};

const focus10 = require('../assets/sounds/focus-session-10s.mp3');
const focus30Start = require('../assets/sounds/focus-session-30s-start.mp3');
const focus30End = require('../assets/sounds/focus-session-30s-end.mp3');
const focus60Start = require('../assets/sounds/focus-session-60s-start.mp3');
const focus60Middle = require('../assets/sounds/focus-session-60s-middle.mp3');
const focus60End = require('../assets/sounds/focus-session-60s-end.mp3');
const focus120Opening = require('../assets/sounds/focus-session-120s-opening.mp3');
const focus120Grounding = require('../assets/sounds/focus-session-120s-grounding.mp3');
const focus120Deepening = require('../assets/sounds/focus-session-120s-deepening.mp3');
const focus120Closing = require('../assets/sounds/focus-session-120s-closing.mp3');
const focusAmbient = require('../assets/sounds/focus-session-ambient.mp3');

const deep2Opening = require('../assets/sounds/deep-prime-2m-opening.mp3');
const deep2Intention = require('../assets/sounds/deep-prime-2m-intention.mp3');
const deep2Deepening = require('../assets/sounds/deep-prime-2m-deepening.mp3');
const deep2Closing = require('../assets/sounds/deep-prime-2m-closing.mp3');
const deep5Opening = require('../assets/sounds/deep-prime-5m-opening.mp3');
const deep5Intention = require('../assets/sounds/deep-prime-5m-intention.mp3');
const deep5Deepening = require('../assets/sounds/deep-prime-5m-deepening.mp3');
const deep5Return = require('../assets/sounds/deep-prime-5m-return.mp3');
const deep5Reinforcement = require('../assets/sounds/deep-prime-5m-reinforcement.mp3');
const deep5Closing = require('../assets/sounds/deep-prime-5m-closing.mp3');
const deep10Opening = require('../assets/sounds/deep-prime-10m-opening.mp3');
const deep10Intention = require('../assets/sounds/deep-prime-10m-intention.mp3');
const deep10Deepening = require('../assets/sounds/deep-prime-10m-deepening.mp3');
const deep10Return = require('../assets/sounds/deep-prime-10m-return.mp3');
const deep10Reinforcement = require('../assets/sounds/deep-prime-10m-reinforcement.mp3');
const deep10Visualization = require('../assets/sounds/deep-prime-10m-visualization.mp3');
const deep10Settling = require('../assets/sounds/deep-prime-10m-settling.mp3');
const deep10Closing = require('../assets/sounds/deep-prime-10m-closing.mp3');
const deep15Opening = require('../assets/sounds/deep-prime-15m-opening.mp3');
const deep15Intention = require('../assets/sounds/deep-prime-15m-intention.mp3');
const deep15Deepening = require('../assets/sounds/deep-prime-15m-deepening.mp3');
const deep15Return = require('../assets/sounds/deep-prime-15m-return.mp3');
const deep15Reinforcement = require('../assets/sounds/deep-prime-15m-reinforcement.mp3');
const deep15Visualization = require('../assets/sounds/deep-prime-15m-visualization.mp3');
const deep15Settling = require('../assets/sounds/deep-prime-15m-settling.mp3');
const deep15Closing = require('../assets/sounds/deep-prime-15m-closing.mp3');
const deepAmbient = require('../assets/sounds/deep-prime-ambient.mp3');

const maleFocus10 = require('../assets/sounds/voices/male/en-US/focus-session-10s.mp3');
const maleFocus30Start = require('../assets/sounds/voices/male/en-US/focus-session-30s-start.mp3');
const maleFocus30End = require('../assets/sounds/voices/male/en-US/focus-session-30s-end.mp3');
const maleFocus60Start = require('../assets/sounds/voices/male/en-US/focus-session-60s-start.mp3');
const maleFocus60Middle = require('../assets/sounds/voices/male/en-US/focus-session-60s-middle.mp3');
const maleFocus60End = require('../assets/sounds/voices/male/en-US/focus-session-60s-end.mp3');
const maleFocus120Opening = require('../assets/sounds/voices/male/en-US/focus-session-120s-opening.mp3');
const maleFocus120Grounding = require('../assets/sounds/voices/male/en-US/focus-session-120s-grounding.mp3');
const maleFocus120Deepening = require('../assets/sounds/voices/male/en-US/focus-session-120s-deepening.mp3');
const maleFocus120Closing = require('../assets/sounds/voices/male/en-US/focus-session-120s-closing.mp3');
const maleDeep2Opening = require('../assets/sounds/voices/male/en-US/deep-prime-2m-opening.mp3');
const maleDeep2Intention = require('../assets/sounds/voices/male/en-US/deep-prime-2m-intention.mp3');
const maleDeep2Deepening = require('../assets/sounds/voices/male/en-US/deep-prime-2m-deepening.mp3');
const maleDeep2Closing = require('../assets/sounds/voices/male/en-US/deep-prime-2m-closing.mp3');
const maleDeep5Opening = require('../assets/sounds/voices/male/en-US/deep-prime-5m-opening.mp3');
const maleDeep5Intention = require('../assets/sounds/voices/male/en-US/deep-prime-5m-intention.mp3');
const maleDeep5Deepening = require('../assets/sounds/voices/male/en-US/deep-prime-5m-deepening.mp3');
const maleDeep5Return = require('../assets/sounds/voices/male/en-US/deep-prime-5m-return.mp3');
const maleDeep5Reinforcement = require('../assets/sounds/voices/male/en-US/deep-prime-5m-reinforcement.mp3');
const maleDeep5Closing = require('../assets/sounds/voices/male/en-US/deep-prime-5m-closing.mp3');
const maleDeep10Opening = require('../assets/sounds/voices/male/en-US/deep-prime-10m-opening.mp3');
const maleDeep10Intention = require('../assets/sounds/voices/male/en-US/deep-prime-10m-intention.mp3');
const maleDeep10Deepening = require('../assets/sounds/voices/male/en-US/deep-prime-10m-deepening.mp3');
const maleDeep10Return = require('../assets/sounds/voices/male/en-US/deep-prime-10m-return.mp3');
const maleDeep10Reinforcement = require('../assets/sounds/voices/male/en-US/deep-prime-10m-reinforcement.mp3');
const maleDeep10Visualization = require('../assets/sounds/voices/male/en-US/deep-prime-10m-visualization.mp3');
const maleDeep10Settling = require('../assets/sounds/voices/male/en-US/deep-prime-10m-settling.mp3');
const maleDeep10Closing = require('../assets/sounds/voices/male/en-US/deep-prime-10m-closing.mp3');
const maleDeep15Opening = require('../assets/sounds/voices/male/en-US/deep-prime-15m-opening.mp3');
const maleDeep15Intention = require('../assets/sounds/voices/male/en-US/deep-prime-15m-intention.mp3');
const maleDeep15Deepening = require('../assets/sounds/voices/male/en-US/deep-prime-15m-deepening.mp3');
const maleDeep15Return = require('../assets/sounds/voices/male/en-US/deep-prime-15m-return.mp3');
const maleDeep15Reinforcement = require('../assets/sounds/voices/male/en-US/deep-prime-15m-reinforcement.mp3');
const maleDeep15Visualization = require('../assets/sounds/voices/male/en-US/deep-prime-15m-visualization.mp3');
const maleDeep15Settling = require('../assets/sounds/voices/male/en-US/deep-prime-15m-settling.mp3');
const maleDeep15Closing = require('../assets/sounds/voices/male/en-US/deep-prime-15m-closing.mp3');

const cueSheet = (
  sessionType: SessionAudioSessionType,
  durationSeconds: number,
  cues: readonly SessionVoiceCue[]
): SessionCueSheet => ({
  sessionType,
  durationSeconds,
  locale: SESSION_AUDIO_LOCALE,
  cues,
});

export const SESSION_VOICE_CUE_SHEETS: readonly SessionCueSheet[] = [
  cueSheet('focus', 10, [{ phaseId: 'start', triggerAtRemainingMs: 10_000 }]),
  cueSheet('focus', 30, [
    { phaseId: 'start', triggerAtRemainingMs: 30_000 },
    { phaseId: 'end', triggerAtRemainingMs: 6_300 },
  ]),
  cueSheet('focus', 60, [
    { phaseId: 'start', triggerAtRemainingMs: 60_000 },
    { phaseId: 'middle', triggerAtRemainingMs: 32_415 },
    { phaseId: 'end', triggerAtRemainingMs: 5_980 },
  ]),
  cueSheet('focus', 90, [
    { phaseId: 'start', triggerAtRemainingMs: 90_000 },
    { phaseId: 'middle', triggerAtRemainingMs: 45_000 },
    { phaseId: 'end', triggerAtRemainingMs: 5_000 },
  ]),
  cueSheet('focus', 120, [
    { phaseId: 'start', triggerAtRemainingMs: 120_000 },
    { phaseId: 'grounding', triggerAtRemainingMs: 80_000 },
    { phaseId: 'deepening', triggerAtRemainingMs: 40_000 },
    { phaseId: 'end', triggerAtRemainingMs: 5_000 },
  ]),
  cueSheet('deep_prime', 120, [
    { phaseId: 'opening', triggerAtRemainingMs: 120_000 },
    { phaseId: 'intention', triggerAtRemainingMs: 90_000 },
    { phaseId: 'deepening', triggerAtRemainingMs: 50_000 },
    { phaseId: 'closing', triggerAtRemainingMs: 10_000 },
  ]),
  cueSheet('deep_prime', 300, [
    { phaseId: 'opening', triggerAtRemainingMs: 300_000 },
    { phaseId: 'intention', triggerAtRemainingMs: 265_000 },
    { phaseId: 'deepening', triggerAtRemainingMs: 200_000 },
    { phaseId: 'return', triggerAtRemainingMs: 135_000 },
    { phaseId: 'reinforcement', triggerAtRemainingMs: 60_000 },
    { phaseId: 'closing', triggerAtRemainingMs: 10_000 },
  ]),
  cueSheet('deep_prime', 600, [
    { phaseId: 'opening', triggerAtRemainingMs: 600_000 },
    { phaseId: 'intention', triggerAtRemainingMs: 555_000 },
    { phaseId: 'deepening', triggerAtRemainingMs: 480_000 },
    { phaseId: 'return', triggerAtRemainingMs: 390_000 },
    { phaseId: 'reinforcement', triggerAtRemainingMs: 300_000 },
    { phaseId: 'visualization', triggerAtRemainingMs: 210_000 },
    { phaseId: 'settling', triggerAtRemainingMs: 105_000 },
    { phaseId: 'closing', triggerAtRemainingMs: 15_000 },
  ]),
  cueSheet('deep_prime', 900, [
    { phaseId: 'opening', triggerAtRemainingMs: 900_000 },
    { phaseId: 'intention', triggerAtRemainingMs: 832_500 },
    { phaseId: 'deepening', triggerAtRemainingMs: 720_000 },
    { phaseId: 'return', triggerAtRemainingMs: 585_000 },
    { phaseId: 'reinforcement', triggerAtRemainingMs: 450_000 },
    { phaseId: 'visualization', triggerAtRemainingMs: 315_000 },
    { phaseId: 'settling', triggerAtRemainingMs: 157_500 },
    { phaseId: 'closing', triggerAtRemainingMs: 22_500 },
  ]),
  ...VISUALIZE_DURATIONS_SECONDS.map(durationSeconds =>
    cueSheet(
      'visualize',
      durationSeconds,
      VISUALIZE_AUDIO_MANIFEST[durationSeconds].cues.map(cueDefinition => ({
        phaseId: cueDefinition.id,
        triggerAtRemainingMs: (durationSeconds - cueDefinition.startSeconds) * 1_000,
      })),
    ),
  ),
];

const femaleTrack = (
  sessionType: SessionAudioSessionType,
  durationSeconds: number,
  phaseId: string,
  asset: AudioAssetReference,
  playbackGain = 1,
): GuidedAudioTrack => ({
  sessionType,
  durationSeconds,
  phaseId,
  voice: 'female',
  locale: SESSION_AUDIO_LOCALE,
  asset,
  playbackGain,
  version: 1,
});

const maleTrack = (
  sessionType: SessionAudioSessionType,
  durationSeconds: number,
  phaseId: string,
  asset: AudioAssetReference,
  playbackGain: number
): GuidedAudioTrack => ({
  sessionType,
  durationSeconds,
  phaseId,
  voice: 'male',
  locale: SESSION_AUDIO_LOCALE,
  asset,
  playbackGain,
  version: 1,
});

export const GUIDED_AUDIO_MANIFEST: readonly GuidedAudioTrack[] = [
  femaleTrack('focus', 10, 'start', focus10),
  femaleTrack('focus', 30, 'start', focus30Start),
  femaleTrack('focus', 30, 'end', focus30End),
  femaleTrack('focus', 60, 'start', focus60Start),
  femaleTrack('focus', 60, 'middle', focus60Middle),
  femaleTrack('focus', 60, 'end', focus60End),
  femaleTrack('focus', 90, 'start', focus60Start),
  femaleTrack('focus', 90, 'middle', focus60Middle),
  femaleTrack('focus', 90, 'end', focus60End),
  femaleTrack('focus', 120, 'start', focus120Opening),
  femaleTrack('focus', 120, 'grounding', focus120Grounding),
  femaleTrack('focus', 120, 'deepening', focus120Deepening),
  femaleTrack('focus', 120, 'end', focus120Closing),
  femaleTrack('deep_prime', 120, 'opening', deep2Opening),
  femaleTrack('deep_prime', 120, 'intention', deep2Intention),
  femaleTrack('deep_prime', 120, 'deepening', deep2Deepening),
  femaleTrack('deep_prime', 120, 'closing', deep2Closing),
  femaleTrack('deep_prime', 300, 'opening', deep5Opening),
  femaleTrack('deep_prime', 300, 'intention', deep5Intention),
  femaleTrack('deep_prime', 300, 'deepening', deep5Deepening),
  femaleTrack('deep_prime', 300, 'return', deep5Return),
  femaleTrack('deep_prime', 300, 'reinforcement', deep5Reinforcement),
  femaleTrack('deep_prime', 300, 'closing', deep5Closing),
  femaleTrack('deep_prime', 600, 'opening', deep10Opening),
  femaleTrack('deep_prime', 600, 'intention', deep10Intention),
  femaleTrack('deep_prime', 600, 'deepening', deep10Deepening),
  femaleTrack('deep_prime', 600, 'return', deep10Return),
  femaleTrack('deep_prime', 600, 'reinforcement', deep10Reinforcement),
  femaleTrack('deep_prime', 600, 'visualization', deep10Visualization),
  femaleTrack('deep_prime', 600, 'settling', deep10Settling),
  femaleTrack('deep_prime', 600, 'closing', deep10Closing),
  femaleTrack('deep_prime', 900, 'opening', deep15Opening),
  femaleTrack('deep_prime', 900, 'intention', deep15Intention),
  femaleTrack('deep_prime', 900, 'deepening', deep15Deepening),
  femaleTrack('deep_prime', 900, 'return', deep15Return),
  femaleTrack('deep_prime', 900, 'reinforcement', deep15Reinforcement),
  femaleTrack('deep_prime', 900, 'visualization', deep15Visualization),
  femaleTrack('deep_prime', 900, 'settling', deep15Settling),
  femaleTrack('deep_prime', 900, 'closing', deep15Closing),
  maleTrack('focus', 10, 'start', maleFocus10, 0.371),
  maleTrack('focus', 30, 'start', maleFocus30Start, 0.415),
  maleTrack('focus', 30, 'end', maleFocus30End, 0.305),
  maleTrack('focus', 60, 'start', maleFocus60Start, 0.447),
  maleTrack('focus', 60, 'middle', maleFocus60Middle, 0.477),
  maleTrack('focus', 60, 'end', maleFocus60End, 0.356),
  maleTrack('focus', 90, 'start', maleFocus60Start, 0.447),
  maleTrack('focus', 90, 'middle', maleFocus60Middle, 0.477),
  maleTrack('focus', 90, 'end', maleFocus60End, 0.356),
  maleTrack('focus', 120, 'start', maleFocus120Opening, 0.415),
  maleTrack('focus', 120, 'grounding', maleFocus120Grounding, 0.381),
  maleTrack('focus', 120, 'deepening', maleFocus120Deepening, 0.472),
  maleTrack('focus', 120, 'end', maleFocus120Closing, 0.305),
  maleTrack('deep_prime', 120, 'opening', maleDeep2Opening, 0.46),
  maleTrack('deep_prime', 120, 'intention', maleDeep2Intention, 0.491),
  maleTrack('deep_prime', 120, 'deepening', maleDeep2Deepening, 0.37),
  maleTrack('deep_prime', 120, 'closing', maleDeep2Closing, 0.443),
  maleTrack('deep_prime', 300, 'opening', maleDeep5Opening, 0.413),
  maleTrack('deep_prime', 300, 'intention', maleDeep5Intention, 0.491),
  maleTrack('deep_prime', 300, 'deepening', maleDeep5Deepening, 0.37),
  maleTrack('deep_prime', 300, 'return', maleDeep5Return, 0.479),
  maleTrack('deep_prime', 300, 'reinforcement', maleDeep5Reinforcement, 0.371),
  maleTrack('deep_prime', 300, 'closing', maleDeep5Closing, 0.305),
  maleTrack('deep_prime', 600, 'opening', maleDeep10Opening, 0.413),
  maleTrack('deep_prime', 600, 'intention', maleDeep10Intention, 0.491),
  maleTrack('deep_prime', 600, 'deepening', maleDeep10Deepening, 0.37),
  maleTrack('deep_prime', 600, 'return', maleDeep10Return, 0.479),
  maleTrack('deep_prime', 600, 'reinforcement', maleDeep10Reinforcement, 0.371),
  maleTrack('deep_prime', 600, 'visualization', maleDeep10Visualization, 0.371),
  maleTrack('deep_prime', 600, 'settling', maleDeep10Settling, 0.411),
  maleTrack('deep_prime', 600, 'closing', maleDeep10Closing, 0.305),
  maleTrack('deep_prime', 900, 'opening', maleDeep15Opening, 0.413),
  maleTrack('deep_prime', 900, 'intention', maleDeep15Intention, 0.491),
  maleTrack('deep_prime', 900, 'deepening', maleDeep15Deepening, 0.37),
  maleTrack('deep_prime', 900, 'return', maleDeep15Return, 0.479),
  maleTrack('deep_prime', 900, 'reinforcement', maleDeep15Reinforcement, 0.371),
  maleTrack('deep_prime', 900, 'visualization', maleDeep15Visualization, 0.371),
  maleTrack('deep_prime', 900, 'settling', maleDeep15Settling, 0.411),
  maleTrack('deep_prime', 900, 'closing', maleDeep15Closing, 0.305),
  ...VISUALIZE_CUES.flatMap(cueDefinition => [
    femaleTrack(
      'visualize',
      cueDefinition.durationSeconds,
      cueDefinition.id,
      cueDefinition.femaleAsset,
      VISUALIZE_VOICE_PLAYBACK_GAIN,
    ),
    maleTrack(
      'visualize',
      cueDefinition.durationSeconds,
      cueDefinition.id,
      cueDefinition.maleAsset,
      VISUALIZE_VOICE_PLAYBACK_GAIN,
    ),
  ]),
];

export const AMBIENT_AUDIO_MANIFEST: readonly AmbientAudioTrack[] = [
  {
    sessionType: 'focus',
    locale: SESSION_AUDIO_LOCALE,
    asset: focusAmbient,
    version: 1,
  },
  {
    sessionType: 'deep_prime',
    locale: SESSION_AUDIO_LOCALE,
    asset: deepAmbient,
    version: 1,
  },
  {
    sessionType: 'visualize', durationSeconds: 60, locale: SESSION_AUDIO_LOCALE,
    asset: VISUALIZE_AUDIO_MANIFEST[60].ambient.asset, version: 1,
  },
  {
    sessionType: 'visualize', durationSeconds: 180, locale: SESSION_AUDIO_LOCALE,
    asset: VISUALIZE_AUDIO_MANIFEST[180].ambient.asset, version: 1,
  },
  {
    sessionType: 'visualize', durationSeconds: 300, locale: SESSION_AUDIO_LOCALE,
    asset: VISUALIZE_AUDIO_MANIFEST[300].ambient.asset, version: 1,
  },
];

export const VOICE_PREVIEW_MANIFEST: readonly VoicePreviewTrack[] = [
  {
    voice: 'female',
    locale: SESSION_AUDIO_LOCALE,
    asset: focus30Start,
    playbackGain: 1,
    version: 1,
  },
  {
    voice: 'male',
    locale: SESSION_AUDIO_LOCALE,
    asset: maleFocus30Start,
    playbackGain: 0.415,
    version: 1,
  },
];

export type VoiceAvailabilityResult =
  | {
      available: true;
      cueSheet: SessionCueSheet;
      tracks: readonly GuidedAudioTrack[];
    }
  | {
      available: false;
      reason: 'no_voice_requested' | 'cue_sheet_missing' | 'required_clips_missing';
      missingPhaseIds: readonly string[];
    };

export const getSessionVoiceCueSheet = (params: {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale?: string;
}): SessionCueSheet | null => {
  const locale = params.locale ?? SESSION_AUDIO_LOCALE;
  return (
    SESSION_VOICE_CUE_SHEETS.find(
      (sheet) =>
        sheet.sessionType === params.sessionType &&
        sheet.durationSeconds === params.durationSeconds &&
        sheet.locale === locale
    ) ?? null
  );
};

export const lookupVoiceTracks = (params: {
  voice: GuidanceVoice;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale?: string;
}): VoiceAvailabilityResult => {
  if (params.voice === 'none') {
    return {
      available: false,
      reason: 'no_voice_requested',
      missingPhaseIds: [],
    };
  }

  const locale = params.locale ?? SESSION_AUDIO_LOCALE;
  const cueSheet = getSessionVoiceCueSheet({ ...params, locale });
  if (!cueSheet) {
    return {
      available: false,
      reason: 'cue_sheet_missing',
      missingPhaseIds: [],
    };
  }

  const tracks = GUIDED_AUDIO_MANIFEST.filter(
    (track) =>
      track.sessionType === params.sessionType &&
      track.durationSeconds === params.durationSeconds &&
      track.voice === params.voice &&
      track.locale === locale
  );
  const trackPhases = new Set(tracks.map((track) => track.phaseId));
  const missingPhaseIds = cueSheet.cues
    .map((cue) => cue.phaseId)
    .filter((phaseId) => !trackPhases.has(phaseId));

  return missingPhaseIds.length === 0
    ? { available: true, cueSheet, tracks }
    : { available: false, reason: 'required_clips_missing', missingPhaseIds };
};

export const isVoiceAvailable = (params: {
  voice: GuidanceVoice;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale?: string;
}): boolean =>
  params.voice === 'none' || lookupVoiceTracks(params).available;

export const lookupAmbientTrack = (params: {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale?: string;
}): AmbientAudioTrack | null => {
  const locale = params.locale ?? SESSION_AUDIO_LOCALE;
  return (
    AMBIENT_AUDIO_MANIFEST.find(
      (track) =>
        track.sessionType === params.sessionType &&
        track.durationSeconds === params.durationSeconds &&
        track.locale === locale
    ) ??
    AMBIENT_AUDIO_MANIFEST.find(
      (track) =>
        track.sessionType === params.sessionType &&
        track.durationSeconds == null &&
        track.locale === locale
    ) ??
    null
  );
};

export const lookupVoicePreviewTrack = (
  voice: GuidanceVoice,
  locale: string = SESSION_AUDIO_LOCALE
): VoicePreviewTrack | null =>
  voice === 'none'
    ? null
    : VOICE_PREVIEW_MANIFEST.find(
        (track) => track.voice === voice && track.locale === locale
      ) ?? null;

export interface ResolvedVoiceCue extends SessionVoiceCue {
  track: GuidedAudioTrack;
}

export interface ResolvedSessionAudioPlan {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  locale: string;
  requestedConfiguration: SessionAudioConfiguration;
  configuration: SessionAudioConfiguration;
  voiceCues: readonly ResolvedVoiceCue[];
  ambientTrack: AmbientAudioTrack | null;
  shouldPlayVoice: boolean;
  shouldPlayAmbient: boolean;
  fallbackUsed: boolean;
  fallbackReasons: readonly ('voice_unavailable' | 'ambient_unavailable')[];
}

export const resolveSessionAudioPlan = (params: {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  configuration: SessionAudioConfiguration;
  locale?: string;
}): ResolvedSessionAudioPlan => {
  const locale = params.locale ?? SESSION_AUDIO_LOCALE;
  const fallbackReasons: Array<'voice_unavailable' | 'ambient_unavailable'> = [];
  const voiceLookup = lookupVoiceTracks({
    voice: params.configuration.guidanceVoice,
    sessionType: params.sessionType,
    durationSeconds: params.durationSeconds,
    locale,
  });
  const voiceAvailable =
    params.configuration.guidanceVoice === 'none' || voiceLookup.available;
  if (!voiceAvailable) {
    fallbackReasons.push('voice_unavailable');
  }

  const ambientTrack =
    params.configuration.backgroundAudio === 'ambient'
      ? lookupAmbientTrack({
          sessionType: params.sessionType,
          durationSeconds: params.durationSeconds,
          locale,
        })
      : null;
  if (params.configuration.backgroundAudio === 'ambient' && !ambientTrack) {
    fallbackReasons.push('ambient_unavailable');
  }

  const configuration: SessionAudioConfiguration = {
    ...params.configuration,
    guidanceVoice: voiceAvailable ? params.configuration.guidanceVoice : 'none',
    backgroundAudio: ambientTrack ? params.configuration.backgroundAudio : 'off',
  };
  const voiceCues: ResolvedVoiceCue[] =
    configuration.guidanceVoice !== 'none' && voiceLookup.available
      ? voiceLookup.cueSheet.cues.map((cue) => ({
          ...cue,
          track: voiceLookup.tracks.find((track) => track.phaseId === cue.phaseId)!,
        }))
      : [];

  return {
    sessionType: params.sessionType,
    durationSeconds: params.durationSeconds,
    locale,
    requestedConfiguration: { ...params.configuration },
    configuration,
    voiceCues,
    ambientTrack,
    shouldPlayVoice: configuration.guidanceVoice !== 'none' && voiceCues.length > 0,
    shouldPlayAmbient: configuration.backgroundAudio === 'ambient' && ambientTrack != null,
    fallbackUsed: fallbackReasons.length > 0,
    fallbackReasons,
  };
};

export const isSessionAudioSelectionAvailable = (params: {
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  defaults: SessionAudioDefaults;
  locale?: string;
}): boolean =>
  isVoiceAvailable({
    voice: params.defaults.guidanceVoice,
    sessionType: params.sessionType,
    durationSeconds: params.durationSeconds,
    locale: params.locale,
  }) &&
  (params.defaults.backgroundAudio === 'off' ||
    lookupAmbientTrack(params) != null);

export const getGuidedAudioTrackId = (track: GuidedAudioTrack): string => {
  if (track.sessionType === 'visualize') {
    return `${track.phaseId.toLowerCase()}-${track.voice}`;
  }
  const voiceSuffix = track.voice === 'male' ? '-male' : '';
  if (track.sessionType === 'deep_prime') {
    return `deep-prime-${track.durationSeconds / 60}m-${track.phaseId}${voiceSuffix}`;
  }
  if (track.durationSeconds === 10) return `focus-session-10s${voiceSuffix}`;
  const assetDuration = track.durationSeconds === 90 ? 60 : track.durationSeconds;
  const phase =
    assetDuration === 120 && track.phaseId === 'start'
      ? 'opening'
      : assetDuration === 120 && track.phaseId === 'end'
        ? 'closing'
        : track.phaseId;
  return `focus-session-${assetDuration}s-${phase}${voiceSuffix}`;
};

export const getAmbientAudioTrackId = (track: AmbientAudioTrack): string =>
  track.sessionType === 'focus'
    ? 'focus-session-ambient'
    : track.sessionType === 'visualize'
      ? `visualize-ambient-${track.durationSeconds}s`
      : 'deep-prime-ambient';
