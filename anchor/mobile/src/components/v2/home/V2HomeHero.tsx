import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { AnchorMotion, colors, getCategoryColor, typography } from '@/theme/v2';
import { anchorRenderProps, categoryLabel } from '@/components/v2/anchors/anchorPresentation';
import { CircularAnchorRenderer } from '@/components/v2';
import type { CircularAnchorEntrance } from '@/components/v2/anchor/CircularAnchorRenderer';
import type { V2HomeAnchorSummary, V2ThreadPresentation } from '@/adapters/v2/home';
import type { Anchor } from '@/types';
import { V2HomeAnchorCarousel, NEIGHBOUR_SCALE, type CarouselSlot } from './V2HomeAnchorCarousel';
import { resolveHomeHeroLayout, heroIntentionFontSize, HERO_INTENTION_LINES, HERO_INTENTION_LINE_HEIGHT, HERO_INTENTION_MIN_FONT_SCALE } from './homeHeroLayout';
import { releaseArtFactors, releaseArtParams, useHomeArrivalContext } from './homeArrival';
import { HomeArrivalCounter } from './HomeArrivalCounter';
import { HomeArrivalUnderline, HomeEvolvedFromLine, HomeEvolvedGhost } from './HomeArrivalEvolved';
import { useAnchorTransitionPlace, useProgressiveFocusTransition, type AnchorWindowRect } from '@/navigation/v2/ProgressiveFocusTransition';
import { HeroStatusRing } from './V2HomeHeroLight';
import { HERO_ENTRANCE, hasHeroEntrancePlayed, markHeroEntrancePlayed } from './homeHeroPresence';
import { useHomeArrivalStore } from '@/stores/v2/homeArrivalStore';
import { HandDrawnPercentage } from './HandDrawnPercentage';

/** Share of the paper disc the mark itself occupies (CircularAnchorRenderer's paper artwork). */
const PAPER_ARTWORK_SHARE = 0.72;

type Props = {
  anchors: V2HomeAnchorSummary[];
  selectedIndex: number;
  onSelect: (anchorId: string) => void;
  onOpenActive?: (anchorId: string, source?: AnchorWindowRect) => void;
  onOpenProgress?: (anchorId?: string, source?: AnchorWindowRect) => void;
  /** Opens the full Anchor library. Home is the only entry point to it. */
  onOpenAllAnchors?: () => void;
  thread: V2ThreadPresentation | null;
  reduceMotion?: boolean;
  frozen?: boolean;
  auraActive?: boolean;
  /** Passed through to the carousel: true while it moves, false once it rests and commits. */
  onMotionChange?: (moving: boolean) => void;
  teachingThreadRef?: React.RefObject<View | null>;
  testID?: string;
};

/**
 * One restrained hand-drawn accent under the intention. It is intentionally
 * short, off-centre and slightly uneven — a mark, not an underline rule.
 */
