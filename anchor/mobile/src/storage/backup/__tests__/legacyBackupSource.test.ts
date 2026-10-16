import { createEncryptedBackup } from '../backupService';
import { legacyBackupSource } from '../legacyBackupSource';

const mockSecureValues = new Map<string, string>();
const mockAsyncValues = new Map<string, string>();
jest.mock('@/stores/encryptedPersistStorage', () => ({
  readLegacySecureValue: jest.fn(async (name: string) => mockSecureValues.get(name) ?? null),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getAllKeys: jest.fn(async () => [...mockAsyncValues.keys()]),
    getItem: jest.fn(async (name: string) => mockAsyncValues.get(name) ?? null),
  },
}));

describe('read-only pre-migration backup source', () => {
  beforeEach(() => { mockSecureValues.clear(); mockAsyncValues.clear(); jest.clearAllMocks(); });

  it('backs up existing SecureStore records without writing or changing their source bytes', async () => {
    const vault = JSON.stringify({ state: { anchors: [{ id: 'anchor-1', userId: 'owner-a', intention: 'Synthetic' }] }, version: 1 });
    const session = JSON.stringify({ state: { practiceHistory: [{ id: 'session-1', accountId: 'owner-a' }] }, version: 1 });
    mockSecureValues.set('anchor-vault-storage', vault);
    mockSecureValues.set('anchor-session-storage', session);
    const before = [...mockSecureValues.entries()];
    const backup = await createEncryptedBackup({
      source: legacyBackupSource(),
      randomBytes: async (length) => new Uint8Array(length).fill(7),
      createdAt: new Date('2026-10-15T00:00:00Z'),
    });

    expect(backup.ok).toBe(true);
    expect([...mockSecureValues.entries()]).toEqual(before);
    expect(jest.requireMock('@/stores/encryptedPersistStorage').readLegacySecureValue).toHaveBeenCalled();
    if (backup.ok) expect(backup.summary.recordCount).toBeGreaterThan(0);
  });

  it('blocks backup when a legacy SecureStore value is unreadable', async () => {
    mockSecureValues.set('anchor-vault-storage', 'not-json');
    await expect(createEncryptedBackup({
      source: legacyBackupSource(),
      randomBytes: async (length) => new Uint8Array(length).fill(7),
      createdAt: new Date('2026-10-15T00:00:00Z'),
    })).rejects.toThrow('Legacy backup source is unreadable');
    expect([...mockSecureValues.entries()]).toEqual([['anchor-vault-storage', 'not-json']]);
  });
});
