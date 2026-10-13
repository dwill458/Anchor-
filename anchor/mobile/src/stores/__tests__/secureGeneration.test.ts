import * as SecureStore from 'expo-secure-store';
import { encryptedPersistStorage, readSecureValue, writeSecureValue } from '../encryptedPersistStorage';

describe('immutable secure generations', () => {
  const disk = new Map<string, string>();
  beforeEach(() => {
    disk.clear();
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key) => disk.get(key) ?? null);
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => { disk.set(key, value); });
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key) => { disk.delete(key); });
  });

  it('keeps the committed payload readable after an interrupted replacement', async () => {
    await writeSecureValue('synthetic-interruption', 'old'.repeat(1500));
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('synthetic write failure'));
    await expect(writeSecureValue('synthetic-interruption', 'new'.repeat(1500))).rejects.toThrow();
    expect(await readSecureValue('synthetic-interruption')).toBe('old'.repeat(1500));
  });

  it('preserves incomplete legacy chunks and reports recovery instead of empty storage', async () => {
    disk.set('synthetic-legacy__secure_meta', JSON.stringify({ chunks: 2 }));
    disk.set('synthetic-legacy__secure_chunk_0', 'retained');
    await expect(readSecureValue('synthetic-legacy')).rejects.toThrow();
    expect(disk.get('synthetic-legacy__secure_chunk_0')).toBe('retained');
  });

  it('round-trips Unicode at a native chunk boundary', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => {
      // Model native UTF-8 conversion, which replaces an isolated surrogate.
      disk.set(key, Buffer.from(value, 'utf8').toString('utf8'));
    });
    const payload = 'S'.repeat(1799) + '🌱' + 'S'.repeat(2000);
    await writeSecureValue('synthetic-unicode', payload);
    expect(await readSecureValue('synthetic-unicode')).toBe(payload);
  });

  it('removes the current, previous, and legacy secure generations', async () => {
    const key = 'synthetic-remove';
    await writeSecureValue(key, 'first'.repeat(500));
    await writeSecureValue(key, 'second'.repeat(500));
    disk.set(`${key}__secure_chunk_0`, 'legacy');

    await encryptedPersistStorage.removeItem(key);

    expect([...disk.keys()].filter((storedKey) => storedKey.startsWith(key))).toEqual([]);
  });

  it('preserves the original legacy source through interrupted conversion and retry', async () => {
    const key = 'anchor-vault-storage';
    const original = JSON.stringify({ state: { anchors: [{ id: 'synthetic-original', userId: 'synthetic-a' }] } });
    disk.set(`${key}__secure_meta`, JSON.stringify({ chunks: 1 }));
    disk.set(`${key}__secure_chunk_0`, original);
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name, value) => {
      if (name === `${key}__secure_meta`) throw new Error('synthetic interrupted commit');
      disk.set(name, value);
    });
    await expect(writeSecureValue(key, 'synthetic converted payload')).rejects.toThrow();
    expect(await readSecureValue(key)).toBe(original);
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name, value) => { disk.set(name, value); });
    await writeSecureValue(key, 'synthetic converted payload');
    expect(await readSecureValue(key)).toBe('synthetic converted payload');
    expect(disk.get(`${key}__secure_chunk_0`)).toBe(original);
    expect(JSON.parse(disk.get(`${key}__legacy_manifest`)!)).toEqual({ chunks: 1 });
  });

  it('does not rewrite the vault when activating a different UI scope with identical durable bytes', async () => {
    jest.useFakeTimers();
    try {
      const key = 'synthetic-scope-activation';
      const payload = JSON.stringify({ scopes: ['synthetic-a', 'synthetic-b'] });
      const first = encryptedPersistStorage.setItem(key, payload);
      await jest.advanceTimersByTimeAsync(400);
      await first;
      const calls = (SecureStore.setItemAsync as jest.Mock).mock.calls.length;
      const switchWrite = encryptedPersistStorage.setItem(key, payload);
      await jest.advanceTimersByTimeAsync(400);
      await switchWrite;
      expect((SecureStore.setItemAsync as jest.Mock).mock.calls).toHaveLength(calls);
    } finally { jest.useRealTimers(); }
  });
});
