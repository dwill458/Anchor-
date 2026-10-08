import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { getTeachingSeen, resetAllTeachingSeen, resetTeachingSeenCache, setTeachingSeen } from '../teachingSeen';
jest.mock('@/stores/encryptedPersistStorage', () => ({ encryptedPersistStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));
const storage = encryptedPersistStorage as jest.Mocked<typeof encryptedPersistStorage>;
beforeEach(() => { jest.clearAllMocks(); resetTeachingSeenCache(); storage.getItem.mockResolvedValue(null); });
it('persists per account and beat using the new namespace', async () => {
  setTeachingSeen('a/b', 'home.today');
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledWith('anchor:v2:teach:home.today:a%2Fb', '1');
  expect(await getTeachingSeen('a/b', 'home.today')).toBe(true);
  expect(await getTeachingSeen('other', 'home.today')).toBe(false);
  expect(await getTeachingSeen('a/b', 'home.progress')).toBe(false);
});
it('guests stay in memory only', async () => {
  setTeachingSeen(null, 'home.today');
  expect(await getTeachingSeen(null, 'home.today')).toBe(true);
  expect(storage.setItem).not.toHaveBeenCalled();
  resetTeachingSeenCache();
  expect(await getTeachingSeen(null, 'home.today')).toBe(false);
  expect(storage.getItem).not.toHaveBeenCalled();
});
it('storage throws never crash', async () => {
  storage.getItem.mockImplementation(() => { throw Error('offline'); });
  storage.setItem.mockImplementation(() => { throw Error('offline'); });
  storage.removeItem.mockImplementation(() => { throw Error('offline'); });
  expect(await getTeachingSeen('a', 'home.today')).toBe(false);
  expect(() => setTeachingSeen('a', 'home.today')).not.toThrow();
  await expect(resetAllTeachingSeen('a')).resolves.toBeUndefined();
});
it('loads persisted flags after clearing cache', async () => {
  storage.getItem.mockResolvedValue('1');
  expect(await getTeachingSeen('a', 'home.today')).toBe(true);
  resetTeachingSeenCache();
  expect(await getTeachingSeen('a', 'home.today')).toBe(true);
  expect(storage.getItem).toHaveBeenCalledTimes(2);
});
it('reset clears only one account and ignores reads started before reset', async () => {
  let resolve!: (value: string) => void;
  storage.getItem.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const read = getTeachingSeen('a', 'home.today');
  setTeachingSeen('b', 'home.today');
  await resetAllTeachingSeen('a');
  resolve('1');
  expect(await read).toBe(false);
  expect(await getTeachingSeen('b', 'home.today')).toBe(true);
  expect(storage.removeItem.mock.calls.every(([key]) => key.endsWith(':a'))).toBe(true);
});
