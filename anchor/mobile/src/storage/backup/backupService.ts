import type { ExportedDocument } from '../sqlcipher/database';
import { BackupError, formatRecoverySecret, generateRecoveryKey, openArchive, parseRecoverySecret, sealArchive, type RandomBytes } from './archiveCrypto';
import { buildPayload, verifyPayload, type ArchiveDocument, type ArchivePayload } from './archivePayload';
import { buildCatalog, type BackupCatalog, type CatalogEntry } from './namespaceRegistry';

/** Roots imported before enumeration so legacy SecureStore sources are visible. */
export const BACKUP_ROOT_NAMESPACES = ['anchor-vault-storage', 'anchor-session-storage', 'anchor-visualization-scenes-v1'] as const;

export interface BackupSource {
  /** Reads a document without mutating its source store, or null if absent. */
  exportPrivate(name: string): Promise<ExportedDocument | null>;
  listPrivateNamespaces(): Promise<string[]>;
  listAccountIds(): Promise<string[]>;
  listPlainKeys(): Promise<string[]>;
  readPlain(key: string): Promise<string | null>;
  /** Known private assets that cannot be safely placed in this archive. */
  listAdditionalUnresolved?(): Promise<BackupCatalog['unresolved']>;
}

export interface CreateBackupOptions {
  source: BackupSource;
  randomBytes: RandomBytes;
  createdAt: Date;
  /** Owner acknowledgement that unresolved namespaces will be left out. */
  acknowledgeUnresolved?: boolean;
  /** Account ids the caller knows (for example the signed-in user) in addition to those discovered on disk. */
  knownAccountIds?: string[];
}

export interface BackupSummary {
  documentCount: number;
  recordCount: number;
  recoveryCount: number;
  digest: string;
}

export type CreateBackupResult =
  | { ok: false; code: 'UNRESOLVED_NAMESPACES'; coverage: BackupCatalog }
  | {
      ok: true;
      /** Encrypted bytes only. Write straight to the owner-chosen document; never to app-private storage. */
      archive: Uint8Array;
      /** Shown once for the owner to record. Not stored by the app. */
      recoverySecret: string;
      status: 'complete' | 'incomplete-acknowledged';
      summary: BackupSummary;
      coverage: BackupCatalog;
    };

function toDocument(entry: CatalogEntry, exported: ExportedDocument): Omit<ArchiveDocument, 'digest'> {
  return {
    name: entry.name,
    store: 'private',
    family: entry.family,
    shape: exported.shape,
    revision: exported.revision,
    plain: null,
    records: exported.records.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, checksum: r.checksum, payload: r.payload })),
    recovery: exported.recovery.map((r) => ({ id: r.id, scope: r.scope, revision: r.revision, reason: r.reason, payload: r.payload })),
  };
}

/**
 * Exports every registered durable namespace into one encrypted archive, then
 * proves the archive authenticates and decodes with the secret the owner will
 * record. Success is never reported for a backup that omitted unresolved data
 * unless the caller explicitly acknowledges it.
 */
export async function createEncryptedBackup(options: CreateBackupOptions): Promise<CreateBackupResult> {
  const { source } = options;
  // Never import legacy data as a side effect of backup. The source adapter
  // owns read-only access to whichever persistence tier is currently active.
  const catalog = buildCatalog({
    privateNamespaces: await source.listPrivateNamespaces(),
    plainKeys: await source.listPlainKeys(),
    accountIds: [...new Set([...await source.listAccountIds(), ...(options.knownAccountIds ?? [])])],
  });
  const additionalUnresolved = await source.listAdditionalUnresolved?.();
  if (additionalUnresolved) catalog.unresolved.push(...additionalUnresolved);
  if (catalog.unresolved.length > 0 && !options.acknowledgeUnresolved) {
    return { ok: false, code: 'UNRESOLVED_NAMESPACES', coverage: catalog };
  }

  const documents: Omit<ArchiveDocument, 'digest'>[] = [];
  for (const entry of catalog.included) {
    if (entry.store === 'private') {
      const exported = await source.exportPrivate(entry.name);
      if (exported) documents.push(toDocument(entry, exported));
    } else {
      const raw = await source.readPlain(entry.name);
      if (raw !== null) {
        documents.push({ name: entry.name, store: 'plain', family: entry.family, shape: null, revision: 0, plain: raw, records: [], recovery: [] });
      }
    }
  }

  const createdAt = options.createdAt.toISOString();
  const payload = buildPayload({ createdAt, documents, catalog });
  const recoveryKey = await generateRecoveryKey(options.randomBytes);
  const recoverySecret = formatRecoverySecret(recoveryKey);
  const archive = await sealArchive(new TextEncoder().encode(JSON.stringify(payload)), {
    recoveryKey,
    randomBytes: options.randomBytes,
    createdAt,
  });
  recoveryKey.fill(0);

  // Verify with the exact text the owner will record, not with the in-memory key.
  const opened = openArchive(archive, parseRecoverySecret(recoverySecret));
  const decoded = JSON.parse(new TextDecoder().decode(opened.payload)) as ArchivePayload;
  verifyPayload(decoded);
  if (decoded.manifest.digest !== payload.manifest.digest) {
    throw new BackupError('AUTHENTICATION_FAILED', 'Verified archive does not match the exported manifest');
  }

  return {
    ok: true,
    archive,
    recoverySecret,
    status: catalog.unresolved.length > 0 ? 'incomplete-acknowledged' : 'complete',
    summary: payload.manifest,
    coverage: catalog,
  };
}
