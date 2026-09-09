export type ThreadEventSignificance = 'LOW' | 'MEDIUM' | 'HIGH' | 'MAJOR';

export type CanonicalThreadEventType =
  | 'ANCHOR_CREATED'
  | 'THREAD_STRENGTHENED'
  | 'THREAD_STABILIZED'
  | 'THREAD_RECOVERED'
  | 'THREAD_SOFTENED'
  | 'THREAD_RETURNED'
  | 'EVOLUTION_STAGE_REACHED'
  | 'PRACTICE_MILESTONE_REACHED'
  | 'ONE_MOVE_COMPLETED'
  | 'WAYPOINT_REACHED'
  | 'DESTINATION_REACHED'
  | 'COURSE_RESUMED'
  | 'ANCHOR_COMPLETED'
  | 'RELEASE_RECOMMENDED'
  | 'ANCHOR_RELEASED';

export interface V2ThreadEventItem {
  id: string;
  type: CanonicalThreadEventType;
  title: string;
  copy: string;
  why: string;
  significance: ThreadEventSignificance;
  occurredAt: string; // ISO string
  formattedDate: string;
  formattedTime?: string;
  /** Authoritative Thread movement delta from server/ledger if known, null otherwise. NEVER fabricated. */
  authoritativeDelta: number | null;
  /** Authoritative Thread range [before, after] if known. */
  authoritativeThreadRange: [number, number] | null;
  stageName?: string | null;
  waypointTitle?: string | null;
  milestoneCount?: number | null;
  sourceDomain: 'PRACTICE' | 'THREAD_ENGINE' | 'COURSE_EVENT' | 'ANCHOR_LIFECYCLE';
  rawDomainEventId?: string | null;
}

export interface V2PracticeModeBreakdown {
  focusCount: number;
  focusSeconds: number;
  deepPrimeCount: number;
  deepPrimeSeconds: number;
  visualizeCount: number;
  visualizeSeconds: number;
  releaseCount: number;
  releaseSeconds: number;
  totalSessions: number;
  totalDurationSeconds: number;
}

export interface V2ProgressModel {
  anchorId: string;
  intention: string;
  category?: string | null;
  threadStrength: number;
  unmeasured: boolean;
  qualitativeLabel: string;
  highestEvolutionStage: 'Forming' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign';
  practiceSummary: V2PracticeModeBreakdown;
  waypointsReachedCount: number;
  events: V2ThreadEventItem[];
}
