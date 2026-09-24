/**
 * Image Generation Service
 *
 * Central, provider-agnostic image generation layer for Anchor.
 * Routes generation requests by purpose ('anchor' vs 'vision') with
 * automatic fallback, idempotency protection, timeout enforcement,
 * and cost controls.
 */

import { createHash, randomUUID } from 'crypto';
import { logger } from '../../utils/logger';
import {
  GenerateImageRequest,
  ImageGenerationResult,
  ImageProviderAdapter,
  ImageProviderError,
  ImageProviderErrorType,
  ProviderAttemptRecord,
} from './types';
import { GeminiImageProviderAdapter } from './adapters/GeminiImageProviderAdapter';
import { OpenAIImageProviderAdapter } from './adapters/OpenAIImageProviderAdapter';

export interface ImageGenerationServiceOptions {
  geminiAdapter?: ImageProviderAdapter;
  openAiAdapter?: ImageProviderAdapter;
}

export class ImageGenerationService {
  private readonly adapters: Map<string, ImageProviderAdapter> = new Map();
  // In-flight deduplication ledger to prevent concurrent duplicate jobs for identical requests
  private readonly inFlightRequests: Map<string, Promise<ImageGenerationResult>> = new Map();

  constructor(options: ImageGenerationServiceOptions = {}) {
    const gemini = options.geminiAdapter ?? new GeminiImageProviderAdapter();
    const openai = options.openAiAdapter ?? new OpenAIImageProviderAdapter();

    this.registerAdapter(gemini);
    this.registerAdapter(openai);
  }

  public registerAdapter(adapter: ImageProviderAdapter): void {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
  }

  public getAdapter(name: string): ImageProviderAdapter | undefined {
    return this.adapters.get(name.toLowerCase());
  }

  /**
   * Deterministic A/B testing provider selection for Vision imagery.
   *
   * When VISION_AB_TEST_ENABLED is true and a userId is provided, deterministically
   * hashes the userId so a user stably receives either OpenAI or Gemini across sessions.
   * Otherwise returns the configured VISION_PRIMARY_PROVIDER (default: 'openai').
   */
  public selectVisionProvider(userId?: string): string {
    const isAbTestEnabled = process.env.VISION_AB_TEST_ENABLED === 'true';

    if (isAbTestEnabled && userId) {
      const hash = createHash('md5').update(`vision_ab_${userId}`).digest('hex');
      const numericVal = parseInt(hash.slice(0, 8), 16);
      return numericVal % 2 === 0 ? 'openai' : 'gemini';
    }

    return (process.env.VISION_PRIMARY_PROVIDER || 'openai').toLowerCase();
  }

  public resolveRouting(request: GenerateImageRequest): {
    primaryProvider: string;
    fallbackProvider: string;
  } {
    if (request.type === 'vision') {
      const primary = this.selectVisionProvider(request.userId);
      const fallback = (
        process.env.VISION_FALLBACK_PROVIDER || (primary === 'openai' ? 'gemini' : 'openai')
      ).toLowerCase();
      return { primaryProvider: primary, fallbackProvider: fallback };
    }

    // Anchor artwork:
    // Nano Banana 2 (Gemini Flash) is the cost-efficient default;
    // Nano Banana Pro is chosen on regeneration (attempt 2+ / pro_upgrade).
    // OpenAI serves as the redundancy fallback provider.
    const primary = (process.env.ANCHOR_PRIMARY_PROVIDER || 'gemini').toLowerCase();
    const fallback = (process.env.ANCHOR_FALLBACK_PROVIDER || 'openai').toLowerCase();
    return { primaryProvider: primary, fallbackProvider: fallback };
  }

  /**
   * Generates an image based on its PURPOSE ('anchor' or 'vision').
   * Enforces in-flight deduplication, timeout policy, retry limits, and controlled fallback.
   */
  async generate(request: GenerateImageRequest): Promise<ImageGenerationResult> {
    const generationRequestId = request.generationRequestId || randomUUID();
    const requestWithId: GenerateImageRequest = { ...request, generationRequestId };

    // Idempotency: check if an identical generation request is already in-flight
    const dedupeKey = `${request.type}:${request.userId || 'anon'}:${generationRequestId}`;
    const existing = this.inFlightRequests.get(dedupeKey);
    if (existing) {
      logger.info('[ImageGenerationService] Attaching to in-flight generation request', {
        dedupeKey,
      });
      return existing;
    }

    const executionPromise = this.executeWithFallback(requestWithId);
    this.inFlightRequests.set(dedupeKey, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightRequests.delete(dedupeKey);
    }
  }

