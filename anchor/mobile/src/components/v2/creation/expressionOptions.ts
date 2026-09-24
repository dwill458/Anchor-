import type { AIStyle, AnchorCategory } from '@/types';
import { REFINE_STYLES, getRecommendedStyles, type RefineStyleOption } from '@/screens/create/constants/refineStyles';
import type { AnchorExpression } from '@/constants/v2/creation';

/**
 * One entry of the expression library, as creation presents it.
 *
 * The library is the established production style library (`REFINE_STYLES`) — the same styles
 * the generation pipeline accepts — so nothing here invents an expression. What creation adds
 * is how each one is previewed before anything is generated: the user's own structure, drawn
 * through the nearest local treatment on a ground in the style's palette. That preview is an
 * honest approximation of the direction, never a stand-in for the generated result.
 */
export type CreationStyleOption = {
  styleChoice: AIStyle;
  /** Local treatment the structure previews this style through. */
  expression: AnchorExpression;
  name: string;
  descriptor: string;
  /** The ground its thumbnail sits on, taken from the style's palette lane. */
  field: string;
  /**
   * The style's own line colour, where its treatment carries one. Several styles share a local
   * treatment; the colour (from the style's palette lane) keeps their previews distinct.
   */
  tint?: string;
  section: RefineStyleOption['sectionType'];
  sortOrder: number;
};

/**
 * Style → preview treatment and ground. Every production style has an entry; one added to the
 * library without an entry here previews as the plain structure on paper rather than breaking.
 */
const PREVIEW: Partial<Record<AIStyle, { expression: AnchorExpression; field: string; tint?: string }>> = {
  architectural_trace: { expression: 'architectural', field: '#E7E4DC' },
  lunar_etch: { expression: 'etched', field: '#E3E5EA', tint: '#7C8796' },
  resonance_rings: { expression: 'etched', field: '#EDE3D2', tint: '#B7792B' },
  watercolor: { expression: 'halo', field: '#E6E8E4', tint: '#4F6F8F' },
  ink_brush: { expression: 'ink', field: '#EFE9DD' },
  gold_leaf: { expression: 'foil', field: '#EEE4CF' },
  cosmic: { expression: 'etched', field: '#E2E1E8', tint: '#3B3F72' },
  minimal_line: { expression: 'monoline', field: '#F1EEE7' },
  obsidian_mono: { expression: 'halo', field: '#DEDCD8', tint: '#1E2226' },
  aurora_glow: { expression: 'etched', field: '#E1E9E6', tint: '#3E8A83' },
  ember_trace: { expression: 'cut_paper', field: '#EFE0D4', tint: '#B4532A' },
  monolith_ink: { expression: 'embossed', field: '#E4E1DA' },
  celestial_grid: { expression: 'architectural', field: '#E1E4EA' },
  echo_chamber: { expression: 'halo', field: '#E8E5EC', tint: '#6B5B8C' },
  prism_veil: { expression: 'cut_paper', field: '#ECE6EC', tint: '#8A6FA8' },
  verdigris_relic: { expression: 'etched', field: '#DFE6E0', tint: '#4E7C6B' },
  solar_halo: { expression: 'cut_paper', field: '#F0E6CF', tint: '#C98A2B' },
  tideglass: { expression: 'cut_paper', field: '#DFE8EA', tint: '#3F7F8C' },
  sacred_geometry: { expression: 'foil', field: '#EAE4D6' },
  velvet_ember: { expression: 'cut_paper', field: '#EBDDDA', tint: '#7A2E3A' },
};

const DEFAULT_PREVIEW: { expression: AnchorExpression; field: string; tint?: string } = { expression: 'monoline', field: '#EFEBE3' };

function isAvailable(style: RefineStyleOption, now: Date): boolean {
  if (!style.availableUntil) return true;
  const until = new Date(`${style.availableUntil}T23:59:59`);
  return Number.isNaN(until.getTime()) || until.getTime() >= now.getTime();
}

function toOption(style: RefineStyleOption): CreationStyleOption {
  const preview = PREVIEW[style.generationStyle] ?? DEFAULT_PREVIEW;
  return {
    styleChoice: style.generationStyle,
    expression: preview.expression,
    name: style.displayName,
    descriptor: style.shortDescription,
    field: preview.field,
    tint: preview.tint,
    section: style.sectionType,
    sortOrder: style.sortOrder,
  };
}

const SECTION_ORDER: Record<RefineStyleOption['sectionType'], number> = { featured: 0, core: 1, seasonal: 2 };

export type CreationStyleLibrary = {
  /** A few styles suited to this intention, shown first. Also present in `all`. */
  suggested: CreationStyleOption[];
  /** Every style currently offered, in library order. */
  all: CreationStyleOption[];
};

/** The styles offered today, with the ones suited to this intention first. */
export function creationStyleLibrary(category?: AnchorCategory, intention = '', now = new Date()): CreationStyleLibrary {
  const available = REFINE_STYLES.filter((style) => isAvailable(style, now));
  const all = [...available]
    .sort((a, b) => SECTION_ORDER[a.sectionType] - SECTION_ORDER[b.sectionType] || a.sortOrder - b.sortOrder)
    .map(toOption);
  const suggested = getRecommendedStyles(category, intention, 6)
    .filter((style) => isAvailable(style, now))
    .slice(0, 3)
    .map(toOption);
  return { suggested, all };
}

export function styleOption(styleChoice: AIStyle | undefined | null): CreationStyleOption | undefined {
  if (!styleChoice) return undefined;
  const style = REFINE_STYLES.find((candidate) => candidate.generationStyle === styleChoice);
  return style ? toOption(style) : undefined;
}

/**
 * The style generation is asked for. Drafts made before the full library record only a local
 * expression; those resolve to the style that expression used to stand for.
 */
const LEGACY_EXPRESSION_STYLE: Partial<Record<AnchorExpression, AIStyle>> = {
  architectural: 'architectural_trace',
  etched: 'lunar_etch',
  ink: 'ink_brush',
  foil: 'gold_leaf',
  monoline: 'minimal_line',
  embossed: 'monolith_ink',
};

export function generationStyleFor(draft: { styleChoice?: AIStyle; expression: AnchorExpression }): AIStyle | undefined {
  if (draft.expression === 'original') return undefined;
  return draft.styleChoice ?? LEGACY_EXPRESSION_STYLE[draft.expression];
}
