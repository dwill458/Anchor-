import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2';
import { v2Haptics } from '@/hooks/v2';
import { AnchorMotion, getCategoryColor } from '@/theme/v2';
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
const MAX_DRAG_DISTANCE = 240;
const FLICK_VELOCITY = 450;
type Direction = -1 | 1;

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
type NeighbourProps = {
  summary: V2HomeAnchorSummary;
  side: 'previous' | 'next';
  drag: SharedValue<number>;
  onCommit: (direction: Direction) => void;
};

function CarouselNeighbour({ summary, side, drag, onCommit }: NeighbourProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity =
      side === 'previous'
        ? interpolate(drag.value, [0, COMMIT_DISTANCE * 2], [0.42, 0.78], 'clamp')
        : interpolate(drag.value, [-COMMIT_DISTANCE * 2, 0], [0.78, 0.42], 'clamp');
    return {
      opacity,
      transform: [
        {
          translateX: interpolate(
            drag.value,
            [-MAX_DRAG_DISTANCE, 0, MAX_DRAG_DISTANCE],
            [-MAX_DRAG_DISTANCE * NEIGHBOUR_DRAG_RESISTANCE, 0, MAX_DRAG_DISTANCE * NEIGHBOUR_DRAG_RESISTANCE],
            'clamp',
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.neighbour,
        side === 'previous' ? { left: -NEIGHBOUR_HANG } : { right: -NEIGHBOUR_HANG },
        animatedStyle,
      ]}
    >
      <Pressable
        testID={`v2-home-carousel-${side}`}
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${summary.anchor.intentionText}`}
        hitSlop={10}
        onPress={() => onCommit(side === 'previous' ? -1 : 1)}
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
}

export function V2HomeAnchorCarousel({ anchors, selectedIndex, onSelect, onOpenActive, reduceMotion = false, testID }: Props) {
  const drag = useSharedValue(0);
  const committing = useSharedValue(false);

  const total = anchors.length;
  const index = selectedIndex >= 0 && selectedIndex < total ? selectedIndex : 0;
  const active = anchors[index];
  const previous = total > 1 ? anchors[(index - 1 + total) % total] : null;
  const next = total > 1 ? anchors[(index + 1) % total] : null;
  const canSwitch = total > 1;

  // A new selection is a completed swap: the cluster returns to rest instantly
  // so the incoming Anchor is centred rather than sliding in from the old offset.
  useEffect(() => {
    cancelAnimation(drag);
    committing.value = false;
    drag.value = 0;
  }, [active?.anchor.id, committing, drag]);

  /** This is the only UI-thread → JS boundary: one final selection commit. */
  const commitSelection = useCallback(
    (direction: Direction) => {
      const target = anchors[(index + direction + total) % total];
      if (!target) return;
      v2Haptics.selection();
      onSelect(target.anchor.id);
    },
    [anchors, index, onSelect, total],
  );

  const commit = useCallback(
    (direction: Direction) => {
      if (!canSwitch || committing.value) return;
      committing.value = true;
      if (reduceMotion) {
        drag.value = 0;
        commitSelection(direction);
        return;
      }
      drag.value = withTiming(
        -direction * COMMIT_DISTANCE * 1.9,
        { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.standard },
        (finished) => {
          if (finished) runOnJS(commitSelection)(direction);
        },
      );
    },
    [canSwitch, committing, commitSelection, drag, reduceMotion],
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwitch)
        // Let a vertical ScrollView keep vertical intent; claim deliberate swipes.
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          if (!committing.value) {
            drag.value = Math.max(-MAX_DRAG_DISTANCE, Math.min(MAX_DRAG_DISTANCE, event.translationX));
          }
        })
        .onEnd((event) => {
          if (committing.value) return;
          const travelled = event.translationX;
          const flung = Math.abs(event.velocityX) > FLICK_VELOCITY;
          const direction: Direction | null =
            travelled <= -COMMIT_DISTANCE || (flung && travelled < 0)
              ? 1
              : travelled >= COMMIT_DISTANCE || (flung && travelled > 0)
              ? -1
              : null;

          if (direction) {
            committing.value = true;
            if (reduceMotion) {
              drag.value = 0;
              runOnJS(commitSelection)(direction);
              return;
            }
            drag.value = withTiming(
              -direction * COMMIT_DISTANCE * 1.9,
              { duration: AnchorMotion.duration.quick, easing: AnchorMotion.easing.standard },
              (finished) => {
                if (finished) runOnJS(commitSelection)(direction);
              },
            );
            return;
          }

          drag.value = reduceMotion ? 0 : withSpring(0, AnchorMotion.spring.carousel);
        })
        .onFinalize(() => {
          if (!committing.value && drag.value !== 0) {
            drag.value = reduceMotion ? 0 : withSpring(0, AnchorMotion.spring.carousel);
          }
        }),
    [canSwitch, committing, commitSelection, drag, reduceMotion],
  );

  if (!active) return null;

  const activeColor = getCategoryColor(active.anchor.category);
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          drag.value,
          [-MAX_DRAG_DISTANCE, 0, MAX_DRAG_DISTANCE],
          [-MAX_DRAG_DISTANCE * DRAG_RESISTANCE, 0, MAX_DRAG_DISTANCE * DRAG_RESISTANCE],
          'clamp',
        ),
      },
      {
        scale: interpolate(drag.value, [-COMMIT_DISTANCE * 2, 0, COMMIT_DISTANCE * 2], [0.94, 1, 0.94], 'clamp'),
      },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
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
      >
        {previous ? <CarouselNeighbour summary={previous} side="previous" drag={drag} onCommit={commit} /> : null}
        {next ? <CarouselNeighbour summary={next} side="next" drag={drag} onCommit={commit} /> : null}

        <Animated.View style={[styles.hero, heroStyle]}>
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
    </GestureDetector>
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
