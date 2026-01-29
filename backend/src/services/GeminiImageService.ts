/**
 * Gemini 3 Pro Image Service - Nano Banana Pro Integration
 *
 * High-fidelity structural preservation for Anchor sigils using Gemini 3 Pro Image.
 * Replaces Imagen 3/Replicate with production-ready google-genai SDK.
 *
 * Key Features:
 * - Tiered scaling: Draft (gemini-3-flash-preview) vs Premium (gemini-3-pro-image-preview)
 * - Multimodal request: Image + text prompt in contents
 * - System instruction: Strict structural preservation
 * - Error handling: Rate limits, safety filters, network errors
 */

import { GoogleGenerativeAI } from 'google-genai';
import sharp from 'sharp';
import { logger } from '../utils/logger';

// Re-exporting interfaces for compatibility
export interface ImageVariation {
  base64: string;
  seed: number;
  variationIndex: number;
}

export interface EnhancedSigilResult {
  images: ImageVariation[];
  totalTimeSeconds: number;
  costUSD: number;
  prompt: string;
  negativePrompt: string;
  model: string;
  tier: 'draft' | 'premium';
}

/**
 * Quality tier for image generation
 */
export type QualityTier = 'draft' | 'premium';

/**
 * Model configuration for each tier
 */
interface ModelConfig {
  modelId: string;
  displayName: string;
  costPerImage: number;
  estimatedTimeSeconds: number;
}

const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: 'gemini-3-flash-preview',
    displayName: 'Gemini 3 Flash (Draft)',
    costPerImage: 0.005,
    estimatedTimeSeconds: 3,
  },
  premium: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Golden)',
    costPerImage: 0.02,
    estimatedTimeSeconds: 8,
  },
};

/**
 * System instruction for structural preservation
 * This is the core USP - preserving exact geometry while applying textures
 */
const STRUCTURAL_PRESERVATION_SYSTEM_INSTRUCTION = `You are a high-fidelity rendering engine. Your primary directive is to preserve the exact structural integrity of input images.

CRITICAL RULES:
1. Treat the input image as a strict structural anchor
2. Do NOT warp, melt, bend, or alter the core lines and geometry of the sigil
3. Do NOT add new geometric elements or decorative patterns to the structure itself
4. Apply materials, lighting, and environmental textures ONLY to the existing geometry
5. The silhouette and edge structure must remain pixel-perfect to the original
6. Think of yourself as applying a texture shader to a 3D model - the mesh stays the same, only the material changes

WHAT YOU CAN DO:
- Apply artistic materials (gold leaf, watercolor, ink, cosmic glow, etc.)
- Add lighting effects (glow, shine, shadows, highlights)
- Change colors and surface textures
- Add atmospheric effects in the BACKGROUND (mist, nebulae, particles)
- Enhance line quality (smooth, crisp, artistic stroke texture)

WHAT YOU CANNOT DO:
- Alter the shape or position of lines
- Add extra lines, symbols, or geometric elements to the sigil
- Bend, distort, or transform the structure
- Replace the sigil with a completely different design
- Add decorative borders, frames, or mandalas around the sigil

Remember: You are enhancing the APPEARANCE of the sigil, not redesigning it. The user's hand-drawn geometry is sacred and must be preserved exactly.`;

/**
 * Error types for better error handling
 */
export enum GeminiErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  SAFETY_FILTER = 'SAFETY_FILTER',
  INVALID_API_KEY = 'INVALID_API_KEY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_IMAGE = 'INVALID_IMAGE',
  UNKNOWN = 'UNKNOWN',
}

