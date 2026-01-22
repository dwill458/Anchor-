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
  enhanceSigil,
  estimateGenerationTime,
  getCostEstimate,
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
 * Generate AI-enhanced sigil variations using Stable Diffusion
 */
router.post('/enhance', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sigilSvg, analysis, userId, anchorId } = req.body;

    // Validation
    if (!sigilSvg || !analysis || !userId || !anchorId) {
      res.status(400).json({ error: 'Missing required fields: sigilSvg, analysis, userId, anchorId' });
      return;
    }

    logger.info('[AI] Enhancing sigil', {
      anchorId,
      intention: analysis.intentionText,
      themes: analysis.themes,
      aesthetic: analysis.aesthetic,
    });

    // Generate AI variations
    const enhancementResult = await enhanceSigil({
      sigilSvg,
      analysis,
      userId,
    });

    logger.info('[AI] Generated variations', { count: enhancementResult.variations.length });

    // Upload variations to R2 and get permanent URLs
    const permanentUrls: string[] = [];

    for (let i = 0; i < enhancementResult.variations.length; i++) {
      const url = await uploadImageFromUrl(
        enhancementResult.variations[i],
        userId,
        anchorId,
        i
      );
      permanentUrls.push(url);
    }

    res.json({
      success: true,
      variations: permanentUrls,
      prompt: enhancementResult.prompt,
      generationTime: enhancementResult.generationTime,
      model: enhancementResult.model,
    });
  } catch (error) {
    logger.error('[AI] Enhancement error', error);
    res.status(500).json({
      error: 'Failed to enhance sigil',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/ai/enhance-controlnet
 * Generate AI-enhanced sigil variations using ControlNet (Phase 3)
 *
 * ControlNet preserves the structure while applying artistic style transfer.
 * Supports 6 validated styles: watercolor, sacred_geometry, ink_brush,
 * gold_leaf, cosmic, minimal_line
 */
router.post('/enhance-controlnet', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sigilSvg, styleChoice, userId, anchorId } = req.body;

    // Validation
    if (!sigilSvg || !styleChoice || !userId || !anchorId) {
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

    logger.info('[ControlNet] Enhancing sigil', {
      anchorId,
      style: styleChoice,
    });

    // Generate ControlNet variations
    const enhancementResult = await enhanceSigilWithControlNet({
      sigilSvg,
      styleChoice: styleChoice as AIStyle,
      userId,
    });

    logger.info('[ControlNet] Generated variations', {
      count: enhancementResult.variations.length,
      style: enhancementResult.styleApplied,
      method: enhancementResult.controlMethod,
    });

    // Upload variations to R2 and get permanent URLs
    const permanentUrls: string[] = [];

    for (let i = 0; i < enhancementResult.variations.length; i++) {
      const url = await uploadImageFromUrl(
        enhancementResult.variations[i],
        userId,
        anchorId,
        i
      );
      permanentUrls.push(url);
    }

    res.json({
      success: true,
      variations: permanentUrls,
      prompt: enhancementResult.prompt,
      negativePrompt: enhancementResult.negativePrompt,
      generationTime: enhancementResult.generationTime,
      model: enhancementResult.model,
      controlMethod: enhancementResult.controlMethod,
      styleApplied: enhancementResult.styleApplied,
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
 * Get time and cost estimates for AI enhancement
 */
router.get('/estimate', (req: Request, res: Response): void => {
  const { method } = req.query;

  let timeEstimate;

  if (method === 'controlnet') {
    timeEstimate = estimateControlNetGenerationTime();
  } else {
    timeEstimate = estimateGenerationTime();
  }

  const costEstimate = getCostEstimate();

  res.json({
    success: true,
    timeEstimate,
    costEstimate,
    method: method || 'legacy',
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
