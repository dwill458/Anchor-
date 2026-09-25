import type { AnchorCategory } from "@/types";

export const MOTIVATIONS = [
  "Something at work needs to change",
  "I want to feel healthier",
  "I want to feel closer to someone",
  "I want more room to create",
  "I want to feel more grounded",
  "I want more financial ease",
  "I want to be more present with family",
  "I'm ready to learn something new",
  "I'm ready for a new experience",
  "I want a life that feels like mine",
  "Something else",
] as const;

/**
 * Screen 3 — "What matters most to you right now?"
 * Four areas are shown first; the rest of the established categories are disclosed only
 * behind "Something else". The choice is onboarding context, never the first Anchor's
 * category: that is still detected from the intention the user writes later.
 */
export type FocusAreaId = "health" | "career" | "relationships" | "something_else";

export const PRIMARY_FOCUS_AREAS: ReadonlyArray<{
  id: FocusAreaId;
  label: string;
  /** Selection accent. `null` keeps the card neutral. */
  accent: string | null;
}> = [
  { id: "health", label: "Health", accent: "#2FA879" },
  { id: "career", label: "Career", accent: "#3157D8" },
  { id: "relationships", label: "Relationships", accent: "#E56F7A" },
  { id: "something_else", label: "Something else", accent: null },
];

export const MORE_FOCUS_AREAS: ReadonlyArray<{ id: AnchorCategory; label: string }> = [
  { id: "desire", label: "Desire" },
  { id: "creativity", label: "Creativity" },
  { id: "spirituality", label: "Spirituality" },
  { id: "abundance", label: "Abundance" },
  { id: "family", label: "Family" },
  { id: "learning", label: "Learning" },
  { id: "adventure", label: "Adventure" },
  { id: "custom", label: "Custom" },
];

export function focusAreaLabel(category?: AnchorCategory | null): string | undefined {
  if (!category) return undefined;
  return (
    PRIMARY_FOCUS_AREAS.find((area) => area.id === category)?.label ??
    MORE_FOCUS_AREAS.find((area) => area.id === category)?.label
  );
}

/**
 * Screen 4 — "What would changing this give you?" Four short outcomes per category, keyed
 * to the area chosen on Screen 3. Personalization context only, never a new Anchor concept.
 */
export const CATEGORY_OUTCOME_OPTIONS: Record<AnchorCategory, readonly [string, string, string, string]> = {
  health: ["More energy", "More confidence", "More strength", "A healthier life"],
  career: ["More freedom", "More confidence", "More stability", "A bigger impact"],
  relationships: ["More connection", "More trust", "A stronger family", "More love"],
  desire: ["More clarity", "More motivation", "A clearer path", "A sense of fulfillment"],
  creativity: ["More inspiration", "More confidence", "A stronger voice", "A sense of flow"],
  spirituality: ["More peace", "More clarity", "A calmer mind", "A sense of purpose"],
  abundance: ["More freedom", "More security", "More confidence", "A wealthier life"],
  family: ["More connection", "More presence", "A stronger bond", "A happier home"],
  learning: ["More confidence", "More mastery", "A sharper mind", "A clearer path"],
  adventure: ["More freedom", "More confidence", "A fuller life", "A sense of aliveness"],
  custom: ["More clarity", "More confidence", "A clearer path", "A better life"],
};

export function outcomeOptionsFor(category?: AnchorCategory | null): readonly string[] {
  return CATEGORY_OUTCOME_OPTIONS[category ?? "custom"] ?? CATEGORY_OUTCOME_OPTIONS.custom;
}

export const LIFE_CHANGES = [
  "What I do every day",
  "Where I spend my time",
  "How I feel",
  "Who I'm around",
  "What I have access to",
  "How other people experience me",
] as const;

export const PRIMARY_NEEDS = [
  "Knowing what to do next",
  "Staying consistent",
  "Getting past something that's blocking me",
  "Seeing progress",
  "Keeping the goal in front of me",
] as const;

export type OnboardingStep =
  | "welcome"
  | "bridge"
  | "motivation"
  | "outcome"
  | "system"
  /** Retired "What changes first?" step; restored drafts that stopped on it resume on "system". */
  | "life"
  | "need"
  | "summary"
  | "handoff"
  | "creation"
  | "auth"
  | "complete";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "welcome",
  "bridge",
  "motivation",
  "outcome",
  "system",
  "need",
  "summary",
  "handoff",
];

export function summaryStatement(
  desiredOutcome: string,
  primaryNeed: string,
): string {
  const outcome = desiredOutcome.trim().replace(/[.!?]+$/, "");
  const need = primaryNeed.trim().toLowerCase();
  if (!outcome || !need) return "";
  const action: Record<string, string> = {
    "knowing what to do next": "finding a clear next step",
    "staying consistent": "consistent action",
    "getting past something that's blocking me":
      "moving past what has held you back",
    "seeing progress": "seeing the progress you make",
    "keeping the goal in front of me": "keeping your goal in sight",
  };
  return `You're working toward ${outcome}, and you want support with ${action[need] ?? need}.`;
}
