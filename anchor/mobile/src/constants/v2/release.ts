/**
 * Anchor 2.0 — UI-H Release experience constants.
 *
 * Release is an honorable completion transition, never a deletion. Copy and
 * timings here are traced to the locked HTML storyboard
 * ("Anchor Release Fire Prototype - Storyboard Matched.html") and the
 * Design System Living Spec v0.4 (Sections 11 & 14).
 */

/** Central route name. UI-H does not edit the central navigator; it exports this manifest. */
export const V2_RELEASE_ROUTE = 'V2Release' as const;

/**
 * Deliberate hold-to-release duration. Storyboard: "the hold reaches full
 * progress at 1.80s". The value is an implementation detail and is never shown
 * to the user.
 */
export const RELEASE_HOLD_DURATION_MS = 1800;

/** Progress sampling cadence while holding. Small enough to feel continuous, coarse enough to test deterministically. */
export const RELEASE_HOLD_TICK_MS = 50;

/**
 * Smooth retreat when the finger lifts before completion. Storyboard early
 * release: "Progress smoothly retreats over 240ms". Reduced Motion resets
 * immediately (handled by the consuming component).
 */
export const RELEASE_HOLD_CANCEL_MS = 240;

/** Number of haptic "ticks" felt as the ring fills (crescendo before the completion pulse). */
export const RELEASE_HOLD_HAPTIC_STEPS = 6;

/**
 * Dissolution ceremony timeline (full motion). Offsets are milliseconds from
 * the moment the hold completes. Traced to storyboard frames:
 *  - Isolation 1.80s → 1.98s (fade surrounding chrome)
 *  - Ignition 2.10s (single lower-edge contact)
 *  - Burn 2.85s / 3.75s
 *  - Final ember 4.60–4.85s
 *  - Empty pause 4.85–5.15s (pure near-black, 300ms)
 *  - Completion 5.25s → 5.65s (contextual return)
 */
export const RELEASE_CEREMONY_TIMELINE_MS = {
  isolate: 0,
  ignite: 300,
  burnEarly: 1050,
  burnLate: 1950,
  finalEmber: 2800,
  emptyPause: 3050,
  completion: 3350,
} as const;

/**
 * Reduced Motion ceremony timeline. Storyboard: "Isolate at 1.80s; fade
 * artwork and geometry together by 2.20s" then a 300ms empty pause and a
 * crossfade to completion — no embers, no combustion, no screen shake.
 */
export const RELEASE_CEREMONY_TIMELINE_REDUCED_MS = {
  isolate: 0,
  fade: 120,
  emptyPause: 520,
  completion: 820,
} as const;

/** Number of drifting embers in the full-motion ceremony. Deliberately small — no heavy particle loops. */
export const RELEASE_CEREMONY_EMBER_COUNT = 8;

/** Controlled dark exception during the dissolution ceremony ("Ceremony Chamber"). */
export const RELEASE_CEREMONY_CHAMBER_BG = '#0B0C0D';

/**
 * Emergency off-switch for the burn shader. Fire is otherwise a runtime
 * capability (see `resolveReleaseFire`): it runs only when the Skia effect
 * compiles AND the Skia-built artwork texture validates as non-blank.
 */
export const RELEASE_FIRE_KILL_SWITCH = false;

/** Hold progress at which the burn texture is prepared, so it is ready before isolation at 1.80s. */
export const RELEASE_FIRE_PREPARE_AT = 0.6;

/** Warm neutral the chamber crossfades back to at completion. Matches theme/v2 colors.canvas. */
export const RELEASE_CANVAS_BG = '#F4F1E9';

/** Milestone that flips the hold label from the resting prompt to the sustained prompt. */
export const RELEASE_HOLD_SUSTAIN_LABEL_AT = 0.12;

