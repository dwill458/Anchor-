/**
 * Versioned, explicit registry of durable persistence namespaces.
 *
 * SecureStore cannot enumerate arbitrary keys, so the backup cannot discover
 * private namespaces by scanning. Every namespace the app writes must be listed
 * here as included or excluded (with a reason). Owner-scoped namespaces are
 * expanded only from account identifiers that are present in durable records.
 * Anything enumerable (SQLCipher documents, AsyncStorage keys) that matches no
 * rule is reported as unresolved, never silently dropped.
 */

export const NAMESPACE_REGISTRY_VERSION = 1;

export type StoreKind = 'private' | 'plain' | 'file';

export type Disposition =
  | { action: 'include'; family: string; reason: string }
  | { action: 'exclude'; family: string; reason: string };

interface Rule {
  match: { name: string } | { prefix: string };
  disposition: Disposition;
}

const EXCLUDE_SECRET = 'authentication secret or identity cache; re-established by sign-in';
const EXCLUDE_SERVER = 'server-authoritative or rebuildable cache; re-fetched after restore';
const EXCLUDE_TRANSIENT = 'transient diagnostic or scheduling marker with no owner value';

export const RULES: readonly Rule[] = [
  // Account-owned private records (SecureStore generations, imported into SQLCipher).
  { match: { name: 'anchor-vault-storage' }, disposition: { action: 'include', family: 'anchors', reason: 'Anchors, owner partitions, guest transfer and pending sync ledgers' } },
  { match: { name: 'anchor-session-storage' }, disposition: { action: 'include', family: 'practice-session', reason: 'practice history, progress snapshots and thread state' } },
  { match: { name: 'anchor-visualization-scenes-v1' }, disposition: { action: 'include', family: 'scenes', reason: 'visualization scenes (legacy root namespace)' } },
  { match: { prefix: 'anchor-visualization-scenes-v1::owner::' }, disposition: { action: 'include', family: 'scenes-owner', reason: 'owner-scoped visualization scenes and Vision/Chart references' } },
  { match: { name: 'anchor-first-anchor-flow-v1' }, disposition: { action: 'include', family: 'creation-draft', reason: 'active and incomplete creation drafts' } },
  { match: { prefix: 'anchor:chart:reflection-drafts:' }, disposition: { action: 'include', family: 'reflection-draft', reason: 'unsent reflection drafts (private)' } },
  { match: { prefix: 'anchor:practice-history:' }, disposition: { action: 'include', family: 'practice-history', reason: 'owner practice history' } },
  { match: { prefix: 'anchor:practice-write-queue:' }, disposition: { action: 'include', family: 'pending-practice', reason: 'unsynchronized practice completions (pending)' } },
  { match: { prefix: 'anchor:practice-next-action-queue:' }, disposition: { action: 'include', family: 'pending-next-action', reason: 'unsynchronized next-action writes (pending)' } },
  { match: { prefix: 'anchor:anchor-snapshot:' }, disposition: { action: 'include', family: 'anchor-snapshot', reason: 'owner anchor snapshot used for local recovery' } },
  { match: { prefix: 'anchor:session-snapshot:' }, disposition: { action: 'include', family: 'session-snapshot', reason: 'owner progress and Thread Strength snapshot' } },
  { match: { prefix: 'anchor:profile-snapshot:' }, disposition: { action: 'include', family: 'profile-snapshot', reason: 'owner profile snapshot' } },
  { match: { prefix: 'anchor:recovery-metadata:' }, disposition: { action: 'include', family: 'recovery-metadata', reason: 'owner-scoped reconciliation and recovery evidence' } },
  { match: { name: 'anchor-teaching-storage' }, disposition: { action: 'include', family: 'device-progress', reason: 'teaching and first-run progress' } },
  { match: { name: 'anchor-location-priming-storage' }, disposition: { action: 'include', family: 'device-progress', reason: 'priming state' } },
  { match: { name: 'anchor:v2:first-run' }, disposition: { action: 'include', family: 'device-progress', reason: 'first-run completion' } },
  { match: { prefix: 'anchor:v2:chart2:' }, disposition: { action: 'include', family: 'chart-ui-state', reason: 'chart handoff, taught and high-water UI state' } },
  { match: { prefix: 'guest:' }, disposition: { action: 'include', family: 'guest-ui-state', reason: 'guest-scoped chart UI state' } },

  // Plaintext AsyncStorage namespaces that hold durable user state.
  { match: { name: 'anchor-profile-storage' }, disposition: { action: 'include', family: 'profile', reason: 'account-specific profile information' } },
  { match: { name: 'anchor-settings-storage' }, disposition: { action: 'include', family: 'settings', reason: 'user settings' } },
  { match: { prefix: 'anchor:settings:' }, disposition: { action: 'include', family: 'settings', reason: 'user settings keys' } },
  { match: { name: 'anchor-creation-prefs-v1' }, disposition: { action: 'include', family: 'preferences', reason: 'creation preferences' } },
  { match: { name: 'anchor-share-prefs-v1' }, disposition: { action: 'include', family: 'preferences', reason: 'share preferences' } },
  { match: { name: '@anchor/v2/celebration-records' }, disposition: { action: 'include', family: 'practice-record', reason: 'celebration records of completed practice' } },
  { match: { name: '@anchor/v2/home-glow-seen' }, disposition: { action: 'include', family: 'device-progress', reason: 'one-time experience state' } },
  { match: { name: '@anchor/v2/home-arrival-sound-played' }, disposition: { action: 'include', family: 'device-progress', reason: 'one-time experience state' } },
  { match: { name: 'anchor.splash.firstOpenPlayed.v2' }, disposition: { action: 'include', family: 'device-progress', reason: 'one-time experience state' } },
  { match: { name: '@anchor_notification_state' }, disposition: { action: 'include', family: 'notifications', reason: 'notification preferences' } },
  { match: { name: '@anchor_notification_state_pending_sync' }, disposition: { action: 'include', family: 'pending-sync', reason: 'unsynchronized notification state' } },
  { match: { name: '@anchor_pending_smart_notification' }, disposition: { action: 'include', family: 'pending-sync', reason: 'pending local notification' } },

  // Exclusions: secrets and identity caches.
  { match: { name: 'anchor-auth-storage' }, disposition: { action: 'exclude', family: 'auth-secret', reason: EXCLUDE_SECRET } },
  { match: { name: 'anchor:cached_user' }, disposition: { action: 'exclude', family: 'auth-secret', reason: EXCLUDE_SECRET } },

  // Exclusions: server-authoritative data and rebuildable caches.
  { match: { name: 'anchor-subscription-override-storage' }, disposition: { action: 'exclude', family: 'entitlement-cache', reason: EXCLUDE_SERVER } },
  { match: { prefix: 'anchor:chart:course:' }, disposition: { action: 'exclude', family: 'course-cache', reason: EXCLUDE_SERVER } },
  { match: { prefix: 'anchor:chart:log:' }, disposition: { action: 'exclude', family: 'course-cache', reason: EXCLUDE_SERVER } },
  { match: { prefix: 'anchor:v2:recommendation-context:' }, disposition: { action: 'exclude', family: 'recommendation-cache', reason: EXCLUDE_SERVER } },
  { match: { name: '@anchor_widget_snapshot' }, disposition: { action: 'exclude', family: 'widget-cache', reason: EXCLUDE_SERVER } },
  { match: { name: '@anchor_widget_last_sync' }, disposition: { action: 'exclude', family: 'widget-cache', reason: EXCLUDE_SERVER } },
  { match: { name: 'widgetSnapshot' }, disposition: { action: 'exclude', family: 'widget-cache', reason: EXCLUDE_SERVER } },

  // Exclusions: transient markers.
  { match: { prefix: 'anchor:post_prime_trace:' }, disposition: { action: 'exclude', family: 'diagnostic', reason: EXCLUDE_TRANSIENT } },
  { match: { name: '@anchor/v2/practice-diagnostic' }, disposition: { action: 'exclude', family: 'diagnostic', reason: EXCLUDE_TRANSIENT } },
];

