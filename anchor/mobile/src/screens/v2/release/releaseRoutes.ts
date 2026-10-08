import { V2_RELEASE_ROUTE } from '@/constants/v2/release';
import type { V2ReleaseEnding, V2ReleaseSuccessor } from '@/adapters/v2/release';

/**
 * Route manifest only. UI-H does not edit the central navigator
 * (`navigation/v2/*`). Integration registers this screen and wires the
 * continuation callbacks — see REQUIRED_INTEGRATION_CHANGES in
 * ANCHOR_2_UI_H_RELEASE_EXPERIENCE.md.
 */
export const V2_RELEASE_ROUTE_MANIFEST = {
  release: V2_RELEASE_ROUTE,
} as const;

export { V2_RELEASE_ROUTE };

export interface V2ReleaseRouteParams {
  anchorId: string;
  /** Shared artwork owns the arrival animation. */
  anchorTransition?: boolean;
  /**
   * Optional context: one of V2ReleaseReason ('outcome_completed' | 'waypoint_completed' |
   * 'destination_completed' | 'no_longer_aligned' | 'evolve'). Anything else is a manual
   * release. Waypoint/destination reasons are verified against synced Chart state.
   */
  reason?: string;
  /** Evolve only: the Anchor the intention continues into. */
  successor?: V2ReleaseSuccessor;
}

/** Typed continuation callbacks the central navigator supplies. */
export interface V2ReleaseContinuationCallbacks {
  /** Return Home (and the fallback for any continuation without its own callback). */
  onReleaseCompleted: (anchorId: string, ending: V2ReleaseEnding) => void;
  onCancel: () => void;
  onViewHistory?: () => void;
  /** Progress for the released intention. */
  onViewProgress?: (anchorId: string) => void;
  /** Waypoint ending: the Chart with its next waypoint. */
  onContinueToChart?: (courseId: string | null, anchorId: string) => void;
  /** Destination ending: the completed Chart. */
  onViewCompletedChart?: (courseId: string | null, anchorId: string) => void;
  /** Evolve ending: the successor Anchor's details. */
  onContinueWithSuccessor?: (successorAnchorId: string) => void;
  /** Evolve with no valid successor: send the user to create one. */
  onCreateSuccessor?: () => void;
  /**
   * "Evolve it" was chosen with nothing attached: open creation on top of Release, with the intention
   * carried over. Release stays in the stack; nothing is released or linked until the hold completes.
   */
  onBeginEvolve?: (origin: { anchorId: string; intentionText: string }) => void;
}
