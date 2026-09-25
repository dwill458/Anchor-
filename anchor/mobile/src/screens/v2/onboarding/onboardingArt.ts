/**
 * Category-resolved artwork for the personalized onboarding screens (4 and 5).
 *
 * Every asset here is supplied artwork, used as-is. Nothing is drawn in code to stand in
 * for a missing category: each of the eleven categories has its own SEE collage and its own
 * REINFORCE Anchor, and the three primary areas keep their Screen 3 illustration.
 */
import type { ImageSourcePropType } from "react-native";
import type { AnchorCategory } from "@/types";
import { PRIMARY_FOCUS_AREAS } from "@/constants/v2/onboarding";
import { getCategoryColor } from "@/theme/v2";

const PRIMARY_ART: Partial<Record<AnchorCategory, ImageSourcePropType>> = {
  health: require("@/assets/onboarding/screen3/category-health.png"),
  career: require("@/assets/onboarding/screen3/category-career.png"),
  relationships: require("@/assets/onboarding/screen3/category-relationships.png"),
};
/** The eight categories reached through "Something else" have no dedicated illustration of
 * their own — the same treatment Screen 3 already gives them in its fourth card slot. */
const FALLBACK_ART: ImageSourcePropType = require("@/assets/onboarding/screen3/category-something-else.png");

/** The category illustration chosen on Screen 3; it travels Screen 3 → 4 → 5 as one object. */
export const heroArtFor = (category: AnchorCategory): ImageSourcePropType => PRIMARY_ART[category] ?? FALLBACK_ART;

/** The three primary areas keep Screen 3's own accents; every other category falls back to
 * the shared category palette, exactly like Screen 3's "Something else" sheet does. */
const PRIMARY_ACCENTS = PRIMARY_FOCUS_AREAS.reduce<Partial<Record<AnchorCategory, string>>>((acc, area) => {
  if (area.accent && area.id !== "something_else") acc[area.id as AnchorCategory] = area.accent;
  return acc;
}, {});
export const accentFor = (category: AnchorCategory): string => PRIMARY_ACCENTS[category] ?? getCategoryColor(category);

/** SEE — the category's Vision collage. */
const SEE_ART: Record<AnchorCategory, ImageSourcePropType> = {
  health: require("@/assets/onboarding/screen5/see-health.jpg"),
  career: require("@/assets/onboarding/screen5/see-career.jpg"),
  relationships: require("@/assets/onboarding/screen5/see-relationships.jpg"),
  desire: require("@/assets/onboarding/screen5/see-desire.jpg"),
  creativity: require("@/assets/onboarding/screen5/see-creativity.jpg"),
  spirituality: require("@/assets/onboarding/screen5/see-spirituality.jpg"),
  abundance: require("@/assets/onboarding/screen5/see-abundance.jpg"),
  family: require("@/assets/onboarding/screen5/see-family.jpg"),
  learning: require("@/assets/onboarding/screen5/see-learning.jpg"),
  adventure: require("@/assets/onboarding/screen5/see-adventure.jpg"),
  custom: require("@/assets/onboarding/screen5/see-custom.jpg"),
};

/**
 * REINFORCE — the category's example Anchor. Gold Leaf is Abundance; every other category
 * uses a style the production style library recommends for it (`refineStyles.ts`).
 */
const ANCHOR_ART: Record<AnchorCategory, ImageSourcePropType> = {
  abundance: require("@/assets/onboarding/screen5/anchor-gold-leaf.png"),
  health: require("@/assets/onboarding/screen5/anchor-tideglass.png"),
  family: require("@/assets/onboarding/screen5/anchor-watercolor.png"),
  relationships: require("@/assets/onboarding/screen5/anchor-echo-chamber.png"),
  career: require("@/assets/onboarding/screen5/anchor-verdigris-relic.png"),
  custom: require("@/assets/onboarding/screen5/anchor-obsidian-mono.png"),
  desire: require("@/assets/onboarding/screen5/anchor-ember-trace.png"),
  learning: require("@/assets/onboarding/screen5/anchor-celestial-grid.png"),
  adventure: require("@/assets/onboarding/screen5/anchor-cosmic.png"),
  spirituality: require("@/assets/onboarding/screen5/anchor-aurora-glow.png"),
  creativity: require("@/assets/onboarding/screen5/anchor-prism-veil.png"),
};

/** MOVE — the shared Chart landscape, the same for every category. */
export const MOVE_ART: ImageSourcePropType = require("@/assets/onboarding/screen5/move-chart.png");
/** move-chart.png is 600 × 598: its open silhouette is kept, never cropped to a frame. */
export const MOVE_ASPECT = 600 / 598;

export const seeArtFor = (category: AnchorCategory): ImageSourcePropType => SEE_ART[category] ?? SEE_ART.custom;
export const anchorArtFor = (category: AnchorCategory): ImageSourcePropType => ANCHOR_ART[category] ?? ANCHOR_ART.custom;
