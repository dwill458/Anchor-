import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';
import { sqlCipherEnabled, readDatabaseValue, writeDatabaseValue, removeDatabaseValue } from '@/storage/sqlcipher/persistence';

import { logger } from '@/utils/logger';
import { perfLog } from '@/utils/perfDiagnostics';
import { traceStabilizationStage } from '@/utils/stabilizationDiagnostics';

type AsyncStateStorage = StateStorage & {
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

const SECURE_META_SUFFIX = '__secure_meta';
const SECURE_CHUNK_PREFIX = '__secure_chunk_';
const SECURE_CHUNK_SIZE = 1800;
const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;
// Reflection drafts and Course Log pages can contain private writing. Unlike
// general UI caches, they must never degrade to plaintext persistence.
const SECURE_ONLY_PREFIXES = ['anchor:v2:guidance:', 'guest:guidance', 'anchor:chart:reflection-drafts:', 'anchor:chart:log:', 'anchor:v2:first-run', 'anchor-vault-storage', 'anchor:anchor-snapshot:'];

function requiresSecureOnly(name: string): boolean {
  return SECURE_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Android SecureStore accepts only alphanumeric characters plus `.`, `-`, and
 * `_` in its key names. Some higher-level storage namespaces use separators
 * such as `:`, so encode only those keys before calling the native module.
 *
 * Already-valid keys are retained verbatim to preserve existing persisted
 * state across this update.
 */
function secureStoreKey(key: string): string {
  if (SECURE_STORE_KEY_PATTERN.test(key)) {
    return key;
  }

  return `anchor-secure-${Array.from(key, (character) =>
    character.codePointAt(0)!.toString(36)
  ).join('-')}`;
}

interface SecureChunkMeta {
  chunks: number;
  generation?: string;
  length?: number;
  previousGeneration?: string;
  previousChunks?: number;
}

function secureMetaKey(name: string): string {
  return `${name}${SECURE_META_SUFFIX}`;
}

function secureChunkKey(name: string, index: number): string {
  return `${name}${SECURE_CHUNK_PREFIX}${index}`;
}

function splitIntoChunks(value: string): string[] {
  if (value.length === 0) return [''];

  const chunks: string[] = [];
  for (let i = 0; i < value.length;) {
    let end = Math.min(value.length, i + SECURE_CHUNK_SIZE);
    const boundary = value.charCodeAt(end - 1);
    // Native UTF-8 encoding cannot round-trip half of a surrogate pair.
    if (end < value.length && boundary >= 0xd800 && boundary <= 0xdbff) end -= 1;
    chunks.push(value.slice(i, end));
    i = end;
  }
  return chunks;
}

async function readSecureMeta(name: string): Promise<SecureChunkMeta | null> {
  const rawMeta = await SecureStore.getItemAsync(secureStoreKey(secureMetaKey(name)));
  if (!rawMeta) return null;

  try {
    const parsed = JSON.parse(rawMeta) as SecureChunkMeta;
    if (!Number.isInteger(parsed.chunks) || parsed.chunks <= 0 ||
      (parsed.generation !== undefined && !/^[a-z0-9-]+$/.test(parsed.generation))) {
      throw new Error('Invalid secure storage manifest');
    }
    return parsed;
  } catch {
    throw new Error('Secure storage manifest requires recovery');
  }
}

async function clearSecureChunks(name: string): Promise<number> {
  const existingMeta = await readSecureMeta(name);
  const deleteGeneration = async (generation: string, chunks: number) => {
    await Promise.all(Array.from({ length: chunks }, (_, index) =>
      SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(
        `${name}__generation_${generation}`, index
      )))
    ));
  };
  if (existingMeta) {
    if (existingMeta.generation) {
      await deleteGeneration(existingMeta.generation, existingMeta.chunks);
      if (existingMeta.previousGeneration && existingMeta.previousChunks) {
        await deleteGeneration(existingMeta.previousGeneration, existingMeta.previousChunks);
      }
      // Also clear unversioned chunks left by the legacy storage format.
      await Promise.all(Array.from({ length: Math.max(existingMeta.chunks, existingMeta.previousChunks ?? 0) }, (_, i) =>
        SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(name, i)))
      ));
    } else {
      await Promise.all(Array.from({ length: existingMeta.chunks }, (_, i) =>
        SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(name, i)))
      ));
    }
  }
  const legacyManifestKey = secureStoreKey(`${name}__legacy_manifest`);
  const legacyManifest = await SecureStore.getItemAsync(legacyManifestKey);
  if (legacyManifest) {
    try {
      const legacyMeta = JSON.parse(legacyManifest) as SecureChunkMeta;
      if (Number.isInteger(legacyMeta.chunks) && legacyMeta.chunks > 0) {
        await Promise.all(Array.from({ length: legacyMeta.chunks }, (_, i) =>
          SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(name, i)))
        ));
      }
    } catch {
      throw new Error('Legacy secure storage manifest requires recovery');
    }
  }
  await SecureStore.deleteItemAsync(secureStoreKey(secureMetaKey(name)));
  await SecureStore.deleteItemAsync(legacyManifestKey);
  return existingMeta?.chunks ?? 0;
}

