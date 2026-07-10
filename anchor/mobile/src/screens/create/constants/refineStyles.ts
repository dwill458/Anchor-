import type { AIStyle, AnchorCategory } from '@/types';

export type RefineStyleSectionType = 'featured' | 'core' | 'seasonal';

export type RefineStyleCategory =
  | 'Luminous'
  | 'Mystic'
  | 'Organic'
  | 'Geometric'
  | 'Minimal'
  | 'Material';

export type RefineStyleIconName =
  | 'Target'
  | 'Zap'
  | 'Compass'
  | 'Waves'
  | 'Crown'
  | 'Sparkles'
  | 'Sliders'
  | 'Cloud'
  | 'Flame'
  | 'Repeat'
  | 'ShieldCheck'
  | 'Palette';

export type RefineStyleFilter =
  | 'all'
  | 'featured'
  | 'core'
  | 'seasonal'
  | 'luminous'
  | 'mystic'
  | 'organic'
  | 'geometric'
  | 'minimal'
  | 'material';

export interface RefineStyleOption {
  id: string;
  name: string;
  displayName: string;
  generationStyle: AIStyle;
  sectionType: RefineStyleSectionType;
  category: RefineStyleCategory;
  family: string;
  description: string;
  shortDescription: string;
  paletteLane: string;
  compositionFamily: string;
  materialBehavior: string;
  isCore: boolean;
  isFeatured: boolean;
  isSeasonal: boolean;
  isLimited: boolean;
  isRecommended: boolean;
  badgeLabel?: 'New' | 'Featured' | 'Limited' | 'Seasonal' | 'Recommended';
  collectionName?: string;
  availableUntil?: string;
  sortOrder: number;
  iconName: RefineStyleIconName;
  recommendationCategories: AnchorCategory[];
  recommendationKeywords: string[];
}

export const REFINE_STYLE_FILTERS: Array<{ label: string; value: RefineStyleFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Featured', value: 'featured' },
  { label: 'Core', value: 'core' },
  { label: 'Seasonal', value: 'seasonal' },
  { label: 'Luminous', value: 'luminous' },
  { label: 'Mystic', value: 'mystic' },
  { label: 'Organic', value: 'organic' },
  { label: 'Geometric', value: 'geometric' },
  { label: 'Minimal', value: 'minimal' },
  { label: 'Material', value: 'material' },
];

