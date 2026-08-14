import type { AIStyle, AnchorCategory } from '@/types';

export type RefineStyleSectionType = 'featured' | 'core' | 'seasonal';

export type RefineStyleFamily =
  | 'LUMINOUS'
  | 'MYSTIC'
  | 'ORGANIC'
  | 'GEOMETRIC'
  | 'MODERN'
  | 'ORIGINAL';

export type RefineBadgeType = 'limited' | 'new' | 'seasonal' | 'gold' | 'core';

export interface RefineBadge {
  type: RefineBadgeType;
  label: string;
}

export type RefineGlyphKey =
  | 'architectural'
  | 'ink'
  | 'sacred'
  | 'watercolor'
  | 'goldleaf'
  | 'cosmic'
  | 'lunar'
  | 'aurora'
  | 'ember'
  | 'resonance'
  | 'monolith'
  | 'celestial'
  | 'solar'
  | 'ocean'
  | 'harvest'
  | 'bloom'
  | 'halo'
  | 'prism'
  | 'original';

export type RefineStyleFilter =
  | 'all'
  | 'featured'
  | 'core'
  | 'seasonal'
  | 'luminous'
  | 'mystic'
  | 'organic'
  | 'geometric'
  | 'modern';

export interface RefineStyleOption {
  id: string;
  name: string;
  displayName: string;
  generationStyle: AIStyle;
  family: RefineStyleFamily;
  category: RefineStyleSectionType;
  description: string;
  shortDescription: string;
  glyph: RefineGlyphKey;
  tags?: string[];
  complement?: string | ((structureLabel: string) => string);
  isCore: boolean;
  isFeatured: boolean;
  isSeasonal: boolean;
  isLimited: boolean;
  isHero?: boolean;
  isRecommended: boolean;
  badge?: RefineBadge;
  badgeLabel?: string;
  availableUntil?: string;
  sortOrder: number;
  paletteLane: string;
  compositionFamily: string;
  materialBehavior: string;
  recommendationCategories: AnchorCategory[];
  recommendationKeywords: string[];
}

export const COLLECTION_FILTERS = ['All', 'Featured', 'Core', 'Seasonal'] as const;
export const FAMILY_FILTERS: RefineStyleFamily[] = ['LUMINOUS', 'MYSTIC', 'ORGANIC', 'GEOMETRIC', 'MODERN'];