export function classify(name: string): Disposition | null {
  for (const rule of RULES) {
    if ('name' in rule.match ? rule.match.name === name : name.startsWith(rule.match.prefix)) return rule.disposition;
  }
  return null;
}

// Families whose SecureStore names embed an owner id. SQLCipher-imported names are
// found by prefix; legacy names are not enumerable, so they are expanded from
// account identifiers plus the guest and legacy owner tokens.
const OWNER_KEYED_PREFIXES = [
  'anchor:practice-history:',
  'anchor:practice-write-queue:',
  'anchor:practice-next-action-queue:',
  'anchor:anchor-snapshot:',
  'anchor:session-snapshot:',
  'anchor:profile-snapshot:',
  'anchor:recovery-metadata:',
  'anchor:chart:reflection-drafts:',
] as const;

/** Candidate owner-scoped names derived from identifiers the device already holds. */
export function ownerScopedNames(accountIds: readonly string[]): string[] {
  const sceneRoot = 'anchor-visualization-scenes-v1::owner::';
  const sceneOwners = ['recovery', ...accountIds.map((id) => `account:${id}`)];
  const owners = [...new Set([...accountIds, 'guest', 'legacy'])];
  return [
    ...sceneOwners.map((owner) => `${sceneRoot}${owner}`),
    ...OWNER_KEYED_PREFIXES.flatMap((prefix) => owners.map((owner) => `${prefix}${owner}`)),
  ];
}

