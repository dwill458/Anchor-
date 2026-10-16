import { SCHEMA, SCHEMA_VERSION } from './schema';
import { decodeDocument, encodeDocument, mergeImportedDocument, type EncodedDocument, type StoredRecord } from './recordCodec';

export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: SqlConnection) => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
export interface DatabaseDependencies {
  exists(): Promise<boolean>;
  readKey(): Promise<string | null>;
  createKey(): Promise<string>;
  saveKey(key: string): Promise<void>;
  wasCreated?(): Promise<boolean>;
  markCreated?(): Promise<void>;
  open(): Promise<SqlConnection>;
  checksum(value: string): Promise<string>;
  legacyRead(namespace: string): Promise<{ value: unknown; raw: string; format: string } | null>;
  checkpoint?(stage: string): Promise<void>;
  measure?(event: 'queue' | 'key-read' | 'initialization', fields: Record<string, number>): void;
}
type DocumentRow = { shape: string; revision: number; activated: number };
type RecordRow = { record_id: string; scope: string; payload: string; checksum: string };
type CachedDocument = EncodedDocument & { revision: number };

// Only validated random hex enters the unbindable PRAGMA. User data is always bound.
export function keyPragma(key: string): string {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('Invalid database key requires recovery');
  return `PRAGMA key = "x'${key}'";`;
}

/** One private connection owner and FIFO fence for reads, imports and writes. */
export class EncryptedRecordDatabase {
  private connection?: SqlConnection;
  private key?: string;
  private opening?: Promise<SqlConnection>;
  private tail: Promise<unknown> = Promise.resolve();
  private documents = new Map<string, CachedDocument>();
  private queueDepth = 0;
  constructor(private readonly deps: DatabaseDependencies) {}

