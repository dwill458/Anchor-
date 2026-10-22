/**
 * Provider-side reference-image wrappers for Anchor artwork.
 *
 * Every provider appends a wrapper after the style prompt. That wrapper must agree with the prompt:
 * - LEGACY styles keep their historical standalone/transparent-artwork wrapper, byte for byte.
 * - ANCHOR 2.0 styles get a wrapper that reinforces the edge-to-edge material field instead.
 *
 * The branch is decided here, from the style registry, by style ID. It is never taken from a
 * client-supplied flag. Unknown or missing style IDs resolve to the legacy wrapper.
 */

import { getStyleGenerationVersion } from './anchor2StyleLibrary';

export type ReferenceWrapperProvider = 'nanoBanana' | 'geminiAdapter' | 'openAi';

// ── Legacy wrappers (moved verbatim from their call sites; fixtures guard them) ───────────────

const LEGACY_NANO_BANANA_TAIL = `REFERENCE IMAGE INSTRUCTION: The attached image contains the exact Anchor structure that must be preserved. Keep all main lines, circles, intersections, angles, nodes, and geometric relationships exactly as shown.
STANDALONE ARTWORK MANDATE:
- Generate a SINGLE standalone abstract geometric Anchor occupying approximately 75–85% of the available canvas width and height.
- Composition should radiate outward and make intentional use of the full canvas, while preserving comfortable negative space around the outer edge so strokes are never clipped.
- DO NOT generate borders, frames, boxes, rectangles, square containers, plaques, cards, windows, canvases, or enclosing shapes around the Anchor.
- DO NOT place a small glyph in the center of a larger decorative composition.
- DO NOT generate a background as part of the Anchor. Render the standalone symbol on a clean/transparent background.
- A rectangle may only survive when it is a small, clearly integral component of the distilled Anchor geometry. A dominant four-sided enclosure around the symbol is ALWAYS INVALID.
- The result must read instantly as one unified symbol when displayed inside a circle.`;

const LEGACY_GEMINI_ADAPTER_TAIL = `REFERENCE IMAGE INSTRUCTION: The attached image contains the exact Anchor structure that must be preserved. Keep all main lines, circles, intersections, angles, nodes, and geometric relationships exactly as shown. Build the selected visual world around this immutable structure. Enhancements may appear around it, behind it, beneath it, within the surrounding material field, through framing, atmosphere, lighting, surface treatment, and peripheral composition, but never by altering the Anchor geometry.`;

const LEGACY_OPENAI_TAIL = `CRITICAL COMPOSITION & STRUCTURAL INTEGRITY DIRECTIVE:
1. Preserve the geometric structure, core lines, angles, intersections, and balance of the intended Anchor design.
2. Build artistic texture, lighting, material atmosphere, framing, and depth around this structure.
3. No words, no typography, no letters, no numbers, no captions, no watermarks.
4. Render as a clean, high-resolution, centered artistic emblem on a dark or atmospheric background.`;

// ── Anchor 2.0 wrappers ──────────────────────────────────────────────────────────────────────

const ANCHOR2_REFERENCE_TAIL = `REFERENCE IMAGE INSTRUCTION: The attached image is a geometry reference only. Preserve the exact Anchor lines, circles, intersections, angles, nodes, and geometric relationships, but do not copy its stroke colour, empty surround, palette or visual treatment. The selected style is art direction for the complete artwork, not a literal instruction to reproduce the reference image.
ANCHOR 2.0 PRESENTATION REMINDER:
- Generate one complete edge-to-edge artwork. The selected style's material field is REQUIRED and fills the whole image; do not remove it or leave the Anchor floating on a blank canvas.
- The Anchor geometry remains the hero at approximately 75–85% of the usable composition, with outer breathing room so no stroke is clipped.
- Adaptive contrast: a light field takes a dark structure colour and a dark field takes a light structure colour. The reference image's stroke colour and empty surround are only a geometry diagram, not part of the artwork.
- Keep the area behind and around the geometry calm: reduce competing contrast, texture, lines and dots there, and move richer detail toward the perimeter.
- Do not add frames, cards, plaques, medallions, presentation plates, bounding boxes or extra enclosing rings. Preserve any perimeter that belongs to the supplied geometry exactly.
- Preserve all geometry exactly. Styling changes only the material appearance of the structure.`;

const ANCHOR2_OPENAI_TAIL = `CRITICAL COMPOSITION & STRUCTURAL INTEGRITY DIRECTIVE (ANCHOR 2.0):
1. Preserve the geometric structure, core lines, angles, intersections, and balance of the intended Anchor design exactly.
2. Treat the attached image as geometry reference only; do not copy its stroke colour, empty surround, palette or visual treatment. The chosen style is art direction, not a literal reproduction request.
3. Generate one complete edge-to-edge artwork. The selected style's material field is REQUIRED and fills the whole image.
4. The Anchor geometry remains the hero at approximately 75–85% of the usable composition, with breathing room so no stroke is clipped.
5. Adaptive contrast: a light field takes a dark structure colour and a dark field takes a light structure colour.
6. Keep the area behind and around the geometry calm and move richer detail toward the perimeter.
7. No frames, cards, plaques, medallions or extra enclosing rings. No words, no typography, no letters, no numbers, no captions, no watermarks.`;

const LEGACY_TAILS: Record<ReferenceWrapperProvider, string> = {
  nanoBanana: LEGACY_NANO_BANANA_TAIL,
  geminiAdapter: LEGACY_GEMINI_ADAPTER_TAIL,
  openAi: LEGACY_OPENAI_TAIL,
};

const ANCHOR2_TAILS: Record<ReferenceWrapperProvider, string> = {
  nanoBanana: ANCHOR2_REFERENCE_TAIL,
  geminiAdapter: ANCHOR2_REFERENCE_TAIL,
  openAi: ANCHOR2_OPENAI_TAIL,
};

/** The wrapper text appended after the style prompt for this provider and style. */
export function getReferenceImageWrapperTail(
  provider: ReferenceWrapperProvider,
  styleId?: string
): string {
  return getStyleGenerationVersion(styleId) === 'anchor2'
    ? ANCHOR2_TAILS[provider]
    : LEGACY_TAILS[provider];
}

/** Style prompt plus the provider wrapper, exactly as sent to the provider. */
export function buildReferenceImageWrapper(
  provider: ReferenceWrapperProvider,
  prompt: string,
  styleId?: string
): string {
  return `${prompt}\n\n${getReferenceImageWrapperTail(provider, styleId)}`;
}
