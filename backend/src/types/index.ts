/**
 * Anchor Backend - TypeScript Type Definitions
 *
 * Mirrors frontend types for consistency across client/server
 */

// ============================================================================
// Sigil & Enhancement Types
// ============================================================================

/**
 * Sigil variant types (deterministic structure variations)
 */
export type SigilVariant = 'dense' | 'balanced' | 'minimal';

/**
 * AI style options (ControlNet-based style transfer)
 * Launch library styles are organized as 12 core, 4 featured, and 4 seasonal styles.
 */
export const AI_STYLE_IDS = [
  'architectural_trace',
  'lunar_etch',
  'resonance_rings',
  'watercolor',
  'ink_brush',
  'gold_leaf',
  'cosmic',
  'minimal_line',
  'obsidian_mono',
  'aurora_glow',
  'ember_trace',
  'monolith_ink',
  'celestial_grid',
  'echo_chamber',
  'prism_veil',
  'verdigris_relic',
  'solar_halo',
  'tideglass',
  'sacred_geometry',
  'velvet_ember',
  'solar_veil',
  'ink_bloom',
  'prism_fold',
  'ocean_current',
  'halo_drift',
  'harvest_gild',
  'midnight_bloom',
  'winter_halo',
] as const;

export type AIStyle = (typeof AI_STYLE_IDS)[number];

/**
 * Legacy AI styles (deprecated, kept for backward compatibility)
 */
export type LegacyAIStyle = 'grimoire' | 'minimal' | 'geometric' | 'organic' | 'celestial';

/**
 * Enhancement path choice
 */
export type EnhancementPath = 'keep_pure' | 'enhance_ai' | 'skip';

/**
 * ControlNet preprocessing method
 */
export type ControlMethod = 'canny' | 'lineart';

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Reinforcement quality metrics
 * Tracks user's manual reinforcement/tracing session
 */
export interface ReinforcementMetadata {
  /** Whether user completed the reinforcement step */
  completed: boolean;

  /** Whether user skipped reinforcement */
  skipped: boolean;

  /** Number of strokes user drew during reinforcement */
  strokeCount: number;

  /** Overlap percentage with base structure (0-100) */
  fidelityScore: number;

  /** Time spent on reinforcement in milliseconds */
  timeSpentMs: number;

  /** When reinforcement was completed (if applicable) */
  completedAt?: Date | string;
}

/**
 * AI enhancement tracking metadata
 * Records which AI style was applied and generation details
 */
export interface EnhancementMetadata {
  /** Style that was applied (e.g., 'watercolor', 'sacred_geometry') */
  styleApplied: AIStyle | LegacyAIStyle | string;

  /** AI model identifier (e.g., 'sdxl-controlnet-canny-v1') */
  modelUsed: string;

  /** ControlNet method used (e.g., 'canny', 'lineart') */
  controlMethod: ControlMethod | string;

  /** Generation time in milliseconds */
  generationTimeMs: number;

  /** Prompt used for generation */
  promptUsed: string;

  /** Negative prompt used */
  negativePrompt: string;

  /** When AI enhancement was applied */
  appliedAt: Date | string;
}

// ============================================================================
// Anchor Category
// ============================================================================

/**
 * Available anchor categories with keywords
 */
export type AnchorCategory =
  | 'desire'
  | 'health'
  | 'career'
  | 'relationships'
  | 'creativity'
  | 'spirituality'
  | 'abundance'
  | 'family'
  | 'learning'
  | 'adventure'
  | 'custom';

/**
 * Category metadata with keywords and descriptions
 */
export const CATEGORY_METADATA: Record<
  AnchorCategory,
  { keywords: string[]; description: string }
