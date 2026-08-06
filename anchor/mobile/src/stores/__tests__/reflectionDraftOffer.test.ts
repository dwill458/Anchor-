import {
  reflectionDraftStorageKey,
  useReflectionDraftStore,
} from '../reflectionDraftStore';
import { encryptedPersistStorage } from '../encryptedPersistStorage';

describe('reflectionDraftStore — post-practice offer idempotency', () => {
  const accountId = 'account-offer-test';

  beforeEach(async () => {
    await encryptedPersistStorage.removeItem(reflectionDraftStorageKey(accountId));
    useReflectionDraftStore.setState({
      accountId: null,
      hydrated: false,
      drafts: {},
      handledOfferKeys: [],
    });
  });

  afterEach(async () => {
    await encryptedPersistStorage.removeItem(reflectionDraftStorageKey(accountId));
  });

  it('persists one handled marker for repeated presentations of the same session', async () => {
    await useReflectionDraftStore.getState().bindAccount(accountId);
    const offerKey = 'post-practice:canonical-session-1';

    await useReflectionDraftStore.getState().markOfferHandled(offerKey);
    await useReflectionDraftStore.getState().markOfferHandled(offerKey);
    expect(useReflectionDraftStore.getState().handledOfferKeys).toEqual([offerKey]);

    await useReflectionDraftStore.getState().bindAccount(null);
    await useReflectionDraftStore.getState().bindAccount(accountId);
    expect(useReflectionDraftStore.getState().handledOfferKeys).toEqual([offerKey]);
  });

  it('keeps account offer histories isolated', async () => {
    await useReflectionDraftStore.getState().bindAccount(accountId);
    await useReflectionDraftStore.getState().markOfferHandled('post-practice:session-a');

    await useReflectionDraftStore.getState().bindAccount('another-account');
    expect(useReflectionDraftStore.getState().handledOfferKeys).toEqual([]);
  });
});
