/**
 * Anchor App - AI Enhancement API Routes
 *
 * Endpoints for Phase 2 AI features:
 * - Intention analysis
 * - AI-enhanced sigil generation
 * - Mantra generation
 */

import express, { Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { AuthRequest, authMiddleware, optionalAuthMiddleware, DEV_MASTER_UID } from '../middleware/auth';
import { prisma } from '../../lib/prisma';
import {
  getCostEstimate,
  enhanceSigilWithAI,
  enhanceSigilWithControlNet,
  estimateGenerationTime,
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

// Per-user rate limiter for the AI image generation endpoint.
// Keyed on the authenticated user's Firebase UID (set by authMiddleware before
// this runs), falling back to IP for any unauthenticated edge cases.
// Limit: 20 generations per hour — generous for normal use, tight enough to
// prevent accidental loops or abuse.
const aiHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  skip: (req) => (req as AuthRequest).user?.uid === DEV_MASTER_UID,
  message: {
    error: 'Too many AI generation requests',
    message: 'You have reached the AI enhancement limit. Please try again in an hour.',
  },
});

// Daily AI generation limit per user — prevents runaway API costs.
// Dev master account is exempt. Configurable via AI_DAILY_LIMIT env var.
// NOTE: Uses in-memory store; resets on server restart. For production,
// consider rate-limit-redis or a DB-backed counter.
const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '10', 10);
const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: AI_DAILY_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  skip: (req) => (req as AuthRequest).user?.uid === DEV_MASTER_UID,
  message: {
    error: 'Daily generation limit reached',
    message: `You have reached your daily limit of ${AI_DAILY_LIMIT} AI generations. Try again tomorrow.`,
  },
});

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

const EnhanceSchema = z.object({
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
  mantras: z.object({
    syllabic: z.string(),
    rhythmic: z.string(),
    phonetic: z.string(),
  }),
  userId: z.string().min(1),
  anchorId: z.string().min(1),
  voicePreset: z.string().optional(),
});

// Validates data against a schema; returns parsed data or sends a 400 response.
// Returns null if validation failed (caller should return early).
function validateOrRespond<T>(schema: z.ZodSchema<T>, data: unknown, res: Response): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    res.status(400).json({ error: `Validation error: ${message}` });
    return null;
  }
  return result.data;
}

/**
 * POST /api/ai/enhance
 * Generate AI-enhanced sigil variations using Gemini (Nano Banana) with
 * STRICT structure preservation.
 *
 * Key features:
 * - Structure preservation validation (IoU scoring)
 * - Per-variation structureMatchScore
 * - structurePreserved boolean per variation
 * - Supports 12 validated styles
 *
 * Response includes:
 * - variations: Array of {imageUrl, structureMatchScore, structurePreserved, classification}
 * - passingCount: Number of variations that pass structure threshold
 * - bestVariationIndex: Index of highest scoring variation
 */
