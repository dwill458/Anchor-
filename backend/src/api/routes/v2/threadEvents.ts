import { NextFunction, Response, Router } from 'express';
import { AuthRequest, authMiddleware } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';
import { getAuthenticatedUserId } from './authHelper';

const router = Router();
router.use(authMiddleware);
const channels = new Set([
  'PRIMARY_IMMEDIATE',
  'COMPLETION_INLINE',
  'HOME_CONTEXT',
  'TODAY_CONTEXT',
  'WEEKLY_INSIGHT',
  'ARCHIVE_TIMELINE',
]);
const terminal = new Set(['PRESENTED', 'ACKNOWLEDGED', 'DISMISSED']);
const channelFromPath = (value: string): string => value.toUpperCase();

router.get(
  '/thread-events/eligible',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const channel = String(req.query.channel ?? 'HOME_CONTEXT');
      if (!channels.has(channel))
        throw new AppError(
          'Unsupported presentation channel.',
          400,
          'INVALID_THREAD_EVENT_CHANNEL'
        );
      const userId = await getAuthenticatedUserId(req);
      const events = await prisma.threadEventLedger.findMany({
        where: { userId, receipts: { none: { channel, status: { in: [...terminal] } } } },
        orderBy: [{ ledgerSequence: 'asc' }, { id: 'asc' }],
        take: 25,
      });
      res.json({
        success: true,
        data: events.map(event => ({
          eventId: event.id,
          ledgerSequence: event.ledgerSequence.toString(),
          correlationId: event.correlationId,
          correlationSequence: event.correlationSequence,
          anchorId: event.anchorId,
          eventType: event.eventType,
          significance: event.significance,
          sourceKind: event.sourceKind,
          occurredAt: event.occurredAt.toISOString(),
          metadata: event.metadata,
        })),
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/thread-events/presentation-claims',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const { eventIds, channel, bundleKey } = req.body ?? {};
      if (
        !Array.isArray(eventIds) ||
        eventIds.length === 0 ||
        !channels.has(channel) ||
        typeof bundleKey !== 'string'
      )
        throw new AppError('Invalid presentation claim.', 400, 'INVALID_PRESENTATION_CLAIM');
      const owned = await prisma.threadEventLedger.findMany({
        where: { id: { in: eventIds }, userId },
        select: { id: true },
      });
      if (owned.length !== eventIds.length)
        throw new AppError('Thread Event not found.', 404, 'THREAD_EVENT_NOT_FOUND');
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      await Promise.all(
        eventIds.map((eventId: string) =>
          prisma.threadEventPresentationClaim.upsert({
            where: { eventId_channel: { eventId, channel } },
            create: { eventId, channel, bundleKey, expiresAt },
            update: { bundleKey, expiresAt },
          })
        )
      );
      res.json({
        success: true,
        data: { bundleKey, claimedEventIds: eventIds, expiresAt: expiresAt.toISOString() },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/thread-events/:eventId/presentations/:channel',
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = await getAuthenticatedUserId(req);
      const channel = channelFromPath(req.params.channel);
      const status = String(req.body?.status ?? '');
      if (!channels.has(channel) || !terminal.has(status))
        throw new AppError('Invalid presentation receipt.', 400, 'INVALID_PRESENTATION_RECEIPT');
      const event = await prisma.threadEventLedger.findFirst({
        where: { id: req.params.eventId, userId },
        select: { id: true },
      });
      if (!event) throw new AppError('Thread Event not found.', 404, 'THREAD_EVENT_NOT_FOUND');
      const now = new Date();
      const receipt = await prisma.threadEventPresentationReceipt.upsert({
        where: { eventId_channel: { eventId: event.id, channel } },
        create: {
          eventId: event.id,
          channel,
          status,
          presentedAt: status === 'PRESENTED' ? now : null,
          settledAt: status === 'PRESENTED' ? null : now,
        },
        // Never regress a terminal acknowledgement/dismissal on retry.
        update: {
          status: status === 'PRESENTED' ? 'PRESENTED' : status,
          presentedAt: status === 'PRESENTED' ? now : undefined,
          settledAt: status === 'PRESENTED' ? undefined : now,
        },
      });
      res.json({ success: true, data: { eventId: event.id, channel, status: receipt.status } });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
