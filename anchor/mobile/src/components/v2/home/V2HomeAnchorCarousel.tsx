import React, { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
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

/**
 * Gesture feel.
 *
 * The Anchor is a physical object under the thumb, so up to the decision point
 * it tracks the finger 1:1. Only PAST that point does it resist, which is what
 * communicates "this is as far as it goes without committing". Applying a flat
 * fraction to the whole drag (the previous behaviour) made even the first
 * millimetre lag the finger, which reads as dropped frames rather than weight.
 */
/** Past this much finger travel the swipe commits to the next Anchor. */
const COMMIT_DISTANCE = 56;
/** Resistance applied only beyond `COMMIT_DISTANCE`. */
const RUBBER_BAND = 0.34;
/** Neighbours track a fraction of the hero so the cluster moves as one object. */
const NEIGHBOUR_TRACKING = 0.22;
const MAX_DRAG_DISTANCE = 240;
/**
 * A release is judged on where the Anchor is HEADED, not only where it is: the
 * thrown distance is the travel plus this many seconds of the release velocity.
 * One projected threshold replaces the old distance-OR-velocity pair, which
 * committed on a 2px twitch as long as the flick was fast enough.
 */
const VELOCITY_PROJECTION = 0.12;
/** A twitch under this much travel is never a swipe, however fast it was. */
const MIN_COMMIT_TRAVEL = 14;

/**
 * Swap choreography.
 *
 * A committed swap is: the outgoing Anchor leaves in the direction of the
 * thumb and dims, the cluster is replaced while it is dim and off-centre, and
 * the incoming Anchor springs in from the opposite edge. The dim is what makes
 * the replacement invisible - it covers both the jump back across the track
 * and the Home re-render that lands on the same frame.
 */
const EXIT_DISTANCE = 72;
const ENTER_DISTANCE = 52;
const SWAP_DIM = 0.18;
const SWAP_FADE_OUT_MS = 130;
const SWAP_FADE_IN_MS = 190;
/** Leaving is decisive and must not overshoot back towards the centre. */
const EXIT_SPRING = {
  damping: 30,
  stiffness: 340,
  mass: 0.7,
  overshootClamping: true,
  restDisplacementThreshold: 1.5,
  restSpeedThreshold: 30,
} as const;

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
 * 1:1 under the finger, resisting only past the point where a swipe commits.
 * Exported so the feel can be asserted directly; the gesture itself is not
 * reachable from a unit test.
 */
export function trackFinger(translationX: number): number {
  'worklet';
  const clamped = Math.max(-MAX_DRAG_DISTANCE, Math.min(MAX_DRAG_DISTANCE, translationX));
  const magnitude = Math.abs(clamped);
  if (magnitude <= COMMIT_DISTANCE) return clamped;
  const sign = clamped < 0 ? -1 : 1;
  return sign * (COMMIT_DISTANCE + (magnitude - COMMIT_DISTANCE) * RUBBER_BAND);
}

/**
 * Which way a release commits, if at all.
 *
 * A release is judged on where the Anchor is HEADED: travel plus a short
 * projection of the release velocity. A slow deliberate drag therefore commits
 * on distance alone, a flick commits early because it is clearly thrown, and a
 * fast twitch that never really moved is rejected by the travel floor. The
 * previous distance-OR-velocity pair had no floor and committed on a 2px
 * movement as long as it was quick.
 *
 * Positive travel means the finger went right, which selects the PREVIOUS
 * Anchor, so the returned direction is the opposite sign of the projection.
 */
export function resolveSwipeCommit(translationX: number, velocityX: number): Direction | null {
  'worklet';
  if (Math.abs(translationX) < MIN_COMMIT_TRAVEL) return null;
  const projected = translationX + velocityX * VELOCITY_PROJECTION;
  if (Math.abs(projected) < COMMIT_DISTANCE) return null;
  return projected < 0 ? 1 : -1;
}

/**
 * Restrained handmade construction strokes: two slightly imperfect, incomplete
 * circles struck off-centre from each other plus four tiny calibration ticks.
 * This is the only ornament around the Anchor - no halo, no rays, no symbols.
 *
 * Memoised because it is a six-node SVG tree that only ever changes when the
 * category colour does; without this it was rebuilt on every carousel render.
 */
const ConstructionStrokes = memo(function ConstructionStrokes({ color, size }: { color: string; size: number }) {
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
        {/* Struck first, left slightly open - a drawn circle, not a generated one. */}
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
});

/**
 * The Home hero: one central Anchor being physically swapped, with its
 * neighbours peeking in at the page edges. This replaces the old "Your Anchors"
 * rail - there is exactly one Anchor switcher on Home and it is this one.
 *
 * Switching is committed through `onSelect`, which writes to the shared
 * selected-Anchor authority, so every other Home module re-derives from the new
 * Anchor in the same render.
 */
type NeighbourProps = {
  summary: V2HomeAnchorSummary;
  side: 'previous' | 'next';
  drag: SharedValue<number>;
  swapOpacity: SharedValue<number>;
  onCommit: (direction: Direction) => void;
};

/**
 * Memoised on its own props. The parent re-renders whenever Home does, and a
 * neighbour that re-renders re-registers its animated-style worklet for no
 * reason - the artwork only actually changes when the selection does.
 */
const CarouselNeighbour = memo(function CarouselNeighbour({ summary, side, drag, swapOpacity, onCommit }: NeighbourProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const reveal =
      side === 'previous'
        ? interpolate(drag.value, [0, COMMIT_DISTANCE], [0.42, 0.78], 'clamp')
        : interpolate(drag.value, [-COMMIT_DISTANCE, 0], [0.78, 0.42], 'clamp');
    return {
      opacity: reveal * swapOpacity.value,
      transform: [{ translateX: drag.value * NEIGHBOUR_TRACKING }],
    };
  });

  const handlePress = useCallback(() => onCommit(side === 'previous' ? -1 : 1), [onCommit, side]);

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
        onPress={handlePress}
      >
        <CircularAnchorRenderer
          svg={anchorArtworkSvg(summary.anchor)}
          imageUrl={summary.anchor.enhancedImageUrl}
          category={summary.anchor.category}
          size={NEIGHBOUR_ANCHOR_SIZE}
          appearance="tinted"
          state="inactive"
          accessibilityLabel={`${categoryLabel(summary.anchor.category)} Anchor`}
        />
      </Pressable>
    </Animated.View>
  );
});

