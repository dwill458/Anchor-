/** Client mirror of the server's Weekly Recap view (WeeklyRecapService). Server is authoritative. */
export type RecapHeroKind =
  | 'DESTINATION' | 'INTENTION_COMPLETED' | 'WAYPOINT' | 'MOVES_PROGRESS' | 'MOVE_SINGLE'
  | 'MILESTONE' | 'RELEASE' | 'PRACTICE' | 'QUIET';

export type RecapCandidateKind =
  | 'DESTINATION_REACHED' | 'INTENTION_COMPLETED' | 'WAYPOINT_REACHED' | 'MOVE_COMPLETED'
  | 'MILESTONE_EARNED' | 'ANCHOR_RELEASED';

export interface RecapStats {
  practiceDays: number; sessions: number; waypoints: number; moves: number;
  destinations: number; intentionsCompleted: number; releases: number; milestones: number;
}

export interface RecapContent {
  core: {
    weekKey: string;
    timeZone: string;
    hero: { kind: RecapHeroKind; anchorId?: string | null; anchorTitle?: string | null; courseId?: string | null; sourceEntityId?: string; title?: string | null; count?: number };
    headline: string;
    stats: RecapStats;
    days: { dateKey: string; practiced: boolean; achievements: number }[];
    highlights: { kind: RecapCandidateKind; sourceEntityId: string; anchorId?: string | null; anchorTitle?: string | null; title?: string | null; occurredAt: string; absorbedMoveCount: number }[];
    omittedHighlightCount: number;
    reconciliation: { countedTotal: number; listed: number; absorbed: number; omitted: number };
  };
  map: null | {
    courseId: string;
    status: 'VERIFIED' | 'UNVERIFIED';
    frozen: null | { waypointIndex: number; waypointTotal: number; reachedWaypointIds: string[]; reachedMask?: boolean[] };
  };
}

export type RecapPhase = 'PREVIEW' | 'PROVISIONAL' | 'FINAL';

export interface AvailableRecapView {
  available: true;
  weekKey: string;
  timeZone: string;
  phase: RecapPhase;
  status: 'DRAFT' | 'FINAL';
  provisional: boolean;
  finalizesAt: string;
  generatedAt: string;
  content: RecapContent;
  feedback: string | null;
}
export interface UnavailableRecapView {
  available: false;
  phase: 'NOT_AVAILABLE';
  weekKey: string;
  timeZone: string;
  availableAt: string;
}
export type RecapView = AvailableRecapView | UnavailableRecapView;

export class RecapApiError extends Error {
  constructor(public code: string, message?: string, public status?: number) { super(message ?? code); }
}
