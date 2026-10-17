import * as SecureStore from 'expo-secure-store';
import { encryptedPersistStorage, readSecureValue } from '@/stores/encryptedPersistStorage';

describe('identical in-flight durable receipts', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shares one native generation and waits for publication', async () => {
    const disk = new Map<string, string>();
    const key = 'synthetic-single-flight';
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async name => disk.get(name) ?? null);
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async name => { disk.delete(name); });
    const native = (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name, value) => {
      if (value === 'synthetic payload') await blocked;
      disk.set(name, value);
    });
    native.mockClear();
    const first = encryptedPersistStorage.setItem(key, 'synthetic payload');
    await jest.advanceTimersByTimeAsync(400);
    let settled = false;
    const second = encryptedPersistStorage.setItem(key, 'synthetic payload').then(() => { settled = true; });
    await jest.advanceTimersByTimeAsync(400);
    const chunksStarted = native.mock.calls.filter(([, value]) => value === 'synthetic payload').length;
    expect(settled).toBe(false);
    release();
    await Promise.all([first, second]);
    expect(await readSecureValue(key)).toBe('synthetic payload');
    expect(chunksStarted).toBe(1);
  });

  it('rejects all joined receipts on failure, keeps the previous commit, and permits retry', async () => {
    const disk = new Map<string, string>();
    const key = 'anchor-vault-storage-single-flight-failure';
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async name => disk.get(name) ?? null);
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async name => { disk.delete(name); });
    const native = (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name, value) => { disk.set(name, value); });
    const previous = encryptedPersistStorage.setItem(key, 'previous');
    await jest.advanceTimersByTimeAsync(400);
    await previous;
    let fail!: () => void;
    const blocked = new Promise<void>((_, reject) => { fail = () => reject(new Error('synthetic failure')); });
    native.mockImplementation(async (name, value) => {
      if (value === 'replacement') await blocked;
      disk.set(name, value);
    });
    const first = encryptedPersistStorage.setItem(key, 'replacement');
    await jest.advanceTimersByTimeAsync(400);
    const second = encryptedPersistStorage.setItem(key, 'replacement');
    const results = Promise.allSettled([first, second]);
    fail();
    expect((await results).map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(await readSecureValue(key)).toBe('previous');
    native.mockImplementation(async (name, value) => { disk.set(name, value); });
    const retry = encryptedPersistStorage.setItem(key, 'replacement');
    await jest.advanceTimersByTimeAsync(400);
    await retry;
    expect(await readSecureValue(key)).toBe('replacement');
  });

  it('does not join an older identical write across a newer pending payload', async () => {
    const disk = new Map<string, string>();
    const key = 'synthetic-single-flight-order';
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async name => disk.get(name) ?? null);
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async name => { disk.delete(name); });
    const native = (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name, value) => {
      if (value === 'older') await blocked;
      disk.set(name, value);
    });
    native.mockClear();
    const first = encryptedPersistStorage.setItem(key, 'older');
    await jest.advanceTimersByTimeAsync(400);
    const middle = encryptedPersistStorage.setItem(key, 'newer');
    const last = encryptedPersistStorage.setItem(key, 'older');
    await jest.advanceTimersByTimeAsync(400);
    expect(native.mock.calls.filter(([, value]) => value === 'older')).toHaveLength(2);
    release();
    await Promise.all([first, middle, last]);
    expect(await readSecureValue(key)).toBe('older');
  });
});
