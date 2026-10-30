import { useAuthStore } from '@/stores/authStore';

/** Fences all async creation work, including an A → B → A switch. */
export function captureCreationAuthContext() {
  const initial = useAuthStore.getState();
  const revision = initial.accountRevision;
  const userId = initial.user?.id;
  const token = initial.token;
  const authenticated = initial.isAuthenticated;
  const isCurrent = () => {
    const current = useAuthStore.getState();
    return current.accountRevision === revision && current.user?.id === userId
      && current.token === token && current.isAuthenticated === authenticated;
  };
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error('Authentication context changed. Retry in your current account.');
  };
  const assertIdentity = (verifiedUserId: string, isAnonymous?: boolean) => {
    assertCurrent();
    if ((authenticated && verifiedUserId !== userId) || (!authenticated && isAnonymous === false)) {
      throw new Error('Authentication context changed. Retry in your current account.');
    }
  };
  return { revision, userId, authenticated, isCurrent, assertCurrent, assertIdentity };
}
