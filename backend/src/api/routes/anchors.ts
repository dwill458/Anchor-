/**
 * Anchor App - Anchor Routes
 *
 * Handles CRUD operations for user anchors
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';

// Whitelist of columns that may be used in ORDER BY to prevent injection
const ALLOWED_ORDER_BY = ['updatedAt', 'createdAt', 'category', 'intentionText', 'activationCount', 'lastActivatedAt'] as const;
type AllowedOrderBy = typeof ALLOWED_ORDER_BY[number];

const router = Router();

// --- Zod schemas ---

const StructureVariantEnum = z.enum(['dense', 'balanced', 'minimal']);

const CreateAnchorSchema = z.object({
  intentionText: z.string().min(1).max(500),
  category: z.string().min(1),
  distilledLetters: z.array(z.string()).min(1),
  baseSigilSvg: z.string().min(1).max(5_000_000),
  structureVariant: StructureVariantEnum.optional(),
  // Optional fields passed through without strict validation
  reinforcedSigilSvg: z.string().optional(),
  reinforcementMetadata: z.unknown().optional(),
  enhancedImageUrl: z.string().optional(),
  enhancementMetadata: z.unknown().optional(),
  mantraText: z.string().optional(),
  mantraPronunciation: z.string().optional(),
  mantraAudioUrl: z.string().optional(),
});

const UpdateAnchorSchema = z.object({
  intentionText: z.string().min(1).max(500).optional(),
  category: z.string().min(1).max(100).optional(),
  structureVariant: StructureVariantEnum.optional(),
  reinforcedSigilSvg: z.string().max(5_000_000).nullable().optional(),
  reinforcementMetadata: z.unknown().optional(),
  enhancedImageUrl: z.string().url().max(2048).nullable().optional(),
  enhancementMetadata: z.unknown().optional(),
  mantraText: z.string().max(500).nullable().optional(),
  mantraPronunciation: z.string().max(500).nullable().optional(),
  mantraAudioUrl: z.string().url().max(2048).nullable().optional(),
  isCharged: z.boolean().optional(),
  chargedAt: z.string().nullable().optional(),
  chargeMethod: z.string().max(50).nullable().optional(),
  isArchived: z.boolean().optional(),
  archivedAt: z.string().nullable().optional(),
  isShared: z.boolean().optional(),
  sharedAt: z.string().nullable().optional(),
});

const ChargeAnchorSchema = z.object({
  chargeType: z.enum(['initial_quick', 'initial_deep', 'recharge']),
  durationSeconds: z.number().min(1),
});

const ActivateAnchorSchema = z.object({
  activationType: z.enum(['visual', 'mantra', 'deep']),
  durationSeconds: z.number().min(1),
});

// Validates req.body against a schema; throws AppError on failure.
function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
  }
  return result.data;
}

// All anchor routes require authentication
router.use(authMiddleware);

/**
 * Per-router middleware: resolve the Firebase UID to a DB user record once
 * per request and attach it to req.dbUser.
 *
 * This eliminates the repeated prisma.user.findUnique calls that previously
 * appeared in every individual route handler.
 */
router.use(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.uid) {
    next(new AppError('User not authenticated', 401, 'UNAUTHORIZED'));
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
      select: { id: true },
    });
    if (!user) {
      next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
      return;
    }
    req.dbUser = user;
    next();
  } catch {
    next(new AppError('Service temporarily unavailable', 503, 'DB_ERROR'));
  }
});

