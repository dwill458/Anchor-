/**
 * Gemini Image Provider Adapter
 *
 * Implements Google Gemini (Nano Banana 2 & Nano Banana Pro) native image generation
 * behind the unified ImageProviderAdapter interface.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../../utils/logger';
import { resolveGoogleApiKey } from '../../../config/env';
import {
  GenerateImageRequest,
  GeneratedImageVariation,
  ImageProviderAdapter,
  ImageProviderError,
  ImageProviderErrorType,
} from '../types';

export class GeminiImageProviderAdapter implements ImageProviderAdapter {
  readonly name = 'gemini' as const;
  private client: GoogleGenAI | null = null;
  private apiKey: string = '';

  constructor() {
    this.refreshClient();
  }

  private refreshClient(): void {
    this.apiKey = resolveGoogleApiKey() || '';
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    } else {
      this.client = null;
    }
  }

  isAvailable(): boolean {
    const key = resolveGoogleApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  private getClient(): GoogleGenAI {
    if (!this.isAvailable()) {
      throw new ImageProviderError(
        this.name,
        ImageProviderErrorType.AUTHENTICATION,
        'Google/Gemini API key is missing or not configured',
        false,
        401
      );
    }
    if (!this.client || this.apiKey !== resolveGoogleApiKey()) {
      this.refreshClient();
    }
    return this.client!;
  }

  private resolveModel(request: GenerateImageRequest): {
    modelId: string;
    costPerImage: number;
  } {
    if (request.type === 'vision') {
      const modelId =
        process.env.GEMINI_VISION_MODEL ||
        process.env.GEMINI_VISION_IMAGE_MODEL ||
        'gemini-3.1-flash-image';
      return { modelId, costPerImage: 0.005 };
    }

    // Anchor artwork: Pro model reserved for regeneration (pro_upgrade), Flash for draft/premium
    const isPro = request.quality === 'pro_upgrade' || (request.generationAttempt ?? 1) >= 2;
    if (isPro) {
      const modelId =
        process.env.GEMINI_ANCHOR_PREMIUM_MODEL ||
        process.env.GEMINI_PRO_MODEL ||
        'gemini-3-pro-image-preview';
      return { modelId, costPerImage: 0.04 };
    }

    const modelId =
      process.env.GEMINI_ANCHOR_MODEL ||
      process.env.GEMINI_FLASH_MODEL ||
      'gemini-3.1-flash-image-preview';
    return { modelId, costPerImage: 0.005 };
  }

  async generate(
    request: GenerateImageRequest,
    attemptNumber: number
  ): Promise<{
    images: GeneratedImageVariation[];
    model: string;
    estimatedCost: number;
  }> {
    const client = this.getClient();
    const { modelId, costPerImage } = this.resolveModel(request);
    const numberOfVariations = Math.max(1, request.numberOfVariations ?? 1);
    const timeoutMs = request.type === 'vision' ? 90000 : 60000;

    logger.info(
      `[GeminiImageProviderAdapter] Generating ${numberOfVariations} image(s) with ${modelId}`,
      {
        purpose: request.type,
        quality: request.quality,
        attemptNumber,
        generationRequestId: request.generationRequestId,
      }
    );

    const variations: GeneratedImageVariation[] = [];

    // For Anchor artwork with >1 variations, execute sequentially or in parallel batches
    for (let i = 0; i < numberOfVariations; i++) {
      const variationPrompt = request.prompt;
      const variationIndex = i + 1;

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

        // Build prompt instruction with reference image context if provided
        if (request.type === 'anchor') {
          const refImg = request.referenceImages?.[0];
          if (refImg) {
            parts.push({
              text: `${variationPrompt}\n\nREFERENCE IMAGE INSTRUCTION: The attached image contains the exact Anchor structure that must be preserved. Keep all main lines, circles, intersections, angles, nodes, and geometric relationships exactly as shown. Build the selected visual world around this immutable structure. Enhancements may appear around it, behind it, beneath it, within the surrounding material field, through framing, atmosphere, lighting, surface treatment, and peripheral composition, but never by altering the Anchor geometry.`,
            });
            parts.push({
              inlineData: {
                mimeType: refImg.mimeType || 'image/png',
                data: refImg.buffer.toString('base64'),
              },
            });
          } else {
            parts.push({ text: variationPrompt });
          }
        } else {
          // Vision imagery
          const refImg = request.referenceImages?.[0];
          if (refImg) {
            parts.push({
              text: `${variationPrompt}\n\nThe attached image is an optional approved appearance reference. Use it only when the person is visibly represented; preserve broad likeness without naming or inferring demographic attributes. Do not force a face into the composition.`,
            });
            parts.push({
              inlineData: {
                mimeType: refImg.mimeType || 'image/jpeg',
                data: refImg.buffer.toString('base64'),
              },
            });
          } else {
            parts.push({
              text: `${variationPrompt}\n\nNo appearance reference was supplied. Do not imply an invented protagonist is the user; prefer first-person, identity-neutral, obscured, or environmental composition when a person would otherwise be central.`,
            });
          }
        }

        const aspectRatio = request.aspectRatio || (request.type === 'vision' ? '9:16' : '1:1');

        const response = await client.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio },
            abortSignal: controller.signal,
          },
        });

        const imageData = response.candidates
          ?.flatMap(c => c.content?.parts ?? [])
          ?.find(p => typeof p.inlineData?.data === 'string')?.inlineData?.data;

        if (!imageData) {
          throw new ImageProviderError(
            this.name,
            ImageProviderErrorType.INVALID_RESPONSE,
            'No image data in Gemini response',
            true
          );
        }

        const buffer = Buffer.from(imageData, 'base64');
        variations.push({
          buffer,
          base64: imageData,
          mimeType: 'image/png',
          seed: Math.floor(Math.random() * 1000000),
          variationIndex,
        });
      } catch (err) {
        throw this.translateError(err);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    return {
      images: variations,
      model: modelId,
      estimatedCost: variations.length * costPerImage,
    };
  }

  private translateError(error: unknown): ImageProviderError {
    if (error instanceof ImageProviderError) return error;

    const message = error instanceof Error ? error.message : String(error);
    const errorString = String(error);

    if (
      error instanceof Error &&
      (error.name === 'AbortError' || message.includes('abort') || message.includes('timeout'))
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.TIMEOUT,
        'Gemini API call timed out',
        true
      );
    }

    if (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      errorString.includes('RESOURCE_EXHAUSTED')
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.RATE_LIMIT,
        `Gemini rate limit or quota exceeded: ${message}`,
        true,
        429,
        5000
      );
    }

    if (
      message.includes('safety') ||
      message.includes('blocked') ||
      message.includes('SAFETY') ||
      errorString.includes('HARM_CATEGORY')
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.SAFETY_FILTER,
        `Content blocked by Gemini safety filter: ${message}`,
        false,
        400
      );
    }

    if (
      message.includes('API key') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('PERMISSION_DENIED')
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.AUTHENTICATION,
        `Invalid or unauthorized Gemini API key: ${message}`,
        false,
        401
      );
    }

    if (
      message.includes('network') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed')
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.NETWORK_ERROR,
        `Gemini network communication error: ${message}`,
        true,
        503
      );
    }

    if (message.includes('500') || message.includes('503') || errorString.includes('INTERNAL')) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.SERVER_ERROR,
        `Gemini server error: ${message}`,
        true,
        500
      );
    }

    return new ImageProviderError(
      this.name,
      ImageProviderErrorType.UNKNOWN,
      `Gemini generation error: ${message}`,
      true
    );
  }
}