export const REFINE_STYLES: RefineStyleOption[] = [
  {
    id: 'architectural-trace',
    name: 'architectural_trace',
    displayName: 'Architectural Trace',
    generationStyle: 'architectural_trace',
    sectionType: 'core',
    category: 'Geometric',
    family: 'Precision / Structural',
    description: 'Precision drafting, measured geometry, and blueprint discipline.',
    shortDescription: 'Precision drafting and measured geometry.',
    paletteLane: 'smoked parchment, silver-white, faint cyan, graphite',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'etched drafting ink, blueprint grid logic, silver calibration marks',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 10,
    iconName: 'Sliders',
    recommendationCategories: ['career', 'learning', 'custom'],
    recommendationKeywords: ['focus', 'clarity', 'discipline', 'build', 'plan', 'study'],
  },
  {
    id: 'lunar-etch',
    name: 'lunar_etch',
    displayName: 'Lunar Etch',
    generationStyle: 'lunar_etch',
    sectionType: 'core',
    category: 'Mystic',
    family: 'Atmospheric / Luminous',
    description: 'Moonlit silver engraving, quiet radiance, and nocturnal contrast.',
    shortDescription: 'Moonlit silver engraving.',
    paletteLane: 'moon-silver, indigo-black, cold pearl, soft blue-white',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'silver etching, lunar dust, restrained metallic bloom',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 20,
    iconName: 'Crown',
    recommendationCategories: ['spirituality', 'relationships', 'family'],
    recommendationKeywords: ['moon', 'reflect', 'calm', 'night', 'intuition', 'trust'],
  },
  {
    id: 'resonance-rings',
    name: 'resonance_rings',
    displayName: 'Resonance Rings',
    generationStyle: 'resonance_rings',
    sectionType: 'core',
    category: 'Luminous',
    family: 'Resonance / Field',
    description: 'Concentric pulse circles, waveform halos, and radiating energy.',
    shortDescription: 'Pulse circles and waveform halos.',
    paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'echo rings, pulse halos, acoustic field lines',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 30,
    iconName: 'Repeat',
    recommendationCategories: ['relationships', 'family', 'spirituality'],
    recommendationKeywords: ['connect', 'listen', 'return', 'repeat', 'pattern', 'practice'],
  },
  {
    id: 'watercolor',
    name: 'watercolor',
    displayName: 'Watercolor',
    generationStyle: 'watercolor',
    sectionType: 'core',
    category: 'Organic',
    family: 'Organic / Painterly',
    description: 'Flowing pigment washes, soft bloom, and textured paper.',
    shortDescription: 'Pigment washes and soft bloom.',
    paletteLane: 'mineral blue, oxblood, moss, plum, muted saffron',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment bleed, deckled paper, wet edge blooms',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 40,
    iconName: 'Waves',
    recommendationCategories: ['health', 'relationships', 'family'],
    recommendationKeywords: ['heal', 'calm', 'soften', 'peace', 'gentle', 'rest'],
  },
  {
    id: 'ink-brush',
    name: 'ink_brush',
    displayName: 'Ink Brush',
    generationStyle: 'ink_brush',
    sectionType: 'core',
    category: 'Minimal',
    family: 'Organic / Minimal',
    description: 'Sumi-e ink restraint, strong gesture, and meaningful negative space.',
    shortDescription: 'Sumi-e restraint and open space.',
    paletteLane: 'black ink, bone paper, faint iron-red seal haze',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'dry brush pressure, diluted ink mist, paper grain',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 50,
    iconName: 'Zap',
    recommendationCategories: ['creativity', 'relationships'],
    recommendationKeywords: ['create', 'flow', 'voice', 'move', 'express', 'art'],
  },
  {
    id: 'gold-leaf',
    name: 'gold_leaf',
    displayName: 'Gold Leaf',
    generationStyle: 'gold_leaf',
    sectionType: 'core',
    category: 'Luminous',
    family: 'Material / Precious',
    description: 'Gilded finish, antique glow, and precious surface depth.',
    shortDescription: 'Gilded antique glow.',
    paletteLane: 'antique gold, umber, soot-black, soft bronze',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'torn gold leaf, gilded cracks, subtle metallic dust',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 60,
    iconName: 'Crown',
    recommendationCategories: ['abundance', 'desire', 'career'],
    recommendationKeywords: ['wealth', 'worth', 'shine', 'receive', 'success', 'confidence'],
  },
  {
    id: 'cosmic',
    name: 'cosmic',
    displayName: 'Cosmic',
    generationStyle: 'cosmic',
    sectionType: 'core',
    category: 'Mystic',
    family: 'Atmospheric / Expansive',
    description: 'Deep-space atmosphere, luminous dust, and celestial depth.',
    shortDescription: 'Deep-space atmosphere.',
    paletteLane: 'midnight teal, violet gas, pale gold flare, star-white',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'nebular haze, star dust, layered dark gradients',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 70,
    iconName: 'Sparkles',
    recommendationCategories: ['spirituality', 'adventure', 'desire'],
    recommendationKeywords: ['expand', 'dream', 'vision', 'future', 'wonder', 'open'],
  },
  {
    id: 'minimal-line',
    name: 'minimal_line',
    displayName: 'Minimal Line',
    generationStyle: 'minimal_line',
    sectionType: 'core',
    category: 'Minimal',
    family: 'Precision / Minimal',
    description: 'Ultra-clean linework, spacious restraint, and quiet precision.',
    shortDescription: 'Ultra-clean linework.',
    paletteLane: 'platinum on black navy, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector-like line clarity, almost no ornament',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 80,
    iconName: 'Target',
    recommendationCategories: ['health', 'career', 'learning'],
    recommendationKeywords: ['simplify', 'focus', 'clear', 'steady', 'quiet', 'less'],
  },
  {
    id: 'obsidian-mono',
    name: 'obsidian_mono',
    displayName: 'Obsidian Mono',
    generationStyle: 'obsidian_mono',
    sectionType: 'core',
    category: 'Material',
    family: 'Material / Monochrome',
    description: 'Black glass, graphite polish, and reflective shadow.',
    shortDescription: 'Black glass and graphite polish.',
    paletteLane: 'black glass, graphite, silver edge, smoke gray',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'polished obsidian, glossy edge highlights, dark reflection',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 90,
    iconName: 'ShieldCheck',
    recommendationCategories: ['career', 'desire', 'custom'],
    recommendationKeywords: ['strength', 'boundary', 'power', 'protect', 'resolve', 'decide'],
  },
  {
    id: 'aurora-glow',
    name: 'aurora_glow',
    displayName: 'Aurora Glow',
    generationStyle: 'aurora_glow',
    sectionType: 'core',
    category: 'Luminous',
    family: 'Atmospheric / Luminous',
    description: 'Blue-green aurora light, soft spectral bloom, and moving atmosphere.',
    shortDescription: 'Blue-green spectral bloom.',
    paletteLane: 'blue-green, cobalt, violet, rare gold accents',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'light ribbons, soft atmospheric bloom, spectral haze',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 100,
    iconName: 'Cloud',
    recommendationCategories: ['health', 'creativity', 'spirituality'],
    recommendationKeywords: ['glow', 'soften', 'heal', 'light', 'open', 'breathe'],
  },
  {
    id: 'ember-trace',
    name: 'ember_trace',
    displayName: 'Ember Trace',
    generationStyle: 'ember_trace',
    sectionType: 'core',
    category: 'Material',
    family: 'Material / Heat',
    description: 'Coal-dark surface, copper heat, and controlled ember glow.',
    shortDescription: 'Copper heat and ember glow.',
    paletteLane: 'coal black, ember orange, copper red, ash gray',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'scorched linework, heated edges, ember dust',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 110,
    iconName: 'Flame',
    recommendationCategories: ['desire', 'career', 'adventure'],
    recommendationKeywords: ['energy', 'start', 'drive', 'ignite', 'courage', 'move'],
  },
  {
    id: 'monolith-ink',
    name: 'monolith_ink',
    displayName: 'Monolith Ink',
    generationStyle: 'monolith_ink',
    sectionType: 'core',
    category: 'Geometric',
    family: 'Material / Structural',
    description: 'Heavy stone ink, monumental stillness, and carved presence.',
    shortDescription: 'Heavy stone ink and stillness.',
    paletteLane: 'ash black, stone gray, dusted bronze, muted bone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'stone grain, heavy ink, carved shadow',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 120,
    iconName: 'Target',
    recommendationCategories: ['career', 'health', 'desire'],
    recommendationKeywords: ['strong', 'stable', 'ground', 'commit', 'endure', 'stand'],
  },
  {
    id: 'celestial-grid',
    name: 'celestial_grid',
    displayName: 'Celestial Grid',
    generationStyle: 'celestial_grid',
    sectionType: 'featured',
    category: 'Geometric',
    family: 'Precision / Celestial',
    description: 'Observatory geometry, star-map lines, and measured cosmic order.',
    shortDescription: 'Observatory star-map order.',
    paletteLane: 'midnight navy, pale cyan, soft violet, pinprick gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'star-map plotting, observatory marks, delicate grid constellations',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Featured',
    collectionName: 'Launch Featured',
    sortOrder: 10,
    iconName: 'Palette',
    recommendationCategories: ['adventure', 'learning', 'spirituality'],
    recommendationKeywords: ['navigate', 'map', 'learn', 'explore', 'direction', 'stars'],
  },
  {
    id: 'echo-chamber',
    name: 'echo_chamber',
    displayName: 'Echo Chamber',
    generationStyle: 'echo_chamber',
    sectionType: 'featured',
    category: 'Luminous',
    family: 'Resonance / Field',
    description: 'Repeating echoes, inner-room acoustics, and layered signal.',
    shortDescription: 'Layered signal and echo bands.',
    paletteLane: 'smoked violet, blue-gray, muted gold, shadow black',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'nested acoustic fields, soft echo bands, chamber depth',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Featured',
    collectionName: 'Launch Featured',
    sortOrder: 20,
    iconName: 'Repeat',
    recommendationCategories: ['creativity', 'relationships', 'custom'],
    recommendationKeywords: ['voice', 'memory', 'signal', 'repeat', 'listen', 'practice'],
  },
  {
    id: 'prism-veil',
    name: 'prism_veil',
    displayName: 'Prism Veil',
    generationStyle: 'prism_veil',
    sectionType: 'featured',
    category: 'Luminous',
    family: 'Organic / Light',
    description: 'Iridescent refraction, glasslike hush, and spectral layering.',
    shortDescription: 'Iridescent refraction.',
    paletteLane: 'pearl, opal, pale cyan, lavender, faint gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'translucent veils, refracted edges, prism bloom',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'New',
    collectionName: 'Launch Featured',
    sortOrder: 30,
    iconName: 'Sparkles',
    recommendationCategories: ['creativity', 'learning', 'relationships'],
    recommendationKeywords: ['clarity', 'perceive', 'shift', 'layer', 'refine', 'see'],
  },
  {
    id: 'verdigris-relic',
    name: 'verdigris_relic',
    displayName: 'Verdigris Relic',
    generationStyle: 'verdigris_relic',
    sectionType: 'featured',
    category: 'Material',
    family: 'Material / Ancient',
    description: 'Oxidized copper, mineral patina, and archaeological elegance.',
    shortDescription: 'Oxidized copper and patina.',
    paletteLane: 'oxidized teal, bronze, ash, dark stone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'aged copper, patina blooms, worn engraved surface',
    isCore: false,
    isFeatured: true,
    isSeasonal: false,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Featured',
    collectionName: 'Launch Featured',
    sortOrder: 40,
    iconName: 'ShieldCheck',
    recommendationCategories: ['learning', 'career', 'spirituality'],
    recommendationKeywords: ['wisdom', 'endure', 'earned', 'patience', 'time', 'resolve'],
  },
  {
    id: 'solar-halo',
    name: 'solar_halo',
    displayName: 'Solar Halo',
    generationStyle: 'solar_halo',
    sectionType: 'seasonal',
    category: 'Luminous',
    family: 'Atmospheric / Radiant',
    description: 'Sun-warmed radiance, disciplined brightness, and haloed clarity.',
    shortDescription: 'Sun-warmed halo clarity.',
    paletteLane: 'ivory, saffron, brass, pale amber, smoke',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'soft solar rings, warm haze, brass light',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Seasonal',
    collectionName: 'Seasonal Launch',
    availableUntil: '2026-09-21',
    sortOrder: 10,
    iconName: 'Crown',
    recommendationCategories: ['desire', 'career', 'abundance'],
    recommendationKeywords: ['sun', 'radiant', 'confidence', 'purpose', 'clear', 'bright'],
  },
  {
    id: 'tideglass',
    name: 'tideglass',
    displayName: 'Tideglass',
    generationStyle: 'tideglass',
    sectionType: 'seasonal',
    category: 'Organic',
    family: 'Organic / Coastal',
    description: 'Sea-glass translucency, mineral wash, and tidal softness.',
    shortDescription: 'Sea-glass translucency.',
    paletteLane: 'seafoam, slate blue, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'translucent washed glass, salt haze, tide-soft edges',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Seasonal',
    collectionName: 'Seasonal Launch',
    availableUntil: '2026-09-21',
    sortOrder: 20,
    iconName: 'Waves',
    recommendationCategories: ['health', 'family', 'relationships'],
    recommendationKeywords: ['flow', 'adapt', 'calm', 'heal', 'soft', 'clarity'],
  },
  {
    id: 'sacred-geometry',
    name: 'sacred_geometry',
    displayName: 'Sacred Geometry',
    generationStyle: 'sacred_geometry',
    sectionType: 'seasonal',
    category: 'Mystic',
    family: 'Geometric / Collector',
    description: 'Layered mathematical symbolism and luminous geometric depth.',
    shortDescription: 'Layered mathematical depth.',
    paletteLane: 'indigo, teal, dusty rose, muted brass, celestial blue',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'layered geometric systems, transparent overlaps, precise geometry',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: true,
    isRecommended: true,
    badgeLabel: 'Limited',
    collectionName: 'Seasonal Launch',
    availableUntil: '2026-09-21',
    sortOrder: 30,
    iconName: 'Compass',
    recommendationCategories: ['spirituality', 'learning', 'custom'],
    recommendationKeywords: ['meaning', 'purpose', 'order', 'trust', 'center', 'align'],
  },
  {
    id: 'velvet-ember',
    name: 'velvet_ember',
    displayName: 'Velvet Ember',
    generationStyle: 'velvet_ember',
    sectionType: 'seasonal',
    category: 'Material',
    family: 'Material / Luxury',
    description: 'Velvet darkness, warm ember glow, and soft luxury depth.',
    shortDescription: 'Velvet darkness and ember glow.',
    paletteLane: 'burgundy-black, copper, warm amber, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'velvet texture, ember glints, soft smoky depth',
    isCore: false,
    isFeatured: false,
    isSeasonal: true,
    isLimited: true,
    isRecommended: false,
    badgeLabel: 'Limited',
    collectionName: 'Seasonal Launch',
    availableUntil: '2026-09-21',
    sortOrder: 40,
    iconName: 'Flame',
    recommendationCategories: ['desire', 'relationships', 'creativity'],
    recommendationKeywords: ['warm', 'magnet', 'desire', 'soft', 'depth', 'ember'],
  },
];

