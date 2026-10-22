import { NextFunction, Router, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../../lib/prisma';
import { rasterizeSVG } from '../../utils/svgRasterizer';
import { uploadImageAssetFromBuffer } from '../../services/StorageService';
import { createPrintfulMockupPreview } from '../../services/PrintfulService';

const router = Router();

const PRODUCT_CATALOG = [
  {
    type: 'print',
    name: 'Wall Print',
    description: 'Framed wall print sized for a focused ritual display',
    basePriceCents: 3500,
  },
  {
    type: 'phone-case',
    name: 'Phone Case',
    description: 'Protective case featuring your anchor design',
    basePriceCents: 3200,
  },
  {
    type: 'desk-mat',
    name: 'Desk Mat',
    description: 'Wide desk surface that turns your workspace into the ritual space',
    basePriceCents: 4500,
  },
] as const;

const PreviewRequestSchema = z.object({
  anchorId: z.string().min(1),
  sigilSvg: z.string().min(1).optional(),
  productType: z.enum(['print', 'phone-case', 'desk-mat']),
  size: z.string().min(1).max(50).optional(),
  color: z.string().min(1).max(50).optional(),
});

router.get('/products', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      printfulMappingActive: env.ENABLE_MERCH,
      products: PRODUCT_CATALOG,
    },
  });
});

router.post(
  '/preview',
  authMiddleware,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!env.ENABLE_MERCH) {
        throw new AppError('Merchandise previews are currently disabled', 403, 'FEATURE_DISABLED');
      }

      if (!req.user) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const validationResult = PreviewRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        const message = validationResult.error.errors
          .map((error) => `${error.path.join('.')}: ${error.message}`)
          .join(', ');
        throw new AppError(`Validation error: ${message}`, 400, 'VALIDATION_ERROR');
      }

      const { anchorId, sigilSvg, productType, size, color } = validationResult.data;

      const user = await prisma.user.findUnique({
        where: { authUid: req.user.uid },
      });

      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const anchor = await prisma.anchor.findFirst({
        where: {
          id: anchorId,
          userId: user.id,
        },
      });

      if (!anchor) {
        throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
      }

      const sourceSvg = sigilSvg || anchor.reinforcedSigilSvg || anchor.baseSigilSvg;
      if (!sourceSvg) {
        throw new AppError('Anchor artwork is missing', 400, 'ANCHOR_ARTWORK_MISSING');
      }

      const rasterizedArtwork = await rasterizeSVG(sourceSvg, {
        width: 2048,
        height: 2048,
        backgroundColor: 'transparent',
        strokeColor: '#000000',
        enhanceEdges: false,
        strokeMultiplier: 1.25,
        padding: 0.08,
      });

      const artworkAsset = await uploadImageAssetFromBuffer(
        rasterizedArtwork.buffer,
        user.id,
        anchorId,
        0,
        { signedUrlExpiresIn: 3600 }
      );

      const preview = await createPrintfulMockupPreview({
        productType,
        size,
        color,
        artworkUrl: artworkAsset.externalUrl,
      });

      res.json({
        success: true,
        data: {
          productType,
          size,
          color,
          artworkUrl: artworkAsset.url,
          previewUrl: preview.previewUrl,
        },
      });
    } catch (error) {
      return next(
        error instanceof AppError
          ? error
          : new AppError('Failed to generate merch preview', 500, 'MERCH_PREVIEW_ERROR')
      );
    }
  }
);

export default router;
