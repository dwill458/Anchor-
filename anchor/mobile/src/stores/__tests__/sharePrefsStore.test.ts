import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHARE_PREFS_STORAGE_KEY, useSharePrefsStore } from '../sharePrefsStore';
import { DEFAULT_VISION_SHARE_BACKGROUND_ID } from '@/components/share/visionShareBackgrounds';

const disk = new Map<string, string>();
const storage = jest.mocked(AsyncStorage);
const hydrate = async (state: Record<string, unknown>) => {
  disk.set(SHARE_PREFS_STORAGE_KEY, JSON.stringify({ state, version: 0 }));
  await useSharePrefsStore.persist.rehydrate();
};

describe('Vision share preference hydration preserves explicit background choices', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    storage.getItem.mockImplementation(async key => disk.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { disk.set(key, value); });
    storage.removeItem.mockImplementation(async key => { disk.delete(key); });
    await useSharePrefsStore.persist.rehydrate();
    useSharePrefsStore.setState({ visionBackgroundId: DEFAULT_VISION_SHARE_BACKGROUND_ID, visionBackgroundSource: 'suggested' });
    disk.clear();
  });

  it('uses suggested presentation for a fresh account without a saved preference', async () => {
    await useSharePrefsStore.persist.rehydrate();
    expect(useSharePrefsStore.getState()).toMatchObject({
      visionBackgroundId: DEFAULT_VISION_SHARE_BACKGROUND_ID, visionBackgroundSource: 'suggested',
    });
  });

  it('treats a legacy persisted background as a manual choice so layout suggestions cannot replace it', async () => {
    await hydrate({ visionBackgroundId: 'midnight' });
    expect(useSharePrefsStore.getState()).toMatchObject({ visionBackgroundId: 'midnight', visionBackgroundSource: 'manual' });
  });

  it('preserves an explicitly saved suggested source instead of treating the saved background id as manual', async () => {
    await hydrate({ visionBackgroundId: 'scrapbook', visionBackgroundSource: 'suggested' });
    expect(useSharePrefsStore.getState()).toMatchObject({ visionBackgroundId: 'scrapbook', visionBackgroundSource: 'suggested' });
  });

  it('preserves an explicitly saved manual source', async () => {
    await hydrate({ visionBackgroundId: 'editorial', visionBackgroundSource: 'manual' });
    expect(useSharePrefsStore.getState()).toMatchObject({ visionBackgroundId: 'editorial', visionBackgroundSource: 'manual' });
  });

  it('marks and persists a newly chosen background as manual', () => {
    useSharePrefsStore.getState().setVisionBackgroundId('soft_focus');
    expect(useSharePrefsStore.getState()).toMatchObject({ visionBackgroundId: 'soft_focus', visionBackgroundSource: 'manual' });
    expect(JSON.parse(disk.get(SHARE_PREFS_STORAGE_KEY)!)).toMatchObject({
      state: { visionBackgroundId: 'soft_focus', visionBackgroundSource: 'manual' },
    });
  });

  it('restores suggestions only through the explicit useSuggested action and keeps the saved background id', () => {
    useSharePrefsStore.getState().setVisionBackgroundId('midnight');
    useSharePrefsStore.getState().useSuggestedVisionBackground();
    expect(useSharePrefsStore.getState()).toMatchObject({ visionBackgroundId: 'midnight', visionBackgroundSource: 'suggested' });
    expect(JSON.parse(disk.get(SHARE_PREFS_STORAGE_KEY)!)).toMatchObject({
      state: { visionBackgroundId: 'midnight', visionBackgroundSource: 'suggested' },
    });
  });
});
