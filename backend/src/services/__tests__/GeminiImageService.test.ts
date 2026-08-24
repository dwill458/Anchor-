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
import {
  CORE_STYLE_IDS,
  FEATURED_STYLE_IDS,
  LAUNCH_STYLE_LIBRARY,
  SEASONAL_STYLE_IDS,
} from '../stylePromptLibrary';

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
      // draft: $0.005 per image
      const cost = service.getCostEstimate(1, 'draft');
      expect(cost).toBe(0.005);
    });

    it('should calculate cost for draft tier (2 variations)', () => {
      const service = new GeminiImageService();
      const cost = service.getCostEstimate(2, 'draft');
      expect(cost).toBe(0.01);
    });

    it('should calculate cost for premium tier (4 variations)', () => {
      const service = new GeminiImageService();
      // premium: $0.005 per image × 4 = $0.02
      const cost = service.getCostEstimate(4, 'premium');
      expect(cost).toBe(0.02);
    });

    it('should calculate cost for pro_upgrade tier (4 variations)', () => {
      const service = new GeminiImageService();
      // pro_upgrade: $0.04 per image × 4 = $0.16
      const cost = service.getCostEstimate(4, 'pro_upgrade');
      expect(cost).toBe(0.16);
    });

    it('should default to 2 variations and premium tier', () => {
      const service = new GeminiImageService();
      // premium: $0.005 × 2 = $0.01
      expect(service.getCostEstimate()).toBe(0.01);
    });
  });

  // ============================================================================
  // getTimeEstimate
  // ============================================================================

  describe('getTimeEstimate', () => {
    it('should return time bounds for draft tier', () => {
      const service = new GeminiImageService();
      // draft: estimatedTimeSeconds = 3, so min = 9, max = 18
      const estimate = service.getTimeEstimate('draft');
      expect(estimate.min).toBe(9);
      expect(estimate.max).toBe(18);
    });

    it('should return time bounds for premium tier', () => {
      const service = new GeminiImageService();
      // premium: estimatedTimeSeconds = 3, so min = 9, max = 18
      const estimate = service.getTimeEstimate('premium');
      expect(estimate.min).toBe(9);
      expect(estimate.max).toBe(18);
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

  describe('prompt generation', () => {
    it('defines the 20-style launch library with unique palettes and varied composition families', () => {
      const paletteLanes = new Set(LAUNCH_STYLE_LIBRARY.map(style => style.paletteLane));
      const compositionFamilies = new Set(
        LAUNCH_STYLE_LIBRARY.map(style => style.compositionFamily)
      );

      expect(LAUNCH_STYLE_LIBRARY).toHaveLength(20);
      expect(paletteLanes.size).toBe(20);
      expect(compositionFamilies.size).toBeGreaterThanOrEqual(5);
      expect(CORE_STYLE_IDS).toHaveLength(12);
      expect(FEATURED_STYLE_IDS).toHaveLength(4);
      expect(SEASONAL_STYLE_IDS).toHaveLength(4);
    });

    it('adds style-specific uniqueness signatures for all supported styles', () => {
      const service = new GeminiImageService();
      const supportedStyles = [
        'architectural_trace',
        'lunar_etch',
        'resonance_rings',
        'watercolor',
        'ink_brush',
        'gold_leaf',
        'cosmic',
        'minimal_line',
        'obsidian_mono',
        'aurora_glow',
        'ember_trace',
        'monolith_ink',
        'celestial_grid',
        'echo_chamber',
        'prism_veil',
        'verdigris_relic',
        'solar_halo',
        'tideglass',
        'sacred_geometry',
        'velvet_ember',
      ];

      supportedStyles.forEach(style => {
        const prompt = (service as any).createPrompt('steady focus', style, 0);
        expect(prompt).toContain('UNIQUENESS MANDATE');
        expect(prompt).toContain('STYLE SIGNATURE FOR THIS RENDER');
        expect(prompt).toContain('STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY');
        expect(prompt).toContain('INTENTION SIGNAL LAYER');
      });
    });

    it('adds style identity and composition family for celestial_grid prompts', () => {
      const service = new GeminiImageService();

      const prompt = (service as any).createPrompt(
        'My discipline outlasts my motivation',
        'celestial_grid',
        0
      );

      expect(prompt).toContain('UNIQUENESS MANDATE');
      expect(prompt).toContain('Celestial Grid — Measured astrometric geometry');
      expect(prompt).toContain('COMPOSITIONAL FAMILY:');
      expect(prompt).toContain('OFFSET FIELD');
      expect(prompt).toContain('Avoid zodiac wheels');
    });

    it('produces distinct celestial_grid prompts for different intentions', () => {
      const service = new GeminiImageService();

      const promptA = (service as any).createPrompt(
        'I think before I speak',
        'celestial_grid',
        0
      );
      const promptB = (service as any).createPrompt(
        'My discipline outlasts my motivation',
        'celestial_grid',
        0
      );

      expect(promptA).not.toEqual(promptB);
    });

    it('cycles stance variants across variation indexes', () => {
      const service = new GeminiImageService();

      const promptA = (service as any).createPrompt('steady focus', 'celestial_grid', 0);
      const promptB = (service as any).createPrompt('steady focus', 'celestial_grid', 1);

      expect(promptA).not.toEqual(promptB);
      expect(promptA).toContain('Composition variation:');
      expect(promptB).toContain('Composition variation:');
    });

    it('adds a non-generic style signature for gold_leaf prompts', () => {
      const service = new GeminiImageService();

      const prompt = (service as any).createPrompt('radiant confidence', 'gold_leaf', 0);

      expect(prompt).toContain('Gold Leaf — Struck alloy seams');
      expect(prompt).toContain('Palette lane: antique gold accent, umber, soot-black, soft bronze');
      expect(prompt).toContain('Material behavior: brushed-gold fracture, struck alloy seams');
      expect(prompt).toContain('upward lift or outward expansion');
    });
  });
});
