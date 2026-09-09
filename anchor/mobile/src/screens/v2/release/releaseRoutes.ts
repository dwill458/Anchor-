import { V2_RELEASE_ROUTE } from '@/constants/v2/release';

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
  /** Optional context for a manual release (e.g. 'evolve', 'destination_completed'). */
  reason?: string;
}

/** Typed continuation callbacks the central navigator supplies. */
export interface V2ReleaseContinuationCallbacks {
  onReleaseCompleted: (anchorId: string) => void;
  onCancel: () => void;
}
