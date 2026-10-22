import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { EncryptedRecordDatabase, type DatabaseDependencies, type SqlConnection } from '../database';

export function fixture(source: unknown = null) {
  const disk = new DatabaseSync(':memory:');
  let fail = false;
  let operations = 0;
  const driver: SqlConnection = {
    execAsync: async (sql) => { if (!sql.startsWith('PRAGMA key')) disk.exec(sql); },
    runAsync: async (sql, ...params) => { operations++; if (fail) throw new Error('synthetic IO failure'); return { changes: Number(disk.prepare(sql).run(...params).changes) }; },
    getFirstAsync: async <T>(sql: string, ...params: (string | number | null)[]) => (sql === 'PRAGMA cipher_version' ? { cipher_version: 'test-driver-not-encryption-proof' } : disk.prepare(sql).get(...params) ?? null) as T | null,
    getAllAsync: async <T>(sql: string, ...params: (string | number | null)[]) => disk.prepare(sql).all(...params) as T[],
    withExclusiveTransactionAsync: async (task) => { disk.exec('BEGIN'); try { await task(driver); disk.exec('COMMIT'); } catch (e) { disk.exec('ROLLBACK'); throw e; } },
    closeAsync: async () => undefined,
  };
  let key: string | null = 'ab'.repeat(32);
  const deps: DatabaseDependencies = {
    exists: async () => true, readKey: async () => key,
    createKey: jest.fn(async () => 'cd'.repeat(32)), saveKey: jest.fn(async (k) => { key = k; }),
    open: jest.fn(async () => driver), checksum: async (s) => createHash('sha256').update(s).digest('hex'),
    legacyRead: jest.fn(async () => source === null ? null : { value: source, raw: JSON.stringify(source), format: 'synthetic-generation' }),
  };
  return { db: new EncryptedRecordDatabase(deps), deps, disk, driver, fail: () => { fail = true; }, keyMissing: () => { key = null; }, operations: () => operations };
}
