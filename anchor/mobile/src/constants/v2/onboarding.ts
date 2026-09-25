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
  "life",
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
