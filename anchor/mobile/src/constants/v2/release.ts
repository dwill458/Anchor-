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
  completion: 3450,
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

/** Warm neutral the chamber crossfades back to at completion. Matches theme/v2 colors.canvas. */
export const RELEASE_CANVAS_BG = '#F4F1E9';

/** Milestone that flips the hold label from the resting prompt to the sustained prompt. */
export const RELEASE_HOLD_SUSTAIN_LABEL_AT = 0.12;

export const RELEASE_COPY = {
  preflightKicker: 'RELEASE',
  preflightTitle: 'What releasing this Anchor means',
  preflightSubtitle:
    'Release moves this intention out of active use and seals it into your history. Nothing is deleted.',
  holdPrompt: 'Hold to release',
  holdSustainPrompt: 'Keep holding…',
  holdHint: 'Press and hold for a moment. Lift early to cancel.',
  cancelAnnouncement: 'Release cancelled. Nothing was changed.',
  sustainAnnouncement: 'Keep holding.',
  committedAnnouncement: 'Release committed.',
  keepAnchorCta: 'Keep this Anchor active',
  ceremonyConfirming: 'Confirming release…',
  ceremonyConfirmingDetail:
    'This is taking a moment. Your release is safe — we are waiting for the server to confirm.',
  errorTitle: 'Release not completed',
  errorDetail:
    'Nothing was changed. Your Anchor is still active. Review the consequences and hold again to retry.',
  retryCta: 'Try again',
  offlineRetryCta: 'Retry now',
  completionKicker: 'RELEASED',
  completionTitle: 'Honoring what you built',
  completionBody: 'This intention has moved into your history.',
  completionPrimaryCta: 'Return home',
  completionSecondaryCta: 'View in Your Anchors',
} as const;

export type V2ReleaseConsequenceTone = 'neutral' | 'preserved' | 'ceases';

/**
 * Base consequence rows. The snapshot builder filters/augments these against
 * real Anchor data — it never fabricates a Chart or Vision that does not exist.
 */
export const RELEASE_CONSEQUENCE_BASE: ReadonlyArray<{
  id: string;
  label: string;
  detail: string;
  tone: V2ReleaseConsequenceTone;
}> = [
  {
    id: 'intention',
    label: 'Intention',
    detail: 'Marked complete and retired from active practice.',
    tone: 'neutral',
  },
  {
    id: 'anchor',
    label: 'Anchor',
    detail: 'Sealed into your personal history with status “released”.',
    tone: 'preserved',
  },
  {
    id: 'reminders',
    label: 'Daily reminders',
    detail: 'Active reminder loops for this Anchor stop.',
    tone: 'ceases',
  },
  {
    id: 'history',
    label: 'History',
    detail: 'Thread Strength, Course Log, and session counts stay readable in Your Anchors.',
    tone: 'preserved',
  },
] as const;

export const RELEASE_CONSEQUENCE_COURSE = {
  id: 'course',
  label: 'Course & Waypoints',
  detail: 'Archived with the Anchor. Reached waypoints and the full journey remain.',
  tone: 'preserved' as V2ReleaseConsequenceTone,
} as const;

export const RELEASE_CONSEQUENCE_VISION = {
  id: 'vision',
  label: 'Vision',
  detail: 'Saved alongside this intention in history.',
  tone: 'preserved' as V2ReleaseConsequenceTone,
} as const;
