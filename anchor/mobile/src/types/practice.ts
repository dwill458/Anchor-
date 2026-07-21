import type { BackgroundAudioMode, GuidanceVoice } from './sessionAudio';

export const PRACTICE_MODES = [
  'deep_prime',
  'visualize',
  'focus',
  'release',
] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

export const PRACTICE_MODE_LABELS: Readonly<Record<PracticeMode, string>> = {
  deep_prime: 'Deep Prime',
  visualize: 'Visualize',
  focus: 'Focus Session',
  release: 'Release',
};

export const PRACTICE_MODE_THEME = {
  deep_prime: {
    label: PRACTICE_MODE_LABELS.deep_prime,
    primary: '#D4AF37',
    bright: '#F0CB6A',
  },
  visualize: {
    label: PRACTICE_MODE_LABELS.visualize,
    primary: '#78B4D1',
  },
  focus: {
    label: PRACTICE_MODE_LABELS.focus,
    primary: '#AD99D2',
  },
  release: {
    label: PRACTICE_MODE_LABELS.release,
    primary: '#C8875A',
  },
} as const;

/** Existing product weighting: Deep Prime compounds faster than base practice. */
export const PRACTICE_THREAD_STRENGTH_GAINS: Readonly<
  Record<PracticeMode, number>
> = {
  deep_prime: 40,
  visualize: 40,
  focus: 25,
  release: 25,
};

const MODE_ALIASES: Readonly<Record<string, PracticeMode>> = {
  deep_prime: 'deep_prime',
  deepprime: 'deep_prime',
  'deep-prime': 'deep_prime',
  prime: 'deep_prime',
  priming: 'deep_prime',
  charge: 'deep_prime',
  charged: 'deep_prime',
  reinforce: 'deep_prime',
  reinforcement: 'deep_prime',
  visualize: 'visualize',
  visualization: 'visualize',
  visualisation: 'visualize',
  focus: 'focus',
  focussession: 'focus',
  'focus-session': 'focus',
  activate: 'focus',
  activation: 'focus',
  quickactivate: 'focus',
  quick_activation: 'focus',
  release: 'release',
  released: 'release',
  burn: 'release',
  burned: 'release',
  burning: 'release',
};

export function normalizePracticeMode(value: unknown): PracticeMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  return MODE_ALIASES[normalized] ?? null;
}

export type PracticeCompletionSource =
  | 'practice_screen'
  | 'anchor_detail'
  | 'notification'
  | 'widget'
  | 'deep_link'
  | 'restored'
  | 'unknown';

export type PracticeSessionSyncState =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed';

export interface PracticeSessionRecord {
  id: string;
  accountId: string;
  anchorId: string | null;
  anchorLocalId: string | null;
  anchorServerId: string | null;
  practiceMode: PracticeMode;
  plannedDurationSeconds: number;
  completedDurationSeconds: number;
  completionStatus: 'completed';
  startedAt: string;
  completedAt: string;
  localDateKey: string;
  timeZone: string;
  utcOffsetMinutesAtCompletion: number;
  completionSource: PracticeCompletionSource;
  schemaVersion: number;
  legacyType: string | null;
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
  sceneSnapshot: string | null;
  nextAction: string | null;
  clientVersion: string | null;
  metadata?: Record<string, unknown>;
  syncState: PracticeSessionSyncState;
}

export interface UnknownPracticeHistoryRecord {
  fingerprint: string;
  accountId: string;
  legacyType: string;
  completedAt: string | null;
  raw: Record<string, unknown>;
}

export interface VisualizationScene {
  id?: string;
  accountId: string;
  anchorId: string;
  anchorLocalId: string | null;
  currentText: string;
  originalSuggestion: string;
  generationSource: 'gemini' | 'deterministic_fallback' | 'user_edited';
  generationVersion: string;
  clientUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
  syncState: PracticeSessionSyncState;
}

export const practiceModeLabel = (mode: PracticeMode): string =>
  PRACTICE_MODE_LABELS[mode];
