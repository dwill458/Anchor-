import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../api/middleware/errorHandler';
import { resolveMonetizationAccess } from './MonetizationAccessService';
import { AnchorCreationLedger } from './AnchorCreationLedger';
import { countCreationUsage, countHistoricalCreationBaseline } from './AnchorCreationQuotaPolicy';
import { ipKeyGenerator } from 'express-rate-limit';

/** A shared cost ceiling survives Redis/process restarts and anonymous Firebase UID cycling. */
export async function consumeGuestCreationBudget(ip: string) {
  const key = createHash('sha256')
    .update(`guest:${new Date().toISOString().slice(0, 10)}:${ipKeyGenerator(ip)}`)
    .digest('hex');
  const expiresAt = new Date(Date.now() + 2 * 86_400_000);
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO anchor_creation_abuse_budgets (key, attempts, expires_at) VALUES (${key}, 1, ${expiresAt})
    ON CONFLICT (key) DO UPDATE SET attempts = anchor_creation_abuse_budgets.attempts + 1
    WHERE anchor_creation_abuse_budgets.attempts < 20 RETURNING attempts`;
  if (!rows.length)
    throw new AppError(
      'Guest creation limit reached. Try again tomorrow.',
      429,
      'GUEST_CREATION_LIMIT'
    );
  await prisma.anchorCreationAbuseBudget.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export const creationLedger = new AnchorCreationLedger(prisma);
export async function creationPolicy(user: {
  id: string;
  isComped?: boolean;
  trialStartedAt?: Date | null;
}) {
  const access = await resolveMonetizationAccess(user);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return {
    access,
    scope: access.hasProAccess
      ? access.isTrialPeriod
        ? `trial:${access.trialPeriodId || 'lifetime'}`
        : `pro:${today.toISOString().slice(0, 10)}`
      : 'free:lifetime',
    limit: access.hasProAccess ? (access.isTrialPeriod ? 7 : 10) : 1,
    baselineSince: access.hasProAccess
      ? access.isTrialPeriod
        ? access.trialPeriodId
          ? new Date(access.trialPeriodId)
          : new Date(0)
        : today
      : new Date(0),
  };
}
export function creationHash(input: {
  sigilSvg: string;
  styleChoice: string;
  anchorId: string;
  intentionText?: string;
  intention?: string;
  devImageModel?: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.sigilSvg,
        input.styleChoice,
        input.anchorId,
        input.intentionText || input.intention || '',
        input.devImageModel || '',
      ])
    )
    .digest('hex');
}

export async function creationOwner(authUid: string) {
  const user = await prisma.user.findUnique({ where: { authUid } });
  if (!user) throw new AppError('Sync your account before creating.', 404, 'USER_NOT_FOUND');
  if (user.authProvider.startsWith('merged_guest:'))
    throw new AppError('Guest identity was linked.', 403, 'GUEST_ALREADY_LINKED');
  const owner = await prisma.anchorCreationQuotaOwner
    .upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} })
    .catch(async error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return prisma.anchorCreationQuotaOwner.findUniqueOrThrow({ where: { userId: user.id } });
      }
      throw error;
    });
  return { user, owner };
}

export async function reserveCreation(authUid: string, key: string, hash: string) {
  const { user, owner } = await creationOwner(authUid);
  const { scope, limit, baselineSince } = await creationPolicy(user);
  // Verified store purchase date identifies the trial; absent boundaries use a conservative lifetime budget.
  try {
    return await creationLedger.reserve({
      ownerId: owner.id,
      idempotencyKey: key,
      requestHash: hash,
      quotaScope: scope,
      limit,
      baselineSince,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Free lifetime Anchor already saved') {
      throw new AppError('Create more Anchors with Pro.', 403, 'CREATE_ANCHOR_FREE_LOCKED');
    }
    if (error instanceof Error && error.message === 'Guest identity was linked') {
      throw new AppError('Guest identity was linked.', 403, 'GUEST_ALREADY_LINKED');
    }
    if (error instanceof Error && error.message === 'Creation attempts exceeded') {
      throw new AppError('Session recovery limit reached.', 429, 'CREATION_ATTEMPTS_EXCEEDED');
    }
    if (error instanceof Error && error.message === 'Creation quota exceeded') {
      throw new AppError('Creation limit reached.', 429, 'ANCHOR_CREATION_QUOTA_EXCEEDED');
    }
    if (error instanceof Error && error.message === 'Idempotency key conflict') {
      throw new AppError(error.message, 409, 'IDEMPOTENCY_KEY_CONFLICT');
    }
    throw error;
  }
}

export async function claimCreation(authUid: string, sessionId: string, hash: string) {
  const { user, owner } = await creationOwner(authUid);
  const policy = await creationPolicy(user);
  const { access } = policy;
  return prisma.$transaction(
    async tx => {
      await tx.$queryRaw`SELECT id FROM anchor_creation_quota_owners WHERE id = ${owner.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM anchor_creation_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const session = await tx.anchorCreationSession.findFirst({
        where: { id: sessionId, ownerId: owner.id },
        include: { options: { orderBy: { position: 'asc' } } },
      });
      if (!session)
        throw new AppError('Creation session not found.', 404, 'CREATION_SESSION_NOT_FOUND');
      if (session.requestHash !== hash)
        throw new AppError('Creation input changed.', 409, 'CREATION_INPUT_CONFLICT');
      if (session.options.length === 2) return { user, owner, session, token: null };
      if (
        session.status === 'reserved' &&
        session.quotaScope.startsWith('pro:') &&
        session.quotaScope !== `pro:${new Date().toISOString().slice(0, 10)}`
      ) {
        throw new AppError('Start a creation session for today.', 409, 'CREATION_DAY_EXPIRED');
      }
      if (session.quotaScope !== 'free:lifetime' && !access.hasProAccess) {
        throw new AppError('An active subscription is required.', 403, 'PREMIUM_REQUIRED');
      }
      if (
        !['reserved', 'completed'].includes(session.status) ||
        session.expiresAt <= new Date() ||
        session.savedAnchorId
      ) {
        throw new AppError('Creation session unavailable.', 409, 'CREATION_SESSION_UNAVAILABLE');
      }
      if (session.leaseUntil && session.leaseUntil > new Date()) {
        throw new AppError(
          'Generation is already running. Retry this session.',
          409,
          'CREATION_IN_PROGRESS'
        );
      }
      if (session.attempts >= 4)
        throw new AppError('Session recovery limit reached.', 429, 'CREATION_ATTEMPTS_EXCEEDED');
      if (session.status === 'reserved') {
        const used = await countCreationUsage(
          tx,
          owner.id,
          policy.scope,
          policy.baselineSince,
          session.id
        );
        const historical = await countHistoricalCreationBaseline(tx, user.id, policy.baselineSince);
        if (used + historical >= policy.limit)
          throw new AppError('Creation limit reached.', 429, 'ANCHOR_CREATION_QUOTA_EXCEEDED');
      }
      const token = randomUUID();
      await tx.anchorCreationSession.update({
        where: { id: session.id },
        data: {
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 10 * 60_000),
          attempts: { increment: 1 },
        },
      });
      return { user, owner, session, token };
    },
    { maxWait: 30_000, timeout: 30_000 }
  );
}

