import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Pre-ledger account reconciliation (policy v1).
 *
 * Purpose: classify accounts that existed before the creation ledger, record the evidence, and make
 * the lifetime "saved Anchor" counter agree with the saved rows that provably exist.
 *
 * Hard rules (see docs/release/anchor-2-historical-reconciliation.md):
 *  - Never creates generation sessions: abandoned legacy generations were never logged, so no
 *    historical usage is fabricated.
 *  - Never grants capacity and never revokes paid access. The counter is only ever raised
 *    (GREATEST), never lowered, and subscription/trial fields are read-only here.
 *  - Idempotent: the record is keyed by (user, policy version); a re-run changes nothing further.
 *  - Concurrency: each user is handled in one transaction holding only that user's row lock, the
 *    same lock the Anchor save path takes first, so there is no new lock-order cycle.
 */
export const RECONCILIATION_POLICY_VERSION = 1;
const LEGACY_TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type AccessClass =
  | 'merged_guest_tombstone'
  | 'paid_or_comped'
  | 'legacy_trial_active'
  | 'legacy_trial_expired'
  | 'free';

export type HistoryClass =
  | 'no_saved_history'
  | 'consistent'
  | 'counter_only'
  | 'rows_exceed_counter'
  | 'free_over_limit';

export type Uncertainty =
  | 'GENERATION_HISTORY_UNAVAILABLE'
  | 'COUNTER_EXCEEDS_SURVIVING_ROWS'
  | 'ANCHORS_PREDATE_ACCOUNT'
  | 'FREE_ACCOUNT_OVER_LIMIT'
  | 'TRIAL_START_UNVERIFIED_LEGACY'
  | 'TRIAL_START_BEFORE_ACCOUNT'
  | 'TRIAL_START_IN_FUTURE'
  | 'PAID_STATUS_CACHE_ONLY'
  | 'UNLINKED_GUEST_WITH_DATA';

export interface UserEvidence {
  userId: string;
  authProvider: string;
  subscriptionStatus: string;
  isComped: boolean;
  userCreatedAt: Date;
  trialStartedAt: Date | null;
  counter: number;
  liveAnchors: number;
  archivedAnchors: number;
  burnedAnchors: number;
  ledgerLinkedSaves: number;
  anchorsBeforeAccount: number;
  savedInTrialWindow: number;
  savedTodayUtc: number;
}

export interface Classification {
  access: AccessClass;
  history: HistoryClass;
  classification: string;
  uncertainties: Uncertainty[];
  targetCounter: number;
}

export interface Cutover {
  /** Accounts created at/after this instant never used an unledgered path. */
  at: Date;
}

/** Pure and deterministic: no I/O, so it is exhaustively testable. */
export function classifyUser(e: UserEvidence, now: Date, cutover: Cutover): Classification {
  const uncertainties = new Set<Uncertainty>();
  const totalRows = e.liveAnchors + e.burnedAnchors;
  const legacyAccount = e.userCreatedAt < cutover.at;

  let access: AccessClass;
  if (e.authProvider.startsWith('merged_guest:')) access = 'merged_guest_tombstone';
  else if (e.isComped || e.subscriptionStatus === 'pro' || e.subscriptionStatus === 'pro_annual') {
    access = 'paid_or_comped';
    uncertainties.add('PAID_STATUS_CACHE_ONLY');
  } else if (e.trialStartedAt) {
    uncertainties.add('TRIAL_START_UNVERIFIED_LEGACY');
    if (e.trialStartedAt < e.userCreatedAt) uncertainties.add('TRIAL_START_BEFORE_ACCOUNT');
    if (e.trialStartedAt > now) uncertainties.add('TRIAL_START_IN_FUTURE');
    access =
      now.getTime() < e.trialStartedAt.getTime() + LEGACY_TRIAL_DURATION_MS
        ? 'legacy_trial_active'
        : 'legacy_trial_expired';
  } else access = 'free';

  let history: HistoryClass;
  if (access === 'free' && totalRows > 1) history = 'free_over_limit';
  else if (totalRows === 0) history = e.counter > 0 ? 'counter_only' : 'no_saved_history';
  else history = totalRows > e.counter ? 'rows_exceed_counter' : 'consistent';
  if (e.counter > totalRows) uncertainties.add('COUNTER_EXCEEDS_SURVIVING_ROWS');
  if (history === 'free_over_limit') uncertainties.add('FREE_ACCOUNT_OVER_LIMIT');
  if (e.anchorsBeforeAccount > 0) uncertainties.add('ANCHORS_PREDATE_ACCOUNT');
  if (e.authProvider === 'anonymous' && totalRows > 0)
    uncertainties.add('UNLINKED_GUEST_WITH_DATA');
  // Abandoned legacy generations were never logged anywhere; every pre-cutover account has that gap.
  if (legacyAccount && access !== 'merged_guest_tombstone') {
    uncertainties.add('GENERATION_HISTORY_UNAVAILABLE');
  }

  return {
    access,
    history,
    classification: `${access}:${history}`,
    uncertainties: [...uncertainties].sort(),
    // Monotonic: evidence can only raise the lifetime counter. Tombstones are never touched.
    targetCounter: access === 'merged_guest_tombstone' ? e.counter : Math.max(e.counter, totalRows),
  };
}

