import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import {
  getChartIntroSeen,
  resetChartIntroSeen,
  resetChartIntroSeenCache,
  setChartIntroSeen,
} from '../chartIntroSeen';

const ACCOUNT_KEY = 'anchor:v2:chart2:introSeen:acct-1';

beforeEach(async () => {
  jest.restoreAllMocks();
  resetChartIntroSeenCache();
  await encryptedPersistStorage.removeItem(ACCOUNT_KEY);
});

describe('chart intro seen flag', () => {
  it('persists and reads one account-wide marker', async () => {
    await setChartIntroSeen('acct-1');
    resetChartIntroSeenCache();
    expect(await getChartIntroSeen('acct-1')).toBe(true);
    expect(await encryptedPersistStorage.getItem(ACCOUNT_KEY)).toBe('1');
  });

  it('keeps guest state in memory without touching encrypted storage', async () => {
    const get = jest.spyOn(encryptedPersistStorage, 'getItem');
    const set = jest.spyOn(encryptedPersistStorage, 'setItem');
    expect(await getChartIntroSeen(null)).toBe(false);
    await setChartIntroSeen(null);
    resetChartIntroSeenCache();
    expect(await getChartIntroSeen(null)).toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('treats storage errors as unseen, caches the read failure, and never throws on write or reset', async () => {
    const get = jest.spyOn(encryptedPersistStorage, 'getItem').mockRejectedValue(new Error('keystore locked'));
    const set = jest.spyOn(encryptedPersistStorage, 'setItem').mockRejectedValue(new Error('keystore locked'));
    const remove = jest.spyOn(encryptedPersistStorage, 'removeItem').mockRejectedValue(new Error('keystore locked'));
    await expect(getChartIntroSeen('acct-1')).resolves.toBe(false);
    await expect(getChartIntroSeen('acct-1')).resolves.toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    await expect(setChartIntroSeen('acct-1')).resolves.toBeUndefined();
    await expect(resetChartIntroSeen('acct-1')).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('reset clears both the stored flag and the in-memory snapshot', async () => {
    await setChartIntroSeen('acct-1');
    await resetChartIntroSeen('acct-1');
    expect(await getChartIntroSeen('acct-1')).toBe(false);
    expect(await encryptedPersistStorage.getItem(ACCOUNT_KEY)).toBeNull();
  });
});