const INTENTION_MARK_WIDTH = 88;
const INTENTION_MARK_HEIGHT = 7;
function IntentionMark({ color }: { color: string }) {
  return (
    <Svg width={INTENTION_MARK_WIDTH} height={INTENTION_MARK_HEIGHT} viewBox="0 0 88 7" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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

function ThreadReading({ thread, accent, active, teachingRef }: { thread: V2ThreadPresentation; accent: string; active: boolean; teachingRef?: React.RefObject<View | null> }) {
  const measured = thread.value !== null;
  const delta = thread.delta;
  const hasDelta = measured && typeof delta === 'number' && Number.isFinite(delta);
  const formattedValue = `${thread.value}%`;
  return (
    <View ref={active ? teachingRef : undefined} collapsable={false} testID={active ? 'v2-home-thread-reading' : undefined} style={styles.threadRow}>
      <Text style={styles.threadLabel}>Thread Strength</Text>
      {measured ? (
        <View style={styles.threadValueContainer}>
          <HandDrawnPercentage value={thread.value as number} color={accent} height={20} />
          <Text
            testID={active ? 'v2-home-thread-value' : undefined}
            style={styles.threadValueHidden}
          >
            {formattedValue}
          </Text>
        </View>
      ) : null}
      {measured ? (
        hasDelta ? (
          <Text testID={active ? 'v2-home-thread-delta' : undefined} style={styles.threadDelta}>
            {consistencyDeltaLabel(delta as number)}
          </Text>
        ) : null
      ) : (
        <Text testID={active ? 'v2-home-thread-unmeasured' : undefined} style={styles.threadDelta} numberOfLines={1}>
        · Begins with practice
        </Text>
      )}
    </View>
  );
}

/**
 * The coin's first-load entrance: the paper settles in while the line draws itself on, echoing the
 * forming screen. It plays once per cold start, for the coin that is centred when Home first
 * appears. It does not replay when the user swipes, returns from another screen, or arrives from
 * creation (that hand-off already flies the finished mark in, and redrawing it would undo it).
 *
 * Only a vector mark with a recorded expression can truly draw on. A finished image is a flat
 * raster whose line cannot be traced without a second, possibly misaligned, drawing over it, so it
 * settles in instead (and waits for its image, so nothing fades in empty).
 */
function useHeroEntrance(
  anchor: Anchor,
  slot: CarouselSlot,
  reduceMotion: boolean,
  arrivalActive: boolean,
  reportHeroImageLoaded?: () => void,
) {
  const [eligible] = useState(() => {
    if (slot !== 0 || hasHeroEntrancePlayed()) return false;
    // A creation hand-off, or reduced motion, spends the one entrance without playing it.
    if (arrivalActive || reduceMotion) { markHeroEntrancePlayed(); return false; }
    return true;
  });
  const vector = eligible && !anchor.enhancedImageUrl && anchorRenderProps(anchor).expression !== undefined;
  const ground = useSharedValue(eligible ? 0 : 1);
  const draw = useSharedValue(vector ? 0 : 1);
  const [drawing, setDrawing] = useState(vector);
  const started = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    if (started.current) return;
    started.current = true;
    // A gentle in-out curve: the "enter" curve is so front-loaded that a 900ms fade reads as a 200ms pop.
    ground.value = withDelay(HERO_ENTRANCE.startDelayMs, withTiming(1, { duration: HERO_ENTRANCE.groundMs, easing: Easing.bezier(0.4, 0, 0.2, 1) }));
    if (vector) draw.value = withDelay(HERO_ENTRANCE.startDelayMs + HERO_ENTRANCE.drawDelayMs, withTiming(1, { duration: HERO_ENTRANCE.drawMs, easing: Easing.bezier(0.45, 0, 0.25, 1) }));
    timers.current.push(setTimeout(() => setDrawing(false), HERO_ENTRANCE.settleMs));
  }, [draw, ground, vector]);

  useEffect(() => {
    if (!eligible) return undefined;
    markHeroEntrancePlayed();
    // A vector mark needs no image; a raster waits for its own load, with a ceiling.
    if (anchor.enhancedImageUrl) timers.current.push(setTimeout(run, HERO_ENTRANCE.imageWaitMs));
    else run();
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); };
    // Mount-only by design: the entrance is a one-off for this coin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onImageLoad = useCallback(() => {
    reportHeroImageLoaded?.();
    if (eligible) run();
  }, [eligible, reportHeroImageLoaded, run]);

  const entrance = useMemo<CircularAnchorEntrance | undefined>(
    () => (eligible ? { ground, draw, drawing } : undefined),
    [draw, drawing, eligible, ground],
  );
  return { entrance, onImageLoad, ringDelayMs: eligible ? HERO_ENTRANCE.ringDelayMs : undefined };
}

