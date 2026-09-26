/**
 * Onboarding Screens 4 and 5 composition, solved from the viewport.
 *
 * Screen 4's hero frame lives here too: it is where the category illustration starts its
 * Screen 4 → 5 flight, so both screens must agree on it to the point.
 */
import { isCompactPhoneViewport, isShortPhoneViewport } from "@/utils/layout";
import { MOVE_ASPECT } from "./onboardingArt";

export type Frame = { x: number; y: number; width: number; height: number };
type Insets = { top: number; bottom: number };

export const ONBOARDING_METRICS = { sidePad: 22, headerHeight: 48, ctaHeight: 56 } as const;

/** Screen 4's hero: the upper third of the content area, capped so it never crowds the
 * choices on a short device.
 *
 * When `optionCount` is given, the hero is also capped so the choice rows and CTA below it
 * are guaranteed to fit above the safe area. The old fixed cap (224pt) alone was sized off
 * the compact/short viewport thresholds, which a device like iPhone 14 Pro (393×852, a tall
 * Dynamic Island inset) narrowly misses — it was treated as a full-size viewport, so a
 * 4-option category overflowed the CTA off the bottom of the screen by ~80pt. Art gives way
 * before type or touch targets, so only the hero shrinks here; row size and gaps are
 * untouched. `optionCount` is omitted by Screen 5, which only wants this as a size
 * reference for its own (smaller) hero and never renders these rows.
 */
export function solveOutcomeHero(width: number, height: number, insets: Insets, optionCount?: number): Frame {
  const m = ONBOARDING_METRICS;
  const compact = isCompactPhoneViewport(width, height) || isShortPhoneViewport(height);
  const heroTop = insets.top + m.headerHeight + (compact ? 10 : 18);
  let heroHeight = Math.min(height * (compact ? 0.26 : 0.32), compact ? 176 : 224);

  if (optionCount !== undefined) {
    // Mirrors the row/gap/margin constants V2OnboardingOutcome derives from the same
    // `compact` flag — kept in one place would be nicer, but these are simple enough that
    // duplicating them here (rather than threading a layout object back through both
    // screens) keeps this a pure, easily-checked function.
    const rowHeight = compact ? 56 : 64;
    const rowGap = compact ? 8 : 10;
    const rowsMarginTop = compact ? 18 : 24;
    const ctaMarginTop = compact ? 16 : 22;
    const heroToPillGap = compact ? 14 : 22;
    const pillBlock = 28 + 14; // pill height + its margin-bottom
    const questionBlock = 32 * 2; // question lineHeight * its fixed 2 lines
    const supportBlock = 8 + 20; // support marginTop + lineHeight
    const rowsBlock = optionCount * rowHeight + (optionCount - 1) * rowGap;
    const fixedBelowHero =
      heroToPillGap + pillBlock + questionBlock + supportBlock + rowsMarginTop + rowsBlock + ctaMarginTop + m.ctaHeight;
    const bottomPad = Math.max(insets.bottom, 16) + 8;
    const available = height - heroTop - bottomPad;
    const heroFloor = compact ? 96 : 112;
    heroHeight = Math.max(heroFloor, Math.min(heroHeight, available - fixedBelowHero));
  }

  const heroWidth = Math.min(width - m.sidePad * 2, heroHeight * 1.05);
  return { x: (width - heroWidth) / 2, y: heroTop, width: heroWidth, height: heroHeight };
}

/** One of SEE / REINFORCE / MOVE: its art frame and its label column. */
export type SystemPiece = { art: Frame; column: { x: number; width: number } };

export type Screen5Layout = {
  hero: Frame;
  /** Top of the pill → support block (content column, full width). */
  pillTop: number;
  gaps: { pillRule: number; ruleHeadline: number; headlineSupport: number };
  headline: { fontSize: number; lineHeight: number };
  /** Top of the three-part system region. */
  systemTop: number;
  /** Bottom edge shared by the SEE art and the Anchor's footprint; labels sit below it. */
  artBaseline: number;
  /** Labels share this one baseline row. */
  labelTop: number;
  see: SystemPiece;
  reinforce: SystemPiece;
  move: SystemPiece;
  ctaTop: number;
  bottomPad: number;
  /** Which concession the solver reached: 0 = spacious. Exposed for tests. */
  tier: number;
};

