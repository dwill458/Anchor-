import { anchorOwnerScope, RECOVERY_SCOPE, GUEST_SCOPE } from '@/stores/anchorOwnership';
import type { Anchor } from '@/types';

export type StoredRecord = { id: string; scope: string; payload: string };
type Shape = { kind: 'record'; id: string } | { kind: 'object'; entries: [string, Shape][] } | { kind: 'array'; entries: Shape[] };
export type EncodedDocument = { shape: string; records: Map<string, StoredRecord> };
const collections = new Set(['anchors', 'practiceHistory', 'sessionLog', 'primingHistory', 'unknownPracticeHistory', 'drafts']);
const maps = new Set(['scenes', 'suggestions', 'selectedSuggestionIndex', 'batchSource', 'upgradeAttempts', 'scopeMetadata', 'guestTransfers']);
const capturedObjects = new WeakMap<object, { payload: string; snapshot: unknown }>();
// Compare fields against an immutable captured value, rather than trusting object
// identity alone. This also detects a caller mutating an object in place. Large
// SVG strings are compared, never reserialized for unchanged Anchors.
function sameJson(input: any, captured: any): boolean {
  if (input instanceof Date) return input.toJSON() === captured;
  if (input === captured) return true;
  if (!input || !captured || typeof input !== 'object' || typeof captured !== 'object') return false;
  if (Array.isArray(input) !== Array.isArray(captured)) return false;
  const keys = Object.keys(input).filter((k) => input[k] !== undefined && typeof input[k] !== 'function');
  return keys.length === Object.keys(captured).length && keys.every((key) => Object.prototype.hasOwnProperty.call(captured, key) && sameJson(input[key], captured[key]));
}
function capturedJson(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  const previous = capturedObjects.get(value);
  if (previous && sameJson(value, previous.snapshot)) return previous.payload;
  const payload = JSON.stringify(value);
  if (payload !== undefined) capturedObjects.set(value, { payload, snapshot: JSON.parse(payload) });
  return payload;
}
const provenAccount = (id: unknown): string => typeof id === 'string' && id && id !== 'legacy' && id !== 'test-user-123'
  ? (['guest', 'guest-user', 'user-local', 'local-user'].includes(id) ? GUEST_SCOPE : `account:${id}`) : RECOVERY_SCOPE;

export function namespaceOwner(namespace: string): string {
  const scoped = namespace.split('::owner::');
  if (scoped.length === 2 && /^(guest|recovery|account:.+)$/.test(scoped[1])) return scoped[1];
  const prefixes = ['anchor:practice-history:', 'anchor:practice-write-queue:', 'anchor:practice-next-action-queue:', 'anchor:anchor-snapshot:', 'anchor:session-snapshot:', 'anchor:profile-snapshot:', 'anchor:chart:reflection-drafts:'];
  const prefix = prefixes.find((p) => namespace.startsWith(p));
  return prefix ? provenAccount(namespace.slice(prefix.length)) : RECOVERY_SCOPE;
}

