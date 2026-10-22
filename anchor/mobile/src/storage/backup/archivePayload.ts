import { BACKUP_SCHEMA_VERSION, BackupError, sha256Hex } from './archiveCrypto';
import { NAMESPACE_REGISTRY_VERSION, classify, type BackupCatalog, type StoreKind } from './namespaceRegistry';

/**
 * Logical payload carried inside the encrypted container. Everything here is
 * plaintext only in memory; it is never written to disk or logged.
 */

export interface ArchiveRecord { id: string; scope: string; revision: number; checksum: string; payload: string }
export interface ArchiveRecovery { id: string; scope: string; revision: number; reason: string; payload: string }

export interface ArchiveDocument {
  name: string;
  store: StoreKind;
  family: string;
  shape: string | null;
  revision: number;
  /** Raw plaintext-preference value for AsyncStorage documents; null for private documents. */
  plain: string | null;
  records: ArchiveRecord[];
  recovery: ArchiveRecovery[];
  digest: string;
}

export interface ArchivePayload {
  schemaVersion: number;
  registryVersion: number;
  createdAt: string;
  documents: ArchiveDocument[];
  manifest: { documentCount: number; recordCount: number; recoveryCount: number; digest: string };
  coverage: {
    included: { name: string; store: StoreKind; family: string }[];
    excluded: { name: string; store: StoreKind; reason: string }[];
    unresolved: { name: string; store: StoreKind; reason: string }[];
  };
}

/** Canonical digest over the document's authenticated fields, in fixed order. */
export function documentDigest(doc: Omit<ArchiveDocument, 'digest'>): string {
  return sha256Hex(JSON.stringify([
    doc.name,
    doc.store,
    doc.family,
    doc.shape,
    doc.revision,
    doc.plain,
    doc.records.map((r) => [r.id, r.scope, r.revision, r.checksum, r.payload]),
    doc.recovery.map((r) => [r.id, r.scope, r.revision, r.reason, r.payload]),
  ]));
}

export function manifestDigest(documents: readonly Pick<ArchiveDocument, 'name' | 'digest'>[]): string {
  return sha256Hex(JSON.stringify(documents.map((d) => [d.name, d.digest])));
}

export function sealDocument(doc: Omit<ArchiveDocument, 'digest'>): ArchiveDocument {
  return { ...doc, digest: documentDigest(doc) };
}

export function buildPayload(input: {
  createdAt: string;
  documents: Omit<ArchiveDocument, 'digest'>[];
  catalog: BackupCatalog;
}): ArchivePayload {
  const documents = input.documents.map(sealDocument);
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    registryVersion: NAMESPACE_REGISTRY_VERSION,
    createdAt: input.createdAt,
    documents,
    manifest: {
      documentCount: documents.length,
      recordCount: documents.reduce((sum, d) => sum + d.records.length, 0),
      recoveryCount: documents.reduce((sum, d) => sum + d.recovery.length, 0),
      digest: manifestDigest(documents),
    },
    coverage: {
      included: input.catalog.included.map((e) => ({ name: e.name, store: e.store, family: e.family })),
      excluded: input.catalog.excluded.map((e) => ({ name: e.name, store: e.store, reason: e.reason })),
      unresolved: input.catalog.unresolved,
    },
  };
}

/** Recomputes every digest and count. Throws on any difference. */
export function verifyPayload(payload: ArchivePayload): void {
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new BackupError('UNSUPPORTED_VERSION', 'Unsupported backup schema');
  if (!Array.isArray(payload.documents)) throw new BackupError('FORMAT', 'Backup payload is malformed');
  const seen = new Set<string>();
  for (const doc of payload.documents) {
    if (seen.has(doc.name)) throw new BackupError('FORMAT', 'Duplicate namespace in backup');
    seen.add(doc.name);
    const disposition = classify(doc.name);
    if (!disposition || disposition.action !== 'include') throw new BackupError('FORMAT', 'Backup contains an unregistered namespace');
    if (documentDigest(doc) !== doc.digest) throw new BackupError('AUTHENTICATION_FAILED', 'Document digest mismatch');
    const owners = new Set<string>();
    for (const record of doc.records) {
      if (doc.store === 'private' && !/^(guest|recovery|account:.+)$/.test(record.scope)) throw new BackupError('FORMAT', 'Record has no valid owner scope');
      owners.add(record.id);
    }
    if (owners.size !== doc.records.length) throw new BackupError('FORMAT', 'Duplicate record identity in backup');
  }
  const recordCount = payload.documents.reduce((sum, d) => sum + d.records.length, 0);
  const recoveryCount = payload.documents.reduce((sum, d) => sum + d.recovery.length, 0);
  if (
    payload.manifest.documentCount !== payload.documents.length ||
    payload.manifest.recordCount !== recordCount ||
    payload.manifest.recoveryCount !== recoveryCount ||
    payload.manifest.digest !== manifestDigest(payload.documents)
  ) throw new BackupError('AUTHENTICATION_FAILED', 'Backup manifest does not match its contents');
}