export interface CatalogEntry {
  name: string;
  store: StoreKind;
  family: string;
  reason: string;
}

export interface BackupCatalog {
  registryVersion: number;
  included: CatalogEntry[];
  excluded: CatalogEntry[];
  unresolved: { name: string; store: StoreKind; reason: string }[];
}

export interface CatalogInput {
  /** Document namespaces currently present in SQLCipher (already imported). */
  privateNamespaces: readonly string[];
  /** Keys enumerated from AsyncStorage. */
  plainKeys: readonly string[];
  /** Account identifiers found in durable owner scopes. */
  accountIds: readonly string[];
}

/**
 * Builds the coverage catalog. Included names are the candidates to export;
 * excluded names are listed with reasons; unresolved names block a "complete" claim.
 */
export function buildCatalog(input: CatalogInput): BackupCatalog {
  const included = new Map<string, CatalogEntry>();
  const excluded = new Map<string, CatalogEntry>();
  const unresolved: BackupCatalog['unresolved'] = [];

  const place = (name: string, store: StoreKind) => {
    const disposition = classify(name);
    if (!disposition) {
      unresolved.push({ name, store, reason: 'no registry rule; ownership and inclusion not established' });
      return;
    }
    const entry: CatalogEntry = { name, store, family: disposition.family, reason: disposition.reason };
    if (disposition.action === 'include') included.set(`${store}:${name}`, entry);
    else excluded.set(`${store}:${name}`, entry);
  };

  for (const name of input.privateNamespaces) place(name, 'private');
  for (const key of input.plainKeys) place(key, 'plain');

  // Known private roots always belong in the catalog, even before first import.
  for (const name of ['anchor-vault-storage', 'anchor-session-storage', 'anchor-visualization-scenes-v1']) {
    if (!included.has(`private:${name}`)) place(name, 'private');
  }
  for (const name of ownerScopedNames(input.accountIds)) {
    if (!included.has(`private:${name}`)) {
      const disposition = classify(name)!;
      included.set(`private:${name}`, { name, store: 'private', family: disposition.family, reason: disposition.reason });
    }
  }

  return {
    registryVersion: NAMESPACE_REGISTRY_VERSION,
    included: [...included.values()].sort((a, b) => a.name.localeCompare(b.name)),
    excluded: [...excluded.values()].sort((a, b) => a.name.localeCompare(b.name)),
    unresolved,
  };
}
