/**
 * Multi-Provider Image Generation Service Tests
 *
 * Verifies purpose-based routing ('anchor' vs 'vision'), fallback rules,
 * retry behavior, timeout handling, cost protections, and in-flight deduplication.
 */

import { ImageGenerationService } from '../ImageGenerationService';
import {
  GenerateImageRequest,
  GeneratedImageVariation,
  ImageProviderAdapter,
  ImageProviderError,
  ImageProviderErrorType,
} from '../types';
import { OpenAIImageProviderAdapter } from '../adapters/OpenAIImageProviderAdapter';

describe('ImageGenerationService & Multi-Provider Architecture', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockAdapter(
    name: string,
    available = true,
    handler?: (
      req: GenerateImageRequest,
      attempt: number
    ) => Promise<{
      images: GeneratedImageVariation[];
      model: string;
      estimatedCost: number;
    }>
  ): ImageProviderAdapter & { generate: jest.Mock } {
    const dummyImage: GeneratedImageVariation = {
      buffer: Buffer.from('mock_image_buffer'),
      base64: Buffer.from('mock_image_buffer').toString('base64'),
      mimeType: 'image/png',
      seed: 12345,
      variationIndex: 1,
    };

    const mockGenerate = jest.fn(
      handler ||
        (async (req: GenerateImageRequest) => ({
          images: [dummyImage],
          model: `${name}-model`,
          estimatedCost: 0.01,
        }))
    );

    return {
      name,
      isAvailable: jest.fn().mockReturnValue(available),
      generate: mockGenerate,
    };
  }

  // ============================================================================
  // Anchor Artwork Routing Tests
  // ============================================================================

  describe('Anchor Artwork Routing', () => {
    it('uses Nano Banana 2 (Gemini Flash) when it succeeds without calling OpenAI fallback', async () => {
      const mockGemini = createMockAdapter('gemini', true, async req => ({
        images: [
          {
            buffer: Buffer.from('nb2_img'),
            base64: 'nb2_b64',
            mimeType: 'image/png',
            seed: 100,
            variationIndex: 1,
          },
        ],
        model: 'gemini-3.1-flash-image-preview',
        estimatedCost: 0.005,
      }));
      const mockOpenAi = createMockAdapter('openai', true);

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'anchor',
        prompt: 'Mystical geometric anchor in watercolor',
        quality: 'premium',
        generationAttempt: 1,
      };

      const result = await service.generate(request);

      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(mockOpenAi.generate).not.toHaveBeenCalled();
      expect(result.fallbackUsed).toBe(false);
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-3.1-flash-image-preview');
      expect(result.costUSD).toBe(0.005);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].success).toBe(true);
    });

    it('falls back to OpenAI when Nano Banana 2 experiences an infrastructure failure', async () => {
      const mockGemini = createMockAdapter('gemini', true, async () => {
        throw new ImageProviderError(
          'gemini',
          ImageProviderErrorType.NETWORK_ERROR,
          'Connection reset by peer',
          true,
          503
        );
      });

      const mockOpenAi = createMockAdapter('openai', true, async () => ({
        images: [
          {
            buffer: Buffer.from('openai_anchor_img'),
            base64: 'openai_b64',
            mimeType: 'image/png',
            seed: 200,
            variationIndex: 1,
          },
        ],
        model: 'gpt-image-2.5-flare',
        estimatedCost: 0.02,
      }));

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'anchor',
        prompt: 'Mystical geometric anchor in gold leaf',
        quality: 'premium',
        generationAttempt: 1,
      };

      const result = await service.generate(request);

      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(result.fallbackUsed).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-image-2.5-flare');
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[0].failureReason).toBe(ImageProviderErrorType.NETWORK_ERROR);
      expect(result.attempts[1].success).toBe(true);
    });

    it('routes premium Anchor regeneration (attempt 2+) to Nano Banana Pro without calling OpenAI', async () => {
      const mockGemini = createMockAdapter('gemini', true, async req => ({
        images: [
          {
            buffer: Buffer.from('nb_pro_img'),
            base64: 'nb_pro_b64',
            mimeType: 'image/png',
            seed: 300,
            variationIndex: 1,
          },
        ],
        model: 'gemini-3-pro-image-preview',
        estimatedCost: 0.04,
      }));
      const mockOpenAi = createMockAdapter('openai', true);

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'anchor',
        prompt: 'Refined high fidelity anchor',
        quality: 'pro_upgrade',
        generationAttempt: 2,
      };

      const result = await service.generate(request);

      expect(mockGemini.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'anchor',
          quality: 'pro_upgrade',
          generationAttempt: 2,
        }),
        1
      );
      expect(mockOpenAi.generate).not.toHaveBeenCalled();
      expect(result.fallbackUsed).toBe(false);
      expect(result.model).toBe('gemini-3-pro-image-preview');
      expect(result.costUSD).toBe(0.04);
    });
  });

  // ============================================================================
  // Vision Routing Tests
  // ============================================================================

  describe('Vision Routing & Provider Selection', () => {
    it('uses OpenAI as primary Vision provider when it succeeds without calling Gemini', async () => {
      const mockOpenAi = createMockAdapter('openai', true, async () => ({
        images: [
          {
            buffer: Buffer.from('vision_openai_img'),
            base64: 'vision_b64',
            mimeType: 'image/png',
            seed: 500,
            variationIndex: 1,
          },
        ],
        model: 'gpt-image-2.5-flare',
        estimatedCost: 0.02,
      }));
      const mockGemini = createMockAdapter('gemini', true);

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Architectural firm corner office overlooking city at sunrise',
        category: 'career',
      };

      const result = await service.generate(request);

      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(mockGemini.generate).not.toHaveBeenCalled();
      expect(result.fallbackUsed).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-image-2.5-flare');
    });

    it('falls back to Gemini Nano Banana when OpenAI fails with a timeout', async () => {
      const mockOpenAi = createMockAdapter('openai', true, async () => {
        throw new ImageProviderError(
          'openai',
          ImageProviderErrorType.TIMEOUT,
          'Request timed out',
          true
        );
      });

      const mockGemini = createMockAdapter('gemini', true, async () => ({
        images: [
          {
            buffer: Buffer.from('vision_gemini_fallback_img'),
            base64: 'gemini_b64',
            mimeType: 'image/png',
            seed: 600,
            variationIndex: 1,
          },
        ],
        model: 'gemini-3.1-flash-image',
        estimatedCost: 0.005,
      }));

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Finishing a 100-mile mountain trail run at twilight',
        category: 'health',
      };

      const result = await service.generate(request);

      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(result.fallbackUsed).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(result.model).toBe('gemini-3.1-flash-image');
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0].failureReason).toBe(ImageProviderErrorType.TIMEOUT);
    });

    it('falls back to Gemini when OpenAI returns 429 rate limit', async () => {
      const mockOpenAi = createMockAdapter('openai', true, async () => {
        throw new ImageProviderError(
          'openai',
          ImageProviderErrorType.RATE_LIMIT,
          'Rate limit exceeded (429)',
          true,
          429,
          5000
        );
      });

      const mockGemini = createMockAdapter('gemini', true, async () => ({
        images: [
          {
            buffer: Buffer.from('vision_gemini_rate_limit_fallback'),
            base64: 'gemini_b64',
            mimeType: 'image/png',
            seed: 700,
            variationIndex: 1,
          },
        ],
        model: 'gemini-3.1-flash-image',
        estimatedCost: 0.005,
      }));

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Keynote presentation on main stage to international audience',
        category: 'career',
      };

      const result = await service.generate(request);

      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
      expect(result.fallbackUsed).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(result.attempts[0].failureReason).toBe(ImageProviderErrorType.RATE_LIMIT);
    });

    it('does NOT fall back to Gemini on a safety filter rejection', async () => {
      const mockOpenAi = createMockAdapter('openai', true, async () => {
        throw new ImageProviderError(
          'openai',
          ImageProviderErrorType.SAFETY_FILTER,
          'Content blocked by safety policy',
          false,
          400
        );
      });

      const mockGemini = createMockAdapter('gemini', true);

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Sensitive prompt trigger',
      };

      await expect(service.generate(request)).rejects.toThrow(/Content blocked by safety policy/);
      // Gemini should never be called when user prompt violated safety
      expect(mockGemini.generate).not.toHaveBeenCalled();
    });

    it('throws controlled error when both providers fail', async () => {
      const mockOpenAi = createMockAdapter('openai', true, async () => {
        throw new ImageProviderError(
          'openai',
          ImageProviderErrorType.SERVER_ERROR,
          'OpenAI 503 Service Unavailable',
          true,
          503
        );
      });

      const mockGemini = createMockAdapter('gemini', true, async () => {
        throw new ImageProviderError(
          'gemini',
          ImageProviderErrorType.SERVER_ERROR,
          'Gemini 500 Internal Error',
          true,
          500
        );
      });

      const service = new ImageGenerationService({
        geminiAdapter: mockGemini,
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Serene mountain cabin study filled with sunlight',
      };

      await expect(service.generate(request)).rejects.toThrow(/Gemini 500 Internal Error/);
      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(mockGemini.generate).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // In-Flight Deduplication & Double-Spend Protection Tests
  // ============================================================================

  describe('Deduplication & Cost Safeguards', () => {
    it('deduplicates simultaneous identical in-flight requests to prevent double spending', async () => {
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      const mockOpenAi = createMockAdapter('openai', true, async () => {
        await delayedPromise;
        return {
          images: [
            {
              buffer: Buffer.from('deduped_img'),
              base64: 'b64',
              mimeType: 'image/png',
              seed: 999,
              variationIndex: 1,
            },
          ],
          model: 'gpt-image-2.5-flare',
          estimatedCost: 0.02,
        };
      });

      const service = new ImageGenerationService({
        openAiAdapter: mockOpenAi,
      });

      const request: GenerateImageRequest = {
        type: 'vision',
        prompt: 'Opening night at family bakery',
        generationRequestId: 'req-fixed-id-123',
        userId: 'user-456',
      };

      // Fire 2 simultaneous generation calls with identical generationRequestId and userId
      const call1 = service.generate(request);
      const call2 = service.generate(request);

      resolvePromise!({ ok: true });

      const [res1, res2] = await Promise.all([call1, call2]);

      // Only ONE call should have reached the provider adapter
      expect(mockOpenAi.generate).toHaveBeenCalledTimes(1);
      expect(res1.generationRequestId).toBe('req-fixed-id-123');
      expect(res2.generationRequestId).toBe('req-fixed-id-123');
      expect(res1.images[0].seed).toBe(res2.images[0].seed);
    });
  });

  // ============================================================================
  // Deterministic A/B Testing Tests
  // ============================================================================

  describe('A/B Testing Provider Routing', () => {
    it('returns configured default provider when A/B testing is disabled', () => {
      process.env.VISION_AB_TEST_ENABLED = 'false';
      process.env.VISION_PRIMARY_PROVIDER = 'openai';

      const service = new ImageGenerationService();
      expect(service.selectVisionProvider('user-1')).toBe('openai');
      expect(service.selectVisionProvider('user-2')).toBe('openai');
      expect(service.selectVisionProvider(undefined)).toBe('openai');
    });

    it('assigns providers deterministically per user when A/B testing is enabled', () => {
      process.env.VISION_AB_TEST_ENABLED = 'true';

      const service = new ImageGenerationService();

      // Stable mapping: same user always gets the exact same provider
      const providerUserA1 = service.selectVisionProvider('user-alice-123');
      const providerUserA2 = service.selectVisionProvider('user-alice-123');
      expect(providerUserA1).toBe(providerUserA2);

      const providerUserB1 = service.selectVisionProvider('user-bob-456');
      const providerUserB2 = service.selectVisionProvider('user-bob-456');
      expect(providerUserB1).toBe(providerUserB2);
    });
  });

  // ============================================================================
  // OpenAI Adapter Direct Unit Tests
  // ============================================================================

  describe('OpenAIImageProviderAdapter', () => {
    it('throws error when OPENAI_API_KEY is not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      const adapter = new OpenAIImageProviderAdapter();

      expect(adapter.isAvailable()).toBe(false);

      await expect(
        adapter.generate(
          {
            type: 'vision',
            prompt: 'Test prompt',
          },
          1
        )
      ).rejects.toThrow(/OPENAI_API_KEY is missing/);
    });

    it('formats portrait 1024x1792 dimensions for Vision requests', async () => {
      process.env.OPENAI_API_KEY = 'sk-mock-key';
      const adapter = new OpenAIImageProviderAdapter();

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ b64_json: Buffer.from('img').toString('base64') }],
        }),
      });
      global.fetch = mockFetch;

      const result = await adapter.generate(
        {
          type: 'vision',
          prompt: 'Portrait vision moment',
        },
        1
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"size":"1024x1792"'),
        })
      );
      expect(result.images).toHaveLength(1);
    });

    it('formats 1024x1024 square dimensions for Anchor requests', async () => {
      process.env.OPENAI_API_KEY = 'sk-mock-key';
      const adapter = new OpenAIImageProviderAdapter();

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ b64_json: Buffer.from('img').toString('base64') }],
        }),
      });
      global.fetch = mockFetch;

      const result = await adapter.generate(
        {
          type: 'anchor',
          prompt: 'Square anchor artwork',
        },
        1
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/images/generations',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"size":"1024x1024"'),
        })
      );
      expect(result.images).toHaveLength(1);
    });
  });
});
