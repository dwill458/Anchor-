import { act, renderHook } from '@testing-library/react-native';

import { useStyleStep } from '../useStyleStep';

describe('useStyleStep', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('never commits on its own: there is no timer on a choice', () => {
    const onCommit = jest.fn();
    renderHook(() => useStyleStep({ defaultStyleId: 'plush', initialChipIds: ['plush', 'woven', 'gilt'], onCommit }));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the selected style once when "Form it" is pressed, and again after reset', () => {
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useStyleStep({ defaultStyleId: 'plush', initialChipIds: ['plush', 'woven', 'gilt'], onCommit })
    );
    act(() => result.current.select('woven'));
    act(() => result.current.commit());
    act(() => result.current.commit());
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('woven');
    act(() => result.current.reset());
    act(() => result.current.commit());
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('stays committable when a gate refuses the request', () => {
    const onCommit = jest.fn().mockReturnValue(false);
    const { result } = renderHook(() =>
      useStyleStep({ defaultStyleId: 'plush', initialChipIds: ['plush', 'woven', 'gilt'], onCommit })
    );
    act(() => result.current.commit());
    act(() => result.current.commit());
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});