  private async executeWithFallback(request: GenerateImageRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const { primaryProvider, fallbackProvider } = this.resolveRouting(request);
    const attempts: ProviderAttemptRecord[] = [];

    const primaryAdapter = this.getAdapter(primaryProvider);
    const fallbackAdapter = this.getAdapter(fallbackProvider);

    // 1. Attempt Primary Provider
    let primaryResult:
      | { images: ImageGenerationResult['images']; model: string; estimatedCost: number }
      | undefined;
    let primaryError: ImageProviderError | undefined;

    if (primaryAdapter && primaryAdapter.isAvailable()) {
      const attemptStart = new Date();
      try {
        logger.info(
          `[ImageGenerationService] Attempt 1: calling primary provider ${primaryProvider}`,
          {
            purpose: request.type,
            requestId: request.generationRequestId,
          }
        );

        const res = await primaryAdapter.generate(request, 1);
        const attemptEnd = new Date();

        attempts.push({
          attemptNumber: 1,
          provider: primaryProvider,
          model: res.model,
          startedAt: attemptStart,
          completedAt: attemptEnd,
          latencyMs: attemptEnd.getTime() - attemptStart.getTime(),
          success: true,
        });

        primaryResult = res;
      } catch (err) {
        const attemptEnd = new Date();
        primaryError =
          err instanceof ImageProviderError
            ? err
            : new ImageProviderError(
                primaryProvider,
                ImageProviderErrorType.UNKNOWN,
                err instanceof Error ? err.message : String(err),
                true
              );

        attempts.push({
          attemptNumber: 1,
          provider: primaryProvider,
          model: 'unknown',
          startedAt: attemptStart,
          completedAt: attemptEnd,
          latencyMs: attemptEnd.getTime() - attemptStart.getTime(),
          success: false,
          error: primaryError.message,
          failureReason: primaryError.type,
        });

        logger.warn(
          `[ImageGenerationService] Primary provider ${primaryProvider} failed: ${primaryError.message} (${primaryError.type})`,
          { requestId: request.generationRequestId, errorType: primaryError.type }
        );
      }
    } else {
      logger.warn(
        `[ImageGenerationService] Primary provider ${primaryProvider} is not available or not configured`,
        {
          requestId: request.generationRequestId,
        }
      );
      primaryError = new ImageProviderError(
        primaryProvider,
        ImageProviderErrorType.AUTHENTICATION,
        `Provider ${primaryProvider} is unavailable or unconfigured`,
        true
      );
    }

    if (primaryResult) {
      const totalTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      return {
        images: primaryResult.images,
        provider: primaryProvider,
        model: primaryResult.model,
        totalTimeSeconds,
        costUSD: primaryResult.estimatedCost,
        attempts,
        fallbackUsed: false,
        sourceProvider: primaryProvider,
        generationRequestId: request.generationRequestId!,
        metadata: request.metadata,
      };
    }

    // 2. Evaluate Fallback Eligibility
    // Only fall back on retryable infrastructure errors (timeout, 429, 5xx, network error, provider outage).
    // Do NOT fall back on safety filter rejections or bad user input.
    const isRetryableError =
      primaryError?.retryable ||
      primaryError?.type === ImageProviderErrorType.TIMEOUT ||
      primaryError?.type === ImageProviderErrorType.RATE_LIMIT ||
      primaryError?.type === ImageProviderErrorType.SERVER_ERROR ||
      primaryError?.type === ImageProviderErrorType.NETWORK_ERROR ||
      primaryError?.type === ImageProviderErrorType.INVALID_RESPONSE ||
      primaryError?.type === ImageProviderErrorType.AUTHENTICATION;

    if (!isRetryableError) {
      logger.info(
        `[ImageGenerationService] Error is non-retryable (${primaryError?.type}). Aborting without fallback.`,
        { requestId: request.generationRequestId }
      );
      throw primaryError;
    }

    if (!fallbackAdapter || !fallbackAdapter.isAvailable()) {
      logger.error('[ImageGenerationService] Fallback provider is unavailable or unconfigured', {
        fallbackProvider,
        requestId: request.generationRequestId,
      });
      throw primaryError;
    }

    // 3. Execute Fallback
    logger.info(`[ImageGenerationService] Attempt 2: falling back to ${fallbackProvider}`, {
      purpose: request.type,
      requestId: request.generationRequestId,
      previousFailureReason: primaryError?.type,
    });

    const fallbackStart = new Date();
    try {
      const fallbackRes = await fallbackAdapter.generate(request, 2);
      const fallbackEnd = new Date();

      attempts.push({
        attemptNumber: 2,
        provider: fallbackProvider,
        model: fallbackRes.model,
        startedAt: fallbackStart,
        completedAt: fallbackEnd,
        latencyMs: fallbackEnd.getTime() - fallbackStart.getTime(),
        success: true,
      });

      const totalTimeSeconds = Math.round((Date.now() - startTime) / 1000);
      return {
        images: fallbackRes.images,
        provider: fallbackProvider,
        model: fallbackRes.model,
        totalTimeSeconds,
        costUSD: fallbackRes.estimatedCost,
        attempts,
        fallbackUsed: true,
        sourceProvider: primaryProvider,
        generationRequestId: request.generationRequestId!,
        metadata: request.metadata,
      };
    } catch (fallbackErr) {
      const fallbackEnd = new Date();
      const fbError =
        fallbackErr instanceof ImageProviderError
          ? fallbackErr
          : new ImageProviderError(
              fallbackProvider,
              ImageProviderErrorType.UNKNOWN,
              fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
              false
            );

      attempts.push({
        attemptNumber: 2,
        provider: fallbackProvider,
        model: 'unknown',
        startedAt: fallbackStart,
        completedAt: fallbackEnd,
        latencyMs: fallbackEnd.getTime() - fallbackStart.getTime(),
        success: false,
        error: fbError.message,
        failureReason: fbError.type,
      });

      logger.error(
        `[ImageGenerationService] Fallback provider ${fallbackProvider} also failed: ${fbError.message}`,
        { requestId: request.generationRequestId, totalAttempts: attempts.length }
      );

      // Return a controlled, provider-agnostic error so UI can display standard failure experience
      throw fbError;
    }
  }
}

export const imageGenerationService = new ImageGenerationService();
