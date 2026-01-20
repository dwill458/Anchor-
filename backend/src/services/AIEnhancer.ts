/**
 * Anchor App - AI Enhancement Service
 *
 * Generates AI-enhanced sigil artwork using Stable Diffusion XL via Replicate API.
 * Takes traditional sigil + selected symbols and creates 4 stunning variations.
 */

import Replicate from 'replicate';
import { AnalysisResult, getAestheticPrompt } from './IntentionAnalyzer';
import { logger } from '../utils/logger';
import { rasterizeSVG } from '../utils/svgRasterizer';

export interface AIEnhancementRequest {
  sigilSvg: string; // Traditional sigil SVG
  analysis: AnalysisResult; // Intention analysis results
  userId: string; // For tracking/billing
}

export interface AIEnhancementResult {
  variations: string[]; // Array of 4 image URLs
  prompt: string; // The prompt used for generation
  negativePrompt: string; // Negative prompt used
  model: string; // Model identifier
  generationTime: number; // Time in seconds
}

/**
 * Initialize Replicate client
 */
function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  // Check for missing or placeholder token
  if (!apiToken || apiToken === 'your-replicate-token') {
    // Return null or throw specific error to handled by caller?
    // Better: let caller handle "mock mode" or throw here.
    // In this case, we'll let it throw, and handle it in enhanceSigil
    throw new Error('REPLICATE_API_TOKEN environment variable not set or invalid');
  }

  return new Replicate({
    auth: apiToken,
  });
}

/**
 * Build comprehensive prompt for Stable Diffusion
 */
function buildPrompt(analysis: AnalysisResult): string {
  const parts: string[] = [];

  // Start with the aesthetic approach
  const aestheticPrompt = getAestheticPrompt(analysis.aesthetic);
  parts.push(aestheticPrompt);

  // Add symbol descriptions
  const symbolDescriptions = analysis.selectedSymbols
    .map(s => s.name.toLowerCase())
    .join(', ');
  if (symbolDescriptions) {
    parts.push(`featuring ${symbolDescriptions}`);
  }

  // Add theme-based modifiers
  const themeModifiers: Record<string, string> = {
    wealth: 'golden accents, prosperity energy, abundance symbols',
    success: 'radiant power, victorious energy, achievement aura',
    love: 'heart energy, romantic symbols, harmonious colors',
    protection: 'defensive symbols, shield imagery, strong boundaries',
    health: 'vital energy, healing light, wholeness symbols',
    communication: 'flowing lines, connection patterns, clarity symbols',
    growth: 'upward spirals, expansion patterns, evolving forms',
  };

  analysis.themes.forEach(theme => {
    if (themeModifiers[theme]) {
      parts.push(themeModifiers[theme]);
    }
  });

  // Quality modifiers
  parts.push('highly detailed, mystical, powerful, intentional');
  parts.push('digital art, professional quality, 4k resolution');
  parts.push('centered composition, bold design, symbolic');

  return parts.join(', ');
}

/**
 * Build negative prompt (things to avoid)
 */
function buildNegativePrompt(): string {
  return [
    'blurry',
    'low quality',
    'pixelated',
    'distorted',
    'ugly',
    'messy',
    'cluttered',
    'chaotic',
    'random',
    'text',
    'words',
    'letters',
    'watermark',
    'signature',
    'photorealistic faces',
    'human figures',
    'modern objects',
    'technology',
  ].join(', ');
}

/**
 * Generate 4 AI-enhanced variations using Stable Diffusion XL
 */
