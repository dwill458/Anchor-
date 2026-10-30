import { prisma } from '../lib/prisma';
import { AppError } from '../api/middleware/errorHandler';

/** Both Firebase identities must already have been verified by the HTTP boundary. */
export async function mergeGuestAccount(
  guestUid: string,
  registeredUid: string,
  transferHash?: string
): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE "authUid" IN (${guestUid}, ${registeredUid}) ORDER BY id FOR UPDATE`;
    const guest = await tx.user.findUnique({ where: { authUid: guestUid } });
    const target = await tx.user.findUnique({ where: { authUid: registeredUid } });
    if (
      !guest ||
      !target ||
      guest.id === target.id ||
      target.authProvider === 'anonymous' ||
      target.authProvider.startsWith('merged_guest:')
    ) {
      throw new AppError(
        'Both accounts must be available for linking.',
        409,
        'GUEST_ACCOUNT_LINK_CONFLICT'
      );
    }
    const guestOwner = await tx.anchorCreationQuotaOwner.findUnique({
      where: { userId: guest.id },
    });
    if (guest.authProvider === `merged_guest:${target.id}`) {
      if (transferHash && guestOwner?.guestTokenHash !== transferHash)
        throw new AppError('Invalid guest transfer proof.', 403, 'INVALID_GUEST_PROOF');
      return;
    }
    if (guest.authProvider !== 'anonymous') {
      throw new AppError(
        'Guest account cannot be transferred.',
        403,
        'GUEST_ACCOUNT_LINK_FORBIDDEN'
      );
    }
    const targetOwner = await tx.anchorCreationQuotaOwner.upsert({
      where: { userId: target.id },
      create: { userId: target.id },
      update: {},
    });
    if (guestOwner) {
      await tx.$queryRaw`SELECT id FROM anchor_creation_quota_owners WHERE id IN (${guestOwner.id}, ${targetOwner.id}) ORDER BY id FOR UPDATE`;
      const currentGuestOwner = await tx.anchorCreationQuotaOwner.findUnique({
        where: { id: guestOwner.id },
      });
      if (transferHash && currentGuestOwner?.guestTokenHash !== transferHash)
        throw new AppError('Invalid guest transfer proof.', 403, 'INVALID_GUEST_PROOF');
      const sessions = await tx.anchorCreationSession.findMany({
        where: { ownerId: guestOwner.id },
      });
      for (const session of sessions) {
        const collision = await tx.anchorCreationSession.findUnique({
          where: {
            ownerId_idempotencyKey: {
              ownerId: targetOwner.id,
              idempotencyKey: session.idempotencyKey,
            },
          },
        });
        await tx.anchorCreationSession.update({
          where: { id: session.id },
          data: {
            ownerId: targetOwner.id,
            idempotencyKey: collision ? `merged:${session.id}` : session.idempotencyKey,
          },
        });
      }
    } else if (transferHash)
      throw new AppError('Invalid guest transfer proof.', 403, 'INVALID_GUEST_PROOF');
    const savedCount = await tx.anchor.count({ where: { userId: guest.id } });
    await tx.anchor.updateMany({ where: { userId: guest.id }, data: { userId: target.id } });
    await tx.user.update({
      where: { id: target.id },
      data: { totalAnchorsCreated: { increment: Math.max(savedCount, guest.totalAnchorsCreated) } },
    });
    await tx.user.update({
      where: { id: guest.id },
      data: { authProvider: `merged_guest:${target.id}` },
    });
  });
}
