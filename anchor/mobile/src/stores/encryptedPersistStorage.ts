import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { StateStorage } from 'zustand/middleware';

import { logger } from '@/utils/logger';

const SECURE_META_SUFFIX = '__secure_meta';
const SECURE_CHUNK_PREFIX = '__secure_chunk_';
const SECURE_CHUNK_SIZE = 1800;

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
  const rawMeta = await SecureStore.getItemAsync(secureMetaKey(name));
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
    for (let i = 0; i < existingMeta.chunks; i += 1) {
      await SecureStore.deleteItemAsync(secureChunkKey(name, i));
    }
  }
  await SecureStore.deleteItemAsync(secureMetaKey(name));
}

async function readSecureValue(name: string): Promise<string | null> {
  const meta = await readSecureMeta(name);
  if (!meta) return null;

  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.getItemAsync(secureChunkKey(name, index))
    )
  );

  if (chunks.some((chunk) => chunk == null)) {
    logger.warn(`Secure storage chunk mismatch for key ${name}; clearing corrupted data.`);
    await clearSecureChunks(name);
    return null;
  }

  return chunks.join('');
}

async function writeSecureValue(name: string, value: string): Promise<void> {
  await clearSecureChunks(name);

  const chunks = splitIntoChunks(value);
  await Promise.all(
    chunks.map((chunk, index) => SecureStore.setItemAsync(secureChunkKey(name, index), chunk))
  );

  const meta: SecureChunkMeta = { chunks: chunks.length };
  await SecureStore.setItemAsync(secureMetaKey(name), JSON.stringify(meta));
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

/**
 * Encrypted persisted storage using expo-secure-store.
 *
 * - Supports payloads larger than platform key-value limits by chunking.
 * - Migrates legacy unencrypted AsyncStorage blobs on first read.
 */
export const encryptedPersistStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const secureValue = await readSecureValue(name);
      if (secureValue != null) {
        return secureValue;
      }

      return await migrateLegacyAsyncStorageValue(name);
    } catch (error) {
      logger.error(`Failed to read encrypted store key ${name}`, error);
      return await AsyncStorage.getItem(name);
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await writeSecureValue(name, value);
      // Ensure no plaintext legacy value remains once encrypted write succeeds.
      await AsyncStorage.removeItem(name);
    } catch (error) {
      logger.error(`Failed to write encrypted store key ${name}`, error);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    await clearSecureChunks(name);
    await AsyncStorage.removeItem(name);
  },
};
