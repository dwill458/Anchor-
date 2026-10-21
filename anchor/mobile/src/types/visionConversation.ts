import type { VisionGenerationJob } from '@/hooks/v2/vision/useV2VisionGeneration';

export type VisionOperation = 'CREATE' | 'EDIT' | 'COMPOSE' | 'VARIATE';
export type VisionReferenceRole = 'identity' | 'place' | 'object' | 'inspiration';
export interface VisionReferenceInput {
  assetId: string;
  role: VisionReferenceRole;
  label?: string;
}
/** Local file or signed preview only; image bytes never live in component state. */
export interface VisionReferenceAttachment {
  id: string;
  uri: string;
  mimeType: string;
  assetId?: string;
  role: VisionReferenceRole;
  label?: string;
}
export interface VisionSceneRequestOptions {
  operation?: VisionOperation;
  sessionId?: string;
  parentCandidateId?: string;
  references?: VisionReferenceInput[];
}
export interface VisionConversationRound extends VisionGenerationJob {
  sessionId: string;
  roundNumber: number;
  operation: VisionOperation;
  parentCandidateId: string | null;
  description: string;
  references: Array<VisionReferenceInput & { imageUrl?: string | null }>;
}
export interface VisionConversationSession {
  id: string;
  anchorId: string;
  visionId: string;
  status: 'ACTIVE' | 'SEALED' | 'ABANDONED' | 'EXPIRED';
  description: string;
  draftPrompt: string;
  selectedCandidateId: string | null;
  viewedRoundId: string | null;
  references: Array<VisionReferenceInput & { imageUrl?: string | null }>;
  rounds: VisionConversationRound[];
  expiresAt: string;
}
export const visionRoundLabel = (roundNumber: number) => roundNumber === 0 ? 'Original' : `Version ${roundNumber}`;
