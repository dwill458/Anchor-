import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../../lib/prisma';

export async function getAuthenticatedUserId(req: AuthRequest): Promise<string> {
  if (req.dbUser?.id) {
    return req.dbUser.id;
  }
  if (!req.user?.uid) {
    throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
  }
  const user = await prisma.user.findUnique({
    where: { authUid: req.user.uid },
    select: { id: true },
  });
  if (!user) {
    throw new AppError('User not found in database', 404, 'USER_NOT_FOUND');
  }
  return user.id;
}
