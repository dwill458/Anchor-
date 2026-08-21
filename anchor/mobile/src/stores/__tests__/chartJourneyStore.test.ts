import { encryptedPersistStorage } from '../encryptedPersistStorage';
import * as SecureStore from 'expo-secure-store';
import {
  getFreshChartAnchorHandoff,
  useChartJourneyStore,
} from '../chartJourneyStore';

describe('chartJourneyStore', () => {
  const secure = new Map<string, string>();
  const nativeSecure = new Map<string, string>();

  beforeEach(async () => {
    secure.clear();
    nativeSecure.clear();
    jest.spyOn(SecureStore, 'getItemAsync').mockImplementation(async (key) => nativeSecure.get(key) ?? null);
    jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => { nativeSecure.set(key, value); });
    jest.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async (key) => { nativeSecure.delete(key); });
    jest.spyOn(encryptedPersistStorage, 'getItem').mockImplementation(async (key) => secure.get(key) ?? null);
    jest.spyOn(encryptedPersistStorage, 'setItem').mockImplementation(async (key, value) => {
      secure.set(key, value);
    });
    jest.spyOn(encryptedPersistStorage, 'removeItem').mockImplementation(async (key) => {
      secure.delete(key);
    });
    await useChartJourneyStore.getState().bindAccount(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers the new-user invitation only after the matching first Anchor has a durable Practice', async () => {
    await useChartJourneyStore.getState().bindAccount('account-a');
    await useChartJourneyStore.getState().markFirstAnchorCreated('anchor-first');

    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('awaiting_practice');
    expect(useChartJourneyStore.getState().existingUserIntroResolved).toBe(true);

    await useChartJourneyStore.getState().markFirstPracticeCompleted('anchor-other');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('awaiting_practice');

    await useChartJourneyStore.getState().markFirstPracticeCompleted('anchor-first');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('ready');

    await useChartJourneyStore.getState().resolveNewUserIntro();
    await useChartJourneyStore.getState().markFirstPracticeCompleted('anchor-first');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('resolved');

    // Resolution is durable: leaving and re-binding the account must not make
    // the post-Practice invitation eligible again.
    await useChartJourneyStore.getState().bindAccount(null);
    await useChartJourneyStore.getState().bindAccount('account-a');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('resolved');
    expect(useChartJourneyStore.getState().existingUserIntroResolved).toBe(true);

    await useChartJourneyStore.getState().markFirstPracticeCompleted('anchor-first');
    expect(useChartJourneyStore.getState().newUserIntroStage).toBe('resolved');
  });

  it('keeps canonical flows moving when milestone persistence is temporarily unavailable', async () => {
    await useChartJourneyStore.getState().bindAccount('account-secure-failure');
    jest.spyOn(SecureStore, 'setItemAsync').mockRejectedValue(new Error('secure unavailable'));

    await expect(
      useChartJourneyStore.getState().markFirstAnchorCreated('anchor-first'),
    ).resolves.toBeUndefined();
    await expect(
      useChartJourneyStore.getState().markFirstPracticeCompleted('anchor-first'),
    ).resolves.toBeUndefined();
    await expect(
      useChartJourneyStore.getState().resolveNewUserIntro(),
    ).resolves.toBeUndefined();

    expect(useChartJourneyStore.getState()).toEqual(expect.objectContaining({
      firstAnchorId: 'anchor-first',
      newUserIntroStage: 'resolved',
    }));
  });

  it('clears private state synchronously before hydrating another account', async () => {
    await useChartJourneyStore.getState().bindAccount('account-a');
    useChartJourneyStore.getState().replaceSetupDraft({
      destinationText: 'A private destination',
      currentReality: 'A private baseline',
      waypoints: [{ title: 'A result', description: '' }],
      fromProposalId: null,
      seedAnchorId: null,
    });

    const binding = useChartJourneyStore.getState().bindAccount('account-b');
    expect(useChartJourneyStore.getState().accountId).toBe('account-b');
    expect(useChartJourneyStore.getState().setupDraft).toBeNull();
    await binding;
    expect(useChartJourneyStore.getState().setupDraft).toBeNull();
  });

  it('rotates the link key for distinct creation intents and scopes retrieval by account', async () => {
    await useChartJourneyStore.getState().bindAccount('account-a');
    const first = useChartJourneyStore.getState().beginAnchorCreation('course-a', 'waypoint-a');
    const second = useChartJourneyStore.getState().beginAnchorCreation('course-a', 'waypoint-b');

    expect(first?.linkIdempotencyKey).not.toBe(second?.linkIdempotencyKey);
    expect(getFreshChartAnchorHandoff('account-b')).toBeNull();
    expect(getFreshChartAnchorHandoff('account-a')?.waypointId).toBe('waypoint-b');
  });

  it('reuses exact restart intents and rotates both keys when the Anchor payload changes', async () => {
    await useChartJourneyStore.getState().bindAccount('account-a');
    const started = useChartJourneyStore.getState().beginAnchorCreation('course-a', 'waypoint-a', 3);
    const first = await useChartJourneyStore.getState().claimAnchorCreateIntent('{"intention":"first"}');
    const same = await useChartJourneyStore.getState().claimAnchorCreateIntent('{"intention":"first"}');
    const changed = await useChartJourneyStore.getState().claimAnchorCreateIntent('{"intention":"changed"}');

    expect(first?.anchorCreateIdempotencyKey).toBe(started?.anchorCreateIdempotencyKey);
    expect(same?.anchorCreateIdempotencyKey).toBe(first?.anchorCreateIdempotencyKey);
    expect(changed?.anchorCreateIdempotencyKey).not.toBe(first?.anchorCreateIdempotencyKey);
    expect(changed?.linkIdempotencyKey).not.toBe(first?.linkIdempotencyKey);
  });

  it('preserves non-private intro resolution while purging private journey state on sign-out', async () => {
    await useChartJourneyStore.getState().bindAccount('account-a');
    useChartJourneyStore.getState().replaceSetupDraft({
      destinationText: 'Private destination',
      currentReality: 'Private context',
      waypoints: [],
      fromProposalId: null,
      seedAnchorId: null,
    });
    await useChartJourneyStore.getState().resolveExistingUserIntro();

    useChartJourneyStore.getState().clearAccount('account-a');
    await useChartJourneyStore.getState().bindAccount('account-a');

    expect(useChartJourneyStore.getState().setupDraft).toBeNull();
    expect(useChartJourneyStore.getState().existingUserIntroResolved).toBe(true);
  });
});
