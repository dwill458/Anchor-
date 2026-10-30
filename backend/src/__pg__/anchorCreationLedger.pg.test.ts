import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AnchorCreationLedger } from '../services/AnchorCreationLedger';

const url = process.env.ANCHOR_CREATION_TEST_DATABASE_URL;
const pg = url ? describe : describe.skip;
pg('Anchor creation ledger on isolated PostgreSQL', () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? process.env.DATABASE_URL } } });
  const ledger = new AnchorCreationLedger(db);
  const ownerId = randomUUID();
  beforeAll(async () => {
    if (!url?.includes('anchor_quota_audit_1793301497')) throw new Error('Isolated database required');
    await db.anchorCreationQuotaOwner.create({ data: { id: ownerId, guestTokenHash: randomUUID() } });
  });
  afterAll(async () => {
    await db.anchorCreationOption.deleteMany({ where: { session: { ownerId } } });
    await db.anchorCreationSession.deleteMany({ where: { ownerId } });
    await db.anchorCreationQuotaOwner.deleteMany({ where: { id: ownerId } });
    await db.$disconnect();
  });
  const reservation = (scope: string, key = randomUUID(), limit = 7) => ({
    ownerId, idempotencyKey: key, requestHash: key, quotaScope: scope, limit,
    expiresAt: new Date(Date.now() + 60000),
  });
  it('serializes concurrent reservations at the trial limit', async () => {
    const result = await Promise.allSettled(Array.from({ length: 12 }, () => ledger.reserve(reservation('trial'))));
    expect(result.filter(x => x.status === 'fulfilled')).toHaveLength(7);
    expect(result.filter(x => x.status === 'rejected')).toHaveLength(5);
  });
  it('serializes concurrent reservations at the pro limit', async () => {
    const result = await Promise.allSettled(Array.from({ length: 16 }, () => ledger.reserve(reservation('pro', randomUUID(), 10))));
    expect(result.filter(x => x.status === 'fulfilled')).toHaveLength(10);
    expect(result.filter(x => x.status === 'rejected')).toHaveLength(6);
  });
  it('deduplicates concurrent requests and records two options for one credit', async () => {
    const input = reservation('dedup');
    const sessions = await Promise.all(Array.from({ length: 5 }, () => ledger.reserve(input)));
    expect(new Set(sessions.map(s => s.id)).size).toBe(1);
    await ledger.recordOption(ownerId, sessions[0].id, 0, { url: 'one' });
    await ledger.recordOption(ownerId, sessions[0].id, 1, { url: 'two' });
    expect(await db.anchorCreationOption.count({ where: { sessionId: sessions[0].id } })).toBe(2);
    expect(await db.anchorCreationSession.count({ where: { ownerId, quotaScope: 'dedup', status: 'completed' } })).toBe(1);
  });
  it('releases a failed reservation', async () => {
    const first = await ledger.reserve(reservation('failure', randomUUID(), 1));
    await ledger.fail(ownerId, first.id);
    expect(await ledger.reserve(reservation('failure', randomUUID(), 1))).toBeDefined();
  });
});
