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
  | 'Palette'
  | 'AudioLines'
  | 'Brush'
  | 'CircleDotDashed'
  | 'Cuboid'
  | 'DraftingCompass'
  | 'Feather'
  | 'Gem'
  | 'Hexagon'
  | 'Moon'
  | 'Orbit'
  | 'SunMedium'
  | 'Telescope'
  | 'WandSparkles';

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
  glyphTreatment?: 'light' | 'dark';
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

/**
 * The finalized 15 Anchor 2.0 styles in canonical order (1-15).
 */
export const REFINE_STYLES: RefineStyleOption[] = [
  // 1. Velvet Ember
  {
    id: 'velvet-ember',
    name: 'velvet_ember',
    displayName: 'Velvet Ember',
    generationStyle: 'velvet_ember_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Soft Textile Pile',
    description: 'Rich tactile velvet with a soft matte pile and ember-warm pigment concentration.',
    shortDescription: 'Warm velvet pile and ember glow.',
    paletteLane: 'burnt copper, deep wine, ember-orange, umber',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'tactile velvet pile, directional nap, ember pigment concentration',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 10,
    iconName: 'Flame',
    glyphTreatment: 'light',
    recommendationCategories: ['desire', 'relationships', 'creativity'],
    recommendationKeywords: ['warm', 'magnet', 'desire', 'soft', 'depth', 'ember', 'passion'],
  },
  // 2. Porcelain
  {
    id: 'porcelain',
    name: 'porcelain',
    displayName: 'Porcelain',
    generationStyle: 'porcelain_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Ceramic Glaze',
    description: 'Ivory ceramic glaze with rich cobalt-blue areas and fine glaze crazing.',
    shortDescription: 'Ivory ceramic with fine glaze crazing.',
    paletteLane: 'ivory, cobalt blue, celadon, gold luster',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'crackle glaze, cobalt flow, fine ceramic crazing',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 20,
    iconName: 'Sparkles',
    glyphTreatment: 'dark',
    recommendationCategories: ['learning', 'career', 'custom'],
    recommendationKeywords: ['pure', 'clarity', 'focus', 'ceramic', 'refine', 'truth'],
  },
  // 3. Prism Flow
  {
    id: 'prism-flow',
    name: 'prism_flow',
    displayName: 'Prism Flow',
    generationStyle: 'prism_flow_v2',
    sectionType: 'core',
    category: 'Luminous',
    family: 'Refractive Glass',
    description: 'Translucent flowing glass with chromatic dispersion, violet and amber refractions.',
    shortDescription: 'Translucent flowing optical glass.',
    paletteLane: 'violet, purple, emerald, warm amber, optical dispersion',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'refractive glass, chromatic dispersion, internal liquid light',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 30,
    iconName: 'Orbit',
    glyphTreatment: 'light',
    recommendationCategories: ['creativity', 'spirituality', 'learning'],
    recommendationKeywords: ['flow', 'prism', 'light', 'spectral', 'energy', 'clarity'],
  },
  // 4. Joybrush
  {
    id: 'joybrush',
    name: 'joybrush',
    displayName: 'Joybrush',
    generationStyle: 'joybrush_v2',
    sectionType: 'core',
    category: 'Organic',
    family: 'Gestural Paint',
    description: 'Dynamic expressive brushstrokes in coral, yellow, and hot pink with joyful energy.',
    shortDescription: 'Expressive coral and pink painted energy.',
    paletteLane: 'coral, yellow, hot pink, ultramarine, gold',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'expressive gouache, wet paint gestures, gold leaf lines',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 40,
    iconName: 'Brush',
    glyphTreatment: 'dark',
    recommendationCategories: ['creativity', 'desire', 'relationships'],
    recommendationKeywords: ['joy', 'express', 'paint', 'bold', 'vibrant', 'alive'],
  },
  // 5. Deep Cosmos
  {
    id: 'deep-cosmos',
    name: 'deep_cosmos',
    displayName: 'Deep Cosmos',
    generationStyle: 'deep_cosmos_v2',
    sectionType: 'core',
    category: 'Mystic',
    family: 'Cosmic Field',
    description: 'Deep teal and nocturnal field with stellar dust and warm gold nebula highlights.',
    shortDescription: 'Atmospheric deep field with gold stellar highlights.',
    paletteLane: 'deep teal, cosmic black, warm gold, magenta starfield',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'nebula dust, stellar illumination, atmospheric depth',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 50,
    iconName: 'Telescope',
    glyphTreatment: 'light',
    recommendationCategories: ['spirituality', 'creativity', 'custom'],
    recommendationKeywords: ['cosmos', 'space', 'infinite', 'stars', 'night', 'deep'],
  },
  // 6. Woven
  {
    id: 'woven',
    name: 'woven',
    displayName: 'Woven',
    generationStyle: 'woven_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Woven Fibre',
    description: 'Tactile indigo and navy woven textile with visible warp, weft, and natural texture.',
    shortDescription: 'Deep indigo woven textile texture.',
    paletteLane: 'indigo, navy, natural linen, forest green',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'woven yarn, cross-hatch texture, tactile cloth ground',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 60,
    iconName: 'Sliders',
    glyphTreatment: 'light',
    recommendationCategories: ['career', 'learning', 'health'],
    recommendationKeywords: ['strength', 'weave', 'grounded', 'durable', 'structure', 'routine'],
  },
  // 7. Paper
  {
    id: 'paper',
    name: 'paper',
    displayName: 'Paper',
    generationStyle: 'paper_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Fibrous Substrate',
    description: 'Dusty-blue handmade paper with deckled edges, organic texture, and visible fibers.',
    shortDescription: 'Handmade paper with deckled fiber texture.',
    paletteLane: 'dusty blue, raw cotton cream, charcoal fiber',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'deckled edge, natural fibers, soft pressed pulp',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 70,
    iconName: 'Feather',
    glyphTreatment: 'dark',
    recommendationCategories: ['learning', 'spirituality', 'custom'],
    recommendationKeywords: ['write', 'begin', 'craft', 'journal', 'intention', 'calm'],
  },
  // 8. Mineral Wash
  {
    id: 'mineral-wash',
    name: 'mineral_wash',
    displayName: 'Mineral Wash',
    generationStyle: 'clay_v2',
    sectionType: 'core',
    category: 'Organic',
    family: 'Mineral Surface',
    description: 'Compressed natural earth pigments, limewash, ochre, and muted sage tones.',
    shortDescription: 'Ochre and muted sage mineral surface.',
    paletteLane: 'ochre, sage, terracotta, bone chalk',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'powdery matte pigment, limewash mottling, raw mineral ground',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 80,
    iconName: 'Compass',
    glyphTreatment: 'dark',
    recommendationCategories: ['health', 'spirituality', 'relationships'],
    recommendationKeywords: ['earth', 'ground', 'heal', 'steady', 'calm', 'nature'],
  },
  // 9. Graphic
  {
    id: 'graphic',
    name: 'graphic',
    displayName: 'Graphic',
    generationStyle: 'graphic_v2',
    sectionType: 'core',
    category: 'Geometric',
    family: 'Constructivist Print',
    description: 'Bold constructivist geometric composition in deep green, orange, mustard, and blush.',
    shortDescription: 'Geometric composition in green and orange.',
    paletteLane: 'deep green, cadmium orange, mustard, blush, cream',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'silkscreen ink planes, flat colour geometry, graphic rhythm',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 90,
    iconName: 'Hexagon',
    glyphTreatment: 'dark',
    recommendationCategories: ['career', 'creativity', 'learning'],
    recommendationKeywords: ['build', 'shape', 'rhythm', 'balance', 'modern', 'bold'],
  },
  // 10. Plush
  {
    id: 'plush',
    name: 'plush',
    displayName: 'Plush',
    generationStyle: 'plush_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Felt Relief',
    description: 'Dimensional sky-blue felt ground with raised cream, pink, yellow, and cobalt soft forms.',
    shortDescription: 'Dimensional sky-blue felt relief collage.',
    paletteLane: 'sky blue, soft cream, blush pink, marigold, cobalt',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'cut felt, raised relief, soft drop shadows, tactile wool',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 100,
    iconName: 'Cloud',
    glyphTreatment: 'dark',
    recommendationCategories: ['health', 'relationships', 'family'],
    recommendationKeywords: ['comfort', 'play', 'gentle', 'warmth', 'soft', 'care'],
  },
  // 11. Herbarium
  {
    id: 'herbarium',
    name: 'herbarium',
    displayName: 'Herbarium',
    generationStyle: 'herbarium_v2',
    sectionType: 'core',
    category: 'Organic',
    family: 'Botanical Specimen',
    description: 'Muted sage ground framed by pressed eucalyptus, ginkgo, and dried floral specimens.',
    shortDescription: 'Pressed botanical specimens on muted sage.',
    paletteLane: 'muted sage, dried ginkgo gold, eucalyptus green, blush',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pressed leaves, dried botanicals, aged paper mounting',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: true,
    badgeLabel: 'Recommended',
    sortOrder: 110,
    iconName: 'Feather',
    glyphTreatment: 'dark',
    recommendationCategories: ['health', 'spirituality', 'relationships'],
    recommendationKeywords: ['nature', 'preserve', 'time', 'botanical', 'grow', 'peace'],
  },
  // 12. Alloy
  {
    id: 'alloy',
    name: 'alloy',
    displayName: 'Alloy',
    generationStyle: 'alloy_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Tempered Metal',
    description: 'Dark gunmetal steel surface with iridescent blue heat-treated coloration.',
    shortDescription: 'Dark gunmetal steel with blue heat tempering.',
    paletteLane: 'dark gunmetal, heat-tempered blue, brushed brass, copper',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'tempered steel, heat tint oxidation, brushed metal grain',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 120,
    iconName: 'ShieldCheck',
    glyphTreatment: 'light',
    recommendationCategories: ['career', 'learning', 'custom'],
    recommendationKeywords: ['forge', 'temper', 'steel', 'resilient', 'iron', 'strength'],
  },
  // 13. Gilt
  {
    id: 'gilt',
    name: 'gilt',
    displayName: 'Gilt',
    generationStyle: 'gilt_v2',
    sectionType: 'core',
    category: 'Mystic',
    family: 'Illuminated Gold',
    description: 'Deep emerald ground framed with irregular, hand-applied burnished gold leaf.',
    shortDescription: 'Deep emerald ground with burnished gold leaf.',
    paletteLane: 'deep emerald, burnished gold, midnight blue, antique parchment',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'gold leaf leafing, bole ground, metallic reflection',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 130,
    iconName: 'Crown',
    glyphTreatment: 'light',
    recommendationCategories: ['career', 'desire', 'spirituality'],
    recommendationKeywords: ['gold', 'sacred', 'precious', 'value', 'crown', 'abundant'],
  },
  // 14. Flash
  {
    id: 'flash',
    name: 'flash',
    displayName: 'Flash',
    generationStyle: 'flash_v2',
    sectionType: 'core',
    category: 'Organic',
    family: 'Classic Flash',
    description: 'Faded blue aged-paper ground framed by classic red, black, and gold tattoo-flash motifs.',
    shortDescription: 'Faded blue ground with traditional tattoo flash.',
    paletteLane: 'faded blue, aged cream, traditional red, tattoo black, warm gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'aged paper stain, bold tattoo line, vintage flash coloring',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 140,
    iconName: 'Zap',
    glyphTreatment: 'dark',
    recommendationCategories: ['creativity', 'desire', 'custom'],
    recommendationKeywords: ['mark', 'permanent', 'courage', 'flash', 'bold', 'devotion'],
  },
  // 15. Buff
  {
    id: 'buff',
    name: 'buff',
    displayName: 'Buff',
    generationStyle: 'buff_v2',
    sectionType: 'core',
    category: 'Material',
    family: 'Urban Wall',
    description: 'Repeatedly painted off-white urban wall with red, yellow, and black remnants around edges.',
    shortDescription: 'Layered off-white wall with paint remnants.',
    paletteLane: 'buff off-white, weathered plaster, spray remnants, asphalt black',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'layered latex paint, weathered plaster, paint drips and fragments',
    isCore: true,
    isFeatured: false,
    isSeasonal: false,
    isLimited: false,
    isRecommended: false,
    sortOrder: 150,
    iconName: 'Cuboid',
    glyphTreatment: 'dark',
    recommendationCategories: ['learning', 'career', 'custom'],
    recommendationKeywords: ['persist', 'reinvent', 'layer', 'history', 'endure', 'urban'],
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

  const fallback = [REFINE_STYLES[0], REFINE_STYLES[1], REFINE_STYLES[4], REFINE_STYLES[10]];

  return [...recommendations, ...fallback]
    .filter((style, index, all) => all.findIndex((candidate) => candidate.id === style.id) === index)
    .slice(0, limit);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(value);
}
