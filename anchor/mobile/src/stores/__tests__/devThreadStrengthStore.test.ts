import { act, renderHook } from '@testing-library/react-native';
import { useDevThreadStrengthStore, useThreadStrengthPreview } from '../devThreadStrengthStore';

describe('local thread strength preview', () => {
  const globals = globalThis as unknown as { __DEV__: boolean };
  const originalDev = globals.__DEV__;
  afterEach(() => {
    globals.__DEV__ = originalDev;
    useDevThreadStrengthStore.getState().simulate(null);
  });

  it('previews zero and any percentage without changing the source, then restores real data', () => {
    globals.__DEV__ = true;
    const source = Object.freeze({ threadStrength: 43 });
    const { result } = renderHook(() => useThreadStrengthPreview(source.threadStrength));
    act(() => useDevThreadStrengthStore.getState().simulate(0));
    expect(result.current).toBe(0);
    act(() => useDevThreadStrengthStore.getState().simulate(78));
    expect(result.current).toBe(78);
    expect(source.threadStrength).toBe(43);
    act(() => useDevThreadStrengthStore.getState().simulate(null));
    expect(result.current).toBe(43);
  });

  it('clamps and rounds slider values and ignores invalid input', () => {
    const { simulate } = useDevThreadStrengthStore.getState();
    simulate(101);
    expect(useDevThreadStrengthStore.getState().value).toBe(100);
    simulate(-10);
    expect(useDevThreadStrengthStore.getState().value).toBe(0);
    simulate(45.6);
    expect(useDevThreadStrengthStore.getState().value).toBe(46);
    simulate(NaN);
    expect(useDevThreadStrengthStore.getState().value).toBeNull();
  });

  it('keeps the aura mounted during a continuous slider preview', () => {
    const { simulate } = useDevThreadStrengthStore.getState();
    simulate(20);
    const key = useDevThreadStrengthStore.getState().nonce;
    simulate(21);
    simulate(22);
    expect(useDevThreadStrengthStore.getState().nonce).toBe(key);
    simulate(null);
    expect(useDevThreadStrengthStore.getState().nonce).toBe(key + 1);
  });

  it('preserves unmeasured real data and ignores overrides outside development', () => {
    globals.__DEV__ = false;
    useDevThreadStrengthStore.getState().simulate(90);
    const { result } = renderHook(() => useThreadStrengthPreview(null));
    expect(result.current).toBeNull();
  });
});
