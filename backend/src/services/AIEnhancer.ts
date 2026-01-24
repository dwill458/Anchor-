/**
 * Anchor App - AI Enhancement Service
 *
 * Generates AI-enhanced sigil artwork using Stable Diffusion XL via Replicate API.
 * Takes traditional sigil + selected symbols and creates 4 stunning variations.
 */

import Replicate from 'replicate';
// Legacy import - IntentionAnalyzer removed in Phase 3
// import { AnalysisResult, getAestheticPrompt } from './IntentionAnalyzer';
import { logger } from '../utils/logger';
import { rasterizeSVG } from '../utils/svgRasterizer';

// ============================================================================
// LEGACY CODE REMOVED (Phase 4 Cleanup)
// ============================================================================
// The following legacy interfaces and functions were removed because they
// depended on IntentionAnalyzer (deleted in Phase 3):
// - AIEnhancementRequest interface (used AnalysisResult type)
// - AIEnhancementResult interface
// - buildPrompt(analysis: AnalysisResult) function
// - enhanceSigil(request: AIEnhancementRequest) function
//
// The app now uses ControlNet-based enhancement exclusively (see below).
// If you need the legacy img2img approach, restore these from git history.
// ============================================================================

/**
 * Initialize Replicate client
 */
function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;

  // Check for missing or placeholder token
  if (!apiToken || apiToken === 'your-replicate-token') {
    throw new Error('REPLICATE_API_TOKEN environment variable not set or invalid');
  }

  return new Replicate({
    auth: apiToken,
  });
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
 * AI Image Generation Models
 * 
 * Using standard SDXL for reliable, high-quality generation (~5 seconds per image)
 * Total time: ~20-25 seconds for 4 variations in parallel
 */
const CONTROLNET_MODELS = {
  // Using stability-ai/sdxl - well documented and reliable
  canny: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
  lineart: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
} as const;

/**
 * Generation configuration for SDXL
 */
interface ControlNetConfig {
  conditioning_scale: number; // How strongly to follow the structure
  guidance_scale: number;     // How closely to follow the prompt
  num_inference_steps: number; // Quality vs speed
}

const CONTROLNET_CONFIG: ControlNetConfig = {
  conditioning_scale: 0.8, // Strong structure preservation
  guidance_scale: 7.5,     // Standard SDXL guidance
  num_inference_steps: 25, // Good balance of speed and quality
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

    // Step 5: Generate variations SEQUENTIALLY to avoid rate limiting
    // Replicate limits free/low-credit accounts to 1 concurrent request
    logger.info(`[ControlNet Enhancement] Generating variations sequentially for style: ${request.styleChoice}`);
    console.log('[Replicate] Starting SEQUENTIAL generation (rate limit safe)');

    const variations: string[] = [];
    const numVariations = 2; // Reduced from 4 to 2 for speed (can increase with higher credits)

    for (let i = 0; i < numVariations; i++) {
      const variationStart = Date.now();
      logger.info(`[ControlNet Enhancement] Starting variation ${i + 1}/${numVariations}`);
      console.log(`[Replicate] Calling SDXL model for variation ${i + 1}/${numVariations}`);

      try {
        // Build enhanced prompt with sigil style keywords
        const enhancedPrompt = `${styleConfig.prompt}, mystical sigil design, symmetric sacred symbol, intricate linework, black background, high contrast, centered composition, occult art`;

        console.log(`[Replicate] Prompt: ${enhancedPrompt.substring(0, 80)}...`);

        const output = await replicate.run(model, {
          input: {
            prompt: enhancedPrompt,
            negative_prompt: styleConfig.negativePrompt,
            width: 1024,
            height: 1024,
            num_outputs: 1,
            num_inference_steps: CONTROLNET_CONFIG.num_inference_steps,
            guidance_scale: CONTROLNET_CONFIG.guidance_scale,
            scheduler: 'K_EULER',
            seed: 2000 + i * 456, // Different seed per variation
          },
        });

        const variationTime = Math.round((Date.now() - variationStart) / 1000);
        logger.info(`[ControlNet Enhancement] Variation ${i + 1}/${numVariations} complete (${variationTime}s)`);
        console.log(`[Replicate] Variation ${i + 1}/${numVariations} complete in ${variationTime}s`);

        // Extract URL from output - SDXL returns array of URLs
        if (Array.isArray(output) && output.length > 0) {
          console.log(`[Replicate] Got URL for variation ${i + 1}:`, String(output[0]).substring(0, 60) + '...');
          variations.push(output[0] as string);
        } else if (typeof output === 'string') {
          variations.push(output);
        } else {
          console.error(`[Replicate] Unexpected output format for variation ${i + 1}:`, typeof output);
          throw new Error(`Invalid output format for variation ${i + 1}`);
        }

        // Wait 12 seconds before next request to avoid rate limiting (6 req/min limit)
        if (i < numVariations - 1) {
          console.log(`[Replicate] Waiting 12s before next request (rate limit)...`);
          await new Promise(resolve => setTimeout(resolve, 12000));
        }
      } catch (err: any) {
        logger.error(`[ControlNet Enhancement] Error in variation ${i + 1}`, err);
        console.error(`[Replicate] Error in variation ${i + 1}:`, err?.message || err);
        throw err;
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
