/**
 * Anchor App - AI Enhancement Service
 *
 * Generates AI-enhanced sigil artwork using Stable Diffusion XL via Replicate API.
 * Takes traditional sigil + selected symbols and creates 4 stunning variations.
 */

import Replicate from 'replicate';
import { AnalysisResult, getAestheticPrompt } from './IntentionAnalyzer';

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

  if (!apiToken) {
    throw new Error('REPLICATE_API_TOKEN environment variable not set');
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
    const replicate = getReplicateClient();

    // Build prompts
    const prompt = buildPrompt(request.analysis);
    const negativePrompt = buildNegativePrompt();

    console.log('[AI Enhancement] Starting generation...');
    console.log('[AI Enhancement] Prompt:', prompt);

    // Model: Stable Diffusion XL
    const model = 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

    // Generate 4 variations with different seeds
    const variations: string[] = [];

    for (let i = 0; i < 4; i++) {
      console.log(`[AI Enhancement] Generating variation ${i + 1}/4...`);

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

    console.log(`[AI Enhancement] Complete! Generated 4 variations in ${generationTime}s`);

    return {
      variations,
      prompt,
      negativePrompt,
      model,
      generationTime,
    };
  } catch (error) {
    console.error('[AI Enhancement] Error:', error);
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