/**
 * POST /api/anchors
 *
 * Create a new anchor (updated for new architecture)
 *
 * Required Body Fields:
 * - intentionText: User's intention
 * - category: Anchor category
 * - distilledLetters: Array of distilled letters
 * - baseSigilSvg: SVG string of the deterministic structure
 * - structureVariant: Which variant chosen ('dense' | 'balanced' | 'minimal')
 *
 * Optional Body Fields (New Architecture):
 * - reinforcedSigilSvg: User-traced reinforcement version
 * - reinforcementMetadata: Manual reinforcement session data
 * - enhancedImageUrl: AI-styled image URL
 * - enhancementMetadata: AI enhancement details
 * - mantraText: Generated mantra
 * - mantraPronunciation: Mantra pronunciation guide
 * - mantraAudioUrl: URL to mantra audio file
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      structureVariant,
      reinforcedSigilSvg,
      reinforcementMetadata,
      enhancedImageUrl,
      enhancementMetadata,
      mantraText,
      mantraPronunciation,
      mantraAudioUrl,
    } = validate(CreateAnchorSchema, req.body);

    const userId = req.dbUser!.id;

    // Create anchor with new architecture fields
    const anchor = await prisma.anchor.create({
      data: {
        userId,
        intentionText,
        category,
        distilledLetters,

        // Structure lineage
        baseSigilSvg,
        reinforcedSigilSvg: reinforcedSigilSvg || null,
        enhancedImageUrl: enhancedImageUrl || null,

        // Creation path metadata
        structureVariant: structureVariant || 'balanced',
        reinforcementMetadata: reinforcementMetadata ?? Prisma.JsonNull,
        enhancementMetadata: enhancementMetadata ?? Prisma.JsonNull,

        // Mantra
        mantraText: mantraText || null,
        mantraPronunciation: mantraPronunciation || null,
        mantraAudioUrl: mantraAudioUrl || null,

        // Legacy fields (for backward compatibility)
        generationMethod: reinforcedSigilSvg ? 'manual' : 'automated',
      },
    });

    // Update user stats
    await prisma.user.update({
      where: { id: userId },
      data: {
        totalAnchorsCreated: {
          increment: 1,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to create anchor', 500, 'CREATE_ERROR'));
  }
});

/**
 * GET /api/anchors
 *
 * Get all anchors for the authenticated user
 *
 * Query params (optional):
 * - category: Filter by category (1–100 chars)
 * - isCharged: Filter by charged status
 * - limit: Maximum number of anchors to return (1–100, default 20)
 * - cursor: Anchor ID to paginate after (cursor-based pagination)
 * - orderBy: Field to sort by (default: 'updatedAt')
 * - order: Sort direction 'asc' | 'desc' (default: 'desc')
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.dbUser!.id;

    // Build filter conditions
    const where: {
      userId: string;
      category?: string;
      isCharged?: boolean;
      isArchived: boolean;
    } = {
      userId,
      isArchived: false, // Don't show archived anchors by default
    };

    if (req.query.category) {
      const categoryResult = z.string().min(1).max(100).safeParse(req.query.category);
      if (!categoryResult.success) {
        throw new AppError('Invalid category filter: must be 1–100 characters', 400, 'VALIDATION_ERROR');
      }
      where.category = categoryResult.data;
    }

    if (req.query.isCharged !== undefined) {
      where.isCharged = req.query.isCharged === 'true';
    }

    // Validate and sanitise sorting parameter against an explicit whitelist to
    // prevent arbitrary column injection into the ORDER BY clause.
    const rawOrderBy = (req.query.orderBy as string) || 'updatedAt';
    const orderBy: AllowedOrderBy = (ALLOWED_ORDER_BY as readonly string[]).includes(rawOrderBy)
      ? (rawOrderBy as AllowedOrderBy)
      : 'updatedAt';

    const order = ((req.query.order as string) === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

    // Cap limit to prevent DoS via unbounded queries; default 20, max 100.
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const limit =
      rawLimit !== undefined && !isNaN(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 20;

    // Cursor-based pagination: stable under concurrent writes, O(1) offset
    const cursor = req.query.cursor as string | undefined;

    const anchors = await prisma.anchor.findMany({
      where,
      orderBy: {
        [orderBy]: order,
      },
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const nextCursor = anchors.length === limit ? anchors[anchors.length - 1].id : null;

    res.json({
      success: true,
      data: anchors,
      meta: {
        total: anchors.length,
        nextCursor,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to fetch anchors', 500, 'FETCH_ERROR'));
  }
});

/**
 * GET /api/anchors/:id
 *
 * Get a specific anchor by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.dbUser!.id;

    // Fetch anchor — ownership enforced by userId constraint
    const anchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        activations: {
          orderBy: {
            activatedAt: 'desc',
          },
          take: 10, // Last 10 activations
        },
        charges: {
          orderBy: {
            chargedAt: 'desc',
          },
          take: 5, // Last 5 charges
        },
      },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    res.json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to fetch anchor', 500, 'FETCH_ERROR'));
  }
});

/**
 * PUT /api/anchors/:id
 *
 * Update an anchor (supports new architecture fields)
 *
 * Body (all optional):
 * - intentionText
 * - category
 * - mantraText
 * - mantraPronunciation
 * - mantraAudioUrl
 * - reinforcedSigilSvg
 * - reinforcementMetadata
 * - enhancedImageUrl
 * - enhancementMetadata
 * - structureVariant
 * - isCharged
 * - isArchived
 */
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.dbUser!.id;

    // Explicit allowlist of fields a user may update on their own anchor.
    // Never spread req.body directly into Prisma — that would allow mass
    // assignment of system-owned fields (userId, activationCount, etc.).
    const {
      intentionText,
      category,
      structureVariant,
      reinforcedSigilSvg,
      reinforcementMetadata,
      enhancedImageUrl,
      enhancementMetadata,
      mantraText,
      mantraPronunciation,
      mantraAudioUrl,
      isCharged,
      chargedAt,
      chargeMethod,
      isArchived,
      archivedAt,
      isShared,
      sharedAt,
    } = validate(UpdateAnchorSchema, req.body);

    // Build update object with only the allowed fields that were provided
    type AnchorUpdate = {
      intentionText?: string;
      category?: string;
      structureVariant?: string;
      reinforcedSigilSvg?: string | null;
      reinforcementMetadata?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
      enhancedImageUrl?: string | null;
      enhancementMetadata?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
      mantraText?: string | null;
      mantraPronunciation?: string | null;
      mantraAudioUrl?: string | null;
      isCharged?: boolean;
      chargedAt?: Date | null;
      chargeMethod?: string | null;
      isArchived?: boolean;
      archivedAt?: Date | null;
      isShared?: boolean;
      sharedAt?: Date | null;
      updatedAt: Date;
    };

    const allowedUpdates: AnchorUpdate = { updatedAt: new Date() };

    if (intentionText !== undefined) allowedUpdates.intentionText = String(intentionText);
    if (category !== undefined) allowedUpdates.category = String(category);
    if (structureVariant !== undefined) allowedUpdates.structureVariant = String(structureVariant);
    if (reinforcedSigilSvg !== undefined) allowedUpdates.reinforcedSigilSvg = reinforcedSigilSvg;
    if (reinforcementMetadata !== undefined) allowedUpdates.reinforcementMetadata = reinforcementMetadata ?? Prisma.JsonNull;
    if (enhancedImageUrl !== undefined) allowedUpdates.enhancedImageUrl = enhancedImageUrl;
    if (enhancementMetadata !== undefined) allowedUpdates.enhancementMetadata = enhancementMetadata ?? Prisma.JsonNull;
    if (mantraText !== undefined) allowedUpdates.mantraText = mantraText;
    if (mantraPronunciation !== undefined) allowedUpdates.mantraPronunciation = mantraPronunciation;
    if (mantraAudioUrl !== undefined) allowedUpdates.mantraAudioUrl = mantraAudioUrl;
    if (isCharged !== undefined) allowedUpdates.isCharged = Boolean(isCharged);
    if (chargedAt !== undefined) allowedUpdates.chargedAt = chargedAt ? new Date(chargedAt) : null;
    if (chargeMethod !== undefined) allowedUpdates.chargeMethod = chargeMethod;
    if (isArchived !== undefined) allowedUpdates.isArchived = Boolean(isArchived);
    if (archivedAt !== undefined) allowedUpdates.archivedAt = archivedAt ? new Date(archivedAt) : null;
    if (isShared !== undefined) allowedUpdates.isShared = Boolean(isShared);
    if (sharedAt !== undefined) allowedUpdates.sharedAt = sharedAt ? new Date(sharedAt) : null;

    // Verify ownership then update in a single round-trip using updateMany
    // (returns count=0 if the anchor doesn't exist or isn't owned by this user)
    const result = await prisma.anchor.updateMany({
      where: { id, userId },
      data: allowedUpdates,
    });

    if (result.count === 0) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    const anchor = await prisma.anchor.findUnique({ where: { id } });

    res.json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to update anchor', 500, 'UPDATE_ERROR'));
  }
});

