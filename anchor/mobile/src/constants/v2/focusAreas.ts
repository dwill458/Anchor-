import type { AnchorCategory } from "@/types";

/**
 * Onboarding's one question — "What matters most to you right now?" — and what its answer
 * becomes. The choice sets the first Anchor's category and opens creation already framed for
 * it: a line about the field the intention will live on, and examples written for that area.
 */
export type FocusAreaId =
  | "health"
  | "career"
  | "relationships"
  | "money"
  | "family"
  | "something_else";

export type FocusTip = { instead: string; try: string } | { note: string };

export type FocusArea = {
  id: FocusAreaId;
  label: string;
  /** The Anchor category this choice sets. "Something else" defaults to Custom. */
  category: AnchorCategory;
  /** Selection accent. `null` keeps the card neutral. */
  accent: string | null;
  /** Shown on the intention page; says where the intention will take shape. */
  fieldLine: string;
  /** True placeholder for the intention field. Never prefilled. */
  placeholder: string;
  /** The coaching tip under the field: a reframe, or a plain note. */
  tip: FocusTip;
  /** Present-tense starting points for the intention page. Never prefilled. */
  examples: readonly [string, string, string];
};

export const FOCUS_AREAS: readonly FocusArea[] = [
  {
    id: "health",
    label: "Health",
    category: "health",
    accent: "#2FA879",
    fieldLine: "Health intentions take shape on the Health field.",
    placeholder: "I am healthy, strong, and full of energy",
    tip: { instead: "I want to stop eating junk", try: "I nourish my body every day." },
    examples: ["I move with energy every day.", "I give my body what it needs.", "I rest well and wake ready."],
  },
  {
    id: "career",
    label: "Career",
    category: "career",
    accent: "#3157D8",
    fieldLine: "Career intentions take shape on the Career field.",
    placeholder: "I do work I’m proud of",
    tip: { instead: "I want a better job", try: "I am trusted with work that matters." },
    examples: ["I do focused work that matters.", "I lead with clarity and confidence.", "I finish what I start at work."],
  },
  {
    id: "relationships",
    label: "Relationships",
    category: "relationships",
    accent: "#E56F7A",
    fieldLine: "Relationship intentions take shape on the Relationships field.",
    placeholder: "I am surrounded by people who love me",
    tip: { instead: "I want more friends", try: "I show up fully for the people I love." },
    examples: ["I listen fully to the people I love.", "I speak honestly and with care.", "I show up for the people who matter."],
  },
  {
    id: "money",
    label: "Money",
    category: "abundance",
    accent: "#B8892E",
    fieldLine: "Money intentions take shape on the Money field.",
    placeholder: "I am financially free",
    tip: { instead: "I want to stop worrying about money", try: "Money flows to me through work I love." },
    examples: ["I spend and save with intention.", "I build financial security steadily.", "I am calm and clear about money."],
  },
  {
    id: "family",
    label: "Family",
    category: "family",
    accent: "#D9822B",
    fieldLine: "Family intentions take shape on the Family field.",
    placeholder: "My family is close and thriving",
    tip: { instead: "I want to see my kids more", try: "I am present with my family every day." },
    examples: ["I am fully present with my family.", "I make time for the people at home.", "I bring patience home with me."],
  },
  {
    id: "something_else",
    label: "Something else",
    category: "custom",
    accent: null,
    fieldLine: "Write it in your own words. It takes shape from them.",
    placeholder: "I am becoming who I’m meant to be",
    tip: { note: "Write it as if it’s already true." },
    examples: ["I move toward what I truly want.", "I act on what matters most to me.", "I keep my focus on one thing."],
  },
];

export const focusAreaById = (id: FocusAreaId): FocusArea =>
  FOCUS_AREAS.find((area) => area.id === id) ?? FOCUS_AREAS[FOCUS_AREAS.length - 1];

/**
 * The card a stored category belongs to. Categories the question no longer offers (a draft
 * from the earlier onboarding) read as "Something else".
 */
export function focusAreaForCategory(category?: string | null): FocusArea | undefined {
  if (!category) return undefined;
  return (
    FOCUS_AREAS.find((area) => area.category === category && area.id !== "something_else") ??
    FOCUS_AREAS[FOCUS_AREAS.length - 1]
  );
}

/** True when the user named a specific area, rather than taking the "Something else" default. */
export const isSpecificFocus = (category?: string | null): boolean =>
  Boolean(category) && focusAreaForCategory(category)?.id !== "something_else";

/** The line that follows the tap, before creation opens. */
export function focusHandoffLine(area: FocusArea): string {
  return `${area.id === "something_else" ? "Yours" : area.label}. Good — let’s give it a shape.`;
}
