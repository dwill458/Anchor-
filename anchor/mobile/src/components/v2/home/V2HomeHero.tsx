import React, { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { anchorPositionLabel } from '@/constants/v2/home';
import { anchorArtworkSvg, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { CircularAnchorRenderer } from '@/components/v2';
import type { V2HomeAnchorSummary, V2ThreadPresentation } from '@/adapters/v2/home';
import { HERO_ANCHOR_SIZE, V2HomeAnchorCarousel, type CarouselSlot } from './V2HomeAnchorCarousel';

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedIndex: number;
  onSelect: (anchorId: string) => void;
  onOpenActive?: (anchorId: string) => void;
  onOpenProgress?: () => void;
  /** Opens the full Anchor library. Home is the only entry point to it. */
  onOpenAllAnchors?: () => void;
  thread: V2ThreadPresentation | null;
  reduceMotion?: boolean;
  testID?: string;
};

/**
 * One restrained hand-drawn accent under the intention. It is intentionally
 * short, off-centre and slightly uneven — a mark, not an underline rule.
 */
function IntentionMark({ color }: { color: string }) {
  return (
    <Svg width={88} height={7} viewBox="0 0 88 7" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M1.5 4.4C22 2.1 47 1.3 86 2.6" stroke={color} strokeWidth={2.1} strokeLinecap="round" opacity={0.72} />
      <Path d="M8 5.8C29 4.4 52 4.1 74 4.9" stroke={color} strokeWidth={0.9} strokeLinecap="round" opacity={0.34} />
    </Svg>
  );
}

/** The original handmade construction marks travel with each Anchor. */
const ConstructionStrokes = memo(function ConstructionStrokes({ color }: { color: string }) {
  const size = 238;
  const c = size / 2;
  const outer = size * 0.452;
  const inner = size * 0.418;
  const tickGap = size * 0.478;
  const tick = size * 0.022;
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G strokeLinecap="round" fill="none">
      <Circle cx={c - size * 0.005} cy={c + size * 0.004} r={outer} stroke={color} strokeWidth={1.3}
        strokeOpacity={0.42} strokeDasharray={`${outer * 5.4} ${outer * 0.5}`} transform={`rotate(-24 ${c} ${c})`} />
      <Circle cx={c + size * 0.008} cy={c - size * 0.006} r={inner} stroke={color} strokeWidth={0.8}
        strokeOpacity={0.2} strokeDasharray={`${inner * 2.1} ${inner * 0.9} ${inner * 3.3} ${inner * 0.35}`}
        transform={`rotate(118 ${c} ${c})`} />
      <Path d={`M ${c} ${c - tickGap} l 0 ${-tick * 1.6}`} stroke={color} strokeOpacity={0.34} strokeWidth={1.2} />
      <Path d={`M ${c + tickGap} ${c + size * 0.004} l ${tick * 1.3} 0`} stroke={color} strokeOpacity={0.24} strokeWidth={1.1} />
      <Path d={`M ${c - size * 0.008} ${c + tickGap} l 0 ${tick * 1.9}`} stroke={color} strokeOpacity={0.3} strokeWidth={1.1} />
      <Path d={`M ${c - tickGap} ${c - size * 0.01} l ${-tick * 1.1} 0`} stroke={color} strokeOpacity={0.18} strokeWidth={1} />
    </G>
  </Svg>;
});

/**
 * Compact contextual Thread Strength reading. The brief is explicit that this
 * belongs inside the cream hero and that "Not yet measured" must never be the
 * largest typography on Home, so the null state stays in this same small row.
 * `value` and `delta` are server-authoritative; nothing here derives movement.
 */
function ThreadReading({ thread, accent, active }: { thread: V2ThreadPresentation; accent: string; active: boolean }) {
  const measured = thread.value !== null;
  const delta = thread.delta;
  const hasDelta = measured && typeof delta === 'number' && Number.isFinite(delta);
  return (
    <View testID={active ? 'v2-home-thread-reading' : undefined} style={styles.threadRow}>
      {measured ? (
        <Text testID={active ? 'v2-home-thread-value' : undefined} style={[styles.threadValue, { color: accent }]}>
          {`${thread.value}%`}
        </Text>
      ) : null}
      <Text style={styles.threadLabel}>Thread Strength</Text>
      {measured ? (
        hasDelta ? (
          <Text testID={active ? 'v2-home-thread-delta' : undefined} style={styles.threadDelta}>
            {`· ${(delta as number) > 0 ? '+' : ''}${delta} this week`}
          </Text>
        ) : null
      ) : (
        <Text testID={active ? 'v2-home-thread-unmeasured' : undefined} style={styles.threadDelta}>
          · Not yet measured
        </Text>
      )}
    </View>
  );
}

function AnchorHeroItem({ summary, index, total, slot, offset, spacing, thread, onOpenActive, onOpenProgress, onOpenAllAnchors }: {
  summary: V2HomeAnchorSummary;
  index: number;
  total: number;
  slot: CarouselSlot;
  offset: SharedValue<number>;
  spacing: number;
  thread: V2ThreadPresentation;
  onOpenActive?: (anchorId: string) => void;
  onOpenProgress?: () => void;
  onOpenAllAnchors?: () => void;
}) {
  const anchor = summary.anchor;
  const accent = getCategoryColor(anchor.category);
  const artworkMotion = useAnimatedStyle(() => {
    const distance = Math.abs(slot * spacing + offset.value);
    return {
      opacity: interpolate(distance, [0, spacing], [1, 0.55], 'clamp'),
      transform: [{ scale: interpolate(distance, [0, spacing], [1, 68 / HERO_ANCHOR_SIZE], 'clamp') }],
    };
  });
  const textMotion = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(slot * spacing + offset.value), [0, spacing * 0.55], [1, 0], 'clamp'),
  }));
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const recordTouchStart = useCallback((event: GestureResponderEvent) => {
    touchStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
    moved.current = false;
  }, []);
  const recordTouchMove = useCallback((event: GestureResponderEvent) => {
    const start = touchStart.current;
    if (start && Math.hypot(event.nativeEvent.pageX - start.x, event.nativeEvent.pageY - start.y) > 5) {
      moved.current = true;
    }
  }, []);
  const handleOpen = useCallback((event?: GestureResponderEvent) => {
    const start = touchStart.current;
    const end = event?.nativeEvent;
    const movedAtRelease = start && end && Math.hypot(end.pageX - start.x, end.pageY - start.y) > 5;
    const wasSwipe = moved.current || movedAtRelease || Math.abs(offset.value) > 2;
    touchStart.current = null;
    moved.current = false;
    if (wasSwipe) return;
    onOpenActive?.(anchor.id);
  }, [anchor.id, offset, onOpenActive]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.contextRow, textMotion]} pointerEvents={slot === 0 ? 'auto' : 'none'}>
        <View style={styles.categoryGroup}>
          <View style={[styles.categoryDash, { backgroundColor: accent }]} />
          <Text style={styles.categoryText}>{categoryLabel(anchor.category).toUpperCase()}</Text>
        </View>
        {total > 1 ? (
          /**
           * The numeric position is authoritative (the brief forbids a row of
           * dots), and it doubles as the only route into the Anchor library
           * now that the "Your Anchors" rail is gone.
           */
          <Pressable
            testID={slot === 0 ? 'v2-home-anchor-position' : undefined}
            accessibilityRole={onOpenAllAnchors ? 'button' : undefined}
            accessibilityLabel={
              onOpenAllAnchors
                ? `Anchor ${index + 1} of ${total}. View all Anchors.`
                : `Anchor ${index + 1} of ${total}.`
            }
            onPress={onOpenAllAnchors}
            disabled={!onOpenAllAnchors}
            hitSlop={12}
            style={({ pressed }) => (pressed && onOpenAllAnchors ? styles.pressed : undefined)}
          >
            <Text style={styles.positionText}>{anchorPositionLabel(index, total)}</Text>
          </Pressable>
        ) : onOpenAllAnchors ? (
          /**
           * A single Anchor has no position to report, but the library still
           * holds released Anchors, so the route must stay reachable.
           */
          <Pressable
            testID={slot === 0 ? 'v2-home-all-anchors' : undefined}
            accessibilityRole="button"
            accessibilityLabel="View all Anchors"
            onPress={onOpenAllAnchors}
            hitSlop={12}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={styles.positionText}>ALL ANCHORS</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.artworkBox, artworkMotion]}>
        <View style={styles.construction} pointerEvents="none">
          <ConstructionStrokes color={accent} />
        </View>
        <Pressable testID={slot === 0 ? 'v2-home-carousel-active' : undefined}
          accessibilityRole={slot === 0 ? 'button' : undefined}
          accessibilityLabel={`${anchor.intentionText}. ${categoryLabel(anchor.category)}. View Anchor details.`}
          onPressIn={recordTouchStart} onTouchMove={recordTouchMove}
          onPress={handleOpen} disabled={slot !== 0 || !onOpenActive}>
          <CircularAnchorRenderer svg={anchorArtworkSvg(anchor)} imageUrl={anchor.enhancedImageUrl}
            category={anchor.category} size={HERO_ANCHOR_SIZE} appearance="paper"
            accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`} />
        </Pressable>
      </Animated.View>

      <Animated.View style={textMotion} pointerEvents={slot === 0 ? 'auto' : 'none'}>
        <View style={styles.intentionBlock}>
        <Text testID={slot === 0 ? 'v2-home-intention' : undefined} style={styles.intention}>
          {anchor.intentionText}
        </Text>
        <View style={styles.intentionMark}>
          <IntentionMark color={accent} />
        </View>
        </View>

      {thread ? (
        <Pressable
          testID={slot === 0 ? 'v2-home-thread' : undefined}
          accessibilityRole={onOpenProgress ? 'button' : undefined}
          accessibilityLabel={
            thread.value === null
              ? 'Thread Strength not yet measured. Open Progress.'
              : `Thread Strength ${thread.value} percent. Open Progress.`
          }
          onPress={onOpenProgress}
          disabled={!onOpenProgress}
          style={({ pressed }) => (pressed && onOpenProgress ? styles.pressed : undefined)}
        >
          <ThreadReading thread={thread} accent={accent} active={slot === 0} />
        </Pressable>
      ) : null}
      </Animated.View>
    </View>
  );
}

/** The entire visible hero is one of three mounted items on a shared track. */
function V2HomeHeroComponent({ anchors, selectedIndex, onSelect, onOpenActive, onOpenProgress, onOpenAllAnchors, thread, reduceMotion, testID }: Props) {
  const renderHero = useCallback((summary: V2HomeAnchorSummary, index: number, slot: CarouselSlot, offset: SharedValue<number>, spacing: number) => (
    <AnchorHeroItem summary={summary} index={index} total={anchors.length} slot={slot} offset={offset} spacing={spacing}
      thread={index === selectedIndex && thread ? thread : summary.thread}
      onOpenActive={onOpenActive} onOpenProgress={onOpenProgress} onOpenAllAnchors={onOpenAllAnchors} />
  ), [anchors.length, onOpenActive, onOpenAllAnchors, onOpenProgress, selectedIndex, thread]);
  return <View testID={testID}>
    <V2HomeAnchorCarousel testID="v2-home-carousel" anchors={anchors} selectedIndex={selectedIndex}
      onSelect={onSelect} onOpenActive={onOpenActive} reduceMotion={reduceMotion} renderHero={renderHero} />
  </View>;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    width: '100%',
  },
  artworkBox: {
    height: 238,
    alignItems: 'center',
    justifyContent: 'center',
  },
  construction: {
    position: 'absolute',
    top: 0,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  categoryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  categoryDash: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  categoryText: {
    fontFamily: typography.bodyBold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.text.secondary,
  },
  positionText: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  intentionBlock: {
    marginTop: 18,
  },
  intention: {
    fontFamily: typography.displayBold,
    fontSize: 34,
    lineHeight: 37,
    letterSpacing: -1.3,
    color: colors.text.primary,
  },
  intentionMark: {
    marginTop: 7,
    marginLeft: 3,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 18,
  },
  threadValue: {
    fontFamily: typography.displayBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  threadLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.primary,
  },
  threadDelta: {
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  pressed: {
    opacity: 0.7,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeHero = memo(V2HomeHeroComponent);
