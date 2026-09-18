import {
  AI_STYLE_IDS,
  type AIStyle,
  type StyleLifecycleStatus,
  type VisualLanguageDNA,
} from '../types';

export const VALID_AI_STYLES = AI_STYLE_IDS;
export type { AIStyle, StyleLifecycleStatus, VisualLanguageDNA };

export type StyleCollection = 'core' | 'featured' | 'seasonal';

export type CompositionFamily =
  | 'CENTRED STILLPOINT'
  | 'OFFSET FIELD'
  | 'DIRECTIONAL FLOW'
  | 'LOWER-ANCHORED'
  | 'DIAGONAL TENSION'
  | 'OPEN VOID'
  | 'CENTRED_STILLPOINT'
  | 'OFFSET_FIELD'
  | 'DIRECTIONAL_FLOW'
  | 'LOWER_ANCHORED'
  | 'DIAGONAL_TENSION'
  | 'OPEN_VOID'
  | 'FULL_FIELD'
  | 'OBJECT_PRESENTATION'
  | 'CENTRED AXIS'
  | 'CENTRED_AXIS';

export type VisualCategory =
  | 'Geometric'
  | 'Mystic'
  | 'Luminous'
  | 'Organic'
  | 'Minimal'
  | 'Material';

export interface StylePromptDefinition {
  id: AIStyle;
  displayName: string;
  styleFamily: string;
  category: VisualCategory;
  collection: StyleCollection;
  description: string;
  paletteLane: string;
  compositionFamily: CompositionFamily;
  materialBehavior: string;
  styleNativeMotif: string;
  defaultDensity: 'sparse' | 'moderate' | 'rich';
  promptStyleBlock: string;
  negativePrompt: string;
  accentMotifs: string[];
  visualLanguage?: VisualLanguageDNA;
  lifecycleStatus?: StyleLifecycleStatus;
  visualFamily?: string;
}

export type AnchorStyleDefinition = StylePromptDefinition;

export interface BuildStylePromptOptions {
  category?: string;
  categoryColor?: string;
  recentRenders?: {
    usedStyles?: string[];
    usedStyleFamilies?: string[];
    usedCompositions?: string[];
    usedPaletteLanes?: string[];
    usedDensityLevels?: string[];
    usedMaterialTypes?: string[];
  };
}

export interface IntentionSignal {
  theme: string;
  directionalBehavior: string;
  densityBehavior: string;
  focalBehavior: string;
  paletteBehavior: string;
  rhythmBehavior: string;
  visualTension?: string;
  spatialPressure?: string;
  motif: string;
}

// ============================================================================
// Global Negative Prompts
// ============================================================================

export const GLOBAL_NEGATIVE_PROMPT =
  'text, words, letters, phrases, captions, numbers, numerals, readable characters, fake writing, runes, invented alphabets, inscriptions, labels, readable diagrams, currency symbols, dollar sign, coins, cash, banknotes, credit cards, bank logos, charts, graphs, stock ticker, brand logos, watermark, copyright mark, clipart, sticker, icon pack, emoji, flat app icon, photorealistic human face, human figure, portrait, hands, body, literal scene, literal intention illustration, literal object explanation, literal nautical anchor, ship anchor, boat anchor, physical anchor, metal anchor, anchor object, anchor icon, anchor logo, anchor emoji, recognizable anchor silhouette, maritime imagery, harbor, ship, boat, generic mystical poster, generic occult poster, repetitive mandala, repetitive concentric-circle framing, generic sacred emblem, default glowing halo, stock fantasy glow, astrology wheel, zodiac poster, occult seal, distorted geometry, altered structure, altered shape, warped lines, broken Anchor, melted Anchor, obscured Anchor, broken sigil, melted sigil, blurry, muddy detail, low quality, random artifacts, overcrowded ornament';

export const LITERAL_ANCHOR_EXCLUSION = `
LITERAL SUBJECT EXCLUSION — ABSOLUTE:
Create abstract symbolic Anchor artwork only. “Anchor” is the app/product name, not a physical subject. Never draw, add, clarify, embellish, or suggest a real-world nautical, ship, boat, or metal anchor; anchor icon; anchor logo; anchor emoji; or recognizable anchor silhouette. If the supplied linework happens to resemble an anchor, preserve it only as abstract non-object geometry and never turn it into a literal anchor.`.trim();

export const STYLE_EXTRA_NEGATIVES: Partial<Record<AIStyle, string>> = {
  ink_brush: 'calligraphy letters, readable brush marks, decorative script',
  sacred_geometry: 'stock sacred geometry poster, overpowering mandala, generic occult chart',
  prism_veil: 'neon rainbow effect, cheap holographic sticker, plastic iridescence',
  prism_fold: 'neon rainbow effect, cheap holographic sticker, plastic iridescence',
  celestial_grid: 'zodiac signs, horoscope wheel, readable chart labels, astrology glyphs',
  architectural_trace: 'readable annotations, blueprint labels, technical numbers',
  resonance_rings: 'sonar UI, target reticle, radar screen',
  solar_veil: 'literal suns, rays, fiery solar flares, saturated yellow neon',
  solar_halo: 'literal suns, landscapes, flames, overwhelming golden poster treatment',
  ink_bloom: 'calligraphy, readable brush marks, literal flowers, uncontrolled splatter across linework',
  ocean_current: 'literal waves, beaches, shells, sea creatures, watery blur softening geometry',
  tideglass: 'literal beaches, shells, waves as objects, watery blur that softens geometry',
  halo_drift: 'literal suns, religious iconography, target rings, hard circular frames, glowing UI effects',
  harvest_gild: 'literal harvest objects, coins, antique props, readable inscriptions, decorative clutter',
  midnight_bloom: 'flowers as objects, flames, fashion imagery, oversaturated red effects',
  winter_halo: 'literal snow scenes, snowflakes, winter landscapes, hard target circles, frost on linework',
  gold_leaf: 'generic sparkle overlays, coins, currency, neon glitter, ornamental competing frames',
  cosmic: 'planets, literal space scenes, astronauts, zodiac signs, horoscope wheel',
  minimal_line: 'app-icon treatment, decorative clutter, colorful gradients, glowing halos',
  obsidian_mono: 'color noise, soft painterly treatment, flat monochrome poster styling, bright glow',
  aurora_glow: 'rainbow neon, hard-edged overlays, literal landscape scenes, synthetic flares',
  ember_trace: 'flames as literal objects, explosions, messy molten distortion',
  monolith_ink: 'soft brushiness, decorative filigree, ornamental clutter, metallic shine',
  echo_chamber: 'wallpaper ripples, hard target graphics, high-contrast UI rings',
  verdigris_relic: 'coins, relic icons, fake inscriptions, literal artifacts',
  velvet_ember: 'fashion objects, jewelry literalism, flames, oversaturated red glow',
  cyanotype: 'neon blue, digital glow, metallic gold, blueprint technical numbers, camera overlay',
  cut_paper: 'painterly blending, digital gradients, metallic shine, plastic gloss, 3d clay',
  risograph: 'cinematic lighting, 3d render, glossy poster, smooth airbrush gradient',
  screenprint: 'airbrush, watercolor runs, 3d render, lens flare, digital glow',
  monoprint: 'digital vector, flat icons, clipart, perfect machine symmetry',
  charcoal_field: 'digital polish, bright saturated colors, smooth airbrush, metallic sheen',
  graphite_study: 'color, watercolor washes, digital airbrush, rough scribble, neon',
  stone_relief: 'glowing runes, neon glow, magic fantasy effects, plastic 3d render',
  porcelain: 'grunge, rough distress, metallic foil, neon glow, plastic tile',
  copper_patina: 'gold leaf duplication, neon green, clean chrome, fantasy slime',
  topographic: 'readable numbers, text labels, hiking trails, GPS icons, fingerprint, zebra stripes',
  botanical_etching: 'flower bouquets, cartoon leaves, text labels, wallpaper floral print',
  mineral_bloom: 'tie-dye, psychedelic swirls, resin pour, glitter, cheap crystal',
  dreamscape: 'melting clocks, fantasy animals, cliche surrealism, face in cloud, literal narrative',
  soft_monument: 'dystopian bunker, military fort, dark ruin, noisy concrete textures',
  street_mark: 'graffiti tags, bubble letters, sticker bomb, messy spray splatter',
  collage_archive: 'readable text, letters, magazine faces, chaotic scrapbooking, pop art cutout',
  lightfield: 'planets, mandalas, sparkles, glitter, particles, stars, neon bar sign',
  original: 'glow, shading, gradient fills, distressed textures, app icon, mystical badge',
};

export function getStyleNegativePrompt(style: string): string {
  const styleKey = normalizeStyleId(style);
  const extraLegacy = Object.prototype.hasOwnProperty.call(STYLE_EXTRA_NEGATIVES, styleKey)
    ? STYLE_EXTRA_NEGATIVES[styleKey as AIStyle]
    : undefined;

  const additions: string[] = [];
  if (extraLegacy) {
    additions.push(extraLegacy);
  }

  // Append style.visualLanguage.negativePromptAdditions if available
  if (
    typeof STYLE_PROMPT_LIBRARY !== 'undefined' &&
    STYLE_PROMPT_LIBRARY &&
    Object.prototype.hasOwnProperty.call(STYLE_PROMPT_LIBRARY, styleKey)
  ) {
    const def = STYLE_PROMPT_LIBRARY[styleKey as AIStyle];
    if (def?.visualLanguage?.negativePromptAdditions?.length) {
      additions.push(...def.visualLanguage.negativePromptAdditions);
    }
  }

  const rawTokens = additions
    .join(', ')
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(rawTokens));

  return unique.length > 0 ? `${GLOBAL_NEGATIVE_PROMPT}, ${unique.join(', ')}` : GLOBAL_NEGATIVE_PROMPT;
}

// ============================================================================
// Intention Signals
// ============================================================================

const INTENTION_SIGNALS: Array<IntentionSignal & { keywords: string[] }> = [
  {
    theme: 'Focus / discipline',
    keywords: [
      'focus',
      'discipline',
      'disciplined',
      'steady',
      'clarity',
      'concentrate',
      'study',
      'attention',
    ],
    directionalBehavior: 'converging motion toward one stable focal zone',
    densityBehavior: 'restrained outer field, denser inner concentration',
    focalBehavior: 'one calm dominant center with minimal competition',
    paletteBehavior: 'cool restrained base with one controlled warm accent',
    rhythmBehavior: 'even, measured, unbroken',
    visualTension: 'disciplined centripetal hold',
    spatialPressure: 'contained inward convergence',
    motif: 'converging field pressure and measured spacing, never a literal eye, tool, or diagram',
  },
  {
    theme: 'Confidence / courage',
    keywords: [
      'confidence',
      'confident',
      'courage',
      'brave',
      'bold',
      'power',
      'worthy',
      'fearless',
      'success',
      'successful',
      'achieve',
      'achievement',
      'strong',
      'strength',
      'gym',
      'fitness',
    ],
    directionalBehavior: 'upward lift or outward expansion',
    densityBehavior: 'stronger central field with open surrounding space',
    focalBehavior: 'brighter center, firmer edges',
    paletteBehavior: 'warmer accents, gold, ember, brass, or sunlit tones where the style permits',
    rhythmBehavior: 'steady rising pulse',
    visualTension: 'taut upward kinetic lift',
    spatialPressure: 'confident centrifugal push into surrounding space',
    motif:
      'upward light pressure and firmer edge emphasis, never a literal figure, weapon, crown, or trophy',
  },
  {
    theme: 'Abundance / growth',
    keywords: [
      'abundance',
      'abundant',
      'growth',
      'grow',
      'prosper',
      'wealth',
      'money',
      'receive',
      'expand',
    ],
    directionalBehavior: 'expanding arcs and layered outward growth',
    densityBehavior: 'rich but ordered supporting detail',
    focalBehavior: 'glowing center with branching peripheral accents',
    paletteBehavior:
      'fertile greens, gold, teal, warm earth, or luminous amber without currency imagery',
    rhythmBehavior: 'organic expansion, gradual bloom',
    visualTension: 'unfolding branching resilience',
    spatialPressure: 'generous layered expansion',
    motif:
      'abstract branching density and expanding arcs, never coins, cash, baskets, or financial symbols',
  },
  {
    theme: 'Healing / peace',
    keywords: [
      'healing',
      'heal',
      'health',
      'peace',
      'calm',
      'serenity',
      'rest',
      'soften',
      'recover',
    ],
    directionalBehavior: 'soft circular settling or downward calm',
    densityBehavior: 'spacious field with gentle detail',
    focalBehavior: 'softened center with less hard contrast',
    paletteBehavior: 'cool blues, pale green, silver, ivory, or soft violet where compatible',
    rhythmBehavior: 'slow, quiet, breathing motion',
    visualTension: 'soothed, gentle release of strain',
    spatialPressure: 'spacious atmospheric ease',
    motif:
      'settling haze and softened edge rhythm, never medical symbols, bodies, or literal nature icons',
  },
  {
    theme: 'Love / relationship',
    keywords: [
      'love',
      'relationship',
      'romance',
      'partner',
      'connection',
      'intimacy',
      'family',
      'belong',
    ],
    directionalBehavior: 'converging paired movement or gentle orbital flow',
    densityBehavior: 'balanced left/right fields with soft connection points',
    focalBehavior: 'warm shared center',
    paletteBehavior: 'rose, copper, cream, plum, or soft gold within the selected style lane',
    rhythmBehavior: 'gentle pulse, intimate warmth',
    visualTension: 'harmonic magnetic resonance',
    spatialPressure: 'cradling bilateral embrace',
    motif:
      'paired atmospheric balance and connection points, never hearts, faces, hands, or paired figures',
  },
  {
    theme: 'Protection / stability',
    keywords: [
      'protect',
      'safe',
      'boundary',
      'boundaries',
      'stable',
      'stability',
      'ground',
      'foundation',
      'endure',
    ],
    directionalBehavior: 'downward settling and perimeter containment',
    densityBehavior: 'weighted base with quiet protective outer space',
    focalBehavior: 'firm center with guarded edges',
    paletteBehavior: 'graphite, stone, smoke, blue-black, bronze, or muted bone',
    rhythmBehavior: 'slow, grounded, resistant to disruption',
    visualTension: 'anchored perimeter sovereignty',
    spatialPressure: 'grounded downward massing',
    motif:
      'subtle perimeter pressure and grounded shadow weight, never shields, walls, locks, or chains',
  },
  {
    theme: 'Creativity / expression',
    keywords: [
      'create',
      'creative',
      'creativity',
      'art',
      'artist',
      'voice',
      'express',
      'expression',
      'expressive',
      'inspire',
      'inspiration',
      'imagine',
      'imagination',
      'craft',
      'craftsmanship',
      'write',
      'writing',
      'author',
      'design',
      'invent',
      'innovation',
      'make',
      'vision',
      'story',
      'composer',
    ],
    directionalBehavior: 'curving emergence and asymmetric outward motion',
    densityBehavior: 'varied clusters balanced by open space',
    focalBehavior: 'lively secondary emphasis without stealing from the Anchor',
    paletteBehavior: 'a wider secondary hue range with one restrained spark of warmth',
    rhythmBehavior: 'syncopated, expressive, still controlled',
    visualTension: 'dynamic asymmetric curiosity',
    spatialPressure: 'open exploratory emergence',
    motif:
      'asymmetric emergence and textured variation, never tools, musical notes, or literal art objects',
  },
];

export const DEFAULT_INTENTION_SIGNAL: IntentionSignal = {
  theme: 'General intention',
  directionalBehavior: 'subtle inward organization with a quiet outward release',
  densityBehavior: 'moderate supporting detail with clear hierarchy',
  focalBehavior: 'the preserved Anchor geometry remains the dominant focal point',
  paletteBehavior:
    'the selected style palette remains primary with a restrained accent temperature shift',
  rhythmBehavior: 'steady, composed, and non-literal',
  visualTension: 'composed equilibrium between structure and field',
  spatialPressure: 'measured atmospheric breathing room around the Anchor',
  motif: 'abstract atmospheric emphasis shaped by the wording, never literal illustration',
};

export function deriveIntentionSignal(intention: string): IntentionSignal {
  const normalized = normalizeIntention(intention).toLowerCase();
  if (!normalized) return DEFAULT_INTENTION_SIGNAL;

  for (const signal of INTENTION_SIGNALS) {
    if (signal.keywords.some(keyword => containsKeyword(normalized, keyword))) {
      const { keywords: _keywords, ...rest } = signal;
      return rest;
    }
  }

  return DEFAULT_INTENTION_SIGNAL;
}

// ============================================================================
// Category Signals
// ============================================================================

export const CATEGORY_PALETTE_MAP: Record<string, { name: string; hex: string; desc: string }> = {
  desire: { name: 'Desire', hex: '#D94F8A', desc: 'Rose / Crimson (#D94F8A) — magnetic warmth, emotional velocity' },
  health: { name: 'Health', hex: '#2FA879', desc: 'Emerald / Forest Green (#2FA879) — vital equilibrium, cellular calm' },
  career: { name: 'Career', hex: '#3157D8', desc: 'Cobalt / Royal Blue (#3157D8) — structural clarity, professional focus' },
  relationships: { name: 'Relationships', hex: '#E56F7A', desc: 'Coral Rose / Blush (#E56F7A) — intimate resonance, connective warmth' },
  creativity: { name: 'Creativity', hex: '#F28A2E', desc: 'Tangerine / Warm Amber (#F28A2E) — expressive vitality, innovative spark' },
  spirituality: { name: 'Spirituality', hex: '#7657D9', desc: 'Deep Violet / Amethyst (#7657D9) — contemplative depth, sacred quiet' },
  abundance: { name: 'Abundance', hex: '#B6A32A', desc: 'Warm Gold / Olive Ochre (#B6A32A) — fertile radiance, earned grounding' },
  family: { name: 'Family', hex: '#C86B45', desc: 'Terracotta / Warm Ochre (#C86B45) — ancestral rooting, sheltering warmth' },
  learning: { name: 'Learning', hex: '#198C9C', desc: 'Deep Teal / Sea Pine (#198C9C) — analytical lucidity, quiet intellect' },
  adventure: { name: 'Adventure', hex: '#2D9FC8', desc: 'Cerulean / Ocean Blue (#2D9FC8) — horizon expansiveness, forward motion' },
  focus: { name: 'Focus', hex: '#62666D', desc: 'Slate Gray / Cool Graphite (#62666D) — measured stillness, disciplined reduction' },
  custom: { name: 'Custom', hex: '#E85D32', desc: 'Vermilion / Coral (#E85D32) — personal resonance, distinct signature' },
};

export function getCategoryColorInfo(category?: string | null): { name: string; color: string; behavior: string } {
  const key = (category || '').trim().toLowerCase();
  const info = Object.prototype.hasOwnProperty.call(CATEGORY_PALETTE_MAP, key)
    ? CATEGORY_PALETTE_MAP[key]
    : CATEGORY_PALETTE_MAP['custom'];

  return {
    name: info.name,
    color: info.desc,
    behavior: `Category '${info.name}' influences accent temperature and subtle peripheral tone (${info.hex}) without overriding the primary medium or substrate.`,
  };
}

// ============================================================================
// Composition Variants
// ============================================================================

export const COMPOSITION_VARIANTS: Record<string, string[]> = {
  CENTRED_STILLPOINT: [
    'Hold the Anchor as a stable center while light, texture, and density settle toward it.',
    'Keep the Anchor central, but vary halo weight and peripheral spacing so the render does not feel templated.',
    'Build a calm inner field and let outer detail fade with measured restraint.',
    'Use a clear central stillpoint with one subtle asymmetry in light or material behavior.',
  ],
  OFFSET_FIELD: [
    'Keep the Anchor geometry unchanged while the supporting field is biased toward one side or quadrant.',
    'Use asymmetrical density and open counter-space so the image feels spatially authored.',
    'Let the surrounding material drift off-center while the Anchor remains structurally stable.',
    'Create one dominant off-axis field of light, texture, or atmosphere behind the Anchor.',
  ],
  DIRECTIONAL_FLOW: [
    'Move atmosphere across or around the preserved Anchor with a clear directional current.',
    'Use flowing density that passes behind the Anchor without dragging, bending, or changing it.',
    'Let light or texture travel from one edge of the frame toward another with controlled rhythm.',
    'Create a visible path through the background field while the Anchor stays exact and calm.',
  ],
  LOWER_ANCHORED: [
    'Weight the image low in the frame with grounded shadow, material depth, or base pressure.',
    'Let the lower field feel rooted while the upper field has more breathing room.',
    'Use a quiet base of density beneath the preserved Anchor without turning it into a literal pedestal.',
    'Make the composition feel settled and rooted through shadow and material gravity.',
  ],
  DIAGONAL_TENSION: [
    'Introduce controlled diagonal force through light, haze, texture, or density behind the Anchor.',
    'Let one diagonal current cut through the surrounding field without touching the Anchor geometry.',
    'Balance a strong diagonal atmosphere with enough negative space to preserve clarity.',
    'Use diagonal pressure as emotional movement, not as a new symbol or scene.',
  ],
  OPEN_VOID: [
    'Make negative space a major part of the design, with very restrained secondary detail.',
    'Let the Anchor breathe in open space while texture appears only where it strengthens focus.',
    'Use emptiness, spacing, and quiet edge treatment as the main visual language.',
    'Avoid filling the frame; the absence of ornament should feel intentional and refined.',
  ],
  FULL_FIELD: [
    'Subtle all-over atmospheric substrate and balanced peripheral activity across the entire canvas crop.',
    'Dense tactile field extending edge-to-edge behind the immutable Anchor geometry.',
    'Even texture distribution across the whole field with micro-variations that invite close inspection.',
    'Edge-to-edge material resonance that cradles the Anchor without competing with its primary lines.',
  ],
  OBJECT_PRESENTATION: [
    'Present the Anchor as a physical artifact, relic, or crafted plate resting in shallow dimensional space.',
    'Physical specimen staging with realistic directional raking light and tangible surface depth.',
    'Editorial gallery framing with quiet museum-grade mounting and natural material drop shadow.',
    'Shallow tactile depth that presents the Anchor as an authentic handmade or architectural object.',
  ],
  CENTRED_AXIS: [
    'Concentric light layers and orbital atmosphere balanced evenly along the central vertical axis.',
    'A balanced axial presence with subtle vertical atmospheric breathing room.',
    'Soft radial symmetry that remains airy and non-competitive with the primary geometry.',
    'A quiet vertical alignment that holds the Anchor steady in deep field stillness.',
  ],
};

