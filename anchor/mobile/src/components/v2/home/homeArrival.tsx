import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { useHomeArrivalStore, type ArrivalRect, type HomeArrival } from '@/stores/v2/homeArrivalStore';

/**
 * Home's side of the creation hand-off: the real Home, posed underneath creation, receives the
 * new Anchor where creation left it and assembles itself around it.
 *
 * One progress value (0 → 1) drives the whole arrival on the UI thread. Every Home region
 * reads it through a window of that progress, so the choreography is tuned here and nowhere
 * else, and a Home that is not arriving simply sits at 1.
 */
export const ARRIVAL_TIMING = {
  /** The whole arrival when the mark flies in from creation. */
  withFlight: 1700,
  /** The arrival when there is no flight (reduced motion, or no measurement). */
  withoutFlight: 700,
  /** Longest Home waits for its hero to be measured before posing without a target. */
  measureWait: 1000,
} as const;

/**
 * The flight's curve: leaves and lands gently, symmetric, so the eye can follow the same Anchor
 * the whole way. (An emphasized, front-loaded curve covered most of the distance in the first
 * frames — on device the flight read as a jump.) A function a worklet can call directly.
 */
const FLIGHT_EASING = Easing.bezierFn(0.45, 0, 0.25, 1);

/** Progress windows, as fractions of the arrival. */
const WINDOWS = {
  flight: [0, 0.52],
  environment: [0.1, 0.55],
  header: [0.3, 0.6],
  hero: [0.5, 0.72],
  overlayOut: [0.54, 0.72],
  lower: [0.58, 0.95],
} as const;
const WINDOWS_WITHOUT_FLIGHT = {
  ...WINDOWS,
  environment: [0, 0.5],
  header: [0.1, 0.6],
  hero: [0.1, 0.55],
  lower: [0.35, 1],
} as const;

type ArrivalContextValue = {
  /** True while an arrival is posed or playing for the Anchor Home is showing. */
  active: boolean;
  phase: HomeArrival['phase'] | null;
  progress: SharedValue<number>;
  /** The hero reports where the mark will rest (window coordinates). */
  reportTarget: (rect: ArrivalRect | null) => void;
};

const HomeArrivalContext = createContext<ArrivalContextValue | null>(null);

export function useHomeArrivalContext(): ArrivalContextValue | null {
  return useContext(HomeArrivalContext);
}

/**
 * Drives Home's arrival for the selected Anchor. Returns the provider value plus the styles
 * Home applies to its regions.
 */
export function useHomeArrival({
  selectedAnchorIds,
  onPose,
  reduceMotion,
}: {
  /** The id and localId of the Anchor Home is centred on. */
  selectedAnchorIds: Array<string | undefined>;
  /** Put Home in a state the mark can land in (top of the page, Home itself in front). */
  onPose: () => void;
  reduceMotion: boolean;
}) {
  const arrival = useHomeArrivalStore((state) => state.arrival);
  const active = Boolean(arrival && selectedAnchorIds.some((id) => id && id === arrival.anchorId));
  const flight = Boolean(active && arrival?.fromRect && !reduceMotion);
  const progress = useSharedValue(1);
  const poseRef = useRef(onPose);
  poseRef.current = onPose;

  // Pose: everything but the arriving mark is hidden, and Home reports ready once its hero
  // has said where the mark will rest (or after a short wait, without a target).
  const posedId = useRef<number | null>(null);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ready needs both ends of the flight: where the hero will hold the mark, and where the
  // overlay that carries it sits on screen.
  const pending = useRef<{ id?: number; target?: ArrivalRect | null; origin?: { x: number; y: number } }>({});
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const tryReady = useCallback(() => {
    const current = useHomeArrivalStore.getState().arrival;
    const { id, target, origin: known } = pending.current;
    const waiting = current?.phase === 'staging' || (current?.phase === 'ready' && !current.targetRect);
    if (!current || !waiting || id !== current.id || target === undefined || !known) return;
    if (waitTimer.current) clearTimeout(waitTimer.current);
    useHomeArrivalStore.getState().reportReady(current.id, target);
  }, []);

  useEffect(() => {
    if (!arrival || !active || arrival.phase !== 'staging' || posedId.current === arrival.id) return;
    posedId.current = arrival.id;
    cancelAnimation(progress);
    progress.value = 0;
    poseRef.current();
    const id = arrival.id;
    // Whatever is known by then, Home is posed: without both ends it arrives without a flight.
    waitTimer.current = setTimeout(() => useHomeArrivalStore.getState().reportReady(id, null), ARRIVAL_TIMING.measureWait);
    // Both ends may already be known (children report before this effect runs).
    tryReady();
  }, [active, arrival, progress, tryReady]);

  const reportTarget = useCallback((rect: ArrivalRect | null) => {
    const current = useHomeArrivalStore.getState().arrival;
    if (!current) return;
    // Measurements belong to one arrival; the overlay's own position outlives it.
    pending.current = { id: current.id, target: rect, origin: pending.current.origin };
    tryReady();
  }, [tryReady]);

  const reportOrigin = useCallback((point: { x: number; y: number }) => {
    pending.current.origin = point;
    setOrigin((previous) => (previous && previous.x === point.x && previous.y === point.y ? previous : point));
    tryReady();
  }, [tryReady]);

  // Play once creation lets go.
  const playedId = useRef<number | null>(null);
  useEffect(() => {
    if (!arrival || !active || arrival.phase !== 'arriving' || playedId.current === arrival.id) return undefined;
    playedId.current = arrival.id;
    const duration = flight && arrival.targetRect ? ARRIVAL_TIMING.withFlight : ARRIVAL_TIMING.withoutFlight;
    // Reduced motion is decided by the app (the flight is skipped above); the OS animator
    // scale must not silently collapse the arrival into a jump.
    progress.value = withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    const id = arrival.id;
    const done = setTimeout(() => {
      progress.value = 1;
      useHomeArrivalStore.getState().clear(id);
    }, duration + 60);
    return () => clearTimeout(done);
  }, [active, arrival, flight, progress]);

  // An arrival that ends or goes elsewhere never leaves Home half-assembled.
  useEffect(() => {
    if (active) return;
    if (waitTimer.current) clearTimeout(waitTimer.current);
    cancelAnimation(progress);
    progress.value = 1;
  }, [active, progress]);

  const windows = flight ? WINDOWS : WINDOWS_WITHOUT_FLIGHT;
  const fadeIn = (range: readonly [number, number], lift = 0) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const t = interpolate(progress.value, [range[0], range[1]], [0, 1], 'clamp');
      return lift ? { opacity: t, transform: [{ translateY: (1 - t) * lift }] } : { opacity: t };
    }, [range[0], range[1], lift]);

  const headerStyle = fadeIn(windows.header, -6);
  const environmentStyle = fadeIn(windows.environment);
  const heroStyle = fadeIn(windows.hero);
  const lowerStyle = fadeIn(windows.lower, 36);

  const context = useMemo<ArrivalContextValue>(
    () => ({ active, phase: active ? arrival?.phase ?? null : null, progress, reportTarget }),
    [active, arrival?.phase, progress, reportTarget],
  );

  return { context, headerStyle, environmentStyle, heroStyle, lowerStyle, arrival: active ? arrival : null, flight, origin, reportOrigin };
}