> = {
  desire: {
    keywords: ['passion', 'attraction', 'want', 'goal', 'aspiration', 'longing'],
    description: 'Personal desires, passions, and aspirations',
  },
  health: {
    keywords: ['wellness', 'fitness', 'healing', 'vitality', 'energy', 'recovery'],
    description: 'Physical and mental wellbeing',
  },
  career: {
    keywords: ['work', 'professional', 'job', 'success', 'ambition', 'calling'],
    description: 'Career growth and professional development',
  },
  relationships: {
    keywords: ['love', 'connection', 'friendship', 'intimacy', 'bond', 'partnership'],
    description: 'Romantic and personal relationships',
  },
  creativity: {
    keywords: ['art', 'expression', 'innovation', 'craft', 'creation', 'inspiration'],
    description: 'Creative pursuits and artistic expression',
  },
  spirituality: {
    keywords: ['meditation', 'mindfulness', 'sacred', 'consciousness', 'awakening', 'purpose'],
    description: 'Spiritual growth and inner awareness',
  },
  abundance: {
    keywords: ['finances', 'prosperity', 'wealth', 'money', 'flow', 'generosity'],
    description: 'Financial wellbeing and material abundance',
  },
  family: {
    keywords: ['parents', 'children', 'siblings', 'kin', 'home', 'belonging'],
    description: 'Family bonds and household harmony',
  },
  learning: {
    keywords: ['education', 'skill', 'knowledge', 'growth', 'mastery', 'development'],
    description: 'Learning, education, and skill development',
  },
  adventure: {
    keywords: ['travel', 'exploration', 'experience', 'journey', 'discovery', 'freedom'],
    description: 'Travel, exploration, and new experiences',
  },
  custom: {
    keywords: ['personal', 'unique', 'bespoke'],
    description: 'Custom intention categories',
  },
};

/**
 * Planetary Tier for Anchor classification (5-tier system)
 */
export enum PlanetaryTier {
  SATURN = 'saturn', // 3×3, Discipline/Boundaries
  JUPITER = 'jupiter', // 4×4, Wealth/Growth
  MARS = 'mars', // 5×5, Energy/Physicality
  SUN = 'sun', // 6×6, Identity/Clarity
  VENUS = 'venus', // 7×7, Peace/Harmony
}

/**
 * Maps anchor categories to the 5-tier planetary system
 * Saturn: Discipline, boundaries, structure
 * Jupiter: Growth, expansion, abundance
 * Mars: Action, energy, physicality
 * Sun: Identity, clarity, authenticity
 * Venus: Harmony, peace, relationships
 */
export const CATEGORY_TO_TIER: Record<AnchorCategory, PlanetaryTier> = {
  desire: PlanetaryTier.JUPITER, // Growth and expansion of aspirations
  health: PlanetaryTier.MARS, // Physical energy and vitality
  career: PlanetaryTier.JUPITER, // Professional growth and expansion
  relationships: PlanetaryTier.VENUS, // Harmony and connection
  creativity: PlanetaryTier.SUN, // Self-expression and identity
  spirituality: PlanetaryTier.SATURN, // Discipline and inner structure
  abundance: PlanetaryTier.JUPITER, // Material growth and expansion
  family: PlanetaryTier.VENUS, // Harmony within the home
  learning: PlanetaryTier.SATURN, // Discipline and mastery
  adventure: PlanetaryTier.MARS, // Action and physicality
  custom: PlanetaryTier.SATURN, // User-defined structure
};

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request body for creating a new anchor
 */
export interface CreateAnchorRequest {
  intentionText: string;
  category: AnchorCategory;
  planetaryTier?: PlanetaryTier | string;
  classifierVersion?: number;
  classifierMeta?: Record<string, unknown>;
  distilledLetters: string[];
  baseSigilSvg: string;
  reinforcedSigilSvg?: string;
  structureVariant: SigilVariant;
  reinforcementMetadata?: ReinforcementMetadata;
  enhancedImageUrl?: string;
  enhancementMetadata?: EnhancementMetadata;
  mantraText?: string;
  mantraPronunciation?: string;
  mantraAudioUrl?: string;
}

/**
 * Request body for AI enhancement
 */
export interface AIEnhancementRequest {
  /** SVG structure to enhance (reinforced OR base) */
  sigilSvg: string;

  /** AI style to apply */
  style: AIStyle;

  /** User's intention text (for context) */
  intentionText?: string;

  /** Number of variations to generate (default: 4) */
  numVariations?: number;
}

/**
 * Response from AI enhancement
 */
export interface AIEnhancementResponse {
  success: boolean;
  variations: string[]; // Array of image URLs
  metadata: EnhancementMetadata;
  error?: string;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    total?: number;
  };
}

// ============================================================================
// ControlNet Configuration
// ============================================================================

/**
 * ControlNet generation settings
 */
export interface ControlNetConfig {
  /** Strength of structure conditioning (0-1, higher = more structure preservation) */
  conditioning_scale: number;

  /** Classifier-free guidance scale */
  guidance_scale: number;

  /** Number of inference steps */
  num_inference_steps: number;

  /** Control method to use */
  control_type: ControlMethod;
}

/**
 * Default ControlNet configurations by style
 */
