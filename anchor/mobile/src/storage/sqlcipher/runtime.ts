import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { EncryptedRecordDatabase, type SqlConnection } from './database';
import { databaseFileUri } from './databaseFileUri';
import { isSqlCipherNativeCohortAllowed } from './cohort';

export const DATABASE_NAME = 'anchor-private-v1.db';
const KEY_NAME = 'anchor.sqlcipher.key.v1';
const CREATED_MARKER = 'anchor.sqlcipher.created.v1';
let instance: EncryptedRecordDatabase | undefined;

export function recordDatabase(): EncryptedRecordDatabase {
  const ownerPilotEnabled = Constants.expoConfig?.extra?.sqlCipherOwnerPilot === true;
  const ownerPilotMigrationEnabled = Constants.expoConfig?.extra?.sqlCipherOwnerPilotMigrationEnabled === true;
  if (!isSqlCipherNativeCohortAllowed(Application.applicationId, ownerPilotEnabled, ownerPilotMigrationEnabled)) {
    throw new Error('SQLCipher activation requires an approved native cohort build');
  }
  if (!instance) instance = new EncryptedRecordDatabase({
    measure: process.env.EXPO_PUBLIC_ANCHOR_PERF_DIAGNOSTICS === '1'
      ? (event, fields) => console.log('SQLCIPHER_PRODUCT ' + JSON.stringify({ event, ...fields }))
      : undefined,
    exists: async () => {
      // Check base file AND WAL/SHM before permitting key creation. Restored
      // encrypted bytes without their key must remain untouched.
      for (const suffix of ['', '-wal', '-shm']) {
        if ((await FileSystem.getInfoAsync(databaseFileUri(SQLite.defaultDatabaseDirectory, `${DATABASE_NAME}${suffix}`))).exists) return true;
      }
      return false;
    },
    readKey: () => SecureStore.getItemAsync(KEY_NAME),
    wasCreated: async () => await SecureStore.getItemAsync(CREATED_MARKER) === '1',
    markCreated: async () => {
      if (await SecureStore.getItemAsync(CREATED_MARKER) === '1') return;
      await SecureStore.setItemAsync(CREATED_MARKER, '1', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      if (await SecureStore.getItemAsync(CREATED_MARKER) !== '1') throw new Error('Database lifecycle marker durability verification failed');
    },
    createKey: async () => Array.from(await Crypto.getRandomBytesAsync(32), (v) => v.toString(16).padStart(2, '0')).join(''),
    saveKey: (key) => SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false }),
    open: async () => await SQLite.openDatabaseAsync(DATABASE_NAME, { useNewConnection: true }) as SqlConnection,
    checksum: (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
    legacyRead: async (name) => {
      // Load lazily to avoid a cycle with the compatibility adapter. This reader
      // never publishes manifests, converts, removes or repairs source bytes.
      const { readLegacySecureValue } = require('@/stores/encryptedPersistStorage') as typeof import('@/stores/encryptedPersistStorage');
      const secure = await readLegacySecureValue(name);
      const raw = secure ?? await AsyncStorage.getItem(name);
      if (raw === null) return null;
      let value: unknown;
      try { value = JSON.parse(raw); } catch { throw new Error('Legacy private data requires recovery'); }
      return { raw, value, format: secure !== null ? 'secure-generation-or-chunks' : 'legacy-plaintext-preserved' };
    },
  });
  return instance;
}