function normalizeCompositionFamilyKey(family: string): string {
  const upper = (family || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (upper in COMPOSITION_VARIANTS) return upper;
  if (upper === 'CENTRED_STILLPOINT' || upper === 'CENTREDSTILLPOINT') return 'CENTRED_STILLPOINT';
  if (upper === 'OFFSET_FIELD' || upper === 'OFFSETFIELD') return 'OFFSET_FIELD';
  if (upper === 'DIRECTIONAL_FLOW' || upper === 'DIRECTIONALFLOW') return 'DIRECTIONAL_FLOW';
  if (upper === 'LOWER_ANCHORED' || upper === 'LOWERANCHORED') return 'LOWER_ANCHORED';
  if (upper === 'DIAGONAL_TENSION' || upper === 'DIAGONALTENSION') return 'DIAGONAL_TENSION';
  if (upper === 'OPEN_VOID' || upper === 'OPENVOID') return 'OPEN_VOID';
  if (upper === 'FULL_FIELD' || upper === 'FULLFIELD') return 'FULL_FIELD';
  if (upper === 'OBJECT_PRESENTATION' || upper === 'OBJECTPRESENTATION') return 'OBJECT_PRESENTATION';
  if (upper === 'CENTRED_AXIS' || upper === 'CENTREDAXIS') return 'CENTRED_AXIS';
  return 'CENTRED_STILLPOINT';
}

// ============================================================================
// Legacy Fallback & DNA Normalization Engine
// ============================================================================

function deriveDefaultMedium(style: StylePromptDefinition): string {
  if (style.category === 'Material') return 'Tactile physical medium with authentic material behavior';
  if (style.category === 'Organic') return 'Natural pigment washes on archival tooth';
  if (style.category === 'Geometric') return 'Precision drafted ink and technical lines';
  if (style.category === 'Luminous') return 'Atmospheric luminescence and soft emitted radiance';
  if (style.category === 'Minimal') return 'Fine-line technical engraving on dark ground';
  return 'Archival fine art rendering with disciplined restraint';
}

function deriveDefaultSubstrate(style: StylePromptDefinition): string {
  const lane = (style.paletteLane || '').toLowerCase();
  if (lane.includes('paper') || lane.includes('parchment')) return 'Textured archival cotton paper or vellum';
  if (lane.includes('black') || lane.includes('charcoal') || lane.includes('indigo') || lane.includes('navy')) {
    return 'Deep matte archival dark ground with subtle tooth';
  }
  return 'Fine museum board with soft natural tooth';
}

function deriveDefaultLight(style: StylePromptDefinition): string {
  if (style.category === 'Luminous') return 'Soft ambient luminous bloom and disciplined halo radiance';
  if (style.category === 'Geometric') return 'Clean, even drafting illumination with zero glare';
  if (style.category === 'Minimal') return 'Flat natural ambient light with quiet edge highlights';
  if (style.category === 'Material') return 'Directional raking light revealing authentic surface texture and micro-shadows';
  return 'Soft diffused natural daylight';
}

function deriveDefaultEdge(style: StylePromptDefinition): string {
  if (style.category === 'Minimal' || style.category === 'Geometric') {
    return 'Razor-sharp, precise, unfeathered geometric contours';
  }
  if (style.category === 'Organic') {
    return 'Natural edge bleed and organic drying contours held strictly outside the Anchor';
  }
  return 'Crisp preserved boundaries with natural material transition';
}

export function buildLegacyFallbackDNA(style: StylePromptDefinition): Required<VisualLanguageDNA> {
  const medium = deriveDefaultMedium(style);
  const substrate = deriveDefaultSubstrate(style);
  const light = deriveDefaultLight(style);
  const edge = deriveDefaultEdge(style);
  const extraNeg = STYLE_EXTRA_NEGATIVES[style.id] ? [STYLE_EXTRA_NEGATIVES[style.id]!] : [];

  return {
    coreArtWorld: `${style.displayName} artistic world: ${style.description}`,
    primaryMedium: medium,
    substrate: substrate,
    edgeBehavior: edge,
    lineBehavior: 'Preserved immutable Anchor linework holding fixed geometric relationships',
    spatialBehavior: `Balanced spatial authoring aligned with ${style.compositionFamily}`,
    lightBehavior: light,
    textureLogic: style.materialBehavior,
    depthLogic: 'Layered supporting atmosphere receding behind the immutable Anchor',
    ornamentSystem: style.styleNativeMotif,
    framingLogic: 'Spacious perimeter margins, avoiding decorative borders or concentric frames',
    signatureTraits: [style.materialBehavior, style.styleNativeMotif],
    shouldFeelLike: `${style.displayName} — ${style.description}`,
    mustNotFeelLike: 'Generic mystical poster, clipart sticker, flat app icon, altered geometry',
    crossStyleAvoidances: extraNeg.length ? extraNeg : ['Do not import unrelated style traits or cosmic glows'],
    paletteBehavior: style.paletteLane,
    preferredPaletteLanes: [style.paletteLane],
    categoryColorBehavior: 'Category color influences atmospheric temperature without overriding medium or substrate',
    accentBehavior: style.accentMotifs[0] || 'Restrained peripheral accent',
    allowedCompositionFamilies: [style.compositionFamily],
    preferredCompositionFamilies: [style.compositionFamily],
    motifVocabulary: [style.styleNativeMotif, ...style.accentMotifs],
    intentionMotifBehavior: 'Translates intention through abstract atmospheric density and visual tension',
    prohibitedMotifs: ['readable text', 'runes', 'astrology symbols', 'coins', 'literal illustrations'],
    maxSupportingMotifs: 3,
    directionalBehavior: 'Balanced directional flow supporting the central structure',
    densityBehavior: style.defaultDensity,
    focalBehavior: 'Anchor geometry remains the primary focal center',
    atmosphericBehavior: style.promptStyleBlock,
    negativePromptAdditions: extraNeg,
    stylePromptDirectives: [style.promptStyleBlock],
    visualFailureConditions: [
      'Altering Anchor geometry',
      'Adding readable text or characters',
      'Overcrowding the composition with generic mystical motifs',
    ],
  };
}

export function normalizeVisualLanguage(style: StylePromptDefinition): Required<VisualLanguageDNA> {
  const fallback = buildLegacyFallbackDNA(style);
  const custom = style.visualLanguage || {};

  return {
    coreArtWorld: custom.coreArtWorld || fallback.coreArtWorld,
    primaryMedium: custom.primaryMedium || fallback.primaryMedium,
    substrate: custom.substrate || fallback.substrate,
    edgeBehavior: custom.edgeBehavior || fallback.edgeBehavior,
    lineBehavior: custom.lineBehavior || fallback.lineBehavior,
    spatialBehavior: custom.spatialBehavior || fallback.spatialBehavior,
    lightBehavior: custom.lightBehavior || fallback.lightBehavior,
    textureLogic: custom.textureLogic || fallback.textureLogic,
    depthLogic: custom.depthLogic || fallback.depthLogic,
    ornamentSystem: custom.ornamentSystem || fallback.ornamentSystem,
    framingLogic: custom.framingLogic || fallback.framingLogic,
    signatureTraits: custom.signatureTraits?.length ? custom.signatureTraits : fallback.signatureTraits,
    shouldFeelLike: custom.shouldFeelLike || fallback.shouldFeelLike,
    mustNotFeelLike: custom.mustNotFeelLike || fallback.mustNotFeelLike,
    crossStyleAvoidances: custom.crossStyleAvoidances?.length ? custom.crossStyleAvoidances : fallback.crossStyleAvoidances,
    paletteBehavior: custom.paletteBehavior || fallback.paletteBehavior,
    preferredPaletteLanes: custom.preferredPaletteLanes?.length ? custom.preferredPaletteLanes : fallback.preferredPaletteLanes,
    categoryColorBehavior: custom.categoryColorBehavior || fallback.categoryColorBehavior,
    accentBehavior: custom.accentBehavior || fallback.accentBehavior,
    allowedCompositionFamilies: custom.allowedCompositionFamilies?.length ? custom.allowedCompositionFamilies : fallback.allowedCompositionFamilies,
    preferredCompositionFamilies: custom.preferredCompositionFamilies?.length ? custom.preferredCompositionFamilies : fallback.preferredCompositionFamilies,
    motifVocabulary: custom.motifVocabulary?.length ? custom.motifVocabulary : fallback.motifVocabulary,
    intentionMotifBehavior: custom.intentionMotifBehavior || fallback.intentionMotifBehavior,
    prohibitedMotifs: custom.prohibitedMotifs?.length ? custom.prohibitedMotifs : fallback.prohibitedMotifs,
    maxSupportingMotifs: custom.maxSupportingMotifs ?? fallback.maxSupportingMotifs,
    directionalBehavior: custom.directionalBehavior || fallback.directionalBehavior,
    densityBehavior: custom.densityBehavior || fallback.densityBehavior,
    focalBehavior: custom.focalBehavior || fallback.focalBehavior,
    atmosphericBehavior: custom.atmosphericBehavior || fallback.atmosphericBehavior,
    negativePromptAdditions: custom.negativePromptAdditions?.length ? custom.negativePromptAdditions : fallback.negativePromptAdditions,
    stylePromptDirectives: custom.stylePromptDirectives?.length ? custom.stylePromptDirectives : fallback.stylePromptDirectives,
    visualFailureConditions: custom.visualFailureConditions?.length ? custom.visualFailureConditions : fallback.visualFailureConditions,
  };
}

function formatList(items: string[] | undefined, fallback: string = 'None'): string {
  if (!items || items.length === 0) return fallback;
  return items.map(item => `- ${item}`).join('\n');
}

function buildRecentRendersBlock(recent?: BuildStylePromptOptions['recentRenders']): string {
  if (!recent) {
    return `[RECENTLY USED STYLES]: None recorded (first in session or history not provided)
[RECENTLY USED STYLE FAMILIES]: None recorded
[RECENTLY USED COMPOSITIONS]: None recorded
[RECENTLY USED PALETTE LANES]: None recorded
[RECENTLY USED DENSITY LEVELS]: None recorded
[RECENTLY USED MATERIAL TYPES]: None recorded`;
  }

  const lines: string[] = [];
  if (recent.usedStyles?.length) lines.push(`Recently used styles: ${recent.usedStyles.join(', ')}`);
  else lines.push('[RECENTLY USED STYLES]: None recorded');

  if (recent.usedStyleFamilies?.length) lines.push(`Recently used style families: ${recent.usedStyleFamilies.join(', ')}`);
  else lines.push('[RECENTLY USED STYLE FAMILIES]: None recorded');

  if (recent.usedCompositions?.length) lines.push(`Recently used compositions: ${recent.usedCompositions.join(', ')}`);
  else lines.push('[RECENTLY USED COMPOSITIONS]: None recorded');

  if (recent.usedPaletteLanes?.length) lines.push(`Recently used palette lanes: ${recent.usedPaletteLanes.join(', ')}`);
  else lines.push('[RECENTLY USED PALETTE LANES]: None recorded');

  if (recent.usedDensityLevels?.length) lines.push(`Recently used density levels: ${recent.usedDensityLevels.join(', ')}`);
  else lines.push('[RECENTLY USED DENSITY LEVELS]: None recorded');

  if (recent.usedMaterialTypes?.length) lines.push(`Recently used material types: ${recent.usedMaterialTypes.join(', ')}`);
  else lines.push('[RECENTLY USED MATERIAL TYPES]: None recorded');

  return lines.join('\n');
}

// ============================================================================
// Master Runtime Prompt Builder (Anchor 2.0)
// ============================================================================

export function buildStylePrompt(
  intention: string,
  styleId: string,
  variationIndex: number = 0,
  optionsOrCategory?: BuildStylePromptOptions | string
): string {
  const style = getStylePromptDefinition(styleId);
  const dna = normalizeVisualLanguage(style);
  const signal = deriveIntentionSignal(intention);
  const cleanIntention = normalizeIntention(intention) || 'personal intention';
  const safeVariationIndex = Number.isFinite(variationIndex) ? Math.trunc(variationIndex) : 0;

  const options: BuildStylePromptOptions =
    typeof optionsOrCategory === 'string'
      ? { category: optionsOrCategory }
      : optionsOrCategory || {};

  const categoryInfo = getCategoryColorInfo(options.category);

  const familyKey = normalizeCompositionFamilyKey(style.compositionFamily);
  const compositionNotes = COMPOSITION_VARIANTS[familyKey] || COMPOSITION_VARIANTS['CENTRED_STILLPOINT'];
  const compositionVariant =
    compositionNotes[positiveModulo(safeVariationIndex, compositionNotes.length)];

  const accentPool = style.accentMotifs.length > 0 ? style.accentMotifs : dna.motifVocabulary;
  const accentMotif = pickStable(
    accentPool,
    `${style.id}:${cleanIntention}:${safeVariationIndex}:accent`
  );

  const maxMotifs = dna.maxSupportingMotifs ?? 3;
  const recentBlock = buildRecentRendersBlock(options.recentRenders);

  return `ANCHOR IDENTITY
--------------------------------------------------
This Anchor embodies the intention "${cleanIntention}".

The attached reference image contains the canonical Anchor geometry derived from the user’s intention.

The Anchor geometry is the identity of the piece.

STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY
--------------------------------------------------
Preserve every primary line, circle, node, intersection, angle, and structural relationship exactly as shown.

Do not:
- warp
- bend
- melt
- rotate
- skew
- redraw
- simplify
- reshape
- replace
- reinterpret
- disconnect
- extend
- shorten
- break

Do not invent new lines that appear to belong to the Anchor.

Do not add readable:
- text
- letters
- words
- numbers
- runes
- fake alphabets
- inscriptions
- labels
- symbols

Treat the Anchor as an immutable master structure.

Styling may affect only:
- material
- atmosphere
- lighting
- framing
- color
- density
- texture
- depth
- peripheral composition
- surrounding fields
- supporting ornament
- non-Anchor visual elements

If the selected style uses a physical medium, the Anchor may appear painted, engraved, printed, gilded, carved, drawn, etched, illuminated, embedded, or projected, but the geometry must remain unchanged.

VISUAL LANGUAGE CONTRACT
--------------------------------------------------
STYLE NAME:
${style.displayName}

STYLE FAMILY:
${style.styleFamily}

VISUAL CATEGORY:
${style.category}

CORE ART WORLD:
${dna.coreArtWorld}

The selected style defines a complete artistic world.

It is not merely:
- a filter
- a background swap
- a texture overlay
- a mystical variation

The render should still be identifiable as this style even if the Anchor glyph were removed.

STYLE DNA
--------------------------------------------------
PRIMARY MEDIUM:
${dna.primaryMedium}

SUBSTRATE:
${dna.substrate}

EDGE BEHAVIOR:
${dna.edgeBehavior}

SUPPORTING LINE BEHAVIOR:
${dna.lineBehavior}

SPATIAL BEHAVIOR:
${dna.spatialBehavior}

LIGHT BEHAVIOR:
${dna.lightBehavior}

TEXTURE LOGIC:
${dna.textureLogic}

DEPTH LOGIC:
${dna.depthLogic}

ORNAMENT SYSTEM:
${dna.ornamentSystem}

FRAMING LOGIC:
${dna.framingLogic}

STYLE SIGNATURE:
${formatList(dna.signatureTraits)}

STYLE SHOULD FEEL LIKE:
${dna.shouldFeelLike}

STYLE MUST NOT FEEL LIKE:
${dna.mustNotFeelLike}

STYLE-SPECIFIC ART DIRECTION
--------------------------------------------------
${style.promptStyleBlock}

Do not force every style into:
- centered sigil poster
- circular medallion
- mystical seal
- glowing emblem
- sacred diagram
- wallpaper composition

Different styles may instead feel:
- printed
- painted
- architectural
- sculptural
- luminous
- atmospheric
- archival
- editorial
- tactile
- minimal
- geological
- optical
- handmade
- surreal

CROSS-STYLE SEPARATION
--------------------------------------------------
STYLE-SPECIFIC CROSSOVER AVOIDANCES:
${formatList(dna.crossStyleAvoidances)}

Do not import signature traits from unrelated styles.

Examples:
- Minimal styles must not inherit cosmic glow.
- Watercolor must not inherit metallic engraving.
- Cosmic must not inherit paper grain or antique manuscript texture.
- Gold Leaf must not become neon galaxy art.
- Architectural styles must not become mystical mandalas.
- Ink styles must not become polished digital fantasy.
- Material styles must not become flat icons.

Each style should own its own visual world.

STYLE SIGNATURE FOR THIS RENDER
--------------------------------------------------
Palette lane:
${style.paletteLane}

Material behavior:
${style.materialBehavior}

Style-native motif:
${style.styleNativeMotif}

Default density:
${style.defaultDensity}

Composition family:
${style.compositionFamily}

Composition variation:
${compositionVariant}

Framing mode:
${dna.framingLogic}

Light profile:
${dna.lightBehavior}

Texture profile:
${dna.textureLogic}

CATEGORY SIGNAL — SECONDARY TO STYLE
--------------------------------------------------
CATEGORY:
${categoryInfo.name}

CATEGORY COLOR:
${categoryInfo.color}

Category may influence:
- palette temperature
- accents
- emotional energy
- symbolic vocabulary
- tonal balance
- rhythm
- visual pressure

Category must not override:
- medium
- substrate
- material logic
- style family
- composition system
- visual language

INTENTION SIGNAL LAYER — NON-LITERAL
--------------------------------------------------
Translate:
"${cleanIntention}"

into visual behavior rather than literal illustration.

The intention affects the image like emotional physics.

It may influence:
- direction
- density
- focal emphasis
- palette temperature
- atmosphere
- spacing
- visual tension
- material concentration
- light intensity
- openness
- compression
- rhythm
- motion

Use:
Directional behavior: ${signal.directionalBehavior}
Density behavior: ${signal.densityBehavior}
Focal emphasis: ${signal.focalBehavior}
Palette behavior: ${signal.paletteBehavior}
Atmospheric rhythm: ${signal.rhythmBehavior}
Visual tension: ${signal.visualTension || 'balanced tension with calm core'}
Spatial pressure: ${signal.spatialPressure || 'open surrounding field'}

Do not directly illustrate the intention.

Avoid obvious literal symbolism such as:
- money for abundance
- hearts for relationships
- planes for travel
- dumbbells for health
- briefcases for career
- books for learning
unless the selected style transforms that symbolism into something highly abstract and non-literal.

SYMBOLIC MOTIFS
--------------------------------------------------
Use no more than ${maxMotifs} motifs.

Style-native motif:
${style.styleNativeMotif}

Intention-responsive motif:
${signal.motif}

Optional accent motif:
${accentMotif}

Motifs must remain secondary.

They may appear as:
- edge detail
- negative-space shaping
- light behavior
- atmosphere
- peripheral marks
- surface imperfections
- secondary geometry
- fractures
- organic traces
- directional fields
- structural echoes

Do not default to:
- planetary imagery
- zodiac imagery
- occult seals
- runes
- halos
- mandalas
- mystical circles
- generic sacred geometry

COMPOSITIONAL LANGUAGE
--------------------------------------------------
COMPOSITION FAMILY:
${style.compositionFamily}

COMPOSITION VARIANT:
${compositionVariant}

Support at least these families:
- CENTRED_STILLPOINT
- OFFSET_FIELD
- DIRECTIONAL_FLOW
- LOWER_ANCHORED
- DIAGONAL_TENSION
- OPEN_VOID
- FULL_FIELD
- OBJECT_PRESENTATION

Do not default every render to symmetrical, centered, circular, mystical poster composition.

COLOR + MATERIAL LOGIC
--------------------------------------------------
Palette lane:
${style.paletteLane}

Material behavior:
${style.materialBehavior}

Category influence:
${dna.categoryColorBehavior}

Accent behavior:
${dna.accentBehavior}

The Anchor brand palette should guide taste, not imprison the art.

Permit richer variation in:
- pigments
- metals
- neutrals
- spectral accents
- atmospheric color
- mineral tones
- paper warmth
- optical shifts
- category accents

Do not make every render navy, purple, black, or gold unless the style specifically requires it.

UNIQUENESS MANDATE
--------------------------------------------------
Every render must feel specific to:
- the Anchor
- the intention
- the category
- the style

Differentiate through at least four:
- composition
- palette
- density
- texture
- medium
- material
- light
- framing
- depth
- edge treatment
- substrate
- ornament system
- spatial balance
- visual rhythm

Avoid:
"same symbol, different background."

COLLECTION DIFFERENTIATION
--------------------------------------------------
${recentBlock}

If this data is available, prefer meaningful visual distance from recent Anchors.

Prioritize difference in:
- family
- medium
- substrate
- composition
- palette
- density
- framing
- material
- lighting
- texture

BACKWARD COMPATIBILITY RULE
--------------------------------------------------
Legacy styles remain valid.

If a style does not define full VisualLanguageDNA:
- preserve existing style behavior
- use safe derived defaults
- do not fail generation
- do not change its ID
- do not break historical references

REFERENCE IMAGE RULE
--------------------------------------------------
The attached image contains the exact Anchor structure.

Preserve:
- lines
- circles
- intersections
- angles
- nodes
- geometric relationships

Enhancements may appear:
- around
- behind
- beneath
- within the material field
- in framing
- in atmosphere
- in surface treatment
- in peripheral composition

Never alter the core geometry.`;
}

// ============================================================================
// Style Library Catalog
// ============================================================================

export const STYLE_PROMPT_LIBRARY: Record<AIStyle, StylePromptDefinition> = {
  // ── Core Launch Styles ──────────────────────────────────────────────────────
  architectural_trace: {
    id: 'architectural_trace',
    displayName: 'Architectural Trace',
    styleFamily: 'Precision / Structural',
    category: 'Geometric',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Precision / Structural',
    description: 'Precision drafting, measured geometry, blueprint discipline.',
    paletteLane: 'smoked parchment, silver-white, faint cyan, graphite',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'etched drafting ink, blueprint grid logic, silver calibration marks',
    styleNativeMotif:
      'drafting calibration ticks, non-readable survey marks, and measured guide rails',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Precision drafting discipline and measured blueprint logic. The Anchor remains crisp and untouched while calibration marks, graphite guide rails, faint cyan grid ghosts, and silver-white etched drafting strokes form a restrained technical atmosphere. Avoid readable annotations, numbers, labels, or any diagram language that could be interpreted as text.',
    negativePrompt: getStyleNegativePrompt('architectural_trace'),
    accentMotifs: [
      'partial orthographic guide rails fading before they reach the Anchor',
      'tiny non-readable calibration ticks near the margins',
      'soft graphite datum lines dissolved into smoked parchment',
    ],
    visualLanguage: {
      coreArtWorld: 'Precision drafting discipline, measured geometry, blueprint and archival drafting',
      primaryMedium: 'Etched drafting ink and graphite technical pen',
      substrate: 'Smoked blueprint parchment or heavy vellum',
      edgeBehavior: 'Crisp measured boundaries with calibration extension ticks',
      lineBehavior: 'Orthographic guide rails, datum lines, measured draft marks',
      spatialBehavior: 'Engineered structural balance, surveyed geometric grid',
      lightBehavior: 'Even drafting-table illumination, faint cyan grid reflection',
      textureLogic: 'Drafting linen tooth, graphite dusting along construction rails',
      depthLogic: 'Layered orthographic planes fading before the Anchor structure',
      ornamentSystem: 'Calibration ticks, survey marks, datum references (all non-readable)',
      framingLogic: 'Measured drafting margins with faint border datum lines',
      signatureTraits: ['Blueprint grid logic', 'Silver calibration marks', 'Graphite guide rails'],
      shouldFeelLike: 'An archival architectural masterplan drafted by a master geometer',
      mustNotFeelLike: 'Mystical mandala, occult circle, glowing sci-fi HUD',
      crossStyleAvoidances: ['Architectural styles must not become mystical mandalas or fantasy seals'],
      paletteBehavior: 'Smoked parchment, silver-white, faint cyan, graphite',
      preferredPaletteLanes: ['smoked parchment, silver-white, faint cyan, graphite'],
      categoryColorBehavior: 'Faint engineering tint in secondary grid lines',
      accentBehavior: 'Silver calibration ticks at peripheral datum points',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OFFSET_FIELD'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['calibration ticks', 'orthographic guide rails', 'datum lines'],
      intentionMotifBehavior: 'Adjusts grid spacing, guide rail density, and structural convergence',
      prohibitedMotifs: ['occult stars', 'runes', 'readable text', 'blueprint numbers', 'flames'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Measured orthographic alignment with stable focal anchor',
      densityBehavior: 'Moderate technical detail outside the Anchor perimeter',
      focalBehavior: 'Anchor sits as the definitive central structure',
      atmosphericBehavior: 'Crisp drafting clarity with subtle vellum warmth',
      negativePromptAdditions: ['readable annotations', 'blueprint labels', 'technical numbers', 'mandala'],
    },
  },

  lunar_etch: {
    id: 'lunar_etch',
    displayName: 'Lunar Etch',
    styleFamily: 'Atmospheric / Luminous',
    category: 'Mystic',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Atmospheric / Luminous',
    description: 'Moonlit silver engraving, quiet radiance, nocturnal contrast.',
    paletteLane: 'moon-silver, indigo-black, cold pearl, soft blue-white',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'silver etching, lunar dust, restrained metallic bloom',
    styleNativeMotif: 'moon-silver dust fields and quiet crescent-like edge light',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Moonlit silver engraving with cold pearl highlights and indigo-black depth. The Anchor remains exact while restrained metallic bloom, lunar dust, soft blue-white haze, and off-axis nocturnal contrast gather around it. Avoid large moon icons or literal celestial objects; keep the lunar quality atmospheric and etched.',
    negativePrompt: getStyleNegativePrompt('lunar_etch'),
    accentMotifs: [
      'soft eclipse-like shadow falloff in one side field',
      'cold pearl dust clustering away from the center',
      'thin silver bloom along peripheral darkness',
    ],
    visualLanguage: {
      coreArtWorld: 'Moonlit silver intaglio etching, nocturnal quiet, cold lunar luminescence',
      primaryMedium: 'Silverpoint and copper intaglio print on midnight paper',
      substrate: 'Midnight blue-black archival etching paper',
      edgeBehavior: 'Delicate engraved silver burr, soft eclipse falloff',
      lineBehavior: 'Etched silver linework with cold pearl highlights',
      spatialBehavior: 'Offset field with deep nocturnal shadows',
      lightBehavior: 'Cold directional moonlight, soft silver rim lighting',
      textureLogic: 'Intaglio plate press marks, fine lunar dust, delicate stippling',
      depthLogic: 'Nocturnal atmospheric layers receding into velvet blackness',
      ornamentSystem: 'Lunar dust fields, crescent edge-glow, eclipse shadows',
      framingLogic: 'Quiet asymmetrical shadow falloff at frame margins',
      signatureTraits: ['Silverpoint engraving', 'Cold pearl dust', 'Nocturnal contrast'],
      shouldFeelLike: 'A master silver intaglio print pulled under quiet moonlight',
      mustNotFeelLike: 'Cheesy werewolf moon, gothic clipart, metallic spray paint',
      crossStyleAvoidances: ['Lunar Etch must not become a literal moon poster or gothic fantasy'],
      paletteBehavior: 'Moon-silver, indigo-black, cold pearl, soft blue-white',
      preferredPaletteLanes: ['moon-silver, indigo-black, cold pearl, soft blue-white'],
      categoryColorBehavior: 'Whisper of cool silver-tinted tone in the outer mist',
      accentBehavior: 'Cold pearl dust clustering away from the center',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'LOWER_ANCHORED'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['lunar dust field', 'soft eclipse shadow falloff', 'silver bloom edge'],
      intentionMotifBehavior: 'Dictates the lunar phase atmosphere and shadow falloff angle',
      prohibitedMotifs: ['literal full moon photos', 'wolves', 'gothic gargoyles', 'runes'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Quiet nocturnal settling with off-axis glow',
      densityBehavior: 'Sparse to moderate, dominated by deep quiet space',
      focalBehavior: 'Anchor glows like a quiet silver artifact in moonlight',
      atmosphericBehavior: 'Nocturnal, silent, serene, protected',
      negativePromptAdditions: ['literal moon photograph', 'gothic tropes', 'runes', 'werewolf'],
    },
  },

  resonance_rings: {
    id: 'resonance_rings',
    displayName: 'Resonance Rings',
    styleFamily: 'Resonance / Field',
    category: 'Luminous',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Resonance / Field',
    description: 'Concentric pulse circles, waveform halos, radiating energy.',
    paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'echo rings, pulse halos, acoustic field lines',
    styleNativeMotif: 'non-uniform pulse halos and abstract acoustic field lines',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Concentric pulse circles and waveform halos moving with controlled rhythm. The Anchor remains unchanged while amber-white or teal-white echo rings pass behind and around it on charcoal graphite depth. Ring spacing should vary; avoid a generic sonar target, radar UI, or uniform wallpaper pattern.',
    negativePrompt: getStyleNegativePrompt('resonance_rings'),
    accentMotifs: [
      'uneven harmonic rings with visible falloff',
      'thin waveform bands bending around negative space',
      'a soft pulse halo offset from the exact center',
    ],
  },

  watercolor: {
    id: 'watercolor',
    displayName: 'Watercolor',
    styleFamily: 'Organic / Painterly',
    category: 'Organic',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Painterly',
    description: 'Flowing pigment washes, soft bloom, textured paper.',
    paletteLane: 'mineral blue, oxblood, moss, plum, muted saffron',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment bleed, deckled paper, wet edge blooms',
    styleNativeMotif: 'pigment blooms, deckled paper grain, and soft wet-edge tides',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Flowing watercolor on textured paper with mineral blue, oxblood, moss, plum, and muted saffron. The preserved Anchor stays sharp and exact while pigment washes bloom behind it, bleed softly at the edges, and create asymmetrical paper atmosphere. Avoid muddy washes or loose paint that obscures or redraws the Anchor.',
    negativePrompt: getStyleNegativePrompt('watercolor'),
    accentMotifs: [
      'deckled paper edge shadows',
      'granulated mineral pigment pools',
      'soft backrun blooms held outside the Anchor geometry',
    ],
    visualLanguage: {
      coreArtWorld: 'Pigment washes on heavy cold-press cotton paper, natural drying edges and backruns',
      primaryMedium: 'Wet-on-wet and wet-on-dry mineral watercolor pigments',
      substrate: '300gsm cold-press deckled cotton rag paper',
      edgeBehavior: 'Soft pigment blooms, feathery watermarks, natural drying edges',
      lineBehavior: 'Preserved Anchor linework with pigment settling along edges without distortion',
      spatialBehavior: 'Asymmetrical pigment pools with open breathable paper void',
      lightBehavior: 'Soft diffused natural daylight filtered through watercolor wash',
      textureLogic: 'Granulating mineral pigments, paper grain texture, deckled edges',
      depthLogic: 'Translucent layered washes creating organic atmospheric recession',
      ornamentSystem: 'Natural water blooms, granulating pigment pools, deckled margins',
      framingLogic: 'Organic paper deckle with asymmetrical wash falloff',
      signatureTraits: ['Deckled cotton paper grain', 'Granulating mineral pigment', 'Wet-edge blooms'],
      shouldFeelLike: 'An authentic master watercolor painting on fine archival cotton rag',
      mustNotFeelLike: 'Digital spray, airbrush, neon glow, metallic leafing, sharp plastic vector',
      crossStyleAvoidances: ['Watercolor must not inherit metallic engraving, neon, or cosmic halos'],
      paletteBehavior: 'Mineral blue, oxblood, moss, plum, muted saffron on bone paper',
      preferredPaletteLanes: ['mineral blue, oxblood, moss, plum, muted saffron'],
      categoryColorBehavior: 'Infuses one dominant mineral wash pool in the peripheral field',
      accentBehavior: 'Soft granulating backrun bloom held outside the Anchor geometry',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'DIRECTIONAL_FLOW', 'OPEN_VOID'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['granulating pigment pools', 'soft backrun blooms', 'deckled paper edges'],
      intentionMotifBehavior: 'Directs the tidal flow and density of pigment dispersion',
      prohibitedMotifs: ['metallic foils', 'neon glows', 'mechanical lines', 'runes'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Organic tidal flow across the paper plane',
      densityBehavior: 'Moderate wash density balanced by open paper areas',
      focalBehavior: 'Anchor geometry remains crisp against soft organic wash',
      atmosphericBehavior: 'Moist atmospheric paper wash, peaceful natural diffusion',
      negativePromptAdditions: ['metallic foil', 'neon glow', 'digital airbrush', 'sharp vector edges'],
    },
  },

  ink_brush: {
    id: 'ink_brush',
    displayName: 'Ink Brush',
    styleFamily: 'Organic / Minimal',
    category: 'Minimal',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Minimal',
    description: 'Sumi-e ink restraint, strong gesture, meaningful negative space.',
    paletteLane: 'black ink, bone paper, faint iron-red seal haze',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'dry brush pressure, diluted ink mist, paper grain',
    styleNativeMotif: 'dry brush pressure, diluted ink mist, and untouched paper void',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Sumi-e restraint with strong black ink, bone paper, faint iron-red seal haze, and meaningful negative space. The Anchor geometry remains exact, as if the fixed linework has received ink texture without changing its path. Use dry brush pressure, diluted mist, and paper grain around the form; avoid readable calligraphy, letters, or loose gestural redrawing.',
    negativePrompt: getStyleNegativePrompt('ink_brush'),
    accentMotifs: [
      'one dry-brush pressure field near the periphery',
      'diluted ink mist fading into open paper',
      'a faint iron-red atmospheric haze with no mark or character shape',
    ],
    visualLanguage: {
      coreArtWorld: 'Sumi-e ink discipline, dry-brush gesture, philosophical negative space',
      primaryMedium: 'Carbon pine-soot ink on absorbent paper',
      substrate: 'Handmade washi / mulberry paper with visible fiber texture',
      edgeBehavior: 'Feathered ink-bleed and dry-brush friction edges (flying white / feibai)',
      lineBehavior: 'Preserved Anchor geometry textured with authentic ink pressure without altering paths',
      spatialBehavior: 'Profound negative space (ma), asymmetrical weight',
      lightBehavior: 'Natural matte light on absorbent paper',
      textureLogic: 'Dry brush drag, fiber grain, diluted ink washes (suibokuga)',
      depthLogic: 'Atmospheric ink wash gradients fading into vast paper emptiness',
      ornamentSystem: 'Diluted ink mist, dry-brush pressure traces, faint vermilion seal haze (no text)',
      framingLogic: 'Open expansive margins with natural paper boundary',
      signatureTraits: ['Dry brush friction', 'Mulberry paper grain', 'Philosophical negative space'],
      shouldFeelLike: 'A Zen sumi-e ink painting executed with supreme stillness and focus',
      mustNotFeelLike: 'Digital ink splatter, comic book hatching, graffiti marker, fantasy calligraphy',
      crossStyleAvoidances: ['Ink styles must not become polished digital fantasy or metallic engraving'],
      paletteBehavior: 'Carbon black ink, bone washi, faint iron-red seal haze',
      preferredPaletteLanes: ['black ink, bone paper, faint iron-red seal haze'],
      categoryColorBehavior: 'Subtle warm or cool wash undertone in the diluted ink mist',
      accentBehavior: 'Faint iron-red atmospheric haze in one outer margin with zero letters',
      allowedCompositionFamilies: ['OPEN_VOID', 'DIRECTIONAL_FLOW'],
      preferredCompositionFamilies: ['OPEN_VOID'],
      motifVocabulary: ['diluted ink mist', 'dry brush pressure field', 'untouched washi void'],
      intentionMotifBehavior: 'Shapes the ink concentration and the breath of the open void',
      prohibitedMotifs: ['calligraphy characters', 'kanji', 'letters', 'splatter effects', 'gold leaf'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Single decisive sweeping current that flows into open silence',
      densityBehavior: 'Sparse, weighted, dominated by untouched paper',
      focalBehavior: 'Unflinching stillness at the Anchor center',
      atmosphericBehavior: 'Quiet, meditative, contemplative',
      negativePromptAdditions: ['calligraphy letters', 'readable brush marks', 'decorative script', 'digital brush'],
    },
  },

  gold_leaf: {
    id: 'gold_leaf',
    displayName: 'Gold Leaf',
    styleFamily: 'Material / Precious',
    category: 'Luminous',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Precious',
    description: 'Gilded finish, antique glow, precious surface depth.',
    paletteLane: 'antique gold, umber, soot-black, soft bronze',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'torn gold leaf, gilded cracks, subtle metallic dust',
    styleNativeMotif: 'torn gold leaf seams, gilded cracks, and antique metallic dust',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Antique gold leaf, umber depth, soot-black contrast, and soft bronze warmth. The Anchor remains exact while torn gilding, fine cracks, metallic dust, and stable inner glow create precious surface depth. Avoid generic sparkle overlays, coins, currency, or ornamental frames that compete with the Anchor.',
    negativePrompt: getStyleNegativePrompt('gold_leaf'),
    accentMotifs: [
      'irregular leaf seams that never cross the Anchor lines',
      'soft bronze dust gathering near the stillpoint',
      'subtle tarnish shadows in the outer field',
    ],
    visualLanguage: {
      coreArtWorld: 'Physical gold leaf gilding, traditional oil size, bole substrate, cracked leaf seams',
      primaryMedium: 'Hand-applied 23.75k gold leaf, Armenian bole, rabbit-skin glue',
      substrate: 'Matte dark gesso panel with red or soot-black bole',
      edgeBehavior: 'Micro-tears in gold foil, gilded cracks, delicate leaf overlap lines',
      lineBehavior: 'Anchor geometry gilded or incised through gilded ground with pristine integrity',
      spatialBehavior: 'Grounded central presence with dark negative space counterweight',
      lightBehavior: 'Raking directional light reflecting across physical gold leaf planes',
      textureLogic: 'Hammered gold foil wrinkles, fine bole cracks, burnished vs matte zones',
      depthLogic: 'Layered gold leaf, bole underlayer, dark matte backing',
      ornamentSystem: 'Subtle leaf seams, antique metallic dust, fine gilding cracks',
      framingLogic: 'Restrained dark perimeter margins with faint leaf falloff',
      signatureTraits: ['Torn gold leaf seams', 'Matte bole ground', 'Physical foil reflectance'],
      shouldFeelLike: 'An ancient gilded altarpiece or illuminated manuscript leaf, tactile and solemn',
      mustNotFeelLike: 'Neon yellow glow, digital gradient, Vegas casino glitter, 3D gold render',
      crossStyleAvoidances: ['Gold Leaf must not become neon galaxy art or watercolor softness'],
      paletteBehavior: 'Antique gold, red umber, soot-black, soft bronze, warm ivory',
      preferredPaletteLanes: ['antique gold, umber, soot-black, soft bronze'],
      categoryColorBehavior: 'Subtle warmth or cool undertone in the bole underlayer',
      accentBehavior: 'Soft bronze dust gathering near the stillpoint',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OBJECT_PRESENTATION', 'LOWER_ANCHORED'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['irregular leaf seams', 'bole crack network', 'burnished gold planes'],
      intentionMotifBehavior: 'Modulates the burnish level and distribution of leaf seams',
      prohibitedMotifs: ['coins', 'currency', 'sparkles', 'glitter overlays', 'shiny jewelry'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Inward settling with stable golden stillness',
      densityBehavior: 'Moderate surface detail, disciplined borders',
      focalBehavior: 'Anchor geometry commands the golden ground',
      atmosphericBehavior: 'Solemn, precious, warm, archival',
      negativePromptAdditions: ['sparkle overlay', 'glitter', 'coins', 'cash', 'yellow neon', '3d metallic render'],
    },
  },

  cosmic: {
    id: 'cosmic',
    displayName: 'Cosmic',
    styleFamily: 'Atmospheric / Expansive',
    category: 'Mystic',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Atmospheric / Expansive',
    description: 'Deep-space atmosphere, luminous dust, celestial depth.',
    paletteLane: 'midnight teal, violet gas, pale gold flare, star-white',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'nebular haze, star dust, layered dark gradients',
    styleNativeMotif: 'nebular haze, star-dust fields, and deep diagonal atmospheric currents',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Deep-space atmosphere with midnight teal, violet gas, pale gold flare, and star-white dust. The Anchor is exact and untouched while nebular haze, layered dark gradients, and a controlled diagonal pull create celestial depth. Avoid planets, literal space scenes, astronauts, or poster-like cosmic wallpaper.',
    negativePrompt: getStyleNegativePrompt('cosmic'),
    accentMotifs: [
      'a diagonal star-dust current behind the Anchor',
      'violet gas fading into midnight teal depth',
      'one pale gold flare held at the periphery',
    ],
    visualLanguage: {
      coreArtWorld: 'Deep space astronomical observation, interstellar gas and dark dust clouds',
      primaryMedium: 'Deep spatial photography and astrophotographic exposure',
      substrate: 'Void of deep interstellar space',
      edgeBehavior: 'Soft diffuse ionization fronts, sharp pinprick stellar points',
      lineBehavior: 'Anchor geometry luminous and crystalline, holding steady amidst vast space',
      spatialBehavior: 'Diagonal tension with infinite cosmic depth and expansive recession',
      lightBehavior: 'Emitted light from nebular gases and distant starlight, soft volumetric glow',
      textureLogic: 'Fine cosmic dust grains, ionization haze, interstellar clouds',
      depthLogic: 'Immense cosmic scale with multi-layered nebular curtains',
      ornamentSystem: 'Subtle star-dust currents, faint spectral emission lines (no zodiac/planets)',
      framingLogic: 'Deep space void extending infinitely beyond the frame',
      signatureTraits: ['Interstellar gas clouds', 'Diagonal star-dust currents', 'Volumetric deep space'],
      shouldFeelLike: 'An awe-inspiring deep-space photograph captured by an orbital observatory',
      mustNotFeelLike: 'Horoscope chart, astrology wheel, cheesy fantasy nebula, glowing hippie poster',
      crossStyleAvoidances: ['Cosmic must not inherit paper grain, runes, or antique manuscript texture'],
      paletteBehavior: 'Midnight teal, deep violet gas, pale gold flare, star-white dust',
      preferredPaletteLanes: ['midnight teal, violet gas, pale gold flare, star-white'],
      categoryColorBehavior: 'Shifts the emission spectrum hue of the secondary gas cloud',
      accentBehavior: 'One pale gold flare held far at the periphery',
      allowedCompositionFamilies: ['DIAGONAL_TENSION', 'DIRECTIONAL_FLOW'],
      preferredCompositionFamilies: ['DIAGONAL_TENSION'],
      motifVocabulary: ['diagonal star-dust current', 'soft ionization haze', 'peripheral flare'],
      intentionMotifBehavior: 'Governs the vector and speed of interstellar dust currents',
      prohibitedMotifs: ['planets', 'moons', 'zodiac wheels', 'horoscope symbols', 'astronauts'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Sweeping diagonal motion through vast expanse',
      densityBehavior: 'Rich volumetric atmosphere balanced by black space',
      focalBehavior: 'Anchor stands inviolate against the infinite cosmos',
      atmosphericBehavior: 'Expansive, sublime, boundless, awe-inspiring',
      negativePromptAdditions: ['planets', 'zodiac signs', 'astrology wheel', 'horoscope', 'astronaut', 'antique paper'],
    },
  },

  minimal_line: {
    id: 'minimal_line',
    displayName: 'Minimal Line',
    styleFamily: 'Precision / Minimal',
    category: 'Minimal',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Precision / Minimal',
    description: 'Ultra-clean linework, spacious restraint, quiet precision.',
    paletteLane: 'platinum on black navy, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector-like line clarity, almost no ornament',
    styleNativeMotif: 'bare negative space, micro edge highlights, and clean line tension',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Ultra-clean linework with spacious restraint, platinum on black navy or bone on charcoal, and faint silver edge clarity. The Anchor geometry remains exact with almost no ornament. Use negative space, quiet precision, and restrained edge emphasis; avoid app-icon treatment or decorative clutter.',
    negativePrompt: getStyleNegativePrompt('minimal_line'),
    accentMotifs: [
      'one quiet field of untouched negative space',
      'a faint silver edge highlight away from the center',
      'minimal peripheral alignment marks with no text quality',
    ],
    visualLanguage: {
      coreArtWorld: 'Ultra-clean linework, spacious restraint, quiet precision',
      primaryMedium: 'Fine-line technical engraving',
      substrate: 'Deep black, dark charcoal, or very dark navy museum board',
      edgeBehavior: 'Crisp hairline precision with micro edge highlights',
      lineBehavior: 'Light single-weight lines standing in stark contrast against darkness',
      spatialBehavior: 'Expansive negative space, calm breathing margins',
      lightBehavior: 'Flat natural light with quiet silver edge catches, no volumetric glow',
      textureLogic: 'Ultra-fine paper tooth, smooth matte finish',
      depthLogic: 'Shallow graphic plane with deep tonal contrast',
      ornamentSystem: 'Bare minimum alignment marks, no decorative filigree',
      framingLogic: 'Open void, generous perimeter margins',
      signatureTraits: ['Ultra-clean linework', 'Platinum on dark ground', 'Spacious restraint'],
      shouldFeelLike: 'A museum-quality dark-ground technical plate, refined, precise, silent',
      mustNotFeelLike: 'Digital neon, sci-fi HUD, flat app icon, glowing sigil',
      crossStyleAvoidances: ['Minimal styles must not inherit cosmic glow or painterly atmosphere'],
      paletteBehavior: 'Platinum on black navy, bone on charcoal, faint silver',
      preferredPaletteLanes: ['platinum on black navy, bone on charcoal, faint silver'],
      categoryColorBehavior: 'Very subtle temperature tint in the fine line reflections',
      accentBehavior: 'One faint silver edge highlight away from the center',
      allowedCompositionFamilies: ['OPEN_VOID', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['OPEN_VOID'],
      motifVocabulary: ['micro datum tick', 'fine alignment rail', 'untouched negative space'],
      intentionMotifBehavior: 'Shapes the spacing and tension of surrounding negative space',
      prohibitedMotifs: ['mandalas', 'halos', 'clouds', 'particles', 'runes'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Subtle linear alignment along the Anchor axes',
      densityBehavior: 'Ultra-sparse with absolute hierarchy',
      focalBehavior: 'The preserved Anchor geometry is the solitary focus',
      atmosphericBehavior: 'Clean, quiet, zero haze',
      negativePromptAdditions: ['cosmic haze', 'painterly textures', 'neon glow', 'app icon'],
    },
  },

  obsidian_mono: {
    id: 'obsidian_mono',
    displayName: 'Obsidian Mono',
    styleFamily: 'Material / Monochrome',
    category: 'Material',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Monochrome',
    description: 'Black glass, graphite polish, reflective shadow.',
    paletteLane: 'black glass, graphite, silver edge, smoke gray',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'polished obsidian, glossy edge highlights, dark reflection',
    styleNativeMotif: 'black-glass reflections, graphite polish, and low reflective shadow',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Polished obsidian, graphite, silver edge light, and smoke gray reflection. The Anchor remains exact while glossy highlights, black glass depth, and lower-weighted reflection make the image feel protected and grounded. Avoid color noise, soft painterly treatment, or flat monochrome poster styling.',
    negativePrompt: getStyleNegativePrompt('obsidian_mono'),
    accentMotifs: [
      'a low horizontal reflection shelf beneath the field',
      'smoke gray separation in black-on-black depth',
      'small silver glints only at the outer edge behavior',
    ],
    visualLanguage: {
      coreArtWorld: 'Volcanic glass, polished obsidian stone, graphite luster, light on deep shadow',
      primaryMedium: 'Polished obsidian stone and graphite carving',
      substrate: 'Honed black volcanic glass tablet with micro-beveled facets',
      edgeBehavior: 'Sharp conchoidal fracture edges, crisp specular glints',
      lineBehavior: 'Subtle etched relief or precision silver edge-catches on black ground',
      spatialBehavior: 'Lower-weighted anchored mass, deep tonal absorption',
      lightBehavior: 'Singular glancing raking specular reflection on glassy black surface',
      textureLogic: 'Mirror-polished stone planes, matte graphite zones, volcanic micro-texture',
      depthLogic: 'Black-on-black depth separation through variable gloss and reflection',
      ornamentSystem: 'Low reflective shadow shelves, faint graphite calibration lines',
      framingLogic: 'Deep stone tablet boundaries with low-weighted shadows',
      signatureTraits: ['Polished black glass reflections', 'Conchoidal fractures', 'Low-weighted anchor mass'],
      shouldFeelLike: 'A sacred monolith of volcanic glass carved by ancient precision tools',
      mustNotFeelLike: 'Flat grayscale vector, sci-fi metallic armor, plastic phone case',
      crossStyleAvoidances: ['Obsidian Mono must not inherit soft painterly treatment or bright color noise'],
      paletteBehavior: 'Black glass, graphite, smoke gray, cold silver specular highlight',
      preferredPaletteLanes: ['black glass, graphite, silver edge, smoke gray'],
      categoryColorBehavior: 'Deepest midnight tint perceptible only in specular falloff',
      accentBehavior: 'Small silver glints only at peripheral edge catches',
      allowedCompositionFamilies: ['LOWER_ANCHORED', 'OBJECT_PRESENTATION'],
      preferredCompositionFamilies: ['LOWER_ANCHORED'],
      motifVocabulary: ['conchoidal fracture planes', 'horizontal reflection shelf', 'graphite polish sheen'],
      intentionMotifBehavior: 'Determines the hardness of specular light and depth of shadow shelves',
      prohibitedMotifs: ['colorful halos', 'flames', 'cosmic dust', 'runes', 'flowers'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Downward settling into rooted gravitational weight',
      densityBehavior: 'Sparse, weighted, heavy negative darkness',
      focalBehavior: 'Protected black-on-black monolithic stillness',
      atmosphericBehavior: 'Silent, impenetrable, grounded, sovereign',
      negativePromptAdditions: ['color noise', 'bright glow', 'painterly textures', 'flat vector'],
    },
  },

  aurora_glow: {
    id: 'aurora_glow',
    displayName: 'Aurora Glow',
    styleFamily: 'Atmospheric / Luminous',
    category: 'Luminous',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Atmospheric / Luminous',
    description: 'Blue-green aurora light, soft spectral bloom, moving atmosphere.',
    paletteLane: 'blue-green, cobalt, violet, rare gold accents',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'light ribbons, soft atmospheric bloom, spectral haze',
    styleNativeMotif: 'blue-green light ribbons, spectral haze, and soft atmospheric bloom',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Blue-green aurora light with cobalt, violet, soft spectral bloom, and rare gold accents. The Anchor remains exact while light ribbons and haze move across and around the field. Keep the glow atmospheric and elegant; avoid rainbow neon, hard-edged overlays, or literal landscape scenes.',
    negativePrompt: getStyleNegativePrompt('aurora_glow'),
    accentMotifs: [
      'soft vertical light curtains bending around negative space',
      'cobalt-violet spectral haze in the outer field',
      'rare gold flecks used only as restrained accents',
    ],
  },

  ember_trace: {
    id: 'ember_trace',
    displayName: 'Ember Trace',
    styleFamily: 'Material / Heat',
    category: 'Material',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Heat',
    description: 'Coal-dark surface, copper heat, controlled ember glow.',
    paletteLane: 'coal black, ember orange, copper red, ash gray',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'scorched linework, heated edges, ember dust',
    styleNativeMotif: 'heated edge glow, ember dust, and scorched ash gradients',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Coal-dark surface with ember orange, copper red, and ash gray heat. The Anchor geometry remains exact while heated edges, scorched atmosphere, ember dust, and disciplined diagonal force create controlled intensity. Avoid flames as literal objects, explosions, or messy molten distortion.',
    negativePrompt: getStyleNegativePrompt('ember_trace'),
    accentMotifs: [
      'copper-red heat concentrated along peripheral edge behavior',
      'ash gray cooling fields behind the Anchor',
      'a diagonal ember dust current with strong restraint',
    ],
  },

  monolith_ink: {
    id: 'monolith_ink',
    displayName: 'Monolith Ink',
    styleFamily: 'Material / Structural',
    category: 'Geometric',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Structural',
    description: 'Heavy stone ink, monumental stillness, carved presence.',
    paletteLane: 'ash black, stone gray, dusted bronze, muted bone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'stone grain, heavy ink, carved shadow',
    styleNativeMotif: 'stone grain, heavy ink mass, carved shadow, and weighted base pressure',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Heavy stone ink with ash black, stone gray, dusted bronze, and muted bone. The Anchor remains exact while carved shadow, matte weight, mineral grain, and lower-anchored gravity create monumental stillness. Avoid soft brushiness, decorative filigree, or ornamental clutter.',
    negativePrompt: getStyleNegativePrompt('monolith_ink'),
    accentMotifs: [
      'a broad lower shadow shelf',
      'dusted bronze residue in stone grain',
      'quiet vertical mass implied behind the unchanged Anchor',
    ],
  },

  celestial_grid: {
    id: 'celestial_grid',
    displayName: 'Celestial Grid',
    styleFamily: 'Precision / Celestial',
    category: 'Geometric',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Precision / Celestial',
    description: 'Observatory geometry, star-map lines, measured cosmic order.',
    paletteLane: 'midnight navy, pale cyan, soft violet, pinprick gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'star-map plotting, observatory marks, delicate grid constellations',
    styleNativeMotif:
      'observatory plotting marks, star-map lines, and delicate constellation grids',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Measured observatory geometry with midnight navy, pale cyan, soft violet, and pinprick gold. The Anchor remains exact while star-map plotting, delicate grid constellations, and asymmetrical navigation marks orient the field. Avoid zodiac wheels, astrology symbols, readable chart labels, or generic celestial posters.',
    negativePrompt: getStyleNegativePrompt('celestial_grid'),
    accentMotifs: [
      'selective star-node clusters away from the center',
      'partial observatory arcs that do not create readable diagrams',
      'offset pale-cyan coordinate lines with no text or numbers',
    ],
    visualLanguage: {
      coreArtWorld: 'Observatory celestial cartography, astrolabe engravings, singular navigation instrument',
      primaryMedium: 'Engraved brass and silver on smoked navigational chart board',
      substrate: 'Deep smoked indigo or obsidian celestial paper',
      edgeBehavior: 'Fine instrument-grade lines, minute coordinate tick marks',
      lineBehavior: 'Measured coordinate arcs, selective constellation ties to Anchor nodes',
      spatialBehavior: 'Offset field with intentional navigational asymmetry',
      lightBehavior: 'Subtle pinprick starlight and faint brass instrument glow',
      textureLogic: 'Smoked paper tooth, fine metallic engraving burr',
      depthLogic: 'Layered navigational planes, celestial sphere projections',
      ornamentSystem: 'Astrolabe arcs, star-node clusters, non-readable coordinate scales',
      framingLogic: 'Sector-divided navigational margins with calibration marks',
      signatureTraits: ['Observatory plotting geometry', 'Delicate constellation grids', 'Navigational arcs'],
      shouldFeelLike: 'A masterwork astronomical navigation plate created by a Renaissance cosmographer',
      mustNotFeelLike: 'Stock zodiac poster, astrology wheel, horoscope diagram, fantasy magic circle',
      crossStyleAvoidances: ['Celestial Grid must not become a stock horoscope chart or glowing mandala'],
      paletteBehavior: 'Midnight navy, pale cyan, soft violet, pinprick gold, cold silver',
      preferredPaletteLanes: ['midnight navy, pale cyan, soft violet, pinprick gold'],
      categoryColorBehavior: 'Tints one major navigational arc or star cluster',
      accentBehavior: 'Selective star-nodes attaching to meaningful Anchor intersections',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['selective star-node clusters', 'observatory measurement arcs', 'coordinate lines'],
      intentionMotifBehavior: 'Configures coordinate arc curvature and star cluster density',
      prohibitedMotifs: ['zodiac signs', 'horoscope symbols', 'readable numbers', 'astrology glyphs'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Engineered navigational orientation across the sphere',
      densityBehavior: 'Moderate, disciplined, mathematically authored',
      focalBehavior: 'Anchor structure acts as the singular celestial instrument',
      atmosphericBehavior: 'Measured, archival, contemplative, grand',
      negativePromptAdditions: ['zodiac signs', 'horoscope wheel', 'readable chart labels', 'astrology glyphs'],
    },
  },

  echo_chamber: {
    id: 'echo_chamber',
    displayName: 'Echo Chamber',
    styleFamily: 'Resonance / Field',
    category: 'Luminous',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Resonance / Field',
    description: 'Repeating echoes, inner-room acoustics, layered signal.',
    paletteLane: 'smoked violet, blue-gray, muted gold, shadow black',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'nested acoustic fields, soft echo bands, chamber depth',
    styleNativeMotif: 'nested acoustic fields, soft echo bands, and shadowed chamber depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Layered acoustic depth with smoked violet, blue-gray, muted gold, and shadow black. The Anchor remains exact while nested echo bands and chamber-like depth repeat softly around the stillpoint. Avoid wallpaper ripples, hard target graphics, or high-contrast UI rings.',
    negativePrompt: getStyleNegativePrompt('echo_chamber'),
    accentMotifs: [
      'elliptical echo bands with uneven fade',
      'blue-gray chamber depth behind the form',
      'muted gold signal accents used sparingly',
    ],
  },

  prism_veil: {
    id: 'prism_veil',
    displayName: 'Prism Veil',
    styleFamily: 'Organic / Light',
    category: 'Luminous',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Light',
    description: 'Iridescent refraction, glasslike hush, spectral layering.',
    paletteLane: 'pearl, opal, pale cyan, lavender, faint gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'translucent veils, refracted edges, prism bloom',
    styleNativeMotif: 'refracted light shards and translucent veil layers',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Iridescent refracted light, spectral layering, and glasslike hush. The Anchor remains crisp and untouched while translucent color fields pass behind it. Use delicate refraction, pearl highlights, pale cyan edges, lavender haze, and faint gold glints. Avoid neon rainbow effects or cheap holographic stickers.',
    negativePrompt: getStyleNegativePrompt('prism_veil'),
    accentMotifs: [
      'translucent veil layers crossing only the surrounding field',
      'opal refraction bloom kept soft and secondary',
      'pale cyan edge glints that never become new geometry',
    ],
  },

  verdigris_relic: {
    id: 'verdigris_relic',
    displayName: 'Verdigris Relic',
    styleFamily: 'Material / Ancient',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Ancient',
    description: 'Oxidized copper, mineral patina, archaeological elegance.',
    paletteLane: 'oxidized teal, bronze, ash, dark stone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'aged copper, patina blooms, worn engraved surface',
    styleNativeMotif: 'oxidized copper patina blooms and worn archaeological surface grain',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Oxidized copper with mineral patina, bronze, ash, and dark stone. The Anchor remains exact while aged copper, worn engraving, and verdigris blooms create archaeological elegance. Keep it refined and grounded; avoid coins, relic icons, fake inscriptions, or literal artifacts.',
    negativePrompt: getStyleNegativePrompt('verdigris_relic'),
    accentMotifs: [
      'patina bloom clusters weighted toward the lower field',
      'worn bronze edge catches away from the Anchor center',
      'dark stone grain and ash mineral dust',
    ],
  },

  solar_halo: {
    id: 'solar_halo',
    displayName: 'Solar Halo',
    styleFamily: 'Atmospheric / Radiant',
    category: 'Luminous',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Atmospheric / Radiant',
    description: 'Sun-warmed radiance, disciplined brightness, haloed clarity.',
    paletteLane: 'ivory, saffron, brass, pale amber, smoke',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'soft solar rings, warm haze, brass light',
    styleNativeMotif: 'soft solar rings, disciplined brass light, and warm halo haze',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Sun-warmed radiance with ivory, saffron, brass, pale amber, and smoke. The Anchor remains exact while soft solar rings, warm haze, and disciplined brightness clarify the stillpoint. Avoid literal suns, landscapes, flames, or overwhelming golden poster treatment.',
    negativePrompt: getStyleNegativePrompt('solar_halo'),
    accentMotifs: [
      'soft brass rings fading before they touch the Anchor',
      'pale amber haze concentrated near the stillpoint',
      'smoke-muted outer warmth for contrast',
    ],
  },

  tideglass: {
    id: 'tideglass',
    displayName: 'Tideglass',
    styleFamily: 'Organic / Coastal',
    category: 'Organic',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Coastal',
    description: 'Sea-glass translucency, mineral wash, tidal softness.',
    paletteLane: 'seafoam, slate blue, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'translucent washed glass, salt haze, tide-soft edges',
    styleNativeMotif: 'sea-glass translucency, salt haze, and tide-soft mineral wash',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Sea-glass translucency with seafoam, slate blue, soft aqua, and mineral gray. The Anchor remains exact while washed glass, salt haze, tide-soft edges, and directional flow create adaptive calm. Avoid literal beaches, shells, waves as objects, or watery blur that softens the Anchor geometry.',
    negativePrompt: getStyleNegativePrompt('tideglass'),
    accentMotifs: [
      'translucent sea-glass planes behind the Anchor',
      'salt haze along one directional edge',
      'mineral gray tide lines kept abstract and secondary',
    ],
  },

  sacred_geometry: {
    id: 'sacred_geometry',
    displayName: 'Sacred Geometry',
    styleFamily: 'Geometric / Collector',
    category: 'Mystic',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Geometric / Collector',
    description: 'Layered mathematical symbolism, luminous geometric depth.',
    paletteLane: 'indigo, teal, dusty rose, muted brass, celestial blue',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'layered geometric systems, transparent overlaps, precise geometry',
    styleNativeMotif: 'transparent mathematical overlays and precise secondary geometry systems',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Tasteful layered mathematical symbolism with indigo, teal, dusty rose, muted brass, and celestial blue. The Anchor remains exact while transparent overlaps and precise secondary geometry create luminous depth. Keep this less generic than stock sacred-geometry posters; do not overpower the Anchor or force a mandala-like template.',
    negativePrompt: getStyleNegativePrompt('sacred_geometry'),
    accentMotifs: [
      'transparent geometry systems with clear hierarchy',
      'muted brass construction arcs behind the Anchor',
      'celestial blue overlap fields kept airy and precise',
    ],
  },

  velvet_ember: {
    id: 'velvet_ember',
    displayName: 'Velvet Ember',
    styleFamily: 'Material / Luxury',
    category: 'Material',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Luxury',
    description: 'Velvet darkness, warm ember glow, soft luxury depth.',
    paletteLane: 'burgundy-black, copper, warm amber, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'velvet texture, ember glints, soft smoky depth',
    styleNativeMotif: 'velvet texture, copper ember glints, and soft smoky depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Velvet darkness with burgundy-black, copper, warm amber, and soot violet. The Anchor remains exact while soft luxury depth, ember glints, smoky diagonal tension, and controlled magnetism shape the surrounding field. Avoid fashion objects, jewelry literalism, flames, or over-saturated red glow.',
    negativePrompt: getStyleNegativePrompt('velvet_ember'),
    accentMotifs: [
      'copper ember glints embedded in velvet darkness',
      'soot-violet smoke following a diagonal current',
      'warm amber depth held behind the fixed geometry',
    ],
  },

  // ── Preserved Production Release Styles ─────────────────────────────────────
  solar_veil: {
    id: 'solar_veil',
    displayName: 'Solar Veil',
    styleFamily: 'Atmospheric / Late Light',
    category: 'Luminous',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Atmospheric / Late Light',
    description: 'A warm gilded veil of late light, settled into a quiet central halo.',
    paletteLane: 'ivory, saffron, pale brass, pale amber, smoke',
    compositionFamily: 'CENTRED_AXIS',
    materialBehavior: 'diffused late light, softened brass haze, quiet halo layers',
    styleNativeMotif: 'gilded veil layers and softened late-light rings',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'A warm gilded veil like late sunlight settling over the Anchor. Preserve the exact geometry while ivory, saffron, pale brass, and pale amber haze form soft concentric light layers around the central axis. Keep the treatment quiet and diffused rather than fiery; avoid literal suns, rays, landscapes, or poster-like gold effects.',
    negativePrompt: getStyleNegativePrompt('solar_veil'),
    accentMotifs: [
      'thin veils of pale brass light receding from the center',
      'smoke-softened amber halo at the outer field',
      'ivory light settling around, never over, the fixed geometry',
    ],
  },

  ink_bloom: {
    id: 'ink_bloom',
    displayName: 'Ink Bloom',
    styleFamily: 'Organic / Pigment Bloom',
    category: 'Organic',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Pigment Bloom',
    description: 'Carbon pigment blooms outward into soft, living edges.',
    paletteLane: 'carbon black, deep sepia, bone wash',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment dispersal, wet-edge blossoming, absorbent paper grain',
    styleNativeMotif: 'soft-edged pigment blooms and diluted ink pools',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Carbon-black and deep-sepia pigment blooms dispersing through a quiet bone wash. The Anchor geometry remains exact and sharply legible while living wet-edge blooms, absorbent paper grain, and diluted ink pools open in the surrounding field. Avoid calligraphy, readable brush marks, literal flowers, or uncontrolled splatter across the linework.',
    negativePrompt: getStyleNegativePrompt('ink_bloom'),
    accentMotifs: [
      'one soft pigment bloom opening off-axis',
      'deep sepia pooling into a calm outer edge',
      'a bone-paper clearing protecting the fixed geometry',
    ],
    visualLanguage: {
      coreArtWorld: 'Carbon and sepia pigment dispersing into damp absorbent paper fibers',
      primaryMedium: 'Concentrated liquid carbon ink and sepia wash',
      substrate: 'Damp absorbent handmade fibrous paper',
      edgeBehavior: 'Living wet-edge blossoming, dendritic pigment spread',
      lineBehavior: 'Anchor lines razor-sharp surrounded by blossoming ink halos',
      spatialBehavior: 'Off-axis bloom fields balanced by bone-paper clearing',
      lightBehavior: 'Soft diffused natural wash lighting',
      textureLogic: 'Fiber capillary spread, deep carbon pooling, sepia tide rings',
      depthLogic: 'Multi-layer ink diffusion receding into paper depth',
      ornamentSystem: 'Dendritic ink blooms, pooling sepia margins, capillary traces',
      framingLogic: 'Soft organic bleed toward paper deckle',
      signatureTraits: ['Living pigment blooms', 'Capillary ink dispersal', 'Bone-wash paper clearing'],
      shouldFeelLike: 'Ink dropped into wet silk paper, unfurling organically like living breath',
      mustNotFeelLike: 'Floral illustration, comic ink splatter, tattoo flash, graffiti',
      crossStyleAvoidances: ['Ink bloom must not become floral clipart or digital grunge'],
      paletteBehavior: 'Carbon black, deep sepia, bone wash, warm charcoal',
      preferredPaletteLanes: ['carbon black, deep sepia, bone wash'],
      categoryColorBehavior: 'Subtle sepia-warm or mineral-cool undertone in the outer pool',
      accentBehavior: 'One deep sepia pool settling into the outer perimeter',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'DIRECTIONAL_FLOW'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['dendritic ink blooms', 'capillary edge spreading', 'sepia tide rings'],
      intentionMotifBehavior: 'Dictates the bloom speed and direction of capillary ink growth',
      prohibitedMotifs: ['literal flower petals', 'splatter dots', 'letters', 'metallic gold'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Asymmetrical organic unfurling away from the core',
      densityBehavior: 'Moderate organic bloom clustering with clean protective zone',
      focalBehavior: 'Anchor geometry remains crisp and protected at center',
      atmosphericBehavior: 'Damp, contemplative, organic silence',
      negativePromptAdditions: ['floral petals', 'flowers', 'splatter brushes', 'comic graphics'],
    },
  },

  prism_fold: {
    id: 'prism_fold',
    displayName: 'Prism Fold',
    styleFamily: 'Geometric / Refracted Plane',
    category: 'Geometric',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Geometric / Refracted Plane',
    description: 'Light folded through a single faceted plane with restrained refraction.',
    paletteLane: 'pearl, opal, pale cyan, lavender, faint gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'single translucent plane, refracted edge light, soft opal diffusion',
    styleNativeMotif: 'one faceted translucent plane with quiet refracted edges',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'A single faceted translucent plane folds light through pearl, opal, pale cyan, lavender, and faint gold. Keep the Anchor geometry exact while one restrained prism plane and its soft refraction occupy the surrounding field. Avoid rainbow neon, sticker holograms, shards, crystals as objects, or multiple competing facets.',
    negativePrompt: getStyleNegativePrompt('prism_fold'),
    accentMotifs: [
      'one opal plane held off the central geometry',
      'pale cyan refraction thinning into open space',
      'a faint gold edge glint that never reads as a border',
    ],
    visualLanguage: {
      coreArtWorld: 'Precision optical glass planes, dispersion of light through angled facets',
      primaryMedium: 'Faceted optical glass and spectral refraction',
      substrate: 'Clear crystalline substrate in deep spatial darkness',
      edgeBehavior: 'Beveled crystal edges with razor-sharp spectral dispersion',
      lineBehavior: 'Anchor geometry crisp and pure, passing through or behind refracted planes',
      spatialBehavior: 'Off-axis faceted planes creating dynamic asymmetric light paths',
      lightBehavior: 'Internal prism refraction, delicate spectral chromatic dispersion',
      textureLogic: 'Optical clarity, micro-surface polish, fine spectral fringing',
      depthLogic: 'Transparent overlapping glass planes with true optical refraction',
      ornamentSystem: 'Subtle spectral shards, pale refraction bands, pearl highlights',
      framingLogic: 'Asymmetrical faceted boundaries fading into open space',
      signatureTraits: ['Faceted optical planes', 'Restrained spectral refraction', 'Glasslike hush'],
      shouldFeelLike: 'High-end optical prism glass refracting clean white light into delicate spectral hues',
      mustNotFeelLike: 'Cheap rainbow sticker, neon holography, rave laser show, kaleidoscopic clutter',
      crossStyleAvoidances: ['Prism Fold must not become neon rainbow or plastic holographic foil'],
      paletteBehavior: 'Pearl, opal, pale cyan, lavender, faint gold on dark ground',
      preferredPaletteLanes: ['pearl, opal, pale cyan, lavender, faint gold'],
      categoryColorBehavior: 'Selectively highlights one refraction wavelength in the prism fan',
      accentBehavior: 'A faint gold or pale cyan edge glint along one facet boundary',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'DIAGONAL_TENSION'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['faceted translucent plane', 'pale spectral refraction band', 'opal surface highlight'],
      intentionMotifBehavior: 'Alters the angle of the refracting plane and chromatic dispersion spread',
      prohibitedMotifs: ['rainbow gradients', 'hologram stickers', 'crystals as literal objects'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Angular refraction path cutting gently across the field',
      densityBehavior: 'Sparse to moderate, maintaining crystalline lucidity',
      focalBehavior: 'Anchor geometry remains immutable and distortion-free',
      atmosphericBehavior: 'Silent, crystalline, pristine, refined',
      negativePromptAdditions: ['neon rainbow', 'cheap holographic sticker', 'plastic iridescence', 'kaleidoscope'],
    },
  },

  ocean_current: {
    id: 'ocean_current',
    displayName: 'Ocean Current',
    styleFamily: 'Organic / Tidal Motion',
    category: 'Organic',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Organic / Tidal Motion',
    description: 'Layered tidal motion carried in cool tones and transparent current bands.',
    paletteLane: 'seafoam, deep teal, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'transparent current bands, mineral wash, salt-softened edges',
    styleNativeMotif: 'layered abstract tide currents moving behind the Anchor',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Layered abstract tidal motion in seafoam, deep teal, soft aqua, and mineral gray. Preserve the Anchor geometry exactly while transparent current bands, fluid mineral washes, and salt-softened edge haze travel directionally behind it. Make the water feeling purely atmospheric; avoid literal waves, beaches, shells, sea creatures, or blur that weakens the linework.',
    negativePrompt: getStyleNegativePrompt('ocean_current'),
    accentMotifs: [
      'two transparent current bands passing behind the geometry',
      'soft aqua mineral wash fading into slate blue',
      'quiet seafoam edge haze confined to one directional field',
    ],
  },

  halo_drift: {
    id: 'halo_drift',
    displayName: 'Halo Drift',
    styleFamily: 'Symbolic / Orbital Light',
    category: 'Luminous',
    collection: 'featured',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Symbolic / Orbital Light',
    description: 'A slow orbiting ring of diffuse light drifting around the form.',
    paletteLane: 'soft amber, pearl halo, twilight graphite',
    compositionFamily: 'CENTRED_AXIS',
    materialBehavior: 'diffuse orbital ring, pearl glow, twilight graphite atmosphere',
    styleNativeMotif: 'one incomplete, slow-drifting halo orbit',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'A single incomplete halo of soft amber and pearl light drifts slowly around the exact Anchor geometry against twilight graphite. Keep the orbit diffuse, calm, and slightly off-balance, with the geometry untouched and dominant. Avoid literal suns, religious iconography, target rings, hard circular frames, or glowing UI effects.',
    negativePrompt: getStyleNegativePrompt('halo_drift'),
    accentMotifs: [
      'one broken pearl orbit fading before it closes',
      'soft amber drift displaced from the central axis',
      'twilight graphite open space around the halo',
    ],
  },

  harvest_gild: {
    id: 'harvest_gild',
    displayName: 'Harvest Gild',
    styleFamily: 'Material / Seasonal Patina',
    category: 'Luminous',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Material / Seasonal Patina',
    description: 'Amber gilding and aged patina drawn from the turning season.',
    paletteLane: 'oxidized teal, amber bronze, dark stone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'worn amber gilding, oxidized teal patina, dark stone grain',
    styleNativeMotif: 'seasoned gilded edges and low-weighted patina fields',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Seasonal amber gilding layered with oxidized teal patina and dark stone grain. The Anchor geometry remains exact while worn bronze light, quiet mineral oxidation, and grounded lower-field weight suggest something earned over time. Avoid literal harvest objects, coins, antique props, readable inscriptions, or decorative clutter.',
    negativePrompt: getStyleNegativePrompt('harvest_gild'),
    accentMotifs: [
      'amber bronze glow settled low in the frame',
      'oxidized teal patina blooming at the periphery',
      'dark stone grain grounding the lower field',
    ],
  },

  midnight_bloom: {
    id: 'midnight_bloom',
    displayName: 'Midnight Bloom',
    styleFamily: 'Symbolic / Nocturnal Bloom',
    category: 'Luminous',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Symbolic / Nocturnal Bloom',
    description: 'Soft blooms of ember-lit color opening through a deep quiet field.',
    paletteLane: 'burgundy-black, copper, warm amber, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'velvet darkness, soft color bloom, copper ember glints',
    styleNativeMotif: 'abstract nocturnal bloom shapes opening from shadow',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Deep burgundy-black and soot-violet velvet darkness with quiet copper and warm amber color blooms. Preserve the Anchor geometry exactly while abstract petal-like light expansions open softly through the surrounding diagonal field. Keep the bloom non-literal and elegant; avoid flowers as objects, flames, fashion imagery, or saturated red effects.',
    negativePrompt: getStyleNegativePrompt('midnight_bloom'),
    accentMotifs: [
      'one soft copper bloom emerging from shadow',
      'soot-violet depth carrying a restrained diagonal current',
      'warm amber glints held outside the fixed geometry',
    ],
  },

  winter_halo: {
    id: 'winter_halo',
    displayName: 'Winter Halo',
    styleFamily: 'Luminous / Frost Light',
    category: 'Luminous',
    collection: 'seasonal',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Luminous / Frost Light',
    description: 'A pale ring of frost-light with still, cold reflective depth.',
    paletteLane: 'frost silver, ice blue, deep night navy',
    compositionFamily: 'CENTRED_AXIS',
    materialBehavior: 'frosted halo, ice-crystal reflection, cold pearl haze',
    styleNativeMotif: 'thin frost-light ring and suspended crystalline glints',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'A pale frost-light halo in silver, ice blue, and deep night navy. The Anchor geometry remains exact while a thin icy ring, suspended crystalline glints, and cold pearl haze settle around it with stillness. Avoid literal snow scenes, snowflakes, winter landscapes, hard target circles, or any frost that obscures the lines.',
    negativePrompt: getStyleNegativePrompt('winter_halo'),
    accentMotifs: [
      'a thin silver frost ring left partially open',
      'ice blue crystal glints suspended in outer darkness',
      'cold pearl haze clinging to the background periphery',
    ],
  },

  original: {
    id: 'original',
    displayName: 'Original',
    styleFamily: 'Pure / Minimal',
    category: 'Minimal',
    collection: 'core',
    lifecycleStatus: 'ACTIVE',
    visualFamily: 'Pure / Minimal',
    description: 'Keep the structure close to its original form with pristine vector clarity.',
    paletteLane: 'smoked parchment, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector linework, untouched geometry, pure spatial balance',
    styleNativeMotif: 'pure negative space, ultra-fine datum lines, untouched geometry',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Pure unadorned structural foundation and clean vector clarity. The Anchor geometry remains untouched, sovereign, and crisp, surrounded by expansive negative space and quiet archival elegance. Avoid any ornamental embellishments, heavy textures, decorative frames, or synthetic digital glow.',
    negativePrompt: getStyleNegativePrompt('original'),
    accentMotifs: [
      'clean untouched negative space',
      'faint silver hairline datum catch',
      'bare archival margin void',
    ],
    visualLanguage: {
      coreArtWorld: 'Pure unadorned structural foundation, clean vector clarity, pristine spatial restraint',
      primaryMedium: 'Vector line drafting',
      substrate: 'Smooth fine-grain paper or clean digital void',
      edgeBehavior: 'Razor-sharp, continuous, unfeathered geometric contours',
      lineBehavior: 'Single uniform stroke weight, perfectly preserved path geometry',
      spatialBehavior: 'Expansive negative space, absolute central stillness',
      lightBehavior: 'Clean ambient illumination, zero theatrical flares or synthetic glow',
      textureLogic: 'Near-zero noise, delicate tooth of virgin archival stock',
      depthLogic: 'Flat graphic plane with pure spatial isolation',
      ornamentSystem: 'Zero ornamental filigree, zero secondary emblems',
      framingLogic: 'Spacious open margins, unbordered stillness',
      signatureTraits: ['Untouched geometric purity', 'Ultra-clean linework', 'Spacious void balance'],
      shouldFeelLike: 'A master draft of pure intention, essential, calm, unpolluted',
      mustNotFeelLike: 'Glowy app icon, mystical badge, busy wallpaper',
      crossStyleAvoidances: ['No cosmic glow', 'No watercolor bleed', 'No metallic leafing', 'No rustic patina'],
      paletteBehavior: 'Monochromatic bone on deep charcoal or platinum on obsidian',
      preferredPaletteLanes: ['smoked parchment, bone on charcoal, faint silver'],
      categoryColorBehavior: 'Subtlest tint in background void or single hairline accent',
      accentBehavior: 'Restrained edge catch or quiet datum line',
      allowedCompositionFamilies: ['OPEN_VOID', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['OPEN_VOID'],
      motifVocabulary: ['clean datum line', 'micro calibration tick', 'open negative field'],
      intentionMotifBehavior: 'Translates intention through spatial breathing room and line tension',
      prohibitedMotifs: ['runes', 'halos', 'mandala circles', 'stars', 'flames'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Subtle inward organization with wide open release',
      densityBehavior: 'Ultra-sparse supporting detail, high negative space',
      focalBehavior: 'Anchor geometry is 100% of the visual presence',
      atmosphericBehavior: 'Still, quiet, breathless clarity',
      negativePromptAdditions: ['glow', 'shading', 'gradient fills', 'distressed textures'],
    },
  },

  // ── Anchor 2.0 V2 Styles ───────────────────────────────────────────────────
  cyanotype: {
    id: 'cyanotype',
    displayName: 'Cyanotype',
    styleFamily: 'Archival / Photochemical',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Archival / Photochemical',
    description: 'Deep Prussian-blue photographic print, pale exposed forms, analog chemistry artifacts.',
    paletteLane: 'deep Prussian blue, cyan tone, unexposed white, raw paper border',
    compositionFamily: 'FULL_FIELD',
    materialBehavior: 'sun-washed contact borders, chemical brush pooling at edges, solar exposure fringe',
    styleNativeMotif: 'sun-wash bleed, emulsion brush borders, chemical crystallization fringe',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Traditional 19th-century sun-print cyanotype on heavy watercolor rag paper. The Anchor geometry appears as an unexposed crisp white silhouette against rich Prussian blue and cyan tones. Soft hand-coated chemical emulsion wash borders frame the composition naturally. Avoid blue neon, digital glowing overlays, metallic gold, or tech blueprint schematics.',
    negativePrompt: getStyleNegativePrompt('cyanotype'),
    accentMotifs: [
      'hand-coated emulsion brush edge pooling at frame perimeter',
      'delicate solar exposure fringe along contrast boundaries',
      'sun-bleached white negative space pockets',
    ],
    visualLanguage: {
      coreArtWorld: 'Deep Prussian-blue sun-print contact process, exposed linen paper, ferric ammonium citrate chemistry',
      primaryMedium: 'Traditional cyanotype sun printing',
      substrate: 'Heavy textured watercolor rag paper with hand-brushed chemical borders',
      edgeBehavior: 'Sun-washed contact borders, chemical brush pooling at edges, solar exposure fringe',
      lineBehavior: 'Anchor geometry as pure unexposed white silhouette, sharp contact clarity',
      spatialBehavior: 'Full-field blue saturation with open white breathing structures',
      lightBehavior: 'Natural UV sun exposure, inverted shadow tonality',
      textureLogic: 'Archival paper tooth, Prussian blue grain, chemical wash striations',
      depthLogic: 'Flat contact-print plane with chemical wash variations in deep blue',
      ornamentSystem: 'Chemical wash strokes along borders, solar exposure artifacts',
      framingLogic: 'Irregular hand-coated emulsion edges revealing raw paper margins',
      signatureTraits: ['Deep Prussian blue tones', 'Pure white unexposed silhouette', 'Hand-brushed chemical edges'],
      shouldFeelLike: 'An authentic 19th-century botanical cyanotype plate exposed in bright noon sun',
      mustNotFeelLike: 'Digital blue filter, blueprint schematic, sci-fi hologram, neon blue',
      crossStyleAvoidances: ['Cyanotype must not inherit cosmic glow, metallic leafing, or neon'],
      paletteBehavior: 'Prussian blue, cyan, bleached white, pale indigo',
      preferredPaletteLanes: ['deep Prussian blue, cyan tone, unexposed white, raw paper border'],
      categoryColorBehavior: 'Very subtle ferric green-blue tint in deep tonal areas',
      accentBehavior: 'Hand-coated emulsion brush edge pooling at frame perimeter',
      allowedCompositionFamilies: ['FULL_FIELD', 'OBJECT_PRESENTATION', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['FULL_FIELD'],
      motifVocabulary: ['sun-wash bleed', 'emulsion brush borders', 'chemical crystallization fringe'],
      intentionMotifBehavior: 'Alters the exposure density and chemical border agitation',
      prohibitedMotifs: ['blue neon', 'metallic gold', 'digital grid', 'stars'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Subtle vertical solar wash gradient',
      densityBehavior: 'Moderate all-over Prussian blue saturation',
      focalBehavior: 'Anchor stands out as pure crisp unexposed white clarity',
      atmosphericBehavior: 'Archival, sun-drenched, analog, historic',
      negativePromptAdditions: ['neon blue', 'digital glow', 'metallic gold', 'blueprint technical grid'],
    },
  },

  cut_paper: {
    id: 'cut_paper',
    displayName: 'Cut Paper',
    styleFamily: 'Tactile / Relief',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Tactile / Relief',
    description: 'Layered physical paper, hard-cut edges, cast shadows, tactile collage construction.',
    paletteLane: 'warm bone, chalk white, shadow charcoal, soft kraft',
    compositionFamily: 'OBJECT_PRESENTATION',
    materialBehavior: 'layered heavy cardstock, scalpel-cut edges, natural directional drop shadows',
    styleNativeMotif: 'beveled paper edges, negative-space apertures, recessed paper tiers',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Dimensional layered cut paper relief artwork. The Anchor is constructed from clean, scalpel-cut cardstock layers casting soft, believable drop shadows under gentle studio raking light. Layers step forward in physical space with crisp edges and fine paper grain. Avoid painterly blending, digital gradients, metallic sheen, or plastic gloss.',
    negativePrompt: getStyleNegativePrompt('cut_paper'),
    accentMotifs: [
      'one recessed cardstock tier casting a soft shadow shelf',
      'micro-beveled paper edges catching subtle ambient rim light',
      'negative-space aperture cutouts in the supporting ground',
    ],
    visualLanguage: {
      coreArtWorld: 'Layered physical paper sculpture, precision knife-cut edges, tangible cast shadows',
      primaryMedium: 'Multi-ply heavy cardstock and archival cotton paper cutouts',
      substrate: 'Recessed shadowbox backing paper with dimensional spacing',
      edgeBehavior: 'Clean beveled scalpel-cut edges with micro drop shadows',
      lineBehavior: 'Anchor geometry constructed as a raised top-layer cut paper form',
      spatialBehavior: 'Shallow physical relief with layered dimensional planes',
      lightBehavior: 'Raking physical directional light casting soft believable shadows',
      textureLogic: 'Heavy cardstock grain, clean paper edges, matte non-reflective fiber',
      depthLogic: '3 to 5 discrete physical paper layers stepping toward the viewer',
      ornamentSystem: 'Layered contour cutouts, negative space apertures, paper bevels',
      framingLogic: 'Shadowbox enclosure with clean paper borders',
      signatureTraits: ['Scalpel-cut paper edges', 'Tangible directional cast shadows', 'Layered dimensional relief'],
      shouldFeelLike: 'A handmade museum-grade paper relief sculpture lit by soft studio raking light',
      mustNotFeelLike: 'Flat digital vector, painterly smudge, glossy plastic, 3D clay',
      crossStyleAvoidances: ['Cut Paper must not have painterly blending, gradients, or metallic shine'],
      paletteBehavior: 'Warm bone, ivory, soft charcoal, architectural gray with restrained accent',
      preferredPaletteLanes: ['warm bone, chalk white, shadow charcoal, soft kraft'],
      categoryColorBehavior: 'Supplies one single colored paper sheet layer in the mid-ground',
      accentBehavior: 'One subtle colored paper tier casting a tinted shadow shelf',
      allowedCompositionFamilies: ['OBJECT_PRESENTATION', 'LOWER_ANCHORED', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['OBJECT_PRESENTATION'],
      motifVocabulary: ['beveled paper edges', 'negative-space apertures', 'recessed paper tiers'],
      intentionMotifBehavior: 'Adjusts layer depth, shadow rake angle, and spacing between cuts',
      prohibitedMotifs: ['painterly blurs', 'watercolors', 'glows', 'metallic foils'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Directional relief casting shadows from top-left',
      densityBehavior: 'Moderate, defined by clean geometric shapes and void cutouts',
      focalBehavior: 'Anchor is the primary elevated tactile layer',
      atmosphericBehavior: 'Tangible, architectural, tactile, handcrafted',
      negativePromptAdditions: ['painterly blending', 'digital gradients', 'metallic shine', 'plastic gloss'],
    },
  },

  risograph: {
    id: 'risograph',
    displayName: 'Risograph',
    styleFamily: 'Printmaking / Graphic',
    category: 'Geometric',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Printmaking / Graphic',
    description: 'Limited spot inks, visible halftone dot structure, printmaking misregistration.',
    paletteLane: 'riso teal, warm melon, soot black, cream stock',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'stochastic halftone dots, soy ink absorption, drum roller grain',
    styleNativeMotif: 'halftone screen fields, subtle registration ticks, spot ink overlaps',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Authentic analog Risograph duplicator printmaking. 2 to 3 translucent spot color inks layered on warm uncoated paper with visible halftone screens, subtle drum ink textures, and slight mechanical misregistration. Crisp graphic composition with vibrant matte inks. Avoid cinematic lighting, 3D renders, glossy finishes, or digital gradient airbrushing.',
    negativePrompt: getStyleNegativePrompt('risograph'),
    accentMotifs: [
      'subtle ink overprint creating a third emergent hue',
      'sparse halftone dot screen field in one quadrant',
      'fine registration cross marks near the print margin',
    ],
    visualLanguage: {
      coreArtWorld: 'Analog Risograph stencil duplicator printing, spot color inks, halftone screens',
      primaryMedium: 'Soy-based spot ink on uncoated paper',
      substrate: 'Warm newsprint or uncoated recycled stock with visible fiber',
      edgeBehavior: 'Slight mechanical ink drag, natural stencil tooth, micro registration shift',
      lineBehavior: 'Preserved Anchor printed in dominant spot ink with authentic drum texture',
      spatialBehavior: 'Graphic poster balance with strong intentional white space',
      lightBehavior: 'Flat print surface illumination, matte ink absorption',
      textureLogic: 'Stochastic halftone dots, soy ink absorption, drum roller grain',
      depthLogic: 'Overprinting of 2-3 transparent spot color inks (flouro pink, teal, yellow)',
      ornamentSystem: 'Halftone screens, registration crop marks, overprint blends',
      framingLogic: 'Generous print margins with subtle registration alignment marks',
      signatureTraits: ['Visible dot screen grain', 'Slight misregistration charm', 'Vibrant matte spot inks'],
      shouldFeelLike: 'An indie art book printed on a Riso GR3770 with tactile spot color inks',
      mustNotFeelLike: 'Cinematic 3D lighting, photographic realism, airbrush, glossy poster',
      crossStyleAvoidances: ['Risograph must not have cinematic lighting, 3D rendering, or digital gradients'],
      paletteBehavior: 'Risograph fluorescent pink, cornflower blue, sunflower yellow, flat black',
      preferredPaletteLanes: ['riso teal, warm melon, soot black, cream stock'],
      categoryColorBehavior: 'Determines the secondary spot ink cylinder color',
      accentBehavior: 'Overprinted ink overlap creating a third emergent hue',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'CENTRED_STILLPOINT', 'FULL_FIELD'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['halftone screen fields', 'subtle registration ticks', 'spot ink overlaps'],
      intentionMotifBehavior: 'Controls screen frequency and overprint misregistration distance',
      prohibitedMotifs: ['photorealistic shading', 'metallic leaf', 'cinematic lighting', 'lens flares'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Graphic rhythmic print flow',
      densityBehavior: 'Moderate, clean separation of graphic planes',
      focalBehavior: 'Anchor anchors the primary ink channel',
      atmosphericBehavior: 'Artisanal, tactile, modern printmaking, indie press',
      negativePromptAdditions: ['cinematic lighting', '3d render', 'glossy', 'smooth digital gradient'],
    },
  },

  screenprint: {
    id: 'screenprint',
    displayName: 'Screenprint',
    styleFamily: 'Printmaking / Bold',
    category: 'Geometric',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Printmaking / Bold',
    description: 'Serigraphy silkscreen poster, heavy squeegee ink deposit, bold graphic clarity.',
    paletteLane: 'deep charcoal, burnt terracotta, raw ochre, bone paper',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'flat opaque ink deposit, screen mesh weave texture, crisp stencil boundaries',
    styleNativeMotif: 'solid graphic color blocks, screen mesh texture hints, flat background bands',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Hand-pulled serigraph / silkscreen poster print. Thick, flat, opaque ink deposited through mesh onto heavy archival poster board. Bold graphic presence, razor-sharp stencil lines, and subtle screen mesh weave texture in the ink surface. Avoid airbrush blending, watercolor bleed, 3D renders, or soft digital glows.',
    negativePrompt: getStyleNegativePrompt('screenprint'),
    accentMotifs: [
      'a single high-contrast graphic color block in the background',
      'delicate squeegee ink edge build-up along primary lines',
      'unprinted bone paper counter-space framing the motif',
    ],
    visualLanguage: {
      coreArtWorld: 'Serigraphy / silkscreen poster print, heavy squeegee ink deposit, flat bold graphic clarity',
      primaryMedium: 'Heavy water-based screenprinting ink',
      substrate: 'Heavyweight French Paper Co. archival poster board',
      edgeBehavior: 'Crisp hand-pulled emulsion edges with micro ink build-up',
      lineBehavior: 'Solid opaque ink paths with razor-sharp stencil fidelity',
      spatialBehavior: 'Graphic poster balance, powerful positive/negative interplay',
      lightBehavior: 'Matte printroom lighting on opaque pigments',
      textureLogic: 'Screen mesh texture (150-mesh weave visible under scrutiny), matte ink body',
      depthLogic: 'Discrete flat color passes layered in physical print sequence',
      ornamentSystem: 'Flat color blocks, registration crosses, graphic perimeter fields',
      framingLogic: 'Traditional poster margins with clean border matte',
      signatureTraits: ['Flat opaque ink deposit', 'Screen mesh texture', 'Bold high-contrast graphics'],
      shouldFeelLike: 'A limited-edition serigraph poster hand-pulled in a master print shop',
      mustNotFeelLike: 'Smooth digital vector, 3D render, watercolor wash, glowing neon',
      crossStyleAvoidances: ['Screenprint must not have watercolor bleed or soft blurred glows'],
      paletteBehavior: 'Deep charcoal, burnt terracotta, raw ochre, bone paper',
      preferredPaletteLanes: ['deep charcoal, burnt terracotta, raw ochre, bone paper'],
      categoryColorBehavior: 'Sets the second squeegee color pass',
      accentBehavior: 'A single high-contrast graphic color block in the background',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'DIAGONAL_TENSION', 'FULL_FIELD'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['solid graphic shapes', 'mesh texture hints', 'flat background bands'],
      intentionMotifBehavior: 'Shapes the geometric flow of secondary print passes',
      prohibitedMotifs: ['soft airbrush', 'watercolor runs', 'lens flares', 'digital glows'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Bold graphic stability',
      densityBehavior: 'Moderate, strong silhouette presence',
      focalBehavior: 'Anchor dominates as the primary graphic stencil',
      atmosphericBehavior: 'Authoritative, graphic, tactile, collectable',
      negativePromptAdditions: ['airbrush', 'watercolor', '3d render', 'neon glow'],
    },
  },

  monoprint: {
    id: 'monoprint',
    displayName: 'Monoprint',
    styleFamily: 'Printmaking / Expressive',
    category: 'Organic',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Printmaking / Expressive',
    description: 'Unique plate impression, rolled oil ink, spontaneous plate wiping, embossed platemark.',
    paletteLane: 'warm bistre, burnt umber, raw sienna, ivory paper',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'biting roller texture, wiping rag striations, plate tone variation',
    styleNativeMotif: 'wiped plate tone, embossed platemark, roller pressure trails',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Singular fine-art monoprint impression pulled on a heavy etching press. Rich oil-based ink rolled onto a plate and selectively wiped with cloth, leaving expressive plate tone, roller marks, and spontaneous tonal gradations. The Anchor linework is firmly pressed into damp BFK Rives paper with a visible embossed platemark. Avoid digital vectors, clipart, flat icons, or mechanical perfection.',
    negativePrompt: getStyleNegativePrompt('monoprint'),
    accentMotifs: [
      'spontaneous wiped plate highlight opening behind the Anchor',
      'subtle roller chatter marks along one margin',
      'embossed platemark indentation along paper borders',
    ],
    visualLanguage: {
      coreArtWorld: 'Single unique plate impression, rolled oil ink, spontaneous plate wiping, ghost impressions',
      primaryMedium: 'Viscous oil-based etching ink rolled and wiped on plexiglas plate',
      substrate: 'Damp BFK Rives heavyweight printmaking paper',
      edgeBehavior: 'Soft wiped plate edges, roller marks, subtle ink chatter',
      lineBehavior: 'Anchor incised or masked into the ink field, appearing sharp amidst painterly texture',
      spatialBehavior: 'Dynamic, one-of-a-kind plate pressure, asymmetric ink concentration',
      lightBehavior: 'Subtle oil-ink sheen caught at glancing angles',
      textureLogic: 'Biting roller texture, wiping rag striations, rich ink plate tone',
      depthLogic: 'Ghost impressions and varied ink film thicknesses',
      ornamentSystem: 'Plate tone variations, wiping marks, roller passes',
      framingLogic: 'Visible plate indentation (platemark) pressed into heavy rag paper',
      signatureTraits: ['Plate tone and wiping striations', 'Unique impression texture', 'Embossed platemark'],
      shouldFeelLike: 'A singular, irreplaceable monoprint impression pulled from an etched plate',
      mustNotFeelLike: 'Repetitive pattern, digital wallpaper, clean vector, corporate illustration',
      crossStyleAvoidances: ['Monoprint must not become a clean flat vector or digital clipart'],
      paletteBehavior: 'Warm bistre, burnt umber, raw sienna, ivory paper',
      preferredPaletteLanes: ['warm bistre, burnt umber, raw sienna, ivory paper'],
      categoryColorBehavior: 'Tints the wiping rag residue in the negative space',
      accentBehavior: 'A spontaneous wiped plate highlight behind the Anchor',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'DIRECTIONAL_FLOW'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['wiped plate tone', 'embossed platemark', 'roller pressure trails'],
      intentionMotifBehavior: 'Directs the wiping gesture and ink film gradient',
      prohibitedMotifs: ['digital sharpness', 'vector symmetry', 'clipart', 'magic circles'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Sweeping plate-wipe directional energy',
      densityBehavior: 'Rich in texture, disciplined in form',
      focalBehavior: 'Anchor shines through wiped plate clarity',
      atmosphericBehavior: 'Archival, expressive, masterly, tactile',
      negativePromptAdditions: ['digital vector', 'flat icons', 'clipart', 'perfect symmetry'],
    },
  },

  charcoal_field: {
    id: 'charcoal_field',
    displayName: 'Charcoal Field',
    styleFamily: 'Tactile / Expressive',
    category: 'Minimal',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Tactile / Expressive',
    description: 'Vine and willow charcoal, powdered carbon mass, erased light apertures, smudging.',
    paletteLane: 'deep carbon black, smoky ash gray, warm bone paper',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'charcoal dust grain, smudged stumps, erased light shafts, rough paper tooth',
    styleNativeMotif: 'erased light shafts, smudged carbon mass, charcoal dust drift',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Monumental charcoal drawing with deep velvety carbon blacks and dramatic erased light shafts. Powdered charcoal smudged with paper stumps balances against razor-clean eraser lifts. The Anchor geometry stands powerful and clear amidst dense tonal mass and rough paper tooth. Avoid digital airbrushing, clean pencil sketches, comic ink hatching, or bright saturated colors.',
    negativePrompt: getStyleNegativePrompt('charcoal_field'),
    accentMotifs: [
      'one decisive erased white gesture lifting light behind the Anchor',
      'soft charcoal dust halo settling into paper margins',
      'deepest 6B carbon black concentration anchoring one quadrant',
    ],
    visualLanguage: {
      coreArtWorld: 'Vine and willow charcoal, powdered carbon mass, kneaded eraser lifts, smudging and compression',
      primaryMedium: 'Natural willow and compressed charcoal on rough paper',
      substrate: 'Rough heavyweight charcoal paper with prominent tooth',
      edgeBehavior: 'Smudged velvety perimeter with erased razor-clean geometric boundaries',
      lineBehavior: 'Anchor geometry cleanly carved out with eraser or dense compressed charcoal lines',
      spatialBehavior: 'Profound massing of dark tones balanced by dramatic light apertures',
      lightBehavior: 'Dramatic chiaroscuro, velvety matte carbon light absorption',
      textureLogic: 'Charcoal dust grain, smudged stumps (tortillon), rough paper tooth',
      depthLogic: 'Deep atmospheric smoke recession and dense carbon foreground mass',
      ornamentSystem: 'Erased atmospheric light shafts, carbon dust drift, textured smudges',
      framingLogic: 'Raw vignette fading into rough paper margins',
      signatureTraits: ['Deep velvety black mass', 'Erased light gestures', 'Charcoal dust grain'],
      shouldFeelLike: 'A monumental studio charcoal drawing with intense emotional gravity',
      mustNotFeelLike: 'Digital airbrush, clean pencil sketch, comic book ink, photo render',
      crossStyleAvoidances: ['Charcoal Field must not have digital polish, crisp colors, or metallic shine'],
      paletteBehavior: 'Deep carbon black, smoky ash gray, warm bone paper',
      preferredPaletteLanes: ['deep carbon black, smoky ash gray, warm bone paper'],
      categoryColorBehavior: 'Very subtle warm or cool paper tint under the carbon dust',
      accentBehavior: 'One sharp erased white highlight cutting through the charcoal',
      allowedCompositionFamilies: ['DIAGONAL_TENSION', 'LOWER_ANCHORED', 'OPEN_VOID'],
      preferredCompositionFamilies: ['DIAGONAL_TENSION'],
      motifVocabulary: ['erased light shafts', 'smudged carbon mass', 'charcoal dust drift'],
      intentionMotifBehavior: 'Dictates the pressure and sweep of the erasing gesture',
      prohibitedMotifs: ['bright colors', 'metallic leaf', 'digital glow', 'technical lines'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Dynamic diagonal carbon sweep',
      densityBehavior: 'Dense dark massing with striking light contrast',
      focalBehavior: 'Anchor stands luminous amidst deep charcoal depth',
      atmosphericBehavior: 'Emotional, monumental, tactile, dramatic',
      negativePromptAdditions: ['digital polish', 'bright saturated colors', 'smooth airbrush', 'metallic sheen'],
    },
  },

  graphite_study: {
    id: 'graphite_study',
    displayName: 'Graphite Study',
    styleFamily: 'Precision / Tonal',
    category: 'Minimal',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Precision / Tonal',
    description: 'Graded graphite pencil drafting, silver sheen, disciplined cross-hatching, atelier study.',
    paletteLane: 'graphite silver, pencil gray, pure paper white, deep lead black',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'fine graphite cross-hatching, metallic pencil luster, smooth plate Bristol tooth',
    styleNativeMotif: 'cross-hatched value fields, delicate graphite guide ticks, silvery burnished sheen',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Master atelier graphite drawing on smooth Bristol board. Graded pencils (9H to 9B) create disciplined cross-hatching, delicate tonal transitions, and an authentic silvery metallic graphite luster when light hits the lead. The Anchor geometry is drafted with supreme hand precision. Avoid color of any kind, watercolor runs, rough doodles, or digital vector fills.',
    negativePrompt: getStyleNegativePrompt('graphite_study'),
    accentMotifs: [
      'delicate 2H graphite alignment guide lines framing the study',
      'deepest 9B lead tone concentrated at primary intersection points',
      'silvery graphite luster along outer cross-hatched value planes',
    ],
    visualLanguage: {
      coreArtWorld: 'Graded graphite pencil drafting (9H to 9B), silver sheen, cross-hatching, master atelier study',
      primaryMedium: 'Pure graphite pencil on smooth Bristol board',
      substrate: 'Heavy 4-ply plate-finish Bristol board',
      edgeBehavior: 'Precise graphite lines, fine tonal gradations, crisp pencil contour',
      lineBehavior: 'Pristine Anchor geometry rendered in sharp, disciplined graphite strokes',
      spatialBehavior: 'Orderly atelier study layout with generous white margins',
      lightBehavior: 'Subtle metallic graphite sheen when viewed against raking light',
      textureLogic: 'Delicate pencil grain, multi-directional cross-hatching, burnished graphite',
      depthLogic: 'Tonal values ranging from 9H silvery whisper to 9B deep velvety black',
      ornamentSystem: 'Hatching tone fields, delicate guide ticks, tonal density scales',
      framingLogic: 'Spacious study margins with light border guidelines',
      signatureTraits: ['Silvery graphite luster', 'Masterful cross-hatch shading', 'Atelier study precision'],
      shouldFeelLike: 'An exquisite master graphite study from an old European fine art atelier',
      mustNotFeelLike: 'Rough scribble, loose doodle, digital gray gradient, mechanical CAD',
      crossStyleAvoidances: ['Graphite Study must not have color noise, watercolor runs, or glow'],
      paletteBehavior: 'Graphite silver, pencil gray, pure paper white, deep lead black',
      preferredPaletteLanes: ['graphite silver, pencil gray, pure paper white, deep lead black'],
      categoryColorBehavior: 'Monochrome pure graphite study with no color pollution',
      accentBehavior: 'Deepest 9B graphite tone concentrated at key Anchor intersections',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OPEN_VOID'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['cross-hatched value fields', 'delicate graphite guide ticks', 'silvery burnished sheen'],
      intentionMotifBehavior: 'Shapes the density and direction of pencil hatching lines',
      prohibitedMotifs: ['color of any kind', 'watercolor washes', 'neon glow', 'photoreal faces'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Measured cross-hatch alignment',
      densityBehavior: 'Sparse to moderate, highly disciplined',
      focalBehavior: 'Anchor rendered with ultimate pencil fidelity',
      atmosphericBehavior: 'Scholarly, refined, classical, studious',
      negativePromptAdditions: ['color', 'watercolor', 'digital airbrush', 'rough scribble'],
    },
  },

  stone_relief: {
    id: 'stone_relief',
    displayName: 'Stone Relief',
    styleFamily: 'Sculptural / Architectural',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Sculptural / Architectural',
    description: 'Bas-relief stone carving, limestone and plaster frieze, architectural permanence.',
    paletteLane: 'warm limestone, chalk bone, shadow umber, mineral gray',
    compositionFamily: 'OBJECT_PRESENTATION',
    materialBehavior: 'chiseled V-cut stone grooves, micro mineral chips, shallow relief shadow',
    styleNativeMotif: 'chiseled relief bevels, mineral grain veining, weathered stone border',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Architectural bas-relief carving sculpted into a honed limestone or plaster frieze tablet. Directional raking sunlight casts shallow, authentic stone drop shadows along chiseled channels and beveled edges. Limestone porosity, fine mineral veining, and ancient permanence cradle the unchanged Anchor geometry. Avoid glowing fantasy runes, neon lights, 3D foam prop looks, or video game CGI rock.',
    negativePrompt: getStyleNegativePrompt('stone_relief'),
    accentMotifs: [
      'deep raking shadow inside carved relief channels',
      'weathered limestone bevel around the tablet perimeter',
      'faint calcite veining running through the stone ground',
    ],
    visualLanguage: {
      coreArtWorld: 'Bas-relief stone carving, limestone and plaster frieze, architectural permanence',
      primaryMedium: 'Chiseled limestone or molded plaster relief',
      substrate: 'Honed limestone architectural panel with natural mineral flecks',
      edgeBehavior: 'Chiseled V-cut stone grooves, micro mineral chips, shallow relief shadow',
      lineBehavior: 'Anchor geometry carved deeply or raised in bas-relief from the stone tablet',
      spatialBehavior: 'Architectural tablet presence, shallow 3D physical depth',
      lightBehavior: 'Raking sun or museum lighting casting authentic stone relief shadows',
      textureLogic: 'Limestone porosity, chisel tool marks, mineral veining',
      depthLogic: 'Shallow bas-relief plane (5mm depth) integrated into solid stone wall',
      ornamentSystem: 'Architectural moldings, shallow carved margins, mineral fossils',
      framingLogic: 'Recessed stone panel border with weathered bevel',
      signatureTraits: ['Chiseled bas-relief depth', 'Raking stone shadow', 'Limestone mineral texture'],
      shouldFeelLike: 'An ancient architectural bas-relief carving preserved in a temple wall',
      mustNotFeelLike: 'CGI video game rock, 3D foam prop, plastic casting, magical glowing ruin',
      crossStyleAvoidances: ['Stone Relief must not have mystical glowing runes or digital fantasy effects'],
      paletteBehavior: 'Warm limestone, chalk bone, shadow umber, mineral gray',
      preferredPaletteLanes: ['warm limestone, chalk bone, shadow umber, mineral gray'],
      categoryColorBehavior: 'Subtle mineral pigment staining deep within carved grooves',
      accentBehavior: 'Deep raking shadow inside the primary carved Anchor channels',
      allowedCompositionFamilies: ['OBJECT_PRESENTATION', 'CENTRED_STILLPOINT', 'LOWER_ANCHORED'],
      preferredCompositionFamilies: ['OBJECT_PRESENTATION'],
      motifVocabulary: ['chiseled relief bevels', 'mineral grain veining', 'weathered stone border'],
      intentionMotifBehavior: 'Adjusts carving depth and stone surface weathering',
      prohibitedMotifs: ['glowing cracks', 'magic runes', 'flames', 'neon lights'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Stable architectural weight and horizontal grounding',
      densityBehavior: 'Moderate, solid, enduring',
      focalBehavior: 'Anchor carved as the central architectural relief',
      atmosphericBehavior: 'Timeless, monumental, enduring, sacred',
      negativePromptAdditions: ['glowing runes', 'neon glow', 'magic effects', 'plastic 3d'],
    },
  },

  porcelain: {
    id: 'porcelain',
    displayName: 'Porcelain',
    styleFamily: 'Ceramic / Pure',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Ceramic / Pure',
    description: 'High-fire white porcelain, celadon and cobalt glaze, subtle crazing craquelure.',
    paletteLane: 'kaolin white, celadon tint, cobalt underglaze, soft cream',
    compositionFamily: 'OBJECT_PRESENTATION',
    materialBehavior: 'vitreous glass glaze, fine craquelure hairline cracks, ceramic translucency',
    styleNativeMotif: 'ice crackle craquelure, soft glaze meniscus, delicate cobalt wash',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Precious high-fired white porcelain tile or shallow vessel. The Anchor is rendered with cobalt blue underglaze or pure raised slip beneath a vitreous, micro-crazed ice-crackle glaze. Translucent kaolin clay, delicate glass gloss reflections, and imperial ceramic stillness. Avoid rough distress, metallic foils, neon glows, or cheap plastic plate textures.',
    negativePrompt: getStyleNegativePrompt('porcelain'),
    accentMotifs: [
      'fine web of hairline ice crackle glaze crazing',
      'soft glassy rim reflection along the ceramic edge',
      'subtle cobalt blue bloom settling in glaze depth',
    ],
    visualLanguage: {
      coreArtWorld: 'High-fire white porcelain, celadon and cobalt glaze, subtle crazing, bone china lucidity',
      primaryMedium: 'Fine glazed ceramic porcelain',
      substrate: 'Vitreous translucent white porcelain vessel or tile surface',
      edgeBehavior: 'Soft glazed edge meniscus, micro-crazing hairline cracks in glassy coat',
      lineBehavior: 'Anchor rendered in cobalt blue underglaze or iron oxide slip with vitreous sheen',
      spatialBehavior: 'Curved or planar ceramic surface, spacious purity',
      lightBehavior: 'Soft vitreous gloss reflections, ceramic translucency',
      textureLogic: 'Smooth glass glaze, subtle craquelure (ice crackle), kaolin clay purity',
      depthLogic: 'Underglaze depth beneath a layer of clear vitreous glass',
      ornamentSystem: 'Fine celadon crackle patterns, iron-spot glaze flecks, subtle rim luster',
      framingLogic: 'Organic ceramic rim or tile perimeter with rounded glazed edge',
      signatureTraits: ['Vitreous glaze luster', 'Delicate craquelure network', 'Cobalt underglaze purity'],
      shouldFeelLike: 'An imperial Song Dynasty white porcelain vessel with subtle ice crackle glaze',
      mustNotFeelLike: 'Cheap plastic plate, glossy kitchen tile, cartoon pottery, 3D ceramic render',
      crossStyleAvoidances: ['Porcelain must not have rough grunge, metallic leafing, or neon glow'],
      paletteBehavior: 'Kaolin white, celadon tint, cobalt underglaze, soft cream',
      preferredPaletteLanes: ['kaolin white, celadon tint, cobalt underglaze, soft cream'],
      categoryColorBehavior: 'Tints the subtle undertone of the clear celadon glaze',
      accentBehavior: 'One delicate cobalt brush mark or iron glaze spot near the rim',
      allowedCompositionFamilies: ['OBJECT_PRESENTATION', 'CENTRED_STILLPOINT'],
      preferredCompositionFamilies: ['OBJECT_PRESENTATION'],
      motifVocabulary: ['ice crackle craquelure', 'soft glaze meniscus', 'delicate cobalt wash'],
      intentionMotifBehavior: 'Governs the density and pattern of the glaze crazing network',
      prohibitedMotifs: ['rough distress', 'metallic foil', 'neon', 'comic art'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Gentle radial ceramic curvature',
      densityBehavior: 'Minimal to sparse, emphasizing porcelain purity',
      focalBehavior: 'Anchor sits embedded beneath the vitreous glaze',
      atmosphericBehavior: 'Pure, serene, luminous, quiet luxury',
      negativePromptAdditions: ['grunge', 'metallic foil', 'neon glow', 'plastic'],
    },
  },

  copper_patina: {
    id: 'copper_patina',
    displayName: 'Copper Patina',
    styleFamily: 'Material / Oxidation',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Material / Oxidation',
    description: 'Aged sheet copper, turquoise verdigris bloom, chemical oxidation, weathered metal.',
    paletteLane: 'verdigris teal, aged copper orange, oxidized turquoise, dark bronze',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'oxidized turquoise patina crust, raw copper warmth, acid-etched texture',
    styleNativeMotif: 'verdigris patina blooms, oxidized tide lines, acid-etched pitting',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Heavy architectural copper plate weathered by coastal elements. Luminous turquoise-green verdigris blooms over rich, dark bronze and raw copper orange underlayers. The Anchor geometry appears burnished or etched into the metal surface, catching warm metallic light amidst cool powdery patina. Avoid gold leaf duplication, clean chrome, neon green, or fantasy slime.',
    negativePrompt: getStyleNegativePrompt('copper_patina'),
    accentMotifs: [
      'concentrated verdigris oxidation clusters in lower field',
      'burnished raw copper line catching warm raking light',
      'dark bronze shadow areas grounding the composition',
    ],
    visualLanguage: {
      coreArtWorld: 'Aged sheet copper, turquoise verdigris bloom, chemical oxidation, atmospheric corrosion',
      primaryMedium: 'Oxidized heavy copper plate and verdigris mineral crust',
      substrate: 'Heavy weathered copper architectural sheeting',
      edgeBehavior: 'Etched copper edges, flaking mineral patina blooms, raised oxide crust',
      lineBehavior: 'Anchor geometry etched or embossed, holding raw copper warmth amidst cool patina',
      spatialBehavior: 'Lower-anchored or full-field material oxidation',
      lightBehavior: 'Subtle metallic copper glints contrasting with matte powdery patina',
      textureLogic: 'Granular verdigris crust, acid-etched pitting, brushed copper grain',
      depthLogic: 'Layers of turquoise copper carbonate blooming over deep reddish bronze base',
      ornamentSystem: 'Oxidation tide lines, mineral bloom crusts, etched calibration traces',
      framingLogic: 'Weathered copper plate edges with concentrated oxidation corners',
      signatureTraits: ['Turquoise-teal verdigris patina', 'Raw copper metallic warmth', 'Mineral oxidation crust'],
      shouldFeelLike: 'A century-old copper dome plate weathered by sea air and rain',
      mustNotFeelLike: 'Gold leaf duplicate, flat green vector, digital camouflage, fantasy slime',
      crossStyleAvoidances: ['Copper Patina must not be a gold-leaf copy, neon green, or fantasy slime'],
      paletteBehavior: 'Verdigris teal, aged copper orange, oxidized turquoise, dark bronze',
      preferredPaletteLanes: ['verdigris teal, aged copper orange, oxidized turquoise, dark bronze'],
      categoryColorBehavior: 'Influences the tone of mineral oxidation blooms',
      accentBehavior: 'Warm burnished copper line catching light through the teal patina',
      allowedCompositionFamilies: ['LOWER_ANCHORED', 'FULL_FIELD', 'OBJECT_PRESENTATION'],
      preferredCompositionFamilies: ['LOWER_ANCHORED'],
      motifVocabulary: ['verdigris patina blooms', 'oxidized tide lines', 'acid-etched pitting'],
      intentionMotifBehavior: 'Dictates the spread and weather exposure of the patina fields',
      prohibitedMotifs: ['gold leaf seams', 'neon green', 'flames', 'sci-fi metal'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Downward gravity-driven oxidation flow',
      densityBehavior: 'Rich in organic mineral texture, structurally disciplined',
      focalBehavior: 'Anchor stands out in warm burnished copper relief',
      atmosphericBehavior: 'Weathered, elemental, archaeological, grounded',
      negativePromptAdditions: ['gold leaf', 'neon green', 'clean chrome', 'plastic'],
    },
  },

  topographic: {
    id: 'topographic',
    displayName: 'Topographic',
    styleFamily: 'Precision / Cartographic',
    category: 'Geometric',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Precision / Cartographic',
    description: 'Contour line elevation fields, geodetic survey charts, abstract elevation rhythms.',
    paletteLane: 'muted slate, topo sepia, pale bone, subtle elevation ochre',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'flowing elevation contour vectors, geodetic index lines, terraced depth',
    styleNativeMotif: 'abstract contour lines, elevation step gradations, datum tick marks',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Master geodetic cartography depicting abstract mathematical terrain elevation fields. Flowing, elegant contour lines compress and dilate with fluid spatial rhythm across muted slate and sepia vellum. The Anchor geometry acts as a fixed coordinate datum summit. Avoid readable coordinates, numbers, text labels, hiking trail maps, GPS screens, or zebra stripes.',
    negativePrompt: getStyleNegativePrompt('topographic'),
    accentMotifs: [
      'one dense convergence of flowing contour lines behind the Anchor',
      'bold index contour line sweeping through negative space',
      'micro datum registration ticks along the map margin',
    ],
    visualLanguage: {
      coreArtWorld: 'Contour line elevation fields, geodetic survey charts, abstract spatial elevation rhythms',
      primaryMedium: 'Fine vector contour lines and elevation wash gradients',
      substrate: 'Heavy geodetic survey vellum or muted slate ground',
      edgeBehavior: 'Smooth continuous contour curves with micro elevation step increments',
      lineBehavior: 'Fluid elevation contours flowing around and interacting with Anchor geometry',
      spatialBehavior: 'Expansive contour field with natural spatial compression and dilation',
      lightBehavior: 'Subtle analytical raking light revealing terrain elevation steps',
      textureLogic: 'Matte map vellum, micro geodetic point grids, smooth line tension',
      depthLogic: 'Terraced stepped elevation layers creating non-literal 3D landscape rhythm',
      ornamentSystem: 'Index contour weight variations, spot elevation markers, datum lines',
      framingLogic: 'Geodetic survey frame with subtle edge coordinate ticks',
      signatureTraits: ['Flowing elevation contour fields', 'Geodetic line discipline', 'Abstract terrain rhythm'],
      shouldFeelLike: 'A master geodetic survey map depicting abstract mathematical landscapes',
      mustNotFeelLike: 'Readable hiking map, GPS screen, fingerprint graphic, zebra stripes',
      crossStyleAvoidances: ['Topographic must not have readable text/coordinates, GPS icons, or zebra prints'],
      paletteBehavior: 'Muted slate, topo sepia, pale bone, subtle elevation ochre',
      preferredPaletteLanes: ['muted slate, topo sepia, pale bone, subtle elevation ochre'],
      categoryColorBehavior: 'Tints the major index contour elevation lines',
      accentBehavior: 'One tight elevation convergence field behind the Anchor',
      allowedCompositionFamilies: ['DIRECTIONAL_FLOW', 'OFFSET_FIELD', 'FULL_FIELD'],
      preferredCompositionFamilies: ['DIRECTIONAL_FLOW'],
      motifVocabulary: ['abstract contour lines', 'elevation step gradations', 'datum tick marks'],
      intentionMotifBehavior: 'Governs contour compression, peak elevation, and slope flow',
      prohibitedMotifs: ['readable numbers', 'place names', 'trails', 'compass rose icons'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Flowing undulating terrain currents across the field',
      densityBehavior: 'Moderate, rhythmic, ordered',
      focalBehavior: 'Anchor sits as the supreme geodetic summit',
      atmosphericBehavior: 'Expansive, analytical, serene, geographic',
      negativePromptAdditions: ['readable numbers', 'text labels', 'hiking trails', 'fingerprint', 'zebra stripes'],
    },
  },

  botanical_etching: {
    id: 'botanical_etching',
    displayName: 'Botanical Etching',
    styleFamily: 'Archival / Organic',
    category: 'Organic',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Archival / Organic',
    description: 'Copperplate botanical engraving, 18th-century herbarium plates, delicate venation.',
    paletteLane: 'faded sage, sepia ink, bone vellum, dried rose, olive gray',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'fine copperplate burr, botanical venation patterns, herbarium plate margins',
    styleNativeMotif: 'abstract venation lines, seed pod geometry, herbarium plate margins',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Archival 18th-century copperplate botanical engraving on warm, foxed rag vellum. Intricate leaf venation lines, abstract seed morphology, and delicate botanical tendrils echo the preserved Anchor geometry. Soft faded sage, sepia, and dried rose watercolor washes accentuate the linework. Avoid cartoon flowers, clipart bouquets, tattoo flash, or readable Latin taxonomy text.',
    negativePrompt: getStyleNegativePrompt('botanical_etching'),
    accentMotifs: [
      'intricate leaf venation network branching away from the Anchor',
      'delicate faded sage watercolor wash pool in outer field',
      'archival herbarium plate ruling line along paper margin',
    ],
    visualLanguage: {
      coreArtWorld: 'Copperplate botanical engraving, 18th-century herbarium plates, delicate venation',
      primaryMedium: 'Fine copperplate intaglio engraving and watercolor wash',
      substrate: 'Aged rag herbarium paper with faint foxing',
      edgeBehavior: 'Crisp engraved burr lines, delicate tendril terminations',
      lineBehavior: 'Anchor geometry central and immutable, echoed by organic tendril and vein logic',
      spatialBehavior: 'Archival specimen balance with generous airy paper margins',
      lightBehavior: 'Soft archival daylight, gentle paper warmth',
      textureLogic: 'Copperplate line bite, faint age foxing spots, organic cellular grain',
      depthLogic: 'Layered botanical linework receding behind the primary structure',
      ornamentSystem: 'Abstract leaf venation patterns, seed pod cross-sections, cellular grids',
      framingLogic: 'Archival herbarium plate border with faint ruled margin',
      signatureTraits: ['Copperplate botanical linework', 'Cellular venation patterns', 'Archival herbarium paper'],
      shouldFeelLike: 'An archival plate from a master 18th-century botanical compendium',
      mustNotFeelLike: 'Clip-art flowers, cartoon leaves, tattoo flash, wallpaper floral print',
      crossStyleAvoidances: ['Botanical Etching must not become cartoon floral clipart or wallpaper prints'],
      paletteBehavior: 'Faded sage, sepia ink, bone vellum, dried rose, olive gray',
      preferredPaletteLanes: ['faded sage, sepia ink, bone vellum, dried rose, olive gray'],
      categoryColorBehavior: 'Adds subtle tint to the delicate botanical wash accents',
      accentBehavior: 'One intricate venation network branching away from the Anchor',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OFFSET_FIELD'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['abstract venation lines', 'seed pod geometry', 'herbarium plate margins'],
      intentionMotifBehavior: 'Dictates the growth vector and branching density of supporting lines',
      prohibitedMotifs: ['literal flower bouquets', 'cartoon flowers', 'insects', 'readable Latin names'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Organic upward and outward branching growth',
      densityBehavior: 'Moderate, intricate yet disciplined and spacious',
      focalBehavior: 'Anchor stands as the primary structural stem/axis',
      atmosphericBehavior: 'Archival, delicate, living, scholarly',
      negativePromptAdditions: ['flower bouquets', 'cartoon leaves', 'text labels', 'wallpaper floral'],
    },
  },

  mineral_bloom: {
    id: 'mineral_bloom',
    displayName: 'Mineral Bloom',
    styleFamily: 'Geological / Luminous',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Geological / Luminous',
    description: 'Polished agate slice, concentric mineral strata, malachite banding, druzy quartz.',
    paletteLane: 'malachite green, lapis blue, warm agate amber, quartz white',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'concentric mineral growth bands, crystalline druzy fields, gemstone translucency',
    styleNativeMotif: 'concentric mineral bands, micro druzy crystal fields, geological strata lines',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Polished cross-section of a rare natural agate or malachite geode slab. Concentric undulating mineral bands in deep lapis, malachite, amber, and quartz white radiate around the preserved Anchor. Subsurface gemstone translucency and sparkling druzy micro-crystals frame the central form. Avoid psychedelic tie-dye swirls, resin pours, glitter overlays, or cheap crystal shop props.',
    negativePrompt: getStyleNegativePrompt('mineral_bloom'),
    accentMotifs: [
      'fine ring of sparkling quartz micro-crystals framing the outer field',
      'translucent amber agate band backlit by soft raking light',
      'rough volcanic basalt rock crust at the outer tablet edge',
    ],
    visualLanguage: {
      coreArtWorld: 'Agate geode cross-sections, malachite banding, crystal lattice growth, mineral strata',
      primaryMedium: 'Polished mineral slab and translucent gemstone slicing',
      substrate: 'Cross-section of volcanic stone matrix containing crystalline strata',
      edgeBehavior: 'Concentric mineral growth rings, crystalline faceted perimeter',
      lineBehavior: 'Anchor geometry holding firm amidst natural concentric mineral banding',
      spatialBehavior: 'Concentric or offset geological field expanding from core',
      lightBehavior: 'Subsurface translucency, backlit gemstone luminosity',
      textureLogic: 'Polished agate banding, druzy quartz crystal texture, mineral inclusions',
      depthLogic: 'Translucent mineral strata receding inward into crystalline cavity',
      ornamentSystem: 'Concentric mineral bands, micro crystalline druzy fields, strata lines',
      framingLogic: 'Rough volcanic rock crust framing polished interior geode',
      signatureTraits: ['Agate-like concentric mineral bands', 'Subsurface crystal glow', 'Geological strata'],
      shouldFeelLike: 'A polished cross-section slice of a rare natural agate or malachite geode',
      mustNotFeelLike: 'Tie-dye swirl, psychedelic fractal, digital fluid simulation, cheap resin pour',
      crossStyleAvoidances: ['Mineral Bloom must not become psychedelic tie-dye or cheap resin swirl'],
      paletteBehavior: 'Malachite green, deep lapis, warm agate amber, quartz white, dark basalt',
      preferredPaletteLanes: ['malachite green, lapis blue, warm agate amber, quartz white'],
      categoryColorBehavior: 'Dominates the primary crystalline band hue',
      accentBehavior: 'A fine ring of quartz micro-crystals framing the outer field',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OFFSET_FIELD', 'FULL_FIELD'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['concentric mineral bands', 'micro druzy crystal fields', 'geological strata lines'],
      intentionMotifBehavior: 'Alters banding compression and crystalline facet orientation',
      prohibitedMotifs: ['tie-dye', 'psychedelic swirls', 'glitter', 'cheap resin'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Centripetal and orbital growth banding',
      densityBehavior: 'Rich in natural mineral detail, highly ordered',
      focalBehavior: 'Anchor holds the sacred core of the geode',
      atmosphericBehavior: 'Geological, ancient, luminous, grounded',
      negativePromptAdditions: ['tie-dye', 'psychedelic', 'resin pour', 'glitter', 'cheap crystal'],
    },
  },

  dreamscape: {
    id: 'dreamscape',
    displayName: 'Dreamscape',
    styleFamily: 'Atmospheric / Surreal',
    category: 'Mystic',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Atmospheric / Surreal',
    description: 'Surreal architectural abstraction, metaphysical perspective, impossible light, enigmatic hush.',
    paletteLane: 'terracotta, muted ochre, twilight cobalt, shadow olive, warm bone',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'long metaphysical architectural shadows, impossible spatial perspective, egg tempera ground',
    styleNativeMotif: 'metaphysical shadow projection, abstract arcade arches, calm infinite horizon',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Metaphysical surrealism in the tradition of Giorgio de Chirico. The Anchor stands as an impossible architectural monument suspended in a vast, silent square under low late-afternoon sun. Long poetic shadows stretch across warm terracotta ground toward an enigmatic clean horizon. Avoid melting clocks, flying animals, clouds with eyes, fantasy monsters, or cliche surrealism.',
    negativePrompt: getStyleNegativePrompt('dreamscape'),
    accentMotifs: [
      'one long sharp metaphysical shadow projected across open ground',
      'abstract arcade arch silhouette far in the peripheral distance',
      'serene clean twilight gradient line marking the infinite horizon',
    ],
    visualLanguage: {
      coreArtWorld: 'Surreal architectural abstraction, metaphysical space, impossible light, Giorgio de Chirico mood',
      primaryMedium: 'Tempera and oil glaze on smooth archival panel',
      substrate: 'Smooth linen canvas with matte luminous ground',
      edgeBehavior: 'Sharp metaphysical architectural shadows contrasted with soft atmospheric infinity',
      lineBehavior: 'Anchor geometry suspended as an impossible monumental structure in surreal space',
      spatialBehavior: 'Vast, melancholic, infinite perspective plane with solitary shadows',
      lightBehavior: 'Low eternal late-afternoon sun casting long dramatic shadows',
      textureLogic: 'Smooth tempera surface, fine gesso tooth, dry silent atmosphere',
      depthLogic: 'Deep surreal perspective receding to an enigmatic clean horizon',
      ornamentSystem: 'Abstract arches, solitary shadow projections, quiet geometric solids',
      framingLogic: 'Open metaphysical sky with minimal architectural framing',
      signatureTraits: ['Long metaphysical shadows', 'Impossible architectural space', 'Enigmatic atmospheric hush'],
      shouldFeelLike: 'A surrealist metaphysical painting charged with quiet dream logic',
      mustNotFeelLike: 'Literal dream fantasy with flying creatures, clouds with faces, Salvador Dali clocks',
      crossStyleAvoidances: ['Dreamscape must not have literal dream narrative, melting clocks, or fantasy creatures'],
      paletteBehavior: 'Terracotta, muted ochre, twilight cobalt, shadow olive, warm bone',
      preferredPaletteLanes: ['terracotta, muted ochre, twilight cobalt, shadow olive, warm bone'],
      categoryColorBehavior: 'Tints the serene infinite horizon gradient',
      accentBehavior: 'One long sharp metaphysical shadow projected across the ground',
      allowedCompositionFamilies: ['OPEN_VOID', 'LOWER_ANCHORED', 'OFFSET_FIELD'],
      preferredCompositionFamilies: ['OPEN_VOID'],
      motifVocabulary: ['metaphysical shadow projection', 'abstract arcade arches', 'calm infinite horizon'],
      intentionMotifBehavior: 'Shifts horizon elevation and the angle of surreal perspective lines',
      prohibitedMotifs: ['melting clocks', 'flying fish', 'clouds with eyes', 'surrealist clichés'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Deep spatial recession toward an open horizon',
      densityBehavior: 'Spacious, silent, enigmatic',
      focalBehavior: 'Anchor stands sovereign in metaphysical stillness',
      atmosphericBehavior: 'Poetic, surreal, melancholic, timeless',
      negativePromptAdditions: ['melting clocks', 'fantasy animals', 'cliche surrealism', 'face in cloud'],
    },
  },

  soft_monument: {
    id: 'soft_monument',
    displayName: 'Soft Monument',
    styleFamily: 'Sculptural / Monumental',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Sculptural / Monumental',
    description: 'Brutalist architectural massing, smooth cast concrete, morning mist, noble presence.',
    paletteLane: 'warm gray concrete, pale limestone, dawn alabaster, soft charcoal',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'smooth cast architectural concrete, formwork grain, soft ambient occlusion shadows',
    styleNativeMotif: 'architectural chamfers, soft dawn mist fields, monumental shadow reveals',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Monumental architectural pavilion constructed from smooth cast concrete and limestone, softened by tranquil morning mist. The Anchor commands the lower-anchored space as an enduring sculptural monument. Soft, diffused dawn skylight reveals gentle chamfers and subtle formwork textures. Avoid dystopian military bunkers, dark ruins, noisy grunge concrete, or sci-fi textures.',
    negativePrompt: getStyleNegativePrompt('soft_monument'),
    accentMotifs: [
      'soft ambient shadow pooling in architectural recesses',
      'delicate dawn mist drifting behind the monumental mass',
      'clean architectural chamfer line catching soft skylight',
    ],
    visualLanguage: {
      coreArtWorld: 'Brutalist sculptural massing, cast concrete and soft fog, monolithic presence softened by light',
      primaryMedium: 'Smooth cast architectural concrete and diffused daylight',
      substrate: 'Honed architectural stone or matte cast concrete wall',
      edgeBehavior: 'Monumental clean edges softened by morning atmospheric haze',
      lineBehavior: 'Anchor geometry rendered as massive structural architecture',
      spatialBehavior: 'Lower-anchored monumental mass with immense vertical presence',
      lightBehavior: 'Soft diffused skylight with gentle ambient occlusion shadows',
      textureLogic: 'Cast concrete formwork grain, micro air bubbles, smooth matte stone',
      depthLogic: 'Monumental scale contrast between massive solids and open atmospheric sky',
      ornamentSystem: 'Architectural form ties, subtle shadow recesses, clean chamfers',
      framingLogic: 'Spacious architectural crop framing massive structural presence',
      signatureTraits: ['Monumental architectural massing', 'Soft morning light diffusion', 'Cast concrete restraint'],
      shouldFeelLike: 'A peaceful monumental architectural pavilion standing in quiet dawn mist',
      mustNotFeelLike: 'Cold dystopian bunker, sci-fi military fort, dark ruin, noisy concrete',
      crossStyleAvoidances: ['Soft Monument must not be a dark military ruin, prison, or noisy texture'],
      paletteBehavior: 'Warm gray concrete, pale limestone, dawn alabaster, soft charcoal',
      preferredPaletteLanes: ['warm gray concrete, pale limestone, dawn alabaster, soft charcoal'],
      categoryColorBehavior: 'Infuses a delicate dawn color wash into the atmospheric mist',
      accentBehavior: 'Soft ambient shadow pooling in architectural recesses',
      allowedCompositionFamilies: ['LOWER_ANCHORED', 'OBJECT_PRESENTATION'],
      preferredCompositionFamilies: ['LOWER_ANCHORED'],
      motifVocabulary: ['architectural chamfers', 'soft dawn mist fields', 'monumental shadow reveals'],
      intentionMotifBehavior: 'Dictates the scale, massing weight, and mist density',
      prohibitedMotifs: ['barbed wire', 'military symbols', 'graffiti', 'dark dystopia'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Grounded vertical ascent with immense stability',
      densityBehavior: 'Minimalist massive volumes balanced by open sky',
      focalBehavior: 'Anchor is the supreme architectural monument',
      atmosphericBehavior: 'Serene, monumental, grounded, noble',
      negativePromptAdditions: ['dystopian', 'military', 'dark ruin', 'noisy textures', 'bunker'],
    },
  },

  street_mark: {
    id: 'street_mark',
    displayName: 'Street Mark',
    styleFamily: 'Tactile / Urban',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Tactile / Urban',
    description: 'Solid paint stick, dry aerosol texture, raw plaster scrape, visceral urban gesture.',
    paletteLane: 'raw chalk white, asphalt black, primer gray, oxidized red',
    compositionFamily: 'FULL_FIELD',
    materialBehavior: 'dry oil-paint stick drag, scraped weathered wall ground, buffed surface history',
    styleNativeMotif: 'scraped paint trails, dry chalk dust fields, buffed wall tone layers',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Expressive urban mark-making on a weathered, plaster-buffed architectural wall. The Anchor is rendered with intense conviction using solid white paint-stick and dry pigment drag. Layered wall textures, chalk dust, and scraped plaster create raw urban materiality without compromising the Anchor’s exact geometry. Avoid messy graffiti tags, bubble lettering, stickers, or sloppy spray splatters.',
    negativePrompt: getStyleNegativePrompt('street_mark'),
    accentMotifs: [
      'one bold industrial primer red mark in the peripheral field',
      'dry chalk dust haze settling along the lower margin',
      'scraped wall texture revealing faint older plaster layers',
    ],
    visualLanguage: {
      coreArtWorld: 'Chalkboard and asphalt mark-making, oil stick gesture, raw urban materiality, Cy Twombly energy',
      primaryMedium: 'Solid paint stick, dry aerosol mark, scraped plaster',
      substrate: 'Matte weathered urban wall or raw plywood hoarding',
      edgeBehavior: 'Scraped edges, dry paint drag, raw gestural bite',
      lineBehavior: 'Anchor geometry rendered with authoritative paint-stick conviction, completely intact',
      spatialBehavior: 'Raw urban wall composition with energetic mark distribution',
      lightBehavior: 'Flat daylight on matte distressed urban surfaces',
      textureLogic: 'Dry pigment drag, scraped plaster layers, chalk dust, matte paint residue',
      depthLogic: 'Layered urban mark history with past marks buffed into wall tone',
      ornamentSystem: 'Non-readable paint scrapes, chalk tally traces, textured scuffs',
      framingLogic: 'Raw wall boundary with spontaneous edge abrasions',
      signatureTraits: ['Solid paint stick texture', 'Raw urban wall ground', 'Scraped gestural energy'],
      shouldFeelLike: 'An intentional, sacred mark discovered on an ancient urban wall',
      mustNotFeelLike: 'Messy spray can vandalism, hip hop graffiti, sticker slap, neon paint splatter',
      crossStyleAvoidances: ['Street Mark must not look like sloppy graffiti tags or sticker bombs'],
      paletteBehavior: 'Raw chalk white, asphalt black, industrial primer gray, oxidized red',
      preferredPaletteLanes: ['raw chalk white, asphalt black, primer gray, oxidized red'],
      categoryColorBehavior: 'Supplies one single industrial primer pigment mark in the field',
      accentBehavior: 'Dry chalk dust haze settling along the lower margin',
      allowedCompositionFamilies: ['FULL_FIELD', 'OFFSET_FIELD'],
      preferredCompositionFamilies: ['FULL_FIELD'],
      motifVocabulary: ['scraped paint trails', 'dry chalk dust fields', 'buffed wall tone layers'],
      intentionMotifBehavior: 'Controls the velocity and friction of surrounding mark traces',
      prohibitedMotifs: ['graffiti tags', 'spray splatters', 'bubble letters', 'stickers'],
      maxSupportingMotifs: 2,
      directionalBehavior: 'Raw horizontal and vertical gestural rhythm',
      densityBehavior: 'Moderate, raw, authentic',
      focalBehavior: 'Anchor stands authoritative and immutable as the primary mark',
      atmosphericBehavior: 'Raw, honest, visceral, direct',
      negativePromptAdditions: ['graffiti tags', 'bubble letters', 'sticker bomb', 'messy spray splatter'],
    },
  },

  collage_archive: {
    id: 'collage_archive',
    displayName: 'Collage Archive',
    styleFamily: 'Archival / Tactile',
    category: 'Material',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Archival / Tactile',
    description: 'Torn archival paper, tactile paper montage, photogravure fragments, catalog boards.',
    paletteLane: 'manila paper, aged sepia, slate black, bleached linen, faint ochre',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'hand-torn paper deckles, archival photo fragments, paper tape strips, specimen mounts',
    styleNativeMotif: 'hand-torn paper deckles, archival mounting corners, subtle paper tape strips',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Curated museum archival montage. Layers of hand-torn fibrous papers, aged catalog board, and subtle photogravure texture fragments are thoughtfully assembled in tactile geometric balance. The Anchor geometry is cleanly printed across the layered surfaces, unifying the montage. Avoid readable text, letters, magazine faces, chaotic scrapbooking, or pop art clipart.',
    negativePrompt: getStyleNegativePrompt('collage_archive'),
    accentMotifs: [
      'a single Japanese paper tape strip holding one paper boundary',
      'subtle photo corner mount at one peripheral corner',
      'aged manila cardstock fragment with raw fibrous deckle',
    ],
    visualLanguage: {
      coreArtWorld: 'Constructivist and Dada collage, torn archival paper, photogravure texture fragments, catalog boards',
      primaryMedium: 'Layered torn archival papers, matte gelatin prints, catalog board',
      substrate: 'Smoked manila catalog folder board with age toning',
      edgeBehavior: 'Hand-torn paper fibers, overlapping deckles, glued paper edges',
      lineBehavior: 'Anchor geometry printed or adhered crisply across the assembled paper planes',
      spatialBehavior: 'Carefully balanced asymmetrical montage of tactile geometric paper fields',
      lightBehavior: 'Soft flat museum inspection lighting',
      textureLogic: 'Torn fibrous paper edges, aged book cloth, halftone photo texture fragments',
      depthLogic: 'Physical paper overlap steps creating 1-2mm archival collage depth',
      ornamentSystem: 'Non-readable catalog grid fragments, paper tape strips, specimen mounts',
      framingLogic: 'Archival mounting board border with mounting corners',
      signatureTraits: ['Hand-torn paper edges', 'Tactile paper montage', 'Archival catalog materiality'],
      shouldFeelLike: 'An archival museum collage board assembled from rare historical ephemera',
      mustNotFeelLike: 'Digital Photoshop collage, chaotic scrapbooking, pop art cutout, magazine faces',
      crossStyleAvoidances: ['Collage Archive must not contain readable text, magazine faces, or messy scrapbooking'],
      paletteBehavior: 'Manila paper, aged sepia, slate black, bleached linen, faint ochre',
      preferredPaletteLanes: ['manila paper, aged sepia, slate black, bleached linen, faint ochre'],
      categoryColorBehavior: 'Supplies the color of one aged paper fragment in the montage',
      accentBehavior: 'A single Japanese paper tape strip holding one paper boundary',
      allowedCompositionFamilies: ['OFFSET_FIELD', 'OBJECT_PRESENTATION'],
      preferredCompositionFamilies: ['OFFSET_FIELD'],
      motifVocabulary: ['hand-torn paper deckles', 'archival mounting corners', 'subtle paper tape strips'],
      intentionMotifBehavior: 'Determines the geometric arrangement and overlap of paper planes',
      prohibitedMotifs: ['readable words', 'human faces', 'magazine photos', 'pop art icons'],
      maxSupportingMotifs: 3,
      directionalBehavior: 'Carefully authored geometric collage balance',
      densityBehavior: 'Moderate, tactile, layered yet disciplined',
      focalBehavior: 'Anchor geometry integrates and unifies the entire assemblage',
      atmosphericBehavior: 'Archival, tactile, historical, thoughtful',
      negativePromptAdditions: ['readable text', 'letters', 'magazine faces', 'chaotic scrapbooking', 'pop art'],
    },
  },

  lightfield: {
    id: 'lightfield',
    displayName: 'Lightfield',
    styleFamily: 'Optical / Luminous',
    category: 'Luminous',
    collection: 'featured',
    lifecycleStatus: 'ROTATION',
    visualFamily: 'Optical / Luminous',
    description: 'Pure optical light, Turrell-like luminous installations, controlled gradient fields.',
    paletteLane: 'deep twilight indigo, luminous amber-white, soft cobalt gradient',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'pure coherent light emission, zero grain smoothness, Ganzfeld perceptual depth',
    styleNativeMotif: 'seamless light gradient, subtle optical radiance, pure luminous void',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Perceptual light installation in the spirit of James Turrell. Pure, seamless optical gradients of twilight indigo, luminous amber, and soft cobalt create deep physical light presence without texture or grain. The Anchor geometry manifests as pure coherent light lineation holding absolute clarity. Avoid planets, stars, mandalas, sci-fi lasers, or neon bar signs.',
    negativePrompt: getStyleNegativePrompt('lightfield'),
    accentMotifs: [
      'subtle warm-to-cool optical gradient radiating behind the Anchor',
      'clean perceptual Ganzfeld horizon fading into infinity',
      'faint luminous edge contrast without particle flare',
    ],
    visualLanguage: {
      coreArtWorld: 'Pure optical light, Turrell-like luminous spatial installations, controlled gradient fields',
      primaryMedium: 'Coherent monochromatic light and ambient illumination',
      substrate: 'Seamless spatial aperture void (Ganzfeld space)',
      edgeBehavior: 'Soft imperceptible luminous gradients, razor-crisp geometric boundary',
      lineBehavior: 'Anchor geometry glowing with pure light emission without particle artifacts',
      spatialBehavior: 'Infinite optical depth through subtle luminous shifts',
      lightBehavior: 'Pure emitted and ambient light, seamless radiosity',
      textureLogic: 'Zero grain, pure photon gradient smoothness, velvety optical depth',
      depthLogic: 'Perceptual depth created purely through light temperature and falloff',
      ornamentSystem: 'Zero ornamental clutter; pure light gradients and subtle chromatic shifts',
      framingLogic: 'Seamless infinite perceptual field without hard borders',
      signatureTraits: ['Pure light gradients', 'Seamless Ganzfeld depth', 'Zero ornamental noise'],
      shouldFeelLike: 'A James Turrell light installation where light itself becomes physical',
      mustNotFeelLike: 'Sci-fi laser glow, neon bar sign, fantasy magic sparkles, rainbow light',
      crossStyleAvoidances: ['Lightfield must not have planets, mandalas, or fantasy magic sparkles'],
      paletteBehavior: 'Deep twilight indigo, luminous amber-white, soft cobalt gradient',
      preferredPaletteLanes: ['deep twilight indigo, luminous amber-white, soft cobalt gradient'],
      categoryColorBehavior: 'Sets the chromatic temperature shift of the ambient light field',
      accentBehavior: 'A subtle warm-to-cool optical gradient radiating behind the Anchor',
      allowedCompositionFamilies: ['CENTRED_STILLPOINT', 'OPEN_VOID'],
      preferredCompositionFamilies: ['CENTRED_STILLPOINT'],
      motifVocabulary: ['seamless light gradient', 'subtle optical radiance', 'pure luminous void'],
      intentionMotifBehavior: 'Adjusts the gradient warmth, luminous flux, and perceptual depth',
      prohibitedMotifs: ['planets', 'mandalas', 'sparkles', 'particles', 'stars', 'ornaments'],
      maxSupportingMotifs: 1,
      directionalBehavior: 'Radiant optical expansion from the core',
      densityBehavior: 'Ultra-minimal, pure light and void',
      focalBehavior: 'Anchor geometry manifests as pure coherent light',
      atmosphericBehavior: 'Luminous, transcendent, pure, silent',
      negativePromptAdditions: ['planets', 'mandalas', 'sparkles', 'glitter', 'particles', 'stars', 'neon sign'],
    },
  },
};

// ============================================================================
// Accessors and Style Library Exports
// ============================================================================

export const LAUNCH_STYLE_LIBRARY = VALID_AI_STYLES.map(id => STYLE_PROMPT_LIBRARY[id]);

export const CORE_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'core'
) as AIStyle[];

export const FEATURED_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'featured'
) as AIStyle[];

export const SEASONAL_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'seasonal'
) as AIStyle[];

function normalizeStyleId(style: string): string {
  if (!style || typeof style !== 'string') return 'watercolor';
  const clean = style.trim().toLowerCase().replace(/-/g, '_');
  if (clean === '__proto__' || clean === 'tostring' || clean === 'constructor' || clean === 'valueof') {
    return 'watercolor';
  }
  if (clean === 'aurora_flow') return 'aurora_glow';
  if (clean === 'resonant_rings') return 'resonance_rings';
  return clean;
}

export function getStylePromptDefinition(style: string): StylePromptDefinition {
  const normalizedId = normalizeStyleId(style);
  if (Object.prototype.hasOwnProperty.call(STYLE_PROMPT_LIBRARY, normalizedId)) {
    return STYLE_PROMPT_LIBRARY[normalizedId as AIStyle];
  }
  return STYLE_PROMPT_LIBRARY['watercolor'];
}

function normalizeIntention(intention: string): string {
  return intention
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(value);
}

function pickStable<T>(options: T[], seed: string): T {
  return options[hashString(seed) % options.length];
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
