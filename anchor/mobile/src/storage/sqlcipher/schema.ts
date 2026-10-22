export const SCHEMA_VERSION = 1;
// A record contains one Anchor, practice event, scene, draft, or scalar field.
// Large collections are never stored as one value.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS storage_documents (
 namespace TEXT PRIMARY KEY NOT NULL, shape TEXT NOT NULL, revision INTEGER NOT NULL,
 source_checksum TEXT, source_format TEXT, activated INTEGER NOT NULL CHECK(activated IN (0,1))
);
CREATE TABLE IF NOT EXISTS storage_records (
 namespace TEXT NOT NULL, scope TEXT NOT NULL, record_id TEXT NOT NULL,
 payload TEXT NOT NULL, revision INTEGER NOT NULL, checksum TEXT NOT NULL,
 PRIMARY KEY(namespace, record_id),
 FOREIGN KEY(namespace) REFERENCES storage_documents(namespace)
);
CREATE INDEX IF NOT EXISTS records_by_owner ON storage_records(scope, namespace);
CREATE TABLE IF NOT EXISTS storage_recovery (
 namespace TEXT NOT NULL, scope TEXT NOT NULL, record_id TEXT NOT NULL,
 revision INTEGER NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL,
 PRIMARY KEY(namespace, record_id, revision)
);
CREATE INDEX IF NOT EXISTS recovery_by_owner ON storage_recovery(scope, namespace);
CREATE TABLE IF NOT EXISTS storage_receipts (
 namespace TEXT NOT NULL, revision INTEGER NOT NULL, changed_records INTEGER NOT NULL,
 committed_at INTEGER NOT NULL, PRIMARY KEY(namespace, revision)
);
PRAGMA user_version = 1;
`;