// Timeout wrapper: rejects after `ms` milliseconds with a typed error
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'UPSTREAM_TIMEOUT' })
      );
    }, ms);
    promise.then(
      v => {
        clearTimeout(timer);
        resolve(v);
      },
      e => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

// 3 minutes — generous for image generation but prevents hung requests
const AI_GENERATION_TIMEOUT_MS = 3 * 60 * 1000;

// Handler shared by /enhance and legacy /enhance-controlnet alias
async function handleEnhance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = validateOrRespond(EnhanceSchema, req.body, res);
      if (!parsed) return;

      // Onboarding flow generates a "temp-*" anchor before the user has an
      // account. Those requests are permitted without auth (still IP rate
      // limited above). Every other path must be authenticated.
      const isTempAnchor = parsed.anchorId.startsWith('temp-');
      if (!isTempAnchor && !req.user?.uid) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'A valid authentication token is required for AI enhancement.',
        });
        return;
      }

      const {
        sigilSvg,
        styleChoice,
        anchorId,
        intentionText: bodyIntentionText,
        intention: bodyIntention,
        validateStructure,
        autoComposite,
        provider, // Optional: 'gemini' | 'replicate' | 'auto' (default: 'auto')
        tier, // Optional: 'draft' | 'premium' (default: 'premium')
        generationAttempt, // Optional: int starting at 1; pro users upgrade to pro model at attempt 3+
      } = parsed;

      // Support both field names for maximum compatibility
      const intentionText = bodyIntentionText || bodyIntention;

      // Sanitize attempt count — default to 1 if missing or invalid
      const parsedAttempt =
        typeof generationAttempt === 'number' && generationAttempt > 0 ? generationAttempt : 1;

      // Flash for all standard enhancements; Pro model only on regeneration (attempt 2+)
      const effectiveTier: 'draft' | 'premium' | 'pro_upgrade' =
        parsedAttempt >= 2
          ? 'pro_upgrade'
          : 'premium';

      // --- Database lookups ---
      // Anonymous onboarding requests (temp-* anchor) skip the user lookup
      // and use a synthetic storage id so uploaded images are still namespaced.
      // Dev master account also bypasses DB lookup — it has no real DB record.
      let user: { id: string };
      if (req.user?.uid && req.user.uid !== DEV_MASTER_UID) {
        let dbUser: { id: string } | null;
        try {
          dbUser = await prisma.user.findUnique({
            where: { authUid: req.user.uid },
            select: { id: true },
          });
        } catch (dbError) {
          logger.error('[AI Enhance] Database error during user lookup', dbError);
          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Unable to reach the database. Please try again shortly.',
          });
          return;
        }

        if (!dbUser) {
          res.status(404).json({
            error: 'User not found',
            message: 'Create or sync your account before generating AI artwork.',
          });
          return;
        }
        user = dbUser;
      } else {
        // Anonymous onboarding path or dev master account — synthesize a
        // throwaway id for storage pathing. Nothing is persisted to the User table.
        user = { id: req.user?.uid ?? `anon-${Date.now()}` };
      }

      const isTempAnchorRequest = anchorId.startsWith('temp-');
      const storageAnchorId = isTempAnchorRequest ? `temp-${Date.now()}` : anchorId;

      if (!isTempAnchorRequest) {
        let anchor: { id: string } | null;
        try {
          anchor = await prisma.anchor.findFirst({
            where: {
              id: anchorId,
              userId: user.id,
            },
            select: { id: true },
          });
        } catch (dbError) {
          logger.error('[AI Enhance] Database error during anchor lookup', dbError);
          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Unable to reach the database. Please try again shortly.',
          });
          return;
        }

        if (!anchor) {
          res.status(404).json({
            error: 'Anchor not found',
            message: 'AI enhancement is only allowed for anchors you own.',
          });
          return;
        }
      }

      logger.debug('[API] enhance request', {
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

      logger.info('[AI Enhance] Enhancing sigil with STRICT structure preservation', {
        anchorId,
        style: styleChoice,
        validateStructure: validateStructure !== false,
        provider: provider || 'auto',
      });

      const requestBaseUrl = `${req.protocol}://${req.get('host')}`;

      // --- AI Generation (with timeout) ---
      // Use enhanceSigilWithAI for automatic provider selection (Google → Replicate fallback)
      // Or use enhanceSigilWithControlNet directly for Replicate-only
      const useNewPipeline = provider !== 'replicate';

      let enhancementResult: Awaited<ReturnType<typeof enhanceSigilWithAI>>;
      try {
        enhancementResult = await withTimeout(
          useNewPipeline
            ? enhanceSigilWithAI({
                sigilSvg,
                styleChoice: styleChoice as AIStyle,
                userId: user.id,
                intentionText,
                validateStructure: validateStructure !== false,
                autoComposite: autoComposite === true,
                tier: effectiveTier,
              })
            : enhanceSigilWithControlNet({
                sigilSvg,
                styleChoice: styleChoice as AIStyle,
                userId: user.id,
                intentionText,
                validateStructure: validateStructure !== false,
                autoComposite: autoComposite === true,
                tier: effectiveTier,
              }),
          AI_GENERATION_TIMEOUT_MS,
          'AI image generation'
        );
      } catch (aiError: unknown) {
        const err = aiError as Error & { code?: string; status?: number };
        if (err.code === 'UPSTREAM_TIMEOUT') {
          logger.error('[AI Enhance] Generation timed out', {
            anchorId,
            style: styleChoice,
            provider: provider || 'auto',
          });
          res.status(504).json({
            error: 'Generation timed out',
            message: 'The AI service took too long to respond. Please try again.',
          });
          return;
        }
        // Surface provider-level quota/auth errors distinctly
        if (
          err.status === 429 ||
          err.message?.includes('quota') ||
          err.message?.includes('rate limit')
        ) {
          logger.warn('[AI Enhance] Upstream rate limit hit', { anchorId, message: err.message });
          res.status(503).json({
            error: 'AI service rate limit reached',
            message: 'The image generation service is busy. Please wait a moment and try again.',
          });
          return;
        }
        logger.error('[AI Enhance] AI generation failed', aiError);
        res.status(502).json({
          error: 'AI generation failed',
          message: 'The upstream image generation service encountered an error. Please try again.',
        });
        return;
      }

      logger.info('[AI Enhance] Generated variations with structure scores', {
        count: enhancementResult.variations.length,
        passingCount: enhancementResult.passingCount,
        bestScore:
          enhancementResult.variations[enhancementResult.bestVariationIndex]?.structureMatch
            .combinedScore,
        style: enhancementResult.styleApplied,
        method: enhancementResult.controlMethod,
      });

      // --- Upload variations to R2 (per-variation error handling) ---
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
        let permanentUrl: string;
        try {
          permanentUrl = await uploadImageFromUrl(variation.imageUrl, user.id, storageAnchorId, i, {
            baseUrl: requestBaseUrl,
          });
        } catch (uploadError) {
          logger.error('[AI Enhance] Failed to upload variation to storage', {
            variationIndex: i,
            anchorId,
            error: uploadError instanceof Error ? uploadError.message : String(uploadError),
          });
          // Skip failed uploads rather than aborting the entire response;
          // at least return successfully generated variations.
          continue;
        }

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

      if (uploadedVariations.length === 0) {
        logger.error('[AI Enhance] All variation uploads failed', { anchorId, style: styleChoice });
        res.status(502).json({
          error: 'Image storage failed',
          message: 'AI images were generated but could not be saved. Please try again.',
        });
        return;
      }

      // Recalculate bestVariationIndex based on successfully uploaded variations
      const bestVariationIndex = uploadedVariations.reduce(
        (best, v, idx) =>
          v.structureMatchScore > uploadedVariations[best].structureMatchScore ? idx : best,
        0
      );

      // Determine which provider was actually used
      const modelLower = enhancementResult.model.toLowerCase();
      const usedProvider =
        modelLower.includes('gemini') || modelLower.includes('imagen')
          ? 'gemini'
          : modelLower.includes('controlnet')
            ? 'replicate'
            : 'unknown';

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
        bestVariationIndex,
        allPreserved: enhancementResult.passingCount === enhancementResult.variations.length,
      });
    } catch (error) {
      logger.error('[AI Enhance] Unexpected enhancement error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred during AI enhancement.',
      });
    }
}

