import React, { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import type { V2HomeAnchorSummary } from '@/adapters/v2/home';
import { v2Haptics } from '@/hooks/v2';
import { AnchorMotion } from '@/theme/v2';

export const HERO_ANCHOR_SIZE = 154;
export const NEIGHBOUR_ANCHOR_SIZE = 68;
const COMMIT_DISTANCE = 56;
const MIN_COMMIT_TRAVEL = 14;
const VELOCITY_PROJECTION = 0.12;
const RUBBER_BAND = 0.34;
const MAX_DRAG_DISTANCE = 240;
type Direction = -1 | 1;
export type CarouselSlot = -1 | 0 | 1;

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
};

export function trackFinger(translationX: number): number {
  'worklet';
  const clamped = Math.max(-MAX_DRAG_DISTANCE, Math.min(MAX_DRAG_DISTANCE, translationX));
  const magnitude = Math.abs(clamped);
  if (magnitude <= COMMIT_DISTANCE) return clamped;
  return Math.sign(clamped) * (COMMIT_DISTANCE + (magnitude - COMMIT_DISTANCE) * RUBBER_BAND);
}

export function resolveSwipeCommit(translationX: number, velocityX: number): Direction | null {
  'worklet';
  if (Math.abs(translationX) < MIN_COMMIT_TRAVEL) return null;
  const projected = translationX + velocityX * VELOCITY_PROJECTION;
  if (Math.abs(projected) < COMMIT_DISTANCE) return null;
  return projected < 0 ? 1 : -1;
}

export function carouselWindow(total: number, index: number): [number, number, number] {
  if (total < 1) return [-1, -1, -1];
  return [(index - 1 + total) % total, index, (index + 1) % total];
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
        svg={anchorArtworkSvg(summary.anchor)}
        imageUrl={summary.anchor.enhancedImageUrl}
        category={summary.anchor.category}
        size={HERO_ANCHOR_SIZE}
        appearance="paper"
        accessibilityLabel={`${categoryLabel(summary.anchor.category)} Anchor artwork`}
      />
    </Pressable>
  );
}

