import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { getChartTaughtState, resetChartTaughtState, resetChartTaughtStateCache, setChartTaughtState } from '../chartTaughtState';

const KEY = 'anchor:v2:chart2:taught:acct-1';
const LEGACY_KEY = 'anchor:v2:chart2:taught:acct-legacy:course-legacy';

beforeEach(async () => {
  resetChartTaughtStateCache();
  jest.restoreAllMocks();
  await encryptedPersistStorage.removeItem(KEY);
  await encryptedPersistStorage.removeItem(LEGACY_KEY);
  await encryptedPersistStorage.removeItem('guest:chart-taught');
});

describe('chartTaughtState', () => {
  it('reads and persists the encrypted account mark across courses', async () => {
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(false);
    setChartTaughtState('acct-1', 'course-1');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(true);
    // Verified: switching to a different course on the same account still reports taught!
    expect(await getChartTaughtState('acct-1', 'course-2')).toBe(true);
    expect(setItem).toHaveBeenCalledWith(KEY, '1');
    // Seed the backing store directly: setChartTaughtState intentionally schedules
    // encrypted persistence, while this assertion models a fresh process read.
    await encryptedPersistStorage.setItem(KEY, '1');
    resetChartTaughtStateCache();
    expect(await getChartTaughtState('acct-1', 'course-3')).toBe(true);
  });

  it('persists guest teaching state in encrypted storage across courses', async () => {
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    expect(await getChartTaughtState(null, 'course-1')).toBe(false);
    setChartTaughtState(null, 'course-1');
    expect(await getChartTaughtState(null, 'course-1')).toBe(true);
    // Guest switching anchors also remains taught:
    expect(await getChartTaughtState(null, 'course-2')).toBe(true);
    expect(setItem).toHaveBeenCalledWith('guest:chart-taught', '1');
    // Seed the backing store directly: setChartTaughtState intentionally schedules
    // encrypted persistence, while this assertion models a fresh process read.
    await encryptedPersistStorage.setItem('guest:chart-taught', '1');
    resetChartTaughtStateCache();
    expect(await getChartTaughtState(null, 'course-3')).toBe(true);
  });

  it('migrates guest taught state to account on read without leaking to a second account', async () => {
    await encryptedPersistStorage.setItem('guest:chart-taught', '1');
    resetChartTaughtStateCache();
    expect(await getChartTaughtState('new-acct', 'course-1')).toBe(true);
    expect(await getChartTaughtState('second-acct', 'course-1')).toBe(false);
    await encryptedPersistStorage.removeItem('anchor:v2:chart2:taught:new-acct');
  });

  it('does not leak an authenticated account mark into another account or guest', async () => {
    setChartTaughtState('acct-1', 'course-1');
    expect(await getChartTaughtState('acct-1', 'course-1')).toBe(true);
    expect(await getChartTaughtState('acct-2', 'course-1')).toBe(false);
    expect(await getChartTaughtState(null, 'course-1')).toBe(false);
  });

  it('migrates legacy per-course marks on read for backwards compatibility', async () => {
    await encryptedPersistStorage.setItem(LEGACY_KEY, '1');
    resetChartTaughtStateCache();
    expect(await getChartTaughtState('acct-legacy', 'course-legacy')).toBe(true);
    // Subsequent reads for any other course on acct-legacy now read the migrated account mark:
    expect(await getChartTaughtState('acct-legacy', 'course-another')).toBe(true);
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
    expect(await getChartTaughtState('acct-1', 'course-2')).toBe(false);
  });
});
