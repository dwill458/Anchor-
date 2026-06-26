import type { AuthScreenParams, PendingFirstAnchorDraft } from '@/types';

export const NO_ACCOUNT_FOCUS_SESSIONS_PER_WEEK = 2;
export const NO_ACCOUNT_DEEP_PRIMES_PER_WEEK = 0;
export const NO_ACCOUNT_SIGN_UP_PARAMS: AuthScreenParams = {
  context: 'save_progress',
  initialTab: 'signup',
};

export interface NoAccountSanctuaryState {
  isAuthenticated: boolean;
  pendingFirstAnchorDraft?: PendingFirstAnchorDraft | null;
  sanctuaryAnchorCount: number;
}

export function isNoAccountSanctuaryUser({
  isAuthenticated,
  pendingFirstAnchorDraft,
  sanctuaryAnchorCount,
}: NoAccountSanctuaryState): boolean {
  return (
    !isAuthenticated &&
    pendingFirstAnchorDraft?.requiresAccountGate !== true &&
    sanctuaryAnchorCount > 0
  );
}
