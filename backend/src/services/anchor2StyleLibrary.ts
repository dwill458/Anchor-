/**
 * Anchor 2.0 style registry — the single authoritative catalog for the 15 Anchor 2.0 styles.
 *
 * Anchor 2.0 is an ADDITIVE generation system. Legacy (Anchor 1.5) styles live in
 * stylePromptLibrary.ts and keep their transparent/standalone artwork contract untouched.
 * Everything here describes complete edge-to-edge material worlds, so these definitions are
 * rendered through a different prompt contract (see anchor2Contract.ts / buildStylePrompt).
 *
 * This file is a leaf module (types only from ../types) so both the prompt builder and the
 * provider wrappers can resolve generation versions without circular imports.
 *
 * COPY RULE: style text here ends up inside provider prompts. Never write transparency or
 * "no/plain/solid/white background" language, and never describe a style as isolated or
 * standalone — a test scans every definition for those terms.
 */

import {
  ANCHOR2_STYLE_IDS,
  type Anchor2StyleId,
  type StyleAvailability,
  type StyleGenerationVersion,
  type VisualLanguageDNA,
} from '../types';

export { ANCHOR2_STYLE_IDS };
export type { Anchor2StyleId, StyleAvailability, StyleGenerationVersion };

export type PaletteFieldValue = 'light' | 'dark' | 'mixed';

/**
 * One palette expression of a style. The lane is picked deterministically from a seed, and the
 * builder turns it into an explicit structure-colour instruction (adaptive Anchor contrast).
 */
export interface Anchor2PaletteLane {
  id: string;
  label: string;
  /** Predominant value of the field behind the Anchor. */
  fieldValue: PaletteFieldValue;
  /** What the field looks like in this lane. */
  field: string;
  /** Colour family of the structure in this lane. Must contrast with the field. */
  anchorTone: string;
  /** Value of the structure. Light fields need dark structure, dark fields need light structure. */
  anchorValue: 'light' | 'dark';
}

export interface Anchor2StyleDefinition {
  id: Anchor2StyleId;
  generationVersion: 'anchor2';
  availability: StyleAvailability;
  /**
   * Public-facing label. Product-configurable and NEVER used inside prompts, so renaming a
   * style (clay_v2 is still a working name) cannot change generation behavior or the stable ID.
   */
  displayName: string;
  /** Prompt-facing descriptive name of the material world. Stable, not marketing copy. */
  materialName: string;
  styleFamily: string;
  /** The properties that make the style recognizably itself. */
  lockedCore: string[];
  /** What generation should vary between users and renders. */
  allowedVariation: string[];
  /** Traits that would collapse the style into another style or generic AI art. */
  prohibitedDrift: string[];
  paletteLanes: Anchor2PaletteLane[];
  /** Concrete material subtypes the seed can pick between (kept inside the locked core). */
  materialVariants: string[];
  materialBehavior: string;
  /** How the Anchor structure is physically made. Never changes geometry. */
  anchorRendering: string;
  /** Style-native motifs, used sparingly and kept away from the Anchor footprint. */
  styleNativeMotifs: string[];
  /** Style-specific rule for keeping this style's richest feature subordinate to the Anchor. */
  legibilityRule: string;
  /** How category/intention may bend the style without replacing it. */
  categoryInfluence: string;
  /** Required for every Anchor 2.0 style; see REQUIRED_ANCHOR2_DNA_KEYS. */
  visualLanguage: VisualLanguageDNA;
}

/** DNA fields every Anchor 2.0 style must define (validated, not defaulted). */
export const REQUIRED_ANCHOR2_DNA_KEYS = [
  'coreArtWorld',
  'primaryMedium',
  'substrate',
  'edgeBehavior',
  'lightBehavior',
  'textureLogic',
  'depthLogic',
  'ornamentSystem',
  'shouldFeelLike',
  'mustNotFeelLike',
  'crossStyleAvoidances',
  'negativePromptAdditions',
] as const satisfies readonly (keyof VisualLanguageDNA)[];

const ANCHOR2_COLORWAYS = [
  {
    id: 'cobalt',
    name: 'Cobalt blue',
    light: 'cobalt and sky blue with small warm coral accents',
    dark: 'deep cobalt and midnight blue with pale blue and warm coral accents',
  },
  {
    id: 'turquoise',
    name: 'Turquoise',
    light: 'turquoise and sea-glass teal with small amber accents',
    dark: 'deep teal and petrol blue with bright turquoise and amber accents',
  },
  {
    id: 'emerald',
    name: 'Emerald green',
    light: 'emerald and leaf green with pale sage accents',
    dark: 'deep forest green with vivid emerald and pale sage accents',
  },
  {
    id: 'violet',
    name: 'Violet',
    light: 'violet and plum with small lilac and rose accents',
    dark: 'deep plum and indigo-violet with bright lilac accents',
  },
  {
    id: 'orange',
    name: 'Burnt orange',
    light: 'burnt orange and vermilion with small cobalt accents',
    dark: 'deep rust and oxblood with vivid orange and cobalt accents',
  },
  {
    id: 'marigold',
    name: 'Marigold yellow',
    light: 'marigold and lemon yellow with small indigo accents',
    dark: 'deep indigo and umber with vivid marigold and lemon accents',
  },
  {
    id: 'coral',
    name: 'Coral',
    light: 'coral and warm rose with small muted blue accents',
    dark: 'deep rose and burgundy with bright coral and muted blue accents',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    light: 'indigo and periwinkle with small apricot accents',
    dark: 'deep navy and indigo with pale periwinkle and apricot accents',
  },
] as const;

function buildStyleColorwayLanes(definition: Anchor2StyleDefinition): Anchor2PaletteLane[] {
  const material = definition.materialName;
  const substrate = definition.visualLanguage.substrate;
  const generated = ANCHOR2_COLORWAYS.flatMap(colorway => [
    {
      id: `colorway_light_${colorway.id}`,
      label: `${colorway.name} on a light field`,
      fieldValue: 'light' as const,
      field: `A light-toned ${material} field with a clearly visible ${colorway.name.toLowerCase()} palette: ${colorway.light}. Keep the ${substrate} and express the colors through its native material behavior and texture. The named hue must be visible across broad areas, not only as tiny accents.`,
      anchorTone: 'deep ink, charcoal or the style’s darkest native tone',
      anchorValue: 'dark' as const,
    },
    {
      id: `colorway_dark_${colorway.id}`,
      label: `${colorway.name} on a dark field`,
      fieldValue: 'dark' as const,
      field: `A dark-toned ${material} field with a clearly visible ${colorway.name.toLowerCase()} palette: ${colorway.dark}. Keep the ${substrate} and express the colors through its native material behavior and texture. The named hue must be visible across broad areas, not only as tiny accents.`,
      anchorTone: 'warm cream, pale silver or the style’s lightest native tone',
      anchorValue: 'light' as const,
    },
  ]);

  return [...definition.paletteLanes, ...generated];
}

const defineAnchor2Style = (definition: Anchor2StyleDefinition): Anchor2StyleDefinition => ({
  ...definition,
  paletteLanes: buildStyleColorwayLanes(definition),
});

// ============================================================================
// The 15 Anchor 2.0 styles
// ============================================================================