export function HomeArrivalProvider({ value, children }: { value: ArrivalContextValue; children: React.ReactNode }) {
  return <HomeArrivalContext.Provider value={value}>{children}</HomeArrivalContext.Provider>;
}

/** Share of the paper disc the mark occupies (CircularAnchorRenderer's paper artwork). */
const PAPER_ART_SHARE = 0.72;

/**
 * The arriving Anchor itself, drawn above Home from where creation left it to where the hero
 * will hold it: the same circle, structure, expression and (when one was kept) the same
 * chosen image as both ends of its path, so at each end it is indistinguishable from the
 * Anchor it stands in for. Both rects are the mark's own square; the circle is drawn around it.
 */
export const HomeArrivalOverlay = memo(function HomeArrivalOverlay({
  arrival,
  progress,
  origin,
  onOrigin,
}: {
  arrival: HomeArrival;
  progress: SharedValue<number>;
  /** This overlay's own window position, once measured. */
  origin: { x: number; y: number } | null;
  onOrigin: (point: { x: number; y: number }) => void;
}) {
  const hostRef = useRef<View>(null);
  const measureOrigin = useCallback(() => {
    hostRef.current?.measureInWindow?.((x, y) => {
      if (Number.isFinite(x) && Number.isFinite(y)) onOrigin({ x, y });
    });
  }, [onOrigin]);

  const from = arrival.fromRect;
  const to = arrival.targetRect;
  const size = to?.width ?? 0;
  const scaleFrom = from && to && to.width > 0 ? from.width / to.width : 1;
  const dx = from && to ? from.x + from.width / 2 - (to.x + to.width / 2) : 0;
  const dy = from && to ? from.y + from.height / 2 - (to.y + to.height / 2) : 0;

  const style = useAnimatedStyle(() => {
    const raw = interpolate(progress.value, [WINDOWS.flight[0], WINDOWS.flight[1]], [0, 1], 'clamp');
    const t = FLIGHT_EASING(raw);
    return {
      opacity: interpolate(progress.value, [WINDOWS.overlayOut[0], WINDOWS.overlayOut[1]], [1, 0], 'clamp'),
      transform: [
        { translateX: dx * (1 - t) },
        { translateY: dy * (1 - t) },
        { scale: scaleFrom + (1 - scaleFrom) * t },
      ],
    };
  }, [dx, dy, scaleFrom]);

  return (
    <View ref={hostRef} style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={measureOrigin} collapsable={false} testID="v2-home-arrival">
      {to && origin ? (
        <Animated.View style={[styles.mark, { left: to.x - origin.x, top: to.y - origin.y, width: size, height: size }, style]}>
          <View style={[styles.disc, { left: (size - size / PAPER_ART_SHARE) / 2, top: (size - size / PAPER_ART_SHARE) / 2 }]}>
            <CircularAnchorRenderer
              svg={arrival.svg}
              imageUrl={arrival.imageUrl}
              category={arrival.category}
              expression={arrival.expression}
              size={size / PAPER_ART_SHARE}
              appearance="paper"
              accessibilityLabel="Your new Anchor"
            />
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { position: 'absolute' },
  disc: { position: 'absolute' },
});
