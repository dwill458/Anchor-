/**
 * Historical reconciliation against an isolated PostgreSQL database with sanitized synthetic fixtures.
 * Opt in with ANCHOR_RECONCILE_TEST_DATABASE_URL (database name must contain "anchor_reconcile").
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AnchorCreationLedger } from '../services/AnchorCreationLedger';
import { countHistoricalCreationBaseline } from '../services/AnchorCreationQuotaPolicy';
import {
  RECONCILIATION_POLICY_VERSION,
  reconcileUser,
  runReconciliation,
} from '../services/CreationLedgerReconciliationService';

const url = process.env.ANCHOR_RECONCILE_TEST_DATABASE_URL;
const describePg = url ? describe : describe.skip;
const DAY = 86_400_000;

describePg('pre-ledger reconciliation on isolated PostgreSQL', () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? process.env.DATABASE_URL } } });
  const ledger = new AnchorCreationLedger(db);
  const cutover = { at: new Date() };
  const created: string[] = [];
  const now = new Date();

  beforeAll(() => {
    if (!url?.includes('anchor_reconcile')) throw new Error('Isolated reconciliation database required');
  });
  afterAll(async () => {
    await db.anchorCreationReconciliation.deleteMany({ where: { userId: { in: created } } });
    await db.anchorCreationSession.deleteMany({ where: { owner: { userId: { in: created } } } });
    await db.anchorCreationQuotaOwner.deleteMany({ where: { userId: { in: created } } });
    await db.burnedAnchor.deleteMany({ where: { userId: { in: created } } });
    await db.user.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  });

  async function user(opts: {
    counter?: number;
    status?: string;
    comped?: boolean;
    provider?: string;
    trialStartedAt?: Date | null;
    createdAt?: Date;
  } = {}) {
    const id = `recon-${randomUUID()}`;
    created.push(id);
    await db.user.create({
      data: {
        id,
        authUid: `fb-${id}`,
        email: `${id}@isolated.test`,
        authProvider: opts.provider ?? 'firebase',
        subscriptionStatus: opts.status ?? 'free',
        isComped: opts.comped ?? false,
        trialStartedAt: opts.trialStartedAt ?? null,
        totalAnchorsCreated: opts.counter ?? 0,
        createdAt: opts.createdAt ?? new Date(now.getTime() - 60 * DAY),
      },
    });
    return id;
  }
  const anchor = (userId: string, createdAt: Date, archived = false) =>
    db.anchor.create({
      data: {
        id: randomUUID(),
        userId,
        intentionText: 'sanitized',
        category: 'custom',
        distilledLetters: [],
        createdAt,
        isArchived: archived,
      },
    });
  const burned = (userId: string, createdAt: Date) =>
    db.burnedAnchor.create({
      data: {
        originalAnchorId: randomUUID(),
        userId,
        intentionText: 'sanitized',
        category: 'custom',
        distilledLetters: [],
        activationCount: 0,
        createdAt,
      },
    });
  const counter = async (id: string) =>
    (await db.user.findUniqueOrThrow({ where: { id } })).totalAnchorsCreated;
  const ownerOf = (userId: string) =>
    db.anchorCreationQuotaOwner.upsert({ where: { userId }, create: { userId }, update: {} });
  const reservation = (ownerId: string, scope: string, limit: number, since?: Date) => ({
    ownerId,
    idempotencyKey: randomUUID(),
    requestHash: randomUUID(),
    quotaScope: scope,
    limit,
    baselineSince: since,
    expiresAt: new Date(now.getTime() + 60_000),
  });

  it('burned (hard-deleted) saves block the free lifetime Anchor even with a stale counter', async () => {
    const id = await user({ counter: 0 });
    await burned(id, new Date(now.getTime() - 30 * DAY));
    const owner = await ownerOf(id);
    await expect(ledger.reserve(reservation(owner.id, 'free:lifetime', 1, new Date(0)))).rejects.toThrow(
      'Free lifetime Anchor already saved'
    );
  });

  it('burned saves inside a legacy trial window consume trial capacity and cannot be double counted', async () => {
    const started = new Date(now.getTime() - 2 * DAY);
    const id = await user({ trialStartedAt: started });
    for (let i = 0; i < 5; i += 1) await anchor(id, new Date(started.getTime() + (i + 1) * 60_000));
    await burned(id, new Date(started.getTime() + 10 * 60_000));
    await burned(id, new Date(started.getTime() - DAY)); // before the trial: not counted
    const owner = await ownerOf(id);
    expect(await db.$transaction(tx => countHistoricalCreationBaseline(tx, id, started))).toBe(6);
    const scope = `trial:${started.toISOString()}`;
    await expect(ledger.reserve(reservation(owner.id, scope, 7, started))).resolves.toBeDefined();
    await expect(ledger.reserve(reservation(owner.id, scope, 7, started))).rejects.toThrow('Creation quota exceeded');
  });

  it('a burned save already covered by a ledger session is counted once', async () => {
    const id = await user();
    const owner = await ownerOf(id);
    const b = await burned(id, new Date(now.getTime() - DAY));
    await db.anchorCreationSession.create({
      data: {
        ownerId: owner.id,
        idempotencyKey: randomUUID(),
        requestHash: 'x',
        quotaScope: 'trial:x',
        status: 'completed',
        completedAt: new Date(),
        expiresAt: new Date(now.getTime() + DAY),
        savedAnchorId: b.originalAnchorId,
      },
    });
    expect(await db.$transaction(tx => countHistoricalCreationBaseline(tx, id, new Date(0)))).toBe(0);
  });

  it('dry-run writes nothing; apply classifies, repairs counters monotonically, never touches access; re-run is a no-op', async () => {
    const staleFree = await user({ counter: 0 });
    await anchor(staleFree, new Date(now.getTime() - 20 * DAY));
    const burnedOnly = await user({ counter: 0 });
    await burned(burnedOnly, new Date(now.getTime() - 20 * DAY));
    const counterOnly = await user({ counter: 1 });
    const overLimit = await user({ counter: 2 });
    await anchor(overLimit, new Date(now.getTime() - 20 * DAY));
    await anchor(overLimit, new Date(now.getTime() - 10 * DAY), true);
    const paid = await user({ status: 'pro', counter: 0 });
    for (let i = 0; i < 4; i += 1) await anchor(paid, new Date(now.getTime() - i * DAY));
    const comped = await user({ comped: true });
    const tombstone = await user({ provider: `merged_guest:${randomUUID()}`, counter: 0 });
    await anchor(tombstone, new Date(now.getTime() - DAY));
    const predates = await user({ counter: 1, createdAt: new Date(now.getTime() - DAY) });
    await anchor(predates, new Date(now.getTime() - 5 * DAY));
    const trialExpired = await user({ trialStartedAt: new Date(now.getTime() - 20 * DAY), counter: 1 });
    await anchor(trialExpired, new Date(now.getTime() - 19 * DAY));
    const clean = await user();
    const ids = [staleFree, burnedOnly, counterOnly, overLimit, paid, comped, tombstone, predates, trialExpired, clean];

    const snapshot = () =>
      db.user.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
        select: { id: true, totalAnchorsCreated: true, subscriptionStatus: true, isComped: true, trialStartedAt: true, subscriptionId: true },
      });
    const before = await snapshot();

    const dry = await runReconciliation(db, { apply: false, runId: 'dry', cutover });
    expect(await snapshot()).toEqual(before);
    expect(await db.anchorCreationReconciliation.count({ where: { userId: { in: ids } } })).toBe(0);
    expect(dry.mode).toBe('dry-run');
    expect(dry.recordsCreated).toBe(0);
    expect(dry.countersRaised).toBeGreaterThanOrEqual(4);

    const first = await runReconciliation(db, { apply: true, runId: 'apply-1', cutover });
    expect(first.byClassification).toEqual(dry.byClassification);
    const after = new Map((await snapshot()).map(u => [u.id, u]));
    // Counters only rise, to the provable saved-row count.
    expect(after.get(staleFree)!.totalAnchorsCreated).toBe(1);
    expect(after.get(burnedOnly)!.totalAnchorsCreated).toBe(1);
    expect(after.get(counterOnly)!.totalAnchorsCreated).toBe(1);
    expect(after.get(overLimit)!.totalAnchorsCreated).toBe(2);
    expect(after.get(paid)!.totalAnchorsCreated).toBe(4);
    expect(after.get(tombstone)!.totalAnchorsCreated).toBe(0);
    expect(after.get(clean)!.totalAnchorsCreated).toBe(0);
    // Access fields are never modified.
    for (const b of before) {
      const a = after.get(b.id)!;
      expect({ ...a, totalAnchorsCreated: 0 }).toEqual({ ...b, totalAnchorsCreated: 0 });
    }
    const rec = (id: string) =>
      db.anchorCreationReconciliation.findUniqueOrThrow({
        where: { userId_policyVersion: { userId: id, policyVersion: RECONCILIATION_POLICY_VERSION } },
      });
    expect((await rec(staleFree)).classification).toBe('free:rows_exceed_counter');
    expect((await rec(burnedOnly)).classification).toBe('free:rows_exceed_counter');
    expect((await rec(counterOnly)).classification).toBe('free:counter_only');
    expect((await rec(counterOnly)).uncertainties).toContain('COUNTER_EXCEEDS_SURVIVING_ROWS');
    expect((await rec(overLimit)).classification).toBe('free:free_over_limit');
    expect((await rec(paid)).classification).toBe('paid_or_comped:rows_exceed_counter');
    expect((await rec(comped)).classification).toBe('paid_or_comped:no_saved_history');
    expect((await rec(tombstone)).classification).toBe('merged_guest_tombstone:rows_exceed_counter');
    expect((await rec(predates)).uncertainties).toContain('ANCHORS_PREDATE_ACCOUNT');
    expect((await rec(trialExpired)).classification).toBe('legacy_trial_expired:consistent');
    expect((await rec(trialExpired)).uncertainties).toContain('TRIAL_START_UNVERIFIED_LEGACY');
    expect((await rec(clean)).classification).toBe('free:no_saved_history');

    // Existing saved Anchors are preserved.
    expect(await db.anchor.count({ where: { userId: overLimit } })).toBe(2);
    expect(await db.burnedAnchor.count({ where: { userId: burnedOnly } })).toBe(1);

    const originalBefore = (await rec(staleFree)).counterBefore;
    const second = await runReconciliation(db, { apply: true, runId: 'apply-2', cutover });
    expect(second.countersRaised).toBe(0);
    expect(second.recordsCreated).toBe(0);
    expect(await snapshot()).toEqual(Array.from(after.values()));
    expect((await rec(staleFree)).counterBefore).toBe(originalBefore);
    expect((await rec(staleFree)).runId).toBe('apply-1');

    // A reconciled free account stays locked, with or without the counter repair.
    const owner = await ownerOf(staleFree);
    await expect(ledger.reserve(reservation(owner.id, 'free:lifetime', 1, new Date(0)))).rejects.toThrow(
      'Free lifetime Anchor already saved'
    );
    // A clean free account keeps exactly its one lifetime creation.
    const cleanOwner = await ownerOf(clean);
    await expect(ledger.reserve(reservation(cleanOwner.id, 'free:lifetime', 1, new Date(0)))).resolves.toBeDefined();
    await expect(ledger.reserve(reservation(cleanOwner.id, 'free:lifetime', 1, new Date(0)))).rejects.toThrow('Creation quota exceeded');
  });

  it('is restartable: a limited run followed by a cursor resume matches one full run', async () => {
    const before = await db.anchorCreationReconciliation.count();
    await db.anchorCreationReconciliation.deleteMany({});
    const partial = await runReconciliation(db, { apply: true, runId: 'p1', cutover, batchSize: 3, limit: 5 });
    expect(partial.accountsScanned).toBe(5);
    const rest = await runReconciliation(db, { apply: true, runId: 'p2', cutover, batchSize: 3, afterId: partial.lastUserId! });
    expect(await db.anchorCreationReconciliation.count()).toBe(before);
    expect(partial.accountsScanned + rest.accountsScanned).toBe(before);
  });

  it('concurrent saves and reconciliation never corrupt the counter or deadlock', async () => {
    const id = await user({ counter: 0 });
    for (let i = 0; i < 3; i += 1) await anchor(id, new Date(now.getTime() - (i + 1) * DAY));
    const save = () =>
      db.$transaction(async tx => {
        await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${id} FOR UPDATE`;
        await tx.anchor.create({
          data: { id: randomUUID(), userId: id, intentionText: 'concurrent', category: 'custom', distilledLetters: [] },
        });
        await tx.user.update({ where: { id }, data: { totalAnchorsCreated: { increment: 1 } } });
      });
    const work = [
      ...Array.from({ length: 8 }, () => reconcileUser(db, id, { apply: true, runId: 'c', cutover })),
      ...Array.from({ length: 8 }, save),
    ];
    const settled = await Promise.allSettled(work.sort(() => Math.random() - 0.5));
    expect(settled.filter(s => s.status === 'rejected')).toHaveLength(0);
    const rows = await db.anchor.count({ where: { userId: id } });
    expect(rows).toBe(11);
    expect(await counter(id)).toBe(rows);
    expect(await db.anchorCreationReconciliation.count({ where: { userId: id } })).toBe(1);
  });
});