function V2HomeAnchorCarouselComponent({ anchors, selectedIndex, onSelect, onOpenActive, reduceMotion = false, testID }: Props) {
  /** The RENDERED horizontal offset of the cluster, not the raw finger travel. */
  const drag = useSharedValue(0);
  const swapOpacity = useSharedValue(1);
  /** Guards the UI thread against a second swipe landing mid-swap. */
  const committing = useSharedValue(false);
  /**
   * The direction of a swap this component started, read back on the JS thread
   * once React has re-rendered with the new Anchor. A shared value cannot be
   * used for this: UI-thread writes reach the JS copy asynchronously, so the
   * entrance would read a stale flag.
   */
  const pendingDirection = useRef<Direction | null>(null);

  const total = anchors.length;
  const index = selectedIndex >= 0 && selectedIndex < total ? selectedIndex : 0;
  const active = anchors[index];
  const previous = total > 1 ? anchors[(index - 1 + total) % total] : null;
  const next = total > 1 ? anchors[(index + 1) % total] : null;
  const canSwitch = total > 1;
  const activeId = active?.anchor.id;

  /** This is the only UI-thread -> JS boundary: one final selection commit. */
  const commitSelection = useCallback(
    (direction: Direction) => {
      const target = anchors[(index + direction + total) % total];
      /**
       * If there is nothing to swap to - or the "next" Anchor is the one
       * already showing - the entrance effect will never fire, because it is
       * keyed on the active Anchor changing. Release the track here instead of
       * leaving it guarded and frozen.
       */
      if (!target || target.anchor.id === activeId) {
        pendingDirection.current = null;
        committing.value = false;
        drag.value = withSpring(0, AnchorMotion.spring.carousel);
        swapOpacity.value = withTiming(1, { duration: SWAP_FADE_IN_MS, easing: AnchorMotion.easing.enter });
        return;
      }
      pendingDirection.current = direction;
      v2Haptics.selection();
      onSelect(target.anchor.id);
    },
    [activeId, anchors, committing, drag, index, onSelect, swapOpacity, total],
  );

  /**
   * The JS-thread entry into a swap: neighbour taps and screen-reader actions.
   * It calls `commitSelection` directly rather than through `runOnJS`, which
   * off the UI thread is asynchronous and would drop the call entirely in the
   * reduced-motion path.
   */
  const commit = useCallback(
    (direction: Direction) => {
      if (committing.value) return;
      committing.value = true;
      if (reduceMotion) {
        drag.value = 0;
        swapOpacity.value = 1;
        commitSelection(direction);
        return;
      }
      // Kept in step with the gesture's own exit below. The two are written
      // out rather than shared because a JS callback threaded through an extra
      // worklet hop is the one part of this that Reanimated does not make
      // obvious, and the choreography is eight lines.
      swapOpacity.value = withTiming(SWAP_DIM, {
        duration: SWAP_FADE_OUT_MS,
        easing: AnchorMotion.easing.exit,
      });
      drag.value = withSpring(-direction * EXIT_DISTANCE, EXIT_SPRING, (finished) => {
        if (finished) runOnJS(commitSelection)(direction);
      });
    },
    [commitSelection, committing, drag, reduceMotion, swapOpacity],
  );

  /**
   * The entrance.
   *
   * `useLayoutEffect` rather than `useEffect` so the incoming artwork is placed
   * on the far edge before it is ever painted - a passive effect would show it
   * for one frame where the OLD Anchor left.
   *
   * Deliberately un-keyed: it runs after every render and exits immediately
   * unless something is actually owed. Keying it on the active Anchor alone
   * left a failure mode where a commit that did not change the selection
   * stranded the hero dimmed and off-centre, because the effect that clears
   * the swap would never fire.
   */
  const settledActiveId = useRef(activeId);
  useLayoutEffect(() => {
    const direction = pendingDirection.current;
    const switched = settledActiveId.current !== activeId;
    if (!direction && !switched) return;

    settledActiveId.current = activeId;
    pendingDirection.current = null;
    cancelAnimation(drag);
    committing.value = false;

    if (!direction || reduceMotion) {
      // An external selection change (deep link, another screen) is not a
      // swipe: the new Anchor is simply already centred.
      drag.value = 0;
      swapOpacity.value = 1;
      return;
    }

    // Placed on the edge the incoming Anchor arrives from. This happens while
    // the cluster is dimmed, so the jump back across the track - and the Home
    // re-render that lands on the same frame - are both invisible.
    drag.value = direction * ENTER_DISTANCE;
    drag.value = withSpring(0, AnchorMotion.spring.carousel);
    swapOpacity.value = withTiming(1, { duration: SWAP_FADE_IN_MS, easing: AnchorMotion.easing.enter });
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwitch)
        /**
         * Both thresholds are deliberately small: the sooner the pan claims the
         * touch, the sooner the Anchor is attached to the finger. The RATIO is
         * what protects the vertical ScrollView, and it is kept close to its
         * previous value so a deliberate scroll still wins.
         */
        .activeOffsetX([-6, 6])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          if (committing.value) return;
          drag.value = trackFinger(event.translationX);
        })
        .onEnd((event) => {
          if (committing.value) return;
          const direction = resolveSwipeCommit(event.translationX, event.velocityX);

          if (direction) {
            committing.value = true;
            if (reduceMotion) {
              drag.value = 0;
              swapOpacity.value = 1;
              runOnJS(commitSelection)(direction);
              return;
            }
            swapOpacity.value = withTiming(SWAP_DIM, {
              duration: SWAP_FADE_OUT_MS,
              easing: AnchorMotion.easing.exit,
            });
            // The release velocity carries into the exit, so a flick keeps
            // moving at the speed the thumb left it.
            drag.value = withSpring(
              -direction * EXIT_DISTANCE,
              { ...EXIT_SPRING, velocity: event.velocityX },
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
    [canSwitch, commitSelection, committing, drag, reduceMotion, swapOpacity],
  );

  /**
   * One animated wrapper over an otherwise static subtree. Only transform and
   * opacity are driven; nothing here animates a layout property.
   */
  const clusterStyle = useAnimatedStyle(() => ({
    opacity: swapOpacity.value,
    transform: [
      { translateX: drag.value },
      {
        scale: interpolate(drag.value, [-EXIT_DISTANCE, 0, EXIT_DISTANCE], [0.92, 1, 0.92], 'clamp'),
      },
    ],
  }));

  const accessibilityActions = useMemo(
    () =>
      canSwitch
        ? [
            { name: 'increment', label: 'Next Anchor' },
            { name: 'decrement', label: 'Previous Anchor' },
          ]
        : undefined,
    [canSwitch],
  );

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === 'increment') commit(1);
      else if (event.nativeEvent.actionName === 'decrement') commit(-1);
    },
    [commit],
  );

  const handleOpenActive = useCallback(() => {
    if (activeId) onOpenActive?.(activeId);
  }, [activeId, onOpenActive]);

  const pressedStyle = useCallback(
    ({ pressed }: { pressed: boolean }) => (pressed && onOpenActive ? styles.pressed : undefined),
    [onOpenActive],
  );

  if (!active) return null;

  const activeColor = getCategoryColor(active.anchor.category);

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
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
      >
        {previous ? <CarouselNeighbour summary={previous} side="previous" drag={drag} swapOpacity={swapOpacity} onCommit={commit} /> : null}
        {next ? <CarouselNeighbour summary={next} side="next" drag={drag} swapOpacity={swapOpacity} onCommit={commit} /> : null}

        <Animated.View style={[styles.hero, clusterStyle]}>
          <View style={styles.construction} pointerEvents="none">
            <ConstructionStrokes color={activeColor} size={CONSTRUCTION_BOX} />
          </View>
          <Pressable
            testID="v2-home-carousel-active"
            accessibilityRole="button"
            accessibilityLabel={`${active.anchor.intentionText}. ${categoryLabel(active.anchor.category)}. View Anchor details.`}
            onPress={handleOpenActive}
            disabled={!onOpenActive}
            style={pressedStyle}
          >
            <CircularAnchorRenderer
              svg={anchorArtworkSvg(active.anchor)}
              imageUrl={active.anchor.enhancedImageUrl}
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

/**
 * Memoised against the Home tree. Home re-renders whenever Today, Vision,
 * Chart or Progress resolves; none of that changes the Anchor being dragged,
 * and a re-render here re-registers every animated-style worklet on the
 * track. With stable props the carousel now renders only when the selection
 * or the Anchor list itself changes.
 */
export const V2HomeAnchorCarousel = memo(V2HomeAnchorCarouselComponent);