export const CONTROLNET_DEFAULTS: Record<string, ControlNetConfig> = {
  watercolor: {
    conditioning_scale: 0.8,
    guidance_scale: 7.5,
    num_inference_steps: 30,
    control_type: 'lineart',
  },
  sacred_geometry: {
    conditioning_scale: 0.9, // Higher for geometric precision
    guidance_scale: 10,
    num_inference_steps: 30,
    control_type: 'canny',
  },
  ink_brush: {
    conditioning_scale: 0.8,
    guidance_scale: 7.5,
    num_inference_steps: 30,
    control_type: 'lineart',
  },
  gold_leaf: {
    conditioning_scale: 0.85,
    guidance_scale: 7.5,
    num_inference_steps: 30,
    control_type: 'canny',
  },
  cosmic: {
    conditioning_scale: 0.8,
    guidance_scale: 7.5,
    num_inference_steps: 30,
    control_type: 'lineart',
  },
  minimal_line: {
    conditioning_scale: 0.9, // Higher for clean lines
    guidance_scale: 10,
    num_inference_steps: 30,
    control_type: 'canny',
  },
};

// ============================================================================
// AI Style Prompts
// ============================================================================

/**
 * AI style prompt configuration
 */
export interface StylePromptConfig {
  name: AIStyle;
  method: ControlMethod;
  category: 'organic' | 'geometric' | 'hybrid';
  prompt: string;
  negativePrompt: string;
}

/**
 * Validated style prompts from spike phase
 */
export const STYLE_PROMPTS: Partial<Record<AIStyle, StylePromptConfig>> = {
  watercolor: {
    name: 'watercolor',
    method: 'lineart',
    category: 'organic',
    prompt:
      'flowing watercolor painting, soft edges, translucent washes, mystical sigil symbol, artistic brushstrokes',
    negativePrompt:
      'new shapes, additional symbols, text, faces, people, photography, realistic, 3d',
  },
  sacred_geometry: {
    name: 'sacred_geometry',
    method: 'canny',
    category: 'geometric',
    prompt:
      'sacred geometry, precise golden lines, geometric perfection, mystical symbol etched in gold, mathematical precision',
    negativePrompt: 'new shapes, additional symbols, text, faces, organic, soft, messy, hand-drawn',
  },
  ink_brush: {
    name: 'ink_brush',
    method: 'lineart',
    category: 'organic',
    prompt:
      'Restore and beautify the existing sigil while preserving exact geometry and stroke paths. Render it in an expressive traditional ink brush sumi-e style with flowing brush pressure, visible dry-brush texture, ink wash gradients, subtle feathering, rice paper texture, and elegant zen calligraphic energy. Keep the sigil structure exactly as drawn, but make the brushwork feel organic, tactile, and artistically alive.',
    negativePrompt:
      'extra lines, decorative circle, mandala, compass, runes, glyphs, occult seal, emblem, logo redesign, reinterpretation, frame, border, symmetry embellishment, altered shape, new symbols, added elements, changed geometry, distorted lines, additional rings, extra patterns, modified structure, redesigned form, digital, 3d, modern',
  },
  gold_leaf: {
    name: 'gold_leaf',
    method: 'canny',
    category: 'hybrid',
    prompt:
      'illuminated manuscript, gold leaf gilding, ornate medieval style, precious metal, luxurious texture',
    negativePrompt: 'new shapes, additional symbols, text, modern, photography, people',
  },
  cosmic: {
    name: 'cosmic',
    method: 'lineart',
    category: 'organic',
    prompt:
      'cosmic energy, nebula, starlight, glowing ethereal sigil in deep space, celestial magic',
    negativePrompt: 'new shapes, additional symbols, text, faces, planets, realistic, photography',
  },
  minimal_line: {
    name: 'minimal_line',
    method: 'lineart',
    category: 'geometric',
    prompt:
      'minimal line art, clean precise lines, modern minimalist, single color on white, graphic design',
    negativePrompt: 'new shapes, additional symbols, texture, shading, embellishment, ornate',
  },
};

// ============================================================================
// Export Type Guards
// ============================================================================

/**
 * Type guard for AIStyle
 */
export function isAIStyle(value: string): value is AIStyle {
  return (AI_STYLE_IDS as readonly string[]).includes(value);
}

/**
 * Type guard for SigilVariant
 */
export function isSigilVariant(value: string): value is SigilVariant {
  return ['dense', 'balanced', 'minimal'].includes(value);
}

/**
 * Type guard for AnchorCategory
 */
export function isAnchorCategory(value: string): value is AnchorCategory {
  return [
    'desire',
    'health',
    'career',
    'relationships',
    'creativity',
    'spirituality',
    'abundance',
    'family',
    'learning',
    'adventure',
    'custom',
  ].includes(value);
}
