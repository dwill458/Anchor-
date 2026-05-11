/**
 * Anchor App - Orders API Routes
 *
 * Handles physical manifestation (merchandise) orders
 */

import { NextFunction, Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';

const router = Router();

// Zod validation schemas
const CreateOrderSchema = z.object({
  anchorId: z.string().min(1),
  productType: z.enum(['print', 'keychain', 'hoodie', 't-shirt', 'phone-case']),
  size: z.string().min(1).max(50).optional(),
  color: z.string().min(1).max(50).optional(),
  shippingInfo: z.object({
    name: z.string().min(1).max(100),
    addressLine1: z.string().min(1).max(100),
    addressLine2: z.string().max(100).optional().nullable(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(10),
  }),
});

// All order routes require authentication
router.use(authMiddleware);

/**
 * POST /api/orders
 *
 * Create a new order for physical anchor manifestation
 */
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!env.ENABLE_MERCH) {
      throw new AppError('Merchandise ordering is currently disabled', 403, 'FEATURE_DISABLED');
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    // Validation using Zod
    const validationResult = CreateOrderSchema.safeParse(req.body);
    if (!validationResult.success) {
      const message = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
    }

    const { anchorId, productType, size, color, shippingInfo } = validationResult.data;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify anchor ownership
    const anchor = await prisma.anchor.findFirst({
      where: {
        id: anchorId,
        userId: user.id,
      },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Calculate pricing (placeholder - would integrate with Printful API)
    const pricing = calculatePricing(productType);

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        productType,
        productVariant: `${size} - ${color}`,
        quantity: 1,
        anchorImageUrl: anchor.enhancedImageUrl || anchor.baseSigilSvg,
        subtotalCents: pricing.subtotal,
        shippingCents: pricing.shipping,
        taxCents: pricing.tax,
        totalCents: pricing.total,
        currency: 'USD',
        shippingName: shippingInfo.name,
        shippingAddress: shippingInfo,
        status: 'pending',
      },
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError('Failed to create order', 500, 'CREATE_ERROR'));
  }
});

/**
 * GET /api/orders
 *
 * Get all orders for authenticated user
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError('Failed to fetch orders', 500, 'FETCH_ERROR'));
  }
});

/**
 * Helper function to calculate pricing
 * In production, this would integrate with Printful or similar API
 */
function calculatePricing(productType: string) {
  const pricing: Record<string, { subtotal: number; shipping: number; tax: number }> = {
    print: { subtotal: 3500, shipping: 800, tax: 250 },
    keychain: { subtotal: 1800, shipping: 500, tax: 150 },
    hoodie: { subtotal: 6500, shipping: 1200, tax: 500 },
    't-shirt': { subtotal: 3200, shipping: 800, tax: 250 },
    'phone-case': { subtotal: 2800, shipping: 600, tax: 200 },
  };

  const p = pricing[productType] || pricing['print'];
  return {
    ...p,
    total: p.subtotal + p.shipping + p.tax,
  };
}

export default router;
