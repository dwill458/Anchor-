import * as SecureStore from 'expo-secure-store';
import { readLegacySecureValue, writeLegacySecureValue } from '../encryptedPersistStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('@/storage/sqlcipher/persistence', () => ({
  sqlCipherEnabled: () => false, readDatabaseValue: jest.fn(), writeDatabaseValue: jest.fn(), removeDatabaseValue: jest.fn(),
}));

const mocked = SecureStore as jest.Mocked<typeof SecureStore>;

/** An in-memory native store that records how many calls were waiting on the native queue at once. */
function installNativeStore() {
  const data = new Map<string, string>();
  const stats = { inFlight: 0, peak: 0 };
  const run = async <T,>(work: () => T): Promise<T> => {
    stats.inFlight += 1; stats.peak = Math.max(stats.peak, stats.inFlight);
    await new Promise(resolve => setTimeout(resolve, 0));
    try { return work(); } finally { stats.inFlight -= 1; }
  };
  mocked.getItemAsync.mockImplementation(key => run(() => data.get(key) ?? null));
  mocked.setItemAsync.mockImplementation((key, value) => run(() => { data.set(key, value); }));
  mocked.deleteItemAsync.mockImplementation(key => run(() => { data.delete(key); }));
  return stats;
}

describe('SecureStore call concurrency', () => {
  it('never floods the native queue when a large vault is written and read back', async () => {
    const stats = installNativeStore();
    const vault = 'x'.repeat(1800 * 300);
    await writeLegacySecureValue('anchor-vault-storage', vault);
    expect(await readLegacySecureValue('anchor-vault-storage')).toBe(vault);
    // Other native work (the photo picker, a draft read) queues behind whatever is in flight.
    expect(stats.peak).toBeLessThanOrEqual(8);
  });
});

describe('SecureStore read priority', () => {
  it('commits a Vision draft before a queued bulk vault write finishes', async () => {
    installNativeStore();
    const order: string[] = [];
    const bulk = writeLegacySecureValue('anchor-vault-storage', 'z'.repeat(1800 * 200)).then(() => order.push('bulk'));
    await new Promise(resolve => setTimeout(resolve, 5));
    const draft = writeLegacySecureValue('vision-conversation.owner.anchor', 'private draft').then(() => order.push('draft'));
    await draft;
    expect(order[0]).toBe('draft');
    expect(await readLegacySecureValue('vision-conversation.owner.anchor')).toBe('private draft');
    await bulk;
  });
  it('serves a small read before the rest of a queued vault write', async () => {
    installNativeStore();
    const order: string[] = [];
    const write = writeLegacySecureValue('anchor-vault-storage', 'y'.repeat(1800 * 200)).then(() => order.push('write'));
    await new Promise(resolve => setTimeout(resolve, 5));
    await readLegacySecureValue('vision-conversation.draft').then(() => order.push('read'));
    // The write has not been allowed to finish ahead of the draft read.
    expect(order[0]).toBe('read');
    await write;
  });
});
