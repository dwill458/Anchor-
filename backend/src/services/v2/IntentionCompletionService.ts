import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';

export type AnchorLifecycleState = 'active' | 'completed' | 'released';

export interface IntentionCompletionResult {
  id: string;
  intentionText: string;
  category: string;
  lifecycleState: AnchorLifecycleState;
  intentionCompletedAt: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export class IntentionCompletionService {
  async completeIntention(
    userId: string,
    anchorId: string,
    now: Date = new Date()
  ): Promise<IntentionCompletionResult> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    if (anchor.isArchived) {
      throw new AppError(
        'Cannot complete intention on an archived/released anchor',
        409,
        'ANCHOR_ALREADY_RELEASED'
      );
    }

    let updatedAnchor = anchor;

    if (!anchor.intentionCompletedAt) {
      const claimed = await prisma.anchor.updateMany({
        where: { id: anchorId, userId, isArchived: false, intentionCompletedAt: null },
        data: { intentionCompletedAt: now },
      });

      if (claimed.count > 0) {
        // The conditional update won the race. Keep the exact server-owned
        // timestamp that was written without issuing a second mutation.
        updatedAnchor = { ...anchor, intentionCompletedAt: now, updatedAt: now };
      } else {
        // Another idempotent request completed it first; return that original
        // timestamp rather than overwriting it.
        const persisted = await prisma.anchor.findFirst({ where: { id: anchorId, userId } });
        if (!persisted) {
          throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
        }
        updatedAnchor = persisted;
      }
    }

    const completionDate = updatedAnchor.intentionCompletedAt;
    if (!completionDate) {
      throw new AppError('Unable to complete intention', 409, 'INTENTION_COMPLETION_CONFLICT');
    }

    const lifecycleState: AnchorLifecycleState = updatedAnchor.isArchived
      ? 'released'
      : updatedAnchor.intentionCompletedAt
        ? 'completed'
        : 'active';

    return {
      id: updatedAnchor.id,
      intentionText: updatedAnchor.intentionText,
      category: updatedAnchor.category,
      lifecycleState,
      intentionCompletedAt: completionDate.toISOString(),
      isArchived: updatedAnchor.isArchived,
      createdAt: updatedAnchor.createdAt.toISOString(),
      updatedAt: updatedAnchor.updatedAt.toISOString(),
    };
  }

  async getLifecycleState(
    userId: string,
    anchorId: string
  ): Promise<{
    id: string;
    lifecycleState: AnchorLifecycleState;
    intentionCompletedAt: string | null;
    isArchived: boolean;
  }> {
    const anchor = await prisma.anchor.findFirst({
      where: { id: anchorId, userId },
      select: {
        id: true,
        isArchived: true,
        intentionCompletedAt: true,
      },
    });

    if (!anchor) {
      throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    const lifecycleState: AnchorLifecycleState = anchor.isArchived
      ? 'released'
      : anchor.intentionCompletedAt
        ? 'completed'
        : 'active';

    return {
      id: anchor.id,
      lifecycleState,
      intentionCompletedAt: anchor.intentionCompletedAt
        ? anchor.intentionCompletedAt.toISOString()
        : null,
      isArchived: anchor.isArchived,
    };
  }
}

export const intentionCompletionService = new IntentionCompletionService();
