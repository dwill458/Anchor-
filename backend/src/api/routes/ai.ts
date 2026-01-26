/**
 * Anchor App - AI Enhancement API Routes
 *
 * Endpoints for Phase 2 AI features:
 * - Intention analysis
 * - AI-enhanced sigil generation
 * - Mantra generation
 */

import express, { Request, Response } from 'express';
import {
  getCostEstimate,
  enhanceSigilWithAI,
  enhanceSigilWithControlNet,
  estimateControlNetGenerationTime,
  AIStyle,
} from '../../services/AIEnhancer';
import { generateMantra, getRecommendedMantraStyle } from '../../services/MantraGenerator';
import { uploadImageFromUrl } from '../../services/StorageService';
import {
  generateAllMantraAudio,
  isTTSAvailable,
  getAvailableVoicePresets,
} from '../../services/TTSService';
import { logger } from '../../utils/logger';
import { GoogleImagenV3 } from '../../services/GoogleImagenV3';
import { StorageService } from '../../services/StorageService';
import { authMiddleware as authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * POST /api/ai/analyze
 * @deprecated - Legacy endpoint, no longer used in Phase 3+ flow
 * This endpoint was part of the old AI analysis flow that has been replaced
 * by StyleSelectionScreen and ControlNet enhancement.
 */
// router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
//   ... (removed - legacy code)
// });

/**
 * POST /api/ai/enhance
 * 
 * Enhance a base sigil with AI-generated symbolic imagery
 */
router.post('/enhance', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      baseSigilSvg,
      intentionText,
      styleApproach
    } = req.body;

    // Validation
    if (!baseSigilSvg) {
      res.status(400).json({
        success: false,
        error: 'baseSigilSvg is required'
      });
      return;
    }

    if (!intentionText) {
      res.status(400).json({
        success: false,
        error: 'intentionText is required'
      });
      return;
    }

    if (!styleApproach) {
      res.status(400).json({
        success: false,
        error: 'styleApproach is required'
      });
      return;
    }

    console.log(`\n🎯 AI Enhancement Request`);
    console.log(`   Intention: "${intentionText}"`);
    console.log(`   Style: ${styleApproach}`);

    // Initialize services
    const imagenService = new GoogleImagenV3();
    const storageService = new StorageService();

    // Generate enhanced variations
    const result = await imagenService.enhanceSigil({
      baseSigilSvg,
      intentionText,
      styleApproach,
      numberOfVariations: 4
    });

    console.log(`📤 Uploading ${result.images.length} images to R2...`);

    // Upload all images to Cloudflare R2
    const uploadedVariations = await Promise.all(
      result.images.map(async (img: any, index: number) => {
        const filename = `anchor-${Date.now()}-variation-${index + 1}.png`;
        const imageBuffer = Buffer.from(img.base64, 'base64');

        const imageUrl = await storageService.uploadImage(
          imageBuffer,
          filename
        );

        return {
          imageUrl,
          seed: img.seed,
          variationIndex: img.variationIndex
        };
      })
    );

    console.log(`✅ All images uploaded successfully\n`);

    // Return response
    res.json({
      success: true,
      data: {
        variations: uploadedVariations,
        generationTimeSeconds: result.totalTimeSeconds,
        costUSD: result.costUSD,
        provider: 'google-imagen3',
        metadata: {
          intention: intentionText,
          style: styleApproach,
          numberOfVariations: result.images.length
        }
      }
    });

  } catch (error: any) {
    console.error('❌ AI enhancement failed:', error);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to enhance sigil',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/ai/enhance-controlnet
 * Generate AI-enhanced sigil variations using ControlNet with STRICT structure preservation.
 *
 * Key features:
 * - Structure preservation validation (IoU scoring)
 * - Per-variation structureMatchScore
 * - structurePreserved boolean per variation
 * - Supports 6 validated styles: watercolor, sacred_geometry, ink_brush,
 *   gold_leaf, cosmic, minimal_line
 *
 * Response includes:
 * - variations: Array of {imageUrl, structureMatchScore, structurePreserved, classification}
 * - passingCount: Number of variations that pass structure threshold
 * - bestVariationIndex: Index of highest scoring variation
 */
router.post('/enhance-controlnet', async (req: Request, res: Response): Promise<void> => {
  console.log('[API] /enhance-controlnet POST received');
  console.log('[API] Request body keys:', Object.keys(req.body));

  try {
    const {
      sigilSvg,
      styleChoice,
      userId,
      anchorId,
      validateStructure,
      autoComposite,
      provider  // Optional: 'google' | 'replicate' | 'auto' (default: 'auto')
    } = req.body;
    console.log('[API] Parsed request:', {
      sigilSvgLength: sigilSvg?.length || 0,
      styleChoice,
      userId,
      anchorId,
      validateStructure,
      autoComposite,
      provider: provider || 'auto'
    });

    // Validation
    if (!sigilSvg || !styleChoice || !userId || !anchorId) {
      console.log('[API] Validation failed - missing fields');
      res.status(400).json({
        error: 'Missing required fields: sigilSvg, styleChoice, userId, anchorId',
      });
      return;
    }

    // Validate style choice
    const validStyles: AIStyle[] = [
      'watercolor',
      'sacred_geometry',
      'ink_brush',
      'gold_leaf',
      'cosmic',
      'minimal_line',
    ];

    if (!validStyles.includes(styleChoice as AIStyle)) {
      res.status(400).json({
        error: `Invalid styleChoice. Must be one of: ${validStyles.join(', ')}`,
      });
      return;
    }

    logger.info('[ControlNet] Enhancing sigil with STRICT structure preservation', {
      anchorId,
      style: styleChoice,
      validateStructure: validateStructure !== false,
      provider: provider || 'auto',
    });

    // Generate ControlNet variations with structure validation
    // Use enhanceSigilWithAI for automatic provider selection (Google → Replicate fallback)
    // Or use enhanceSigilWithControlNet directly for Replicate-only
    const useNewPipeline = provider !== 'replicate'; // Use new pipeline unless explicitly requesting Replicate

    const enhancementResult = useNewPipeline
      ? await enhanceSigilWithAI({
        sigilSvg,
        styleChoice: styleChoice as AIStyle,
        userId,
        validateStructure: validateStructure !== false,
        autoComposite: autoComposite === true,
      })
      : await enhanceSigilWithControlNet({
        sigilSvg,
        styleChoice: styleChoice as AIStyle,
        userId,
        validateStructure: validateStructure !== false,
        autoComposite: autoComposite === true,
      });

    logger.info('[ControlNet] Generated variations with structure scores', {
      count: enhancementResult.variations.length,
      passingCount: enhancementResult.passingCount,
      bestScore: enhancementResult.variations[enhancementResult.bestVariationIndex]?.structureMatch.combinedScore,
      style: enhancementResult.styleApplied,
      method: enhancementResult.controlMethod,
    });

    // Upload variations to R2 and get permanent URLs
    const uploadedVariations: Array<{
      imageUrl: string;
      structureMatchScore: number;
      iouScore: number;
      edgeOverlapScore: number;
      structurePreserved: boolean;
      classification: string;
      wasComposited: boolean;
      seed: number;
    }> = [];

    for (let i = 0; i < enhancementResult.variations.length; i++) {
      const variation = enhancementResult.variations[i];

      // Upload to R2
      const permanentUrl = await uploadImageFromUrl(
        variation.imageUrl,
        userId,
        anchorId,
        i
      );

      uploadedVariations.push({
        imageUrl: permanentUrl,
        structureMatchScore: variation.structureMatch.combinedScore,
        iouScore: variation.structureMatch.iouScore,
        edgeOverlapScore: variation.structureMatch.edgeOverlapScore,
        structurePreserved: variation.structureMatch.structurePreserved,
        classification: variation.structureMatch.classification,
        wasComposited: variation.wasComposited,
        seed: variation.seed,
      });
    }

    // Determine which provider was actually used
    const usedProvider = enhancementResult.model.includes('imagen') ? 'google' :
      enhancementResult.model.includes('controlnet') ? 'replicate' :
        'unknown';

    res.json({
      success: true,
      // New format with structure scores
      variations: uploadedVariations,
      // Legacy format for backward compatibility
      variationUrls: uploadedVariations.map(v => v.imageUrl),
      // Generation metadata
      prompt: enhancementResult.prompt,
      negativePrompt: enhancementResult.negativePrompt,
      generationTime: enhancementResult.generationTime,
      model: enhancementResult.model,
      controlMethod: enhancementResult.controlMethod,
      styleApplied: enhancementResult.styleApplied,
      // Provider information
      provider: usedProvider,
      // Structure validation summary
      structureThreshold: enhancementResult.structureThreshold,
      passingCount: enhancementResult.passingCount,
      bestVariationIndex: enhancementResult.bestVariationIndex,
      allPreserved: enhancementResult.passingCount === enhancementResult.variations.length,
    });
  } catch (error) {
    logger.error('[ControlNet] Enhancement error', error);
    res.status(500).json({
      error: 'Failed to enhance sigil with ControlNet',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/mantra
 * Generate mantra from distilled letters
 */
router.post('/mantra', async (req: Request, res: Response): Promise<void> => {
  try {
    const { distilledLetters } = req.body;

    if (!distilledLetters || !Array.isArray(distilledLetters)) {
      res.status(400).json({ error: 'distilledLetters array is required' });
      return;
    }

    if (distilledLetters.length < 2) {
      res.status(400).json({ error: 'Need at least 2 distilled letters' });
      return;
    }

    logger.info('[AI] Generating mantra', { letters: distilledLetters });

    const mantra = generateMantra(distilledLetters);
    const recommended = getRecommendedMantraStyle(distilledLetters.length);

    res.json({
      success: true,
      mantra,
      recommended,
    });
  } catch (error) {
    logger.error('[AI] Mantra generation error', error);
    res.status(500).json({
      error: 'Failed to generate mantra',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/mantra/audio
 * Generate audio for mantras using Google TTS
 */
router.post('/mantra/audio', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mantras, userId, anchorId, voicePreset } = req.body;

    if (!mantras || !userId || !anchorId) {
      res.status(400).json({ error: 'Missing required fields: mantras, userId, anchorId' });
      return;
    }

    if (!isTTSAvailable()) {
      res.status(503).json({
        error: 'Text-to-Speech service not configured',
        message: 'Google Cloud TTS credentials are missing. Audio generation is unavailable.',
      });
      return;
    }

    logger.info('[AI] Generating mantra audio', { anchorId, voicePreset: voicePreset || 'neutral_calm' });

    const audioUrls = await generateAllMantraAudio(
      mantras,
      userId,
      anchorId,
      voicePreset || 'neutral_calm'
    );

    res.json({
      success: true,
      audioUrls,
    });
  } catch (error) {
    logger.error('[AI] Audio generation error', error);
    res.status(500).json({
      error: 'Failed to generate audio',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/ai/voices
 * Get available TTS voice presets
 */
router.get('/voices', (req: Request, res: Response): void => {
  const voices = getAvailableVoicePresets();

  res.json({
    success: true,
    voices,
    available: isTTSAvailable(),
  });
});

/**
 * GET /api/ai/estimate
 * Get time and cost estimates for AI enhancement (ControlNet)
 */
router.get('/estimate', (req: Request, res: Response): void => {
  const timeEstimate = estimateControlNetGenerationTime();
  const costEstimate = getCostEstimate();

  res.json({
    success: true,
    timeEstimate,
    costEstimate,
    method: 'controlnet',
  });
});

/**
 * GET /api/ai/health
 * Health check for AI services
 */
router.get('/health', (req: Request, res: Response): void => {
  const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN;
  const hasR2Config = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
  const hasTTS = isTTSAvailable();

  const status = {
    replicate: hasReplicateToken ? 'configured' : 'missing_token',
    storage: hasR2Config ? 'configured' : 'missing_credentials',
    tts: hasTTS ? 'configured' : 'optional_not_configured',
  };

  const isHealthy = hasReplicateToken && hasR2Config; // TTS is optional

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    services: status,
  });
});

export default router;