const TrackSlot = memo(function TrackSlot({
  summary, index, slot, offset, spacing, renderHero, onPress, onOpenActive,
}: {
  summary: V2HomeAnchorSummary;
  index: number;
  slot: CarouselSlot;
  offset: SharedValue<number>;
  spacing: number;
  renderHero?: Props['renderHero'];
  onPress: (direction: Direction) => void;
  onOpenActive?: (anchorId: string) => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slot * spacing + offset.value }],
  }));
  const handleNeighbour = useCallback(() => onPress(slot as Direction), [onPress, slot]);
  const handleOpen = useCallback(() => onOpenActive?.(summary.anchor.id), [onOpenActive, summary.anchor.id]);
  return (
    <Animated.View style={[styles.slot, animatedStyle]} pointerEvents="box-none">
      {renderHero ? renderHero(summary, index, slot, offset, spacing) : (
        <DefaultHero summary={summary} active={slot === 0} onOpen={handleOpen} />
      )}
      {slot !== 0 ? (
        <Pressable
          testID={`v2-home-carousel-${slot < 0 ? 'previous' : 'next'}`}
          style={styles.neighbourHit}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${summary.anchor.intentionText}`}
          onPress={handleNeighbour}
        />
      ) : null}
    </Animated.View>
  );
});

function V2HomeAnchorCarouselComponent({ anchors, selectedIndex, onSelect, onOpenActive, reduceMotion = false, renderHero, heroHeight, testID }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const width = screenWidth - 40;
  // At rest, a 68px scaled neighbour still peeks roughly 40px past the inset.
  const spacing = Math.max(160, width * 0.48);
  const offset = useSharedValue(0);
  const busy = useSharedValue(false);
  const [visualIndex, setVisualIndex] = useState(selectedIndex);
  const pendingId = useRef<string | null>(null);
  const total = anchors.length;
  const index = visualIndex >= 0 && visualIndex < total ? visualIndex : 0;
  const active = anchors[index];
  const canSwitch = total > 1;

  // A selection from outside Home (library, hydration) resets the local window.
  // Our own store commit arrives with pendingId and leaves the settled window.
  useLayoutEffect(() => {
    if (pendingId.current === anchors[selectedIndex]?.anchor.id) {
      pendingId.current = null;
      return;
    }
    if (pendingId.current || selectedIndex === visualIndex) return;
    cancelAnimation(offset);
    offset.value = 0;
    busy.value = false;
    setVisualIndex(selectedIndex);
  }, [anchors, busy, offset, selectedIndex, visualIndex]);

  const complete = useCallback((direction: Direction) => {
    const nextIndex = (index + direction + total) % total;
    const target = anchors[nextIndex];
    if (!target || target.anchor.id === active?.anchor.id) {
      offset.value = withSpring(0, AnchorMotion.spring.carousel);
      busy.value = false;
      return;
    }
    pendingId.current = target.anchor.id;
    setVisualIndex(nextIndex);
    v2Haptics.selection();
    if (reduceMotion) {
      // There is no animation to await. React batches the local window and the
      // global selection into one paint, including all dependent Home content.
      pendingId.current = null;
      onSelect(target.anchor.id);
      busy.value = false;
    }
  }, [active?.anchor.id, anchors, busy, index, offset, onSelect, reduceMotion, total]);

  // React installs the rotated window and resets its coordinate before paint.
  // The incoming item occupies the same physical position on both sides of
  // this reset. Persisted/global selection follows on the next frame.
  const lastVisualIndex = useRef(visualIndex);
  useLayoutEffect(() => {
    if (lastVisualIndex.current === visualIndex) return;
    lastVisualIndex.current = visualIndex;
    offset.value = 0;
    const id = pendingId.current;
    if (id) {
      requestAnimationFrame(() => {
        // The track has painted at its final position. Full-vault persistence
        // performed by Zustand may now use JS without delaying that frame.
        setTimeout(() => {
          onSelect(id);
          busy.value = false;
        }, 0);
      });
    } else {
      busy.value = false;
    }
  }, [busy, offset, onSelect, visualIndex]);

  const move = useCallback((direction: Direction) => {
    if (!canSwitch || busy.value) return;
    busy.value = true;
    if (reduceMotion) {
      complete(direction);
      return;
    }
    offset.value = withSpring(-direction * spacing, AnchorMotion.spring.carousel, finished => {
      if (finished) runOnJS(complete)(direction);
    });
  }, [busy, canSwitch, complete, offset, reduceMotion, spacing]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(canSwitch)
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onUpdate(event => {
      if (!busy.value) offset.value = trackFinger(event.translationX);
    })
    .onEnd(event => {
      if (busy.value) return;
      const direction = resolveSwipeCommit(event.translationX, event.velocityX);
      if (!direction) {
        offset.value = reduceMotion ? 0 : withSpring(0, AnchorMotion.spring.carousel);
        return;
      }
      busy.value = true;
      if (reduceMotion) {
        runOnJS(complete)(direction);
      } else {
        offset.value = withSpring(-direction * spacing, { ...AnchorMotion.spring.carousel, velocity: event.velocityX }, finished => {
          if (finished) runOnJS(complete)(direction);
        });
      }
    })
    .onFinalize(() => {
      if (!busy.value && offset.value !== 0) offset.value = reduceMotion ? 0 : withSpring(0, AnchorMotion.spring.carousel);
    }), [busy, canSwitch, complete, offset, reduceMotion, spacing]);

  const accessibilityActions = canSwitch ? [{ name: 'increment', label: 'Next Anchor' }, { name: 'decrement', label: 'Previous Anchor' }] : undefined;
  const handleAccessibilityAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'increment') move(1);
    else if (event.nativeEvent.actionName === 'decrement') move(-1);
  }, [move]);

  if (!active) return null;
  return (
    <GestureDetector gesture={panGesture}>
      <View testID={testID} style={[styles.track, { width, height: renderHero ? heroHeight ?? 308 : 216 }]}
        accessibilityRole={canSwitch ? 'adjustable' : undefined}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}>
        {([-1, 1, 0] as CarouselSlot[]).map(slot => {
          if (slot !== 0 && !canSwitch) return null;
          const [previousIndex, currentIndex, nextIndex] = carouselWindow(total, index);
          const itemIndex = slot < 0 ? previousIndex : slot > 0 ? nextIndex : currentIndex;
          // With three distinct Anchors, keep the incoming artwork's React
          // identity as it moves from next to current during window rotation.
          // A two-Anchor vault renders the same model on both sides, so those
          // two physical copies use slot keys instead.
          const key = total > 2 ? anchors[itemIndex].anchor.id : slot;
          return <TrackSlot key={key} summary={anchors[itemIndex]} index={itemIndex} slot={slot}
            offset={offset} spacing={spacing} renderHero={renderHero} onPress={move} onOpenActive={onOpenActive} />;
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: { position: 'relative', alignSelf: 'center', overflow: 'hidden' },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  neighbourHit: { position: 'absolute', top: 85, left: 0, right: 0, height: 96 },
});

export const V2HomeAnchorCarousel = memo(V2HomeAnchorCarouselComponent);
