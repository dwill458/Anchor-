import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOME_GLOW_SEEN_STORAGE_KEY, shouldAnimateGlow, useHomeGlowSeenStore } from '../homeGlowSeenStore';

const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  useHomeGlowSeenStore.setState({ seen: {}, hydrated: true });
});

describe('shouldAnimateGlow', () => {
  it('animates only when a measured value differs from a recorded one', () => {
    expect(shouldAnimateGlow(40, 60)).toBe(true);
    expect(shouldAnimateGlow(60, 40)).toBe(true);
    expect(shouldAnimateGlow(60, 60)).toBe(false);
  });

  it('does not animate an Anchor with no recorded value', () => {
    expect(shouldAnimateGlow(undefined, 60)).toBe(false);
    expect(shouldAnimateGlow(null, 60)).toBe(false);
  });

  it('does not animate an unmeasured thread', () => {
    expect(shouldAnimateGlow(40, null)).toBe(false);
    expect(shouldAnimateGlow(40, undefined)).toBe(false);
  });

  it('treats non-finite values as absent', () => {
    expect(shouldAnimateGlow(Number.NaN, 60)).toBe(false);
    expect(shouldAnimateGlow(40, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('useHomeGlowSeenStore', () => {
  it('records the last value seen per Anchor and leaves other Anchors alone', () => {
    const { setSeen, getSeen } = useHomeGlowSeenStore.getState();
    setSeen('a1', 55);
    setSeen('a2', 10);
    setSeen('a1', 70);
    expect(getSeen('a1')).toBe(70);
    expect(getSeen('a2')).toBe(10);
    expect(getSeen('missing')).toBeUndefined();
  });

  it('persists only the seen record under the newest key', async () => {
    useHomeGlowSeenStore.getState().setSeen('a1', 55);
    await Promise.resolve();

    expect(storage.setItem).toHaveBeenCalled();
    const [key, raw] = storage.setItem.mock.calls.at(-1) as [string, string];
    expect(key).toBe(HOME_GLOW_SEEN_STORAGE_KEY);
    expect(HOME_GLOW_SEEN_STORAGE_KEY).toBe('@anchor/v2/home-glow-seen');
    const persisted = JSON.parse(raw);
    expect(persisted.version).toBe(1);
    expect(persisted.state).toEqual({ seen: { a1: 55 } });
  });

  it('restores the stored record and marks the store hydrated', async () => {
    useHomeGlowSeenStore.setState({ seen: {}, hydrated: false });
    storage.getItem.mockResolvedValueOnce(JSON.stringify({ state: { seen: { a1: 40, a2: 10 } }, version: 1 }));

    await useHomeGlowSeenStore.persist.rehydrate();

    expect(useHomeGlowSeenStore.getState().hydrated).toBe(true);
    expect(useHomeGlowSeenStore.getState().getSeen('a1')).toBe(40);
    expect(useHomeGlowSeenStore.getState().getSeen('a2')).toBe(10);
  });

  it('keeps a value recorded in this session over the stored one', async () => {
    useHomeGlowSeenStore.setState({ seen: { a1: 70 }, hydrated: false });
    storage.getItem.mockResolvedValueOnce(JSON.stringify({ state: { seen: { a1: 40, a2: 10 } }, version: 1 }));

    await useHomeGlowSeenStore.persist.rehydrate();

    expect(useHomeGlowSeenStore.getState().getSeen('a1')).toBe(70);
    expect(useHomeGlowSeenStore.getState().getSeen('a2')).toBe(10);
  });

  it('still marks the store hydrated when the stored record cannot be read', async () => {
    useHomeGlowSeenStore.setState({ seen: {}, hydrated: false });
    storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await useHomeGlowSeenStore.persist.rehydrate();

    expect(useHomeGlowSeenStore.getState().hydrated).toBe(true);
  });
});