  private queued<T>(task: () => Promise<T>): Promise<T> {
    const queuedAt = performance.now();
    const depth = ++this.queueDepth;
    const result = this.tail.then(async () => {
      const startedAt = performance.now();
      try { return await task(); } finally {
        this.queueDepth--;
        this.measure('queue', { depth, waitMs: startedAt - queuedAt, workMs: performance.now() - startedAt });
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  private measure(event: 'queue' | 'key-read' | 'initialization', fields: Record<string, number>): void {
    // Optional numeric diagnostics must never turn a successful commit into failure.
    try { this.deps.measure?.(event, fields); } catch { /* diagnostic observer only */ }
  }
  private open(): Promise<SqlConnection> {
    if (this.opening) return this.opening;
    this.opening = (async () => {
      const startedAt = performance.now();
      const existing = await this.deps.exists();
      if (!existing && await this.deps.wasCreated?.()) throw new Error('Previously created database is missing: recovery required');
      const keyStartedAt = performance.now();
      let key = await this.deps.readKey();
      this.measure('key-read', { ms: performance.now() - keyStartedAt });
      if (!key && existing) throw new Error('Missing database key: encrypted bytes retained; recovery required');
      if (!key) {
        key = await this.deps.createKey();
        keyPragma(key);
        await this.deps.saveKey(key);
        if (await this.deps.readKey() !== key) throw new Error('Database key durability verification failed');
      }
      const pragma = keyPragma(key);
      const db = await this.deps.open();
      try {
        await db.execAsync(pragma);
        const cipher = await db.getFirstAsync<Record<string, unknown>>('PRAGMA cipher_version');
        if (!cipher || !Object.values(cipher).some((v) => typeof v === 'string' && v.length > 0)) throw new Error('SQLCipher native support is required');
        // Authentication/schema read must succeed before any CREATE or empty fallback.
        await db.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((version?.user_version ?? 0) > SCHEMA_VERSION) throw new Error('Database schema requires a newer compatible binary');
        await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
        this.key = key;
        await this.transaction(db, async (txn) => { await txn.execAsync(SCHEMA); });
        await this.deps.markCreated?.();
        this.connection = db;
        this.measure('initialization', { ms: performance.now() - startedAt });
        return db;
      } catch (error) {
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    })();
    // A failed open remains failed for this process. Never regenerate keys or retry as empty.
    return this.opening;
  }
  private async transaction(db: SqlConnection, task: (txn: SqlConnection) => Promise<void>): Promise<void> {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // Expo 16 opens a NEW connection for an exclusive transaction. Key that
      // connection before its first schema/data access (BEGIN itself is deferred).
      await txn.execAsync(keyPragma(this.key!));
      await txn.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
      await task(txn);
      // PRAGMA foreign_keys is connection-local and changing it after Expo's
      // BEGIN has no effect. Check explicitly on this transaction connection.
      if ((await txn.getAllAsync('PRAGMA foreign_key_check')).length) throw new Error('Database reference integrity failure');
    });
  }
  private async load(namespace: string): Promise<CachedDocument | null> {
    const cached = this.documents.get(namespace);
    if (cached) return cached;
    const db = await this.open();
    const document = await db.getFirstAsync<DocumentRow>('SELECT shape, revision, activated FROM storage_documents WHERE namespace = ?', namespace);
    if (!document) {
      const source = await this.deps.legacyRead(namespace);
      if (!source) return null;
      const encoded = encodeDocument(namespace, source.value);
      await this.deps.checkpoint?.('source-read');
      const sourceChecksum = await this.deps.checksum(source.raw);
      await this.transaction(db, async (txn) => {
        await txn.runAsync('INSERT INTO storage_documents(namespace, shape, revision, source_checksum, source_format, activated) VALUES (?, ?, 1, ?, ?, 0)', namespace, encoded.shape, sourceChecksum, source.format);
        await this.deps.checkpoint?.('inactive-created');
        for (const record of encoded.records.values()) {
          const checksum = await this.deps.checksum(record.payload);
          await txn.runAsync('INSERT INTO storage_records(namespace, scope, record_id, payload, revision, checksum) VALUES (?, ?, ?, ?, 1, ?)', namespace, record.scope, record.id, record.payload, checksum);
          await this.deps.checkpoint?.('record-imported');
        }
        await this.verify(txn, namespace, encoded);
        await this.deps.checkpoint?.('verified');
        await txn.runAsync('UPDATE storage_documents SET activated = 1 WHERE namespace = ? AND activated = 0', namespace);
        await this.deps.checkpoint?.('activation-written');
      });
      await this.deps.checkpoint?.('activation-committed');
      const committed = { ...encoded, revision: 1 };
      this.documents.set(namespace, committed);
      return committed;
    }
    if (!document.activated) throw new Error('Inactive import requires recovery');
    const rows = await db.getAllAsync<RecordRow>('SELECT record_id, scope, payload, checksum FROM storage_records WHERE namespace = ?', namespace);
    const records = new Map<string, StoredRecord>();
    for (const row of rows) {
      if (await this.deps.checksum(row.payload) !== row.checksum) throw new Error('Database record checksum requires recovery');
      records.set(row.record_id, { id: row.record_id, scope: row.scope, payload: row.payload });
    }
    const result = { shape: document.shape, records, revision: document.revision };
    decodeDocument(result.shape, result.records);
    this.documents.set(namespace, result);
    return result;
  }
  private async verify(txn: SqlConnection, namespace: string, source: EncodedDocument): Promise<void> {
    const rows = await txn.getAllAsync<RecordRow>('SELECT record_id, scope, payload, checksum FROM storage_records WHERE namespace = ?', namespace);
    if (rows.length !== source.records.size) throw new Error('Import record count mismatch');
    for (const row of rows) {
      const expected = source.records.get(row.record_id);
      if (!expected || expected.scope !== row.scope || expected.payload !== row.payload || row.checksum !== await this.deps.checksum(row.payload)) throw new Error('Import ownership/content verification failed');
    }
  }
  read(namespace: string): Promise<unknown | null> {
    return this.queued(async () => {
      const document = await this.load(namespace);
      return document ? decodeDocument(document.shape, document.records) : null;
    });
  }
  write(namespace: string, value: unknown): Promise<void> {
    // Capture the payload and its proven owner before yielding to a login or import.
    const next = encodeDocument(namespace, value);
    const capturedAfterHydration = this.documents.has(namespace);
    return this.queued(() => this.commit(namespace, next, !capturedAfterHydration));
  }
  /** Read/modify/commit under the same fence. Network acknowledgements remove
   * only the exact acknowledged event, never replace a stale queue snapshot. */
  mutate(namespace: string, change: (current: unknown | null) => unknown): Promise<void> {
    return this.queued(async () => {
      const current = await this.load(namespace);
      const value = current ? decodeDocument(current.shape, current.records) : null;
      await this.commit(namespace, encodeDocument(namespace, change(value)));
    });
  }
  private async commit(namespace: string, next: EncodedDocument, preserveImported = false): Promise<void> {
    const previous = await this.load(namespace);
    if (previous && preserveImported) next = mergeImportedDocument(previous, next);
    if (previous && previous.shape === next.shape && previous.records.size === next.records.size && [...next.records].every(([id, row]) => previous.records.get(id)?.payload === row.payload && previous.records.get(id)?.scope === row.scope)) return;
    let committed: CachedDocument | undefined;
    await this.transaction(await this.open(), async (txn) => { committed = await this.apply(txn, namespace, next, previous); });
    if (committed) this.documents.set(namespace, committed);
  }
  /** Multi-document changes share one COMMIT, including queue and local history. */
  mutateMany(changes: { namespace: string; change: (current: unknown | null) => unknown }[]): Promise<void> {
    return this.queued(async () => {
      if (new Set(changes.map((c) => c.namespace)).size !== changes.length) throw new Error('Duplicate batch namespace');
      const plans: { namespace: string; previous: CachedDocument | null; next: EncodedDocument }[] = [];
      for (const change of changes) {
        const previous = await this.load(change.namespace);
        const value = previous ? decodeDocument(previous.shape, previous.records) : null;
        plans.push({ namespace: change.namespace, previous, next: encodeDocument(change.namespace, change.change(value)) });
      }
      const committed = new Map<string, CachedDocument>();
      await this.transaction(await this.open(), async (txn) => {
        for (const plan of plans) {
          const saved = await this.apply(txn, plan.namespace, plan.next, plan.previous);
          if (saved) committed.set(plan.namespace, saved);
        }
      });
      for (const [name, saved] of committed) this.documents.set(name, saved);
    });
  }
  private async apply(txn: SqlConnection, namespace: string, next: EncodedDocument, previous: CachedDocument | null): Promise<CachedDocument | undefined> {
      const changed = [...next.records.values()].filter((r) => previous?.records.get(r.id)?.payload !== r.payload || previous?.records.get(r.id)?.scope !== r.scope);
      const removed = [...(previous?.records.values() ?? [])].filter((r) => !next.records.has(r.id));
      if (previous && !changed.length && !removed.length && previous.shape === next.shape) return;
      const revision = (previous?.revision ?? 0) + 1;

        if (previous) {
          const result = await txn.runAsync('UPDATE storage_documents SET shape = ?, revision = ? WHERE namespace = ? AND revision = ? AND activated = 1', next.shape, revision, namespace, previous.revision);
          if (result.changes !== 1) throw new Error('Stale database revision requires reload');
        } else {
          await txn.runAsync('INSERT INTO storage_documents(namespace, shape, revision, activated) VALUES (?, ?, ?, 1)', namespace, next.shape, revision);
        }
        for (const record of changed) {
          const old = previous?.records.get(record.id);
          if (old && old.payload !== record.payload) {
            const prior = JSON.parse(old.payload); const incoming = JSON.parse(record.payload);
            if (prior && incoming && typeof prior === 'object' && typeof incoming === 'object') {
              for (const field of ['serverRevision', 'revision']) {
                if (typeof prior[field] === 'number' && typeof incoming[field] === 'number' && incoming[field] < prior[field]) throw new Error('Stale record revision requires reconciliation');
              }
            }
          }
          // Ownership changes cannot relabel an existing row. Store guest and
          // account identities separately; explicit transfer remains in its ledger.
          if (old && old.scope !== record.scope) {
            await txn.runAsync('INSERT OR IGNORE INTO storage_recovery(namespace, scope, record_id, revision, payload, reason) VALUES (?, ?, ?, ?, ?, ?)', namespace, old.scope, old.id, previous!.revision, old.payload, 'ownership-transition');
          }
          await txn.runAsync('INSERT INTO storage_records(namespace, scope, record_id, payload, revision, checksum) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(namespace, record_id) DO UPDATE SET scope = excluded.scope, payload = excluded.payload, revision = excluded.revision, checksum = excluded.checksum', namespace, record.scope, record.id, record.payload, revision, await this.deps.checksum(record.payload));
        }
        for (const record of removed) {
          // Retain removed records in encrypted recovery; account switching is
          // never permission to destroy an inactive owner's committed content.
          await txn.runAsync('INSERT OR IGNORE INTO storage_recovery(namespace, scope, record_id, revision, payload, reason) VALUES (?, ?, ?, ?, ?, ?)', namespace, record.scope, record.id, previous!.revision, record.payload, 'document-removal');
          await txn.runAsync('DELETE FROM storage_records WHERE namespace = ? AND record_id = ? AND scope = ?', namespace, record.id, record.scope);
        }
        await txn.runAsync('INSERT INTO storage_receipts(namespace, revision, changed_records, committed_at) VALUES (?, ?, ?, ?)', namespace, revision, changed.length + removed.length, Date.now());
        await txn.runAsync('DELETE FROM storage_receipts WHERE namespace = ? AND revision < ?', namespace, revision - 256);
      // Publish memory/receipt only after COMMIT. Failed transactions leave prior data.
      return { ...next, revision };
  }
  /** Owner-constrained diagnostic/recovery reads; never expose quarantined rows to a login. */
  ownerRecords(namespace: string, scope: string): Promise<StoredRecord[]> {
    if (!/^(guest|account:.+)$/.test(scope)) return Promise.reject(new Error('Authorized owner scope required'));
    return this.queued(async () => {
      await this.load(namespace);
      const rows = await (await this.open()).getAllAsync<RecordRow>('SELECT record_id, scope, payload, checksum FROM storage_records WHERE namespace = ? AND scope = ?', namespace, scope);
      return rows.map((r) => ({ id: r.record_id, scope: r.scope, payload: r.payload }));
    });
  }
  /** Active document namespaces (legacy-imported or written). Staged restores are excluded. */
  listNamespaces(): Promise<string[]> {
    return this.queued(async () => {
      const rows = await (await this.open()).getAllAsync<{ namespace: string }>('SELECT namespace FROM storage_documents WHERE activated = 1 AND namespace NOT LIKE ? ORDER BY namespace', `${STAGE_PREFIX}%`);
      return rows.map((r) => r.namespace);
    });
  }
  /** Account identifiers that own durable records or recovery rows on this device. */
  listAccountIds(): Promise<string[]> {
    return this.queued(async () => {
      const rows = await (await this.open()).getAllAsync<{ scope: string }>(
        "SELECT DISTINCT scope FROM storage_records WHERE scope LIKE 'account:%' UNION SELECT DISTINCT scope FROM storage_recovery WHERE scope LIKE 'account:%'",
      );
      return rows.map((r) => r.scope.slice('account:'.length)).sort();
    });
  }
  /**
   * Exports one active namespace with every committed record and its recovery rows.
   * Legacy SecureStore source is imported first, exactly as a normal read would.
   * Each stored checksum is recomputed before the record is returned.
   */
  exportNamespace(namespace: string): Promise<ExportedDocument | null> {
    return this.queued(async () => {
      if (namespace.startsWith(STAGE_PREFIX)) throw new Error('Staged restore namespaces are not exportable');
      const document = await this.load(namespace);
      if (!document) return null;
      const db = await this.open();
      const header = await db.getFirstAsync<{ shape: string; revision: number; activated: number }>('SELECT shape, revision, activated FROM storage_documents WHERE namespace = ?', namespace);
      if (!header || !header.activated) throw new Error('Inactive namespace cannot be exported');
      const rows = await db.getAllAsync<ExportRecordRow>('SELECT record_id, scope, payload, revision, checksum FROM storage_records WHERE namespace = ? ORDER BY record_id', namespace);
      const records: ExportedRecord[] = [];
      for (const row of rows) {
        const checksum = await this.deps.checksum(row.payload);
        if (checksum !== row.checksum) throw new Error('Database record checksum requires recovery');
        records.push({ id: row.record_id, scope: row.scope, revision: row.revision, checksum, payload: row.payload });
      }
      const recoveryRows = await db.getAllAsync<ExportRecoveryRow>('SELECT record_id, scope, revision, payload, reason FROM storage_recovery WHERE namespace = ? ORDER BY record_id, revision', namespace);
      const recovery: ExportedRecovery[] = [];
      for (const row of recoveryRows) {
        recovery.push({ id: row.record_id, scope: row.scope, revision: row.revision, reason: row.reason, checksum: await this.deps.checksum(row.payload), payload: row.payload });
      }
      return { name: namespace, shape: header.shape, revision: header.revision, records, recovery };
    });
  }
  /**
   * Writes a restored document set into an inactive, prefixed generation. The
   * whole stage is one transaction; a failure leaves no staged rows and never
   * touches an active namespace.
   */
  stageRestore(generationId: string, documents: readonly RestoreDocument[]): Promise<void> {
    return this.queued(async () => {
      const prefix = stagePrefixFor(generationId);
      const db = await this.open();
      await this.transaction(db, async (txn) => {
        for (const document of documents) {
          const staged = `${prefix}${document.name}`;
          if (await txn.getFirstAsync('SELECT 1 AS present FROM storage_documents WHERE namespace = ?', staged)) throw new Error('Restore generation already contains this namespace');
          await txn.runAsync('INSERT INTO storage_documents(namespace, shape, revision, source_checksum, source_format, activated) VALUES (?, ?, ?, NULL, ?, 0)', staged, document.shape, document.revision, 'restore-archive');
          for (const record of document.records) {
            if (await this.deps.checksum(record.payload) !== record.checksum) throw new Error('Restore record checksum failed');
            await txn.runAsync('INSERT INTO storage_records(namespace, scope, record_id, payload, revision, checksum) VALUES (?, ?, ?, ?, ?, ?)', staged, record.scope, record.id, record.payload, record.revision, record.checksum);
          }
          for (const row of document.recovery) {
            await txn.runAsync('INSERT INTO storage_recovery(namespace, scope, record_id, revision, payload, reason) VALUES (?, ?, ?, ?, ?, ?)', staged, row.scope, row.id, row.revision, row.payload, row.reason);
          }
        }
      });
    });
  }
  /** Reads a staged generation back from SQLCipher for independent verification. */
  readStaged(generationId: string, name: string): Promise<ExportedDocument | null> {
    return this.queued(async () => {
      const staged = `${stagePrefixFor(generationId)}${name}`;
      const db = await this.open();
      const header = await db.getFirstAsync<{ shape: string; revision: number }>('SELECT shape, revision FROM storage_documents WHERE namespace = ? AND activated = 0', staged);
      if (!header) return null;
      const rows = await db.getAllAsync<ExportRecordRow>('SELECT record_id, scope, payload, revision, checksum FROM storage_records WHERE namespace = ? ORDER BY record_id', staged);
      const recoveryRows = await db.getAllAsync<ExportRecoveryRow>('SELECT record_id, scope, revision, payload, reason FROM storage_recovery WHERE namespace = ? ORDER BY record_id, revision', staged);
      return {
        name,
        shape: header.shape,
        revision: header.revision,
        records: rows.map((r) => ({ id: r.record_id, scope: r.scope, revision: r.revision, checksum: r.checksum, payload: r.payload })),
        recovery: recoveryRows.map((r) => ({ id: r.record_id, scope: r.scope, revision: r.revision, reason: r.reason, checksum: '', payload: r.payload })),
      };
    });
  }
  /**
   * Atomically replaces the named active namespaces with a verified staged
   * generation. Superseded live rows are copied into recovery first, so no
   * committed record disappears. Any failure rolls the whole swap back.
   */
  activateRestore(generationId: string, names: readonly string[]): Promise<void> {
    return this.queued(async () => {
      const prefix = stagePrefixFor(generationId);
      const db = await this.open();
      await this.transaction(db, async (txn) => {
        for (const name of names) {
          const staged = `${prefix}${name}`;
          const stagedHeader = await txn.getFirstAsync<{ present: number }>('SELECT 1 AS present FROM storage_documents WHERE namespace = ? AND activated = 0', staged);
          if (!stagedHeader) throw new Error('Restore activation requires a staged namespace');
          const live = await txn.getFirstAsync<{ revision: number }>('SELECT revision FROM storage_documents WHERE namespace = ? AND activated = 1', name);
          if (live) {
            await txn.runAsync('INSERT OR IGNORE INTO storage_recovery(namespace, scope, record_id, revision, payload, reason) SELECT namespace, scope, record_id, revision, payload, ? FROM storage_records WHERE namespace = ?', 'restore-superseded', name);
            await txn.runAsync('DELETE FROM storage_records WHERE namespace = ?', name);
            await txn.runAsync('DELETE FROM storage_documents WHERE namespace = ?', name);
          }
          await txn.runAsync('INSERT INTO storage_documents(namespace, shape, revision, source_checksum, source_format, activated) SELECT ?, shape, revision, NULL, ?, 1 FROM storage_documents WHERE namespace = ?', name, 'restore-archive', staged);
          await txn.runAsync('INSERT INTO storage_records(namespace, scope, record_id, payload, revision, checksum) SELECT ?, scope, record_id, payload, revision, checksum FROM storage_records WHERE namespace = ?', name, staged);
          await txn.runAsync('INSERT OR IGNORE INTO storage_recovery(namespace, scope, record_id, revision, payload, reason) SELECT ?, scope, record_id, revision, payload, reason FROM storage_recovery WHERE namespace = ?', name, staged);
          await txn.runAsync('DELETE FROM storage_recovery WHERE namespace = ?', staged);
          await txn.runAsync('DELETE FROM storage_records WHERE namespace = ?', staged);
          await txn.runAsync('DELETE FROM storage_documents WHERE namespace = ?', staged);
        }
      });
      for (const name of names) this.documents.delete(name);
    });
  }
  /** Removes an unactivated generation. Active namespaces are never touched. */
  discardRestore(generationId: string): Promise<void> {
    return this.queued(async () => {
      const prefix = stagePrefixFor(generationId);
      const db = await this.open();
      await this.transaction(db, async (txn) => {
        await txn.runAsync('DELETE FROM storage_recovery WHERE namespace LIKE ?', `${prefix}%`);
        await txn.runAsync('DELETE FROM storage_records WHERE namespace LIKE ?', `${prefix}%`);
        await txn.runAsync('DELETE FROM storage_documents WHERE namespace LIKE ? AND activated = 0', `${prefix}%`);
      });
    });
  }
  /** Generations left by an interrupted restore; each can be discarded safely. */
  listStagedGenerations(): Promise<string[]> {
    return this.queued(async () => {
      const rows = await (await this.open()).getAllAsync<{ namespace: string }>('SELECT DISTINCT namespace FROM storage_documents WHERE namespace LIKE ?', `${STAGE_PREFIX}%`);
      return [...new Set(rows.map((r) => r.namespace.slice(STAGE_PREFIX.length).split(':')[0]))].sort();
    });
  }
  close(): Promise<void> {
    return this.queued(async () => { await this.connection?.closeAsync(); this.connection = undefined; this.documents.clear(); this.opening = undefined; });
  }
}

const STAGE_PREFIX = 'restore-gen:';
export function stagePrefixFor(generationId: string): string {
  if (!/^[A-Za-z0-9-]{8,64}$/.test(generationId)) throw new Error('Invalid restore generation id');
  return `${STAGE_PREFIX}${generationId}:`;
}

export interface ExportedRecord { id: string; scope: string; revision: number; checksum: string; payload: string }
export interface ExportedRecovery { id: string; scope: string; revision: number; reason: string; checksum: string; payload: string }
export interface ExportedDocument { name: string; shape: string; revision: number; records: ExportedRecord[]; recovery: ExportedRecovery[] }
export interface RestoreDocument { name: string; shape: string; revision: number; records: (ExportedRecord & { revision: number })[]; recovery: { id: string; scope: string; revision: number; reason: string; payload: string }[] }
type ExportRecordRow = { record_id: string; scope: string; payload: string; revision: number; checksum: string };
type ExportRecoveryRow = { record_id: string; scope: string; revision: number; payload: string; reason: string };
