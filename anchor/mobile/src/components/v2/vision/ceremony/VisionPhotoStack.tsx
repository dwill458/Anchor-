import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export interface VisionPhotoStackItem {
  /** Stable identity for preserving the print view when its stack position changes. */
  key: string;
}

export interface VisionPhotoStackRenderItem<T extends VisionPhotoStackItem> {
  item: T;
  index: number;
  /** 0 is the active print, 1 and 2 are the visible papers behind it. */
  stackPosition: number;
  active: boolean;
  /** Positions 0–2 are visible; all remaining prints stay mounted for reliable loading. */
  visible: boolean;
}

export interface VisionPhotoStackProps<T extends VisionPhotoStackItem> {
  items: readonly T[];
  activeId: string;
  onActiveIdChange: (id: string) => void;
  /** Keep the prints mounted but disable browsing while the seal is in flight. */
  interactive?: boolean;
  /** Absolute hit region over the photo windows. Keep the caption strip outside it. */
  hitTargetStyle: StyleProp<ViewStyle>;
  indicatorStyle?: StyleProp<ViewStyle>;
  renderItem: (item: VisionPhotoStackRenderItem<T>) => React.ReactNode;
  testID?: string;
}

/** Keeps the paper stack stable while making every selected photo reachable by tap or horizontal swipe. */
export function VisionPhotoStack<T extends VisionPhotoStackItem>({
  items, activeId, onActiveIdChange, hitTargetStyle, indicatorStyle, renderItem, interactive = true, testID = 'vision-photo-stack',
}: VisionPhotoStackProps<T>) {
  const activeIdRef = useRef(activeId);
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const itemKeys = useMemo(() => items.map(item => item.key), [items]);
  useEffect(() => {
    activeIdRef.current = itemKeys.includes(activeId) ? activeId : itemKeys[0] ?? '';
  }, [activeId, itemKeys]);

  const activeIndex = Math.max(0, itemKeys.indexOf(itemKeys.includes(activeId) ? activeId : itemKeys[0] ?? ''));
  const advance = useCallback((direction: 1 | -1 = 1) => {
    if (!interactiveRef.current || itemKeys.length < 2) return;
    const current = itemKeys.indexOf(activeIdRef.current);
    const from = current < 0 ? activeIndex : current;
    const next = itemKeys[(from + direction + itemKeys.length) % itemKeys.length];
    activeIdRef.current = next;
    onActiveIdChange(next);
  }, [activeIndex, itemKeys, onActiveIdChange]);

  const swipe = Gesture.Pan()
    .enabled(interactive && items.length > 1)
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .onEnd((event, success) => {
      if (!success || Math.abs(event.translationX) < 32 || Math.abs(event.translationX) <= Math.abs(event.translationY)) return;
      const direction: 1 | -1 = event.translationX < 0 ? 1 : -1;
      runOnJS(advance)(direction);
    });
  const tap = Gesture.Tap()
    .enabled(interactive && items.length > 1)
    .onEnd((_event, success) => { if (success) runOnJS(advance)(1); });
  const interaction = Gesture.Simultaneous(swipe, tap);

  const visibleItems = useMemo(() => {
    if (!items.length) return [];
    return Array.from({ length: items.length }, (_, stackPosition) => {
      // The prior prints stay tucked beneath the active print, so advancing one card
      // preserves the former hero as the first visible paper and keeps its native view mounted.
      const index = (activeIndex - stackPosition + items.length) % items.length;
      return { item: items[index], index, stackPosition, active: stackPosition === 0, visible: stackPosition < 3 };
    });
  }, [activeIndex, items]);

  return <View testID={testID} pointerEvents="box-none" style={styles.root}>
    {visibleItems.slice().reverse().map(({ item, index, stackPosition, active, visible }) => (
      <React.Fragment key={item.key}>{renderItem({ item, index, stackPosition, active, visible })}</React.Fragment>
    ))}
    {interactive && items.length > 1 ? <>
      <GestureDetector gesture={interaction}>
        <Animated.View testID={`${testID}-hit-target`} accessible accessibilityRole="button"
          accessibilityLabel={`Photo ${activeIndex + 1} of ${items.length}. Tap or swipe to browse.`}
          onAccessibilityTap={() => advance(1)} style={[styles.hitTarget, hitTargetStyle]} />
      </GestureDetector>
      <View pointerEvents="none" testID={`${testID}-count-wrap`} style={[styles.indicator, indicatorStyle]}>
        <Text testID={`${testID}-count`} style={styles.indicatorText}>{`${activeIndex + 1} of ${items.length}`}</Text>
      </View>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  hitTarget: { position: 'absolute', zIndex: 40 },
  indicator: { position: 'absolute', zIndex: 41, alignSelf: 'center', bottom: 26, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 12, backgroundColor: '#14162BCC' },
  indicatorText: { color: '#F4EDE0', fontFamily: 'Inter-Medium', fontSize: 10, letterSpacing: 0.4 },
});
