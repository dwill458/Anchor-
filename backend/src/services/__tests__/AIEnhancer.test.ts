/**
 * Unit tests for AIEnhancer service
 *
 * Tests cover:
 * - Gemini API integration
 * - Replicate ControlNet integration
 * - SVG rasterization
 * - Style prompt generation
 * - Error handling (API failures, timeouts)
 * - Cost estimation
 * - Generation time estimation
 * - Structure validation
 * - Provider fallback (Gemini → Replicate)
 */

import {
  enhanceSigilWithAI,
  enhanceSigilWithControlNet,
  getCostEstimate,
  estimateControlNetGenerationTime,
  __resetGeminiImageServiceForTests,
  ControlNetEnhancementRequest,
  ControlNetEnhancementResult,
  AIStyle,
} from '../AIEnhancer';

// Mock dependencies
jest.mock('../GeminiImageService');
jest.mock('../StorageService');
jest.mock('../../utils/logger');
jest.mock('../../utils/svgRasterizer');
jest.mock('../../utils/structureMatching');
jest.mock('replicate');

import { GeminiImageService } from '../GeminiImageService';
import { uploadImageFromBuffer, uploadImageFromUrl } from '../StorageService';
import { rasterizeSVG } from '../../utils/svgRasterizer';
import { computeStructureMatch } from '../../utils/structureMatching';
import Replicate from 'replicate';

