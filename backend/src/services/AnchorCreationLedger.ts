import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { countHistoricalCreationBaseline, countCreationUsage } from './AnchorCreationQuotaPolicy';

/** Internal ledger operations. Policy and owner identity must be resolved by the server. */
export class AnchorCreationLedger {
  constructor(private readonly db: PrismaClient) {}

  async reserve(input: {
    ownerId: string;
    idempotencyKey: string;
    requestHash: string;
    quotaScope: string;
    limit: number;
    expiresAt: Date;
    baselineSince?: Date;
  }) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.expiresAt <= new Date()) {
      throw new Error('Invalid reservation policy');
    }
    return this.db.$transaction(
      async tx => {
        const owner = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM anchor_creation_quota_owners WHERE id = ${input.ownerId} FOR UPDATE`;
        if (!owner.length) throw new Error('Creation owner not found');
        const identity = await tx.anchorCreationQuotaOwner.findUnique({
          where: { id: input.ownerId },
          select: { user: { select: { id: true, authProvider: true, totalAnchorsCreated: true } } },
        });
        if (identity?.user?.authProvider.startsWith('merged_guest:'))
          throw new Error('Guest identity was linked');
        const existing = await tx.anchorCreationSession.findUnique({
          where: {
            ownerId_idempotencyKey: {
              ownerId: input.ownerId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { options: true },
        });
        if (existing) {
          if (existing.requestHash !== input.requestHash)
            throw new Error('Idempotency key conflict');
          if (
            existing.status === 'completed' ||
            (existing.status === 'reserved' &&
              existing.expiresAt > new Date() &&
              existing.quotaScope === input.quotaScope)
          )
            return existing;
          if (existing.attempts >= 4) throw new Error('Creation attempts exceeded');
        }
        if (
          input.quotaScope === 'free:lifetime' &&
          identity?.user &&
          (identity.user.totalAnchorsCreated >= 1 ||
            (await tx.anchor.count({ where: { userId: identity.user.id } })) > 0)
        ) {
          throw new Error('Free lifetime Anchor already saved');
        }
        await tx.anchorCreationSession.updateMany({
          where: { ownerId: input.ownerId, status: 'reserved', expiresAt: { lte: new Date() } },
          data: { status: 'expired' },
        });
        const used = await countCreationUsage(
          tx,
          input.ownerId,
          input.quotaScope,
          input.baselineSince,
          existing?.id
        );
        const historical = identity?.user
          ? await countHistoricalCreationBaseline(tx, identity.user.id, input.baselineSince)
          : 0;
        if (used + historical >= input.limit) throw new Error('Creation quota exceeded');
        if (existing)
          return tx.anchorCreationSession.update({
            where: { id: existing.id },
            data: {
              status: 'reserved',
              quotaScope: input.quotaScope,
              expiresAt: input.expiresAt,
              leaseToken: null,
              leaseUntil: null,
            },
            include: { options: true },
          });
        return tx.anchorCreationSession.create({
          data: {
            id: randomUUID(),
            ownerId: input.ownerId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            quotaScope: input.quotaScope,
            expiresAt: input.expiresAt,
          },
          include: { options: true },
        });
      },
      { maxWait: 30_000, timeout: 30_000 }
    );
  }

  async recordOption(
    ownerId: string,
    sessionId: string,
    position: 0 | 1,
    payload: Prisma.InputJsonValue
  ) {
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; expires_at: Date }>>`
        SELECT id, status, expires_at FROM anchor_creation_sessions
        WHERE id = ${sessionId} AND owner_id = ${ownerId} FOR UPDATE`;
      const session = rows[0];
      if (
        !session ||
        !['reserved', 'completed'].includes(session.status) ||
        (session.status === 'reserved' && session.expires_at <= new Date())
      ) {
        throw new Error('Creation session unavailable');
      }
      const option = await tx.anchorCreationOption.upsert({
        where: { sessionId_position: { sessionId, position } },
        create: { id: randomUUID(), sessionId, position, payload },
        update: {},
      });
      if (session.status === 'reserved') {
        await tx.anchorCreationSession.update({
          where: { id: sessionId },
          data: { status: 'completed', completedAt: new Date() },
        });
      }
      return option;
    });
  }

  async fail(ownerId: string, sessionId: string) {
    // A session with any durable usable option is already completed and charged.
    return this.db.anchorCreationSession.updateMany({
      where: { id: sessionId, ownerId, status: 'reserved' },
      data: { status: 'failed' },
    });
  }
}
