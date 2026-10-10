import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useV2ReduceMotion } from '@/hooks/v2';

export interface VisionPhotoStackItem { key: string }
export interface VisionPhotoStackRenderItem<T extends VisionPhotoStackItem> {
  item: T; index: number; stackPosition: number; active: boolean; visible: boolean;
}
export interface VisionPhotoStackProps<T extends VisionPhotoStackItem> {
  items: readonly T[]; activeId: string; onActiveIdChange: (id: string) => void;
  interactive?: boolean; hitTargetStyle: StyleProp<ViewStyle>; indicatorStyle?: StyleProp<ViewStyle>;
  cardWidth?: number; renderItem: (item: VisionPhotoStackRenderItem<T>) => React.ReactNode; testID?: string;
}
export const VISION_PAGER_SPRING = { damping: 18, stiffness: 180, mass: 1 };
export function nearestVisionCard(offset: number, stride: number, count: number) {
  'worklet';
  return Math.max(0, Math.min(count - 1, Math.floor(-offset / stride + 0.5)));
}
function PaperCard({ index, offset, stride, browsing, active, originY, children }: {
  index: number; offset: SharedValue<number>; stride: number; browsing: boolean; active: boolean; originY: number; children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const distance = browsing ? index + offset.value / stride : 0;
    const weight = Math.min(1, Math.abs(distance));
    return { zIndex: browsing ? 30 - weight : active ? 40 : 30 - index, opacity: 1 - weight * .2, transform: [
      { translateX: browsing ? index * stride + offset.value : 0 },
      { scale: 1 - weight * .06 }, { rotate: `${Math.max(-1, Math.min(1, distance)) * 2.5}deg` },
    ] };
  });
  return <Animated.View pointerEvents="box-none" style={[styles.root, { transformOrigin: ['50%', originY, 0] }, style]}>{children}</Animated.View>;
}

/** All paper cards travel on one UI-thread offset; changing the active caption never resets the drag. */
export function VisionPhotoStack<T extends VisionPhotoStackItem>({ items, activeId, onActiveIdChange,
  hitTargetStyle, indicatorStyle, renderItem, interactive = true, cardWidth = 240, testID = 'vision-photo-stack',
}: VisionPhotoStackProps<T>) {
  const reduced = useV2ReduceMotion();
  const activeIndex = Math.max(0, items.findIndex(item => item.key === activeId));
  // Half a full-size card plus half a 0.94 neighbour, with 18pt of visible paper-to-paper space.
  const stride = cardWidth * .97 + 18;
  const offset = useSharedValue(-activeIndex * stride), origin = useSharedValue(0), dragging = useSharedValue(false);
  const published = useSharedValue(activeIndex);
  const previousStride = useRef(stride);
  const keys = items.map(item => item.key);
  const select = (index: number) => { if (interactive && keys[index]) onActiveIdChange(keys[index]); };
  useEffect(() => {
    if (!dragging.value && (published.value !== activeIndex || previousStride.current !== stride)) {
      offset.value = reduced ? -activeIndex * stride : withSpring(-activeIndex * stride, VISION_PAGER_SPRING); published.value = activeIndex;
    }
    previousStride.current = stride;
  }, [activeId, stride, interactive, reduced]);
  useAnimatedReaction(() => nearestVisionCard(offset.value, stride, items.length), index => {
    if (dragging.value && index !== published.value) { published.value = index; runOnJS(select)(index); }
  }, [keys.join('|'), interactive, stride]);
  const pan = Gesture.Pan().enabled(interactive && items.length > 1).activeOffsetX([-8, 8]).failOffsetY([-14, 14])
    .onStart(() => { cancelAnimation(offset); dragging.value = true; origin.value = offset.value; })
    .onUpdate(event => { offset.value = Math.max(-(items.length - 1) * stride, Math.min(0, origin.value + event.translationX)); })
    .onEnd((event, success) => {
      const index = nearestVisionCard(offset.value, stride, items.length);
      published.value = index;
      if (success) runOnJS(select)(index);
      offset.value = reduced ? -index * stride : withSpring(-index * stride, { ...VISION_PAGER_SPRING, velocity: success ? event.velocityX : 0 });
    }).onFinalize(() => { dragging.value = false; });
  const advance = (index: number) => {
    if (!interactive || !keys[index]) return;
    published.value = index;
    offset.value = reduced ? -index * stride : withSpring(-index * stride, VISION_PAGER_SPRING);
    onActiveIdChange(keys[index]);
  };
  const hit = StyleSheet.flatten(hitTargetStyle) ?? {};
  const originY = Number(hit.top ?? 0) + Number(hit.height ?? 0) / 2;
  return <View testID={testID} pointerEvents="box-none" style={styles.root}>
    {items.map((item, index) => <PaperCard key={item.key} index={index} offset={offset} stride={stride}
      browsing={interactive && items.length > 1} active={index === activeIndex} originY={originY}>
      {renderItem({ item, index, stackPosition: (activeIndex - index + items.length) % items.length,
        active: index === activeIndex, visible: true })}
    </PaperCard>)}
    {interactive && items.length > 1 ? <>
      <GestureDetector gesture={pan}><Animated.View testID={`${testID}-hit-target`} accessible accessibilityRole="adjustable"
        accessibilityLabel={`Photo ${activeIndex + 1} of ${items.length}. Swipe to browse.`}
        accessibilityValue={{ min: 1, max: items.length, now: activeIndex + 1 }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => advance(activeIndex + (event.nativeEvent.actionName === 'decrement' ? -1 : 1))}
        onAccessibilityTap={() => advance((activeIndex + 1) % items.length)} style={[styles.hitTarget, hitTargetStyle]} /></GestureDetector>
      <View testID={`${testID}-dots`} style={[styles.indicator, indicatorStyle]}>
        {items.map((item, index) => <Pressable key={item.key} testID={`${testID}-dot-${index}`} accessibilityRole="button"
          accessibilityLabel={`Show photo ${index + 1}`} accessibilityState={{ selected: index === activeIndex }}
          onPress={() => advance(index)} style={styles.dotTarget}><View style={[styles.dot, index === activeIndex && styles.activeDot]} /></Pressable>)}
      </View>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject }, hitTarget: { position: 'absolute', zIndex: 40 },
  indicator: { position: 'absolute', zIndex: 41, alignSelf: 'center', flexDirection: 'row', bottom: 26 },
  dotTarget: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1, borderColor: '#F4EDE0' }, activeDot: { backgroundColor: '#F4EDE0' },
});