const PILL_H = 28;
const RULE_H = 2;
const SUPPORT_LINE = 20;
/** The mechanism support copy is a full sentence now, not a three-word fragment — it wraps
 * up to 2 lines instead of 1. */
const SUPPORT_LINES = 2;
const LABEL_LINE = 18;
/** Each piece's description is a full clause now, not a two-word fragment — it wraps up to
 * 3 lines instead of 2. */
const DESC_LINES = 3;
const DESC_LINE = 18;

type Tier = {
  heroTop: number;
  heroPill: number;
  pillRule: number;
  ruleHeadline: number;
  headlineSupport: number;
  supportSystem: number;
  artLabel: number;
  labelDesc: number;
  descCta: number;
  headline: { fontSize: number; lineHeight: number };
};

/** Concessions in order: vertical gaps first, then (below) hero and system art size, and
 * only as a last resort the headline. Artwork and type are never the first thing to give. */
const TIERS: Tier[] = [
  { heroTop: 10, heroPill: 14, pillRule: 14, ruleHeadline: 14, headlineSupport: 8, supportSystem: 26, artLabel: 14, labelDesc: 4, descCta: 24, headline: { fontSize: 30, lineHeight: 35 } },
  { heroTop: 6, heroPill: 10, pillRule: 10, ruleHeadline: 10, headlineSupport: 6, supportSystem: 18, artLabel: 10, labelDesc: 3, descCta: 18, headline: { fontSize: 30, lineHeight: 35 } },
  { heroTop: 4, heroPill: 8, pillRule: 8, ruleHeadline: 8, headlineSupport: 5, supportSystem: 14, artLabel: 8, labelDesc: 2, descCta: 14, headline: { fontSize: 27, lineHeight: 31 } },
];

