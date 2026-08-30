import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { encryptedPersistStorage } from '../encryptedPersistStorage';
import { reflectionDraftStorageKey, useReflectionDraftStore, type ReflectionDraft } from '../reflectionDraftStore';

const draft = (accountId: string): ReflectionDraft => ({
  draftKey: 'draft-1', accountId, source: 'MANUAL_COURSE', promptType: 'COURSE_STATUS', promptVersion: 1,
  courseId: 'course-1', body: 'private writing', updatedAt: new Date().toISOString(), saveState: 'draft', retryCount: 0, idempotencyKey: 'stable-key',
});

describe('reflection draft storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useReflectionDraftStore.setState({ accountId: null, hydrated: false, drafts: {}, handledOfferKeys: [] });
  });

  it('is encrypted and account-scoped without a previous-account flash', async () => {
    await useReflectionDraftStore.getState().bindAccount('alice');
    await useReflectionDraftStore.getState().upsert(draft('alice'));
    expect(SecureStore.setItemAsync).toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(reflectionDraftStorageKey('alice'), expect.anything());
    await useReflectionDraftStore.getState().bindAccount('bob');
    expect(useReflectionDraftStore.getState().drafts).toEqual({});
  });

  it('never falls back to plaintext AsyncStorage for a reflection draft', async () => {
    jest.useFakeTimers();
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('secure unavailable'));
    const pending = encryptedPersistStorage.setItem(reflectionDraftStorageKey('alice'), 'private writing');
    const rejected = expect(pending).rejects.toThrow('secure unavailable');
    await jest.advanceTimersByTimeAsync(401);
    await rejected;
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
