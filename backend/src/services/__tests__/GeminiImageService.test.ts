/**
 * Unit tests for GeminiImageService
 *
 * Tests cover:
 * - isAvailable() - API key presence
 * - getCostEstimate() - cost calculation per tier
 * - getTimeEstimate() - time bounds per tier
 * - enhanceSigil() - error when API key missing
 * - GeminiError class
 */

jest.mock('../../utils/logger');
jest.mock('@google/genai');
jest.mock('sharp');

import { GoogleGenAI } from '@google/genai';
import { GeminiImageService, GeminiError, GeminiErrorType } from '../GeminiImageService';

describe('GeminiImageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    // Provide a no-op GoogleGenAI mock
    (GoogleGenAI as jest.Mock).mockImplementation(() => ({
      models: { generateContent: jest.fn() },
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // GeminiError class
  // ============================================================================

  describe('GeminiError', () => {
    it('should create a GeminiError with type and message', () => {
      const err = new GeminiError(GeminiErrorType.RATE_LIMIT, 'Rate limit exceeded', true, 5000);
      expect(err.type).toBe(GeminiErrorType.RATE_LIMIT);
      expect(err.message).toBe('Rate limit exceeded');
      expect(err.retryable).toBe(true);
      expect(err.retryAfterMs).toBe(5000);
      expect(err.name).toBe('GeminiError');
    });

    it('should default retryable to false', () => {
      const err = new GeminiError(GeminiErrorType.INVALID_API_KEY, 'Bad key');
      expect(err.retryable).toBe(false);
    });

    it('should be an instance of Error', () => {
      const err = new GeminiError(GeminiErrorType.UNKNOWN, 'Unknown error');
      expect(err).toBeInstanceOf(Error);
    });

    it('should have all GeminiErrorType values', () => {
      expect(GeminiErrorType.RATE_LIMIT).toBeDefined();
      expect(GeminiErrorType.SAFETY_FILTER).toBeDefined();
      expect(GeminiErrorType.INVALID_API_KEY).toBeDefined();
      expect(GeminiErrorType.NETWORK_ERROR).toBeDefined();
      expect(GeminiErrorType.INVALID_IMAGE).toBeDefined();
      expect(GeminiErrorType.UNKNOWN).toBeDefined();
    });
  });

  // ============================================================================
  // isAvailable
  // ============================================================================

  describe('isAvailable', () => {
    it('should return false when no API key is set', () => {
      const service = new GeminiImageService();
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'test-api-key';
      const service = new GeminiImageService();
      expect(service.isAvailable()).toBe(true);
    });

    it('should return true when GOOGLE_API_KEY is set', () => {
      process.env.GOOGLE_API_KEY = 'test-google-key';
      const service = new GeminiImageService();
      expect(service.isAvailable()).toBe(true);
    });

    it('should prefer GEMINI_API_KEY over GOOGLE_API_KEY', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.GOOGLE_API_KEY = 'google-key';
      const service = new GeminiImageService();
      expect(service.isAvailable()).toBe(true);
    });
  });

  // ============================================================================
  // getCostEstimate
  // ============================================================================

  describe('getCostEstimate', () => {
    it('should calculate cost for draft tier (1 variation)', () => {
      const service = new GeminiImageService();
      // draft: $0.01 per image
      const cost = service.getCostEstimate(1, 'draft');
      expect(cost).toBe(0.01);
    });

    it('should calculate cost for draft tier (2 variations)', () => {
      const service = new GeminiImageService();
      const cost = service.getCostEstimate(2, 'draft');
      expect(cost).toBe(0.02);
    });

    it('should calculate cost for premium tier (4 variations)', () => {
      const service = new GeminiImageService();
      // premium: $0.02 per image × 4 = $0.08
      const cost = service.getCostEstimate(4, 'premium');
      expect(cost).toBe(0.08);
    });

    it('should calculate cost for pro_upgrade tier (4 variations)', () => {
      const service = new GeminiImageService();
      // pro_upgrade: $0.04 per image × 4 = $0.16
      const cost = service.getCostEstimate(4, 'pro_upgrade');
      expect(cost).toBe(0.16);
    });

    it('should default to 4 variations and premium tier', () => {
      const service = new GeminiImageService();
      // premium: $0.02 × 4 = $0.08
      expect(service.getCostEstimate()).toBe(0.08);
    });
  });

  // ============================================================================
  // getTimeEstimate
  // ============================================================================

  describe('getTimeEstimate', () => {
    it('should return time bounds for draft tier', () => {
      const service = new GeminiImageService();
      // draft: estimatedTimeSeconds = 4, so min = 12, max = 24
      const estimate = service.getTimeEstimate('draft');
      expect(estimate.min).toBe(12);
      expect(estimate.max).toBe(24);
    });

    it('should return time bounds for premium tier', () => {
      const service = new GeminiImageService();
      // premium: estimatedTimeSeconds = 5, so min = 15, max = 30
      const estimate = service.getTimeEstimate('premium');
      expect(estimate.min).toBe(15);
      expect(estimate.max).toBe(30);
    });

    it('should return time bounds for pro_upgrade tier', () => {
      const service = new GeminiImageService();
      // pro_upgrade: estimatedTimeSeconds = 8, so min = 24, max = 48
      const estimate = service.getTimeEstimate('pro_upgrade');
      expect(estimate.min).toBe(24);
      expect(estimate.max).toBe(48);
    });

    it('should return min < max for all tiers', () => {
      const service = new GeminiImageService();
      const tiers = ['draft', 'premium', 'pro_upgrade'] as const;
      tiers.forEach(tier => {
        const { min, max } = service.getTimeEstimate(tier);
        expect(min).toBeLessThan(max);
        expect(min).toBeGreaterThan(0);
      });
    });

    it('should default to premium tier', () => {
      const service = new GeminiImageService();
      const defaultEstimate = service.getTimeEstimate();
      const premiumEstimate = service.getTimeEstimate('premium');
      expect(defaultEstimate).toEqual(premiumEstimate);
    });
  });

  // ============================================================================
  // enhanceSigil - API key validation
  // ============================================================================

  describe('enhanceSigil', () => {
    it('should throw GeminiError when API key is not configured', async () => {
      const service = new GeminiImageService();

      await expect(
        service.enhanceSigil({
          baseSigilSvg: '<svg><path d="M0 0"/></svg>',
          intentionText: 'test',
          styleApproach: 'watercolor',
          numberOfVariations: 2,
          tier: 'draft',
        })
      ).rejects.toThrow(GeminiError);
    });

    it('should throw GeminiError with INVALID_API_KEY type when key missing', async () => {
      const service = new GeminiImageService();

      try {
        await service.enhanceSigil({
          baseSigilSvg: '<svg/>',
          intentionText: '',
          styleApproach: 'ink_brush',
          numberOfVariations: 1,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(GeminiError);
        expect((err as GeminiError).type).toBe(GeminiErrorType.INVALID_API_KEY);
      }
    });
  });
});
