import type { V2ReleaseConsequenceTone } from '@/constants/v2/release';
import type { AnchorExpression } from '@/constants/v2/creation';

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
  imageUrl?: string | null;
  expression?: AnchorExpression;
  /** True when a Course/Chart is linked to this Anchor and will be archived with it. */
  hasLinkedCourse: boolean;
  /** True when a Vision is linked to this Anchor. */
  hasLinkedVision: boolean;
  /** The reason that survived verification against server state. */
  reason: V2ReleaseReason;
  successor: V2ReleaseSuccessor | null;
  nextWaypointTitle: string | null;
  courseId: string | null;
  /** Fingerprint of everything the consequences depend on; a hold started on another one is stale. */
  revision: string;
  consequences: V2ReleaseConsequence[];
}

/**
 * Why the Anchor is being released. Waypoint and destination completion are
 * never inferred on the client: `resolveReleaseReason` only accepts them when
 * server-synced Chart state confirms them.
 */
export type V2ReleaseReason =
  | 'outcome_completed'
  | 'waypoint_completed'
  | 'destination_completed'
  | 'no_longer_aligned'
  | 'evolve';

export const V2_RELEASE_REASONS: readonly V2ReleaseReason[] = [
  'outcome_completed', 'waypoint_completed', 'destination_completed', 'no_longer_aligned', 'evolve',
];

/** The Anchor that carries an evolved intention forward. */
export interface V2ReleaseSuccessor {
  anchorId: string;
  intentionText: string;
}

/** Minimal linked-Course shape needed to phrase the Course consequence honestly. */
export interface V2ReleaseLinkedCourse {
  status: string;
  waypointCount: number;
  reachedCount: number;
  /** How this Anchor is linked to the Course, from server state. */
  linkKind?: 'waypoint' | 'destination' | null;
  /** Server-confirmed: the linked waypoint is REACHED. */
  waypointReached?: boolean;
  /** Server-confirmed: the Course itself is COMPLETED. */
  courseCompleted?: boolean;
  courseId?: string;
  /** Title of the waypoint that follows, when the server has one. */
  nextWaypointTitle?: string | null;
  /** Course revision from the server; changes when relationships do. */
  revision?: number;
}

export interface V2ReleaseSnapshotInput {
  anchor: {
    id: string;
    localId?: string;
    intentionText: string;
    category?: string | null;
    baseSigilSvg?: string;
    reinforcedSigilSvg?: string | null;
    enhancedImageUrl?: string;
    classifierMeta?: { v2Expression?: unknown };
  };
  linkedCourse?: V2ReleaseLinkedCourse | null;
  hasLinkedVision?: boolean;
  /** Requested reason; downgraded to manual when server state cannot confirm it. */
  reason?: V2ReleaseReason;
  successor?: V2ReleaseSuccessor | null;
}

/** Idempotent, non-destructive release request. */
export interface V2ReleaseRequest {
  anchorId: string;
  /** Stable across retries of the same release attempt so the server never double-applies. */
  idempotencyKey: string;
  /** A V2ReleaseReason from the app; the wire format stays a plain string. */
  reason?: V2ReleaseReason | (string & {});
  // DEFERRED: expectedRevision — POST /api/v2/anchors/:id/release does not accept or return a
  // relationship revision yet; staleness is checked client-side against the synced Chart.
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