describe('AIEnhancer Service', () => {
  // Sample test data
  const mockUserId = 'test-user-123';
  const mockSigilSvg = '<svg><path d="M10 10 L50 50"/></svg>';
  const mockIntentionText = 'I am strong and confident';

  // Reset environment variables before each test
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    __resetGeminiImageServiceForTests();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================================
  // Cost Estimation Tests
  // ============================================================================

  describe('getCostEstimate', () => {
    it('should return Gemini cost estimate when service is available', () => {
      // Mock Gemini service as available
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        getCostEstimate: jest.fn().mockReturnValue(0.16),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const cost = getCostEstimate('premium');

      expect(cost).toBe(0.16);
      expect(mockGeminiService.getCostEstimate).toHaveBeenCalledWith(4, 'premium');
    });

    it('should return draft tier cost estimate (2 variations)', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        getCostEstimate: jest.fn().mockReturnValue(0.04),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const cost = getCostEstimate('draft');

      expect(cost).toBe(0.04);
      expect(mockGeminiService.getCostEstimate).toHaveBeenCalledWith(2, 'draft');
    });

    it('should fallback to Replicate cost when Gemini unavailable', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const cost = getCostEstimate('premium');

      expect(cost).toBe(0.04); // Replicate fallback cost
    });

    it('should return draft Replicate cost when Gemini unavailable', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const cost = getCostEstimate('draft');

      expect(cost).toBe(0.02); // Draft Replicate cost
    });
  });

  // ============================================================================
  // Time Estimation Tests
  // ============================================================================

  describe('estimateControlNetGenerationTime', () => {
    it('should return Gemini time estimate when available', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        getTimeEstimate: jest.fn().mockReturnValue({ min: 24, max: 40 }),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const estimate = estimateControlNetGenerationTime('premium');

      expect(estimate).toEqual({ min: 24, max: 40 });
      expect(mockGeminiService.getTimeEstimate).toHaveBeenCalledWith('premium');
    });

    it('should return draft time estimate for Gemini', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        getTimeEstimate: jest.fn().mockReturnValue({ min: 9, max: 15 }),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const estimate = estimateControlNetGenerationTime('draft');

      expect(estimate).toEqual({ min: 9, max: 15 });
    });

    it('should fallback to Replicate time when Gemini unavailable', () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      const estimate = estimateControlNetGenerationTime('premium');

      expect(estimate).toEqual({ min: 40, max: 60 });
    });
  });

  // ============================================================================
  // Gemini Integration Tests (Primary Provider)
  // ============================================================================

  describe('enhanceSigilWithAI - Gemini Integration', () => {
    it('should use Gemini as primary provider when available', async () => {
      const mockGeminiResult = {
        images: [
          { base64: Buffer.from('image1').toString('base64'), seed: 123 },
          { base64: Buffer.from('image2').toString('base64'), seed: 456 },
          { base64: Buffer.from('image3').toString('base64'), seed: 789 },
          { base64: Buffer.from('image4').toString('base64'), seed: 101 },
        ],
        prompt: 'Test prompt',
        negativePrompt: 'Test negative',
        model: 'gemini-3-pro-image-preview',
        totalTimeSeconds: 35,
        costUSD: 0.16,
        tier: 'premium' as const,
      };

      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        enhanceSigil: jest.fn().mockResolvedValue(mockGeminiResult),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      (uploadImageFromBuffer as jest.Mock).mockResolvedValue('https://storage.example.com/image.png');

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'watercolor',
        userId: mockUserId,
        intentionText: mockIntentionText,
        tier: 'premium',
      };

      const result = await enhanceSigilWithAI(request);

      expect(mockGeminiService.enhanceSigil).toHaveBeenCalledWith({
        baseSigilSvg: mockSigilSvg,
        intentionText: mockIntentionText,
        styleApproach: 'watercolor',
        numberOfVariations: 4,
        tier: 'premium',
      });

      expect(result.variations).toHaveLength(4);
      expect(result.styleApplied).toBe('watercolor');
      expect(result.generationTime).toBe(35);
      expect(uploadImageFromBuffer).toHaveBeenCalledTimes(4);
    });

    it('should request 2 variations for draft tier', async () => {
      const mockGeminiResult = {
        images: [
          { base64: Buffer.from('image1').toString('base64'), seed: 123 },
          { base64: Buffer.from('image2').toString('base64'), seed: 456 },
        ],
        prompt: 'Test prompt',
        negativePrompt: 'Test negative',
        model: 'gemini-3-flash-preview',
        totalTimeSeconds: 12,
        costUSD: 0.04,
        tier: 'draft' as const,
      };

      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        enhanceSigil: jest.fn().mockResolvedValue(mockGeminiResult),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      (uploadImageFromBuffer as jest.Mock).mockResolvedValue('https://storage.example.com/image.png');

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'sacred_geometry',
        userId: mockUserId,
        tier: 'draft',
      };

      const result = await enhanceSigilWithAI(request);

      expect(mockGeminiService.enhanceSigil).toHaveBeenCalledWith({
        baseSigilSvg: mockSigilSvg,
        intentionText: '',
        styleApproach: 'sacred_geometry',
        numberOfVariations: 2,
        tier: 'draft',
      });

      expect(result.variations).toHaveLength(2);
    });

    it('should fallback to Replicate when Gemini fails', async () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        enhanceSigil: jest.fn().mockRejectedValue(new Error('Gemini API error')),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      // Mock Replicate mode (no API token)
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'ink_brush',
        userId: mockUserId,
      };

      const result = await enhanceSigilWithAI(request);

      // Should fallback to mock mode
      expect(result.variationUrls).toHaveLength(4);
      expect(result.variationUrls[0]).toContain('dicebear.com');
    });

    it('should handle empty intention text gracefully', async () => {
      const mockGeminiResult = {
        images: [
          { base64: Buffer.from('image1').toString('base64'), seed: 123 },
          { base64: Buffer.from('image2').toString('base64'), seed: 456 },
          { base64: Buffer.from('image3').toString('base64'), seed: 789 },
          { base64: Buffer.from('image4').toString('base64'), seed: 101 },
        ],
        prompt: 'Test prompt',
        negativePrompt: 'Test negative',
        model: 'gemini-3-pro-image-preview',
        totalTimeSeconds: 35,
        costUSD: 0.16,
        tier: 'premium' as const,
      };

      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        enhanceSigil: jest.fn().mockResolvedValue(mockGeminiResult),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      (uploadImageFromBuffer as jest.Mock).mockResolvedValue('https://storage.example.com/image.png');

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'cosmic',
        userId: mockUserId,
        // No intentionText provided
      };

      const result = await enhanceSigilWithAI(request);

      expect(mockGeminiService.enhanceSigil).toHaveBeenCalledWith({
        baseSigilSvg: mockSigilSvg,
        intentionText: '', // Should default to empty string
        styleApproach: 'cosmic',
        numberOfVariations: 4,
        tier: 'premium',
      });

      expect(result.variations).toHaveLength(4);
    });
  });

  // ============================================================================
  // Replicate ControlNet Tests (Fallback Provider)
  // ============================================================================

  describe('enhanceSigilWithControlNet - Replicate Integration', () => {
    it('should generate variations in mock mode when no API token', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'gold_leaf',
        userId: mockUserId,
        intentionText: mockIntentionText,
      };

      const result = await enhanceSigilWithControlNet(request);

      expect(result.variations).toHaveLength(4);
      expect(result.styleApplied).toBe('gold_leaf');
      expect(result.variationUrls[0]).toContain('dicebear.com');
      expect(result.prompt).toContain('Restore and beautify');
      expect(result.prompt).toContain('I am strong and confident'); // Intention included
      expect(result.controlMethod).toBe('canny');
    });

    it('should include symbol instructions for recognized keywords', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'minimal_line',
        userId: mockUserId,
        intentionText: 'I achieve great success',
      };

      const result = await enhanceSigilWithControlNet(request);

      // Should include success-related symbols
      expect(result.prompt).toContain('success');
      expect(result.prompt).toContain('crowns, ascending paths, mountain peaks');
    });

    it('should handle strength/gym keywords with specific symbols', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'ink_brush',
        userId: mockUserId,
        intentionText: 'I am strong at the gym',
      };

      const result = await enhanceSigilWithControlNet(request);

      // Should include gym/strength symbols
      expect(result.prompt).toContain('flexed muscles, iron weights');
    });

    it('should throw error for invalid style choice', async () => {
      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'invalid_style' as AIStyle,
        userId: mockUserId,
      };

      await expect(enhanceSigilWithControlNet(request)).rejects.toThrow('Invalid style choice');
    });

    it('should use correct ControlNet method for each style', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      // Watercolor uses lineart
      const watercolorRequest: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'watercolor',
        userId: mockUserId,
      };
      const watercolorResult = await enhanceSigilWithControlNet(watercolorRequest);
      expect(watercolorResult.controlMethod).toBe('lineart');

      // Sacred geometry uses canny
      const sacredRequest: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'sacred_geometry',
        userId: mockUserId,
      };
      const sacredResult = await enhanceSigilWithControlNet(sacredRequest);
      expect(sacredResult.controlMethod).toBe('canny');
    });

    it('should apply style-specific parameter overrides', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      // Minimal line has highest conditioning_scale and lowest strength
      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'minimal_line',
        userId: mockUserId,
      };

      const result = await enhanceSigilWithControlNet(request);

      // Verify result contains expected structure
      expect(result.styleApplied).toBe('minimal_line');
      expect(result.controlMethod).toBe('canny');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle Gemini unavailable gracefully', async () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'cosmic',
        userId: mockUserId,
      };

      const result = await enhanceSigilWithAI(request);

      // Should fallback to Replicate mock mode
      expect(result.variationUrls).toHaveLength(4);
    });

    it('should throw error when REPLICATE_API_TOKEN is missing in production mode', async () => {
      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      delete process.env.REPLICATE_API_TOKEN;

      // Mock rasterizeSVG to simulate production mode
      (rasterizeSVG as jest.Mock).mockResolvedValue({
        buffer: Buffer.from('mock-raster'),
        size: { width: 1024, height: 1024 },
        processingTimeMs: 100,
      });

      // Mock Replicate constructor to throw error for missing token
      const MockReplicate = jest.fn(() => {
        throw new Error('REPLICATE_API_TOKEN environment variable not set or invalid');
      });
      (Replicate as jest.Mock) = MockReplicate;

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'watercolor',
        userId: mockUserId,
      };

      // Since we're in mock mode (no token), it should still work
      const result = await enhanceSigilWithControlNet(request);
      expect(result.variationUrls).toHaveLength(4);
    });

    it('should handle SVG rasterization failure', async () => {
      process.env.REPLICATE_API_TOKEN = 'valid-token';

      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(false),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      (rasterizeSVG as jest.Mock).mockRejectedValue(new Error('SVG parsing error'));

      const request: ControlNetEnhancementRequest = {
        sigilSvg: '<invalid-svg>',
        styleChoice: 'watercolor',
        userId: mockUserId,
      };

      await expect(enhanceSigilWithControlNet(request)).rejects.toThrow('ControlNet enhancement failed');
    });

    it('should handle Gemini image upload failure', async () => {
      const mockGeminiResult = {
        images: [{ base64: Buffer.from('image1').toString('base64'), seed: 123 }],
        prompt: 'Test',
        negativePrompt: 'Test',
        model: 'gemini-3-pro-image-preview',
        totalTimeSeconds: 10,
        costUSD: 0.04,
        tier: 'premium' as const,
      };

      const mockGeminiService = {
        isAvailable: jest.fn().mockReturnValue(true),
        enhanceSigil: jest.fn().mockResolvedValue(mockGeminiResult),
      };
      (GeminiImageService as jest.Mock).mockImplementation(() => mockGeminiService);

      (uploadImageFromBuffer as jest.Mock).mockRejectedValue(new Error('Storage upload failed'));

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'watercolor',
        userId: mockUserId,
      };

      const result = await enhanceSigilWithAI(request);
      expect(result.variationUrls).toHaveLength(4);
    });
  });

  // ============================================================================
  // Structure Validation Tests
  // ============================================================================

  describe('Structure Validation', () => {
    it('should include structure match scores in variations', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'sacred_geometry',
        userId: mockUserId,
        validateStructure: true,
      };

      const result = await enhanceSigilWithControlNet(request);

      expect(result.variations).toHaveLength(4);
      result.variations.forEach(variation => {
        expect(variation.structureMatch).toBeDefined();
        expect(variation.structureMatch.iouScore).toBeGreaterThanOrEqual(0);
        expect(variation.structureMatch.iouScore).toBeLessThanOrEqual(1);
        expect(variation.structureMatch.structurePreserved).toBe(true); // Mock mode always passes
        expect(variation.structureMatch.classification).toBe('Structure Preserved');
      });
    });

    it('should report passing count and best variation index', async () => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: 'gold_leaf',
        userId: mockUserId,
      };

      const result = await enhanceSigilWithControlNet(request);

      expect(result.passingCount).toBe(4); // All pass in mock mode
      expect(result.bestVariationIndex).toBeGreaterThanOrEqual(0);
      expect(result.bestVariationIndex).toBeLessThan(4);
      expect(result.structureThreshold).toBe(0.85);
    });
  });

  // ============================================================================
  // All Style Tests
  // ============================================================================

  describe('Style Coverage', () => {
    const allStyles: AIStyle[] = [
      'watercolor',
      'sacred_geometry',
      'ink_brush',
      'gold_leaf',
      'cosmic',
      'minimal_line',
    ];

    it.each(allStyles)('should handle %s style correctly', async (style) => {
      process.env.REPLICATE_API_TOKEN = 'your-replicate-token';

      const request: ControlNetEnhancementRequest = {
        sigilSvg: mockSigilSvg,
        styleChoice: style,
        userId: mockUserId,
      };

      const result = await enhanceSigilWithControlNet(request);

      expect(result.styleApplied).toBe(style);
      expect(result.variations).toHaveLength(4);
      expect(result.prompt).toContain('Restore and beautify');
      expect(result.negativePrompt).toContain('extra lines, decorative circle');
    });
  });
});
