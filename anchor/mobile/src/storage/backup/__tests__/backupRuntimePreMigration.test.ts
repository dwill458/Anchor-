const mockRecordDatabase = jest.fn(() => { throw new Error('SQLCipher must stay unopened before activation'); });
jest.mock('../legacyBackupSource', () => ({
  legacyBackupSource: jest.fn(() => ({
    exportPrivate: async (name: string) => name === 'anchor-vault-storage' ? ({
      name, shape: 'zustand', revision: 1,
      records: [
        { id: 'a', scope: 'account:synthetic-account-A', revision: 1, checksum: 'a', payload: '{"owner":"A"}' },
        { id: 'b', scope: 'account:synthetic-account-B', revision: 1, checksum: 'b', payload: '{"owner":"B"}' },
      ], recovery: [],
    }) : null,
    listPrivateNamespaces: async () => ['anchor-vault-storage'],
    listAccountIds: async () => ['synthetic-account-A', 'synthetic-account-B'],
    listPlainKeys: async () => [],
    readPlain: async () => null,
  })),
}));
jest.mock('../../sqlcipher/persistence', () => ({ sqlCipherEnabled: () => false }));
jest.mock('../../sqlcipher/runtime', () => ({ recordDatabase: mockRecordDatabase }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: false, isGuest: false, user: null }) } }));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => value),
  getRandomBytesAsync: jest.fn(async (length: number) => new Uint8Array(length).fill(7)),
}));

import * as SecureStore from 'expo-secure-store';
import { createBackup } from '../backupRuntime';

describe('pre-migration backup runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses only the legacy read path when migration activation is disabled', async () => {
    const result = await createBackup({ createdAt: new Date('2026-10-15T00:00:00.000Z') });

    expect(result.ok).toBe(true);
    expect(jest.requireMock('../legacyBackupSource').legacyBackupSource).toHaveBeenCalledTimes(1);
    expect(mockRecordDatabase).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    if (result.ok) expect(result.summary.recordCount).toBeGreaterThanOrEqual(2);
  });
});