export async function readLegacySecureValue(name: string, retries = 2): Promise<string | null> {
  const startedAt = Date.now();
  const meta = await readSecureMeta(name);
  if (!meta) {
    perfLog('secure-read', { key: name, ms: Date.now() - startedAt, payloadChars: 0, chunks: 0, secureCalls: 1 });
    return null;
  }

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.getItemAsync(secureStoreKey(secureChunkKey(
        meta.generation ? `${name}__generation_${meta.generation}` : name, index
      )))
    )
  );

  if (chunks.some((chunk) => chunk == null)) {
    const currentMeta = await readSecureMeta(name);
    if (retries > 0 && currentMeta?.generation !== meta.generation) return readLegacySecureValue(name, retries - 1);
    throw new Error('Incomplete secure storage generation requires recovery');
  }

  const value = chunks.join('');
  if (meta.length !== undefined && value.length !== meta.length) {
    throw new Error('Secure storage length mismatch requires recovery');
  }
  perfLog('secure-read', { key: name, ms: Date.now() - startedAt, payloadChars: value.length, chunks: meta.chunks, secureCalls: meta.chunks + 1 });
  return value;
}

const requestedGeneration = new Map<string, number>();
const committedGeneration = new Map<string, number>();
const manifestWrites = new Map<string, Promise<void>>();
const processGeneration = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export async function writeLegacySecureValue(name: string, value: string): Promise<void> {
  const startedAt = Date.now();
  const revision = (requestedGeneration.get(name) ?? 0) + 1;
  requestedGeneration.set(name, revision);
  const generation = `${processGeneration}-${revision.toString(36)}`;
  const generationName = `${name}__generation_${generation}`;
  const chunks = splitIntoChunks(value);
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(secureStoreKey(secureChunkKey(generationName, index)), chunk)
    )
  );

  // Verify all bytes before changing the single commit pointer. Native chunk writes
  // may finish out of order; only manifest publication is serialized per key.
  const verified = await Promise.all(chunks.map((_, index) =>
    SecureStore.getItemAsync(secureStoreKey(secureChunkKey(generationName, index)))
  ));
  if (verified.some((chunk) => chunk == null) || verified.join('') !== value) {
    throw new Error('Secure storage readback failed');
  }
  const commit = (manifestWrites.get(name) ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (revision < (committedGeneration.get(name) ?? 0)) {
      await Promise.all(chunks.map((_, index) =>
        SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(generationName, index)))
      ));
      return;
    }
    const previous = await readSecureMeta(name);
    if (name === 'anchor-vault-storage' && previous && !previous.generation) {
      const legacyKey = secureStoreKey(`${name}__legacy_manifest`);
      if (!await SecureStore.getItemAsync(legacyKey)) await SecureStore.setItemAsync(legacyKey, JSON.stringify(previous));
    }
    const meta: SecureChunkMeta = { chunks: chunks.length, generation, length: value.length,
      previousGeneration: previous?.generation, previousChunks: previous?.chunks };
    await SecureStore.setItemAsync(secureStoreKey(secureMetaKey(name)), JSON.stringify(meta));
    committedGeneration.set(name, revision);
    // Only obsolete generations from this new writer are reclaimed. Keep the
    // previous commit and every legacy chunk; a racing reader retries the pointer.
    if (previous?.previousGeneration && previous.previousChunks) {
      await Promise.all(Array.from({ length: previous.previousChunks }, (_, index) =>
        SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(
          `${name}__generation_${previous.previousGeneration}`, index
        )))
      )).catch((error) => logger.warn('Failed to reclaim obsolete secure generation', error));
    }
  });
  manifestWrites.set(name, commit);
  await commit;
  perfLog('secure-write', { key: name, ms: Date.now() - startedAt, payloadChars: value.length, chunks: chunks.length, secureCalls: chunks.length * 2 + 1 });
}

