import { fixture } from './sqliteTestDriver';
import { EncryptedRecordDatabase } from '../database';
import { databaseFileUri } from '../databaseFileUri';
const anchor = (id: string, owner = 'A', text = 'private') => ({ id, userId: owner, intentionText: text, released: false, revision: 1 });
const vault = (anchors: unknown[]) => ({ state: { anchors, ownershipVersion: 1, scopeMetadata: {}, guestTransfers: {} }, version: 0 });

describe('encrypted record transactions (real SQLite, encryption tested natively)', () => {
  it('shares cold initialization and key retrieval across concurrent namespaces', async () => {
    const f = fixture();
    const readKey = jest.spyOn(f.deps, 'readKey');
    await Promise.all(Array.from({ length: 12 }, (_, index) => f.db.read(`cold-${index}`)));
    expect(readKey).toHaveBeenCalledTimes(1);
    expect(f.deps.open).toHaveBeenCalledTimes(1);
    await f.db.write('warm-write', { synthetic: true });
    expect(readKey).toHaveBeenCalledTimes(1);
    expect(f.deps.open).toHaveBeenCalledTimes(1);
  });
  it.each([0, 1, 72])('retains all %s synthetic legacy Anchors and source bytes', async (count) => {
    const source = vault(Array.from({ length: count }, (_, index) => anchor(`legacy-${index}`, index % 2 ? 'guest' : 'A')));
    const bytes = JSON.stringify(source);
    const f = fixture(source);
    expect(await f.db.read('anchor-vault-storage')).toEqual(source);
    await f.db.close();
    expect(await f.db.read('anchor-vault-storage')).toEqual(source);
    expect(JSON.stringify(source)).toBe(bytes);
  });
  it('retains post-activation writes after termination immediately following activation', async () => {
    const source = vault([anchor('original')]);
    const f = fixture(source);
    f.deps.checkpoint = async (stage) => { if (stage === 'activation-committed') throw new Error('synthetic process termination'); };
    await expect(f.db.read('anchor-vault-storage')).rejects.toThrow('termination');
    await f.db.close();
    f.deps.checkpoint = undefined;
    expect(await f.db.read('anchor-vault-storage')).toEqual(source);
    await f.db.write('anchor-vault-storage', vault([anchor('original', 'A', 'new database-only edit'), anchor('new')]));
    await f.db.close();
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).toContain('new database-only edit');
    expect(f.deps.legacyRead).toHaveBeenCalledTimes(1);
    expect(source.state.anchors[0]).toEqual(anchor('original'));
  });
  it.each(['missing legacy chunk', 'corrupt legacy manifest'])('fails closed on %s without a clean replacement', async (reason) => {
    const f = fixture();
    f.deps.legacyRead = async () => { throw new Error(reason); };
    await expect(f.db.read('anchor-vault-storage')).rejects.toThrow(reason);
    await expect(f.db.write('anchor-vault-storage', vault([]))).rejects.toThrow(reason);
    expect(f.disk.prepare('SELECT count(*) AS n FROM storage_documents').get()?.n).toBe(0);
  });
  it('checks SQLite native paths using valid file URIs, including WAL/SHM', () => {
    expect(databaseFileUri('/data/user/0/lab/files/SQLite', 'anchor-private-v1.db')).toBe('file:///data/user/0/lab/files/SQLite/anchor-private-v1.db');
    expect(databaseFileUri('file:///private/lab/SQLite/', 'anchor-private-v1.db-wal')).toBe('file:///private/lab/SQLite/anchor-private-v1.db-wal');
    expect(databaseFileUri('/data/lab', 'anchor-private-v1.db-shm')).toBe('file:///data/lab/anchor-private-v1.db-shm');
    expect(() => databaseFileUri('content://other', 'anchor-private-v1.db')).toThrow();
  });
  it('does not activate an unsupported legacy vault or malformed pending queue', async () => {
    const f = fixture({ state: { unexpectedPrivateValue: 'preserve this source' }, version: 0 });
    await expect(f.db.read('anchor-vault-storage')).rejects.toThrow('requires recovery');
    expect(f.disk.prepare('SELECT count(*) AS n FROM storage_documents').get()?.n).toBe(0);
    expect(() => f.db.write('anchor:practice-write-queue:A', [{ accountId: 'A' }])).toThrow('identity requires recovery');
  });
  it('updates one of 72 records and retains other owners after reopen', async () => {
    const records = Array.from({ length: 72 }, (_, i) => anchor(String(i)));
    const f = fixture(vault(records));
    await f.db.read('anchor-vault-storage');
    const before = f.operations();
    await f.db.write('anchor-vault-storage', vault(records.map((a, i) => i === 0 ? { ...a, intentionText: 'updated' } : a)));
    expect(f.operations() - before).toBe(4); // document CAS, one row, receipt, receipt pruning
    await f.db.close();
    expect((await f.db.ownerRecords('anchor-vault-storage', 'account:A')).length).toBe(72);
    expect(await f.db.ownerRecords('anchor-vault-storage', 'account:B')).toEqual([]);
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).toContain('updated');
  });
  it('preserves mutations arriving during import in FIFO order', async () => {
    const f = fixture(vault([anchor('1')]));
    const imported = f.db.read('anchor-vault-storage');
    const write = f.db.write('anchor-vault-storage', vault([anchor('1', 'A', 'later')]));
    await imported; await write;
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).toContain('later');
  });
  it('does not drop other imported records when an unhydrated writer appends', async () => {
    const f = fixture(vault([anchor('legacy')]));
    const read = f.db.read('anchor-vault-storage');
    const write = f.db.write('anchor-vault-storage', vault([anchor('new')]));
    await read; await write;
    expect(await f.db.ownerRecords('anchor-vault-storage', 'account:A')).toHaveLength(2);
  });
  it('commits concurrent queue additions and removes only an exact acknowledged event', async () => {
    const f = fixture();
    const append = (id: string) => f.db.mutate('anchor:practice-write-queue:A', (queue) => [...((queue ?? []) as any[]), { id, accountId: 'A' }]);
    await Promise.all([append('1'), append('2')]);
    const attempted = (await f.db.read('anchor:practice-write-queue:A')) as any[];
    await append('3');
    await f.db.mutate('anchor:practice-write-queue:A', (queue) => (queue as any[]).filter((event) => !attempted.some((a) => JSON.stringify(a) === JSON.stringify(event))));
    expect(await f.db.read('anchor:practice-write-queue:A')).toEqual([{ id: '3', accountId: 'A' }]);
  });
  it('rejects a root owner override in an account namespace', async () => {
    const f = fixture();
    expect(() => f.db.write('anchor:chart:reflection-drafts:A', { accountId: 'B', drafts: [{ draftKey: 'x', accountId: 'B' }] })).toThrow('Foreign');
  });
  it('rolls queue and progress back together when the second document fails', async () => {
    const f = fixture();
    const run = f.driver.runAsync;
    f.driver.runAsync = async (sql, ...params) => {
      if (params.includes('progress')) throw new Error('second document failed');
      return run(sql, ...params);
    };
    await expect(f.db.mutateMany([
      { namespace: 'anchor:practice-write-queue:A', change: () => [{ id: 'earned', accountId: 'A' }] },
      { namespace: 'progress', change: () => ({ threadStrength: 60 }) },
    ])).rejects.toThrow('second document failed');
    expect(await f.db.read('anchor:practice-write-queue:A')).toBeNull();
    expect(await f.db.read('progress')).toBeNull();
  });
  it('keeps separate guest and account identities during authorized transfer', async () => {
    const f = fixture(vault([anchor('1', 'guest')]));
    await f.db.read('anchor-vault-storage');
    await f.db.write('anchor-vault-storage', { state: { anchors: [anchor('1', 'guest'), anchor('1', 'A')], guestTransfers: { '1': 'A' } }, version: 0 });
    expect(await f.db.ownerRecords('anchor-vault-storage', 'guest')).toHaveLength(1);
    expect(await f.db.ownerRecords('anchor-vault-storage', 'account:A')).toHaveLength(1);
  });
  it.each(['source-read', 'inactive-created', 'record-imported', 'verified', 'activation-written'])('restarts safely after interruption at %s', async (stage) => {
    const source = vault([anchor('1')]);
    const f = fixture(source);
    f.deps.checkpoint = async (s) => { if (s === stage) throw new Error('synthetic kill'); };
    await expect(f.db.read('anchor-vault-storage')).rejects.toThrow('synthetic kill');
    expect(f.disk.prepare('SELECT count(*) AS n FROM storage_documents').get()?.n).toBe(0);
    await f.db.close(); f.deps.checkpoint = undefined;
    expect(await f.db.read('anchor-vault-storage')).toEqual(source);
    expect(f.deps.legacyRead).toHaveBeenCalledTimes(2);
  });
  it('does not regenerate a missing key or open an existing database', async () => {
    const f = fixture(); f.keyMissing();
    await expect(f.db.read('x')).rejects.toThrow('Missing database key');
    expect(f.deps.open).not.toHaveBeenCalled(); expect(f.deps.createKey).not.toHaveBeenCalled();
  });
  it('does not recreate a missing previously-created database', async () => {
    const f = fixture();
    f.deps.exists = async () => false; f.deps.wasCreated = async () => true;
    await expect(f.db.read('x')).rejects.toThrow('Previously created database is missing');
    expect(f.deps.open).not.toHaveBeenCalled(); expect(f.deps.createKey).not.toHaveBeenCalled();
  });
  it('retains the previous commit and rejects a failed save', async () => {
    const source = vault([anchor('1')]); const f = fixture(source);
    await f.db.read('anchor-vault-storage'); f.fail();
    await expect(f.db.write('anchor-vault-storage', vault([anchor('1', 'A', 'lost')]))).rejects.toThrow();
    expect(await f.db.read('anchor-vault-storage')).toEqual(source);
  });
  it('rejects a stale second writer without overwriting a newer commit', async () => {
    const f = fixture(vault([anchor('1')]));
    await f.db.read('anchor-vault-storage');
    const second = new EncryptedRecordDatabase(f.deps);
    await second.read('anchor-vault-storage');
    await f.db.write('anchor-vault-storage', vault([anchor('1', 'A', 'newest')]));
    await expect(second.write('anchor-vault-storage', vault([anchor('1', 'A', 'stale')]))).rejects.toThrow('Stale database revision');
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).toContain('newest');
  });
  it('rejects a later-arriving older record revision from the same writer', async () => {
    const f = fixture(vault([{ ...anchor('1'), serverRevision: 5 }]));
    await f.db.read('anchor-vault-storage');
    await expect(f.db.write('anchor-vault-storage', vault([{ ...anchor('1', 'A', 'older'), serverRevision: 4 }]))).rejects.toThrow('Stale record revision');
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).not.toContain('older');
  });
  it('quarantines ambiguous ownership and preserves recovery evidence', async () => {
    const f = fixture(vault([anchor('unknown', ''), { ...anchor('1'), localRecoveryCopy: anchor('original'), pendingFields: ['intentionText'] }]));
    await f.db.read('anchor-vault-storage');
    expect(await f.db.ownerRecords('anchor-vault-storage', 'account:B')).toEqual([]);
    expect(await f.db.ownerRecords('anchor-vault-storage', 'account:A')).toHaveLength(1);
    expect(f.disk.prepare("SELECT count(*) AS n FROM storage_records WHERE scope = 'recovery' AND payload LIKE '%unknown%'").get()?.n).toBe(1);
    expect(JSON.stringify(await f.db.read('anchor-vault-storage'))).toContain('original');
  });
  it('captures an account queue owner before yielding and rejects foreign records', async () => {
    const f = fixture();
    await f.db.write('anchor:practice-write-queue:A', [{ id: 's', accountId: 'A', syncState: 'pending' }]);
    expect(await f.db.ownerRecords('anchor:practice-write-queue:A', 'account:A')).toHaveLength(1);
    expect(() => f.db.write('anchor:practice-write-queue:A', [{ id: 's', accountId: 'B' }])).toThrow('Foreign');
  });
});
