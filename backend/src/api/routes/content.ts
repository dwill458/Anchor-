import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';

const router = Router();

const FlagContentSchema = z.object({
  anchorId: z.string().min(1).max(255),
  imageUrl: z.string().url().max(2048),
  reason: z.enum(['inappropriate', 'harmful', 'other']),
});

router.post('/flag', authMiddleware, async (req: AuthRequest, res: Response) => {
  const parsed = FlagContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: 'Invalid request body' });
    return;
  }

  if (!req.user?.uid) {
    res.status(401).json({ success: false, error: 'User not authenticated' });
    return;
  }

  const { anchorId, imageUrl, reason } = parsed.data;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { authUid: req.user.uid },
      select: { id: true },
    });

    if (!dbUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    await prisma.flaggedContent.create({
      data: { anchorId, imageUrl, reason, userId: dbUser.id },
    });

    logger.info('[Content] Content flagged', { anchorId, reason, userId: dbUser.id });
    res.status(201).json({ success: true });
  } catch (error) {
    logger.error('[Content] Failed to save flagged content', error);
    res.status(500).json({ success: false, error: 'Failed to record report' });
  }
});

export default router;