export const ANCHOR2_STYLE_LIBRARY: Record<Anchor2StyleId, Anchor2StyleDefinition> = {
  // ── 01 Velvet Ember ───────────────────────────────────────────────────────
  velvet_ember_v2: defineAnchor2Style({
    id: 'velvet_ember_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Velvet Ember',
    materialName: 'velvet pile with ember-warm pigment concentration',
    styleFamily: 'Soft Textile Pile',
    lockedCore: [
      'rich tactile velvet or suede-like surface with a soft matte pile',
      'subtle directional nap with broad tonal variation',
      'deep tonal warmth with ember-like pigment concentration',
      'tactile, intimate, dramatic and warm, luxurious without turning metallic',
    ],
    allowedVariation: [
      'deep rose, wine, ember-orange, aubergine and dark warm neutrals',
      'pile direction',
      'where the pigment concentrates',
      'depth of the tonal shift across the field',
    ],
    prohibitedDrift: [
      'fire, flames, sparks or glowing particles',
      'molten material',
      'metallic foil',
      'cosmic stars',
      'glossy satin sheen',
      'obvious fabric folds or drapery',
      'hard cracks',
    ],
    paletteLanes: [
      {
        id: 'wine_aubergine',
        label: 'Wine and aubergine',
        fieldValue: 'dark',
        field: 'deep wine and aubergine pile with a slow warm shift toward dark rose',
        anchorTone: 'pale blush-cream',
        anchorValue: 'light',
      },
      {
        id: 'ember_umber',
        label: 'Ember and umber',
        fieldValue: 'dark',
        field:
          'dark umber pile warming into a soft ember-orange concentration toward the perimeter',
        anchorTone: 'pale warm cream',
        anchorValue: 'light',
      },
      {
        id: 'dusty_rose',
        label: 'Dusty deep rose',
        fieldValue: 'mixed',
        field: 'mid-depth dusty rose pile with lighter and deeper tonal passages',
        anchorTone: 'deep aubergine-black',
        anchorValue: 'dark',
      },
    ],
    materialVariants: [
      'cotton velvet',
      'suede-like brushed leather-free pile',
      'dense short-nap velour',
    ],
    materialBehavior: 'soft matte pile with a subtle directional nap and broad tonal variation',
    anchorRendering:
      'the structure reads as a pressed, flattened channel in the pile or as a contrasting short-pile band, with the same soft matte nap as the field, never as a raised metallic or glossy line',
    styleNativeMotifs: [
      'pile direction shifts',
      'soft pigment pooling',
      'broad tonal clouds in the nap',
    ],
    legibilityRule:
      'keep nap direction changes and pigment concentration low contrast behind the geometry; let the richest tonal depth gather toward the perimeter',
    categoryInfluence:
      'category and intention may shift pigment temperature, how much ember concentrates, and tonal pressure toward the edges',
    visualLanguage: {
      coreArtWorld:
        'A rich tactile velvet world: dense soft pile, subtle directional nap and deep warm pigment that pools like embers without any fire.',
      primaryMedium: 'dyed velvet or suede-like pile fabric',
      substrate: 'the pile surface itself, filling the entire canvas edge to edge',
      edgeBehavior: 'soft, pile-feathered transitions with no hard cut lines',
      lightBehavior:
        'low, diffuse light that rolls across the nap; matte, with no specular streaks',
      textureLogic: 'fine dense pile with gentle directional brushing and broad tonal variation',
      depthLogic:
        'depth comes from pile direction and tonal pooling, never from folds or dimensional objects',
      ornamentSystem: 'no ornament; the pile and its pigment are the whole composition',
      shouldFeelLike: 'touching dark velvet in a warm room: tactile, intimate, dramatic',
      mustNotFeelLike: 'fire art, metallic foil, glossy satin, a cosmic scene or draped cloth',
      crossStyleAvoidances: [
        'no metallic shimmer or foil from Gilt or Alloy',
        'no weave or visible thread from Woven',
        'no stars from Deep Cosmos',
        'no felt appliqué forms from Plush',
      ],
      negativePromptAdditions: [
        'fire',
        'flames',
        'sparks',
        'glowing particles',
        'molten material',
        'metallic foil',
        'cosmic stars',
        'glossy satin',
        'fabric folds',
        'draped cloth',
        'hard cracks',
      ],
    },
  }),

  // ── 02 Prism Flow ─────────────────────────────────────────────────────────
  prism_flow_v2: defineAnchor2Style({
    id: 'prism_flow_v2',
    generationVersion: 'anchor2',
    availability: 'rotation',
    displayName: 'Prism Flow',
    materialName: 'translucent gel-like optical colour with flowing spectral transitions',
    styleFamily: 'Optical Colour',
    lockedCore: [
      'translucent optical colour with smooth refractive, gel-like forms',
      'flowing spectral transitions that read as broad soft colour movement',
      'optical, fluid, playful and contemporary',
    ],
    allowedVariation: [
      'spectral palette choice',
      'translucent layering depth',
      'direction and scale of the broad colour movement',
      'softness of the refractive forms',
    ],
    prohibitedDrift: [
      'chrome or metal',
      'bubbles covering the Anchor',
      'hard bevel frame',
      'glass-card interface look',
      'neon sci-fi HUD',
      'cosmic imagery',
      'excessive glossy highlights',
      'tiny repeated cells',
    ],
    paletteLanes: [
      {
        id: 'pearl_spectrum',
        label: 'Pearl spectrum',
        fieldValue: 'light',
        field: 'milky pearl with soft lilac, sky and peach gel washes flowing across it',
        anchorTone: 'deep ink-indigo',
        anchorValue: 'dark',
      },
      {
        id: 'dusk_spectrum',
        label: 'Dusk spectrum',
        fieldValue: 'dark',
        field: 'deep indigo-violet gel with broad teal and magenta flow',
        anchorTone: 'pale pearl-white',
        anchorValue: 'light',
      },
      {
        id: 'drift_spectrum',
        label: 'Drifting spectrum',
        fieldValue: 'mixed',
        field: 'translucent layers moving between warm and cool, light and deep',
        anchorTone: 'deep indigo-black',
        anchorValue: 'dark',
      },
    ],
    materialVariants: ['soft gel layers', 'thin refractive film', 'fluid dyed resin sheet'],
    materialBehavior: 'smooth translucent forms with broad refractive colour transitions',
    anchorRendering:
      'the structure reads as a dense, saturated gel-like band whose colour is a single deep or pale tone chosen for contrast, with smooth soft edges and no glassy highlights',
    styleNativeMotifs: [
      'broad spectral sweeps',
      'overlapping translucent layers',
      'soft refractive fades',
    ],
    legibilityRule:
      'keep optical transitions broad and slow behind the geometry so no colour boundary cuts across a stroke; concentrate vivid spectral shifts toward the perimeter',
    categoryInfluence:
      'category and intention may steer which spectral range flows and how fast the colour moves',
    visualLanguage: {
      coreArtWorld:
        'A translucent optical world: smooth gel-like forms and spectral colour that flows and refracts, playful and contemporary.',
      primaryMedium: 'layered translucent gel and refracted colour',
      substrate:
        'a continuous field of overlapping translucent colour filling the canvas edge to edge',
      edgeBehavior: 'soft, smoothly blended boundaries between colour layers',
      lightBehavior:
        'broad even light passing through the layers; restrained, soft highlights only',
      textureLogic: 'smooth and seamless; no grain, no cellular pattern',
      depthLogic: 'depth from overlapping translucent layers, never from bevels or hard shadows',
      ornamentSystem: 'no ornament; the colour flow is the composition',
      shouldFeelLike: 'light moving through coloured gel: fluid, optical, playful',
      mustNotFeelLike: 'chrome, a glass user-interface card, a sci-fi display or a bubble scene',
      crossStyleAvoidances: [
        'no chrome or brushed metal from Alloy',
        'no stars or space imagery from Deep Cosmos',
        'no paint gestures from Joybrush',
      ],
      negativePromptAdditions: [
        'chrome',
        'metal',
        'bubbles',
        'hard bevel frame',
        'glass card interface',
        'neon HUD',
        'cosmic imagery',
        'excessive glossy highlights',
        'tiny repeated cells',
      ],
    },
  }),

  // ── 03 Deep Cosmos ────────────────────────────────────────────────────────
  deep_cosmos_v2: defineAnchor2Style({
    id: 'deep_cosmos_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Deep Cosmos',
    materialName: 'deep atmospheric space-like colour field',
    styleFamily: 'Atmospheric Colour Field',
    lockedCore: [
      'the feeling of deep space expressed as a deep atmospheric colour field',
      'dark, quiet, vast depth with soft tonal gradation',
      'sparse soft stellar texture only',
    ],
    allowedVariation: [
      'deep navy, indigo, violet, near-black blue and restrained burgundy',
      'sparse soft stellar texture density',
      'tonal gradation direction',
      'where the depth deepens or lifts',
    ],
    prohibitedDrift: [
      'planets, moons or galaxies',
      'literal nebula clouds',
      'constellations or zodiac',
      'astronomy diagrams',
      'glowing portals',
      'excessive star fields',
      'sci-fi HUD',
      'mystical circles',
    ],
    paletteLanes: [
      {
        id: 'navy_depth',
        label: 'Deep navy',
        fieldValue: 'dark',
        field: 'deep navy field with slow gradation toward near-black at the edges',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
      {
        id: 'indigo_violet',
        label: 'Indigo and violet',
        fieldValue: 'dark',
        field: 'deep indigo moving into restrained violet',
        anchorTone: 'pale lavender-white',
        anchorValue: 'light',
      },
      {
        id: 'blue_black',
        label: 'Near-black blue',
        fieldValue: 'dark',
        field: 'near-black blue with barely lifted tonal depth',
        anchorTone: 'pale ice-cream',
        anchorValue: 'light',
      },
      {
        id: 'burgundy_night',
        label: 'Restrained burgundy',
        fieldValue: 'dark',
        field: 'dark burgundy-black shifting toward deep blue',
        anchorTone: 'pale warm cream',
        anchorValue: 'light',
      },
      // Lifted lanes: still deep and quiet, but a broad soft rise in value, so the pair of Forms is
      // not two near-black fields that differ only by a hue shift.
      {
        id: 'dusk_lift',
        label: 'Lifted dusk',
        fieldValue: 'mixed',
        field:
          'deep indigo-black lifting softly toward a broad, hazy dusk-rose glow along one side, graded without any visible light source or shape',
        anchorTone: 'pale warm cream',
        anchorValue: 'light',
      },
      {
        id: 'teal_lift',
        label: 'Lifted cold teal',
        fieldValue: 'mixed',
        field:
          'near-black blue lifting softly toward a wide, hazy cold-teal and slate-blue glow across the lower field, graded without any visible light source or shape',
        anchorTone: 'pale ice-white',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'matte velvet-dark atmospheric wash',
      'soft airbrushed depth',
      'deep pigment haze',
    ],
    materialBehavior: 'soft matte atmospheric depth with very sparse, soft stellar texture',
    anchorRendering:
      'the structure reads as a fine continuous filament of pale pigment lit from within, even and steady in weight, with the same soft stellar grain running through the line as through the field and a faint, tight halo of light along its edges; never as glowing particles, a trail or a portal',
    styleNativeMotifs: ['soft depth gradation', 'a few distant soft points of light'],
    legibilityRule:
      'star and speckle density must thin to nothing around the geometry; keep every point of light soft and small, gathered toward the perimeter',
    categoryInfluence:
      'category and intention may shift the hue of the depth and how much stellar texture gathers at the edges',
    visualLanguage: {
      coreArtWorld:
        'The feeling of deep space as a quiet atmospheric colour field: vast, dark and softly graded, with only sparse soft stellar texture.',
      primaryMedium: 'deep matte atmospheric pigment',
      substrate: 'a continuous dark colour field filling the canvas edge to edge',
      edgeBehavior: 'soft gradations with no hard boundaries',
      lightBehavior: 'ambient and restrained; no glow, no lens flare, no rays',
      textureLogic: 'smooth, fine and very sparse soft speckle, thinning toward the centre',
      depthLogic: 'depth from slow tonal gradation across the whole field',
      ornamentSystem: 'no ornament; only sparse soft stellar texture near the perimeter',
      shouldFeelLike: 'standing in a quiet dark sky: vast, calm, deep',
      mustNotFeelLike:
        'an astronomy poster, a nebula photograph, a zodiac chart or a sci-fi screen',
      crossStyleAvoidances: [
        'no literal astronomy',
        'no mystical circles or portals',
        'no spectral rainbow flow from Prism Flow',
      ],
      negativePromptAdditions: [
        'planets',
        'moons',
        'galaxies',
        'nebula clouds',
        'constellations',
        'zodiac',
        'astronomy diagram',
        'glowing portal',
        'dense star field',
        'sci-fi HUD',
        'mystical circles',
      ],
    },
  }),

  // ── 04 Joybrush ───────────────────────────────────────────────────────────
  joybrush_v2: defineAnchor2Style({
    id: 'joybrush_v2',
    generationVersion: 'anchor2',
    availability: 'rotation',
    displayName: 'Joybrush',
    materialName: 'expressive gestural hand-painted pigment on a primed surface',
    styleFamily: 'Gestural Paint',
    lockedCore: [
      'expressive gestural pigment with visible hand-painted energy',
      'joyful, spontaneous, artistic and energetic',
      'a composed painting, not a pattern',
    ],
    allowedVariation: [
      'brush direction',
      'palette',
      'pigment density',
      'stroke size',
      'where strokes cluster toward the edges',
    ],
    prohibitedDrift: [
      'repeating pattern or wallpaper',
      'confetti-only composition',
      'geometric vector art',
      'graffiti wall',
      'readable lettering',
      'literal objects',
      'glossy paint blobs',
      'heavy splatter through the Anchor',
    ],
    paletteLanes: [
      {
        id: 'chalk_ground',
        label: 'Chalk ground, bright pigment',
        fieldValue: 'light',
        field:
          'warm chalk-white primed ground with bright gestural pigment gathered toward the perimeter',
        anchorTone: 'deep ink-navy',
        anchorValue: 'dark',
      },
      {
        id: 'saturated_field',
        label: 'Saturated painted field',
        fieldValue: 'mixed',
        field:
          'broad saturated brush passages with a calmer, quieter tonal zone through the middle',
        anchorTone: 'deep ink-black',
        anchorValue: 'dark',
      },
      {
        id: 'ink_ground',
        label: 'Dark ground, warm pigment',
        fieldValue: 'dark',
        field: 'deep ink-blue ground with warm, bright gestural pigment around the edges',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
    ],
    materialVariants: ['opaque gouache', 'loaded acrylic', 'chalky oil-bar pigment'],
    materialBehavior: 'matte hand-applied pigment with visible brush direction and honest edges',
    anchorRendering:
      'the structure reads as a confident, even brush-laid line of a single contrasting pigment, hand-painted yet following the supplied geometry exactly',
    styleNativeMotifs: [
      'broad brush sweeps',
      'loaded-brush edges',
      'dry-brush drags at the perimeter',
    ],
    legibilityRule:
      'keep major gestural activity at the perimeter and calm the brushwork across the geometry footprint; no stroke should read as part of the Anchor',
    categoryInfluence:
      'category and intention may steer palette temperature, stroke energy and how the gestures cluster',
    visualLanguage: {
      coreArtWorld:
        'An expressive painted world: spontaneous, joyful brushwork with real pigment, composed so the energy lives at the edges.',
      primaryMedium: 'hand-applied opaque pigment',
      substrate: 'a primed painted ground filling the canvas edge to edge',
      edgeBehavior: 'honest brush edges, dry-brush drags and soft pigment overlaps',
      lightBehavior: 'even matte light; no wet gloss',
      textureLogic: 'visible brush direction and pigment density, fine canvas tooth beneath',
      depthLogic: 'depth from layered passes of paint, never from dimensional blobs',
      ornamentSystem: 'no ornament; the painted gestures are the composition',
      shouldFeelLike: 'a joyful painting made quickly by hand',
      mustNotFeelLike: 'wallpaper, confetti, graffiti, a vector illustration or glossy paint blobs',
      crossStyleAvoidances: [
        'no worn urban wall surface from Buff',
        'no bold flat shape composition from Graphic',
        'no flash-paper linework from Flash',
      ],
      negativePromptAdditions: [
        'repeating pattern',
        'wallpaper',
        'confetti',
        'geometric vector art',
        'graffiti wall',
        'readable lettering',
        'literal objects',
        'glossy paint blobs',
        'heavy splatter',
      ],
    },
  }),

  // ── 05 Porcelain ──────────────────────────────────────────────────────────
  porcelain_v2: defineAnchor2Style({
    id: 'porcelain_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Porcelain',
    materialName: 'glazed porcelain ceramic with restrained crackle character',
    styleFamily: 'Glazed Ceramic',
    lockedCore: [
      'real glazed ceramic or porcelain material',
      'smooth soft-sheen glaze with gentle depth',
      'restrained crackle character, never dense',
    ],
    allowedVariation: [
      'cream, celadon, pale blue, blush and dark ceramic expressions',
      'glaze warmth',
      'where the restrained crackle is distributed',
    ],
    prohibitedDrift: [
      'marble or stone',
      'metallic veins',
      'glowing cracks',
      'shattered ceramic',
      'gold-repaired breaks',
      'dense cracks behind the Anchor',
      'liquid glass',
    ],
    paletteLanes: [
      {
        id: 'cream_glaze',
        label: 'Cream glaze',
        fieldValue: 'light',
        field: 'warm cream porcelain glaze with soft depth',
        anchorTone: 'deep ink-blue',
        anchorValue: 'dark',
      },
      {
        id: 'celadon_glaze',
        label: 'Celadon glaze',
        fieldValue: 'light',
        field: 'pale celadon green glaze, gently pooled toward the edges',
        anchorTone: 'deep forest-green-black',
        anchorValue: 'dark',
      },
      {
        id: 'pale_blue_glaze',
        label: 'Pale blue glaze',
        fieldValue: 'light',
        field: 'pale blue-white porcelain glaze',
        anchorTone: 'deep cobalt-ink',
        anchorValue: 'dark',
      },
      {
        id: 'blush_glaze',
        label: 'Blush glaze',
        fieldValue: 'light',
        field: 'soft blush porcelain glaze',
        anchorTone: 'deep oxblood-brown',
        anchorValue: 'dark',
      },
      {
        id: 'dark_ceramic',
        label: 'Dark ceramic',
        fieldValue: 'dark',
        field: 'deep ink-blue or oxblood ceramic glaze with soft sheen',
        anchorTone: 'pale ivory',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'bone-white porcelain',
      'soft-fired celadon stoneware glaze',
      'satin-glazed ceramic',
    ],
    materialBehavior:
      'smooth glaze with a soft satin sheen and a few fine, restrained crackle lines',
    anchorRendering:
      'the structure reads as a glazed inlay: a fine channel set into the porcelain and filled with contrasting glaze or underglaze pigment, smooth and even, with a thin pale glaze rim along both edges and the same soft sheen as the field; the line is part of the ceramic, never drawn on top of it',
    styleNativeMotifs: [
      'soft glaze pooling at the perimeter',
      'a few restrained crackle lines near the edges',
    ],
    legibilityRule:
      'crackle must soften and clear behind the geometry; keep any crackle at the perimeter and fine, never crossing a stroke',
    categoryInfluence:
      'category and intention may shift glaze warmth and how much crackle gathers at the edges',
    visualLanguage: {
      coreArtWorld:
        'A real glazed porcelain world: smooth, softly lustrous ceramic with the faintest restrained crackle at its edges.',
      primaryMedium: 'glazed porcelain ceramic',
      substrate: 'a continuous glazed ceramic surface filling the canvas edge to edge',
      edgeBehavior: 'soft glaze pooling and gentle tonal shifts; no chips or breaks',
      lightBehavior: 'soft broad daylight with a gentle satin sheen and no hard highlights',
      textureLogic:
        'smooth fine glaze with very sparse, hairline-fine crackle only near the perimeter',
      depthLogic: 'depth from glaze thickness and gentle pooling',
      ornamentSystem: 'no ornament; the glaze and its restrained crackle are the composition',
      shouldFeelLike: 'holding a piece of fine porcelain: quiet, smooth, cool to the touch',
      mustNotFeelLike: 'marble, shattered pottery, kintsugi, liquid glass or a tile wall',
      crossStyleAvoidances: [
        'no marble or stone veining',
        'no gold repair lines from Gilt',
        'no powdery matte from Clay',
      ],
      negativePromptAdditions: [
        'marble',
        'stone',
        'metallic veins',
        'glowing cracks',
        'shattered ceramic',
        'gold-repaired cracks',
        'dense cracks',
        'liquid glass',
      ],
    },
  }),

  // ── 06 Woven ──────────────────────────────────────────────────────────────
  woven_v2: defineAnchor2Style({
    id: 'woven_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Woven',
    materialName: 'flat woven textile surface',
    styleFamily: 'Flat Textile',
    lockedCore: [
      'an actual flat woven fabric surface',
      'fine, even weave that stays visually simple',
      'honest textile character: linen, cotton, denim-like weave or fine canvas',
    ],
    allowedVariation: [
      'fibre type',
      'weave scale within fine limits',
      'colour',
      'mild irregularity in the yarn',
    ],
    prohibitedDrift: [
      'embroidery or stitched illustration as background decoration',
      'fabric folds or draped cloth',
      'quilting',
      'visible seams',
      'plaid or stripes',
      'repeating decorative textile patterns',
      'leather',
      'glossy synthetic fabric',
    ],
    paletteLanes: [
      {
        id: 'oatmeal_linen',
        label: 'Oatmeal linen',
        fieldValue: 'light',
        field: 'natural oatmeal linen with a fine, even weave',
        anchorTone: 'deep indigo-ink',
        anchorValue: 'dark',
      },
      {
        id: 'indigo_denim',
        label: 'Indigo denim-like weave',
        fieldValue: 'dark',
        field: 'deep indigo denim-like twill weave, fine and even',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
      {
        id: 'charcoal_cotton',
        label: 'Charcoal cotton',
        fieldValue: 'dark',
        field: 'charcoal cotton with a fine plain weave',
        anchorTone: 'pale bone-white',
        anchorValue: 'light',
      },
      {
        id: 'dusty_blue_canvas',
        label: 'Dusty blue canvas',
        fieldValue: 'mixed',
        field: 'dusty blue fine canvas with a slightly lighter, calmer middle',
        anchorTone: 'deep navy-ink',
        anchorValue: 'dark',
      },
    ],
    materialVariants: ['fine linen', 'combed cotton', 'denim-like twill', 'fine canvas'],
    materialBehavior: 'a fine flat weave with natural, mild yarn irregularity and matte fibre',
    anchorRendering:
      'the structure reads as hand stitching: a contrasting thread sewn through the cloth in short, even, individually visible stitches that follow the supplied geometry exactly, with a faint thread ply and a soft shadow where each stitch dips into the weave; the stitching is the structure only, never decorative embroidery elsewhere',
    styleNativeMotifs: ['gentle yarn irregularity', 'slight tonal variation in the fibre'],
    legibilityRule:
      'the weave must be fine and even enough that it never reads as a competing line pattern; keep the weave scale uniform behind the geometry',
    categoryInfluence:
      'category and intention may shift the fabric colour and how much yarn irregularity appears',
    visualLanguage: {
      coreArtWorld:
        'A simple honest textile world: a fine, flat woven fabric surface, with nothing cinematic added to it.',
      primaryMedium: 'woven textile fibre',
      substrate: 'a flat, fine woven cloth filling the canvas edge to edge',
      edgeBehavior: 'no edges; the cloth continues to the borders of the canvas',
      lightBehavior: 'soft even daylight; fully matte, no sheen',
      textureLogic: 'fine, even weave with mild natural irregularity; no folds, no visible seams',
      depthLogic: 'shallow; the flat cloth lies flat with only fibre-level relief',
      ornamentSystem: 'no ornament; the cloth itself is the composition',
      shouldFeelLike: 'a piece of good linen or cotton laid flat',
      mustNotFeelLike:
        'embroidery art, draped fabric, plaid, a quilt, leather or glossy synthetic cloth',
      crossStyleAvoidances: [
        'no felt fuzz from Plush',
        'no paper fibre from Paper',
        'no pile from Velvet Ember',
      ],
      negativePromptAdditions: [
        'embroidery',
        'stitched illustration',
        'fabric folds',
        'draped cloth',
        'quilting',
        'visible seams',
        'plaid',
        'stripes',
        'repeating textile pattern',
        'leather',
        'glossy synthetic fabric',
      ],
    },
  }),

  // ── 07 Paper ──────────────────────────────────────────────────────────────
  paper_v2: defineAnchor2Style({
    id: 'paper_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Paper',
    materialName: 'tactile handmade and natural paper',
    styleFamily: 'Tactile Paper',
    lockedCore: [
      'tactile paper material with real fibre character',
      'matte, soft surface with gentle tonal variation',
      'restrained inclusions that stay low contrast',
    ],
    allowedVariation: [
      'cotton rag, kraft, washi or handmade paper with restrained inclusions',
      'cream, dusty blue, blush, sage, charcoal and natural paper tones',
      'fibre density',
      'where inclusions gather',
    ],
    prohibitedDrift: [
      'folded paper or origami',
      'torn collage covering the centre',
      'heavy stains',
      'large fibres crossing the geometry',
      'fabric weave',
      'wall plaster',
      'glossy coating',
    ],
    paletteLanes: [
      {
        id: 'cream_rag',
        label: 'Cream cotton rag',
        fieldValue: 'light',
        field: 'warm cream cotton rag paper with soft tonal variation',
        anchorTone: 'deep ink',
        anchorValue: 'dark',
      },
      {
        id: 'dusty_blue',
        label: 'Dusty blue paper',
        fieldValue: 'light',
        field: 'dusty blue handmade paper with fine fibres',
        anchorTone: 'deep navy-ink',
        anchorValue: 'dark',
      },
      {
        id: 'blush_sage',
        label: 'Blush or sage paper',
        fieldValue: 'light',
        field: 'soft blush or sage natural paper',
        anchorTone: 'deep umber-ink',
        anchorValue: 'dark',
      },
      {
        id: 'charcoal_paper',
        label: 'Charcoal paper',
        fieldValue: 'dark',
        field: 'charcoal paper with a soft matte tooth',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
      {
        id: 'kraft_natural',
        label: 'Natural kraft',
        fieldValue: 'mixed',
        field: 'natural kraft paper with a calmer, evenly toned middle',
        anchorTone: 'deep umber-black',
        anchorValue: 'dark',
      },
    ],
    materialVariants: [
      'cotton rag paper',
      'kraft paper',
      'washi paper',
      'handmade paper with sparse inclusions',
    ],
    materialBehavior: 'matte paper with fine fibre tooth and sparse, low-contrast inclusions',
    anchorRendering:
      'the structure reads as a strip of contrasting paper inlaid into the sheet along the supplied geometry exactly, with a soft hand-torn edge where its fibres show, matte and even in weight, set flush with the surface and casting no shadow',
    styleNativeMotifs: ['sparse pale fibres', 'faint tonal clouding of the paper'],
    legibilityRule:
      'paper fibres and inclusions remain low contrast and short around the geometry; no fibre may read as a competing line',
    categoryInfluence:
      'category and intention may shift paper tone and how many inclusions gather near the edge',
    visualLanguage: {
      coreArtWorld:
        'A tactile paper world: real matte paper with fine fibre character and quiet tonal variation, edge to edge.',
      primaryMedium: 'handmade or natural paper with ink laid into it',
      substrate: 'a single sheet of paper filling the canvas edge to edge',
      edgeBehavior: 'the paper continues to the borders; no deckle frame, no torn edge',
      lightBehavior: 'soft even daylight; matte, with no coating sheen',
      textureLogic: 'fine fibre tooth, short pale inclusions, smooth tonal clouding',
      depthLogic: 'shallow; the sheet lies flat with only fibre relief',
      ornamentSystem: 'no ornament; the paper is the composition',
      shouldFeelLike: 'good paper held in daylight: soft, warm, honest',
      mustNotFeelLike: 'origami, collage, a stained page, fabric or plaster',
      crossStyleAvoidances: [
        'no fabric weave from Woven',
        'no wall plaster from Clay or Buff',
        'no printed tattoo-flash linework from Flash',
      ],
      negativePromptAdditions: [
        'folded paper',
        'origami',
        'torn collage',
        'heavy stains',
        'large fibres crossing',
        'fabric weave',
        'wall plaster',
        'glossy coating',
      ],
    },
  }),

  // ── 08 Mineral Wash ───────────────────────────────────────────────────────
  clay_v2: defineAnchor2Style({
    id: 'clay_v2',
    generationVersion: 'anchor2',
    availability: 'rotation',
    displayName: 'Mineral Wash',
    materialName: 'compressed mineral pigment, clay slip and limewash',
    styleFamily: 'Mineral Surface',
    lockedCore: [
      'compressed pigment, powdered stone, clay slip, limewash or plaster, sandstone, pressed ochre',
      'dense, dry, powdery, grounded and tactile',
      'broad tonal clouding rather than fine speckle',
    ],
    allowedVariation: [
      'sage and ochre, clay and terracotta, bone and chalk, dusty mineral pink and muted stone colours',
      'degree of powderiness',
      'where tonal clouds gather',
    ],
    prohibitedDrift: [
      'gloss',
      'ceramic glaze',
      'marble veins',
      'cracks',
      'metallic shimmer',
      'glowing pigment',
      'paper fibres',
      'textile weave',
      'a photographic wall scene',
    ],
    paletteLanes: [
      {
        id: 'bone_chalk',
        label: 'Bone and chalk',
        fieldValue: 'light',
        field: 'bone and chalk limewash with soft broad tonal clouds',
        anchorTone: 'deep umber-brown',
        anchorValue: 'dark',
      },
      {
        id: 'dusty_mineral_pink',
        label: 'Dusty mineral pink',
        fieldValue: 'light',
        field: 'dusty mineral pink pigment, powdery and matte',
        anchorTone: 'deep aubergine-brown',
        anchorValue: 'dark',
      },
      {
        id: 'sage_ochre',
        label: 'Sage and ochre',
        fieldValue: 'mixed',
        field: 'sage and ochre pressed pigment with a calmer middle tone',
        anchorTone: 'deep forest-umber',
        anchorValue: 'dark',
      },
      {
        id: 'stone_slate',
        label: 'Muted stone',
        fieldValue: 'dark',
        field: 'deep muted slate-stone pigment, dense and dry',
        anchorTone: 'pale chalk',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'limewash plaster',
      'clay slip',
      'pressed ochre pigment',
      'powdered sandstone',
    ],
    materialBehavior: 'dry, dense, matte, powdery surface with broad soft tonal clouding',
    anchorRendering:
      'the structure reads as a line of pressed contrasting pigment or slip, dry and matte with softly powdery edges, following the supplied geometry exactly',
    styleNativeMotifs: ['broad powdery tonal clouds', 'soft pigment pooling toward the perimeter'],
    legibilityRule:
      'use broad tonal clouding rather than tiny noisy speckle; keep tonal clouds soft and low contrast behind the geometry',
    categoryInfluence:
      'category and intention may shift the mineral palette and how dense the clouding is toward the edges',
    visualLanguage: {
      coreArtWorld:
        'A dry mineral world: compressed pigment, limewash and clay slip, dense and powdery with broad soft tonal clouds.',
      primaryMedium: 'pressed mineral pigment, clay slip or limewash',
      substrate: 'a continuous dry mineral surface filling the canvas edge to edge',
      edgeBehavior: 'soft, powdery, dry-feathered transitions',
      lightBehavior: 'soft diffuse daylight; matte, with no sheen at all',
      textureLogic: 'fine dense powdery body with broad soft tonal clouding, not noisy speckle',
      depthLogic: 'shallow; depth from soft pigment pooling only',
      ornamentSystem: 'no ornament; the mineral surface is the composition',
      shouldFeelLike: 'touching dry limewash or pressed ochre: grounded, dense, quiet',
      mustNotFeelLike: 'glazed ceramic, marble, cracked earth, metallic or a photographed wall',
      crossStyleAvoidances: [
        'no ceramic glaze from Porcelain',
        'no paper fibres from Paper',
        'no urban wall history from Buff',
      ],
      negativePromptAdditions: [
        'gloss',
        'ceramic glaze',
        'marble veins',
        'cracks',
        'metallic shimmer',
        'glowing pigment',
        'paper fibres',
        'textile weave',
        'photographic wall scene',
      ],
    },
  }),

  // ── 09 Graphic ────────────────────────────────────────────────────────────
  graphic_v2: defineAnchor2Style({
    id: 'graphic_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Graphic',
    materialName: 'original abstract composition of flat confident shapes with print-style grain',
    styleFamily: 'Flat Print Composition',
    lockedCore: [
      'an original abstract composition of few, large, flat, confident shapes',
      'print-style grain over matte colour',
      'a manageable local value contrast behind the Anchor',
    ],
    allowedVariation: [
      'warm primary, pastel or muted colour logic in a general modernist spirit',
      'which few large shapes appear and where',
      'grain coarseness within fine limits',
    ],
    prohibitedDrift: [
      'any recognizable existing artwork or named artist look',
      'repeating stripes or optical line patterns',
      'pure black beside pure white throughout',
      'dense tiny geometry',
      'a vector icon set or logo design',
      'hard shape boundaries destroying Anchor readability',
    ],
    paletteLanes: [
      {
        id: 'warm_primary',
        label: 'Warm primary',
        fieldValue: 'mixed',
        field:
          'cream ground with a few large warm red, golden and blue shapes pushed toward the perimeter',
        anchorTone: 'deep ink-navy',
        anchorValue: 'dark',
      },
      {
        id: 'pastel_shapes',
        label: 'Pastel',
        fieldValue: 'light',
        field: 'pale ground with a few large soft pastel shapes',
        anchorTone: 'deep ink-plum',
        anchorValue: 'dark',
      },
      {
        id: 'muted_earth',
        label: 'Muted earth',
        fieldValue: 'light',
        field: 'warm paper ground with a few large muted ochre, clay and sage shapes',
        anchorTone: 'deep umber-ink',
        anchorValue: 'dark',
      },
      {
        id: 'night_shapes',
        label: 'Night ground',
        fieldValue: 'dark',
        field: 'deep ink ground with a few large muted colour shapes',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'screen-printed ink on matte stock',
      'cut-colour print',
      'offset print with soft grain',
    ],
    materialBehavior: 'flat matte colour with a fine print grain and slight ink irregularity',
    anchorRendering:
      'the structure reads as a flat, even-weight printed line of one contrasting ink, with the same fine print grain as the field',
    styleNativeMotifs: [
      'few large flat shapes',
      'soft print grain',
      'quiet overlaps of two shapes',
    ],
    legibilityRule:
      'use fewer, larger forms and keep shape edges and value jumps away from the geometry footprint; let shapes sit mostly toward the perimeter',
    categoryInfluence:
      'category and intention may steer the colour logic and how large or crowded the shapes feel',
    visualLanguage: {
      coreArtWorld:
        'An original flat print world: a few large confident shapes in matte colour with a fine print grain, composed with restraint.',
      primaryMedium: 'flat printed ink colour',
      substrate: 'matte printing stock filling the canvas edge to edge',
      edgeBehavior:
        'clean but slightly imperfect printed edges that stay away from the Anchor footprint',
      lightBehavior: 'flat even light; no shading, no gloss',
      textureLogic: 'fine print grain and slight ink irregularity',
      depthLogic: 'flat; depth only from two shapes overlapping',
      ornamentSystem: 'a handful of large abstract shapes; no icons, no pattern',
      shouldFeelLike: 'a well-made original print: bold, flat, confident',
      mustNotFeelLike:
        'a known painting, a logo, an icon set, an optical pattern or a poster of tiny shapes',
      crossStyleAvoidances: [
        'no gestural brushwork from Joybrush',
        'no tattoo-flash outlines from Flash',
        'no felt softness from Plush',
      ],
      negativePromptAdditions: [
        'recognizable existing artwork',
        'repeating stripes',
        'optical line pattern',
        'pure black beside pure white',
        'dense tiny geometry',
        'vector icon set',
        'logo design',
      ],
    },
  }),

  // ── 10 Plush ──────────────────────────────────────────────────────────────
  plush_v2: defineAnchor2Style({
    id: 'plush_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Plush',
    materialName: 'cute plush wool-felt appliqué',
    styleFamily: 'Felt Appliqué',
    lockedCore: [
      'flat matte wool-felt-like ground with fine fuzzy fibres and no visible weave',
      'chunky, soft-edged, slightly wobbly felt forms with shallow puffiness',
      'cute on purpose: soft, cheerful and handmade',
    ],
    allowedVariation: [
      'butter, blush, mint, lilac, sky, peach and cream with small tomato or cobalt accents',
      'which simple felt forms appear: blobs, clouds, simple flowers, rounded stars, tiny dots',
      'how many forms and where they sit',
    ],
    prohibitedDrift: [
      'faces or eyes',
      'buttons',
      'characters or toys',
      'visible woven textile',
      'quilting',
      'hard outlines',
      'gradients',
      'glossy satin',
      'any darkening or maturing of the style',
    ],
    paletteLanes: [
      {
        id: 'butter_felt',
        label: 'Butter',
        fieldValue: 'light',
        field: 'butter-yellow felt ground with soft cream and peach felt forms',
        anchorTone: 'deep cobalt felt',
        anchorValue: 'dark',
      },
      {
        id: 'blush_felt',
        label: 'Blush',
        fieldValue: 'light',
        field: 'blush felt ground with soft cream and lilac felt forms',
        anchorTone: 'deep plum felt',
        anchorValue: 'dark',
      },
      {
        id: 'mint_felt',
        label: 'Mint',
        fieldValue: 'light',
        field: 'mint felt ground with soft cream and sky felt forms',
        anchorTone: 'deep teal-green felt',
        anchorValue: 'dark',
      },
      {
        id: 'lilac_felt',
        label: 'Lilac',
        fieldValue: 'light',
        field: 'lilac felt ground with soft blush and cream felt forms',
        anchorTone: 'deep indigo felt',
        anchorValue: 'dark',
      },
      {
        id: 'sky_felt',
        label: 'Sky',
        fieldValue: 'light',
        field: 'sky-blue felt ground with soft butter and peach felt forms',
        anchorTone: 'deep navy felt',
        anchorValue: 'dark',
      },
      // Saturated, still cheerful: a strong value flip from the pastel lanes without darkening or
      // maturing the style.
      {
        id: 'cobalt_felt',
        label: 'Cobalt',
        fieldValue: 'dark',
        field: 'bright cobalt felt ground with soft cream, butter and peach felt forms',
        anchorTone: 'cream felt',
        anchorValue: 'light',
      },
      {
        id: 'tomato_felt',
        label: 'Tomato',
        fieldValue: 'dark',
        field: 'warm tomato-red felt ground with soft cream, blush and butter felt forms',
        anchorTone: 'cream felt',
        anchorValue: 'light',
      },
    ],
    materialVariants: ['wool felt', 'thick craft felt', 'soft needle-felted wool'],
    materialBehavior:
      'matte wool felt with a fine fuzzy fibre surface and shallow puffy forms; no weave',
    anchorRendering:
      'the structure reads as a chunky strip of deep felt laid flat onto the felt ground with softly rounded edges, following the supplied geometry exactly; no stitching crosses it',
    styleNativeMotifs: [
      'soft felt blobs',
      'felt clouds',
      'simple felt flowers',
      'rounded felt stars',
      'tiny felt dots',
    ],
    legibilityRule:
      'keep felt forms and dots toward the perimeter and away from the geometry footprint; forms never overlap or touch the structure',
    categoryInfluence:
      'category and intention may shift which pastel leads and how many felt forms appear; the result stays cute and light',
    visualLanguage: {
      coreArtWorld:
        'A cute plush felt world: matte wool-felt ground and chunky soft felt appliqué forms, cheerful and handmade.',
      primaryMedium: 'wool-felt appliqué',
      substrate:
        'a flat matte wool-felt sheet filling the canvas edge to edge, with no visible weave',
      edgeBehavior: 'soft, rounded, slightly wobbly cut edges with a gentle fuzz',
      lightBehavior: 'soft even light; fully matte, no sheen',
      textureLogic: 'fine fuzzy wool fibres, no weave, shallow puffiness on the forms',
      depthLogic: 'shallow; felt forms sit slightly raised above the ground',
      ornamentSystem: 'a few simple felt forms near the perimeter, nothing more',
      shouldFeelLike: 'a handmade felt appliqué: soft, cute, cheerful',
      mustNotFeelLike: 'a toy, a character, a quilt, woven cloth or anything dark and serious',
      crossStyleAvoidances: [
        'no woven cloth from Woven',
        'no pile from Velvet Ember',
        'no print grain from Graphic',
      ],
      negativePromptAdditions: [
        'faces',
        'eyes',
        'buttons',
        'characters',
        'toys',
        'visible woven textile',
        'quilting',
        'hard outlines',
        'gradients',
        'glossy satin',
      ],
    },
  }),

  // ── 11 Herbarium ──────────────────────────────────────────────────────────
  herbarium_v2: defineAnchor2Style({
    id: 'herbarium_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Herbarium',
    materialName: 'pressed botanical specimens on a quiet paper surface',
    styleFamily: 'Pressed Botanical',
    lockedCore: [
      'real pressed botanical specimens on a quiet surface',
      'specimens that are flattened, slightly translucent, irregular and observed rather than illustrated',
      'botanically believable structures such as fern, ginkgo, eucalyptus, grasses, oak, lavender, restrained wildflowers or dried seed heads',
    ],
    allowedVariation: [
      'soft and feminine, neutral and calm, or grounded darker botanical expressions',
      'which species appear',
      'how many specimens and where they rest toward the edges',
    ],
    prohibitedDrift: [
      'generic boho leaf wallpaper',
      'symmetrical clip-art leaves',
      'wreaths',
      'repeating botanical patterns',
      'insects',
      'botanical labels or text',
      'watercolor illustration',
      'chunky cartoon flowers',
    ],
    paletteLanes: [
      {
        id: 'soft_blush',
        label: 'Soft blush',
        fieldValue: 'light',
        field: 'warm ivory-blush herbarium paper with softly pressed specimens',
        anchorTone: 'deep umber-ink',
        anchorValue: 'dark',
      },
      {
        id: 'neutral_calm',
        label: 'Neutral and calm',
        fieldValue: 'light',
        field: 'oatmeal-cream herbarium paper with pale green-brown specimens',
        anchorTone: 'deep olive-ink',
        anchorValue: 'dark',
      },
      {
        id: 'grounded_dark',
        label: 'Grounded dark',
        fieldValue: 'dark',
        field: 'dark umber-olive paper with pale pressed specimens',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
      {
        id: 'sage_paper',
        label: 'Sage paper',
        fieldValue: 'mixed',
        field: 'sage herbarium paper with a calmer pale middle',
        anchorTone: 'deep forest-ink',
        anchorValue: 'dark',
      },
    ],
    materialVariants: [
      'mounted herbarium sheet',
      'pressed specimens under a thin paper sheet',
      'dried specimens on cotton paper',
    ],
    materialBehavior: 'flattened, slightly translucent plant matter pressed flat on matte paper',
    anchorRendering:
      'the structure reads as a narrow strip of aged linen mounting tape laid flat onto the paper, as a herbarium sheet is mounted: matte, even in weight, with visible linen fibre and soft frayed edges, clearly separate from every specimen and following the supplied geometry exactly',
    styleNativeMotifs: [
      'pressed fern fronds',
      'ginkgo leaves',
      'eucalyptus sprigs',
      'grass seed heads',
      'dried lavender',
    ],
    legibilityRule:
      'thin stems and veins must stay away from or soften behind the geometry strokes; place specimens toward the perimeter and keep any veins pale and short near the structure',
    categoryInfluence:
      'category and intention may steer the expression (soft, calm or grounded) and how many specimens gather at the edges',
    visualLanguage: {
      coreArtWorld:
        'A quiet herbarium world: real pressed specimens, flattened and slightly translucent, resting on matte paper.',
      primaryMedium: 'pressed dried plant specimens on paper',
      substrate: 'a matte herbarium paper sheet filling the canvas edge to edge',
      edgeBehavior:
        'specimens rest naturally with irregular, observed edges; nothing is cut into shapes',
      lightBehavior: 'soft even daylight, as if photographed flat; matte',
      textureLogic: 'fine paper tooth with the faint translucent texture of pressed leaves',
      depthLogic: 'shallow; specimens lie flat and slightly translucent against the sheet',
      ornamentSystem: 'a small number of believable specimens placed toward the edges',
      shouldFeelLike: 'a page from a naturalist’s herbarium: observed, quiet, real',
      mustNotFeelLike:
        'boho wallpaper, clip art, a wreath, a botanical illustration or a cartoon garden',
      crossStyleAvoidances: [
        'no illustrated watercolor washes',
        'no mounted-card labels or captions',
        'no repeating leaf pattern',
      ],
      negativePromptAdditions: [
        'boho leaf wallpaper',
        'clip-art leaves',
        'wreath',
        'repeating botanical pattern',
        'insects',
        'botanical labels',
        'watercolor illustration',
        'cartoon flowers',
      ],
    },
  }),

  // ── 12 Alloy ──────────────────────────────────────────────────────────────
  alloy_v2: defineAnchor2Style({
    id: 'alloy_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Alloy',
    materialName: 'machined and worked satin metal sheet',
    styleFamily: 'Worked Metal Sheet',
    lockedCore: [
      'worked, machined satin or matte metal sheet',
      'fine material-specific treatment with soft broad light',
      'distinct from applied metal leaf: this is the metal itself',
    ],
    allowedVariation: [
      'fine brushed champagne or silver, patinated copper, gunmetal or heat-treated metal',
      'treatment direction',
      'where the patina or heat colour gathers',
    ],
    prohibitedDrift: [
      'crinkled foil or wrinkled texture',
      'crystalline texture',
      'glitter',
      'molten metal',
      'mirror chrome',
      'hard specular streaks',
      'engraving competing with the Anchor',
      'gold-leaf treatment',
    ],
    paletteLanes: [
      {
        id: 'champagne_brushed',
        label: 'Brushed champagne or silver',
        fieldValue: 'light',
        field: 'finely brushed champagne-silver satin metal with soft broad light',
        anchorTone: 'deep graphite',
        anchorValue: 'dark',
      },
      {
        id: 'gunmetal',
        label: 'Gunmetal',
        fieldValue: 'dark',
        field: 'dark gunmetal satin sheet with very fine brushing',
        anchorTone: 'pale silver-white',
        anchorValue: 'light',
      },
      {
        id: 'copper_patina',
        label: 'Patinated copper',
        fieldValue: 'mixed',
        field: 'patinated copper sheet with a calmer, evenly toned middle',
        anchorTone: 'deep umber-black',
        anchorValue: 'dark',
      },
      {
        id: 'heat_treated',
        label: 'Heat-treated metal',
        fieldValue: 'dark',
        field: 'deep blued and straw-toned heat-treated metal, matte and even',
        anchorTone: 'pale champagne',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'fine brushed metal',
      'patinated copper',
      'matte gunmetal',
      'heat-treated metal',
    ],
    materialBehavior:
      'satin or matte machined metal with fine, directional, low-contrast treatment',
    anchorRendering:
      'the structure reads as a contrasting finish on the same sheet, such as polished against brushed or oxidized against bare, with the same soft satin character and no engraving depth',
    styleNativeMotifs: [
      'fine directional brushing',
      'soft broad light falloff',
      'gentle patina clouds toward the perimeter',
    ],
    legibilityRule:
      'keep brushing fine and uniform behind the geometry, with no specular streaks or engraving crossing a stroke; patina and heat colour belong toward the perimeter',
    categoryInfluence:
      'category and intention may shift the metal type and how much patina or heat colour appears at the edges',
    visualLanguage: {
      coreArtWorld:
        'A worked-metal world: a machined satin or matte metal sheet with fine treatment and soft broad light.',
      primaryMedium: 'worked metal sheet',
      substrate: 'a continuous metal sheet filling the canvas edge to edge',
      edgeBehavior: 'no edges; the sheet continues to the borders',
      lightBehavior: 'soft broad light with gentle falloff; no mirror highlights, no hard streaks',
      textureLogic:
        'fine brushed or finely worked surface, smooth and low contrast; never crinkled or crystalline',
      depthLogic: 'shallow; the flat sheet shows only fine surface relief',
      ornamentSystem: 'no ornament; the metal and its finish are the composition',
      shouldFeelLike: 'a well-made metal panel: cool, precise, matte',
      mustNotFeelLike: 'gold leaf, crinkled foil, molten metal, glitter or mirror chrome',
      crossStyleAvoidances: [
        'no applied metal leaf or lacquer ground from Gilt',
        'no gloss glaze from Porcelain',
        'no refractive chrome from Prism Flow',
      ],
      negativePromptAdditions: [
        'crinkled foil',
        'wrinkled texture',
        'crystalline texture',
        'glitter',
        'molten metal',
        'mirror chrome',
        'hard specular streaks',
        'engraving',
        'gold leaf',
      ],
    },
  }),

  // ── 13 Gilt ───────────────────────────────────────────────────────────────
  gilt_v2: defineAnchor2Style({
    id: 'gilt_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Gilt',
    materialName: 'applied metal leaf over smooth satin-matte lacquer',
    styleFamily: 'Leaf on Lacquer',
    lockedCore: [
      'applied metal leaf as a layer over a smooth satin-matte lacquer ground',
      'a smooth ground; the leaf is a layer over it, not a metal plate',
      'leaf appears primarily toward the peripheral areas',
    ],
    allowedVariation: [
      'lacquer colour',
      'gold or silver leaf',
      'leaf placement at the perimeter',
      'a little tarnish at the leaf edges',
    ],
    prohibitedDrift: [
      'brushed sheet metal',
      'molten gold',
      'glitter or sparkle',
      'chrome',
      'marble',
      'baroque ornament',
      'crowns or monograms',
      'crinkled foil dominating the composition',
      'scattered flakes crossing the Anchor',
      'crazing or hairline cracks',
    ],
    paletteLanes: [
      {
        id: 'ivory_gold',
        label: 'Ivory lacquer and gold leaf',
        fieldValue: 'light',
        field: 'smooth ivory satin-matte lacquer with gold leaf laid along the perimeter',
        anchorTone: 'deep ink-brown',
        anchorValue: 'dark',
      },
      {
        id: 'navy_silver',
        label: 'Ink navy lacquer and silver leaf',
        fieldValue: 'dark',
        field: 'smooth ink-navy satin-matte lacquer with silver leaf laid along the perimeter',
        anchorTone: 'pale cream',
        anchorValue: 'light',
      },
      {
        id: 'green_gold',
        label: 'Bottle green lacquer and gold leaf',
        fieldValue: 'dark',
        field: 'smooth bottle-green satin-matte lacquer with gold leaf laid along the perimeter',
        anchorTone: 'pale ivory',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'gold leaf on lacquer',
      'silver leaf on lacquer',
      'lightly tarnished leaf on lacquer',
    ],
    materialBehavior:
      'smooth satin-matte lacquer ground with thin applied leaf in soft, broken, peripheral patches',
    anchorRendering:
      'the structure reads as a fine line of burnished gilding set into the lacquer: a smooth, even channel of bright satin leaf in a tone that contrasts with the ground, sharp-edged and never flaking, crinkled or covered by loose leaf, following the supplied geometry exactly',
    styleNativeMotifs: ['soft-edged leaf patches at the perimeter', 'faint leaf tarnish'],
    legibilityRule:
      'keep the ground smooth and clear around the geometry; loose leaf patches stay peripheral and never cross, touch or flake over a stroke (the gilded structure itself is the only leaf near the geometry)',
    categoryInfluence:
      'category and intention may shift the lacquer colour, the leaf metal and how far the leaf reaches inward',
    visualLanguage: {
      coreArtWorld:
        'A leaf-on-lacquer world: a smooth satin-matte lacquer ground with thin metal leaf laid on it toward the edges.',
      primaryMedium: 'metal leaf over lacquer',
      substrate: 'a smooth satin-matte lacquer ground filling the canvas edge to edge',
      edgeBehavior: 'leaf patches have soft, slightly broken, hand-laid edges',
      lightBehavior: 'soft broad light; the leaf glows softly, never sparkles',
      textureLogic:
        'smooth ground; the leaf has a fine, soft, low-contrast broken texture only at the perimeter',
      depthLogic: 'shallow; the leaf is a thin layer above the ground',
      ornamentSystem: 'no ornament; leaf placement at the perimeter is the whole decoration',
      shouldFeelLike: 'lacquerware with hand-applied leaf: calm, rich, quiet',
      mustNotFeelLike: 'a metal plate, molten gold, glitter, a baroque frame or crinkled foil',
      crossStyleAvoidances: [
        'no brushed or machined sheet metal from Alloy',
        'no marble or baroque ornament',
        'no glaze crackle from Porcelain',
      ],
      negativePromptAdditions: [
        'brushed sheet metal',
        'molten gold',
        'glitter',
        'sparkle',
        'chrome',
        'marble',
        'baroque ornament',
        'crowns',
        'monograms',
        'crinkled foil',
        'scattered flakes',
        'crazing',
        'hairline cracks',
      ],
    },
  }),

  // ── 14 Flash ──────────────────────────────────────────────────────────────
  flash_v2: defineAnchor2Style({
    id: 'flash_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Flash',
    materialName: 'tattoo-flash-inspired inked paper',
    styleFamily: 'Inked Flash Sheet',
    lockedCore: [
      'a tattoo-flash-inspired inked paper surface, not skin',
      'abstract flash language: bold filled shapes, rays, dotwork clusters, rounded petal forms, stars and thick confident outlines',
      'thick flash linework that stays subordinate to the Anchor geometry',
    ],
    allowedVariation: [
      'classic colour flash, blackwork, neo-traditional palette or faded sun-worn ink, including vivid blue, orange, yellow and turquoise treatments',
      'which abstract flash forms appear',
      'where the forms cluster toward the edges',
    ],
    prohibitedDrift: [
      'skin, people or bodies',
      'animals',
      'roses, daggers, skulls',
      'hearts with banners',
      'ships or literal nautical anchors',
      'text, lettering or banners with writing',
      'fine-line tattoo detail',
    ],
    paletteLanes: [
      {
        id: 'classic_colour',
        label: 'Classic colour flash',
        fieldValue: 'light',
        field:
          'aged cream flash paper with bold red, teal and golden-yellow inked forms toward the edges',
        anchorTone: 'deep black-brown ink',
        anchorValue: 'dark',
      },
      {
        id: 'blackwork',
        label: 'Blackwork',
        fieldValue: 'light',
        field:
          'bone flash paper with black filled shapes, rays and dotwork gathered toward the edges',
        anchorTone: 'deep black ink with a calm clear paper zone around it',
        anchorValue: 'dark',
      },
      {
        id: 'sun_worn',
        label: 'Faded sun-worn ink',
        fieldValue: 'light',
        field: 'sun-yellowed flash paper with faded muted red and teal ink forms',
        anchorTone: 'deep umber-black ink',
        anchorValue: 'dark',
      },
      {
        id: 'cobalt_blue',
        label: 'Cobalt blue flash',
        fieldValue: 'light',
        field:
          'cool pale-blue flash paper with bold cobalt and ultramarine forms, small cream highlights and restrained charcoal accents',
        anchorTone: 'deep navy ink',
        anchorValue: 'dark',
      },
      {
        id: 'ember_orange',
        label: 'Ember orange flash',
        fieldValue: 'light',
        field:
          'warm ivory flash paper with vivid burnt-orange and vermilion forms, touches of deep blue and matte charcoal',
        anchorTone: 'deep charcoal ink',
        anchorValue: 'dark',
      },
      {
        id: 'marigold_yellow',
        label: 'Marigold yellow flash',
        fieldValue: 'light',
        field:
          'soft butter-yellow flash paper with saturated marigold and lemon-yellow forms, balanced by indigo and dark umber accents',
        anchorTone: 'deep indigo-brown ink',
        anchorValue: 'dark',
      },
      {
        id: 'turquoise',
        label: 'Turquoise flash',
        fieldValue: 'light',
        field:
          'pale sea-glass paper with strong turquoise and blue-green forms, warm orange accents and dark ink outlines',
        anchorTone: 'deep blue-green ink',
        anchorValue: 'dark',
      },
      {
        id: 'midnight_blue_stock',
        label: 'Midnight blue flash',
        fieldValue: 'dark',
        field:
          'deep matte cobalt-blue flash paper with cream, pale-blue and warm orange filled forms, rays and dotwork',
        anchorTone: 'warm cream-white ink with a calm clear paper zone around it',
        anchorValue: 'light',
      },
      {
        id: 'indigo_marigold_stock',
        label: 'Indigo and marigold flash',
        fieldValue: 'dark',
        field:
          'dark indigo flash paper with bright marigold-yellow and coral-orange forms, small pale-blue accents and cream linework',
        anchorTone: 'warm cream-white ink with a calm clear paper zone around it',
        anchorValue: 'light',
      },
      {
        id: 'black_stock',
        label: 'Black-stock flash',
        fieldValue: 'dark',
        field:
          'matte black flash paper stock with bold cream, red and golden-yellow filled forms, rays and dotwork gathered toward the edges',
        anchorTone: 'bright cream-white ink with a calm clear paper zone around it',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'aged flash paper with classic colour ink',
      'bone paper with blackwork ink',
      'sun-faded neo-traditional ink on paper',
    ],
    materialBehavior:
      'matte paper with thick, confident ink fills and outlines that sit slightly into the sheet',
    anchorRendering:
      'the structure reads as a thick, even black or deep-ink line on the paper, as if inked by hand, following the supplied geometry exactly',
    styleNativeMotifs: [
      'rays',
      'dotwork clusters',
      'rounded petal forms',
      'small stars',
      'bold filled shapes',
    ],
    legibilityRule:
      'keep thick flash linework subordinate to and away from the geometry; clusters of rays, dots and petals stay toward the perimeter and never touch a stroke',
    categoryInfluence:
      'category and intention may steer the ink palette and which abstract forms gather at the edges',
    visualLanguage: {
      coreArtWorld:
        'An inked flash-sheet world: bold abstract tattoo-flash forms in thick ink on aged paper, composed toward the edges.',
      primaryMedium: 'bold ink on paper in the language of tattoo flash',
      substrate: 'a flash paper sheet filling the canvas edge to edge',
      edgeBehavior: 'thick confident ink outlines with slightly imperfect hand-drawn edges',
      lightBehavior: 'soft even light; matte paper and flat ink',
      textureLogic: 'fine paper tooth with slight ink absorption; flat ink fills',
      depthLogic: 'flat; ink sits on the paper with no shading',
      ornamentSystem:
        'a handful of abstract flash forms toward the perimeter, with no literal subjects',
      shouldFeelLike: 'a sheet of hand-inked flash: bold, confident, a little worn',
      mustNotFeelLike:
        'skin, a tattoo on a body, a pin-up, a nautical scene or fine-line illustration',
      crossStyleAvoidances: [
        'no painted urban wall from Buff',
        'no gestural brush energy from Joybrush',
        'no flat print composition from Graphic',
      ],
      negativePromptAdditions: [
        'skin',
        'people',
        'bodies',
        'animals',
        'roses',
        'daggers',
        'skulls',
        'hearts with banners',
        'ships',
        'nautical anchor',
        'lettering',
        'banners with writing',
        'fine-line tattoo detail',
      ],
    },
  }),

  // ── 15 Buff ───────────────────────────────────────────────────────────────
  buff_v2: defineAnchor2Style({
    id: 'buff_v2',
    generationVersion: 'anchor2',
    availability: 'forward',
    displayName: 'Buff',
    materialName: 'worn urban painted-over wall surface',
    styleFamily: 'Painted Wall',
    lockedCore: [
      'the wall, not the writing: an urban painted-over wall surface',
      'whitewashed concrete, buffed paint patches, aerosol overspray, painted brick, torn paste-up edges or a night wall',
      'worn surface history with soft aerosol falloff',
    ],
    allowedVariation: [
      'wall treatment',
      'spray colours',
      'peripheral paint history',
      'how worn the surface is',
    ],
    prohibitedDrift: [
      'readable tags, letters or bubble lettering',
      'characters or figures',
      'stencil portraits',
      'logos or barcodes',
      'recognizable street artists',
      'hard geometric poster composition',
      'long drips through the Anchor',
      'cracks through the Anchor',
      'dense splatter behind the Anchor',
      'glossy wet paint',
    ],
    paletteLanes: [
      {
        id: 'whitewashed_concrete',
        label: 'Whitewashed concrete',
        fieldValue: 'light',
        field:
          'whitewashed concrete with buffed paint patches and faint soft overspray at the edges',
        anchorTone: 'deep charcoal-ink',
        anchorValue: 'dark',
      },
      {
        id: 'painted_brick',
        label: 'Painted-over brick',
        fieldValue: 'mixed',
        field: 'painted-over brick wall with a calmer, evenly painted middle',
        anchorTone: 'deep charcoal-black',
        anchorValue: 'dark',
      },
      {
        id: 'buffed_grey',
        label: 'Buffed grey wall',
        fieldValue: 'mixed',
        field:
          'buffed grey paint patches with soft overspray toward the perimeter and a quiet middle',
        anchorTone: 'deep ink-black',
        anchorValue: 'dark',
      },
      {
        id: 'night_wall',
        label: 'Night wall',
        fieldValue: 'dark',
        field: 'dark night wall with soft muted overspray along the edges',
        anchorTone: 'pale chalk-white',
        anchorValue: 'light',
      },
    ],
    materialVariants: [
      'whitewashed concrete',
      'buffed paint patches',
      'painted brick',
      'night wall with soft overspray',
    ],
    materialBehavior:
      'matte painted-over wall with soft aerosol overspray falloff and worn paint patches',
    anchorRendering:
      'the structure reads as a firm band of matte paint in a contrasting tone laid onto the wall, even in weight and following the supplied geometry exactly',
    styleNativeMotifs: [
      'buffed paint patches',
      'soft aerosol overspray',
      'faint paste-up edges at the perimeter',
    ],
    legibilityRule:
      'overspray falls off softly and stays at the perimeter; no drip, crack or dense splatter near or across the geometry',
    categoryInfluence:
      'category and intention may steer the spray colours and how much paint history gathers at the edges',
    visualLanguage: {
      coreArtWorld:
        'A worn urban wall world: painted-over, buffed surface with soft aerosol falloff and quiet paint history.',
      primaryMedium: 'buffed paint, whitewash and soft aerosol overspray on a wall',
      substrate: 'a wall surface of concrete or brick filling the canvas edge to edge',
      edgeBehavior: 'soft aerosol falloff and layered patch edges',
      lightBehavior: 'even flat daylight on a matte wall; no wet gloss',
      textureLogic: 'fine matte wall tooth with broad paint patches',
      depthLogic: 'shallow; layers of paint history sit flat on the wall',
      ornamentSystem: 'no ornament; the wall and its paint history are the composition',
      shouldFeelLike: 'a city wall that has been painted over many times: quiet, worn, real',
      mustNotFeelLike: 'graffiti lettering, a mural, a stencil, a poster or wet glossy paint',
      crossStyleAvoidances: [
        'no expressive painted composition from Joybrush',
        'no inked flash forms from Flash',
        'no smooth mineral surface from Clay',
      ],
      negativePromptAdditions: [
        'readable tags',
        'letters',
        'bubble lettering',
        'characters',
        'figures',
        'stencil portraits',
        'logos',
        'barcodes',
        'street artist style',
        'geometric poster composition',
        'long drips',
        'cracks',
        'dense splatter',
        'glossy wet paint',
      ],
    },
  }),
};

// ============================================================================
// Resolution helpers — the only place generation version is decided
// ============================================================================

function normalizeStyleKey(style: unknown): string {
  if (typeof style !== 'string') return '';
  const key = style.trim().toLowerCase().replace(/-/g, '_');
  if (key === 'mineral_wash_v2' || key === 'mineral_wash') return 'clay_v2';
  return key;
}

export function isAnchor2StyleId(style: unknown): style is Anchor2StyleId {
  const key = normalizeStyleKey(style);
  return Object.prototype.hasOwnProperty.call(ANCHOR2_STYLE_LIBRARY, key);
}

/** Returns the Anchor 2.0 definition for an ID, or undefined for legacy or unknown IDs. */
export function getAnchor2StyleDefinition(style: unknown): Anchor2StyleDefinition | undefined {
  const key = normalizeStyleKey(style);
  return Object.prototype.hasOwnProperty.call(ANCHOR2_STYLE_LIBRARY, key)
    ? ANCHOR2_STYLE_LIBRARY[key as Anchor2StyleId]
    : undefined;
}

/**
 * Resolves the generation contract from the registry by style ID. Server-side only: callers must
 * never accept a generation version from a client. Legacy and unknown styles are 'legacy', which
 * preserves the existing fallback behavior.
 */
export function getStyleGenerationVersion(style: unknown): StyleGenerationVersion {
  return isAnchor2StyleId(style) ? 'anchor2' : 'legacy';
}

export const ANCHOR2_FORWARD_STYLE_IDS: Anchor2StyleId[] = ANCHOR2_STYLE_IDS.filter(
  id => ANCHOR2_STYLE_LIBRARY[id].availability === 'forward'
);

export const ANCHOR2_ROTATION_STYLE_IDS: Anchor2StyleId[] = ANCHOR2_STYLE_IDS.filter(
  id => ANCHOR2_STYLE_LIBRARY[id].availability === 'rotation'
);

/** Returns every problem with an Anchor 2.0 definition; an empty list means valid. */
export function validateAnchor2StyleDefinition(def: Anchor2StyleDefinition): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(`${def.id}: ${message}`);
  };

  need(def.generationVersion === 'anchor2', 'generationVersion must be anchor2');
  need(
    def.availability === 'forward' || def.availability === 'rotation',
    'availability must be forward or rotation'
  );
  need(def.displayName.trim().length > 0, 'displayName is required');
  need(def.materialName.trim().length > 0, 'materialName is required');
  need(def.lockedCore.length > 0, 'lockedCore is required');
  need(def.allowedVariation.length > 0, 'allowedVariation is required');
  need(def.prohibitedDrift.length > 0, 'prohibitedDrift is required');
  need(def.materialVariants.length > 0, 'materialVariants is required');
  need(def.anchorRendering.trim().length > 0, 'anchorRendering is required');
  need(def.legibilityRule.trim().length > 0, 'legibilityRule is required');
  need(def.styleNativeMotifs.length > 0, 'styleNativeMotifs is required');
  need(def.paletteLanes.length >= 2, 'at least two palette lanes are required');

  const laneIds = new Set<string>();
  for (const lane of def.paletteLanes) {
    need(!laneIds.has(lane.id), `duplicate palette lane id ${lane.id}`);
    laneIds.add(lane.id);
    if (lane.fieldValue === 'light') {
      need(lane.anchorValue === 'dark', `lane ${lane.id}: a light field needs a dark structure`);
    }
    if (lane.fieldValue === 'dark') {
      need(lane.anchorValue === 'light', `lane ${lane.id}: a dark field needs a light structure`);
    }
  }

  for (const key of REQUIRED_ANCHOR2_DNA_KEYS) {
    const value = def.visualLanguage[key];
    const present = Array.isArray(value)
      ? value.length > 0
      : typeof value === 'string' && value.trim().length > 0;
    need(present, `visualLanguage.${key} is required`);
  }

  return problems;
}
