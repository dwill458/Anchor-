import React, { memo, useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, getCategoryColor, typography } from '@/theme/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { CircularAnchorRenderer } from '@/components/v2';
import type { V2HomeAnchorSummary, V2ThreadPresentation } from '@/adapters/v2/home';
import { V2HomeAnchorCarousel, NEIGHBOUR_SCALE, type CarouselSlot } from './V2HomeAnchorCarousel';
import { resolveHomeHeroLayout, HERO_INTENTION_MAX_LINES } from './homeHeroLayout';
import { useHomeArrivalContext } from './homeArrival';

/** Share of the paper disc the mark itself occupies (CircularAnchorRenderer's paper artwork). */
const PAPER_ARTWORK_SHARE = 0.72;

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

/**
 * One hand-drawn, slightly open pencil line around the paper disc. It belongs
 * to the carousel's presentation - the frame the mark is shown in - and never
 * to the Anchor mark itself. It is deliberately a single stroke: a second
 * orbit and cardinal tick marks read as a seal or compass rose, not as a
 * personal mark sitting on paper.
 */
const ConstructionStrokes = memo(function ConstructionStrokes({ color, size }: { color: string; size: number }) {
  const c = size / 2;
  const outer = size * 0.452;
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G strokeLinecap="round" fill="none">
      <Circle cx={c - size * 0.005} cy={c + size * 0.004} r={outer} stroke={color} strokeWidth={1.2}
        strokeOpacity={0.34} strokeDasharray={`${outer * 5.4} ${outer * 0.5}`} transform={`rotate(-24 ${c} ${c})`} />
    </G>
  </Svg>;
});

/**
 * Compact contextual Consistency reading (the Thread Strength engine's value,
 * presented under its user-facing name). The brief is explicit that this
 * belongs inside the cream hero and that "Not yet measured" must never be the
 * largest typography on Home, so the null state stays in this same small row.
 * `value` and `delta` are server-authoritative; nothing here derives movement.
 */
/** Server delta7d as a direction + magnitude: `↑ 5% this week`, `↓ 21% this week`. */
export function consistencyDeltaLabel(delta: number): string {
  if (delta > 0) return `↑ ${delta}% this week`;
  if (delta < 0) return `↓ ${Math.abs(delta)}% this week`;
  return 'Steady this week';
}

function ThreadReading({ thread, accent, active }: { thread: V2ThreadPresentation; accent: string; active: boolean }) {
  const measured = thread.value !== null;
  const delta = thread.delta;
  const hasDelta = measured && typeof delta === 'number' && Number.isFinite(delta);
  return (
    <View testID={active ? 'v2-home-thread-reading' : undefined} style={styles.threadRow}>
      <Text style={styles.threadLabel}>Consistency</Text>
      {measured ? (
        <Text testID={active ? 'v2-home-thread-value' : undefined} style={[styles.threadValue, { color: accent }]}>
          {`${thread.value}%`}
        </Text>
      ) : null}
      {measured ? (
        hasDelta ? (
          <Text testID={active ? 'v2-home-thread-delta' : undefined} style={styles.threadDelta}>
            {consistencyDeltaLabel(delta as number)}
          </Text>
        ) : null
      ) : (
        <Text testID={active ? 'v2-home-thread-unmeasured' : undefined} style={styles.threadDelta}>
          · Not established yet
        </Text>
      )}
    </View>
  );
}