/**
 * DELETE /api/anchors/:id
 *
 * Delete (archive) an anchor
 */
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.dbUser!.id;

    // Verify ownership and archive in one round-trip
    const result = await prisma.anchor.updateMany({
      where: { id, userId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        message: 'Anchor archived successfully',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to delete anchor', 500, 'DELETE_ERROR'));
  }
});

/**
 * POST /api/anchors/:id/charge
 *
 * Mark an anchor as charged after ritual
 *
 * Body:
 * - chargeType: 'initial_quick' | 'initial_deep' | 'recharge'
 * - durationSeconds: Duration of the ritual
 */
router.post('/:id/charge', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { chargeType, durationSeconds } = validate(ChargeAnchorSchema, req.body);
    const userId = req.dbUser!.id;

    // Verify ownership before writing
    const existingAnchor = await prisma.anchor.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Create charge record
    await prisma.charge.create({
      data: {
        userId,
        anchorId: id,
        chargeType,
        durationSeconds,
        completed: true,
        chargedAt: new Date(),
      },
    });

    // Update anchor
    const anchor = await prisma.anchor.update({
      where: { id },
      data: {
        isCharged: true,
        chargedAt: new Date(),
        chargeMethod: chargeType.includes('quick') ? 'quick' : 'deep',
      },
    });

    res.json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to charge anchor', 500, 'CHARGE_ERROR'));
  }
});

