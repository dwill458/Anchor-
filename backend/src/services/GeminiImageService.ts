/**
 * Gemini Image Service - Integration with Google's GenAI SDK
 *
 * Uses Gemini 3.1 Flash (Nano Banana 2) for standard enhancements and
 * Gemini 3 Pro for regenerations / 4K downloads.
 */

import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import {
  buildStylePrompt,
  getStyleNegativePrompt,
  LITERAL_ANCHOR_EXCLUSION,
} from './stylePromptLibrary';

// Re-exporting interfaces for compatibility
export interface ImageVariation {
  base64: string;
  seed: number;
  variationIndex: number;
}

export type QualityTier = 'draft' | 'premium' | 'pro_upgrade';

export interface EnhancedSigilResult {
  images: ImageVariation[];
  totalTimeSeconds: number;
  costUSD: number;
  prompt: string;
  negativePrompt: string;
  model: string;
  tier: QualityTier;
}

interface ModelConfig {
  modelId: string;
  displayName: string;
  costPerImage: number;
  estimatedTimeSeconds: number;
  useNanoBanana?: boolean;
}

// Flash model: used for all standard enhancements (paid default)
// Pro model: reserved for regenerations (attempt 3+) and 4K downloads
const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.1-flash-image-preview';
const PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-image-preview';