// Primary route
router.post('/enhance', optionalAuthMiddleware, aiDailyLimiter, aiHourlyLimiter, handleEnhance);
// Legacy alias — keeps older mobile builds working
router.post('/enhance-controlnet', optionalAuthMiddleware, aiDailyLimiter, aiHourlyLimiter, handleEnhance);

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
router.post(
  '/mantra/audio',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
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

      logger.info('[AI] Generating mantra audio', {
        anchorId,
        voicePreset: voicePreset || 'neutral_calm',
      });

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
  }
);

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
 * Get time and cost estimates for AI enhancement
 */
router.get('/estimate', authMiddleware, (req: AuthRequest, res: Response): void => {
  const timeEstimate = estimateGenerationTime();
  const costEstimate = getCostEstimate();

  res.json({
    success: true,
    timeEstimate,
    costEstimate,
    method: 'gemini',
  });
});

/**
 * GET /api/ai/health
 * Health check for AI services
 */
router.get('/health', authMiddleware, (req: AuthRequest, res: Response): void => {
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN;
  const hasR2Config = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  );
  const hasTTS = isTTSAvailable();

  const status = {
    gemini: hasGeminiKey ? 'configured' : 'missing_key',
    replicate: hasReplicateToken ? 'configured' : 'missing_token',
    storage: hasR2Config ? 'configured' : 'missing_credentials',
    tts: hasTTS ? 'configured' : 'optional_not_configured',
  };

  const isHealthy = hasGeminiKey && hasR2Config; // TTS optional, Replicate legacy fallback only

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    services: status,
  });
});

export default router;
