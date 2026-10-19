import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { recordDatabase } from '../sqlcipher/runtime';
import { createEncryptedBackup, type CreateBackupResult } from './backupService';
import { databaseBackupSource, databaseRestoreTarget } from './databaseAdapters';
import { legacyBackupSource } from './legacyBackupSource';
import { sqlCipherEnabled } from '../sqlcipher/persistence';
import { useAuthStore } from '@/stores/authStore';
import { discardInterruptedRestores, restoreEncryptedBackup, type RestoreResult } from './restoreService';

/**
 * App-runtime binding for the encrypted backup. Randomness comes from the
 * platform CSPRNG (expo-crypto). Plaintext preference keys come from
 * AsyncStorage. The recovery secret is returned to the caller once and never persisted here.
 */

const randomBytes = (length: number) => Crypto.getRandomBytesAsync(length);

const plainPreferences = {
  keys: async () => [...await AsyncStorage.getAllKeys()],
  read: (key: string) => AsyncStorage.getItem(key),
  // A restore must never overwrite an active preference; only absent keys are written.
  writeAll: async (entries: { key: string; value: string }[]) => {
    if (entries.length === 0) return;
    const existing = await AsyncStorage.multiGet(entries.map((e) => e.key));
    const absent = entries.filter((_, index) => existing[index][1] === null);
    if (absent.length > 0) await AsyncStorage.multiSet(absent.map((e) => [e.key, e.value] as [string, string]));
    const verified = await AsyncStorage.multiGet(absent.map((e) => e.key));
    if (verified.some(([key, value]) => value !== absent.find((entry) => entry.key === key)?.value)) {
      throw new Error('Preference restore read-back failed');
    }
  },
};

async function localMediaOmissions() {
  const root = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}profile-media/` : null;
  if (!root) return [{ name: 'profile-media (private app directory unavailable)', store: 'file' as const, reason: 'local-only profile media could not be inventoried' }];
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) return [];
  const files = await FileSystem.readDirectoryAsync(root);
  return files.map((file) => ({ name: `profile-media/${file}`, store: 'file' as const, reason: 'local profile image is not included in the encrypted archive' }));
}

export function createBackup(options: { createdAt?: Date; acknowledgeUnresolved?: boolean } = {}): Promise<CreateBackupResult> {
  const source = sqlCipherEnabled() ? databaseBackupSource(recordDatabase(), plainPreferences) : legacyBackupSource();
  return createEncryptedBackup({
    // Before migration activation, read the legacy source directly. Opening the
    // new database here would create its key/lifecycle marker and import legacy
    // data as a side effect of an operation that must be non-destructive.
    source: { ...source, listAdditionalUnresolved: localMediaOmissions },
    randomBytes,
    createdAt: options.createdAt ?? new Date(),
    acknowledgeUnresolved: options.acknowledgeUnresolved,
  });
}

export async function restoreBackup(options: { archive: Uint8Array; recoverySecret: string }): Promise<RestoreResult> {
  const random = await randomBytes(6);
  const generationId = `restore-${Date.now().toString(36)}-${Array.from(random, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  return restoreEncryptedBackup({
    archive: options.archive,
    recoverySecret: options.recoverySecret,
    generationId,
    target: databaseRestoreTarget(recordDatabase(), plainPreferences),
    authorizeOwnerScopes: (scopes) => {
      const auth = useAuthStore.getState();
      if (scopes.length === 0) return false;
      if (scopes.every((scope) => scope === 'guest')) return auth.isGuest === true;
      return auth.isAuthenticated === true && auth.isGuest !== true && Boolean(auth.user?.id) &&
        scopes.every((scope) => scope === `account:${auth.user!.id}`);
    },
  });
}

/** Run at startup before any restore is offered; removes generations left by a killed restore. */
export function discardInterruptedBackupRestores(): Promise<string[]> {
  if (!sqlCipherEnabled()) return Promise.resolve([]);
  return discardInterruptedRestores(databaseRestoreTarget(recordDatabase(), plainPreferences));
}