function AnchorHeroItem({ summary, index, total, slot, offset, spacing, gutter, anchorSize, artworkBoxHeight, constructionSize, thread, onOpenActive, onOpenProgress, onOpenAllAnchors }: {
  summary: V2HomeAnchorSummary;
  index: number;
  total: number;
  slot: CarouselSlot;
  offset: SharedValue<number>;
  spacing: number;
  gutter: number;
  anchorSize: number;
  artworkBoxHeight: number;
  constructionSize: number;
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
      opacity: interpolate(distance, [0, spacing], [1, 0.7], 'clamp'),
      transform: [{ scale: interpolate(distance, [0, spacing], [1, NEIGHBOUR_SCALE], 'clamp') }],
    };
  });
  const textMotion = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(slot * spacing + offset.value), [0, spacing * 0.55], [1, 0], 'clamp'),
  }));
  // A just-created Anchor arriving from creation needs to know exactly where its mark will rest.
  const arrival = useHomeArrivalContext();
  const discRef = useRef<View>(null);
  const measuring = Boolean(arrival?.active && arrival.phase === 'staging' && slot === 0);
  const reportTarget = arrival?.reportTarget;
  useEffect(() => {
    if (!measuring || !reportTarget) return undefined;
    // One beat for Home to settle at the top of the page before it is measured.
    const timer = setTimeout(() => {
      const disc = discRef.current;
      if (!disc || typeof disc.measureInWindow !== 'function') {
        reportTarget(null);
        return;
      }
      disc.measureInWindow((x, y, width, height) => {
        if (![x, y, width, height].every(Number.isFinite) || width <= 0) {
          reportTarget(null);
          return;
        }
        const art = width * PAPER_ARTWORK_SHARE;
        reportTarget({ x: x + (width - art) / 2, y: y + (height - art) / 2, width: art, height: art });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [measuring, reportTarget]);

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
    <View style={[styles.container, { paddingHorizontal: gutter }]}>
      <Animated.View style={[styles.contextRow, textMotion]} pointerEvents={slot === 0 ? 'auto' : 'none'}>
        <View style={styles.categoryGroup}>
          <View style={[styles.categoryDash, { backgroundColor: accent }]} />
          <Text style={[styles.categoryText, { color: accent }]}>{categoryLabel(anchor.category).toUpperCase()}</Text>
          <Text style={styles.categorySeparator}>·</Text>
          <Pressable
            testID={slot === 0 ? 'v2-home-anchor-position' : undefined}
            accessibilityRole={onOpenAllAnchors ? 'button' : undefined}
            accessibilityLabel={`Anchor ${index + 1} of ${total}. View all Anchors.`}
            onPress={onOpenAllAnchors}
            disabled={!onOpenAllAnchors}
            hitSlop={10}
          ><Text style={styles.positionText}>{`${index + 1} OF ${total}`}</Text></Pressable>
        </View>
        {onOpenAllAnchors ? (
          <Pressable
            testID={slot === 0 ? 'v2-home-all-anchors' : undefined}
            accessibilityRole="button"
            accessibilityLabel="View all Anchors"
            onPress={onOpenAllAnchors}
            hitSlop={12}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
          >
            <Text style={styles.allAnchorsText}>All Anchors ›</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      <Animated.View style={[styles.artworkBox, { height: artworkBoxHeight }, artworkMotion]}>
        <View
          style={[
            styles.construction,
            {
              width: constructionSize,
              height: constructionSize,
              left: '50%',
              top: (artworkBoxHeight - constructionSize) / 2,
              marginLeft: -constructionSize / 2,
            },
          ]}
          pointerEvents="none"
        >
          <ConstructionStrokes color={accent} size={constructionSize} />
        </View>
        <View style={[styles.anchorMount, { width: anchorSize + 14, height: anchorSize + 14, borderRadius: (anchorSize + 14) / 2, borderColor: `${accent}30` }]}>
          <Pressable testID={slot === 0 ? 'v2-home-carousel-active' : undefined}
            accessibilityRole={slot === 0 ? 'button' : undefined}
            accessibilityLabel={`${anchor.intentionText}. ${categoryLabel(anchor.category)}. View Anchor details.`}
            onPressIn={recordTouchStart} onTouchMove={recordTouchMove}
            onPress={handleOpen} disabled={slot !== 0 || !onOpenActive}>
            <View ref={discRef} collapsable={false}>
              <CircularAnchorRenderer {...anchorRenderProps(anchor)} size={anchorSize} appearance="paper"
                accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`} />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      <Animated.View style={textMotion} pointerEvents={slot === 0 ? 'auto' : 'none'}>
        <View style={styles.intentionBlock}>
        <Text testID={slot === 0 ? 'v2-home-intention' : undefined} style={styles.intention} numberOfLines={HERO_INTENTION_MAX_LINES}>
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
              ? 'Consistency not established yet. Open Progress.'
              : `Consistency ${thread.value} percent. Open Progress.`
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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = resolveHomeHeroLayout({
    platform: Platform.OS,
    width, height, topInset: insets.top, bottomInset: insets.bottom, selectedIndex,
    intentions: anchors.map(({ anchor }) => anchor.intentionText),
  });
  const renderHero = useCallback((summary: V2HomeAnchorSummary, index: number, slot: CarouselSlot, offset: SharedValue<number>, spacing: number) => (
    <AnchorHeroItem summary={summary} index={index} total={anchors.length} slot={slot} offset={offset} spacing={spacing} gutter={layout.gutter}
      anchorSize={layout.anchorSize} artworkBoxHeight={layout.artworkBoxHeight} constructionSize={layout.constructionSize}
      thread={index === selectedIndex && thread ? thread : summary.thread}
      onOpenActive={onOpenActive} onOpenProgress={onOpenProgress} onOpenAllAnchors={onOpenAllAnchors} />
  ), [anchors.length, layout.gutter, layout.anchorSize, layout.artworkBoxHeight, layout.constructionSize, onOpenActive, onOpenAllAnchors, onOpenProgress, selectedIndex, thread]);
  return <View testID={testID}>
    <V2HomeAnchorCarousel testID="v2-home-carousel" anchors={anchors} selectedIndex={selectedIndex} heroHeight={layout.trackHeight} anchorSize={layout.anchorSize}
      onSelect={onSelect} onOpenActive={onOpenActive} reduceMotion={reduceMotion} renderHero={renderHero} />
  </View>;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    width: '100%',
  },
  artworkBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  construction: {
    position: 'absolute',
  },
  anchorMount: {
    padding: 6,
    borderWidth: 1,
    backgroundColor: '#FBF9F4',
    shadowColor: '#352D25',
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  categoryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  categoryDash: {
    width: 22,
    height: 6,
    borderRadius: 2,
  },
  categoryText: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.3,
    color: colors.text.secondary,
  },
  positionText: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  categorySeparator: { fontFamily: typography.bodyBold, color: colors.text.secondary, fontSize: 12 },
  allAnchorsText: { fontFamily: 'EBGaramond-Regular', fontSize: 14, lineHeight: 18, color: colors.text.primary },
  intentionBlock: {
    marginTop: 3,
    alignItems: 'center',
  },
  intention: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.5,
    color: colors.text.primary,
    textAlign: 'center',
  },
  intentionMark: {
    marginTop: 3,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 5,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  threadValue: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 23,
    lineHeight: 24,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  threadLabel: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.primary,
  },
  threadDelta: {
    fontFamily: typography.body,
    fontSize: 12,
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
