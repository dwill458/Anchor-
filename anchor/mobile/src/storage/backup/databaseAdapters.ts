import type { EncryptedRecordDatabase } from '../sqlcipher/database';
import type { BackupSource } from './backupService';
import type { RestoreTarget } from './restoreService';

/** Binds the backup service to a SQLCipher record database and plaintext preference readers. */
export function databaseBackupSource(db: EncryptedRecordDatabase, plain: {
  keys(): Promise<string[]>;
  read(key: string): Promise<string | null>;
}): BackupSource {
  return {
    exportPrivate: (name) => db.exportNamespace(name),
    listPrivateNamespaces: () => db.listNamespaces(),
    listAccountIds: () => db.listAccountIds(),
    listPlainKeys: () => plain.keys(),
    readPlain: (key) => plain.read(key),
  };
}

/** Binds the restore service to SQLCipher staging/activation and a plaintext writer. */
export function databaseRestoreTarget(db: EncryptedRecordDatabase, plain: {
  writeAll(entries: { key: string; value: string }[]): Promise<void>;
}): RestoreTarget & { listStagedGenerations(): Promise<string[]> } {
  return {
    stage: (generationId, documents) => db.stageRestore(generationId, documents),
    readStaged: (generationId, name) => db.readStaged(generationId, name),
    activate: (generationId, names) => db.activateRestore(generationId, names),
    discard: (generationId) => db.discardRestore(generationId),
    writePlain: (entries) => plain.writeAll(entries),
    listStagedGenerations: () => db.listStagedGenerations(),
  };
}
