import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveV2Viewport, type V2Viewport } from '@/theme/v2/responsive';

/** Live viewport metrics for V2 screens. Re-resolves on rotation, split view and font-scale-driven relayout. */
export function useV2Responsive(): V2Viewport {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(
    () => resolveV2Viewport({ width, height, topInset: insets.top, bottomInset: insets.bottom }),
    [width, height, insets.top, insets.bottom],
  );
}
