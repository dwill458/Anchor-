/**
 * OpenAI Image Provider Adapter
 *
 * Implements OpenAI Image generation (GPT-Image series, e.g. gpt-image-2.5-flare / sunburst)
 * behind the unified ImageProviderAdapter interface.
 *
 * Designed for both first-class Vision generation (portrait-first composition)
 * and redundant Anchor artwork generation.
 */

import { logger } from '../../../utils/logger';
import {
  GenerateImageRequest,
  GeneratedImageVariation,
  ImageProviderAdapter,
  ImageProviderError,
  ImageProviderErrorType,
} from '../types';
import { orderVisionReferences, visionReferenceInstructions } from '../visionReferences';
import { buildReferenceImageWrapper } from '../../referenceImageWrappers';

export class OpenAIImageProviderAdapter implements ImageProviderAdapter {
  readonly name = 'openai' as const;
  private readonly baseUrl: string;

  constructor(baseUrl: string = 'https://api.openai.com/v1') {
    this.baseUrl = baseUrl;
  }

  isAvailable(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  private getApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY?.trim() || undefined;
  }

  private resolveModel(request: GenerateImageRequest): {
    model: string;
    estimatedCostPerImage: number;
  } {
    if (request.devImageModel) {
      return { model: request.devImageModel, estimatedCostPerImage: request.devImageModel.includes('sunburst') ? 0.04 : 0.02 };
    }
    if (request.type === 'vision') {
      // "Make it look like you": Sunburst is OpenAI's reference-preserving model.
      const hasAppearance = (request.referenceImages ?? []).some(reference => reference.role === 'appearance');
      if (hasAppearance) {
        const model = process.env.OPENAI_VISION_REFERENCE_MODEL?.trim() || 'gpt-image-2.5-sunburst';
        return { model, estimatedCostPerImage: 0.04 }; // TODO(pricing): confirm 2.5 per-image cost
      }
      const model =
        process.env.OPENAI_VISION_MODEL?.trim() ||
        process.env.OPENAI_IMAGE_MODEL?.trim() ||
        'gpt-image-2.5-flare';
      return { model, estimatedCostPerImage: 0.02 };
    }

    const isPro = request.quality === 'pro_upgrade' || (request.generationAttempt ?? 1) >= 2;
    const model = isPro
      ? process.env.OPENAI_ANCHOR_PREMIUM_MODEL?.trim() ||
        process.env.OPENAI_ANCHOR_MODEL?.trim() ||
        'gpt-image-2.5-sunburst'
      : process.env.OPENAI_ANCHOR_MODEL?.trim() ||
        process.env.OPENAI_IMAGE_MODEL?.trim() ||
        'gpt-image-2.5-flare';

    return { model, estimatedCostPerImage: isPro ? 0.04 : 0.02 };
  }

  private resolveSize(request: GenerateImageRequest): string {
    if (request.width && request.height) {
      return `${request.width}x${request.height}`;
    }
    if (request.type === 'vision' || request.aspectRatio === '9:16') {
      // GPT-Image 2.5 takes arbitrary WxH (both divisible by 16, ratio within 1:3..3:1).
      // 1152x2048 is exact 9:16 for the 1080x1920 Vision frame. 1024x1792 was a DALL-E 3 size.
      return process.env.OPENAI_VISION_SIZE?.trim() || '1152x2048';
    }
    return '1024x1024';
  }

  async generate(
    request: GenerateImageRequest,
    attemptNumber: number
  ): Promise<{
    images: GeneratedImageVariation[];
    model: string;
    estimatedCost: number;
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ImageProviderError(
        this.name,
        ImageProviderErrorType.AUTHENTICATION,
        'OPENAI_API_KEY is missing or not configured',
        false,
        401
      );
    }

    const { model, estimatedCostPerImage } = this.resolveModel(request);
    const size = this.resolveSize(request);
    const numberOfVariations = Math.max(1, request.numberOfVariations ?? 1);
    const timeoutMs = request.type === 'vision' ? 90000 : 60000;

    logger.info(
      `[OpenAIImageProviderAdapter] Generating ${numberOfVariations} image(s) with ${model}`,
      {
        purpose: request.type,
        quality: request.quality,
        size,
        attemptNumber,
        generationRequestId: request.generationRequestId,
      }
    );

    const variations: GeneratedImageVariation[] = [];

