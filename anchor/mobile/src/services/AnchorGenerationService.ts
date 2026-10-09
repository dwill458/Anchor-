import { Image } from 'react-native';
import { API_URL } from '@/config';
import { warmUpBackend } from '@/services/backendWarmup';
import { AuthService } from '@/services/AuthService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { PerformanceMonitoring } from '@/services/PerformanceMonitoring';
import type { AIStyle, AnchorCategory, GeneratedVariation } from '@/types';
import { logger } from '@/utils/logger';
import { DEVELOPER_MASTER_ACCOUNT_ID } from '@/utils/developerMasterAccount';
import { selectedDevImageModel } from '@/stores/devImageModelStore';

/**
 * The styling request, extracted from AIGeneratingScreen so the one-screen creation flow can
 * issue exactly the same call. AIGeneratingScreen itself is untouched and keeps its own copy.
 *
 * Request body shape, 180 s client timeout, error mapping and analytics names are the same.
 * Screen-level guards (account / entitlement) stay with the caller — they need hooks and
 * navigation.
 */

export const GENERATION_TIMEOUT_MS = 180_000;
export const ESTIMATED_PROGRESS_CAP = 94;

export type GenerationFailureKind = 'connection' | 'generic';

export class AnchorGenerationError extends Error {
  readonly kind: GenerationFailureKind;
  readonly code: 'network_error' | 'ai_generation_timeout' | 'ai_generation_failed';

  constructor(
    message: string,
    kind: GenerationFailureKind,
    code: 'network_error' | 'ai_generation_timeout' | 'ai_generation_failed'
  ) {
    super(message);
    this.name = 'AnchorGenerationError';
    this.kind = kind;
    this.code = code;
  }
}

export interface AnchorGenerationRequest {
  /** `reinforcedSigilSvg || baseSigilSvg` — sent as-is; geometry is baked into the result. */
  sigilSvg: string;
  styleChoice: AIStyle;
  intentionText: string;
  category: AnchorCategory;
  generationAttempt: number;
  userId?: string;
  hasReinforcedSvg?: boolean;
  /** Aborts the request when the caller unmounts or leaves the Form phase. */
  signal?: AbortSignal;
}

export interface AnchorGenerationResult {
  variations: Array<string | GeneratedVariation>;
  prompt: string;
  negativePrompt: string;
  modelUsed: string;
  provider: string;
  controlMethod: string;
  generationTimeMs: number;
  reuseRequestId: string;
  passingCount: number;
}

export const isConnectionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /network|fetch|connection|internet|offline|socket|timed?\s*out/i.test(error.message);
};

export { warmUpBackend };

/**
 * Same easing the generating screen uses: creeps toward the cap, never reaching it, until the
 * request resolves. Pure so the flow can drive its hairline from a timer.
 */
export function nextEstimatedProgress(previous: number): number {
  if (previous >= ESTIMATED_PROGRESS_CAP) return previous;
  return Math.min(
    ESTIMATED_PROGRESS_CAP,
    previous + Math.max(0.15, (ESTIMATED_PROGRESS_CAP - previous) * 0.035)
  );
}

export const AnchorGenerationService = {
  async generate(request: AnchorGenerationRequest): Promise<AnchorGenerationResult> {
    const devImageModel = selectedDevImageModel('anchor');
    const {
      sigilSvg,
      styleChoice,
      intentionText,
      category,
      generationAttempt,
      userId = `dev-user-${Date.now()}`,
      hasReinforcedSvg = false,
      signal,
    } = request;

    const trace = PerformanceMonitoring.startTrace('ai_enhance', {
      style_choice: styleChoice,
      user_id: userId,
      has_reinforced_svg: hasReinforcedSvg,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', onExternalAbort);
    }

    FrictionAnalytics.stepCompleted('anchor_creation', 'ai_generation_started', {
      style_id: styleChoice,
      category,
      attempt: generationAttempt,
      has_reinforced_svg: hasReinforcedSvg,
    });
    ErrorTrackingService.addBreadcrumb('AI enhancement started', 'ai.enhance', {
      style_choice: styleChoice,
      user_id: userId,
    });

    try {
      const token = await AuthService.getIdToken();
      const response = await fetch(`${API_URL}/api/ai/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          sigilSvg,
          styleChoice,
          intentionText,
          anchorId: `temp-${Date.now()}`,
          provider: 'gemini',
          tier: 'premium',
          generationAttempt,
          ...(devImageModel ? { devImageModel } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'AI enhancement failed');
      }

      const result = await response.json();
      const variations: Array<string | GeneratedVariation> = Array.isArray(result.variations)
        ? result.variations
        : [];

      trace.putAttribute('variation_count', variations.length);
      trace.stop({ success: true });
      FrictionAnalytics.stepCompleted('anchor_creation', 'ai_generating', {
        style_id: styleChoice,
        category,
        variation_count: variations.length,
        generation_time_ms: typeof result.generationTime === 'number' ? result.generationTime * 1000 : undefined,
      });
      ErrorTrackingService.addBreadcrumb('AI enhancement completed', 'ai.enhance', {
        style_choice: styleChoice,
        variation_count: variations.length,
      });

      return {
        variations,
        prompt: result.prompt || '',
        negativePrompt: result.negativePrompt || '',
        modelUsed: result.model || '',
        provider: result.provider || '',
        controlMethod: result.controlMethod || '',
        generationTimeMs: typeof result.generationTime === 'number' ? result.generationTime * 1000 : 0,
        reuseRequestId: result.reuseRequestId || '',
        passingCount: typeof result.passingCount === 'number' ? result.passingCount : variations.length,
      };
    } catch (error) {
      trace.stop({ success: false });

      if (__DEV__ && !devImageModel && (userId === DEVELOPER_MASTER_ACCOUNT_ID || isConnectionError(error))) {
        logger.warn('[AnchorGeneration] Dev fallback with bundled fixtures');
        const FIXTURES = [
          require('@/assets/vision/vision-future-desk.jpg'),
          require('@/assets/vision/vision-future-window.jpg'),
        ];
        return {
          variations: FIXTURES.map((source) => Image.resolveAssetSource(source).uri),
          prompt: 'dev-fixture',
          negativePrompt: '',
          modelUsed: 'dev-model',
          provider: 'local-dev',
          controlMethod: 'lineart',
          generationTimeMs: 1200,
          reuseRequestId: '',
          passingCount: 2,
        };
      }

      const aborted = error instanceof Error && error.name === 'AbortError';
      const connection = isConnectionError(error) && !aborted;
      const code = connection ? 'network_error' : aborted ? 'ai_generation_timeout' : 'ai_generation_failed';

      FrictionAnalytics.flowError('anchor_creation', 'ai_generating', code, {
        style_id: styleChoice,
        category,
        attempt: generationAttempt,
      });
      ErrorTrackingService.captureException(error, {
        screen: 'AnchorCreationFlow',
        action: 'generate_ai_variations',
        style_choice: styleChoice,
      });
      logger.error('[AnchorGeneration] AI generation error', error);

      throw new AnchorGenerationError(
        error instanceof Error ? error.message : 'AI enhancement failed',
        connection ? 'connection' : 'generic',
        code
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  },
};
