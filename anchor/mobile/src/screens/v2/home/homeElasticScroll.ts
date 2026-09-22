import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Home's scroll physics — "a weighted instrument, not a trampoline".
 *
 * iOS already has this natively (bounce + momentum), so on iOS this hook is
 * inert and the ScrollView keeps its own behaviour.
 *
 * Android's native edge effect is either the Android 12 *stretch*, which
 * scales the content (and so distorts the Anchor artwork and type), or
 * nothing at all — which is what made Home feel clamped. Android therefore
 * turns the native effect off and gets a small resisted displacement of the
 * whole composition instead:
 *
 *  - Dragging past an edge moves the content by a rubber-banded amount that
 *    grows ever more slowly (asymptotic to `ELASTIC.limit`).
 *  - A fling that reaches an edge carries a little of its speed past it and
 *    settles back — the feel of the momentum being absorbed.
 *  - Release returns on a near-critically-damped spring: quick, no wobble.
 *
 * All of it runs on the UI thread (gesture + scroll worklets), and the native
 * scroll gesture stays in charge of scrolling itself: the pan runs
 * simultaneously and only contributes a transform at the edges.
 */
export const ELASTIC = {
  /** Asymptotic maximum displacement in dp. The user feels it more than sees it. */
  limit: 120,
  /** How quickly resistance builds; lower is stiffer. */
  resistance: 0.5,
  /** Fling-into-edge carry: dp of displacement per dp travelled in the arriving frame. */
  flingCarry: 1.1,
  /** Cap on the fling carry, in dp. */
  flingMax: 22,
  /** Time the fling carry takes to spend itself before the spring returns it. */
  flingOutMs: 120,
  /** ζ ≈ 0.97: settles in one smooth motion with no visible overshoot. */
  spring: { stiffness: 240, damping: 30, mass: 1 },
} as const;

const ELASTIC_ENABLED = Platform.OS === 'android';

/** Rubber-band curve: linear-ish for small pulls, flattening toward `limit`. */
export function rubberBand(distance: number, limit: number = ELASTIC.limit, resistance: number = ELASTIC.resistance): number {
  'worklet';
  if (distance <= 0) return 0;
  return (1 - 1 / ((distance * resistance) / limit + 1)) * limit;
}

export function useHomeElasticScroll() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const maxScroll = useSharedValue(0);
  const overscroll = useSharedValue(0);
  /** The pan translation at which the current pull past an edge began. */
  const pullOrigin = useSharedValue(0);
  /** -1 pulling past the bottom, 0 not at an edge, 1 pulling past the top. */
  const pullEdge = useSharedValue(0);
  const momentum = useSharedValue(false);
  const lastY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      maxScroll.value = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
      const previous = lastY.value;
      lastY.value = y;
      scrollY.value = y;
      if (!ELASTIC_ENABLED || !momentum.value) return;

      const hitTop = y <= 0 && previous > 0;
      const hitBottom = maxScroll.value > 0 && y >= maxScroll.value && previous < maxScroll.value;
      if (!hitTop && !hitBottom) return;

      // The last event's travel stands in for arrival speed. It is read on the
      // UI thread every frame, so it tracks the fling without JS round trips.
      const carry = Math.min(ELASTIC.flingMax, Math.abs(y - previous) * ELASTIC.flingCarry);
      if (carry < 2) return;
      overscroll.value = withSequence(
        withTiming(hitTop ? carry : -carry, { duration: ELASTIC.flingOutMs, easing: Easing.out(Easing.quad) }),
        withSpring(0, ELASTIC.spring),
      );
    },
    onBeginDrag: () => {
      momentum.value = false;
    },
    onMomentumBegin: () => {
      momentum.value = true;
    },
    onMomentumEnd: () => {
      momentum.value = false;
    },
  });

  const nativeScroll = useMemo(() => Gesture.Native(), []);

  const elasticPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(ELASTIC_ENABLED)
        .activeOffsetY([-6, 6])
        .failOffsetX([-14, 14])
        .simultaneousWithExternalGesture(nativeScroll)
        .onStart((event) => {
          pullOrigin.value = event.translationY;
          pullEdge.value = 0;
        })
        .onUpdate((event) => {
          const atTop = scrollY.value <= 0.5;
          const atBottom = scrollY.value >= maxScroll.value - 0.5;

          if (pullEdge.value === 0) {
            const delta = event.translationY - pullOrigin.value;
            if (atTop && delta > 0) pullEdge.value = 1;
            else if (atBottom && maxScroll.value > 0 && delta < 0) pullEdge.value = -1;
            else {
              // Not past an edge: keep the origin under the finger so a pull
              // starts from wherever the content actually meets the edge.
              pullOrigin.value = event.translationY;
              return;
            }
          }

          const pulled = (event.translationY - pullOrigin.value) * pullEdge.value;
          if (pulled <= 0) {
            // Pushed back through the edge: hand the drag back to native scrolling.
            overscroll.value = 0;
            pullEdge.value = 0;
            pullOrigin.value = event.translationY;
            return;
          }
          overscroll.value = rubberBand(pulled) * pullEdge.value;
          // Hold the native scroll at the edge while the composition is pulled
          // past it; otherwise reversing the drag would scroll AND relax.
          scrollTo(scrollRef, 0, pullEdge.value === 1 ? 0 : maxScroll.value, false);
        })
        .onFinalize(() => {
          pullEdge.value = 0;
          if (overscroll.value !== 0) overscroll.value = withSpring(0, ELASTIC.spring);
        }),
    [maxScroll, nativeScroll, overscroll, pullEdge, pullOrigin, scrollRef, scrollY],
  );

  const elasticStyle = useAnimatedStyle(() => ({ transform: [{ translateY: overscroll.value }] }));

  return {
    enabled: ELASTIC_ENABLED,
    scrollRef,
    onScroll,
    nativeScroll,
    elasticPan,
    elasticStyle,
  };
}
