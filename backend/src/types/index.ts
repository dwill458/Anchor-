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
 * Validated styles from spike phase
 */
export type AIStyle =
  | 'watercolor'
  | 'sacred_geometry'
  | 'ink_brush'
  | 'gold_leaf'
  | 'cosmic'
  | 'minimal_line';

/**
 * Legacy AI styles (deprecated, kept for backward compatibility)
 */
export type LegacyAIStyle =
  | 'grimoire'
  | 'minimal'
  | 'geometric'
  | 'organic'
  | 'celestial';

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
 * Available anchor categories
 */
export type AnchorCategory =
  | 'career'
  | 'health'
  | 'wealth'
  | 'relationships'
  | 'personal_growth'
  | 'custom';

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request body for creating a new anchor
 */
export interface CreateAnchorRequest {
  intentionText: string;
  category: AnchorCategory;
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
export interface ApiResponse<T = any> {
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
export const STYLE_PROMPTS: Record<AIStyle, StylePromptConfig> = {
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
    negativePrompt:
      'new shapes, additional symbols, text, faces, organic, soft, messy, hand-drawn',
  },
  ink_brush: {
    name: 'ink_brush',
    method: 'lineart',
    category: 'organic',
    prompt:
      'traditional ink brush calligraphy, flowing brushstrokes, zen aesthetic, black ink on paper, japanese sumi-e',
    negativePrompt:
      'new shapes, additional symbols, text, digital, 3d, color, modern',
  },
  gold_leaf: {
    name: 'gold_leaf',
    method: 'canny',
    category: 'hybrid',
    prompt:
      'illuminated manuscript, gold leaf gilding, ornate medieval style, precious metal, luxurious texture',
    negativePrompt:
      'new shapes, additional symbols, text, modern, photography, people',
  },
  cosmic: {
    name: 'cosmic',
    method: 'lineart',
    category: 'organic',
    prompt:
      'cosmic energy, nebula, starlight, glowing ethereal sigil in deep space, celestial magic',
    negativePrompt:
      'new shapes, additional symbols, text, faces, planets, realistic, photography',
  },
  minimal_line: {
    name: 'minimal_line',
    method: 'lineart',
    category: 'geometric',
    prompt:
      'minimal line art, clean precise lines, modern minimalist, single color on white, graphic design',
    negativePrompt:
      'new shapes, additional symbols, texture, shading, embellishment, ornate',
  },
};

// ============================================================================
// Export Type Guards
// ============================================================================

/**
 * Type guard for AIStyle
 */
export function isAIStyle(value: string): value is AIStyle {
  return [
    'watercolor',
    'sacred_geometry',
    'ink_brush',
    'gold_leaf',
    'cosmic',
    'minimal_line',
  ].includes(value);
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
    'career',
    'health',
    'wealth',
    'relationships',
    'personal_growth',
    'custom',
  ].includes(value);
}