const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: FLASH_MODEL,
    displayName: 'Gemini Flash (standard)',
    costPerImage: 0.005,
    estimatedTimeSeconds: 3,
    useNanoBanana: true,
  },
  premium: {
    modelId: FLASH_MODEL,
    displayName: 'Gemini Flash (standard)',
    costPerImage: 0.005,
    estimatedTimeSeconds: 3,
    useNanoBanana: true,
  },
  pro_upgrade: {
    modelId: PRO_MODEL,
    displayName: 'Gemini Pro (regeneration / 4K)',
    costPerImage: 0.04,
    estimatedTimeSeconds: 8,
    useNanoBanana: true,
  },
};

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
  private client: GoogleGenAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

    logger.info('[GeminiImageService] Initializing...', {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      apiKeyLength: this.apiKey.length,
    });

    if (!this.apiKey) {
      logger.warn('[GeminiImageService] No GEMINI_API_KEY or GOOGLE_API_KEY found in environment');
    }

    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  public getCostEstimate(numVariations: number = 2, tier: QualityTier = 'premium'): number {
    return numVariations * MODEL_CONFIGS[tier].costPerImage;
  }

  public getTimeEstimate(tier: QualityTier = 'premium'): { min: number; max: number } {
    const baseTime = MODEL_CONFIGS[tier].estimatedTimeSeconds;
    return {
      min: baseTime * 3,
      max: baseTime * 6,
    };
  }

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
        'GEMINI_API_KEY not configured.',
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

    // 2. Get model configuration
    const modelConfig = MODEL_CONFIGS[tier];
    const prompt = this.createPrompt(intentionText, styleApproach, 0);

    // 3. Generate variations in batches of 2 (paid plan — no free-tier rate limit concerns).
    //    Two concurrent calls per batch cuts wall-clock time roughly in half vs sequential.
    //    Each variation gets its own prompt with a distinct compositional stance so the
    //    outputs are guaranteed to diverge visually within the same style.
    const INTER_BATCH_DELAY_MS = 2500;
    const variations: ImageVariation[] = [];
    const BATCH_SIZE = 2;
    for (let i = 0; i < numberOfVariations; i += BATCH_SIZE) {
      const indices = Array.from(
        { length: Math.min(BATCH_SIZE, numberOfVariations - i) },
        (_, k) => i + k
      );
      const batch = await Promise.all(
        indices.map(idx =>
          this.generateVariation(
            baseImageBuffer,
            this.createPrompt(intentionText, styleApproach, idx),
            idx,
            modelConfig
          )
        )
      );
      variations.push(...batch);

      if (i + BATCH_SIZE < numberOfVariations) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

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
      negativePrompt: getStyleNegativePrompt(styleApproach),
      model: modelConfig.modelId,
      tier,
    };
  }

  private createPrompt(intention: string, style: string, variationIndex: number = 0): string {
    return buildStylePrompt(intention, style, variationIndex);
  }

  private async generateVariation(
    baseImageBuffer: Buffer,
    prompt: string,
    variationIndex: number,
    modelConfig: ModelConfig,
    retryCount: number = 0
  ): Promise<ImageVariation> {
    // Route to Nano Banana if configured
    if (modelConfig.useNanoBanana) {
      return this.generateVariationWithNanoBanana(
        baseImageBuffer,
        prompt,
        variationIndex,
        modelConfig,
        retryCount
      );
    }

    // Fallback to Imagen (legacy)
    const maxRetries = 3;

    try {
      logger.info(
        `[GeminiImageService] Generating variation ${variationIndex + 1} with ${modelConfig.modelId} (Imagen)`
      );

      const response = await this.client.models.generateImages({
        model: modelConfig.modelId,
        prompt: `${prompt}\n\nIMPORTANT: Preserve the exact geometric structure and lines of the supplied sigil design. Do not distort or warp the core shapes.\n\n${LITERAL_ANCHOR_EXCLUSION}`,
        config: {
          // numberOfImages: SDK accepts this at runtime; type def gap in some versions
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          numberOfImages: 1,
          aspectRatio: '1:1',
          includeRaiReason: true,
        },
      });

      const generatedImage = response.generatedImages?.[0];

      if (!generatedImage?.image?.imageBytes) {
        throw new GeminiError(
          GeminiErrorType.INVALID_IMAGE,
          'No image data returned from Imagen API',
          true
        );
      }

      const imageBytes = generatedImage.image.imageBytes;
      const base64Data =
        typeof imageBytes === 'string' ? imageBytes : Buffer.from(imageBytes).toString('base64');

      return {
        base64: base64Data,
        seed: Math.floor(Math.random() * 1000000),
        variationIndex: variationIndex + 1,
      };
    } catch (error: unknown) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateVariation(
          baseImageBuffer,
          prompt,
          variationIndex,
          modelConfig,
          retryCount + 1
        );
      }

      logger.error(
        `[GeminiImageService] Failed to generate variation ${variationIndex + 1}: ${geminiError.message}`
      );
      throw geminiError;
    }
  }

  private async generateVariationWithNanoBanana(
    baseImageBuffer: Buffer,
    prompt: string,
    variationIndex: number,
    modelConfig: ModelConfig,
    retryCount: number = 0
  ): Promise<ImageVariation> {
    const maxRetries = 3;

    try {
      logger.info(
        `[GeminiImageService] Generating variation ${variationIndex + 1} with Nano Banana (${modelConfig.modelId})`
      );

      const base64Image = baseImageBuffer.toString('base64');

      const CALL_TIMEOUT_MS = 60000; // 60s per individual API call
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new GeminiError(
                GeminiErrorType.NETWORK_ERROR,
                'Gemini API call timed out after 60s',
                true
              )
            ),
          CALL_TIMEOUT_MS
        )
      );

      const response = await Promise.race([
        this.client.models.generateContent({
          model: modelConfig.modelId,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${prompt}

REFERENCE IMAGE INSTRUCTION: The attached image shows the abstract sigil geometry that must be preserved. Keep the main lines, circles, and geometric shapes EXACTLY as shown. Add structural enhancements AROUND and BEHIND the sigil geometry, not by altering its core linework.

${LITERAL_ANCHOR_EXCLUSION}`,
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '1:1',
            },
          },
        }),
        timeoutPromise,
      ]);

      const imageData = response.candidates
        ?.flatMap(candidate => candidate.content?.parts ?? [])
        ?.find(part => typeof part.inlineData?.data === 'string')?.inlineData?.data;

      if (!imageData) {
        throw new GeminiError(
          GeminiErrorType.INVALID_IMAGE,
          'No image data in Nano Banana response',
          true
        );
      }

      return {
        base64: imageData,
        seed: Math.floor(Math.random() * 1000000),
        variationIndex: variationIndex + 1,
      };
    } catch (error: unknown) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateVariationWithNanoBanana(
          baseImageBuffer,
          prompt,
          variationIndex,
          modelConfig,
          retryCount + 1
        );
      }

      logger.error(
        `[GeminiImageService] Nano Banana failed for variation ${variationIndex + 1}: ${geminiError.message}`
      );
      throw geminiError;
    }
  }

  private parseError(error: unknown): GeminiError {
    const err = error as { message?: string; toString?: () => string };
    const message = err?.message || err?.toString?.() || 'Unknown error';

    if (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('429')
    ) {
      return new GeminiError(GeminiErrorType.RATE_LIMIT, 'Rate limit exceeded.', true, 5000);
    }
    if (message.includes('safety') || message.includes('blocked')) {
      return new GeminiError(
        GeminiErrorType.SAFETY_FILTER,
        'Content blocked by safety filter',
        false
      );
    }
    if (message.includes('API key') || message.includes('401') || message.includes('403')) {
      return new GeminiError(GeminiErrorType.INVALID_API_KEY, 'Invalid or missing API Key', false);
    }
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED')
    ) {
      return new GeminiError(GeminiErrorType.NETWORK_ERROR, 'Network error', true, 5000);
    }

    return new GeminiError(GeminiErrorType.UNKNOWN, message, false);
  }

  private async svgToPng(svgString: string): Promise<Buffer> {
    let styledSvg = svgString
      .replace(/stroke="[^"]*"/g, 'stroke="#D4AF37"')
      .replace(/fill="[^"]*"/g, 'fill="none"');

    if (!styledSvg.includes('viewBox')) {
      styledSvg = styledSvg.replace('<svg', '<svg viewBox="0 0 200 200"');
    }

    try {
      return await sharp(Buffer.from(styledSvg))
        .resize(1024, 1024, {
          fit: 'contain',
          background: '#0F1419',
        })
        .png()
        .toBuffer();
    } catch (error) {
      throw new GeminiError(GeminiErrorType.INVALID_IMAGE, 'Failed to convert SVG to PNG', false);
    }
  }
}
