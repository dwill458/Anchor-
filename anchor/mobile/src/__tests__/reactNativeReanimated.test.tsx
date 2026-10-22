import { act, renderHook } from '@testing-library/react-native';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

it('the native-free animation harness updates a stable style handle when a shared value changes', () => {
  const { result, rerender } = renderHook(() => {
    const opacity = useSharedValue(0);
    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return { opacity, style };
  });
  const handle = result.current.style;
  expect(handle).toHaveProperty('opacity', 0);
  act(() => { result.current.opacity.value = 1; });
  expect(handle).toHaveProperty('opacity', 1);
  rerender({});
  expect(result.current.style).toBe(handle);
  act(() => { result.current.opacity.value = 0; });
  expect(handle).toHaveProperty('opacity', 0);
});
