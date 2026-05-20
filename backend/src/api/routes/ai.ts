/**
 * Anchor App - AI Enhancement API Routes
 *
 * Endpoints for Phase 2 AI features:
 * - Intention analysis
 * - AI-enhanced sigil generation
 * - Mantra generation
 */

import express, { Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import {
  AuthRequest,
  authMiddleware,
  optionalAuthMiddleware,
  DEV_MASTER_UID,
} from '../middleware/auth';
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
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../../lib/redis';

const router = express.Router();
const TOTAL_VARIATION_OPTIONS = 2;
const MAX_REUSED_VARIATIONS = 2;
const RESERVATION_TTL_MINUTES = 30;

const aiHourlyLimiterStore =
  process.env.NODE_ENV === 'test' || !process.env.REDIS_URL
    ? undefined
    : new RedisStore({
        prefix: 'rl:ai:hourly:',
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });

const aiDailyLimiterStore =
  process.env.NODE_ENV === 'test' || !process.env.REDIS_URL
    ? undefined
    : new RedisStore({
        prefix: 'rl:ai:daily:',
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      });

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
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  skip: req => (req as AuthRequest).user?.uid === DEV_MASTER_UID,
  message: {
    error: 'Too many AI generation requests',
    message: 'You have reached the AI enhancement limit. Please try again in an hour.',
  },
  store: aiHourlyLimiterStore,
});

// Daily AI generation limit per user — prevents runaway API costs.
// Dev master account is exempt. Configurable via AI_DAILY_LIMIT env var.
// NOTE: Uses RedisStore to persist across Railway restarts/multi-instance.
const AI_DAILY_LIMIT = parseInt(process.env.AI_DAILY_LIMIT || '10', 10);
const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: AI_DAILY_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as AuthRequest).user?.uid || ipKeyGenerator(req.ip ?? ''),
  skip: req => (req as AuthRequest).user?.uid === DEV_MASTER_UID,
  message: {
    error: 'Daily generation limit reached',
    message: `You have reached your daily limit of ${AI_DAILY_LIMIT} AI generations. Try again tomorrow.`,
  },
  store: aiDailyLimiterStore,
});

// --- Zod schemas ---

