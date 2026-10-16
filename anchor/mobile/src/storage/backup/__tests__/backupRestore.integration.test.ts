import { randomBytes } from 'node:crypto';
import { fixture } from '../../sqlcipher/__tests__/sqliteTestDriver';
import { createEncryptedBackup } from '../backupService';
import { databaseBackupSource, databaseRestoreTarget } from '../databaseAdapters';
import { restoreEncryptedBackup } from '../restoreService';
import { BackupError, formatRecoverySecret, generateRecoveryKey } from '../archiveCrypto';

const random = async (n: number) => new Uint8Array(randomBytes(n));
const SCENE = 'anchor-visualization-scenes-v1::owner::';

function scene(owner: string | null, label: string) {
  const id = `anchor-${label}`;
  return {
    state: {
      ownerAccountId: owner,
      scenes: { [id]: { id, label } },
      suggestions: {},
      selectedSuggestionIndex: {},
      batchSource: {},
      upgradeAttempts: {},
      tombstonedAnchorIds: [],
    },
    version: 0,
  };
}

function plainStore(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return {
    values,
    source: { keys: async () => Object.keys(values), read: async (k: string) => values[k] ?? null },
    target: {
      writeAll: async (entries: { key: string; value: string }[]) => { for (const e of entries) values[e.key] = e.value; },
    },
  };
}

async function seededSource() {
  const src = fixture();
  await src.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-A-SCENE'));
  await src.db.write(`${SCENE}account:B`, scene('B', 'SYNTHETIC-B-SCENE'));
  await src.db.write(`${SCENE}guest`, scene('guest', 'SYNTHETIC-GUEST-SCENE'));
  return src;
}

async function makeBackup(src: Awaited<ReturnType<typeof seededSource>>, plain = plainStore({ 'anchor-profile-storage': '{"state":{"displayName":"SYNTHETIC"},"version":0}' })) {
  const result = await createEncryptedBackup({
    source: databaseBackupSource(src.db, plain.source),
    randomBytes: random,
    createdAt: new Date('2026-10-15T12:00:00Z'),
  });
  if (!result.ok) throw new Error('backup unexpectedly refused');
  return result;
}

