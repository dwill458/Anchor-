import type { V2PracticeMode } from '@/constants/v2/practice';

/** Route manifest only. UI-F does not alter the central navigator. */
export const V2_PRACTICE_ROUTE_MANIFEST = {
  practice: 'V2Practice',
  focusPrepare: 'V2FocusPrepare',
  deepPrimePrepare: 'V2DeepPrimePrepare',
  visualizePrepare: 'V2VisualizePrepare',
  releasePrepare: 'V2ReleasePrepare',
} as const;

export type V2PremiumCapability = 'focus' | 'deep_prime' | 'visualize';
export type V2PremiumCapabilityRequest = {
  capability: V2PremiumCapability;
  anchorId: string;
  source: 'practice_hub' | 'recommended_today';
  durationSeconds?: number;
};
import type { GuidanceVoice } from '@/types/sessionAudio';

export type V2PracticeStartRequest = {
  anchorId: string;
  mode: Exclude<V2PracticeMode, 'release'>;
  durationSeconds: number;
  source: 'practice_hub' | 'recommended_today';
  voice?: GuidanceVoice;
  ambient?: boolean;
  /** Session-only haptics choice from setup; unset keeps the saved setting. */
  haptics?: boolean;
};
export type V2PracticeRouteIntents = {
  onPremiumCapabilityRequired: (request: V2PremiumCapabilityRequest) => void;
  onCreateVision: (anchorId: string) => void;
  onOpenVision?: (anchorId: string) => void;
  onReleaseRequested: (anchorId: string, reason?: string) => void;
  onBeginPractice?: (request: V2PracticeStartRequest) => void;
};