    for (let i = 0; i < numberOfVariations; i++) {
      const variationIndex = i + 1;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let enhancedPrompt = request.prompt;

        // Anchor artwork: enforce structural preservation in prompt for OpenAI
        if (request.type === 'anchor') {
          // Version-aware: legacy keeps its centered-emblem wrapper, Anchor 2.0 gets the edge-to-edge one.
          enhancedPrompt = buildReferenceImageWrapper('openAi', request.prompt, request.styleId);
        } else {
          // Vision imagery: enforce mobile portrait safe area and anti-stock rules
          enhancedPrompt = `${request.prompt}\n\nCOMPOSITION & AUTHENTICITY REQUIREMENTS:
- Composed vertically as a natural portrait photograph for a mobile phone screen.
- Main subject (person, hands, or focal object) MUST remain comfortably within the central safe area (middle 70% horizontally, between 30% and 70% of height).
- Keep breathing room at top and bottom so standard mobile crops remain natural.
- Avoid placing key faces or hands against outer edges.
- NO readable text, NO numbers, NO watermarks, NO user interface elements, NO inspirational quotes, NO corporate stock-photo look.
- Believable, emotionally resonant editorial documentary aesthetic with natural lighting and lived-in environment.`;
        }

        // No response_format: GPT-Image models reject it and always return b64_json.
        // Both Anchor geometry and Vision photographs must reach the edits endpoint.
        // Text-to-image cannot preserve a sigil it has never seen.
        const references = request.type === 'vision'
          ? orderVisionReferences(request.referenceImages)
          : request.referenceImages ?? [];
        const referenceInstructions = request.type === 'vision'
          ? visionReferenceInstructions(references)
          : 'Image 1 is the exact Anchor geometry to preserve, not inspiration for a new symbol. Keep every stroke, endpoint, angle and intersection in the same relationship. Do not replace it with a literal anchor icon, add circles or nodes, or make it symmetrical. Change only its surface treatment and the surrounding style material field. The reference stroke colour and empty background are a diagram, not the final palette.';
        let response: Response;
        if (references.length > 0) {
          const form = new FormData();
          form.append('model', model);
          form.append(
            'prompt',
            `${enhancedPrompt}\n\n${referenceInstructions}`
          );
          form.append('size', size);
          form.append('n', '1');
          references.forEach((reference, index) => {
            const type = reference.mimeType || (request.type === 'anchor' ? 'image/png' : 'image/jpeg');
            const extension = type.split('/')[1] || 'jpg';
            form.append(
              'image[]',
              new Blob([new Uint8Array(reference.buffer)], { type }),
              `reference-${index + 1}.${extension}`
            );
          });
          response = await fetch(`${this.baseUrl}/images/edits`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: controller.signal,
          });
        } else {
          response = await fetch(`${this.baseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, prompt: enhancedPrompt, size, n: 1 }),
            signal: controller.signal,
          });
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw this.classifyHttpError(response.status, errorBody);
        }

        const data = (await response.json()) as {
          data?: Array<{ b64_json?: string; url?: string }>;
        };

        const firstImage = data.data?.[0];
        if (!firstImage?.b64_json) {
          // If URL was returned instead (legacy or fallback), download the buffer
          if (firstImage?.url) {
            const imgRes = await fetch(firstImage.url, { signal: controller.signal });
            if (!imgRes.ok) {
              throw new ImageProviderError(
                this.name,
                ImageProviderErrorType.INVALID_RESPONSE,
                'Failed to fetch image URL from OpenAI response',
                true
              );
            }
            const arrayBuffer = await imgRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            variations.push({
              buffer,
              base64: buffer.toString('base64'),
              mimeType: 'image/png',
              seed: Math.floor(Math.random() * 1000000),
              variationIndex,
            });
            continue;
          }

          throw new ImageProviderError(
            this.name,
            ImageProviderErrorType.INVALID_RESPONSE,
            'No image data returned in OpenAI response',
            true
          );
        }

        const buffer = Buffer.from(firstImage.b64_json, 'base64');
        variations.push({
          buffer,
          base64: firstImage.b64_json,
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
      model,
      estimatedCost: variations.length * estimatedCostPerImage,
    };
  }

  private classifyHttpError(status: number, body: unknown): ImageProviderError {
    const errorObj = (body as { error?: { message?: string; type?: string; code?: string } })
      ?.error;
    const message = errorObj?.message || `HTTP ${status}`;
    const code = errorObj?.code || '';
    const type = errorObj?.type || '';

    if (status === 401 || status === 403) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.AUTHENTICATION,
        `Authentication failed: ${message}`,
        false,
        status
      );
    }

    if (status === 429) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.RATE_LIMIT,
        `Rate limit or quota exceeded: ${message}`,
        true,
        429,
        5000
      );
    }

    if (
      status === 400 &&
      (code.includes('safety') ||
        code.includes('policy') ||
        type.includes('safety') ||
        message.toLowerCase().includes('safety') ||
        message.toLowerCase().includes('policy') ||
        message.toLowerCase().includes('content filter'))
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.SAFETY_FILTER,
        `Content blocked by OpenAI safety filter: ${message}`,
        false,
        400
      );
    }

    if (status === 400) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.INVALID_REQUEST,
        `Bad request: ${message}`,
        false,
        400
      );
    }

    if (status >= 500) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.SERVER_ERROR,
        `OpenAI server error (${status}): ${message}`,
        true,
        status
      );
    }

    return new ImageProviderError(
      this.name,
      ImageProviderErrorType.UNKNOWN,
      `OpenAI error (${status}): ${message}`,
      true,
      status
    );
  }

  private translateError(error: unknown): ImageProviderError {
    if (error instanceof ImageProviderError) return error;

    const message = error instanceof Error ? error.message : String(error);

    if (
      error instanceof Error &&
      (error.name === 'AbortError' || message.includes('abort') || message.includes('timeout'))
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.TIMEOUT,
        'OpenAI API request timed out',
        true
      );
    }

    if (
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('network')
    ) {
      return new ImageProviderError(
        this.name,
        ImageProviderErrorType.NETWORK_ERROR,
        `Network error connecting to OpenAI: ${message}`,
        true,
        503
      );
    }

    return new ImageProviderError(
      this.name,
      ImageProviderErrorType.UNKNOWN,
      `OpenAI request failed: ${message}`,
      true
    );
  }
}
