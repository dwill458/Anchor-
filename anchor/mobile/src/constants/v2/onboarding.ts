/**
 * The first-run sequence: splash → cinema → one question → creation (→ seal → home).
 *
 * Only the steps before creation are listed; creation owns its own steps, and the draft's
 * `currentStep` moves to "creation" when the question is answered. The progress header counts
 * three and leaves with the question.
 */
export type OnboardingStep =
  | "welcome"
  | "bridge"
  | "motivation"
  /** Retired steps; restored drafts that stopped on them resume at the question. */
  | "outcome"
  | "meaning"
  | "friction"
  | "system"
  | "handoff"
  | "life"
  | "need"
  | "summary"
  | "creation"
  | "auth"
  | "complete";

export const ONBOARDING_STEPS: OnboardingStep[] = ["welcome", "bridge", "motivation"];

/**
 * Splash, cinema, question. Creation is a ritual with its own unnumbered phases, so the
 * counter never promises a finish line and is gone by the time the ritual starts.
 */
export const ONBOARDING_TOTAL_STEPS = 3;
