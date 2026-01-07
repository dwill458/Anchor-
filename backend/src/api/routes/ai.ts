/**
 * Anchor App - AI Enhancement API Routes
 *
 * Endpoints for Phase 2 AI features:
 * - Intention analysis
 * - AI-enhanced sigil generation
 * - Mantra generation
 */

import express, { Request, Response } from 'express';
import { analyzeIntention } from '../../services/IntentionAnalyzer';
import { enhanceSigil, estimateGenerationTime, getCostEstimate } from '../../services/AIEnhancer';
import { generateMantra, getRecommendedMantraStyle } from '../../services/MantraGenerator';
import { uploadImageFromUrl } from '../../services/StorageService';
import {
  generateAllMantraAudio,
  isTTSAvailable,
  getAvailableVoicePresets,
} from '../../services/TTSService';

const router = express.Router();

/**
 * POST /api/ai/analyze
 * Analyze intention text and select appropriate symbols
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { intentionText } = req.body;

    if (!intentionText || typeof intentionText !== 'string') {
      res.status(400).json({ error: 'intentionText is required' });
      return;
    }

    if (intentionText.length < 3) {
      res.status(400).json({ error: 'intentionText must be at least 3 characters' });
      return;
    }

    console.log('[AI] Analyzing intention:', intentionText);

    const analysis = analyzeIntention(intentionText);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('[AI] Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze intention',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

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

    console.log('[AI] Enhancing sigil for anchor:', anchorId);
    console.log('[AI] Intention:', analysis.intentionText);
    console.log('[AI] Themes:', analysis.themes);
    console.log('[AI] Aesthetic:', analysis.aesthetic);

    // Generate AI variations
    const enhancementResult = await enhanceSigil({
      sigilSvg,
      analysis,
      userId,
    });

    console.log('[AI] Generated', enhancementResult.variations.length, 'variations');

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
    console.error('[AI] Enhancement error:', error);
    res.status(500).json({
      error: 'Failed to enhance sigil',
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

    console.log('[AI] Generating mantra from letters:', distilledLetters);

    const mantra = generateMantra(distilledLetters);
    const recommended = getRecommendedMantraStyle(distilledLetters.length);

    res.json({
      success: true,
      mantra,
      recommended,
    });
  } catch (error) {
    console.error('[AI] Mantra generation error:', error);
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

    console.log('[AI] Generating mantra audio for anchor:', anchorId);

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
    console.error('[AI] Audio generation error:', error);
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
  const timeEstimate = estimateGenerationTime();
  const costEstimate = getCostEstimate();

  res.json({
    success: true,
    timeEstimate,
    costEstimate,
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
