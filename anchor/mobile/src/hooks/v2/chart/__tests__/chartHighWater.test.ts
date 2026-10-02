jest.mock('@/stores/encryptedPersistStorage', () => ({
  encryptedPersistStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
  readSecureValue: jest.fn().mockResolvedValue(null),
  writeSecureValue: jest.fn().mockResolvedValue(undefined),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { encryptedPersistStorage } from '@/stores/encryptedPersistStorage';
import { resetChartHighWaterCache, useChartHighWater } from '../chartHighWater';

const KEY = 'anchor:v2:chart2:hw:acct%201:course%2F1';

describe('useChartHighWater', () => {
  beforeEach(() => {
    resetChartHighWaterCache();
    jest.clearAllMocks();
    jest.mocked(encryptedPersistStorage.getItem).mockResolvedValue(null);
  });

  it('loads the persisted map under the documented key', async () => {
    jest.mocked(encryptedPersistStorage.getItem).mockResolvedValueOnce(JSON.stringify({ w1: 0.6, bad: 'x' }));
    const { result } = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    await waitFor(() => expect(result.current.map).toEqual({ w1: 0.6 }));
    expect(encryptedPersistStorage.getItem).toHaveBeenCalledWith(KEY);
  });

  it('commit writes only when changed', async () => {
    const { result } = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.commit({ w1: 0.5 }));
    expect(encryptedPersistStorage.setItem).toHaveBeenCalledTimes(1);
    expect(encryptedPersistStorage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify({ w1: 0.5 }));
    expect(result.current.map).toEqual({ w1: 0.5 });
    act(() => result.current.commit({ w1: 0.5 }));
    expect(encryptedPersistStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('does nothing without an account or course, and never throws on storage failure', async () => {
    const none = renderHook(() => useChartHighWater(null, 'c'));
    act(() => none.result.current.commit({ a: 1 }));
    expect(encryptedPersistStorage.setItem).not.toHaveBeenCalled();
    jest.mocked(encryptedPersistStorage.getItem).mockRejectedValueOnce(new Error('boom'));
    jest.mocked(encryptedPersistStorage.setItem).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    act(() => result.current.commit({ w1: 0.2 }));
    await waitFor(() => expect(result.current.map).toEqual({ w1: 0.2 }));
  });

  it('keeps the in-memory cache across remounts', async () => {
    const first = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    act(() => first.result.current.commit({ w1: 0.7 }));
    first.unmount();
    const second = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    expect(second.result.current.map).toEqual({ w1: 0.7 });
  });
});

describe('useChartHighWater durability', () => {
  beforeEach(() => {
    resetChartHighWaterCache();
    jest.clearAllMocks();
  });

  it('a raw low commit before load resolves never lowers the stored mark, across remounts', async () => {
    const store = new Map<string, string>([[KEY, JSON.stringify({ w1: 0.5 })]]);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    jest.mocked(encryptedPersistStorage.getItem).mockImplementation(async (k: string) => {
      await gate;
      return store.get(k) ?? null;
    });
    jest.mocked(encryptedPersistStorage.setItem).mockImplementation(async (k: string, v: string) => {
      store.set(k, v);
    });

    const first = renderHook(() => useChartHighWater('acct 1', 'course/1'));
    expect(first.result.current.loaded).toBe(false);
    act(() => first.result.current.commit({ w1: 0.2 }));
    await act(async () => {
      release();
    });
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.map.w1).toBeGreaterThanOrEqual(0.5);
    expect(JSON.parse(store.get(KEY) as string).w1).toBe(0.5);

    first.unmount();
    for (let i = 0; i < 2; i++) {
      const again = renderHook(() => useChartHighWater('acct 1', 'course/1'));
      await waitFor(() => expect(again.result.current.loaded).toBe(true));
      expect(again.result.current.map.w1).toBeGreaterThanOrEqual(0.5);
      again.unmount();
    }
    expect(JSON.parse(store.get(KEY) as string).w1).toBe(0.5);
  });

  it('guests keep an in-memory map per course and never persist', async () => {
    jest.mocked(encryptedPersistStorage.getItem).mockResolvedValue(null);
    const a = renderHook(() => useChartHighWater(null, 'course-g'));
    // no logged-in user in this test run
    expect(a.result.current.loaded).toBe(true);
    act(() => a.result.current.commit({ w1: 0.6 }));
    act(() => a.result.current.commit({ w1: 0.1 }));
    expect(a.result.current.map.w1).toBe(0.6);
    a.unmount();
    const b = renderHook(() => useChartHighWater(null, 'course-g'));
    expect(b.result.current.map.w1).toBe(0.6);
    expect(encryptedPersistStorage.setItem).not.toHaveBeenCalled();
    expect(encryptedPersistStorage.getItem).not.toHaveBeenCalled();
  });
});