/** Stable record IDs, separate owner indexes, and small reconstruction metadata. */
export function encodeDocument(namespace: string, value: unknown): EncodedDocument {
  if (namespace === 'anchor-vault-storage') {
    const saved = value as { state?: { anchors?: unknown } } | null;
    if (!saved?.state || !Array.isArray(saved.state.anchors)) throw new Error('Unsupported Anchor vault format requires recovery');
  }
  if (namespace.startsWith('anchor:anchor-snapshot:') && !Array.isArray((value as { anchors?: unknown } | null)?.anchors)) throw new Error('Unsupported Anchor snapshot requires recovery');
  if (/^anchor:practice-(?:write-queue|next-action-queue|history):/.test(namespace) && value !== null) {
    if (!Array.isArray(value) || value.some((entry) => !entry || typeof (entry.id ?? entry.sessionId) !== 'string')) throw new Error('Invalid practice queue identity requires recovery');
  }
  const fixedOwner = namespaceOwner(namespace);
  const records = new Map<string, StoredRecord>();
  const add = (id: string, value: unknown, scope: string): Shape => {
    if (records.has(id)) throw new Error('Duplicate durable record identity requires recovery');
    if (value && typeof value === 'object') {
      const row = value as { accountId?: string; ownerAccountId?: string; userId?: string; anchor?: Anchor };
      for (const declared of [row.accountId, row.ownerAccountId]) {
        if (declared !== undefined && scope !== RECOVERY_SCOPE && provenAccount(declared) !== scope) throw new Error('Foreign record in owner namespace');
      }
      if (row.anchor && row.userId !== row.anchor.userId) throw new Error('Retry mutation owner mismatch');
    }
    const payload = capturedJson(value);
    if (payload === undefined) throw new Error('Invalid durable value');
    records.set(id, { id, scope, payload });
    return { kind: 'record', id };
  };
  const walk = (node: any, path: string[], scope: string): Shape => {
    const field = path[path.length - 1];
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const owner of [node.accountId, node.ownerAccountId]) {
        if (owner !== undefined) {
          const declared = provenAccount(owner);
          if (fixedOwner !== RECOVERY_SCOPE && declared !== fixedOwner) throw new Error('Foreign record in owner namespace');
          scope = declared;
        }
      }
      return { kind: 'object', entries: Object.keys(node).filter((k) => node[k] !== undefined && typeof node[k] !== 'function').map((k) => {
        const child = [...path, k];
        if (maps.has(field)) {
          const owner = field === 'scopeMetadata' && /^(guest|recovery|account:.+)$/.test(k) ? k : scope;
          return [k, add(JSON.stringify(child), node[k], owner)];
        }
        return [k, walk(node[k], child, scope)];
      }) };
    }
    if (Array.isArray(node)) {
      if (collections.has(field) || path.length === 0) {
        return { kind: 'array', entries: node.map((entry, index) => {
          const key = (field === 'anchors' && entry?.localId ? `${entry.id}:${entry.localId}` : entry?.id) ?? entry?.sessionId ?? entry?.draftKey ?? entry?.fingerprint ?? (entry?.anchor ? `${entry.userId}:${entry.anchor.localId ?? entry.anchor.id}` : undefined);
          // Historical primitive arrays still retain each element; identities use positions.
          if (field === 'anchors' && (!entry || typeof entry.id !== 'string')) throw new Error('Invalid Anchor requires recovery');
          const owner = field === 'anchors' ? (typeof entry.userId === 'string' ? anchorOwnerScope(entry as Anchor) : RECOVERY_SCOPE)
            : entry?.accountId !== undefined ? provenAccount(entry.accountId) : entry?.anchor && entry?.userId ? provenAccount(entry.userId) : scope;
          if (fixedOwner !== RECOVERY_SCOPE && owner !== fixedOwner) throw new Error('Foreign record in owner namespace');
          return add(JSON.stringify([...path, owner, String(key ?? index)]), entry, owner);
        }) };
      }
      return add(JSON.stringify(path), node, scope);
    }
    return add(JSON.stringify(path), node, scope);
  };
  const defaultScope = ['anchor:v2:first-run', 'anchor-first-anchor-flow-v1'].includes(namespace) ? GUEST_SCOPE : namespaceOwner(namespace);
  return { shape: JSON.stringify(walk(value, [], defaultScope)), records };
}

export function decodeDocument(shape: string, records: Map<string, StoredRecord>): unknown {
  const walk = (node: Shape): unknown => {
    if (node.kind === 'record') {
      const record = records.get(node.id);
      if (!record) throw new Error('Incomplete database document requires recovery');
      return JSON.parse(record.payload);
    }
    if (node.kind === 'array') return node.entries.map(walk);
    if (node.kind === 'object') return Object.fromEntries(node.entries.map(([key, value]) => [key, walk(value)]));
    throw new Error('Invalid database document requires recovery');
  };
  return walk(JSON.parse(shape));
}

/** An unhydrated writer cannot interpret missing imported records as deletion. */
export function mergeImportedDocument(imported: EncodedDocument, incoming: EncodedDocument): EncodedDocument {
  const mergeShape = (old: Shape, next: Shape): Shape => {
    if (old.kind !== next.kind) throw new Error('Legacy shape change requires explicit reconciliation');
    if (old.kind === 'object' && next.kind === 'object') {
      const prior = new Map(old.entries);
      const merged = new Map(old.entries);
      for (const [key, node] of next.entries) merged.set(key, prior.has(key) ? mergeShape(prior.get(key)!, node) : node);
      return { kind: 'object', entries: [...merged] };
    }
    if (old.kind === 'array' && next.kind === 'array') {
      const desired = new Set(next.entries.filter((n) => n.kind === 'record').map((n) => (n as { id: string }).id));
      return { kind: 'array', entries: [...next.entries, ...old.entries.filter((n) => n.kind !== 'record' || !desired.has(n.id))] };
    }
    return next;
  };
  const records = new Map(imported.records);
  for (const [id, record] of incoming.records) {
    const old = imported.records.get(id);
    if (old && old.payload !== record.payload) {
      const prior = JSON.parse(old.payload); const next = JSON.parse(record.payload);
      if (prior && next && typeof prior === 'object' && typeof next === 'object') {
        for (const field of ['revision', 'serverRevision']) {
          if (typeof prior[field] === 'number' && typeof next[field] === 'number' && next[field] < prior[field]) throw new Error('Older migration mutation requires reconciliation');
        }
      }
    }
    records.set(id, record);
  }
  return { shape: JSON.stringify(mergeShape(JSON.parse(imported.shape), JSON.parse(incoming.shape))), records };
}
