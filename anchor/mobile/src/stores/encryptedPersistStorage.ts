import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

import { logger } from '@/utils/logger';

type AsyncStateStorage = StateStorage & {
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
};

const SECURE_META_SUFFIX = '__secure_meta';
const SECURE_CHUNK_PREFIX = '__secure_chunk_';
const SECURE_CHUNK_SIZE = 1800;
const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

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
  for (let i = 0; i < value.length; i += SECURE_CHUNK_SIZE) {
    chunks.push(value.slice(i, i + SECURE_CHUNK_SIZE));
  }
  return chunks;
}

async function readSecureMeta(name: string): Promise<SecureChunkMeta | null> {
  const rawMeta = await SecureStore.getItemAsync(secureStoreKey(secureMetaKey(name)));
  if (!rawMeta) return null;

  try {
    const parsed = JSON.parse(rawMeta) as SecureChunkMeta;
    if (!Number.isInteger(parsed.chunks) || parsed.chunks <= 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function clearSecureChunks(name: string): Promise<void> {
  const existingMeta = await readSecureMeta(name);
  if (existingMeta) {
    await Promise.all(
      Array.from({ length: existingMeta.chunks }, (_, i) =>
        SecureStore.deleteItemAsync(secureStoreKey(secureChunkKey(name, i)))
      )
    );
  }
  await SecureStore.deleteItemAsync(secureStoreKey(secureMetaKey(name)));
}

export async function readSecureValue(name: string): Promise<string | null> {
  const meta = await readSecureMeta(name);
  if (!meta) return null;

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.getItemAsync(secureStoreKey(secureChunkKey(name, index)))
    )
  );

  if (chunks.some((chunk) => chunk == null)) {
    logger.warn(`Secure storage chunk mismatch for key ${name}; clearing corrupted data.`);
    await clearSecureChunks(name);
    return null;
  }

  return chunks.join('');
}

export async function writeSecureValue(name: string, value: string): Promise<void> {
  await clearSecureChunks(name);

  const chunks = splitIntoChunks(value);
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(secureStoreKey(secureChunkKey(name, index)), chunk)
    )
  );

  const meta: SecureChunkMeta = { chunks: chunks.length };
  await SecureStore.setItemAsync(secureStoreKey(secureMetaKey(name)), JSON.stringify(meta));
}

async function migrateLegacyAsyncStorageValue(name: string): Promise<string | null> {
  const legacyValue = await AsyncStorage.getItem(name);
  if (!legacyValue) return null;

  try {
    await writeSecureValue(name, legacyValue);
    await AsyncStorage.removeItem(name);
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
    await AsyncStorage.removeItem(name);
  } catch (error) {
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
  { value: string; timer: ReturnType<typeof setTimeout>; resolvers: Array<() => void> }
>();
const lastWrittenValue = new Map<string, string>();

function scheduleWrite(name: string, value: string): Promise<void> {
  if (lastWrittenValue.get(name) === value) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = pendingWrites.get(name);
    if (existing) {
      clearTimeout(existing.timer);
      existing.value = value;
      existing.resolvers.push(resolve);
      existing.timer = setTimeout(() => void flushWrite(name), WRITE_DEBOUNCE_MS);
      return;
    }

    pendingWrites.set(name, {
      value,
      resolvers: [resolve],
      timer: setTimeout(() => void flushWrite(name), WRITE_DEBOUNCE_MS),
    });
  });
}

async function flushWrite(name: string): Promise<void> {
  const entry = pendingWrites.get(name);
  if (!entry) return;
  pendingWrites.delete(name);

  await performWrite(name, entry.value);
  lastWrittenValue.set(name, entry.value);
  entry.resolvers.forEach((resolve) => resolve());
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
    try {
      const secureValue = await readSecureValue(name);
      if (secureValue != null) {
        lastWrittenValue.set(name, secureValue);
        return secureValue;
      }

      return await migrateLegacyAsyncStorageValue(name);
    } catch (error) {
      logger.error(`Failed to read encrypted store key ${name}`, error);
      return await AsyncStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    await scheduleWrite(name, value);
  },

  removeItem: async (name: string): Promise<void> => {
    const pending = pendingWrites.get(name);
    if (pending) {
      clearTimeout(pending.timer);
      pendingWrites.delete(name);
      pending.resolvers.forEach((resolve) => resolve());
    }
    lastWrittenValue.delete(name);
    await clearSecureChunks(name);
    await AsyncStorage.removeItem(name);
  },
};
