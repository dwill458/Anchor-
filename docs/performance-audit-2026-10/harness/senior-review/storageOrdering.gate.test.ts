/** Uses the real encrypted adapter and isolated fake native storage, never owner storage. */
import * as SecureStore from 'expo-secure-store';
import { encryptedPersistStorage, readSecureValue } from '@/stores/encryptedPersistStorage';

it('a delayed older vault write cannot overwrite a later account state', async () => {
  jest.useFakeTimers();
  const disk = new Map<string, string>();
  const key = 'senior-review-synthetic-vault';
  const oldPayload = JSON.stringify({ account: 'synthetic-a', revision: 1 });
  const newPayload = JSON.stringify({ account: 'synthetic-b', revision: 2 });
  let releaseOldWrite!: () => void;
  const delayed = new Promise<void>((resolve) => { releaseOldWrite = resolve; });
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (name: string) => disk.get(name) ?? null);
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (name: string) => { disk.delete(name); });
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (name: string, value: string) => {
    if (value === oldPayload) await delayed;
    disk.set(name, value);
  });
  const older = encryptedPersistStorage.setItem(key, oldPayload);
  await jest.advanceTimersByTimeAsync(400);
  const newer = encryptedPersistStorage.setItem(key, newPayload);
  await jest.advanceTimersByTimeAsync(400);
  await newer;
  expect(await readSecureValue(key)).toBe(newPayload);
  releaseOldWrite();
  await older;
  const final = await readSecureValue(key);
  jest.useRealTimers();
  expect(final).toBe(newPayload);
});
