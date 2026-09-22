import React, { memo, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { AnchorMark } from '@/components/v2/anchor/AnchorMark';
import type { ExpressionSpec } from '@/components/v2/anchor/anchorExpressions';
import { v2Haptics } from '@/hooks/v2';
import { colors, typography } from '@/theme/v2';
import { RAIL, railDragPosition, railRestIndex } from './creationMotion';

const RailItem = memo(function RailItem({
  spec,
  index,
  position,
  center,
  svg,
  category,
  onPress,
}: {
  spec: ExpressionSpec;
  index: number;
  position: SharedValue<number>;
  center: number;
  svg: string;
  category?: string | null;
  onPress: (index: number) => void;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(index - position.value);
    return {
      opacity: interpolate(distance, [0, 1, 3], [1, 0.52, 0.22], 'clamp'),
      transform: [
        { translateX: center + (index - position.value) * RAIL.itemWidth - RAIL.itemWidth / 2 },
        { scale: interpolate(distance, [0, 1], [1, 0.8], 'clamp') },
      ],
    };
  });
  return (
    <Animated.View style={[styles.item, style]}>
      <Pressable
        onPress={() => onPress(index)}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.itemPress}
        hitSlop={6}
        testID={`expression-rail-item-${spec.id}`}
      >
        <AnchorMark svg={svg} category={category} expression={spec.id} size={RAIL.thumbSize} />
      </Pressable>
    </Animated.View>
  );
});

/**
 * The expression rail. The finger moves the rail 1:1; the large Anchor above follows the same
 * shared position continuously. Release carries the flick's velocity into a spring that rests
 * on an expression; a light detent marks each expression passing the centre.
 *
 * `onSelect` is the commit — called once the rail has decided where it will rest, never per
 * frame.
 */
export function ExpressionRail({
  specs,
  position,
  svg,
  category,
  disabled,
  reduceMotion,
  onSelect,
}: {
  specs: readonly ExpressionSpec[];
  position: SharedValue<number>;
  svg: string;
  category?: string | null;
  disabled?: boolean;
  reduceMotion: boolean;
  onSelect: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(() => Math.round(position.value));
  const start = useSharedValue(0);
  const count = specs.length;
  const center = width / 2;

  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);

  // The label and the detent follow the item under the centre as the rail moves.
  useAnimatedReaction(
    () => Math.min(count - 1, Math.max(0, Math.round(position.value))),
    (current, previous) => {
      if (previous === null || current === previous) return;
      runOnJS(setFocused)(current);
      runOnJS(v2Haptics.selection)();
    },
    [count],
  );

  /** JS-thread move (tap, accessibility). The commit does not wait for the spring. */
  const moveTo = useCallback(
    (index: number) => {
      if (disabled) return;
      const target = Math.min(count - 1, Math.max(0, index));
      if (reduceMotion) {
        position.value = target;
      } else {
        position.value = withSpring(target, RAIL.spring);
      }
      setFocused(target);
      onSelect(target);
    },
    [count, disabled, onSelect, position, reduceMotion],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled && count > 1)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      cancelAnimation(position);
      start.value = position.value;
    })
    .onUpdate((event) => {
      position.value = railDragPosition(start.value, event.translationX, count);
    })
    .onEnd((event) => {
      const target = railRestIndex(position.value, event.velocityX, count);
      position.value = reduceMotion
        ? target
        : withSpring(target, { ...RAIL.spring, velocity: -event.velocityX / RAIL.itemWidth });
      runOnJS(onSelect)(target);
    });

  const current = specs[focused] ?? specs[0];

  return (
    <View style={styles.root}>
      <View style={styles.label} accessibilityLiveRegion="polite">
        <Text style={styles.name} testID="expression-name">{current.label}</Text>
        <Text style={styles.description}>{current.description}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Expression"
          accessibilityValue={{ text: `${current.label}. ${focused + 1} of ${count}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') moveTo(focused + 1);
            if (event.nativeEvent.actionName === 'decrement') moveTo(focused - 1);
          }}
          testID="expression-rail"
        >
          {/* A fixed lens the rail moves beneath: the expression resting in it is the one kept. */}
          <View pointerEvents="none" style={styles.lens} />
          {width > 0
            ? specs.map((spec, index) => (
                <RailItem key={spec.id} spec={spec} index={index} position={position} center={center} svg={svg} category={category} onPress={moveTo} />
              ))
            : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const TRACK_HEIGHT = RAIL.thumbSize + 26;

const styles = StyleSheet.create({
  root: { gap: 10 },
  label: { alignItems: 'center', gap: 2, minHeight: 40 },
  name: { ...typography.headingSM, color: colors.text.primary },
  description: { ...typography.caption, color: colors.text.secondary },
  track: { height: TRACK_HEIGHT, justifyContent: 'center', overflow: 'hidden' },
  item: { position: 'absolute', left: 0, top: 0, width: RAIL.itemWidth, height: TRACK_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemPress: { width: RAIL.itemWidth, height: TRACK_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  lens: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 3,
    width: 22,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.text.primary,
  },
});
