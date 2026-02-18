/**
 * Anchor App - Anchor Routes
 *
 * Handles CRUD operations for user anchors
 */

import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// All anchor routes require authentication
router.use(authMiddleware);

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
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

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
    } = req.body;

    // Validation - required fields
    if (!intentionText || !category || !distilledLetters || !baseSigilSvg) {
      throw new AppError(
        'Missing required fields: intentionText, category, distilledLetters, baseSigilSvg',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Create anchor with new architecture fields
    const anchor = await prisma.anchor.create({
      data: {
        userId: user.id,
        intentionText,
        category,
        distilledLetters,

        // Structure lineage
        baseSigilSvg,
        reinforcedSigilSvg: reinforcedSigilSvg || null,
        enhancedImageUrl: enhancedImageUrl || null,

        // Creation path metadata
        structureVariant: structureVariant || 'balanced',
        reinforcementMetadata: reinforcementMetadata || null,
        enhancementMetadata: enhancementMetadata || null,

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
      where: { id: user.id },
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
      throw error;
    }
    throw new AppError('Failed to create anchor', 500, 'CREATE_ERROR');
  }
});

/**
 * GET /api/anchors
 *
 * Get all anchors for the authenticated user
 *
 * Query params (optional):
 * - category: Filter by category
 * - isCharged: Filter by charged status
 * - limit: Maximum number of anchors to return
 * - orderBy: Field to sort by (default: 'updatedAt')
 * - order: Sort direction 'asc' | 'desc' (default: 'desc')
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Build filter conditions
    const where: {
      userId: string;
      category?: string;
      isCharged?: boolean;
      isArchived: boolean;
    } = {
      userId: user.id,
      isArchived: false, // Don't show archived anchors by default
    };

    if (req.query.category) {
      where.category = req.query.category as string;
    }

    if (req.query.isCharged !== undefined) {
      where.isCharged = req.query.isCharged === 'true';
    }

    // Parse sorting and pagination parameters
    const orderBy = (req.query.orderBy as string) || 'updatedAt';
    const order = ((req.query.order as string) || 'desc') as 'asc' | 'desc';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

    // Fetch anchors with optional sorting and limiting
    const anchors = await prisma.anchor.findMany({
      where,
      orderBy: {
        [orderBy]: order,
      },
      ...(limit && { take: limit }),
    });

    res.json({
      success: true,
      data: anchors,
      meta: {
        total: anchors.length,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to fetch anchors', 500, 'FETCH_ERROR');
  }
});

/**
 * GET /api/anchors/:id
 *
 * Get a specific anchor by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Fetch anchor
    const anchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId: user.id, // Ensure user owns this anchor
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
      throw error;
    }
    throw new AppError('Failed to fetch anchor', 500, 'FETCH_ERROR');
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
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const updates = req.body;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if anchor exists and user owns it
    const existingAnchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Update anchor
    const anchor = await prisma.anchor.update({
      where: { id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: anchor,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to update anchor', 500, 'UPDATE_ERROR');
  }
});

/**
 * DELETE /api/anchors/:id
 *
 * Delete (archive) an anchor
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if anchor exists and user owns it
    const existingAnchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Archive instead of delete
    await prisma.anchor.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        message: 'Anchor archived successfully',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to delete anchor', 500, 'DELETE_ERROR');
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
router.post('/:id/charge', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { chargeType, durationSeconds } = req.body;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if anchor exists and user owns it
    const existingAnchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Create charge record
    await prisma.charge.create({
      data: {
        userId: user.id,
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
      throw error;
    }
    throw new AppError('Failed to charge anchor', 500, 'CHARGE_ERROR');
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
router.post('/:id/activate', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;
    const { activationType, durationSeconds } = req.body;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if anchor exists and user owns it
    const existingAnchor = await prisma.anchor.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingAnchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Create activation record
    await prisma.activation.create({
      data: {
        userId: user.id,
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
      where: { id: user.id },
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
      throw error;
    }
    throw new AppError('Failed to log activation', 500, 'ACTIVATION_ERROR');
  }
});

/**
 * POST /api/anchors/:id/burn
 *
 * Archive an anchor and create a BurnedAnchor snapshot record.
 * Atomic: both operations succeed or neither does.
 */
router.post('/:id/burn', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const anchor = await prisma.anchor.findFirst({
      where: { id, userId: user.id },
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
          userId: user.id,
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
      throw error;
    }
    throw new AppError('Failed to burn anchor', 500, 'BURN_ERROR');
  }
});

export default router;
