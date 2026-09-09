import type { V2ReleaseConsequenceTone } from '@/constants/v2/release';

/** One line in the preflight consequence snapshot. */
export interface V2ReleaseConsequence {
  id: string;
  label: string;
  detail: string;
  tone: V2ReleaseConsequenceTone;
}

/** Everything the preflight shell needs to explain the transition. Derived from real records only. */
export interface V2ReleaseConsequenceSnapshot {
  anchorId: string;
  intentionText: string;
  category: string | null;
  artworkSvg: string;
  /** True when a Course/Chart is linked to this Anchor and will be archived with it. */
  hasLinkedCourse: boolean;
  /** True when a Vision is linked to this Anchor. */
  hasLinkedVision: boolean;
  consequences: V2ReleaseConsequence[];
}

/** Minimal linked-Course shape needed to phrase the Course consequence honestly. */
export interface V2ReleaseLinkedCourse {
  status: string;
  waypointCount: number;
  reachedCount: number;
}

export interface V2ReleaseSnapshotInput {
  anchor: {
    id: string;
    localId?: string;
    intentionText: string;
    category?: string | null;
    baseSigilSvg?: string;
    reinforcedSigilSvg?: string | null;
  };
  linkedCourse?: V2ReleaseLinkedCourse | null;
  hasLinkedVision?: boolean;
}

/** Idempotent, non-destructive release request. */
export interface V2ReleaseRequest {
  anchorId: string;
  /** Stable across retries of the same release attempt so the server never double-applies. */
  idempotencyKey: string;
  reason?: string;
}

export type V2ReleaseStatus = 'released' | 'pending' | 'failed';

export interface V2ReleaseResult {
  status: V2ReleaseStatus;
  anchorId: string;
  /** ISO timestamp when the server sealed the Anchor (present when status is 'released'). */
  releasedAt?: string;
  lifecycleState?: 'active' | 'completed' | 'released';
  /** Human-readable detail for 'pending' / 'failed'. */
  message?: string;
  /** True when the failure is safe to retry with the same idempotency key (offline / server error / timeout). */
  retryable?: boolean;
}

/**
 * Submission port. The screen depends on this interface, not on a concrete
 * HTTP client, so tests can assert the contract and prove the legacy
 * destructive `/burn` endpoint is never touched.
 */
export interface V2ReleaseAdapter {
  submitRelease(request: V2ReleaseRequest): Promise<V2ReleaseResult>;
}