export function solveScreen5Layout(width: number, height: number, insets: Insets): Screen5Layout {
  const m = ONBOARDING_METRICS;
  const bottomPad = Math.max(insets.bottom, 16) + 8;
  const ctaTop = height - bottomPad - m.ctaHeight;
  const headerBottom = insets.top + m.headerHeight;

  const contentW = width - m.sidePad * 2;
  const colW = contentW / 3;
  // Hero is smaller than its Screen 4 state and never larger than the approved mockup's.
  const heroMax = Math.min(solveOutcomeHero(width, height, insets).height * 0.86, 196);
  const heroMin = 112;
  // The Anchor's natural size: most of its third, leaving air to SEE and MOVE either side.
  const bandMax = Math.min(colW * 0.9, 124);
  const bandMin = Math.min(colW * 0.78, 92);

  const fixed = (t: Tier) =>
    t.heroTop +
    t.heroPill +
    PILL_H +
    t.pillRule +
    RULE_H +
    t.ruleHeadline +
    t.headline.lineHeight * 2 +
    t.headlineSupport +
    SUPPORT_LINE * SUPPORT_LINES +
    t.supportSystem +
    t.artLabel +
    LABEL_LINE +
    t.labelDesc +
    DESC_LINES * DESC_LINE +
    t.descCta;
  const available = ctaTop - headerBottom;

  let tierIndex = 0;
  let hero = heroMax;
  let band = bandMax;
  // Walk gap tiers first at full art size; if even the tightest gaps don't fit, give the
  // remainder from the hero first, then from the system art.
  for (; tierIndex < TIERS.length; tierIndex++) {
    if (fixed(TIERS[tierIndex]) + heroMax + bandMax <= available) break;
  }
  if (tierIndex === TIERS.length) {
    tierIndex = TIERS.length - 1;
    let spare = available - fixed(TIERS[tierIndex]);
    hero = Math.max(heroMin, Math.min(heroMax, spare - bandMax));
    spare -= hero;
    band = Math.max(bandMin, Math.min(bandMax, spare));
  }
  const t = TIERS[tierIndex];
  // On tall screens, spare height is distributed intentionally:
  // 1) Generous breathing room between the mechanism explanation and the SEE / REINFORCE / MOVE visuals
  // 2) Proportional, flexible breathing room above the CTA button
  const slack = Math.max(0, available - fixed(t) - hero - band);
  const heroPillLift = Math.min(slack * 0.08, 6);
  const systemLift = Math.min(slack * 0.45, 45);

  const heroW = Math.min(contentW, hero * 1.05);
  // Hero y is capped to stay at or above Screen 4's hero y, preserving upward flight
  const heroFrame: Frame = { x: (width - heroW) / 2, y: headerBottom + t.heroTop, width: heroW, height: hero };
  const pillTop = heroFrame.y + hero + t.heroPill + heroPillLift;
  const supportBottom =
    pillTop + PILL_H + t.pillRule + RULE_H + t.ruleHeadline + t.headline.lineHeight * 2 + t.headlineSupport + SUPPORT_LINE * SUPPORT_LINES;
  const systemTop = supportBottom + t.supportSystem + systemLift;
  const artBaseline = systemTop + band;
  const labelTop = artBaseline + t.artLabel;

  const colX = (i: number) => m.sidePad + colW * i;
  const center = (i: number) => colX(i) + colW / 2;

  // REINFORCE: the circular Anchor, stable, centered in the middle third.
  const d = band;
  const reinforce: SystemPiece = {
    art: { x: center(1) - d / 2, y: artBaseline - d, width: d, height: d },
    column: { x: colX(1), width: colW },
  };
  const reinforceGap = Math.max(6, colW * 0.06);

  // SEE: wider and organic. Its feathered vignette may breathe into the left gutter but its
  // right edge stops short of the Anchor.
  const seeRight = reinforce.art.x - reinforceGap;
  const seeLeft = Math.max(m.sidePad * 0.35, colX(0) - m.sidePad * 0.7);
  const seeW = seeRight - seeLeft;
  const seeH = Math.min(band * 1.02, seeW * 0.86);
  const see: SystemPiece = {
    art: { x: seeLeft, y: artBaseline - seeH + band * 0.04, width: seeW, height: seeH },
    column: { x: colX(0), width: colW },
  };

  // MOVE: taller, rising above the band so its path and beacon read as upward movement.
  // Its open silhouette is kept whole; only its footprint is bounded to the right third.
  const moveLeft = reinforce.art.x + d + reinforceGap;
  const moveRightLimit = width - m.sidePad * 0.35;
  const moveH = Math.min(band * 1.22, (moveRightLimit - moveLeft) / MOVE_ASPECT);
  const moveW = moveH * MOVE_ASPECT;
  // Visual center locked within the right third.
  const moveX = Math.min(moveRightLimit - moveW, Math.max(moveLeft, center(2) - moveW / 2));
  const move: SystemPiece = {
    art: { x: moveX, y: artBaseline - moveH + band * 0.06, width: moveW, height: moveH },
    column: { x: colX(2), width: colW },
  };

  return {
    hero: heroFrame,
    pillTop,
    gaps: { pillRule: t.pillRule, ruleHeadline: t.ruleHeadline, headlineSupport: t.headlineSupport },
    headline: t.headline,
    systemTop,
    artBaseline,
    labelTop,
    see,
    reinforce,
    move,
    ctaTop,
    bottomPad,
    tier: tierIndex,
  };
}

/** Bottom of the description copy, for overlap checks. */
export function screen5CopyBottom(layout: Screen5Layout): number {
  return layout.labelTop + LABEL_LINE + TIERS[layout.tier].labelDesc + DESC_LINES * DESC_LINE;
}

export const SCREEN5_TYPE = { PILL_H, RULE_H, SUPPORT_LINE, LABEL_LINE, DESC_LINE } as const;
export const screen5LabelDescGap = (layout: Screen5Layout) => TIERS[layout.tier].labelDesc;

export type Screen8Layout = {
  anchor: Frame;
  contentTop: number;
  ctaTop: number;
  bottomPad: number;
};

export function solveScreen8Layout(width: number, height: number, insets: Insets): Screen8Layout {
  const m = ONBOARDING_METRICS;
  const compact = isCompactPhoneViewport(width, height) || isShortPhoneViewport(height);
  const bottomPad = Math.max(insets.bottom, 16) + 8;
  const ctaTop = height - bottomPad - m.ctaHeight;
  const headerBottom = insets.top + m.headerHeight;

  const anchorSize = Math.min(width * (compact ? 0.48 : 0.52), compact ? 180 : 220);
  const anchorY = headerBottom + (compact ? 14 : 26);
  const anchorFrame: Frame = {
    x: (width - anchorSize) / 2,
    y: anchorY,
    width: anchorSize,
    height: anchorSize,
  };

  const contentTop = anchorY + anchorSize + (compact ? 16 : 26);

  return {
    anchor: anchorFrame,
    contentTop,
    ctaTop,
    bottomPad,
  };
}