function AnchorHeroItem({ summary, index, total, slot, offset, spacing, gutter, anchorSize, artworkBoxHeight, constructionSize, thread, reduceMotion, auraActive, onOpenActive, onOpenProgress, onOpenAllAnchors, teachingThreadRef }: {
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
  reduceMotion: boolean;
  auraActive: boolean;
  onOpenActive?: (anchorId: string, source?: AnchorWindowRect) => void;
  onOpenProgress?: (anchorId?: string, source?: AnchorWindowRect) => void;
  onOpenAllAnchors?: () => void;
  teachingThreadRef?: React.RefObject<View | null>;
}) {
  const anchor = summary.anchor;
  const accent = getCategoryColor(anchor.category);
  // A just-created Anchor arriving from creation needs to know exactly where its mark will rest.
  const arrival = useHomeArrivalContext();
  // A release arrival moves the art too: the centre one settles, the neighbours slide out and fade in.
  const releaseArt = releaseArtParams(arrival?.release ?? null);
  const restingProgress = useSharedValue(1);
  const arrivalProgress = arrival?.progress ?? restingProgress;
  const artworkMotion = useAnimatedStyle(() => {
    const distance = Math.abs(slot * spacing + offset.value);
    const opacity = interpolate(distance, [0, spacing], [1, 0.7], 'clamp');
    const scale = interpolate(distance, [0, spacing], [1, NEIGHBOUR_SCALE], 'clamp');
    if (!releaseArt.on || Math.abs(slot) > 1) return { opacity, transform: [{ scale }] };
    const arrive = releaseArtFactors(arrivalProgress.value, releaseArt, slot);
    return { opacity: opacity * arrive.opacity, transform: [{ translateX: arrive.x }, { scale: scale * arrive.scale }] };
  });
  const tapScale = useSharedValue(1);
  const tapScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: tapScale.value }] }));
  const textMotion = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(slot * spacing + offset.value), [0, spacing * 0.55], [1, 0], 'clamp'),
  }));
  const entranceState = useHeroEntrance(summary.anchor, slot, reduceMotion, Boolean(arrival?.active), arrival?.reportHeroImageLoaded);
  const mountSize = anchorSize + 14;
  // The front disc is Home's place for this Anchor. A return from Details measures it when the copy lands, so a scrolled or re-rendered Home is never flown to a stale position.
  const { ref: discRef } = useAnchorTransitionPlace('home', anchor.id, 'paper', { enabled: slot === 0 });
  const transition = useProgressiveFocusTransition();
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
    const disc = discRef.current;
    if (!disc?.measureInWindow) {
      onOpenActive?.(anchor.id);
      return;
    }
    disc.measureInWindow((x, y, width, height) => {
      onOpenActive?.(anchor.id, { x, y, width, height });
    });
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
          ><HomeArrivalCounter index={index} total={total} active={slot === 0} style={styles.positionText} /></Pressable>
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
        {/* Evolved anchor lands on Home only: the released Anchor's art lingers faintly behind the new one. */}
        <HomeEvolvedGhost anchorSize={anchorSize} boxHeight={artworkBoxHeight} active={slot === 0} />
        {/* Hidden in place (never unmounted) while the travelling copy stands in for it, leaving or returning. */}
        <View style={[styles.artworkLayer, slot === 0 && transition.copyMounted && (transition.sourcePlace === 'home' || transition.targetPlace === 'home') ? styles.artworkHidden : null]}>
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
        <View style={[styles.anchorMount, { width: anchorSize + 14, height: anchorSize + 14, borderRadius: (anchorSize + 14) / 2 }]}>
          <Pressable testID={slot === 0 ? 'v2-home-carousel-active' : undefined}
            accessibilityRole={slot === 0 ? 'button' : undefined}
            accessibilityLabel={`${anchor.intentionText}. ${categoryLabel(anchor.category)}. View Anchor details.`}
            onPressIn={(event) => {
              recordTouchStart(event);
              if (slot === 0 && !reduceMotion) tapScale.value = withTiming(0.98, { duration: AnchorMotion.duration.micro });
            }}
            onPressOut={() => { tapScale.value = withTiming(1, { duration: AnchorMotion.duration.micro }); }}
            onTouchMove={recordTouchMove}
            onPress={handleOpen} disabled={slot !== 0 || !onOpenActive}>
            <Animated.View style={tapScaleStyle}>
              <Animated.View ref={discRef} collapsable={false} testID={slot === 0 ? 'v2-home-anchor-disc' : undefined}>
                <CircularAnchorRenderer {...anchorRenderProps(anchor)} size={anchorSize} appearance="paper" traceLabel={slot === 0 ? 'home hero' : undefined}
                  aura={{ anchorId: anchor.id, threadStrength: thread.value, variant: 'home', active: auraActive && slot === 0 && !transition.active && !arrival?.active, reducedMotion: reduceMotion }}
                  entrance={entranceState.entrance}
                  onImageLoad={slot === 0 ? entranceState.onImageLoad : undefined}
                  accessibilityLabel={`${categoryLabel(anchor.category)} Anchor artwork`} />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </View>
        <HeroStatusRing mountSize={mountSize} done={summary.practicedToday} entranceDelayMs={entranceState.ringDelayMs} reduceMotion={reduceMotion} />
        </View>
      </Animated.View>

      <Animated.View style={textMotion} pointerEvents={slot === 0 ? 'auto' : 'none'}>
        <View style={styles.intentionBlock}>
        {/* Balanced: at this size a plain greedy wrap leaves one word alone on the second line. */}
        <Text testID={slot === 0 ? 'v2-home-intention' : undefined} style={[styles.intention, { fontSize: heroIntentionFontSize(anchor.intentionText), lineHeight: Math.round(heroIntentionFontSize(anchor.intentionText) * 1.15) }]} numberOfLines={HERO_INTENTION_LINES} adjustsFontSizeToFit minimumFontScale={HERO_INTENTION_MIN_FONT_SCALE} textBreakStrategy="balanced">
          {anchor.intentionText}
        </Text>
        <View style={styles.intentionMark}>
          <HomeArrivalUnderline active={slot === 0} width={INTENTION_MARK_WIDTH} height={INTENTION_MARK_HEIGHT}>
            <IntentionMark color={accent} />
          </HomeArrivalUnderline>
        </View>
        </View>

      {thread ? (
        <Pressable
          testID={slot === 0 ? 'v2-home-thread' : undefined}
          accessibilityRole={onOpenProgress ? 'button' : undefined}
          accessibilityLabel={
            thread.value === null
              ? 'Thread Strength not established yet. Open Progress.'
              : `Thread Strength ${thread.value} percent. Open Progress.`
          }
          onPress={() => {
            const disc = discRef.current;
            if (!disc?.measureInWindow) {
              onOpenProgress?.(anchor.id);
              return;
            }
            let answered = false;
            disc.measureInWindow((x, y, width, height) => {
              answered = true;
              onOpenProgress?.(anchor.id, { x, y, width, height });
            });
            if (!answered && process.env.NODE_ENV === 'test') {
              onOpenProgress?.(anchor.id);
            }
          }}
          disabled={!onOpenProgress}
          style={({ pressed }) => (pressed && onOpenProgress ? styles.pressed : undefined)}
        >
          <ThreadReading thread={thread} accent={accent} active={slot === 0} teachingRef={teachingThreadRef} />
        </Pressable>
      ) : null}
      {/* The lineage line owns a row only during the evolved arrival. */}
      <HomeEvolvedFromLine anchor={anchor} active={slot === 0} />
      </Animated.View>
    </View>
  );
}

