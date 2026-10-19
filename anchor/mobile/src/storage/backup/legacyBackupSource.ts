import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { encodeDocument } from '../sqlcipher/recordCodec';
import type { ExportedDocument } from '../sqlcipher/database';
import { readLegacySecureValue } from '@/stores/encryptedPersistStorage';
import { BACKUP_ROOT_NAMESPACES, type BackupSource } from './backupService';
import { ownerScopedNames } from './namespaceRegistry';

/** Read-only view of the 1.5 SecureStore/AsyncStorage source for pre-migration backups. */
export function legacyBackupSource(): BackupSource {
  const rawValues = new Map<string, string>();
  const documents = new Map<string, ExportedDocument>();
  let accountIds: string[] | null = null;

  const read = async (name: string): Promise<string | null> => {
    if (rawValues.has(name)) return rawValues.get(name)!;
    const secure = await readLegacySecureValue(name);
    const value = secure ?? await AsyncStorage.getItem(name);
    if (value !== null) rawValues.set(name, value);
    return value;
  };

  const discoverAccounts = async (): Promise<string[]> => {
    if (accountIds) return accountIds;
    const candidates = [...BACKUP_ROOT_NAMESPACES, 'anchor:cached_user'];
    const ids = new Set<string>();
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const row = value as Record<string, unknown>;
      for (const key of ['accountId', 'ownerAccountId', 'userId']) {
        const id = row[key];
        if (typeof id === 'string' && id.trim() && !['guest', 'guest-user', 'user-local', 'local-user', 'legacy'].includes(id)) ids.add(id);
      }
      Object.values(row).forEach(visit);
    };
    for (const name of candidates) {
      const raw = await read(name);
      if (raw === null) continue;
      try { visit(JSON.parse(raw)); } catch { throw new Error('Legacy backup source is unreadable; recovery is required'); }
    }
    accountIds = [...ids].sort();
    return accountIds;
  };

  const inspect = async (name: string): Promise<ExportedDocument | null> => {
    if (documents.has(name)) return documents.get(name)!;
    const raw = await read(name);
    if (raw === null) return null;
    let value: unknown;
    try { value = JSON.parse(raw); } catch { throw new Error('Legacy backup source is unreadable; recovery is required'); }
    const encoded = encodeDocument(name, value);
    const records = await Promise.all([...encoded.records.values()].map(async (record) => ({
      ...record,
      revision: 1,
      checksum: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, record.payload),
    })));
    const result = { name, shape: encoded.shape, revision: 1, records, recovery: [] };
    documents.set(name, result);
    return result;
  };

  return {
    async exportPrivate(name) { return inspect(name); },
    async listPrivateNamespaces() {
      const ids = await discoverAccounts();
      const names = [...new Set([...BACKUP_ROOT_NAMESPACES, ...ownerScopedNames(ids)])];
      const present: string[] = [];
      for (const name of names) if (await inspect(name)) present.push(name);
      return present;
    },
    listAccountIds: discoverAccounts,
    listPlainKeys: async () => [...await AsyncStorage.getAllKeys()],
    readPlain: (name) => AsyncStorage.getItem(name),
  };
}