export async function persistCreationOptions(
  sessionId: string,
  token: string,
  payloads: Prisma.InputJsonValue[]
) {
  const pending = await prisma.anchorCreationSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { owner: { include: { user: true } } },
  });
  if (!pending.owner.user || pending.owner.user.authProvider.startsWith('merged_guest:')) {
    throw new AppError('Creation ownership changed.', 409, 'CREATION_OWNER_CHANGED');
  }
  const policy = await creationPolicy(pending.owner.user);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM anchor_creation_quota_owners WHERE id = ${pending.ownerId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM anchor_creation_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.anchorCreationSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { options: true },
    });
    if (session.ownerId !== pending.ownerId)
      throw new AppError(
        'Creation ownership changed. Retry after account linking.',
        409,
        'CREATION_OWNER_CHANGED'
      );
    if (session.leaseToken !== token || !['reserved', 'completed'].includes(session.status)) {
      throw new AppError('Generation lease lost.', 409, 'CREATION_LEASE_LOST');
    }
    const completedAt = session.completedAt ?? new Date();
    if (policy.scope.startsWith('pro:')) {
      policy.scope = `pro:${completedAt.toISOString().slice(0, 10)}`;
      policy.baselineSince = new Date(`${completedAt.toISOString().slice(0, 10)}T00:00:00.000Z`);
    }
    // Revalidate every first output against the current owner/plan/day, including
    // a guest merge or store transition while the external provider was running.
    if (session.status === 'reserved' && payloads.length) {
      if (
        session.quotaScope !== 'free:lifetime' &&
        (!policy.access.hasProAccess ||
          (policy.access.expiresAt && policy.access.expiresAt <= new Date()))
      ) {
        throw new AppError('An active subscription is required.', 403, 'PREMIUM_REQUIRED');
      }
      const used = await countCreationUsage(
        tx,
        session.ownerId,
        policy.scope,
        policy.baselineSince,
        session.id
      );
      const historical = await countHistoricalCreationBaseline(
        tx,
        pending.owner.user!.id,
        policy.baselineSince
      );
      if (used + historical >= policy.limit)
        throw new AppError('Creation limit reached.', 429, 'ANCHOR_CREATION_QUOTA_EXCEEDED');
      await tx.anchorCreationSession.update({
        where: { id: sessionId },
        data: { quotaScope: policy.scope },
      });
    }
    for (const payload of payloads.slice(0, 2 - session.options.length)) {
      const position = session.options.length;
      const option = await tx.anchorCreationOption.create({
        data: { sessionId, position, payload },
      });
      session.options.push(option);
    }
    await tx.anchorCreationSession.update({
      where: { id: sessionId },
      data: {
        ...(session.options.length ? { status: 'completed', completedAt } : { status: 'failed' }),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    return session.options;
  });
}

export async function releaseCreation(sessionId: string, token: string) {
  // Failed output releases capacity; completed output always remains charged.
  await prisma.anchorCreationSession.updateMany({
    where: { id: sessionId, leaseToken: token, status: 'reserved' },
    data: { status: 'failed', leaseToken: null, leaseUntil: null },
  });
  await prisma.anchorCreationSession.updateMany({
    where: { id: sessionId, leaseToken: token },
    data: { leaseToken: null, leaseUntil: null },
  });
}
