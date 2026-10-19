import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';
import { v2Haptics } from '@/hooks/v2';
import { AnchorMotion } from '@/theme/v2';
import { VisualProfiler } from '@/utils/visualProfiler';

export const HERO_ANCHOR_SIZE = 154;
export const NEIGHBOUR_ANCHOR_SIZE = 68;
/** Resting scale of a neighbour and how much of it stays on screen (fraction of its width). */
export const NEIGHBOUR_SCALE = 0.72;
const PEEK_FRACTION = 0.14;
const MOUNT_PADDING = 14;
const COMMIT_DISTANCE = 40;
const MIN_COMMIT_TRAVEL = 10;
const VELOCITY_PROJECTION = 0.12;
const RUBBER_BAND = 0.25;
/** How long the carousel must rest before Home's anchor-scoped content follows it. */
export const COMMIT_DELAY_MS = 140;
type Direction = -1 | 1;
export type CarouselSlot = -1 | 0 | 1;
/** The mounted window around the centre. The outer pair sit off-screen, ready for a chained flick. */
type TrackPosition = -2 | -1 | 0 | 1 | 2;
/** Render order: the centre goes last so it sits above its neighbours. */
const TRACK_POSITIONS: TrackPosition[] = [-2, 2, -1, 1, 0];

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedIndex: number;
  onSelect: (anchorId: string) => void;
  onOpenActive?: (anchorId: string) => void;
  reduceMotion?: boolean;
  testID?: string;
  /** A complete hero, including its own text, colour and Thread Strength. */
  renderHero?: (summary: V2HomeAnchorSummary, index: number, slot: CarouselSlot, offset: SharedValue<number>, spacing: number) => React.ReactNode;
  heroHeight?: number;
  /** Centre Anchor size, used to derive how far neighbours sit off-screen. */
  anchorSize?: number;
  frozen?: boolean;
  /** True from the start of a drag or tap until the carousel rests and its selection is committed. */
  onMotionChange?: (moving: boolean) => void;
  /**
   * Fires the instant the track rests on an Anchor (`true`, before the deferred selection commit)
   * and again as soon as a new drag or tap begins (`false`). Lets ambient effects start on the
   * authoritative settle instead of waiting for the commit round-trip.
   */
  onCentered?: (centered: boolean) => void;
};

/** Centre-to-centre distance that leaves PEEK_FRACTION of a neighbour inside the screen edge. */
export function carouselSpacing(screenWidth: number, anchorSize: number): number {
  const neighbourWidth = (anchorSize + MOUNT_PADDING) * NEIGHBOUR_SCALE;
  return screenWidth / 2 + neighbourWidth * (0.5 - PEEK_FRACTION);
}

/**
 * The whole carousel geometry as pure data, so centring and edge symmetry can be
 * asserted at any width. Slot centres sit at `trackWidth / 2 + slot * spacing`;
 * the track must therefore span the full viewport and be symmetric about it.
 */
export function carouselGeometry(trackWidth: number, anchorSize: number) {
  const spacing = carouselSpacing(trackWidth, anchorSize);
  const neighbourWidth = (anchorSize + MOUNT_PADDING) * NEIGHBOUR_SCALE;
  const slotCenterX = (slot: CarouselSlot) => trackWidth / 2 + slot * spacing;
  return {
    spacing,
    neighbourWidth,
    activeCenterX: slotCenterX(0),
    slotCenterX,
    /** Neighbour width visible inside the left and right screen edges. */
    leftExposure: Math.max(0, slotCenterX(-1) + neighbourWidth / 2),
    rightExposure: Math.max(0, trackWidth - (slotCenterX(1) - neighbourWidth / 2)),
  };
}

/** 1:1 with the finger up to one slot, then resisted so the strip never leaves its window. */
export function trackFinger(translationX: number, spacing: number): number {
  'worklet';
  const magnitude = Math.abs(translationX);
  if (magnitude <= spacing) return translationX;
  return Math.sign(translationX) * (spacing + Math.min(magnitude - spacing, spacing) * RUBBER_BAND);
}

export function resolveSwipeCommit(translationX: number, velocityX: number): Direction | null {
  'worklet';
  if (Math.abs(translationX) < MIN_COMMIT_TRAVEL) return null;
  const projected = translationX + velocityX * VELOCITY_PROJECTION;
  if (Math.abs(projected) < COMMIT_DISTANCE) return null;
  return projected < 0 ? 1 : -1;
}