const databaseNamespace = (name: string) => name !== 'anchor-auth-storage' && name !== 'anchor:cached_user';
export async function readSecureValue(name: string, retries = 2): Promise<string | null> {
  return sqlCipherEnabled() && databaseNamespace(name) ? readDatabaseValue(name) :
    traceStabilizationStage(databaseNamespace(name) ? 'legacy.private.read' : 'legacy.auth.read', () => readLegacySecureValue(name, retries));
}
export async function writeSecureValue(name: string, value: string): Promise<void> {
  if (sqlCipherEnabled() && databaseNamespace(name)) return writeDatabaseValue(name, value);
  return traceStabilizationStage(databaseNamespace(name) ? 'legacy.private.write' : 'legacy.auth.write', () => writeLegacySecureValue(name, value));
}
async function migrateLegacyAsyncStorageValue(name: string): Promise<string | null> {
  const legacyValue = await AsyncStorage.getItem(name);
  if (!legacyValue) return null;

  try {
    await writeSecureValue(name, legacyValue);
    // Private legacy vaults remain an immutable recovery source during conversion.
    if (name !== 'anchor-vault-storage') await AsyncStorage.removeItem(name);
    return legacyValue;
  } catch (error) {
    logger.error(`Failed to migrate legacy AsyncStorage key ${name} to SecureStore`, error);
    return legacyValue;
  }
}

async function performWrite(name: string, value: string): Promise<void> {
  try {
    await writeSecureValue(name, value);
    // Ensure no plaintext legacy value remains once encrypted write succeeds.
    if (name !== 'anchor-vault-storage') await AsyncStorage.removeItem(name);
  } catch (error) {
    if (requiresSecureOnly(name)) {
      logger.error(`Failed to write secure-only store key ${name}`, error);
      throw error;
    }
    logger.error(`Failed to write encrypted store key ${name}, falling back to AsyncStorage`, error);
    // Fall back so the state is not silently lost on restart.
    await AsyncStorage.setItem(name, value);
  }
}

/**
 * Zustand's persist middleware calls `setItem` on every `set()` to a
 * persisted store, even when the change doesn't touch a persisted field
 * (e.g. a loading flag). For stores whose persisted slice embeds large data
 * (anchor SVG/image payloads), that can mean re-encrypting and rewriting the
 * entire chunked blob to SecureStore multiple times a second. Debouncing
 * coalesces bursts of writes to the same key into a single actual write, and
 * skipping identical consecutive values avoids re-writing unchanged data.
 */
const WRITE_DEBOUNCE_MS = 400;
const pendingWrites = new Map<
  string,
  {
    value: string;
    timer: ReturnType<typeof setTimeout>;
    resolvers: Array<{ resolve: () => void; reject: (error: unknown) => void }>;
  }
>();
const lastWrittenValue = new Map<string, string>();
const writeCounts = new Map<string, number>();
const inFlightWrites = new Map<string, number>();
// Share only an identical, sole active generation. A newer pending request must
// retain its own receipt; matching an older payload must not skip its ordering.
const activeWriteEntries = new Map<string, Set<{ value: string; resolvers: Array<{ resolve: () => void; reject: (error: unknown) => void }> }>>();

function scheduleWrite(name: string, value: string): Promise<void> {
  if (!pendingWrites.has(name) && !inFlightWrites.get(name) && lastWrittenValue.get(name) === value) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const active = activeWriteEntries.get(name);
    if (!pendingWrites.has(name) && active?.size === 1) {
      const entry = active.values().next().value;
      if (entry?.value === value) {
        entry.resolvers.push({ resolve, reject });
        return;
      }
    }
    const existing = pendingWrites.get(name);
    if (existing) {
      if (existing.value === value) { existing.resolvers.push({ resolve, reject }); return; }
      clearTimeout(existing.timer);
      existing.value = value;
      existing.resolvers.push({ resolve, reject });
      existing.timer = setTimeout(() => void flushWrite(name), WRITE_DEBOUNCE_MS);
      return;
    }

    pendingWrites.set(name, {
      value,
      resolvers: [{ resolve, reject }],
      timer: setTimeout(() => void flushWrite(name), WRITE_DEBOUNCE_MS),
    });
  });
}