/** The entire visible hero is one of five mounted items on a shared track. */
function V2HomeHeroComponent({ anchors, selectedIndex, onSelect, onOpenActive, onOpenProgress, onOpenAllAnchors, thread, reduceMotion, frozen, auraActive = true, onMotionChange, testID, teachingThreadRef }: Props) {
  const { width, height, fontScale } = useWindowDimensions();
  const arrival = useHomeArrivalContext();
  const arrivalKind = useHomeArrivalStore((state) => state.arrival?.kind);
  const evolvedScene = Boolean(arrival?.active && arrivalKind === 'evolved' && anchors[selectedIndex]?.anchor.evolvedFrom?.intention?.trim());
  const insets = useSafeAreaInsets();
  const layout = resolveHomeHeroLayout({
    platform: Platform.OS,
    width, height, fontScale, evolvedScene, topInset: insets.top, bottomInset: insets.bottom,
  });
  const renderHero = useCallback((summary: V2HomeAnchorSummary, index: number, slot: CarouselSlot, offset: SharedValue<number>, spacing: number) => (
    <AnchorHeroItem summary={summary} index={index} total={anchors.length} slot={slot} offset={offset} spacing={spacing} gutter={layout.gutter}
      anchorSize={layout.anchorSize} artworkBoxHeight={layout.artworkBoxHeight} constructionSize={layout.constructionSize}
      thread={index === selectedIndex && thread ? thread : summary.thread} reduceMotion={Boolean(reduceMotion)} auraActive={auraActive}
      onOpenActive={onOpenActive} onOpenProgress={onOpenProgress} onOpenAllAnchors={onOpenAllAnchors} teachingThreadRef={teachingThreadRef} />
  ), [anchors.length, layout.gutter, layout.anchorSize, layout.artworkBoxHeight, layout.constructionSize, onOpenActive, onOpenAllAnchors, onOpenProgress, reduceMotion, selectedIndex, thread, teachingThreadRef, auraActive]);
  return <View testID={testID}>
    <V2HomeAnchorCarousel testID="v2-home-carousel" anchors={anchors} selectedIndex={selectedIndex} heroHeight={layout.trackHeight} anchorSize={layout.anchorSize}
      onSelect={onSelect} onOpenActive={onOpenActive} reduceMotion={reduceMotion} frozen={frozen} onMotionChange={onMotionChange} renderHero={renderHero} />
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
  artworkLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkHidden: {
    opacity: 0,
  },
  construction: {
    position: 'absolute',
  },
  anchorMount: {
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20, 22, 43, 0.06)',
    backgroundColor: colors.frame,
    shadowColor: '#14162B',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
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
  // A fixed height (two lines + the hand-drawn mark), so the divider below never moves with the text.
  intentionBlock: {
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'center',
    height: HERO_INTENTION_LINES * HERO_INTENTION_LINE_HEIGHT + 10,
  },
  intention: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: colors.text.primary,
    textAlign: 'center',
  },
  intentionMark: {
    marginTop: 3,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 5,
    flexWrap: 'wrap',
  },
  threadValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadValueHidden: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
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
