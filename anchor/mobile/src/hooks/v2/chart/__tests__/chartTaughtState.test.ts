import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { getChartTaughtState, resetChartTaughtState, resetChartTaughtStateCache, setChartTaughtState } from '../chartTaughtState';

const KEY = 'anchor:v2:chart2:taught:acct-1:course-1';

beforeEach(async () => {
  resetChartTaughtStateCache();
  jest.restoreAllMocks();
  await encryptedPersistStorage.removeItem(KEY);
});

describe('chartTaughtState', () => {
  it('reads and persists the encrypted account and course mark', async () => {
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(false);
    setChartTaughtState('acct-1', 'course-1');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(true);
    expect(setItem).toHaveBeenCalledWith(KEY, '1');
    // Seed the backing store directly: setChartTaughtState intentionally schedules
    // encrypted persistence, while this assertion models a fresh process read.
    await encryptedPersistStorage.setItem(KEY, '1');
    resetChartTaughtStateCache();
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(true);
  });

  it('keeps guest teaching state in memory only', async () => {
    const getItem = jest.spyOn(encryptedPersistStorage, 'getItem');
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    expect(await getChartTaughtState(null, 'course-1')).toBe(false);
    setChartTaughtState(null, 'course-1');
    expect(await getChartTaughtState(null, 'course-1')).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not throw when encrypted reads or writes fail', async () => {
    jest.spyOn(encryptedPersistStorage, 'getItem').mockRejectedValue(new Error('keystore locked'));
    jest.spyOn(encryptedPersistStorage, 'setItem').mockImplementation(() => { throw new Error('keystore locked'); });
    await expect(getChartTaughtState('acct-1', 'course-1')).resolves.toBe(false);
    expect(() => setChartTaughtState('acct-1', 'course-1')).not.toThrow();
  });

  it('does not let a stale encrypted read overwrite a newer dismissal mark', async () => {
    let resolveRead: ((value: string | null) => void) | undefined;
    jest.spyOn(encryptedPersistStorage, 'getItem').mockImplementation(() => new Promise(resolve => { resolveRead = resolve; }));
    const pending = getChartTaughtState('acct-1', 'course-1');
    setChartTaughtState('acct-1', 'course-1');
    resolveRead?.(null);
    await expect(pending).resolves.toBe(true);
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(true);
  });

  it('clears the account mark for replay in the dev lab', async () => {
    setChartTaughtState('acct-1', 'course-1');
    await resetChartTaughtState('acct-1', 'course-1');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(false);
  });
});
