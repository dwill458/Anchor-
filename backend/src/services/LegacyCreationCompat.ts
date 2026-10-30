import { Response } from 'express';
import { createHash } from 'crypto';

/**
 * Bounded, metered transitional compatibility for the released Anchor 1.x client.
 *
 * Released 1.x builds call POST /api/ai/enhance (and the /enhance-controlnet alias) with an optional
 * Firebase bearer token, a client-minted `temp-<timestamp>` anchorId and no creation session. They
 * save generated art via POST /api/anchors carrying only the generated image URL.
 *
 * While the window is open, an AUTHENTICATED, NON-ANONYMOUS caller without a session is metered by
 * the same server ledger as every other caller (implicit session, same free/trial/pro caps), and a
 * legacy save is honoured only if its image URL is an output the same user already generated and has
 * not yet saved. Unauthenticated and anonymous callers are never admitted.
 *
 * The window is OFF unless ANCHOR_LEGACY_CREATION_COMPAT_UNTIL is set, and can never extend past
 * LEGACY_COMPAT_HARD_STOP, which is compiled in: extending it requires a reviewed code change.
 */
export const LEGACY_COMPAT_HARD_STOP = new Date('2026-12-15T00:00:00.000Z');
export const UPGRADE_REQUIRED_CODE = 'ANCHOR_CREATION_UPGRADE_REQUIRED';

export function legacyCompatDeadline(env: NodeJS.ProcessEnv = process.env): Date | null {
  const raw = env.ANCHOR_LEGACY_CREATION_COMPAT_UNTIL?.trim();
  if (!raw) return null;
  const configured = new Date(raw);
  if (Number.isNaN(configured.getTime())) return null;
  return configured < LEGACY_COMPAT_HARD_STOP ? configured : LEGACY_COMPAT_HARD_STOP;
}

export function isLegacyCompatActive(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env) {
  const deadline = legacyCompatDeadline(env);
  return deadline !== null && now < deadline;
}

/** Only registered (non-anonymous) verified identities can be legacy 1.x callers. */
export function isLegacyCompatCaller(user?: { uid?: string; signInProvider?: string }): boolean {
  return Boolean(user?.uid) && user?.signInProvider !== 'anonymous';
}

/** Deterministic, per-user key so a retried legacy request cannot mint unbounded sessions. */
export function legacyImplicitSessionKey(userId: string, requestHash: string): string {
  return `legacy:${createHash('sha256').update(`${userId}:${requestHash}`).digest('hex')}`;
}

/**
 * 426 body readable by every client generation. Released 1.5 reads `message` (falling back to
 * `error`, which it would stringify as "[object Object]" if it were an object); newer clients read
 * `error.code`. Both are present.
 */
export function sendUpgradeRequired(res: Response, message: string): void {
  res.status(426).json({
    success: false,
    code: UPGRADE_REQUIRED_CODE,
    message,
    error: { code: UPGRADE_REQUIRED_CODE, message },
  });
}