// DEFERRED: the carousel no longer rotates a three-item window; it keys a
// continuous virtual track (see `dataIndex`). Kept exported for its callers and tests.
export function carouselWindow(total: number, index: number): [number, number, number] {
  if (total < 1) return [-1, -1, -1];
  return [(index - 1 + total) % total, index, (index + 1) % total];
}

/** The Anchor a virtual track index shows. The track is unbounded; the list wraps. */
export function dataIndex(virtualIndex: number, total: number): number {
  'worklet';
  if (total < 1) return 0;
  return ((virtualIndex % total) + total) % total;
}

/** One release never travels more than one Anchor past where the track was already headed. */
export function clampStep(next: number, target: number): number {
  'worklet';
  return Math.max(target - 1, Math.min(target + 1, next));
}

/** The virtual index nearest `center` that shows `index`, so an outside selection never travels the track. */
export function nearestVirtualIndex(center: number, index: number, total: number): number {
  if (total < 1) return center;
  const base = center - dataIndex(center, total) + index;
  return [base - total, base, base + total].reduce((best, candidate) =>
    (Math.abs(candidate - center) < Math.abs(best - center) ? candidate : best));
}

function DefaultHero({ summary, active, onOpen }: { summary: V2HomeAnchorSummary; active: boolean; onOpen?: () => void }) {
  return (
    <Pressable
      testID={active ? 'v2-home-carousel-active' : undefined}
      accessibilityRole={active ? 'button' : undefined}
      onPress={onOpen}
      disabled={!active || !onOpen}
    >
      <CircularAnchorRenderer
        {...anchorRenderProps(summary.anchor)}
        size={HERO_ANCHOR_SIZE}
        appearance="paper"
        accessibilityLabel={`${categoryLabel(summary.anchor.category)} Anchor artwork`}
      />
    </Pressable>
  );
}