export async function enhanceSigil(
  request: AIEnhancementRequest
): Promise<AIEnhancementResult> {
  const startTime = Date.now();

  try {
    // Build prompts
    const prompt = buildPrompt(request.analysis);
    const negativePrompt = buildNegativePrompt();

    // Check if we should run in mock mode
    const apiToken = process.env.REPLICATE_API_TOKEN;
    const isMockMode = !apiToken || apiToken === 'your-replicate-token';

    if (isMockMode) {
      logger.warn('[AI Enhancement] Running in MOCK MODE (No valid API Token)');
      logger.debug('[AI Enhancement] Prompt', { prompt });

      // Simulate generation delay (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000));

      const variations = [
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-1&backgroundColor=1a1a1d&shape1Color=d4af37`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-2&backgroundColor=0f1419&shape1Color=cd7f32`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-3&backgroundColor=3e2c5b&shape1Color=f5f5dc`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-4&backgroundColor=1a1a1d&shape1Color=c0c0c0`,
      ];

      return {
        variations,
        prompt,
        negativePrompt,
        model: 'mock-model-v1',
        generationTime: 3,
      };
    }

    const replicate = getReplicateClient();

    logger.info('[AI Enhancement] Starting generation');
    logger.debug('[AI Enhancement] Prompt', { prompt });

    // Model: Stable Diffusion XL
    const model = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

    // Generate 4 variations with different seeds
    const variations: string[] = [];

    for (let i = 0; i < 4; i++) {
      logger.info(`[AI Enhancement] Generating variation`, { current: i + 1, total: 4 });

      const output = await replicate.run(model, {
        input: {
          prompt,
          negative_prompt: negativePrompt,
          width: 1024,
          height: 1024,
          num_outputs: 1,
          num_inference_steps: 50, // Quality vs speed tradeoff
          guidance_scale: 7.5, // How closely to follow prompt
          seed: 1000 + i * 123, // Different seed for each variation
          scheduler: 'K_EULER', // Sampling algorithm
        },
      });

      // Replicate returns array of URLs
      if (Array.isArray(output) && output.length > 0) {
        variations.push(output[0] as string);
      } else {
        throw new Error(`Failed to generate variation ${i + 1}`);
      }
    }

    const generationTime = Math.round((Date.now() - startTime) / 1000);

    logger.info('[AI Enhancement] Complete', { variations: 4, generationTime });

    return {
      variations,
      prompt,
      negativePrompt,
      model,
      generationTime,
    };
  } catch (error) {
    logger.error('[AI Enhancement] Error', error);
    throw new Error(`AI enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Estimate generation time (for UI progress indicator)
 */
export function estimateGenerationTime(): { min: number; max: number } {
  // Stable Diffusion XL typically takes 10-20 seconds per image
  // We're generating 4 images, so 40-80 seconds total
  return {
    min: 40,
    max: 80,
  };
}

/**
 * Get cost estimate for AI enhancement
 */
export function getCostEstimate(): number {
  // Replicate charges ~$0.01 per image for SDXL
  // 4 variations = $0.04 per anchor
  return 0.04;
}

// ============================================================================
// CONTROLNET ENHANCEMENT (Phase 3)
// ============================================================================

/**
 * AI Style type definition (matches mobile types)
 */
export type AIStyle =
  | 'watercolor'
  | 'sacred_geometry'
  | 'ink_brush'
  | 'gold_leaf'
  | 'cosmic'
  | 'minimal_line';

/**
 * Style configuration for ControlNet enhancement
 */
interface StyleConfig {
  name: AIStyle;
  method: 'canny' | 'lineart';
  prompt: string;
  negativePrompt: string;
  category: 'organic' | 'geometric' | 'hybrid';
}

/**
 * Validated style configurations from spike phase
 */
const STYLE_CONFIGS: Record<AIStyle, StyleConfig> = {
  watercolor: {
    name: 'watercolor',
    method: 'lineart',
    category: 'organic',
    prompt: 'flowing watercolor painting, soft edges, translucent washes, mystical sigil symbol, artistic brushstrokes',
    negativePrompt: 'new shapes, additional symbols, text, faces, people, photography, realistic, 3d',
  },
  sacred_geometry: {
    name: 'sacred_geometry',
    method: 'canny',
    category: 'geometric',
    prompt: 'sacred geometry, precise golden lines, geometric perfection, mystical symbol etched in gold, mathematical precision',
    negativePrompt: 'new shapes, additional symbols, text, faces, organic, soft, messy, hand-drawn',
  },
  ink_brush: {
    name: 'ink_brush',
    method: 'lineart',
    category: 'organic',
    prompt: 'traditional ink brush calligraphy, flowing brushstrokes, zen aesthetic, black ink on paper, japanese sumi-e',
    negativePrompt: 'new shapes, additional symbols, text, digital, 3d, color, modern',
  },
  gold_leaf: {
    name: 'gold_leaf',
    method: 'canny',
    category: 'hybrid',
    prompt: 'illuminated manuscript, gold leaf gilding, ornate medieval style, precious metal, luxurious texture',
    negativePrompt: 'new shapes, additional symbols, text, modern, photography, people',
  },
  cosmic: {
    name: 'cosmic',
    method: 'lineart',
    category: 'organic',
    prompt: 'cosmic energy, nebula, starlight, glowing ethereal sigil in deep space, celestial magic',
    negativePrompt: 'new shapes, additional symbols, text, faces, planets, realistic, photography',
  },
  minimal_line: {
    name: 'minimal_line',
    method: 'canny',
    category: 'geometric',
    prompt: 'minimal line art, clean precise lines, modern minimalist, single color on white, graphic design',
    negativePrompt: 'new shapes, additional symbols, texture, shading, embellishment, ornate',
  },
};

/**
 * ControlNet models for structure-preserving enhancement
 */
const CONTROLNET_MODELS = {
  canny: 'jagilley/controlnet-canny:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613',
  lineart: 'jagilley/controlnet-lineart:aff48af9c68d162388d230a2ab003f68d2638d88307bdaf1c2f1ac95079c9613',
} as const;

/**
 * ControlNet configuration for structure preservation
 */
interface ControlNetConfig {
  conditioning_scale: number; // How strongly to follow the structure
  guidance_scale: number;     // How closely to follow the prompt
  num_inference_steps: number; // Quality vs speed
}

const CONTROLNET_CONFIG: ControlNetConfig = {
  conditioning_scale: 0.8, // Strong structure preservation
  guidance_scale: 7.5,     // Balanced prompt following
  num_inference_steps: 30, // Good quality in reasonable time
};

/**
 * Request for ControlNet-based enhancement
 */
export interface ControlNetEnhancementRequest {
  sigilSvg: string;         // Base or reinforced SVG structure
  styleChoice: AIStyle;     // Selected art style
  userId: string;           // For tracking
}

/**
 * Result from ControlNet enhancement
 */
export interface ControlNetEnhancementResult {
  variations: string[];     // Array of 4 image URLs
  prompt: string;           // Prompt used
  negativePrompt: string;   // Negative prompt used
  model: string;            // ControlNet model used
  controlMethod: 'canny' | 'lineart'; // Preprocessing method
  styleApplied: AIStyle;    // Style that was applied
  generationTime: number;   // Time in seconds
}

/**
 * Generate 4 AI-enhanced variations using ControlNet
 *
 * ControlNet preserves the structure of the sigil while applying artistic
 * style transfer. The SVG is first rasterized to a high-contrast PNG
 * (black background, white lines), then used as conditioning for SDXL.
 *
 * @param request - Enhancement request with SVG, style, and user ID
 * @returns Promise<ControlNetEnhancementResult>
 */
export async function enhanceSigilWithControlNet(
  request: ControlNetEnhancementRequest
): Promise<ControlNetEnhancementResult> {
  const startTime = Date.now();

  try {
    // Get style configuration
    const styleConfig = STYLE_CONFIGS[request.styleChoice];
    if (!styleConfig) {
      throw new Error(`Invalid style choice: ${request.styleChoice}`);
    }

    logger.info('[ControlNet Enhancement] Starting generation', {
      style: request.styleChoice,
      method: styleConfig.method,
    });

    // Check for mock mode
    const apiToken = process.env.REPLICATE_API_TOKEN;
    const isMockMode = !apiToken || apiToken === 'your-replicate-token';

    if (isMockMode) {
      logger.warn('[ControlNet Enhancement] Running in MOCK MODE (No valid API Token)');
      logger.debug('[ControlNet Enhancement] Style Config', { styleConfig });

      // Simulate generation delay (5 seconds for ControlNet)
      await new Promise(resolve => setTimeout(resolve, 5000));

      const variations = [
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-${request.styleChoice}-1&backgroundColor=1a1a1d&shape1Color=d4af37`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-${request.styleChoice}-2&backgroundColor=0f1419&shape1Color=cd7f32`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-${request.styleChoice}-3&backgroundColor=3e2c5b&shape1Color=f5f5dc`,
        `https://api.dicebear.com/7.x/shapes/png?seed=${request.userId}-${request.styleChoice}-4&backgroundColor=1a1a1d&shape1Color=c0c0c0`,
      ];

      return {
        variations,
        prompt: styleConfig.prompt,
        negativePrompt: styleConfig.negativePrompt,
        model: `mock-controlnet-${styleConfig.method}`,
        controlMethod: styleConfig.method,
        styleApplied: request.styleChoice,
        generationTime: 5,
      };
    }

    // Step 1: Rasterize SVG to high-contrast PNG for ControlNet
    logger.info('[ControlNet Enhancement] Rasterizing SVG');
    const rasterResult = await rasterizeSVG(request.sigilSvg, {
      width: 1024,
      height: 1024,
      backgroundColor: '#000000',
      strokeColor: '#FFFFFF',
      enhanceEdges: true,
    });

    logger.debug('[ControlNet Enhancement] Rasterization complete', {
      size: rasterResult.size,
      processingTimeMs: rasterResult.processingTimeMs,
    });

    // Step 2: Convert buffer to base64 data URL for Replicate
    const base64Image = rasterResult.buffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    // Step 3: Initialize Replicate client
    const replicate = getReplicateClient();

    // Step 4: Select appropriate ControlNet model
    const model = CONTROLNET_MODELS[styleConfig.method];

    logger.info('[ControlNet Enhancement] Generating variations', {
      model: styleConfig.method,
      style: request.styleChoice,
    });

    // Step 5: Generate 4 variations with different seeds
    const variations: string[] = [];

    for (let i = 0; i < 4; i++) {
      logger.info(`[ControlNet Enhancement] Generating variation ${i + 1}/4`);

      const output = await replicate.run(model, {
        input: {
          image: dataUrl,                             // Structure conditioning image
          prompt: styleConfig.prompt,                  // Style prompt
          negative_prompt: styleConfig.negativePrompt, // What to avoid
          num_outputs: 1,                              // One image per call
          width: 1024,
          height: 1024,
          conditioning_scale: CONTROLNET_CONFIG.conditioning_scale,
          guidance_scale: CONTROLNET_CONFIG.guidance_scale,
          num_inference_steps: CONTROLNET_CONFIG.num_inference_steps,
          seed: 2000 + i * 456, // Different seed per variation
        },
      });

      // Extract URL from output
      if (Array.isArray(output) && output.length > 0) {
        variations.push(output[0] as string);
      } else {
        throw new Error(`Failed to generate variation ${i + 1}`);
      }
    }

    const generationTime = Math.round((Date.now() - startTime) / 1000);

    logger.info('[ControlNet Enhancement] Complete', {
      variations: variations.length,
      generationTime,
      style: request.styleChoice,
    });

    return {
      variations,
      prompt: styleConfig.prompt,
      negativePrompt: styleConfig.negativePrompt,
      model,
      controlMethod: styleConfig.method,
      styleApplied: request.styleChoice,
      generationTime,
    };
  } catch (error) {
    logger.error('[ControlNet Enhancement] Error', error);
    throw new Error(
      `ControlNet enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Estimate generation time for ControlNet enhancement
 */
export function estimateControlNetGenerationTime(): { min: number; max: number } {
  // ControlNet typically takes 15-25 seconds per image
  // 4 variations = 60-100 seconds total
  return {
    min: 60,
    max: 100,
  };
}
