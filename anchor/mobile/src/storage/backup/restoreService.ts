import type { ExportedDocument, RestoreDocument } from '../sqlcipher/database';
import { BackupError, openArchive, parseRecoverySecret } from './archiveCrypto';
import { documentDigest, verifyPayload, type ArchiveDocument, type ArchivePayload } from './archivePayload';

/**
 * Staged restore. The restore never writes into an active namespace until the
 * whole archive has been authenticated, validated and read back from an
 * inactive generation. Activation is one transaction in the target.
 */
export interface RestoreTarget {
  stage(generationId: string, documents: RestoreDocument[]): Promise<void>;
  readStaged(generationId: string, name: string): Promise<ExportedDocument | null>;
  activate(generationId: string, names: string[]): Promise<void>;
  discard(generationId: string): Promise<void>;
  writePlain(entries: { key: string; value: string }[]): Promise<void>;
}

export interface RestoreOptions {
  archive: Uint8Array;
  recoverySecret: string;
  generationId: string;
  target: RestoreTarget;
  /** Must validate the current authenticated identity for every account scope. */
  authorizeOwnerScopes(scopes: readonly string[]): Promise<boolean> | boolean;
}

export interface RestoreResult {
  ok: true;
  status: 'complete' | 'preferences-pending';
  generationId: string;
  documents: number;
  records: number;
  recoveryRecords: number;
  plainKeys: number;
}

function toRestoreDocument(doc: ArchiveDocument): RestoreDocument {
  return {
    name: doc.name,
    shape: doc.shape ?? '',
    revision: doc.revision,
    records: doc.records.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, checksum: r.checksum, payload: r.payload })),
    recovery: doc.recovery.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, reason: r.reason, payload: r.payload })),
  };
}

export async function restoreEncryptedBackup(options: RestoreOptions): Promise<RestoreResult> {
  const { target, generationId } = options;
  // Authentication happens before any byte of the payload is trusted.
  const key = parseRecoverySecret(options.recoverySecret);
  const opened = openArchive(options.archive, key);
  key.fill(0);

  let payload: ArchivePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(opened.payload)) as ArchivePayload;
  } catch {
    throw new BackupError('FORMAT', 'Backup payload is malformed');
  }
  verifyPayload(payload);
  if (payload.documents.length === 0) throw new BackupError('FORMAT', 'Backup contains no documents; refusing to replace local data');

  const accountScopes = [...new Set(payload.documents.flatMap((document) => document.records.map((record) => record.scope).filter((scope) => scope.startsWith('account:'))))];
  if (!await options.authorizeOwnerScopes(accountScopes)) {
    throw new BackupError('AUTHENTICATION_REQUIRED', 'Sign in to the account that owns this backup before restoring it');
  }

  const privateDocs = payload.documents.filter((d) => d.store === 'private');
  const plainDocs = payload.documents.filter((d) => d.store === 'plain');

  try {
    await target.stage(generationId, privateDocs.map(toRestoreDocument));
    // Independent read-back: the staged rows must reproduce each archived digest exactly.
    for (const doc of privateDocs) {
      const back = await target.readStaged(generationId, doc.name);
      if (!back) throw new BackupError('AUTHENTICATION_FAILED', 'Staged generation is missing a namespace');
      const reread: Omit<ArchiveDocument, 'digest'> = {
        name: doc.name,
        store: 'private',
        family: doc.family,
        shape: back.shape,
        revision: back.revision,
        plain: null,
        records: back.records.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, checksum: r.checksum, payload: r.payload })),
        recovery: back.recovery.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, reason: r.reason, payload: r.payload })),
      };
      if (documentDigest(reread) !== doc.digest) throw new BackupError('AUTHENTICATION_FAILED', 'Staged generation does not match the archive');
    }
    await target.activate(generationId, privateDocs.map((d) => d.name));
  } catch (error) {
    await target.discard(generationId).catch(() => undefined);
    if (error instanceof BackupError) throw error;
    throw new BackupError('INTERRUPTED', 'Restore was interrupted before activation');
  }

  // SQLCipher activation is transactional; AsyncStorage is a separate store.
  // It writes absent keys only and is verified by the runtime adapter. A failure
  // here is reported as retryable partial completion, never as atomic success.
  let status: RestoreResult['status'] = 'complete';
  if (plainDocs.length > 0) {
    try { await target.writePlain(plainDocs.map((d) => ({ key: d.name, value: d.plain! }))); }
    catch { status = 'preferences-pending'; }
  }

  return {
    ok: true,
    status,
    generationId,
    documents: payload.documents.length,
    records: payload.manifest.recordCount,
    recoveryRecords: payload.manifest.recoveryCount,
    plainKeys: plainDocs.length,
  };
}

/** Startup cleanup for restores interrupted by process death before activation. */
export async function discardInterruptedRestores(target: RestoreTarget & { listStagedGenerations(): Promise<string[]> }): Promise<string[]> {
  const generations = await target.listStagedGenerations();
  for (const generation of generations) await target.discard(generation);
  return generations;
}
