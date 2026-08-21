import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { encryptedPersistStorage } from '../encryptedPersistStorage';

const secureOnlyKeys = [
  'anchor:chart:course:secure-write-account',
  'anchor:chart:log:secure-write-account:course-1',
  'anchor:chart:journey:secure-write-account',
];

describe('encryptedPersistStorage Chart privacy', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await Promise.all(secureOnlyKeys.map((key) => encryptedPersistStorage.removeItem(key)));
    await encryptedPersistStorage.removeItem('anchor:chart:course:legacy-migration-account');
  });

  it.each(secureOnlyKeys)('never writes %s to plaintext when SecureStore fails', async (key) => {
    jest.useFakeTimers();
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure unavailable'));

    const pending = encryptedPersistStorage.setItem(key, 'private Chart writing');
    const rejected = expect(pending).rejects.toThrow('secure unavailable');
    await jest.advanceTimersByTimeAsync(401);
    await rejected;

    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(key, expect.anything());
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('fails closed and removes a legacy plaintext Course cache when migration cannot encrypt it', async () => {
    const key = 'anchor:chart:course:legacy-migration-account';
    await AsyncStorage.setItem(key, 'private legacy destination');
    jest.clearAllMocks();
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure unavailable'));

    await expect(encryptedPersistStorage.getItem(key)).resolves.toBeNull();

    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('serializes an account purge after an already-running secure write', async () => {
    jest.useFakeTimers();
    const key = 'anchor:chart:journey:secure-write-account';
    const secureValues = new Map<string, string>();
    let releaseFirstWrite!: () => void;
    const firstWriteGate = new Promise<void>((resolve) => { releaseFirstWrite = resolve; });
    let firstWrite = true;

    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.setItemAsync as jest.Mock).mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockReset();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      async (secureKey: string) => secureValues.get(secureKey) ?? null,
    );
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(
      async (secureKey: string, value: string) => {
        if (firstWrite) {
          firstWrite = false;
          await firstWriteGate;
        }
        secureValues.set(secureKey, value);
      },
    );
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
      async (secureKey: string) => { secureValues.delete(secureKey); },
    );

    const write = encryptedPersistStorage.setItem(key, 'private in-flight journey');
    await jest.advanceTimersByTimeAsync(401);
    expect(SecureStore.setItemAsync).toHaveBeenCalled();

    const purge = encryptedPersistStorage.removeItem(key);
    releaseFirstWrite();
    await write;
    await purge;

    expect(await encryptedPersistStorage.getItem(key)).toBeNull();
    expect([...secureValues.values()]).not.toContain('private in-flight journey');
  });
});