const VALID_STYLES = [
  'watercolor',
  'sacred_geometry',
  'ink_brush',
  'gold_leaf',
  'cosmic',
  'architectural_trace',
  'lunar_etch',
  'resonance_rings',
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

function normalizeIntentionKey(intentionText?: string): string {
  return (intentionText || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashSigilSvg(sigilSvg: string): string {
  return createHash('sha256').update(sigilSvg).digest('hex');
}

function buildVariationFingerprint(input: {
  sigilSvg: string;
  intentionText?: string;
  styleChoice: string;
}): { fingerprint: string; intentionKey: string; structureHash: string } {
  const intentionKey = normalizeIntentionKey(input.intentionText);
  const structureHash = hashSigilSvg(input.sigilSvg);
  const fingerprint = `${input.styleChoice}::${structureHash}::${intentionKey}`;
  return { fingerprint, intentionKey, structureHash };
}

function buildReservationExpiry(): Date {
  return new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);
}

type ClientVariation = {
  variationId: string;
  imageUrl: string;
  structureMatchScore: number;
  iouScore: number;
  edgeOverlapScore: number;
  structurePreserved: boolean;
  classification: string;
  wasComposited: boolean;
  seed: number;
  reusedFromPool: boolean;
};

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
      parsedAttempt >= 2 ? 'pro_upgrade' : 'premium';

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
    const reuseRequestId = randomUUID();
    const { fingerprint, intentionKey, structureHash } = buildVariationFingerprint({
      sigilSvg,
      intentionText,
      styleChoice,
    });

    let reservedPoolVariations: ClientVariation[] = [];
    let reservedPoolRows: any[] = [];
    try {
      await prisma.anchorVariationPool.updateMany({
        where: {
          status: 'reserved',
          reservedUntil: { lt: new Date() },
        },
        data: {
          status: 'available',
          reservedByRequestId: null,
          reservedAt: null,
          reservedUntil: null,
        },
      });

      const poolCandidates = await prisma.anchorVariationPool.findMany({
        where: {
          fingerprint,
          status: 'available',
        },
        orderBy: {
          createdAt: 'asc',
        },
        take: MAX_REUSED_VARIATIONS,
      });

      if (poolCandidates.length > 0) {
        const candidateIds = poolCandidates.map(variation => variation.id);
        await prisma.anchorVariationPool.updateMany({
          where: {
            id: { in: candidateIds },
            status: 'available',
          },
          data: {
            status: 'reserved',
            reservedByRequestId: reuseRequestId,
            reservedAt: new Date(),
            reservedUntil: buildReservationExpiry(),
          },
        });

        reservedPoolRows = await prisma.anchorVariationPool.findMany({
          where: {
            id: { in: candidateIds },
            status: 'reserved',
            reservedByRequestId: reuseRequestId,
          },
        });

        const reservedById = new Map(reservedPoolRows.map(variation => [variation.id, variation]));
        reservedPoolVariations = candidateIds
          .map(id => reservedById.get(id))
          .filter((variation): variation is NonNullable<typeof variation> => Boolean(variation))
          .map(variation => ({
            variationId: variation.id,
            imageUrl: variation.imageUrl,
            structureMatchScore: variation.structureMatchScore ?? 0,
            iouScore: variation.iouScore ?? 0,
            edgeOverlapScore: variation.edgeOverlapScore ?? 0,
            structurePreserved: variation.structurePreserved ?? false,
            classification: variation.classification ?? 'Reused',
            wasComposited: false,
            seed: variation.seed ?? 0,
            reusedFromPool: true,
          }));
      }
    } catch (poolError) {
      logger.warn('[AI Enhance] Variation pool lookup failed; continuing with fresh generation', {
        anchorId,
        style: styleChoice,
        error: poolError instanceof Error ? poolError.message : String(poolError),
      });
      reservedPoolVariations = [];
      reservedPoolRows = [];
    }

    const numberOfVariationsToGenerate = TOTAL_VARIATION_OPTIONS - reservedPoolVariations.length;

    let promptUsed = '';
    let negativePromptUsed = '';
    let generationTime = 0;
    let modelName = 'none';
    let controlMethod = 'none';
    let styleApplied = styleChoice;
    let usedProvider = 'none';
    let structureThreshold = 0.85;

    const pooledGeneratedVariations: ClientVariation[] = [];

    if (numberOfVariationsToGenerate > 0) {
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
                numberOfVariations: numberOfVariationsToGenerate,
              })
            : enhanceSigilWithControlNet({
                sigilSvg,
                styleChoice: styleChoice as AIStyle,
                userId: user.id,
                intentionText,
                validateStructure: validateStructure !== false,
                autoComposite: autoComposite === true,
                tier: effectiveTier,
                numberOfVariations: numberOfVariationsToGenerate,
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

      promptUsed = enhancementResult.prompt;
      negativePromptUsed = enhancementResult.negativePrompt;
      generationTime = enhancementResult.generationTime;
      modelName = enhancementResult.model;
      controlMethod = enhancementResult.controlMethod;
      styleApplied = enhancementResult.styleApplied;
      structureThreshold = enhancementResult.structureThreshold;

      const modelLower = enhancementResult.model.toLowerCase();
      usedProvider =
        modelLower.includes('gemini') || modelLower.includes('imagen')
          ? 'gemini'
          : modelLower.includes('controlnet')
            ? 'replicate'
            : 'unknown';

      // --- Upload variations to R2 (per-variation error handling) ---
      const uploadedVariations: ClientVariation[] = [];

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
          variationId: '',
          imageUrl: permanentUrl,
          structureMatchScore: variation.structureMatch.combinedScore,
          iouScore: variation.structureMatch.iouScore,
          edgeOverlapScore: variation.structureMatch.edgeOverlapScore,
          structurePreserved: variation.structureMatch.structurePreserved,
          classification: variation.structureMatch.classification,
          wasComposited: variation.wasComposited,
          seed: variation.seed,
          reusedFromPool: false,
        });
      }

      for (const variation of uploadedVariations) {
        try {
          const pooledVariation = await prisma.anchorVariationPool.create({
            data: {
              fingerprint,
              intentionKey,
              structureHash,
              styleChoice,
              imageUrl: variation.imageUrl,
              status: 'reserved',
              reservedByRequestId: reuseRequestId,
              reservedAt: new Date(),
              reservedUntil: buildReservationExpiry(),
              sourceProvider: usedProvider,
              sourceModel: modelName,
              sourcePrompt: promptUsed,
              sourceNegativePrompt: negativePromptUsed,
              seed: variation.seed,
              structureMatchScore: variation.structureMatchScore,
              iouScore: variation.iouScore,
              edgeOverlapScore: variation.edgeOverlapScore,
              structurePreserved: variation.structurePreserved,
              classification: variation.classification,
            },
          });

          pooledGeneratedVariations.push({
            ...variation,
            variationId: pooledVariation.id,
          });
        } catch (poolInsertError) {
          logger.warn('[AI Enhance] Failed to insert generated variation into reuse pool', {
            anchorId,
            imageUrl: variation.imageUrl,
            error:
              poolInsertError instanceof Error ? poolInsertError.message : String(poolInsertError),
          });
          pooledGeneratedVariations.push(variation);
        }
      }
    } else {
      const firstReserved = reservedPoolRows[0];
      if (firstReserved) {
        usedProvider = firstReserved.sourceProvider || 'unknown';
        modelName = firstReserved.sourceModel || 'unknown';
        promptUsed = firstReserved.sourcePrompt || '';
        negativePromptUsed = firstReserved.sourceNegativePrompt || '';
        generationTime = 0;
        controlMethod = 'lineart';
        styleApplied = (firstReserved.styleChoice as AIStyle) || styleChoice;
      }
    }

    const responseVariations = [...reservedPoolVariations, ...pooledGeneratedVariations];

    if (responseVariations.length === 0) {
      logger.error('[AI Enhance] All variation uploads failed', { anchorId, style: styleChoice });
      res.status(502).json({
        error: 'Image storage failed',
        message: 'AI images were generated but could not be saved. Please try again.',
      });
      return;
    }

    // Recalculate bestVariationIndex based on successfully prepared variations
    const bestVariationIndex = responseVariations.reduce(
      (best, v, idx) =>
        v.structureMatchScore > responseVariations[best].structureMatchScore ? idx : best,
      0
    );
    const passingCount = responseVariations.filter(v => v.structurePreserved).length;

    res.json({
      success: true,
      // New format with structure scores
      variations: responseVariations,
      // Legacy format for backward compatibility
      variationUrls: responseVariations.map(v => v.imageUrl),
      // Generation metadata
      prompt: promptUsed,
      negativePrompt: negativePromptUsed,
      generationTime: generationTime,
      model: modelName,
      controlMethod: controlMethod,
      styleApplied: styleApplied,
      // Provider information
      provider: usedProvider,
      reuseRequestId,
      // Structure validation summary
      structureThreshold: structureThreshold,
      passingCount,
      bestVariationIndex,
      allPreserved: passingCount === responseVariations.length,
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
router.post(
  '/enhance-controlnet',
  optionalAuthMiddleware,
  aiDailyLimiter,
  aiHourlyLimiter,
  handleEnhance
);

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
      const { mantras, anchorId, voicePreset } = parsed;

      if (!req.user?.uid) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'A valid authentication token is required for mantra audio generation.',
        });
        return;
      }

      const dbUser = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
        select: { id: true },
      });

      if (!dbUser) {
        res.status(404).json({
          error: 'User not found',
          message: 'Create or sync your account before generating mantra audio.',
        });
        return;
      }

      const anchor = await prisma.anchor.findFirst({
        where: {
          id: anchorId,
          userId: dbUser.id,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!anchor) {
        res.status(404).json({
          error: 'Anchor not found',
          message: 'Audio generation is only allowed for anchors you own.',
        });
        return;
      }

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
        anchor.userId,
        anchor.id,
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