type Tx = Prisma.TransactionClient;

export async function collectUserEvidence(
  tx: Tx,
  userId: string,
  now: Date
): Promise<UserEvidence | null> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      authProvider: true,
      subscriptionStatus: true,
      isComped: true,
      createdAt: true,
      trialStartedAt: true,
      totalAnchorsCreated: true,
    },
  });
  if (!user) return null;
  const trialSince = user.trialStartedAt ?? new Date(0);
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = await tx.$queryRaw<
    Array<{
      live: number;
      archived: number;
      burned: number;
      linked: number;
      predate: number;
      in_trial: number;
      today: number;
    }>
  >`
    SELECT
      (SELECT COUNT(*) FROM anchors WHERE "userId" = ${userId})::int AS live,
      (SELECT COUNT(*) FROM anchors WHERE "userId" = ${userId} AND "isArchived" = true)::int AS archived,
      (SELECT COUNT(*) FROM burned_anchors WHERE "userId" = ${userId})::int AS burned,
      (SELECT COUNT(*) FROM anchors a WHERE a."userId" = ${userId}
         AND EXISTS (SELECT 1 FROM anchor_creation_sessions s WHERE s.saved_anchor_id = a.id))::int AS linked,
      ((SELECT COUNT(*) FROM anchors WHERE "userId" = ${userId} AND "createdAt" < ${user.createdAt})
       + (SELECT COUNT(*) FROM burned_anchors WHERE "userId" = ${userId} AND "createdAt" < ${user.createdAt}))::int AS predate,
      ((SELECT COUNT(*) FROM anchors WHERE "userId" = ${userId} AND "createdAt" >= ${trialSince})
       + (SELECT COUNT(*) FROM burned_anchors WHERE "userId" = ${userId} AND "createdAt" >= ${trialSince}))::int AS in_trial,
      ((SELECT COUNT(*) FROM anchors WHERE "userId" = ${userId} AND "createdAt" >= ${today})
       + (SELECT COUNT(*) FROM burned_anchors WHERE "userId" = ${userId} AND "createdAt" >= ${today}))::int AS today`;
  const r = rows[0];
  return {
    userId,
    authProvider: user.authProvider,
    subscriptionStatus: user.subscriptionStatus,
    isComped: user.isComped,
    userCreatedAt: user.createdAt,
    trialStartedAt: user.trialStartedAt,
    counter: user.totalAnchorsCreated,
    liveAnchors: r.live,
    archivedAnchors: r.archived,
    burnedAnchors: r.burned,
    ledgerLinkedSaves: r.linked,
    anchorsBeforeAccount: r.predate,
    savedInTrialWindow: r.in_trial,
    savedTodayUtc: r.today,
  };
}

export interface UserOutcome {
  userId: string;
  classification: string;
  uncertainties: Uncertainty[];
  counterBefore: number;
  counterAfter: number;
  counterRaised: boolean;
  recordCreated: boolean;
}

