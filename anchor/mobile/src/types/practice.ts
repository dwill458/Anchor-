import type { BackgroundAudioMode, GuidanceVoice } from "./sessionAudio";

export const PRACTICE_MODES = [
  "focus",
  "deep_prime",
  "visualize",
  "stabilize",
] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];

/** Modes accepted by the single session-entry boundary. */
export const PRACTICE_ENTRY_MODES = [
  'focus',
  'deepPrime',
  'visualize',
  'release',
] as const;
export type PracticeEntryMode = (typeof PRACTICE_ENTRY_MODES)[number];

/** Stable source labels used to audit every practice entry point. */
export type PracticeEntrySource =
  | 'practice_hero'
  | 'practice_deep_prime_card'
  | 'practice_focus_card'
  | 'practice_visualize_card'
  | 'practice_release_card'
  | 'anchor_detail'
  | 'sanctuary_prime_anchor'
  | 'widget'
  | 'shortcut'
  | 'evolve';

export const PRACTICE_THREAD_STRENGTH_GAINS: Readonly<
  Record<PracticeMode, number>
> = {
  focus: 25,
  deep_prime: 40,
  visualize: 40,
  stabilize: 0,
};

export type PracticeSessionSyncState =
  "pending" | "syncing" | "synced" | "failed";

export interface PracticeSessionRecord {
  id: string;
  accountId: string;
  anchorId: string | null;
  anchorLocalId: string | null;
  anchorServerId: string | null;
  practiceMode: PracticeMode;
  plannedDurationSeconds: number;
  completedDurationSeconds: number;
  completionStatus: "completed";
  startedAt: string;
  completedAt: string;
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
  sceneSnapshot: string | null;
  nextAction: string | null;
  clientVersion: string | null;
  syncState: PracticeSessionSyncState;
}

export interface VisualizationScene {
  id?: string;
  accountId: string;
  anchorId: string;
  anchorLocalId: string | null;
  currentText: string;
  originalSuggestion: string;
  generationSource: "gemini" | "deterministic_fallback" | "user_edited";
  generationVersion: string;
  clientUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
  syncState: PracticeSessionSyncState;
}

export const practiceModeLabel = (mode: PracticeMode): string => {
  switch (mode) {
    case "focus":
      return "Focus";
    case "deep_prime":
      return "Deep Prime";
    case "visualize":
      return "Visualize";
    case "stabilize":
      return "Stabilize";
  }
};