const bySortOrder = (a: RefineStyleOption, b: RefineStyleOption) => a.sortOrder - b.sortOrder;

export const featuredStyles = REFINE_STYLES.filter((style) => style.isFeatured).sort(bySortOrder);
export const coreStyles = REFINE_STYLES.filter((style) => style.isCore).sort(bySortOrder);
export const seasonalStyles = REFINE_STYLES.filter((style) => style.isSeasonal).sort(bySortOrder);

export function getFilteredStyles(filter: RefineStyleFilter): RefineStyleOption[] {
  if (filter === 'all') {
    return [...REFINE_STYLES].sort((a, b) => {
      if (a.sectionType !== b.sectionType) {
        const sectionOrder: Record<RefineStyleSectionType, number> = { featured: 0, core: 1, seasonal: 2 };
        return sectionOrder[a.sectionType] - sectionOrder[b.sectionType];
      }

      return a.sortOrder - b.sortOrder;
    });
  }

  if (filter === 'featured') return featuredStyles;
  if (filter === 'core') return coreStyles;
  if (filter === 'seasonal') return seasonalStyles;

  const category = filter.toLowerCase();
  return REFINE_STYLES.filter((style) => style.category.toLowerCase() === category).sort((a, b) => {
    if (a.sectionType !== b.sectionType) {
      const sectionOrder: Record<RefineStyleSectionType, number> = { featured: 0, core: 1, seasonal: 2 };
      return sectionOrder[a.sectionType] - sectionOrder[b.sectionType];
    }

    return a.sortOrder - b.sortOrder;
  });
}

export function getRecommendedStyles(
  category: AnchorCategory | undefined,
  intention: string,
  limit = 4
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

  const fallback = [REFINE_STYLES[0], REFINE_STYLES[2], REFINE_STYLES[6], REFINE_STYLES[12]];

  return [...recommendations, ...fallback]
    .filter((style, index, all) => all.findIndex((candidate) => candidate.id === style.id) === index)
    .slice(0, limit);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(value);
}