export const RELEASE_COPY = {
  preflightKicker: 'Release this intention',
  preflightTitle: 'What releasing this Anchor means',
  preflightHeading: 'Release',
  preflightSubtitle: 'Move this intention into your history. Nothing is deleted.',
  consequenceHeading: 'What changes when you release',
  holdPrompt: 'Hold to release',
  holdSustainPrompt: 'Keep holding…',
  holdAction: 'Release intention',
  holdHint:
    'Press and hold to move this intention out of active use. Your history will remain available.',
  holdHintWaypoint:
    'Press and hold to move this intention out of active use and continue to the next waypoint in Chart. Your history will remain available.',
  holdHintDestination:
    'Press and hold to move this intention out of active use and complete this course. Your history will remain available.',
  holdHintEvolve:
    'Press and hold to move this intention into history and continue with your new Anchor. Your history will remain available.',
  cancelAnnouncement: 'Release cancelled. Nothing was changed.',
  sustainAnnouncement: 'Keep holding.',
  committedAnnouncement: 'Release committed.',
  failureAnnouncement: 'Release not completed. Your Anchor is still active.',
  staleNotice: 'Your Anchor’s connections changed. Review what changes, then hold again.',
  keepAnchorCta: 'Keep this Anchor active',
  ceremonyConfirming: 'Confirming release…',
  ceremonyConfirmingDetail:
    'This is taking a moment. Your release is safe — we are waiting for the server to confirm.',
  errorTitle: 'Release not completed',
  errorDetail:
    'Nothing was changed. Your Anchor is still active. Review the consequences and hold again to retry.',
  retryCta: 'Try again',
  offlineRetryCta: 'Retry now',
  successorMissingTitle: 'Create the new Anchor first',
  successorMissingBody: 'Evolving moves this intention into history and continues with a new Anchor. Create that Anchor, then come back.',
  successorMissingCta: 'Create the new Anchor',
  // DEFERRED: completionKicker / completionTitle / completionBody / completionPrimaryCta /
  // completionSecondaryCta were single fixed strings; they now live in RELEASE_ENDINGS below.
} as const;

export type V2ReleaseEndingId = 'outcome_completed' | 'waypoint_completed' | 'destination_completed' | 'no_longer_aligned' | 'evolve';
export type V2ReleaseActionId = 'home' | 'progress' | 'chart' | 'completed_chart' | 'successor';

/** Locked ending copy (Release prototype 17). Manual release never claims achievement. */
export const RELEASE_ENDINGS: Record<V2ReleaseEndingId, {
  eyebrow: string;
  /** Only the plain "Released" endings carry a separate large title. */
  title?: string;
  body: string;
  primary: { id: V2ReleaseActionId; label: string };
  secondary?: { id: V2ReleaseActionId; label: string };
}> = {
  outcome_completed: {
    eyebrow: 'Released', title: 'A little more space.',
    body: 'This intention has moved into your history.',
    primary: { id: 'home', label: 'Return Home' }, secondary: { id: 'progress', label: 'View Progress' },
  },
  no_longer_aligned: {
    eyebrow: 'Released', title: 'A little more space.',
    body: 'This intention has moved into your history.',
    primary: { id: 'home', label: 'Return Home' }, secondary: { id: 'progress', label: 'View Progress' },
  },
  waypoint_completed: {
    eyebrow: 'Waypoint complete',
    body: 'Your Anchor has been released. Your course continues.',
    primary: { id: 'chart', label: 'Continue to Chart' },
  },
  destination_completed: {
    eyebrow: 'Destination complete',
    body: 'The course is complete. Your history remains in Progress.',
    primary: { id: 'completed_chart', label: 'View completed Chart' }, secondary: { id: 'home', label: 'Return Home' },
  },
  evolve: {
    eyebrow: 'Evolved',
    body: 'This intention has moved into history.',
    primary: { id: 'successor', label: 'Continue with new Anchor' },
  },
};

export const RELEASE_SUCCESSOR_LINK_NOTE = 'Linked to your previous intention.';

export type V2ReleaseConsequenceTone = 'neutral' | 'preserved' | 'ceases';

/**
 * Consequence rows (prototype fixtures). The snapshot builder only adds the
 * Vision, Chart and Successor rows when those records actually exist.
 */
export const RELEASE_CONSEQUENCE_ROWS = {
  anchor: { id: 'anchor', label: 'Anchor', detail: 'Moves out of active use', tone: 'preserved' as V2ReleaseConsequenceTone },
  anchorEvolve: { id: 'anchor', label: 'Anchor', detail: 'This Anchor moves into history', tone: 'preserved' as V2ReleaseConsequenceTone },
  vision: { id: 'vision', label: 'Vision', detail: 'Saved alongside this intention in history', tone: 'preserved' as V2ReleaseConsequenceTone },
  chart: { id: 'course', label: 'Chart', detail: 'Archived with the Anchor. Reached waypoints and the journey remain', tone: 'preserved' as V2ReleaseConsequenceTone },
  chartWaypoint: { id: 'course', label: 'Chart', detail: 'The reached waypoint stays', tone: 'preserved' as V2ReleaseConsequenceTone },
  chartDestination: { id: 'course', label: 'Chart', detail: 'Completed course moves to history', tone: 'preserved' as V2ReleaseConsequenceTone },
  successor: { id: 'successor', label: 'New Anchor', detail: '', tone: 'neutral' as V2ReleaseConsequenceTone },
  history: { id: 'history', label: 'History', detail: 'Practice and Thread history remain in Progress', tone: 'preserved' as V2ReleaseConsequenceTone },
  // DEFERRED: the "Intention — marked complete" and "Daily reminders" rows were dropped; the first
  // claimed completion for manual releases and neither is part of the locked consequence fixtures.
} as const;