const TrackSlot = memo(function TrackSlot({
  summary, index, virtualIndex, trackPosition, position, spacing, anchorSize, renderHero, onPress, onOpenActive,
}: {
  summary: V2HomeAnchorSummary;
  index: number;
  virtualIndex: number;
  trackPosition: TrackPosition;
  position: SharedValue<number>;
  spacing: number;
  anchorSize: number;
  renderHero?: Props['renderHero'];
  onPress: (direction: Direction) => void;
  onOpenActive?: (anchorId: string) => void;
}) {
  // The outer pair present as neighbours: never active, never pressable.
  const slot = Math.max(-1, Math.min(1, trackPosition)) as CarouselSlot;
  const outer = slot !== trackPosition;
  // Physical x depends only on the continuous position, never on React's
  // centre, so recentring the mounted window cannot jump a frame.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (virtualIndex - position.value) * spacing }],
  }), [virtualIndex, spacing]);
  // `renderHero` reads `slot * spacing + offset.value` as physical x; this keeps that exact.
  const offset = useDerivedValue(() => (virtualIndex - position.value) * spacing - slot * spacing, [virtualIndex, slot, spacing]);
  const handleNeighbour = useCallback(() => onPress(slot as Direction), [onPress, slot]);
  const handleOpen = useCallback(() => onOpenActive?.(summary.anchor.id), [onOpenActive, summary.anchor.id]);
  return (
    <Animated.View style={[styles.slot, animatedStyle]} pointerEvents={outer ? 'none' : 'box-none'}
      // The outer pair are off-screen staging copies; assistive tech should only meet the visible three.
      accessibilityElementsHidden={outer} importantForAccessibility={outer ? 'no-hide-descendants' : 'auto'}>
      {renderHero ? renderHero(summary, index, slot, offset, spacing) : (
        <DefaultHero summary={summary} active={slot === 0} onOpen={handleOpen} />
      )}
      {slot !== 0 && !outer ? (
        <Pressable
          testID={`v2-home-carousel-${slot < 0 ? 'previous' : 'next'}`}
          // Tracks the coin's centre, which sits at half its diameter below the top of the slot.
          style={[styles.neighbourHit, { top: Math.round(anchorSize / 2) + 12 }]}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${summary.anchor.intentionText}`}
          onPress={handleNeighbour}
        />
      ) : null}
    </Animated.View>
  );
});

function V2HomeAnchorCarouselComponent({ anchors, selectedIndex, onSelect, onOpenActive, reduceMotion = false, renderHero, heroHeight, anchorSize = HERO_ANCHOR_SIZE, frozen = false, onMotionChange, onCentered, testID }: Props) {
  // The track is `width: 100%` of a full-bleed parent, and its geometry is
  // derived from its *measured* width. It must never inherit a page gutter, or
  // the slot centres (trackWidth / 2) stop matching the viewport centre and the
  // device edge stops being the crop. The window width is only the first-frame guess.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const width = measuredWidth ?? windowWidth;
  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setMeasuredWidth(previous => (previous !== null && Math.abs(previous - next) < 0.01 ? previous : next));
  }, []);
  const spacing = carouselSpacing(width, anchorSize);
  const total = anchors.length;
  const canSwitch = total > 1;
  const initialIndex = selectedIndex >= 0 && selectedIndex < total ? selectedIndex : 0;

  // One continuous track in virtual index units: unbounded and never reset.
  // `target` is the whole index the track is headed to. A flick that catches
  // the track mid-flight continues from it, which is what lets flicks chain.
  const position = useSharedValue(initialIndex);
  const target = useSharedValue(initialIndex);
  const dragStart = useSharedValue(initialIndex);
  const ended = useSharedValue(false);
  /** Swallows the detent tick when an outside selection relocates the track. */
  const relocating = useSharedValue(false);
  const frozenValue = useSharedValue(frozen);
  const [center, setCenter] = useState(initialIndex);

  const selectedId = anchors[selectedIndex]?.anchor.id;
  // Read by the deferred commit, which must see the props of the moment it fires.
  const latest = useRef({ anchors, onSelect, onMotionChange, onCentered, selectedId });
  latest.current = { anchors, onSelect, onMotionChange, onCentered, selectedId };
  const pendingId = useRef<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moving = useRef(false);

  const setMoving = useCallback((next: boolean) => {
    if (next) latest.current.onCentered?.(false);
    if (moving.current === next) return;
    moving.current = next;
    latest.current.onMotionChange?.(next);
  }, []);

  const cancelPendingCommit = useCallback(() => {
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = null;
  }, []);
  useEffect(() => cancelPendingCommit, [cancelPendingCommit]);

  const detent = useCallback(() => v2Haptics.selection(), []);

  // React's centre follows the track only when the rounded position changes:
  // once per Anchor passed, never per frame. Each crossing is a detent tick,
  // so a fast flick-through feels like a dial.
  useAnimatedReaction(() => Math.round(position.value), (current, previous) => {
    if (previous === null || current === previous) return;
    runOnJS(setCenter)(current);
    if (relocating.value) relocating.value = false;
    else runOnJS(detent)();
  }, [detent]);

  // Home's heavy content follows the carousel once, when it rests, rather than
  // once per Anchor passed. Any new touch or tap cancels the pending commit.
  const onSettled = useCallback((virtualIndex: number) => {
    // A neighbour tap also ends a pan, whose resting report can arrive after
    // the tap has already sent the track on. Only the current target settles.
    if (virtualIndex !== target.value) return;
    VisualProfiler.record('snapFinished');
    setCenter(virtualIndex);
    latest.current.onCentered?.(true);
    cancelPendingCommit();
    commitTimer.current = setTimeout(() => {
      commitTimer.current = null;
      const { anchors: list, onSelect: select, selectedId: current } = latest.current;
      const id = list[dataIndex(virtualIndex, list.length)]?.anchor.id;
      // An aborted swipe rests on the Anchor that is already selected.
      if (id && id !== current) {
        pendingId.current = id;
        VisualProfiler.record('selectedIndexCommit', { anchorId: id });
        select(id);
      }
      setMoving(false);
    }, COMMIT_DELAY_MS);
  }, [cancelPendingCommit, setMoving, target]);

  // A frozen carousel (focus transition) rests where it was headed.
  useLayoutEffect(() => {
    frozenValue.value = frozen;
    if (!frozen) return;
    cancelAnimation(position);
    position.value = target.value;
    // The cancelled spring never reports; settle it here so the selection still commits.
    if (moving.current && commitTimer.current === null) onSettled(target.value);
  }, [frozen, frozenValue, onSettled, position, target]);

  // A selection from outside Home (library, hydration) relocates the track to
  // the nearest copy of that Anchor. Our own commit arrives with pendingId.
  useLayoutEffect(() => {
    if (pendingId.current && pendingId.current === selectedId) {
      pendingId.current = null;
      return;
    }
    if (pendingId.current || selectedIndex < 0 || selectedIndex >= total) return;
    if (dataIndex(target.value, total) === selectedIndex) return;
    cancelPendingCommit();
    cancelAnimation(position);
    const next = nearestVirtualIndex(Math.round(target.value), selectedIndex, total);
    if (next !== Math.round(position.value)) relocating.value = true;
    position.value = next;
    target.value = next;
    setCenter(next);
    setMoving(false);
    // `position`, `target` and `relocating` are stable shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedIndex, total]);

  // Neighbour taps and accessibility actions. This is the JS-thread path:
  // runOnJS would silently drop here, so it calls `onSettled` directly.
  const move = useCallback((direction: Direction) => {
    if (!canSwitch || frozenValue.value) return;
    cancelPendingCommit();
    setMoving(true);
    cancelAnimation(position);
    const next = target.value + direction;
    target.value = next;
    if (reduceMotion) {
      position.value = next;
      onSettled(next);
      return;
    }
    VisualProfiler.record('snapStart', { direction, from: 'tap' });
    // Spring completions run on the UI thread, where runOnJS is valid.
    position.value = withSpring(next, AnchorMotion.spring.carousel, finished => {
      if (finished) runOnJS(onSettled)(next);
    });
  }, [canSwitch, cancelPendingCommit, frozenValue, onSettled, position, reduceMotion, setMoving, target]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(canSwitch && !frozen)
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      ended.value = false;
      if (frozenValue.value) return;
      // Catch the track wherever it is, including mid-flight.
      cancelAnimation(position);
      dragStart.value = position.value;
      runOnJS(cancelPendingCommit)();
      runOnJS(VisualProfiler.record)('gestureStart');
    })
    .onStart(() => {
      // Only an activated horizontal drag veils Home. A vertical scroll that
      // brushes the hero never activates the pan, so it never dims the page.
      if (!frozenValue.value) runOnJS(setMoving)(true);
    })
    .onUpdate(event => {
      if (frozenValue.value) return;
      position.value = dragStart.value - trackFinger(event.translationX, spacing) / spacing;
    })
    .onEnd(event => {
      ended.value = true;
      runOnJS(VisualProfiler.record)('gestureRelease');
      if (frozenValue.value) return;
      const direction = resolveSwipeCommit(event.translationX, event.velocityX);
      const next = clampStep(direction ? target.value + direction : Math.round(position.value), target.value);
      target.value = next;
      if (direction) runOnJS(VisualProfiler.record)('snapStart', { direction, from: 'swipe' });
      if (reduceMotion) {
        position.value = next;
        runOnJS(onSettled)(next);
        return;
      }
      position.value = withSpring(next, { ...AnchorMotion.spring.carousel, velocity: -event.velocityX / spacing }, finished => {
        if (finished) runOnJS(onSettled)(next);
      });
    })
    .onFinalize(() => {
      if (ended.value || frozenValue.value) return;
      // Touched without dragging: resume toward wherever the track was headed.
      const next = target.value;
      if (reduceMotion || Math.abs(position.value - next) < 0.001) {
        position.value = next;
        runOnJS(onSettled)(next);
        return;
      }
      position.value = withSpring(next, AnchorMotion.spring.carousel, finished => {
        if (finished) runOnJS(onSettled)(next);
      });
    }), [canSwitch, cancelPendingCommit, dragStart, ended, frozen, frozenValue, onSettled, position, reduceMotion, setMoving, spacing, target]);

  const accessibilityActions = canSwitch ? [{ name: 'increment', label: 'Next Anchor' }, { name: 'decrement', label: 'Previous Anchor' }] : undefined;
  const handleAccessibilityAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') move(1);
    else if (event.nativeEvent.actionName === 'decrement') move(-1);
  }, [move]);

  if (total < 1) return null;
  return (
    <GestureDetector gesture={panGesture}>
      <View testID={testID} onLayout={handleTrackLayout} style={[styles.track, { height: renderHero ? heroHeight ?? 308 : 216 }]}
        accessibilityRole={canSwitch ? 'adjustable' : undefined}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}>
        {TRACK_POSITIONS.map(trackPosition => {
          if (trackPosition !== 0 && !canSwitch) return null;
          const virtualIndex = center + trackPosition;
          const itemIndex = dataIndex(virtualIndex, total);
          // Keyed by virtual index: an Anchor keeps its React identity as it
          // travels across the window, for any list length including 2 and 3.
          return <TrackSlot key={virtualIndex} summary={anchors[itemIndex]} index={itemIndex} virtualIndex={virtualIndex}
            trackPosition={trackPosition} position={position} spacing={spacing} anchorSize={anchorSize}
            renderHero={renderHero} onPress={move} onOpenActive={onOpenActive} />;
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: { position: 'relative', alignSelf: 'stretch', width: '100%', overflow: 'hidden' },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  neighbourHit: { position: 'absolute', left: 0, right: 0, height: 96 },
});

export const V2HomeAnchorCarousel = memo(V2HomeAnchorCarouselComponent);