async function flushWrite(name: string): Promise<void> {
  const entry = pendingWrites.get(name);
  if (!entry) return;
  pendingWrites.delete(name);
  inFlightWrites.set(name, (inFlightWrites.get(name) ?? 0) + 1);
  const active = activeWriteEntries.get(name) ?? new Set();
  active.add(entry);
  activeWriteEntries.set(name, active);

  try {
    await performWrite(name, entry.value);
    // Older native writes can settle after a newer commit. Never let their
    // completion poison de-duplication with an obsolete value.
    const committedValue = await readSecureValue(name);
    if (committedValue !== null) lastWrittenValue.set(name, committedValue);
    entry.resolvers.forEach(({ resolve }) => resolve());
  } catch (error) {
    entry.resolvers.forEach(({ reject }) => reject(error));
  } finally {
    active.delete(entry);
    if (active.size === 0) activeWriteEntries.delete(name);
    inFlightWrites.set(name, Math.max(0, (inFlightWrites.get(name) ?? 1) - 1));
  }
}

/**
 * Encrypted persisted storage using expo-secure-store.
 *
 * - Supports payloads larger than platform key-value limits by chunking.
 * - Migrates legacy unencrypted AsyncStorage blobs on first read.
 * - Debounces and de-duplicates writes (see `scheduleWrite`).
 */
export const encryptedPersistStorage: AsyncStateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (sqlCipherEnabled() && databaseNamespace(name)) return readDatabaseValue(name);
    const startedAt = Date.now();
    try {
      const secureValue = await readSecureValue(name);
      if (secureValue != null) {
        lastWrittenValue.set(name, secureValue);
        perfLog('persist-getItem', { key: name, ms: Date.now() - startedAt, payloadChars: secureValue.length });
        return secureValue;
      }

      const legacyValue = await migrateLegacyAsyncStorageValue(name);
      perfLog('persist-getItem', { key: name, ms: Date.now() - startedAt, payloadChars: legacyValue?.length ?? 0, source: legacyValue ? 'legacy-migration' : 'empty' });
      return legacyValue;
    } catch (error) {
      logger.error(`Failed to read encrypted store key ${name}`, error);
      if (requiresSecureOnly(name)) throw error;
      const fallback = await AsyncStorage.getItem(name);
      perfLog('persist-getItem', { key: name, ms: Date.now() - startedAt, payloadChars: fallback?.length ?? 0, source: 'async-storage-fallback' });
      return fallback;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (sqlCipherEnabled() && databaseNamespace(name)) return writeDatabaseValue(name, value);
    const count = (writeCounts.get(name) ?? 0) + 1;
    writeCounts.set(name, count);
    perfLog('persist-setItem', { key: name, count, payloadChars: value.length, chunks: splitIntoChunks(value).length });
    const startedAt = Date.now();
    await scheduleWrite(name, value);
    perfLog('persist-setItem-settled', { key: name, count, ms: Date.now() - startedAt, payloadChars: value.length });
  },

  removeItem: async (name: string): Promise<void> => {
    if (sqlCipherEnabled() && databaseNamespace(name)) return removeDatabaseValue(name);
    const startedAt = Date.now();
    const pending = pendingWrites.get(name);
    if (pending) {
      clearTimeout(pending.timer);
      pendingWrites.delete(name);
      pending.resolvers.forEach(({ resolve }) => resolve());
    }
    lastWrittenValue.delete(name);
    const removalRevision = (requestedGeneration.get(name) ?? 0) + 1;
    requestedGeneration.set(name, removalRevision);
    committedGeneration.set(name, removalRevision);
    await (manifestWrites.get(name) ?? Promise.resolve()).catch(() => {});
    await clearSecureChunks(name);
    await AsyncStorage.removeItem(name);
    perfLog('persist-removeItem', { key: name, ms: Date.now() - startedAt });
  },
};