// ── Single Source of Truth Style Catalog ──────────────────────────────────────
export const REFINE_STYLES: RefineStyleOption[] = [
  // ── Core permanent library ──────────────────────────────────────────────────
  {
    id: 'original',
    name: 'Original',
    displayName: 'Original',
    generationStyle: 'minimal_line',
    family: 'ORIGINAL',
    category: 'core',
    glyph: 'original',
    description: 'Keep the structure close to its original form.',
    shortDescription: 'Clean, untreated original form.',
    tags: ['Clean', 'Minimal', 'Untreated'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    sortOrder: 1,
    paletteLane: 'smoked parchment, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector linework, untouched geometry',
    recommendationCategories: ['career', 'health', 'learning', 'custom'],
    recommendationKeywords: ['clean', 'pure', 'original', 'simple', 'direct'],
  },
  {
    id: 'architectural-trace',
    name: 'Architectural Trace',
    displayName: 'Architectural Trace',
    generationStyle: 'architectural_trace',
    family: 'GEOMETRIC',
    category: 'core',
    glyph: 'architectural',
    description: 'Drafted precision and measured balance.',
    shortDescription: 'Precision drafting and measured geometry.',
    tags: ['Precise', 'Structured', 'Geometric'],
    complement: (structureLabel: string) => `Complements your ${structureLabel} structure.`,
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    sortOrder: 5,
    paletteLane: 'smoked parchment, silver-white, faint cyan, graphite',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'etched drafting ink, blueprint grid logic, silver calibration marks',
    recommendationCategories: ['career', 'learning', 'custom'],
    recommendationKeywords: ['focus', 'clarity', 'discipline', 'build', 'plan', 'study'],
  },
  {
    id: 'gold-leaf',
    name: 'Gold Leaf',
    displayName: 'Gold Leaf',
    generationStyle: 'gold_leaf',
    family: 'LUMINOUS',
    category: 'core',
    glyph: 'goldleaf',
    description: 'Luxurious luminous finish.',
    shortDescription: 'Gilded finish and luminous antique glow.',
    tags: ['Warm', 'Luminous', 'Refined'],
    complement: 'Adds visual richness while preserving clarity.',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 10,
    paletteLane: 'antique gold, umber, soot-black, soft bronze',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'torn gold leaf, gilded cracks, subtle metallic dust',
    recommendationCategories: ['abundance', 'desire', 'career'],
    recommendationKeywords: ['wealth', 'worth', 'shine', 'receive', 'success', 'confidence'],
  },
  {
    id: 'sacred-geometry',
    name: 'Sacred Geometry',
    displayName: 'Sacred Geometry',
    generationStyle: 'sacred_geometry',
    family: 'MYSTIC',
    category: 'core',
    glyph: 'sacred',
    description: 'Structured symbolic precision.',
    shortDescription: 'Layered mathematical and symbolic depth.',
    tags: ['Balanced', 'Symbolic', 'Layered'],
    complement: 'Pairs naturally with centered forms.',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    sortOrder: 15,
    paletteLane: 'indigo, teal, dusty rose, muted brass, celestial blue',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'layered geometric systems, transparent overlaps, precise geometry',
    recommendationCategories: ['spirituality', 'learning', 'custom'],
    recommendationKeywords: ['meaning', 'purpose', 'order', 'trust', 'center', 'align'],
  },
  {
    id: 'ink-brush',
    name: 'Ink Brush',
    displayName: 'Ink Brush',
    generationStyle: 'ink_brush',
    family: 'ORGANIC',
    category: 'core',
    glyph: 'ink',
    description: 'Fluid, expressive movement.',
    shortDescription: 'Sumi-e restraint and open gesture.',
    tags: ['Expressive', 'Gestural', 'Fluid'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 20,
    paletteLane: 'black ink, bone paper, faint iron-red seal haze',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'dry brush pressure, diluted ink mist, paper grain',
    recommendationCategories: ['creativity', 'relationships'],
    recommendationKeywords: ['create', 'flow', 'voice', 'move', 'express', 'art'],
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    displayName: 'Watercolor',
    generationStyle: 'watercolor',
    family: 'ORGANIC',
    category: 'core',
    glyph: 'watercolor',
    description: 'Soft tonal atmosphere.',
    shortDescription: 'Pigment washes and soft tonal bloom.',
    tags: ['Painterly', 'Soft', 'Atmospheric'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 25,
    paletteLane: 'mineral blue, oxblood, moss, plum, muted saffron',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment bleed, deckled paper, wet edge blooms',
    recommendationCategories: ['health', 'relationships', 'family'],
    recommendationKeywords: ['heal', 'calm', 'soften', 'peace', 'gentle', 'rest'],
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    displayName: 'Cosmic',
    generationStyle: 'cosmic',
    family: 'MYSTIC',
    category: 'core',
    glyph: 'cosmic',
    description: 'Orbital celestial energy.',
    shortDescription: 'Deep-space atmosphere and orbital energy.',
    tags: ['Celestial', 'Expansive', 'Orbital'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 30,
    paletteLane: 'midnight teal, violet gas, pale gold flare, star-white',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'nebular haze, star dust, layered dark gradients',
    recommendationCategories: ['spirituality', 'adventure', 'desire'],
    recommendationKeywords: ['expand', 'dream', 'vision', 'future', 'wonder', 'open'],
  },
  {
    id: 'lunar-etch',
    name: 'Lunar Etch',
    displayName: 'Lunar Etch',
    generationStyle: 'lunar_etch',
    family: 'LUMINOUS',
    category: 'core',
    glyph: 'lunar',
    description: 'Silver etching under moonlit contrast.',
    shortDescription: 'Moonlit silver engraving and quiet radiance.',
    tags: ['Silver', 'Reflective', 'Nocturnal'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 35,
    paletteLane: 'moon-silver, indigo-black, cold pearl, soft blue-white',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'silver etching, lunar dust, restrained metallic bloom',
    recommendationCategories: ['spirituality', 'relationships', 'family'],
    recommendationKeywords: ['moon', 'reflect', 'calm', 'night', 'intuition', 'trust'],
  },
  {
    id: 'aurora-glow',
    name: 'Aurora Glow',
    displayName: 'Aurora Glow',
    generationStyle: 'aurora_glow',
    family: 'LUMINOUS',
    category: 'core',
    glyph: 'aurora',
    description: 'Atmospheric color bloom.',
    shortDescription: 'Blue-green spectral bloom and moving light.',
    tags: ['Spectral', 'Luminous', 'Ribbons'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 40,
    paletteLane: 'blue-green, cobalt, violet, rare gold accents',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'light ribbons, soft atmospheric bloom, spectral haze',
    recommendationCategories: ['health', 'creativity', 'spirituality'],
    recommendationKeywords: ['glow', 'soften', 'heal', 'light', 'open', 'breathe'],
  },
  {
    id: 'ember-trace',
    name: 'Ember Trace',
    displayName: 'Ember Trace',
    generationStyle: 'ember_trace',
    family: 'LUMINOUS',
    category: 'core',
    glyph: 'ember',
    description: 'Warm ember edge lighting.',
    shortDescription: 'Copper heat and controlled ember glow.',
    tags: ['Heated', 'Radiant', 'Ember'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 45,
    paletteLane: 'coal black, ember orange, copper red, ash gray',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'scorched linework, heated edges, ember dust',
    recommendationCategories: ['desire', 'career', 'adventure'],
    recommendationKeywords: ['energy', 'start', 'drive', 'ignite', 'courage', 'move'],
  },
  {
    id: 'resonance-rings',
    name: 'Resonance Rings',
    displayName: 'Resonance Rings',
    generationStyle: 'resonance_rings',
    family: 'MYSTIC',
    category: 'core',
    glyph: 'resonance',
    description: 'Pulses radiating through layered rings.',
    shortDescription: 'Pulse circles and waveform halos.',
    tags: ['Concentric', 'Acoustic', 'Waves'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 50,
    paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'echo rings, pulse halos, acoustic field lines',
    recommendationCategories: ['relationships', 'family', 'spirituality'],
    recommendationKeywords: ['connect', 'listen', 'return', 'repeat', 'pattern', 'practice'],
  },
  {
    id: 'monolith-ink',
    name: 'Monolith Ink',
    displayName: 'Monolith Ink',
    generationStyle: 'monolith_ink',
    family: 'MODERN',
    category: 'core',
    glyph: 'monolith',
    description: 'Grounded heavy-line authority.',
    shortDescription: 'Heavy stone ink and grounded presence.',
    tags: ['Grounded', 'Heavy', 'Carved'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 55,
    paletteLane: 'ash black, stone gray, dusted bronze, muted bone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'stone grain, heavy ink, carved shadow',
    recommendationCategories: ['career', 'health', 'desire'],
    recommendationKeywords: ['strong', 'stable', 'ground', 'commit', 'endure', 'stand'],
  },
  {
    id: 'celestial-grid',
    name: 'Celestial Grid',
    displayName: 'Celestial Grid',
    generationStyle: 'celestial_grid',
    family: 'GEOMETRIC',
    category: 'core',
    glyph: 'celestial',
    description: 'Constellation-inspired symmetry.',
    shortDescription: 'Observatory geometry and star-map symmetry.',
    tags: ['Symmetrical', 'Observatory', 'Constellation'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 60,
    paletteLane: 'midnight navy, pale cyan, soft violet, pinprick gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'star-map plotting, observatory marks, delicate grid constellations',
    recommendationCategories: ['adventure', 'learning', 'spirituality'],
    recommendationKeywords: ['navigate', 'map', 'learn', 'explore', 'direction', 'stars'],
  },
  {
    id: 'minimal-line',
    name: 'Minimal Line',
    displayName: 'Minimal Line',
    generationStyle: 'minimal_line',
    family: 'GEOMETRIC',
    category: 'core',
    glyph: 'original',
    description: 'Ultra-clean linework and quiet precision.',
    shortDescription: 'Ultra-clean linework and quiet precision.',
    tags: ['Minimal', 'Linear', 'Clean'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 65,
    paletteLane: 'platinum on black navy, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector-like line clarity, almost no ornament',
    recommendationCategories: ['health', 'career', 'learning'],
    recommendationKeywords: ['simplify', 'focus', 'clear', 'steady', 'quiet', 'less'],
  },
  {
    id: 'obsidian-mono',
    name: 'Obsidian Mono',
    displayName: 'Obsidian Mono',
    generationStyle: 'obsidian_mono',
    family: 'MODERN',
    category: 'core',
    glyph: 'monolith',
    description: 'Black glass, graphite polish, and reflective shadow.',
    shortDescription: 'Black glass and graphite polish.',
    tags: ['Glossy', 'Monochrome', 'Reflective'],
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 70,
    paletteLane: 'black glass, graphite, silver edge, smoke gray',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'polished obsidian, glossy edge highlights, dark reflection',
    recommendationCategories: ['career', 'desire', 'custom'],
    recommendationKeywords: ['strength', 'boundary', 'power', 'protect', 'resolve', 'decide'],
  },

  // ── This week's featured / rotating styles ─────────────────────────────────
  {
    id: 'solar-veil',
    name: 'Solar Veil',
    displayName: 'Solar Veil',
    generationStyle: 'solar_halo',
    family: 'LUMINOUS',
    category: 'featured',
    glyph: 'solar',
    description: 'A warm gilded haze that settles over the anchor like late light.',
    shortDescription: 'Warm gilded haze and radiant halo.',
    isCore: false,
    isFeatured: true,
    isSeasonal: true,
    isLimited: true,
    isHero: true,
    isRecommended: false,
    badge: { type: 'limited', label: 'Ends 4d' },
    badgeLabel: 'Ends 4d',
    availableUntil: 'Ends in 4 days',
    sortOrder: 1,
    paletteLane: 'ivory, saffron, brass, pale amber, smoke',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'soft solar rings, warm haze, brass light',
    recommendationCategories: ['desire', 'career', 'abundance'],
    recommendationKeywords: ['sun', 'radiant', 'confidence', 'purpose', 'clear', 'bright'],
  },
  {
    id: 'ink-bloom',
    name: 'Ink Bloom',
    displayName: 'Ink Bloom',
    generationStyle: 'ink_brush',
    family: 'ORGANIC',
    category: 'featured',
    glyph: 'bloom',
    description: 'Pigment blooming outward into soft, living edges.',
    shortDescription: 'Pigment blooming into living edges.',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    badge: { type: 'new', label: 'New' },
    badgeLabel: 'New',
    sortOrder: 5,
    paletteLane: 'carbon black, deep sepia, bone wash',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment dispersal, wet edge blossoming',
    recommendationCategories: ['creativity', 'spirituality'],
    recommendationKeywords: ['bloom', 'living', 'soft', 'open', 'grow'],
  },
  {
    id: 'prism-fold',
    name: 'Prism Fold',
    displayName: 'Prism Fold',
    generationStyle: 'prism_veil',
    family: 'GEOMETRIC',
    category: 'featured',
    glyph: 'prism',
    description: 'Light folded through a single faceted plane.',
    shortDescription: 'Faceted plane and refracted light.',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: true,
    isRecommended: false,
    badge: { type: 'limited', label: 'Ends 4d' },
    badgeLabel: 'Ends 4d',
    availableUntil: 'Ends in 4 days',
    sortOrder: 10,
    paletteLane: 'pearl, opal, pale cyan, lavender, faint gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'translucent veils, refracted edges, prism bloom',
    recommendationCategories: ['creativity', 'learning', 'relationships'],
    recommendationKeywords: ['clarity', 'perceive', 'shift', 'layer', 'refine', 'see'],
  },
  {
    id: 'ocean-current',
    name: 'Ocean Current',
    displayName: 'Ocean Current',
    generationStyle: 'tideglass',
    family: 'ORGANIC',
    category: 'featured',
    glyph: 'ocean',
    description: 'Layered tidal motion carried in cool tones.',
    shortDescription: 'Layered tidal motion in cool tones.',
    isCore: false,
    isFeatured: true,
    isSeasonal: true,
    isLimited: false,
    isRecommended: false,
    badge: { type: 'seasonal', label: 'Seasonal' },
    badgeLabel: 'Seasonal',
    sortOrder: 15,
    paletteLane: 'seafoam, slate blue, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'translucent washed glass, salt haze, tide-soft edges',
    recommendationCategories: ['health', 'family', 'relationships'],
    recommendationKeywords: ['flow', 'adapt', 'calm', 'heal', 'soft', 'clarity'],
  },
  {
    id: 'halo-drift',
    name: 'Halo Drift',
    displayName: 'Halo Drift',
    generationStyle: 'solar_halo',
    family: 'MYSTIC',
    category: 'featured',
    glyph: 'halo',
    description: 'A slow ring of light orbiting the form.',
    shortDescription: 'Slow orbiting ring of ambient light.',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    badge: { type: 'gold', label: 'Featured' },
    badgeLabel: 'Featured',
    sortOrder: 20,
    paletteLane: 'soft amber, pearl halo, twilight graphite',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'orbiting light ring, diffuse halo atmosphere',
    recommendationCategories: ['spirituality', 'relationships'],
    recommendationKeywords: ['halo', 'drift', 'orbit', 'calm', 'peace'],
  },

  // ── Seasonal collection ("Lunar Collection") ───────────────────────────────
  {
    id: 'harvest-gild',
    name: 'Harvest Gild',
    displayName: 'Harvest Gild',
    generationStyle: 'verdigris_relic',
    family: 'LUMINOUS',
    category: 'seasonal',
    glyph: 'harvest',
    description: 'Amber gilding drawn from the turning season.',
    shortDescription: 'Amber gilding and seasonal warmth.',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: false,
    isRecommended: false,
    badge: { type: 'new', label: 'New' },
    badgeLabel: 'New',
    sortOrder: 20,
    paletteLane: 'oxidized teal, amber bronze, dark stone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'aged copper, patina blooms, worn engraved surface',
    recommendationCategories: ['learning', 'career', 'spirituality'],
    recommendationKeywords: ['harvest', 'earned', 'season', 'patience', 'time'],
  },
  {
    id: 'midnight-bloom',
    name: 'Midnight Bloom',
    displayName: 'Midnight Bloom',
    generationStyle: 'velvet_ember',
    family: 'MYSTIC',
    category: 'seasonal',
    glyph: 'bloom',
    description: 'Petals opening in deep, quiet dark.',
    shortDescription: 'Petals opening in quiet dark.',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: false,
    isRecommended: false,
    badge: { type: 'seasonal', label: 'Seasonal' },
    badgeLabel: 'Seasonal',
    sortOrder: 25,
    paletteLane: 'burgundy-black, copper, warm amber, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'velvet texture, ember glints, soft smoky depth',
    recommendationCategories: ['desire', 'relationships', 'creativity'],
    recommendationKeywords: ['midnight', 'bloom', 'dark', 'quiet', 'open'],
  },
  {
    id: 'winter-halo',
    name: 'Winter Halo',
    displayName: 'Winter Halo',
    generationStyle: 'lunar_etch',
    family: 'LUMINOUS',
    category: 'seasonal',
    glyph: 'halo',
    description: 'A pale ring of frost-light around the anchor.',
    shortDescription: 'Pale ring of frost-light.',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: true,
    isRecommended: false,
    badge: { type: 'limited', label: 'Ends 12d' },
    badgeLabel: 'Ends 12d',
    availableUntil: 'Ends in 12 days',
    sortOrder: 30,
    paletteLane: 'frost silver, ice blue, deep night navy',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'frost ring, ice crystal reflections, cold halo',
    recommendationCategories: ['health', 'spirituality'],
    recommendationKeywords: ['winter', 'halo', 'frost', 'pure', 'still'],
  },
];

// ── Helpers & Derivations ─────────────────────────────────────────────────────
const bySortOrder = (a: RefineStyleOption, b: RefineStyleOption) => a.sortOrder - b.sortOrder;

export const featuredStyles = REFINE_STYLES.filter((style) => style.isFeatured).sort(bySortOrder);
export const heroStyle = featuredStyles.find((style) => style.isHero) || featuredStyles[0];
export const railStyles = featuredStyles.filter((style) => style.id !== heroStyle?.id);
export const coreStyles = REFINE_STYLES.filter((style) => style.isCore).sort(bySortOrder);
export const seasonalStyles = REFINE_STYLES.filter((style) => style.isSeasonal).sort(bySortOrder);
export const allStyles = [...REFINE_STYLES].sort(bySortOrder);

export const familyStyles = (family: RefineStyleFamily) =>
  REFINE_STYLES.filter((style) => style.family === family).sort(bySortOrder);

export function getFilteredStyles(filter: RefineStyleFilter): RefineStyleOption[] {
  if (filter === 'all') return allStyles;
  if (filter === 'featured') return featuredStyles;
  if (filter === 'core') return coreStyles;
  if (filter === 'seasonal') return seasonalStyles;

  const upperFamily = filter.toUpperCase() as RefineStyleFamily;
  return REFINE_STYLES.filter((style) => style.family === upperFamily).sort(bySortOrder);
}

export function getRecommendedStyles(
  category: AnchorCategory | undefined,
  intention: string,
  limit = 3
): RefineStyleOption[] {
  const normalizedIntention = intention.toLowerCase();

  const scored = REFINE_STYLES.map((style) => {
    const categoryScore = category && style.recommendationCategories.includes(category) ? 4 : 0;
    const keywordScore = style.recommendationKeywords.reduce(
      (score, keyword) => score + (containsKeyword(normalizedIntention, keyword) ? 2 : 0),
      0
    );
    const defaultScore = style.isRecommended ? 1 : 0;

    return {
      style,
      score: categoryScore + keywordScore + defaultScore,
    };
  });

  const recommendations = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.style.sortOrder - b.style.sortOrder)
    .map((item) => item.style);

  const fallback = [
    REFINE_STYLES.find((s) => s.id === 'original') ?? REFINE_STYLES[0],
    REFINE_STYLES.find((s) => s.id === 'architectural-trace') ?? REFINE_STYLES[1],
    REFINE_STYLES.find((s) => s.id === 'sacred-geometry') ?? REFINE_STYLES[2],
  ];

  return [...recommendations, ...fallback]
    .filter((style, index, all) => all.findIndex((candidate) => candidate.id === style.id) === index)
    .slice(0, limit);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(value);
}
