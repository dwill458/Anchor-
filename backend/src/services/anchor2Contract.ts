/**
 * Anchor 2.0 presentation contract — shared text blocks for the prompt builder, the provider
 * wrappers and the negative prompt.
 *
 * Anchor 2.0 styles are complete edge-to-edge material worlds, so the legacy "standalone artwork /
 * no background" mandate must never reach them. Every string here is written for that contract.
 *
 * COPY RULE: nothing in this file (or in anchor2StyleLibrary.ts) may ask for transparency or
 * describe the artwork as isolated, standalone, or on a plain/white/solid/blank background. The
 * patterns below are what the tests scan every assembled anchor2 prompt, wrapper and negative for.
 */

/** Patterns that must never appear in an assembled Anchor 2.0 prompt, wrapper or negative prompt. */
export const ANCHOR2_FORBIDDEN_PROMPT_PATTERNS: readonly RegExp[] = [
  /transparent/i,
  /no background/i,
  /isolated/i,
  /standalone/i,
  /\b(plain|white|solid)\s+background/i,
];

export const ANCHOR2_PRESENTATION_CONTRACT = `ANCHOR 2.0 PRESENTATION CONTRACT
--------------------------------------------------
This is an Anchor 2.0 visual style.

The supplied Anchor geometry is the immutable identity of the piece.

Generate one complete edge-to-edge artwork in which the selected style's material field is an intentional part of the composition.

The style field is REQUIRED.

Do not remove the field.
Do not replace it with an empty cut-out surround.
Do not leave the Anchor floating on a blank canvas.

The Anchor geometry remains the hero.

It should occupy approximately 75–85% of the usable composition while preserving enough outer breathing room that no structural stroke is clipped.

The selected style must remain recognizable even if the Anchor geometry were mentally removed from the image.

Do not add:
- frames
- cards
- plaques
- medallions
- presentation plates
- bounding boxes
- artificial containers
- extra enclosing rings

If the supplied Anchor geometry itself contains an integral perimeter or enclosed component, preserve it exactly.`;

export const ANCHOR2_ADAPTIVE_CONTRAST_RULE = `ADAPTIVE ANCHOR CONTRAST — LOCKED RULE
--------------------------------------------------
The structure colour adapts to the visual value behind it.

- If the field behind the Anchor is predominantly LIGHT, use a DARK structure colour appropriate to the style.
- If the field behind the Anchor is predominantly DARK, use a LIGHT structure colour appropriate to the style.

Do not force gold merely because the style contains gold.
Do not force the category colour onto the Anchor if contrast suffers.
Legibility has priority over palette loyalty.

The complete Anchor must remain continuously readable. If the field varies substantially beneath different parts of the geometry, the styling and field treatment must yield around the structure to keep contrast readable.

The reference image only diagrams the geometry. Its stroke colour and its empty surround are not part of the artwork; recolour the structure to the lane below and render the full style field around and behind it.`;

export const ANCHOR2_LEGIBILITY_FIELD = `ANCHOR-AWARE LEGIBILITY FIELD
--------------------------------------------------
The protected area follows the actual Anchor footprint, not a fixed centre region.

Wherever the supplied geometry runs:
- reduce competing contrast
- reduce high-frequency texture
- suppress stroke-like background marks
- soften hard boundaries where necessary
- keep material detail subordinate
- keep a clear separation between the Anchor and the field

The Anchor must always be the strongest coherent line structure in the image.

Move richer competing detail toward the perimeter whenever appropriate.

The field does not become blank: it stays recognizably part of the selected style. Control WHERE visual complexity occurs; do not flatten the whole style to solve legibility.

LEGIBILITY HAZARDS
Within or immediately behind the Anchor footprint, strongly suppress competing:
- thin lines
- hairline cracks
- veins
- stems
- drips
- ruled lines
- stripes
- small dots
- star speckle
- fragments
- scratches
- hard stencil boundaries
- dense stippling
- crystalline or crinkled texture
- text-like marks
- high-frequency grain
- tiny geometric edges
- strong value transitions

This is a spatial rule, not a ban: if the selected style uses one of these features, it may appear away from the Anchor footprint and must stay subordinate to the Anchor.`;

export const ANCHOR2_TEXTURE_DEFAULT = `GLOBAL TEXTURE DEFAULT
--------------------------------------------------
Unless the style's material requires otherwise, surfaces use a smooth, fine, low-contrast tooth.
Avoid wrinkled, crystalline or stippled filter-like texture anywhere in the image.`;

export const ANCHOR2_MATERIAL_TRUTH = `MATERIAL TRUTH
--------------------------------------------------
Render the physical material the style names. Do not make every style glossy, glowing, animated, dimensional, metallic, mystical or premium in the same way. Some styles are intentionally flat, casual, cute, quiet, handmade, soft, matte or raw; keep them that way and do not upgrade them into glossy or cinematic images.

Physical material identity takes priority over generic AI spectacle.`;

export const ANCHOR2_VARIATION_MODEL = `VARIATION MODEL
--------------------------------------------------
The style defines a visual grammar, not a template. Keep the LOCKED CORE intact, vary within ALLOWED VARIATION, and never enter PROHIBITED DRIFT.

Do not copy a fixed composition: do not reproduce the same corners, patches, leaves, paint marks or motif positions from render to render. The supplied Anchor geometry determines the composition; users who choose the same style should receive related but individually composed results.

Actively vary the dominant and accent colours within the style's material world. Across different Anchors, explore a broad range including cobalt and sky blue, turquoise, teal, rust and vivid orange, marigold and lemon yellow, coral, red, green, violet, warm neutrals and cool neutrals. Do not default to cream, black, red, teal and gold as a repeated palette. Use a coherent palette with a clear dominant hue and one or two supporting accents; preserve material truth and Anchor contrast.`;

/**
 * Terms in the legacy global negative prompt that would forbid surfaces or textures the Anchor 2.0
 * styles require (woven canvas, plaster slabs, stone-like mineral surface, paper mounting stock).
 * They are stripped from the Anchor 2.0 negative only; the legacy negative is untouched.
 */
export const ANCHOR2_REMOVED_GLOBAL_NEGATIVE_TERMS: readonly string[] = [
  'canvases',
  'slabs',
  'stone tablets',
  'mats',
  'mounting board',
];

/** Constraints added for Anchor 2.0. Spatial subordination, not blanket bans. */
export const ANCHOR2_NEGATIVE_ADDITIONS: readonly string[] = [
  'unreadable Anchor',
  'low contrast Anchor',
  'Anchor blending into background',
  'background linework competing with Anchor',
  'hairline cracks crossing Anchor',
  'stems crossing Anchor',
  'veins crossing Anchor',
  'long paint drips crossing Anchor',
  'dense star speckle behind Anchor',
  'ruled stripes behind Anchor',
  'tiny high-contrast dots behind Anchor',
  'crystalline texture behind Anchor',
  'crinkled foil texture dominating image',
  'noisy stipple behind Anchor',
  'hard value boundary cutting through Anchor',
  'excessive background detail obscuring Anchor',
];