export class GeminiError extends Error {
  constructor(
    public type: GeminiErrorType,
    message: string,
    public retryable: boolean = false,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export class GeminiImageService {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';

    if (!this.apiKey) {
      logger.warn('[GeminiImageService] No GEMINI_API_KEY found in environment');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  /**
   * Check if service is configured
   */
  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  /**
   * Get cost estimate for number of variations
   */
  public getCostEstimate(numVariations: number = 4, tier: QualityTier = 'premium'): number {
    return numVariations * MODEL_CONFIGS[tier].costPerImage;
  }

  /**
   * Get time estimate for generation
   */
  public getTimeEstimate(tier: QualityTier = 'premium'): { min: number; max: number } {
    const baseTime = MODEL_CONFIGS[tier].estimatedTimeSeconds;
    return {
      min: baseTime * 3, // 3 variations minimum (parallel)
      max: baseTime * 5, // Allow for some variance
    };
  }

  /**
   * Main enhancement method - generate AI-enhanced sigil variations
   */
  async enhanceSigil(params: {
    baseSigilSvg: string;
    intentionText: string;
    styleApproach: string;
    numberOfVariations: number;
    tier?: QualityTier;
  }): Promise<EnhancedSigilResult> {
    const {
      baseSigilSvg,
      intentionText,
      styleApproach,
      numberOfVariations,
      tier = 'premium',
    } = params;

    if (!this.isAvailable()) {
      throw new GeminiError(
        GeminiErrorType.INVALID_API_KEY,
        'GEMINI_API_KEY not configured. Please set the environment variable.',
        false
      );
    }

    logger.info(`[GeminiImageService] Generating ${numberOfVariations} variations`, {
      intention: intentionText,
      style: styleApproach,
      tier,
    });

    const startTime = Date.now();

    // 1. Convert SVG to PNG
    const baseImageBuffer = await this.svgToPng(baseSigilSvg);

    // 2. Create intention-aware prompt
    const prompt = this.createPrompt(intentionText, styleApproach);

    // 3. Get model configuration
    const modelConfig = MODEL_CONFIGS[tier];

    // 4. Generate all variations in parallel
    const variations = await Promise.all(
      Array.from({ length: numberOfVariations }, (_, i) =>
        this.generateVariation(baseImageBuffer, prompt, i, modelConfig)
      )
    );

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    logger.info(`[GeminiImageService] Successfully generated ${variations.length} variations`, {
      totalTime,
      tier,
    });

    return {
      images: variations,
      totalTimeSeconds: totalTime,
      costUSD: this.getCostEstimate(numberOfVariations, tier),
      prompt: prompt,
      negativePrompt: 'text, watermark, blurry, low quality, distorted geometry, altered structure',
      model: modelConfig.modelId,
      tier,
    };
  }

  /**
   * Create intention and style-aware prompt
   */
  private createPrompt(intention: string, style: string): string {
    const styleTemplates: Record<string, string> = {
      watercolor: `Transform this sigil into a mystical watercolor artwork representing: "${intention}"

Style: Watercolor painting with flowing organic washes, soft bleeding edges, layered transparent colors, and textured paper appearance. Rich saturated colors that blend naturally.

Symbolic Enhancement: Based on the intention "${intention}", add relevant symbolic imagery around the sigil:
- Fitness/gym: weights, flames, lightning bolts, muscle motifs
- Health: heartbeat patterns, healing light, herbal imagery
- Career/success: ascending paths, crowns, mountains, achievement symbols
- Love: hearts, roses, intertwined elements, infinity symbols
- Spiritual: sacred geometry, cosmic elements, meditation symbols
- Creativity: flowing ink, artistic tools, color bursts
- Wealth: coins, gold, abundance imagery
- Peace: water ripples, doves, zen elements

Important: Keep the core sigil structure EXACTLY as drawn. Only apply watercolor texture and add symbolic elements in the background or around the edges. Dark background (black or deep charcoal), golden geometric structure preserved.`,

      ink_brush: `Transform this sigil into traditional ink brush artwork representing: "${intention}"

Style: Sumi-e aesthetic with bold expressive black ink strokes, calligraphic line quality, and Japanese Zen minimalism. Negative space is as important as positive space.

Add subtle symbolic elements based on "${intention}" using ink brush technique. Keep the core sigil geometry untouched - only apply ink texture and add background elements.`,

      sacred_geometry: `Transform this sigil into sacred geometry artwork representing: "${intention}"

Style: Mathematical precision meets spiritual symbolism. Golden ratio proportions, Metatron's Cube patterns, Flower of Life elements, precise geometric mysticism.

Enhance with geometric symbols related to "${intention}". Preserve the exact structure of the sigil - only add geometric patterns in background or as texture overlay.`,

      gold_leaf: `Transform this sigil into illuminated manuscript artwork representing: "${intention}"

Style: Medieval gold leaf gilding with metallic sheen, ornate borders, baroque ornamentation, and luxurious hand-illuminated aesthetic.

Add symbolic elements based on "${intention}" in illuminated manuscript style. The sigil structure must remain exact - only apply gold texture and decorative background elements.`,

      cosmic: `Transform this sigil into cosmic space artwork representing: "${intention}"

Style: Deep space nebulae with purples, blues, and teals. Glowing stars, ethereal energy wisps, aurora effects, and dimensional portal aesthetics.

Add cosmic symbols related to "${intention}". Keep the sigil geometry pixel-perfect - only add cosmic glow, space background, and atmospheric effects.`,

      minimal_line: `Transform this sigil into minimalist line art representing: "${intention}"

Style: Clean contemporary minimalism with elegant single-weight lines, thoughtful negative space, and modern luxury branding aesthetic.

Add one or two minimal symbolic touches based on "${intention}". Preserve the exact sigil structure - only refine line quality and add subtle symbolic elements.`,
    };

    return styleTemplates[style] || styleTemplates.watercolor;
  }

  /**
   * Generate a single variation using Gemini 3
   */
  private async generateVariation(
    baseImageBuffer: Buffer,
    prompt: string,
    variationIndex: number,
    modelConfig: ModelConfig,
    retryCount: number = 0
  ): Promise<ImageVariation> {
    const maxRetries = 3;

    try {
      // Get the generative model with system instruction
      const model = this.genAI.getGenerativeModel({
        model: modelConfig.modelId,
        systemInstruction: STRUCTURAL_PRESERVATION_SYSTEM_INSTRUCTION,
      });

      // Build multimodal request: image + text prompt
      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: baseImageBuffer.toString('base64'),
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.9, // High creativity for unique variations
          topK: 40,
          topP: 0.95,
          candidateCount: 1,
        },
      };

      logger.debug(`[GeminiImageService] Generating variation ${variationIndex + 1}`, {
        model: modelConfig.modelId,
      });

      const result = await model.generateContent(request);
      const response = result.response;

      // Check for safety filter blocks
      if (response.promptFeedback?.blockReason) {
        throw new GeminiError(
          GeminiErrorType.SAFETY_FILTER,
          `Content blocked by safety filter: ${response.promptFeedback.blockReason}`,
          false
        );
      }

      // Extract image data
      const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!imageData) {
        throw new GeminiError(
          GeminiErrorType.INVALID_IMAGE,
          'No image data returned from Gemini API',
          true
        );
      }

      return {
        base64: imageData,
        seed: variationIndex * 1000 + Date.now() % 1000,
        variationIndex: variationIndex + 1,
      };
    } catch (error: any) {
      // Parse error and determine if retryable
      const geminiError = this.parseError(error);

      // Retry logic for retryable errors
      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        logger.warn(
          `[GeminiImageService] Retrying variation ${variationIndex + 1} after ${waitTime}ms`,
          {
            attempt: retryCount + 1,
            maxRetries,
            errorType: geminiError.type,
          }
        );

        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.generateVariation(baseImageBuffer, prompt, variationIndex, modelConfig, retryCount + 1);
      }

      // Log and throw
      logger.error(`[GeminiImageService] Failed to generate variation ${variationIndex + 1}`, {
        errorType: geminiError.type,
        message: geminiError.message,
        retryCount,
      });

      throw geminiError;
    }
  }

  /**
   * Parse API errors into structured GeminiError
   */
  private parseError(error: any): GeminiError {
    const message = error?.message || error?.toString() || 'Unknown error';

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('quota exceeded')) {
      const retryAfter = this.extractRetryAfter(error);
      return new GeminiError(
        GeminiErrorType.RATE_LIMIT,
        'Rate limit exceeded. Please try again later.',
        true,
        retryAfter
      );
    }

    // Safety filter errors
    if (message.includes('safety') || message.includes('blocked')) {
      return new GeminiError(
        GeminiErrorType.SAFETY_FILTER,
        'Content blocked by safety filter',
        false
      );
    }

    // Authentication errors
    if (message.includes('API key') || message.includes('authentication') || message.includes('401')) {
      return new GeminiError(
        GeminiErrorType.INVALID_API_KEY,
        'Invalid or missing GEMINI_API_KEY',
        false
      );
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT')
    ) {
      return new GeminiError(
        GeminiErrorType.NETWORK_ERROR,
        'Network error communicating with Gemini API',
        true,
        5000
      );
    }

    // Default unknown error
    return new GeminiError(GeminiErrorType.UNKNOWN, message, false);
  }

  /**
   * Extract retry-after time from error response
   */
  private extractRetryAfter(error: any): number {
    // Check for Retry-After header (in seconds)
    const retryAfterHeader = error?.response?.headers?.['retry-after'];
    if (retryAfterHeader) {
      return parseInt(retryAfterHeader, 10) * 1000;
    }

    // Default exponential backoff: 5 seconds
    return 5000;
  }

  /**
   * Convert SVG to PNG with golden styling on dark background
   */
  private async svgToPng(svgString: string): Promise<Buffer> {
    // Apply golden color (#D4AF37) to strokes, dark navy background
    let styledSvg = svgString
      .replace(/stroke="[^"]*"/g, 'stroke="#D4AF37"')
      .replace(/fill="[^"]*"/g, 'fill="none"');

    // Ensure viewBox exists
    if (!styledSvg.includes('viewBox')) {
      styledSvg = styledSvg.replace('<svg', '<svg viewBox="0 0 200 200"');
    }

    try {
      return await sharp(Buffer.from(styledSvg))
        .resize(1024, 1024, {
          fit: 'contain',
          background: '#0F1419', // Dark navy background
        })
        .png()
        .toBuffer();
    } catch (error) {
      logger.error('[GeminiImageService] SVG to PNG conversion failed', error);
      throw new GeminiError(
        GeminiErrorType.INVALID_IMAGE,
        'Failed to convert SVG to PNG',
        false
      );
    }
  }
}