/**
 * POST /api/anchors/:id/activate
 *
 * Log an activation event
 *
 * Body:
 * - activationType: 'visual' | 'mantra' | 'deep'
 * - durationSeconds: Duration of activation
 */
router.post('/:id/activate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { activationType, durationSeconds } = validate(ActivateAnchorSchema, req.body);
    const userId = req.dbUser!.id;

    // Verify ownership before writing
    const existingAnchor = await prisma.anchor.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Create activation record
    await prisma.activation.create({
      data: {
        userId,
        anchorId: id,
        activationType,
        durationSeconds,
        activatedAt: new Date(),
      },
    });

    // Update anchor and user stats
    const anchor = await prisma.anchor.update({
      where: { id },
      data: {
        activationCount: {
          increment: 1,
        },
        lastActivatedAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        totalActivations: {
          increment: 1,
        },
      },
    });

    res.json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to log activation', 500, 'ACTIVATION_ERROR'));
  }
});

/**
 * POST /api/anchors/:id/burn
 *
 * Archive an anchor and create a BurnedAnchor snapshot record.
 * Atomic: both operations succeed or neither does.
 */
router.post('/:id/burn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.dbUser!.id;

    const anchor = await prisma.anchor.findFirst({
      where: { id, userId },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    if (anchor.isArchived) {
      throw new AppError('Anchor is already archived', 400, 'ALREADY_ARCHIVED');
    }

    await prisma.$transaction([
      prisma.burnedAnchor.create({
        data: {
          originalAnchorId: anchor.id,
          userId,
          intentionText: anchor.intentionText,
          category: anchor.category,
          distilledLetters: [],
          baseSigilSvg: anchor.baseSigilSvg,
          enhancedImageUrl: anchor.enhancedImageUrl ?? null,
          activationCount: anchor.activationCount,
          createdAt: anchor.createdAt,
        },
      }),
      prisma.anchor.update({
        where: { id },
        data: { isArchived: true, archivedAt: new Date() },
      }),
    ]);

    res.json({ success: true, data: { burned: true } });
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('Failed to burn anchor', 500, 'BURN_ERROR'));
  }
});

export default router;