describe('encrypted backup and staged restore (synthetic SQLite, real record codec)', () => {
  it('exports every owner, verifies, and restores into a separate database with the secret alone', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    expect(backup.status).toBe('complete');
    expect(backup.summary.recordCount).toBeGreaterThan(0);

    const dst = fixture();
    const plain = plainStore();
    const restored = await restoreEncryptedBackup({
      archive: backup.archive,
      recoverySecret: backup.recoverySecret,
      generationId: 'gen-test-0001',
      target: databaseRestoreTarget(dst.db, plain.target),
      authorizeOwnerScopes: () => true,
    });
    expect(restored.documents).toBe(backup.summary.documentCount);
    expect(plain.values['anchor-profile-storage']).toContain('SYNTHETIC');

    expect(await dst.db.read(`${SCENE}account:A`)).toEqual(await src.db.read(`${SCENE}account:A`));
    const ownerB = await dst.db.ownerRecords(`${SCENE}account:B`, 'account:B');
    expect(ownerB.some((r) => r.payload.includes('SYNTHETIC-A-SCENE'))).toBe(false);
    expect(await dst.db.listStagedGenerations()).toEqual([]);
  });

  it('refuses a wrong recovery secret and leaves active records untouched', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    const dst = fixture();
    await dst.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-LIVE-LOCAL'));
    const wrong = formatRecoverySecret(await generateRecoveryKey(random));
    await expect(restoreEncryptedBackup({ archive: backup.archive, recoverySecret: wrong, generationId: 'gen-wrong-0001', target: databaseRestoreTarget(dst.db, plainStore().target), authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
    expect(JSON.stringify(await dst.db.read(`${SCENE}account:A`))).toContain('SYNTHETIC-LIVE-LOCAL');
  });

  it('rejects tampered, truncated and typo-mangled archives before staging', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    const target = () => databaseRestoreTarget(fixture().db, plainStore().target);
    const tampered = backup.archive.slice();
    tampered[tampered.length - 3] ^= 0x40;
    await expect(restoreEncryptedBackup({ archive: tampered, recoverySecret: backup.recoverySecret, generationId: 'gen-tamper-01', target: target(), authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
    await expect(restoreEncryptedBackup({ archive: backup.archive.slice(0, backup.archive.length - 40), recoverySecret: backup.recoverySecret, generationId: 'gen-trunc-01', target: target(), authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'TRUNCATED' });
    const typo = backup.recoverySecret.replace(/^(.)/, (c) => (c === 'A' ? 'B' : 'A'));
    await expect(restoreEncryptedBackup({ archive: backup.archive, recoverySecret: typo, generationId: 'gen-typo-0001', target: target(), authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'SECRET_INVALID' });
  });

  it('keeps the active database intact and leaves no staged rows when activation is interrupted', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    const dst = fixture();
    await dst.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-LIVE-LOCAL'));
    const inner = databaseRestoreTarget(dst.db, plainStore().target);
    const interrupted = { ...inner, activate: async () => { throw new Error('synthetic process interruption'); } };
    await expect(restoreEncryptedBackup({ archive: backup.archive, recoverySecret: backup.recoverySecret, generationId: 'gen-intr-0001', target: interrupted, authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'INTERRUPTED' });
    expect(JSON.stringify(await dst.db.read(`${SCENE}account:A`))).toContain('SYNTHETIC-LIVE-LOCAL');
    expect(await dst.db.listStagedGenerations()).toEqual([]);
  });

  it('includes a write issued just before backup because the database fence orders it first', async () => {
    const src = await seededSource();
    const pending = src.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-PENDING-WRITE'));
    const backup = await makeBackup(src);
    await pending;
    const dst = fixture();
    await restoreEncryptedBackup({ archive: backup.archive, recoverySecret: backup.recoverySecret, generationId: 'gen-pend-0001', target: databaseRestoreTarget(dst.db, plainStore().target), authorizeOwnerScopes: () => true });
    expect(JSON.stringify(await dst.db.read(`${SCENE}account:A`))).toContain('SYNTHETIC-PENDING-WRITE');
  });

  it('refuses to report a complete backup when an enumerated namespace has no registry rule', async () => {
    const src = await seededSource();
    const plain = plainStore({ 'mystery-owner-key': '{"unknown":true}' });
    const refused = await createEncryptedBackup({ source: databaseBackupSource(src.db, plain.source), randomBytes: random, createdAt: new Date() });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe('UNRESOLVED_NAMESPACES');
      expect(refused.coverage.unresolved.map((u) => u.name)).toEqual(['mystery-owner-key']);
    }
    const acknowledged = await createEncryptedBackup({ source: databaseBackupSource(src.db, plain.source), randomBytes: random, createdAt: new Date(), acknowledgeUnresolved: true });
    expect(acknowledged.ok && acknowledged.status).toBe('incomplete-acknowledged');
  });

  it('never restores an empty archive over local data', async () => {
    const dst = fixture();
    await dst.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-LIVE-LOCAL'));
    const empty = await createEncryptedBackup({ source: databaseBackupSource(fixture().db, plainStore().source), randomBytes: random, createdAt: new Date() });
    if (!empty.ok) throw new Error('unexpected refusal');
    await expect(restoreEncryptedBackup({ archive: empty.archive, recoverySecret: empty.recoverySecret, generationId: 'gen-empty-001', target: databaseRestoreTarget(dst.db, plainStore().target), authorizeOwnerScopes: () => true }))
      .rejects.toMatchObject({ code: 'FORMAT' });
    expect(JSON.stringify(await dst.db.read(`${SCENE}account:A`))).toContain('SYNTHETIC-LIVE-LOCAL');
  });

  it('does not stage or activate owner data unless the caller authorizes its owner scopes', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    const dst = fixture();
    await dst.db.write(`${SCENE}account:A`, scene('A', 'SYNTHETIC-LIVE-LOCAL'));
    await expect(restoreEncryptedBackup({
      archive: backup.archive,
      recoverySecret: backup.recoverySecret,
      generationId: 'gen-unauth-0001',
      target: databaseRestoreTarget(dst.db, plainStore().target),
      authorizeOwnerScopes: (scopes) => scopes.every((scope) => scope === 'account:current-user'),
    })).rejects.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(JSON.stringify(await dst.db.read(`${SCENE}account:A`))).toContain('SYNTHETIC-LIVE-LOCAL');
    expect(await dst.db.listStagedGenerations()).toEqual([]);
  });

  it('reports SQLCipher success and preference retry separately because AsyncStorage is not transactional with SQLCipher', async () => {
    const src = await seededSource();
    const backup = await makeBackup(src);
    const dst = fixture();
    const plain = plainStore();
    const target = { ...databaseRestoreTarget(dst.db, plain.target), writePlain: async () => { throw new Error('synthetic preference interruption'); } };
    const restored = await restoreEncryptedBackup({
      archive: backup.archive,
      recoverySecret: backup.recoverySecret,
      generationId: 'gen-plain-retry-01',
      target,
      authorizeOwnerScopes: () => true,
    });
    expect(restored.status).toBe('preferences-pending');
    expect(await dst.db.read(`${SCENE}account:A`)).toEqual(await src.db.read(`${SCENE}account:A`));
  });

  it('exposes a typed error for the caller to present without leaking content', async () => {
    const error = new BackupError('AUTHENTICATION_FAILED', 'x');
    expect(error.name).toBe('BackupError');
    expect(error.message).not.toContain('SYNTHETIC');
  });
});
