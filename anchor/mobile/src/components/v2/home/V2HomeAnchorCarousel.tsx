import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2';
import { v2Haptics } from '@/hooks/v2';
import { getCategoryColor } from '@/theme/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';

/** Brief-mandated proportions: one dominant object with dramatically secondary neighbours. */
export const HERO_ANCHOR_SIZE = 178;
export const NEIGHBOUR_ANCHOR_SIZE = 68;
const CONSTRUCTION_BOX = Math.round(HERO_ANCHOR_SIZE * 1.34);
const TRACK_HEIGHT = CONSTRUCTION_BOX;
/**
 * How far a neighbour hangs past the page inset. Slightly more than half of it
 * is cut off by the screen edge, so it peeks rather than sitting in the layout.
 */
const NEIGHBOUR_HANG = Math.round(NEIGHBOUR_ANCHOR_SIZE * 0.62);
/** Past this much horizontal travel the swipe commits to the next Anchor. */
const COMMIT_DISTANCE = 56;
const DRAG_RESISTANCE = 0.42;
const NEIGHBOUR_DRAG_RESISTANCE = 0.22;

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedIndex: number;
  onSelect: (anchorId: string) => void;
  onOpenActive?: (anchorId: string) => void;
  reduceMotion?: boolean;
  testID?: string;
};

/**
 * Restrained handmade construction strokes: two slightly imperfect, incomplete
 * circles struck off-centre from each other plus four tiny calibration ticks.
 * This is the only ornament around the Anchor — no halo, no rays, no symbols.
 */
function ConstructionStrokes({ color, size }: { color: string; size: number }) {
  const c = size / 2;
  // Struck clear of the artwork disc (radius 0.373 of this box) so they read as
  // construction lines around the Anchor, not as a rim on it.
  const outer = size * 0.452;
  const inner = size * 0.418;
  const tickGap = size * 0.478;
  const tick = size * 0.022;
  return (
    <Svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <G strokeLinecap="round" fill="none">
        {/* Struck first, left slightly open — a drawn circle, not a generated one. */}
        <Circle
          cx={c - size * 0.005}
          cy={c + size * 0.004}
          r={outer}
          stroke={color}
          strokeWidth={1.3}
          strokeOpacity={0.42}
          strokeDasharray={outer * 5.4 + ' ' + outer * 0.5}
          transform={'rotate(-24 ' + c + ' ' + c + ')'}
        />
        {/* The second pass does not quite land on the first. */}
        <Circle
          cx={c + size * 0.008}
          cy={c - size * 0.006}
          r={inner}
          stroke={color}
          strokeWidth={0.8}
          strokeOpacity={0.2}
          strokeDasharray={inner * 2.1 + ' ' + inner * 0.9 + ' ' + inner * 3.3 + ' ' + inner * 0.35}
          transform={'rotate(118 ' + c + ' ' + c + ')'}
        />
        {/* Calibration marks: cardinal, tiny, deliberately uneven. */}
        <Path d={'M ' + c + ' ' + (c - tickGap) + ' l 0 ' + -tick * 1.6} stroke={color} strokeOpacity={0.34} strokeWidth={1.2} />
        <Path d={'M ' + (c + tickGap) + ' ' + (c + size * 0.004) + ' l ' + tick * 1.3 + ' 0'} stroke={color} strokeOpacity={0.24} strokeWidth={1.1} />
        <Path d={'M ' + (c - size * 0.008) + ' ' + (c + tickGap) + ' l 0 ' + tick * 1.9} stroke={color} strokeOpacity={0.3} strokeWidth={1.1} />
        <Path d={'M ' + (c - tickGap) + ' ' + (c - size * 0.01) + ' l ' + -tick * 1.1 + ' 0'} stroke={color} strokeOpacity={0.18} strokeWidth={1} />
      </G>
    </Svg>
  );
}

/**
 * The Home hero: one central Anchor being physically swapped, with its
 * neighbours peeking in at the page edges. This replaces the old "Your Anchors"
 * rail — there is exactly one Anchor switcher on Home and it is this one.
 *
 * Switching is committed through `onSelect`, which writes to the shared
 * selected-Anchor authority, so every other Home module re-derives from the new
 * Anchor in the same render.
 */
