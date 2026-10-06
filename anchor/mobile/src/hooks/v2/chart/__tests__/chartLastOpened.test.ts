import { act, renderHook, waitFor } from '@testing-library/react-native';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { localDay, resetChartLastOpenedCache, useChartOpenedToday } from '../chartLastOpened';

const KEY = 'anchor:v2:chart2:opened:acct-1:course-1';
const at = (iso: string) => () => new Date(iso);

beforeEach(async () => {
  resetChartLastOpenedCache();
  jest.restoreAllMocks();
  await encryptedPersistStorage.removeItem(KEY);
});

describe('localDay', () => {
  it('formats the device-local calendar day', () => {
    expect(localDay(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(localDay(new Date(2026, 0, 9, 0, 1))).toBe('2026-01-09');
  });
});

describe('useChartOpenedToday', () => {
  it('a Chart never opened is a first open; marking it makes the next mount the same day a later open', async () => {
    const now = at('2026-10-05T09:00:00');
    const first = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now }));
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.openedToday).toBe(false);
    act(() => first.result.current.markOpened());
    // The current mount keeps its snapshot: marking never turns this open into a later one.
    expect(first.result.current.openedToday).toBe(false);
    first.unmount();

    const second = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now }));
    expect(second.result.current.loaded).toBe(true);
    expect(second.result.current.openedToday).toBe(true);
  });

  it('reads the stored day: same local day is a later open, the next local day is a first open again', async () => {
    await encryptedPersistStorage.setItem(KEY, '2026-10-05');
    const same = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now: at('2026-10-05T21:00:00') }));
    await waitFor(() => expect(same.result.current.loaded).toBe(true));
    expect(same.result.current.openedToday).toBe(true);
    same.unmount();

    resetChartLastOpenedCache();
    const next = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now: at('2026-10-06T07:00:00') }));
    await waitFor(() => expect(next.result.current.loaded).toBe(true));
    expect(next.result.current.openedToday).toBe(false);
  });

  it('persists the mark encrypted under the per-account, per-course key', async () => {
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    const hook = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now: at('2026-10-05T09:00:00') }));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    act(() => hook.result.current.markOpened());
    act(() => hook.result.current.markOpened());
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(KEY, '2026-10-05');
  });

  it('guests keep the mark in memory only', () => {
    const setItem = jest.spyOn(encryptedPersistStorage, 'setItem');
    const getItem = jest.spyOn(encryptedPersistStorage, 'getItem');
    const now = at('2026-10-05T09:00:00');
    const first = renderHook(() => useChartOpenedToday('course-1', { accountId: null, now }));
    expect(first.result.current.loaded).toBe(true);
    expect(first.result.current.openedToday).toBe(false);
    act(() => first.result.current.markOpened());
    first.unmount();
    const second = renderHook(() => useChartOpenedToday('course-1', { accountId: null, now }));
    expect(second.result.current.openedToday).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('a storage failure reads as not opened today and never throws', async () => {
    jest.spyOn(encryptedPersistStorage, 'getItem').mockRejectedValue(new Error('keystore locked'));
    jest.spyOn(encryptedPersistStorage, 'setItem').mockImplementation(() => {
      throw new Error('keystore locked');
    });
    const hook = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now: at('2026-10-05T09:00:00') }));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.openedToday).toBe(false);
    expect(() => act(() => hook.result.current.markOpened())).not.toThrow();
  });

  it('ignores a stored value that is not a day', async () => {
    await encryptedPersistStorage.setItem(KEY, 'not-a-day');
    const hook = renderHook(() => useChartOpenedToday('course-1', { accountId: 'acct-1', now: at('2026-10-05T09:00:00') }));
    await waitFor(() => expect(hook.result.current.loaded).toBe(true));
    expect(hook.result.current.openedToday).toBe(false);
  });
});
