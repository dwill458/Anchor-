/**
 * Anchor App - AI Enhancement API Routes
 *
 * Endpoints for Phase 2 AI features:
 * - Intention analysis
 * - AI-enhanced sigil generation
 * - Mantra generation
 */

import express, { Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../../lib/prisma';
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

const router = express.Router();

// --- Zod schemas ---

const VALID_STYLES = [
  'watercolor',
  'sacred_geometry',
  'ink_brush',
  'gold_leaf',
  'cosmic',
  'minimal_line',
  'obsidian_mono',
  'aurora_glow',
  'ember_trace',
  'echo_chamber',
  'monolith_ink',
  'celestial_grid',
] as const;

const EnhanceControlNetSchema = z.object({
  sigilSvg: z.string().min(1),
  styleChoice: z.enum(VALID_STYLES),
  anchorId: z.string().min(1),
  intentionText: z.string().optional(),
  intention: z.string().optional(),
  validateStructure: z.boolean().optional(),
  autoComposite: z.boolean().optional(),
  provider: z.enum(['gemini', 'replicate', 'auto']).optional(),
  tier: z.enum(['draft', 'premium']).optional(),
  generationAttempt: z.number().optional(),
});

const MantraSchema = z.object({
  distilledLetters: z.array(z.string()).min(2).max(20),
});

const MantraAudioSchema = z.object({
  mantras: z.array(z.unknown()).min(1),
  userId: z.string().min(1),
  anchorId: z.string().min(1),
  voicePreset: z.string().optional(),
});

// Validates data against a schema; returns parsed data or sends a 400 response.
// Returns null if validation failed (caller should return early).
function validateOrRespond<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  res: Response
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({ error: `Validation error: ${message}` });
    return null;
  }
  return result.data;
}

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
 * @deprecated - Legacy endpoint, replaced by /enhance-controlnet
 * The enhanceSigil function was removed in Phase 4 cleanup.
 */
// Legacy route commented out - use /enhance-controlnet instead

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
router.post('/enhance-controlnet', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'A valid authentication token is required for AI enhancement.',
      });
      return;
    }

    const parsed = validateOrRespond(EnhanceControlNetSchema, req.body, res);
    if (!parsed) return;

    const {
      sigilSvg,
      styleChoice,
      anchorId,
      intentionText: bodyIntentionText,
      intention: bodyIntention,
      validateStructure,
      autoComposite,
      provider,          // Optional: 'gemini' | 'replicate' | 'auto' (default: 'auto')
      tier,              // Optional: 'draft' | 'premium' (default: 'premium')
      generationAttempt, // Optional: int starting at 1; pro users upgrade to pro model at attempt 3+
    } = parsed;

    // Support both field names for maximum compatibility
    const intentionText = bodyIntentionText || bodyIntention;

    // Sanitize attempt count — default to 1 if missing or invalid
    const parsedAttempt = typeof generationAttempt === 'number' && generationAttempt > 0
      ? generationAttempt : 1;

    // Pro users auto-upgrade to the pro model after 2 flash attempts for the same anchor
    const effectiveTier: 'draft' | 'premium' | 'pro_upgrade' =
      tier === 'premium' && parsedAttempt > 2
        ? 'pro_upgrade'
        : ((tier as 'draft' | 'premium') || 'premium');

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({
        error: 'User not found',
        message: 'Create or sync your account before generating AI artwork.',
      });
      return;
    }

    const isTempAnchorRequest = anchorId.startsWith('temp-');
    const storageAnchorId = isTempAnchorRequest ? `temp-${Date.now()}` : anchorId;

    if (!isTempAnchorRequest) {
      const anchor = await prisma.anchor.findFirst({
        where: {
          id: anchorId,
          userId: user.id,
        },
        select: { id: true },
      });

      if (!anchor) {
        res.status(404).json({
          error: 'Anchor not found',
          message: 'AI enhancement is only allowed for anchors you own.',
        });
        return;
      }
    }

    logger.debug('[API] enhance-controlnet request', {
      sigilSvgLength: sigilSvg?.length || 0,
      styleChoice,
      userId: user.id,
      anchorId,
      validateStructure,
      autoComposite,
      provider: provider || 'auto',
      tier: tier || 'premium',
      generationAttempt: parsedAttempt,
      effectiveTier,
    });

    logger.info('[ControlNet] Enhancing sigil with STRICT structure preservation', {
      anchorId,
      style: styleChoice,
      validateStructure: validateStructure !== false,
      provider: provider || 'auto',
    });

    const requestBaseUrl = `${req.protocol}://${req.get('host')}`;

    // Generate ControlNet variations with structure validation
    // Use enhanceSigilWithAI for automatic provider selection (Google → Replicate fallback)
    // Or use enhanceSigilWithControlNet directly for Replicate-only
    const useNewPipeline = provider !== 'replicate'; // Use new pipeline unless explicitly requesting Replicate

    const enhancementResult = useNewPipeline
      ? await enhanceSigilWithAI({
        sigilSvg,
        styleChoice: styleChoice as AIStyle,
        userId: user.id,
        intentionText,  // Pass through intention for thematic symbols
        validateStructure: validateStructure !== false,
        autoComposite: autoComposite === true,
        tier: effectiveTier,
      })
      : await enhanceSigilWithControlNet({
        sigilSvg,
        styleChoice: styleChoice as AIStyle,
        userId: user.id,
        intentionText,  // Pass through intention for thematic symbols
        validateStructure: validateStructure !== false,
        autoComposite: autoComposite === true,
        tier: effectiveTier,
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
        user.id,
        storageAnchorId,
        i,
        { baseUrl: requestBaseUrl }
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
    const modelLower = enhancementResult.model.toLowerCase();
    const usedProvider = (modelLower.includes('gemini') || modelLower.includes('imagen')) ? 'gemini' :
      modelLower.includes('controlnet') ? 'replicate' :
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
router.post('/mantra', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = validateOrRespond(MantraSchema, req.body, res);
    if (!parsed) return;
    const { distilledLetters } = parsed;

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
router.post('/mantra/audio', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = validateOrRespond(MantraAudioSchema, req.body, res);
    if (!parsed) return;
    const { mantras, userId, anchorId, voicePreset } = parsed;

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
router.get('/voices', authMiddleware, (req: AuthRequest, res: Response): void => {
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
router.get('/estimate', authMiddleware, (req: AuthRequest, res: Response): void => {
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
router.get('/health', authMiddleware, (req: AuthRequest, res: Response): void => {
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
