import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPLASH_FIRST_OPEN_STORAGE_KEY } from '../splashAnimation.constants';
import { markFirstOpenPlayed, resetSplashVariantForTests, resolveSplashVariant } from '../splashVariant';

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;

describe('splashVariant', () => {
  beforeEach(() => {
    resetSplashVariantForTests();
    getItem.mockReset();
    setItem.mockClear();
  });

  it('plays the first-open ceremony when the flag is absent', async () => {
    getItem.mockResolvedValue(null);
    await expect(resolveSplashVariant()).resolves.toBe('first');
  });

  it('plays the quick return once the flag is set', async () => {
    getItem.mockResolvedValue('1');
    await expect(resolveSplashVariant()).resolves.toBe('return');
  });

  it('falls back to the quick return when storage fails', async () => {
    getItem.mockRejectedValue(new Error('disk'));
    await expect(resolveSplashVariant()).resolves.toBe('return');
  });

  it('reads storage once for both splash mounts', async () => {
    getItem.mockResolvedValue(null);
    await resolveSplashVariant();
    await resolveSplashVariant();
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('persists the first-open flag', () => {
    markFirstOpenPlayed();
    expect(setItem).toHaveBeenCalledWith(SPLASH_FIRST_OPEN_STORAGE_KEY, '1');
  });
});