/** One transaction per user. Dry-run takes no write lock and writes nothing. */
export async function reconcileUser(
  db: PrismaClient,
  userId: string,
  opts: { apply: boolean; runId: string; now?: Date; cutover: Cutover }
): Promise<UserOutcome | null> {
  const now = opts.now ?? new Date();
  const run = async (tx: Tx): Promise<UserOutcome | null> => {
    if (opts.apply) await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${userId} FOR UPDATE`;
    const evidence = await collectUserEvidence(tx, userId, now);
    if (!evidence) return null;
    const c = classifyUser(evidence, now, opts.cutover);
    const outcome: UserOutcome = {
      userId,
      classification: c.classification,
      uncertainties: c.uncertainties,
      counterBefore: evidence.counter,
      counterAfter: c.targetCounter,
      counterRaised: c.targetCounter > evidence.counter,
      recordCreated: false,
    };
    if (!opts.apply) return outcome;
    if (outcome.counterRaised) {
      // GREATEST keeps this monotonic even if another writer incremented after our read.
      await tx.$executeRaw`UPDATE users SET "totalAnchorsCreated" = GREATEST("totalAnchorsCreated", ${c.targetCounter}) WHERE id = ${userId}`;
    }
    const evidenceJson = JSON.parse(
      JSON.stringify({ ...evidence, policy: RECONCILIATION_POLICY_VERSION })
    ) as Prisma.InputJsonValue;
    const inserted = await tx.$executeRaw`
      INSERT INTO anchor_creation_reconciliations
        (user_id, policy_version, classification, uncertainties, evidence, counter_before, counter_after, run_id)
      VALUES (${userId}, ${RECONCILIATION_POLICY_VERSION}, ${c.classification}, ${c.uncertainties}::text[],
              ${JSON.stringify(evidenceJson)}::jsonb, ${evidence.counter}, ${c.targetCounter}, ${opts.runId})
      ON CONFLICT (user_id, policy_version) DO NOTHING`;
    outcome.recordCreated = inserted === 1;
    if (!outcome.recordCreated) {
      // Re-run: refresh evidence only; the original counter_before/run_id remain the audit trail.
      await tx.$executeRaw`
        UPDATE anchor_creation_reconciliations
        SET classification = ${c.classification}, uncertainties = ${c.uncertainties}::text[],
            evidence = ${JSON.stringify(evidenceJson)}::jsonb,
            counter_after = GREATEST(counter_after, ${c.targetCounter}), updated_at = now()
        WHERE user_id = ${userId} AND policy_version = ${RECONCILIATION_POLICY_VERSION}`;
    }
    return outcome;
  };
  return opts.apply
    ? db.$transaction(run, { maxWait: 30_000, timeout: 30_000 })
    : db.$transaction(run, { maxWait: 30_000, timeout: 30_000, isolationLevel: 'RepeatableRead' });
}

export interface ReconciliationReport {
  mode: 'dry-run' | 'apply';
  policyVersion: number;
  runId: string;
  cutoverAt: string;
  accountsScanned: number;
  countersRaised: number;
  recordsCreated: number;
  byClassification: Record<string, number>;
  byUncertainty: Record<string, number>;
  /** Last user id processed: pass as `afterId` to resume a stopped run. */
  lastUserId: string | null;
}

export async function runReconciliation(
  db: PrismaClient,
  opts: {
    apply: boolean;
    runId: string;
    cutover: Cutover;
    batchSize?: number;
    afterId?: string;
    limit?: number;
    now?: Date;
    onProgress?: (r: ReconciliationReport) => void;
  }
): Promise<ReconciliationReport> {
  const batchSize = opts.batchSize ?? 200;
  const report: ReconciliationReport = {
    mode: opts.apply ? 'apply' : 'dry-run',
    policyVersion: RECONCILIATION_POLICY_VERSION,
    runId: opts.runId,
    cutoverAt: opts.cutover.at.toISOString(),
    accountsScanned: 0,
    countersRaised: 0,
    recordsCreated: 0,
    byClassification: {},
    byUncertainty: {},
    lastUserId: opts.afterId ?? null,
  };
  for (;;) {
    const remaining =
      opts.limit === undefined
        ? batchSize
        : Math.min(batchSize, opts.limit - report.accountsScanned);
    if (remaining <= 0) break;
    // Keyset pagination: a restart resumes after `lastUserId`; already-handled users are no-ops anyway.
    const users = await db.user.findMany({
      where: report.lastUserId ? { id: { gt: report.lastUserId } } : {},
      orderBy: { id: 'asc' },
      take: remaining,
      select: { id: true },
    });
    if (!users.length) break;
    for (const { id } of users) {
      const outcome = await reconcileUser(db, id, opts);
      report.lastUserId = id;
      if (!outcome) continue; // deleted while running
      report.accountsScanned += 1;
      report.countersRaised += outcome.counterRaised ? 1 : 0;
      report.recordsCreated += outcome.recordCreated ? 1 : 0;
      report.byClassification[outcome.classification] =
        (report.byClassification[outcome.classification] ?? 0) + 1;
      for (const u of outcome.uncertainties) {
        report.byUncertainty[u] = (report.byUncertainty[u] ?? 0) + 1;
      }
    }
    opts.onProgress?.(report);
  }
  return report;
}