export function V2HomeAnchorCarousel({ anchors, selectedIndex, onSelect, onOpenActive, reduceMotion = false, testID }: Props) {
  const drag = useRef(new Animated.Value(0)).current;
  const dragValue = useRef(0);
  const committing = useRef(false);

  const total = anchors.length;
  const index = selectedIndex >= 0 && selectedIndex < total ? selectedIndex : 0;
  const active = anchors[index];
  const previous = total > 1 ? anchors[(index - 1 + total) % total] : null;
  const next = total > 1 ? anchors[(index + 1) % total] : null;
  const canSwitch = total > 1;

  useEffect(() => {
    const listener = drag.addListener(({ value }) => {
      dragValue.current = value;
    });
    return () => drag.removeListener(listener);
  }, [drag]);

  // A new selection is a completed swap: the cluster returns to rest instantly
  // so the incoming Anchor is centred rather than sliding in from the old offset.
  useEffect(() => {
    committing.current = false;
    drag.setValue(0);
    dragValue.current = 0;
  }, [drag, active?.anchor.id]);

  const commit = useCallback(
    (direction: -1 | 1) => {
      if (!canSwitch || committing.current) return;
      const target = anchors[(index + direction + total) % total];
      if (!target) return;
      committing.current = true;
      v2Haptics.selection();
      /**
       * Return to rest before handing the selection over. The reset must not
       * depend on the incoming Anchor differing from the outgoing one —
       * otherwise a selection that does not move would strand the cluster
       * mid-swipe with gestures permanently blocked.
       */
      const settle = () => {
        drag.setValue(0);
        dragValue.current = 0;
        committing.current = false;
        onSelect(target.anchor.id);
      };
      if (reduceMotion) {
        settle();
        return;
      }
      Animated.timing(drag, {
        toValue: -direction * COMMIT_DISTANCE * 1.9,
        duration: 150,
        useNativeDriver: true,
      }).start(settle);
    },
    [anchors, canSwitch, drag, index, onSelect, reduceMotion, total],
  );

  /** A deliberate sideways drag, not the start of a vertical page scroll. */
  const horizontalIntent = useCallback(
    (gesture: { dx: number; dy: number }) =>
      canSwitch && Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    [canSwitch],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        /**
         * Capture phase: the hero artwork is a Pressable, which claims the
         * responder on touch-down. Without capturing, a horizontal drag that
         * starts on the artwork — the natural place to grab it — would never
         * reach this responder and the Anchor would not switch.
         */
        onMoveShouldSetPanResponderCapture: (_event, gesture) => horizontalIntent(gesture),
        onMoveShouldSetPanResponder: (_event, gesture) => horizontalIntent(gesture),
        // The vertical ScrollView must not be able to reclaim an active drag.
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          if (committing.current) return;
          drag.setValue(gesture.dx);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (committing.current) return;
          const travelled = gesture.dx;
          const flung = Math.abs(gesture.vx) > 0.45;
          if (travelled <= -COMMIT_DISTANCE || (flung && travelled < 0)) {
            commit(1);
            return;
          }
          if (travelled >= COMMIT_DISTANCE || (flung && travelled > 0)) {
            commit(-1);
            return;
          }
          // Physical resistance: it did not travel far enough, so it settles back.
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 5 }).start();
        },
      }),
    [canSwitch, commit, drag, horizontalIntent],
  );

  if (!active) return null;

  const activeColor = getCategoryColor(active.anchor.category);
  const heroTranslate = drag.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: [-240 * DRAG_RESISTANCE, 0, 240 * DRAG_RESISTANCE],
    extrapolate: 'clamp',
  });
  const heroScale = drag.interpolate({
    inputRange: [-COMMIT_DISTANCE * 2, 0, COMMIT_DISTANCE * 2],
    outputRange: [0.94, 1, 0.94],
    extrapolate: 'clamp',
  });
  const neighbourTranslate = drag.interpolate({
    inputRange: [-240, 0, 240],
    outputRange: [-240 * NEIGHBOUR_DRAG_RESISTANCE, 0, 240 * NEIGHBOUR_DRAG_RESISTANCE],
    extrapolate: 'clamp',
  });
  const previousOpacity = drag.interpolate({
    inputRange: [0, COMMIT_DISTANCE * 2],
    outputRange: [0.42, 0.78],
    extrapolate: 'clamp',
  });
  const nextOpacity = drag.interpolate({
    inputRange: [-COMMIT_DISTANCE * 2, 0],
    outputRange: [0.78, 0.42],
    extrapolate: 'clamp',
  });

  const renderNeighbour = (
    summary: V2HomeAnchorSummary,
    side: 'previous' | 'next',
    opacity: Animated.AnimatedInterpolation<number>,
  ) => (
    <Animated.View
      style={[
        styles.neighbour,
        side === 'previous' ? { left: -NEIGHBOUR_HANG } : { right: -NEIGHBOUR_HANG },
        { opacity, transform: [{ translateX: neighbourTranslate }] },
      ]}
    >
      <Pressable
        testID={`v2-home-carousel-${side}`}
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${summary.anchor.intentionText}`}
        hitSlop={10}
        onPress={() => commit(side === 'previous' ? -1 : 1)}
      >
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(summary.anchor)}
          category={summary.anchor.category}
          size={NEIGHBOUR_ANCHOR_SIZE}
          appearance="tinted"
          state="inactive"
          accessibilityLabel={`${categoryLabel(summary.anchor.category)} Anchor`}
        />
      </Pressable>
    </Animated.View>
  );

  return (
    <View
      testID={testID}
      style={styles.track}
      /**
       * A swipe is not available to a screen reader, so the track also exposes
       * the switch as adjustable actions. It is deliberately NOT marked
       * `accessible`: grouping the children would hide the neighbour buttons
       * and the hero's own "view details" action behind one opaque element.
       */
      accessibilityRole={canSwitch ? 'adjustable' : undefined}
      accessibilityActions={
        canSwitch
          ? [
              { name: 'increment', label: 'Next Anchor' },
              { name: 'decrement', label: 'Previous Anchor' },
            ]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') commit(1);
        else if (event.nativeEvent.actionName === 'decrement') commit(-1);
      }}
      {...(canSwitch ? panResponder.panHandlers : {})}
    >
      {previous ? renderNeighbour(previous, 'previous', previousOpacity) : null}
      {next ? renderNeighbour(next, 'next', nextOpacity) : null}

      <Animated.View style={[styles.hero, { transform: [{ translateX: heroTranslate }, { scale: heroScale }] }]}>
        <View style={styles.construction} pointerEvents="none">
          <ConstructionStrokes color={activeColor} size={CONSTRUCTION_BOX} />
        </View>
        <Pressable
          testID="v2-home-carousel-active"
          accessibilityRole="button"
          accessibilityLabel={`${active.anchor.intentionText}. ${categoryLabel(active.anchor.category)}. View Anchor details.`}
          onPress={() => onOpenActive?.(active.anchor.id)}
          disabled={!onOpenActive}
          style={({ pressed }) => (pressed && onOpenActive ? styles.pressed : undefined)}
        >
          <CircularAnchorRenderer
            svg={anchorArtworkSvg(active.anchor)}
            category={active.anchor.category}
            size={HERO_ANCHOR_SIZE}
            appearance="paper"
            accessibilityLabel={`${categoryLabel(active.anchor.category)} Anchor artwork`}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  /**
   * Explicitly sized to the construction box so the strokes and the artwork
   * share one centre. Sizing it from the artwork alone would let the absolutely
   * positioned strokes hang off one side and pull the hero off the page axis.
   */
  hero: {
    width: CONSTRUCTION_BOX,
    height: CONSTRUCTION_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  construction: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CONSTRUCTION_BOX,
    height: CONSTRUCTION_BOX,
  },
  neighbour: {
    position: 'absolute',
    top: (TRACK_HEIGHT - NEIGHBOUR_ANCHOR_SIZE) / 2,
  },
  pressed: {
    opacity: 0.88,
  },
});
