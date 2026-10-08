import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  useAnimatedReaction,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { trace } from '@/utils/dev/creationTrace';
import { useHomeArrivalStore, type ArrivalRect, type HomeArrival, type HomeArrivalKind } from '@/stores/v2/homeArrivalStore';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { colors, typography } from '@/theme/v2';

/**
 * Home's side of the creation hand-off: the real Home, posed underneath creation, receives the
 * new Anchor where creation left it and assembles itself around it.
 *
 * One progress value (0 → 1) drives the whole arrival on the UI thread. Every Home region
 * reads it through a window of that progress, so the choreography is tuned here and nowhere
 * else, and a Home that is not arriving simply sits at 1.
 */
export const ARRIVAL_TIMING = {
  /** The whole arrival when a repeat Anchor flies in from creation. */
  withFlight: 1700,
  /**
   * The whole arrival when the user's first Anchor flies in: the Home share of the milestone
   * scene. The mark's flight covers the first part of it (see WINDOWS_FIRST).
   */
  firstWithFlight: 3400,
  /**
   * The whole arrival when a finished practice carries its Anchor back to Home ("Complete to Home",
   * about 2.4s from the tap). Its first 300ms are the complete screen fading its own chrome while
   * Home waits underneath; the mark's flight starts after that (see WINDOWS_PRACTICE).
   */
  practice: 2400,
  /** The arrival when there is no flight (reduced motion, or no measurement). */
  withoutFlight: 700,
  /** Longest Home waits for its hero to be measured before posing without a target. */
  measureWait: 1000,
  /** Longest the overlay stays over a hero whose image has not loaded, past when it would fade. */
  heroImageHold: 300,
  /** The overlay's cross-fade once the hero's image is ready. */
  holdRelease: 140,
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
/** The first Anchor's longer arrival: the mark flies over the first ~38% (about 1.3s of 3.4s). */
const WINDOWS_FIRST = {
  flight: [0, 0.38],
  environment: [0.1, 0.4],
  header: [0.35, 0.65],
  hero: [0.38, 0.55],
  overlayOut: [0.4, 0.55],
  lower: [0.55, 0.95],
} as const;

/** Milliseconds on the practice arrival's own clock, as a fraction of it. */
const practiceAt = (ms: number) => ms / ARRIVAL_TIMING.practice;

/**
 * Complete to Home. Prototype timeline, in ms from the tap on Close, mapped onto Home's regions:
 * - 0 to 300 the complete screen fades its own chrome (not Home's: Home is still underneath).
 * - 350 to 1100 the mark flies (the prototype starts at 100; it waits for the complete screen to
 *   finish fading and for the route to change, so it never starts out of sight).
 * - 400 to 1100 Home's header and ink lower panel arrive.
 * - 1100 to 1500 the hero arrives as one region (counter, neighbouring cards, Thread label and
 *   number: they live in one component), the mark hands over to the real one, and the number the
 *   complete screen showed fades out in place over 700 to 1300.
 * - 1400 to 1800 Today's card swaps to the new recommendation, only when it changed.
 */
const WINDOWS_PRACTICE = {
  flight: [practiceAt(350), practiceAt(1100)],
  environment: [practiceAt(400), practiceAt(1100)],
  header: [practiceAt(400), practiceAt(1100)],
  hero: [practiceAt(1100), practiceAt(1500)],
  overlayOut: [practiceAt(1150), practiceAt(1500)],
  lower: [practiceAt(400), practiceAt(1100)],
  swap: [practiceAt(1400), practiceAt(1800)],
  numberOut: [practiceAt(700), practiceAt(1300)],
} as const;

type ArrivalWindows = Record<keyof typeof WINDOWS, readonly [number, number]> & {
  /** Practice only: Today's card cross-fades to the new recommendation. */
  swap?: readonly [number, number];
  /** Practice only: the complete screen's figure fades out in place. */
  numberOut?: readonly [number, number];
};

/**
 * The window set an arrival plays through. Without a flight, the short crossfade is used for any
 * kind; a first Anchor's flight is stretched over its longer run, and a practice has its own.
 */
export function arrivalWindows(kind: HomeArrivalKind, flight: boolean): ArrivalWindows {
  if (!flight) return WINDOWS_WITHOUT_FLIGHT;
  if (kind === 'practice') return WINDOWS_PRACTICE;
  return kind === 'first' ? WINDOWS_FIRST : WINDOWS;
}

/** The whole arrival's length in ms for the flight that is actually played. */
export function arrivalDuration(kind: HomeArrivalKind, withFlight: boolean): number {
  if (!withFlight) return ARRIVAL_TIMING.withoutFlight;
  if (kind === 'first') return ARRIVAL_TIMING.firstWithFlight;
  return kind === 'practice' ? ARRIVAL_TIMING.practice : ARRIVAL_TIMING.withFlight;
}

/**
 * Practice arrivals that have already played in this process. A Home that remounts mid-arrival must
 * land settled rather than start the scene a second time (the coordinator id dedupes the request;
 * this stops the animation itself restarting).
 */
const playedPracticeArrivals = new Set<number>();
export function resetPlayedPracticeArrivalsForTests(): void {
  playedPracticeArrivals.clear();
}

/** The celebration coordinator's id for one arrival. */
export function homeArrivalCelebrationId(arrivalId: number): string {
  return `home-arrival:${arrivalId}`;
}

type ArrivalContextValue = {
  /** True while an arrival is posed or playing for the Anchor Home is showing. */
  active: boolean;
  phase: HomeArrival['phase'] | null;
  progress: SharedValue<number>;
  /** The hero reports where the mark will rest (window coordinates). */
  reportTarget: (rect: ArrivalRect | null) => void;
  /** The hero's finished artwork has loaded: the overlay may let go of it. */
  reportHeroImageLoaded: () => void;
  /** 1 while the overlay is held over the hero (the chosen image has not loaded there yet). */
  overlayHold: SharedValue<number>;
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
  const overlayHold = useSharedValue(0);
  const heroLoadedFor = useRef<number | null>(null);
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

  const releaseHold = useCallback(() => {
    overlayHold.value = withTiming(0, { duration: ARRIVAL_TIMING.holdRelease, reduceMotion: ReduceMotion.Never });
  }, [overlayHold]);

  const reportHeroImageLoaded = useCallback(() => {
    const current = useHomeArrivalStore.getState().arrival;
    if (!current) return;
    heroLoadedFor.current = current.id;
    trace('home hero image ready for arrival');
    if (current.phase === 'arriving') releaseHold();
  }, [releaseHold]);

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
    const kind = arrival.kind;
    if (kind === 'practice') {
      // A practice arrival starts once per process. A Home that remounts while it is playing lands
      // settled instead of starting it again (and must not leave the celebration entry behind).
      if (playedPracticeArrivals.has(arrival.id)) {
        cancelAnimation(progress);
        progress.value = 1;
        overlayHold.value = 0;
        useHomeArrivalStore.getState().clear(arrival.id);
        useCelebrationStore.getState().finish(homeArrivalCelebrationId(arrival.id));
        return undefined;
      }
      playedPracticeArrivals.add(arrival.id);
    }
    // The once-ever first-Anchor flag is written here, when a first arrival actually plays, so an
    // arrival that is staged and never plays does not use it up.
    if (kind === 'first') useTeachingStore.getState().setUserFlag('hasSeenFirstAnchorArrival', true);
    const windows = arrivalWindows(kind, flight);
    // Length and celebration level both follow the flight that is actually played.
    const withFlight = Boolean(flight && arrival.targetRect);
    const duration = arrivalDuration(kind, withFlight);
    // Reduced motion is decided by the app (the flight is skipped above); the OS animator
    // scale must not silently collapse the arrival into a jump.
    progress.value = withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    const id = arrival.id;
    const celebrationId = homeArrivalCelebrationId(id);

    // A finished image travels as itself: the overlay stays over the hero until the hero has the
    // same image on screen, so Home never shows the hero empty or falling back to raw geometry.
    // Bounded: past when the overlay would have faded, it waits at most heroImageHold more.
    // A practice returns to a hero Home has already drawn with that image, so it never waits for a load.
    const mustHold = kind !== 'practice' && Boolean(arrival.imageUrl) && heroLoadedFor.current !== id;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    if (mustHold) {
      overlayHold.value = 1;
      holdTimer = setTimeout(releaseHold, duration * windows.overlayOut[0] + ARRIVAL_TIMING.heroImageHold);
    } else {
      overlayHold.value = 0;
    }
    // Clearing the arrival removes the overlay, so it must not outlive a held image.
    const done = setTimeout(() => {
      progress.value = 1;
      useHomeArrivalStore.getState().clear(id);
      useCelebrationStore.getState().finish(celebrationId);
    }, duration + 60 + (mustHold ? ARRIVAL_TIMING.heroImageHold : 0));

    // Skip, or a higher celebration preempting this one, lands the arrival on its settled state.
    const onSkip = () => {
      clearTimeout(done);
      if (holdTimer) clearTimeout(holdTimer);
      cancelAnimation(progress);
      cancelAnimation(overlayHold);
      progress.value = 1;
      overlayHold.value = 0;
      useHomeArrivalStore.getState().clear(id);
    };
    // A first Anchor that flies is a major moment (level 4). A repeat Anchor, a practice returning
    // to Home, and any crossfade such as Reduce Motion's, is a reinforcement (level 2). An arrival is a state change, so it plays
    // whatever the answer; a 'deferred' entry is released when it ends (finish above and in the
    // cleanup), so no stale queue entry remains.
    const level = kind === 'first' && withFlight ? 4 : 2;
    const outcome = useCelebrationStore.getState().request(level, celebrationId, { durationMs: duration, onSkip });
    trace(`arrival celebration ${outcome}`);

    return () => {
      clearTimeout(done);
      if (holdTimer) clearTimeout(holdTimer);
      useCelebrationStore.getState().finish(celebrationId);
    };
  }, [active, arrival, flight, overlayHold, progress, releaseHold]);

  // Dev trace: when the arrival crosses the overlay hand-off and when it ends.
  const traceProgress = useCallback((mark: string) => trace(`arrival progress ${mark}`), []);
  useAnimatedReaction(
    () => (progress.value >= 1 ? 2 : progress.value >= 0.52 ? 1 : 0),
    (stage, previous) => {
      if (previous !== null && stage > previous) runOnJS(traceProgress)(stage === 2 ? '1' : '0.52');
    },
    [traceProgress],
  );

  // An arrival that ends or goes elsewhere never leaves Home half-assembled.
  useEffect(() => {
    if (active) return;
    if (waitTimer.current) clearTimeout(waitTimer.current);
    cancelAnimation(progress);
    progress.value = 1;
  }, [active, progress]);

  const windows = arrivalWindows(arrival?.kind ?? 'repeat', flight);
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

  // Today's card swap (practice only): the card Home showed before this completion fades out as the
  // new one fades in. Without a swap window both sit at their settled values (new shown, old hidden).
  const swapWindow = windows.swap;
  const swapInStyle = useAnimatedStyle(() => {
    if (!swapWindow) return { opacity: 1 };
    return { opacity: interpolate(progress.value, [swapWindow[0], swapWindow[1]], [0, 1], 'clamp') };
  }, [swapWindow?.[0], swapWindow?.[1]]);
  const swapOutStyle = useAnimatedStyle(() => {
    if (!swapWindow) return { opacity: 0 };
    return { opacity: interpolate(progress.value, [swapWindow[0], swapWindow[1]], [1, 0], 'clamp') };
  }, [swapWindow?.[0], swapWindow?.[1]]);

  const context = useMemo<ArrivalContextValue>(
    () => ({ active, phase: active ? arrival?.phase ?? null : null, progress, reportTarget, reportHeroImageLoaded, overlayHold }),
    [active, arrival?.phase, overlayHold, progress, reportHeroImageLoaded, reportTarget],
  );

  return {
    context,
    headerStyle,
    environmentStyle,
    heroStyle,
    lowerStyle,
    swapInStyle,
    swapOutStyle,
    /** True when this arrival plays Today's card swap (a practice that flies). */
    swapsToday: Boolean(active && swapWindow),
    arrival: active ? arrival : null,
    flight,
    origin,
    reportOrigin,
  };
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
  hold,
  flight,
}: {
  arrival: HomeArrival;
  progress: SharedValue<number>;
  /** 1 while the overlay must stay over a hero whose image is still loading. */
  hold?: SharedValue<number>;
  /** Whether the mark travels from creation (the hook's `flight`). Defaults to having a from-rect. */
  flight?: boolean;
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

  // The flight and the hand-off to Home read the window set of this arrival's kind, so a first
  // Anchor's longer arrival is not cut short by the repeat timing.
  const windows = arrivalWindows(arrival.kind, flight ?? Boolean(from));
  const [flightStart, flightEnd] = windows.flight;
  const [overlayOutStart, overlayOutEnd] = windows.overlayOut;
  // Practice only, and only while the mark flies: the complete screen's figure fades out in place.
  const numberOut = windows.numberOut;
  const ghost = arrival.kind === 'practice' && numberOut ? arrival.number ?? null : null;
  const glow = arrival.kind === 'practice' ? arrival.glow ?? null : null;

  const ghostStyle = useAnimatedStyle(() => {
    if (!numberOut) return { opacity: 0 };
    return { opacity: interpolate(progress.value, [numberOut[0], numberOut[1]], [1, 0], 'clamp') };
  }, [numberOut?.[0], numberOut?.[1]]);

  const style = useAnimatedStyle(() => {
    const raw = interpolate(progress.value, [flightStart, flightEnd], [0, 1], 'clamp');
    const t = FLIGHT_EASING(raw);
    return {
      opacity: Math.max(
        interpolate(progress.value, [overlayOutStart, overlayOutEnd], [1, 0], 'clamp'),
        hold ? hold.value : 0,
      ),
      transform: [
        { translateX: dx * (1 - t) },
        { translateY: dy * (1 - t) },
        { scale: scaleFrom + (1 - scaleFrom) * t },
      ],
    };
  }, [dx, dy, scaleFrom, hold, flightStart, flightEnd, overlayOutStart, overlayOutEnd]);

  return (
    <View ref={hostRef} style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={measureOrigin} collapsable={false} testID="v2-home-arrival">
      {to && origin ? (
        <Animated.View style={[styles.mark, { left: to.x - origin.x, top: to.y - origin.y, width: size, height: size }, style]}>
          {glow ? (
            // The complete screen's glow rides with the mark, so the same glow arrives; it fades out
            // with the overlay as Home's own halo fades in beneath.
            <View
              testID="v2-home-arrival-glow"
              style={[styles.glow, {
                width: size * glow.scale,
                height: size * glow.scale,
                borderRadius: (size * glow.scale) / 2,
                left: (size - size * glow.scale) / 2,
                top: (size - size * glow.scale) / 2,
                backgroundColor: glow.color,
                opacity: glow.opacity,
              }]}
            />
          ) : null}
          <View style={[styles.disc, { left: (size - size / PAPER_ART_SHARE) / 2, top: (size - size / PAPER_ART_SHARE) / 2 }]}>
            <CircularAnchorRenderer
              svg={arrival.svg}
              imageUrl={arrival.imageUrl}
              category={arrival.category}
              expression={arrival.expression}
              size={size / PAPER_ART_SHARE}
              appearance="paper"
              traceLabel="arrival overlay"
              accessibilityLabel={arrival.kind === 'practice' ? `${arrival.category ?? 'Custom'} Anchor artwork` : 'Your new Anchor'}
            />
          </View>
        </Animated.View>
      ) : null}
      {ghost && origin ? (
        <Animated.Text
          testID="v2-home-arrival-number"
          numberOfLines={1}
          style={[
            styles.number,
            { left: ghost.rect.x - origin.x, top: ghost.rect.y - origin.y, width: ghost.rect.width, height: ghost.rect.height },
            ghostStyle,
          ]}
        >
          {ghost.text}
        </Animated.Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { position: 'absolute' },
  disc: { position: 'absolute' },
  glow: { position: 'absolute' },
  // The complete screen's figure (its `strengthValue` style), held where it stood.
  number: {
    position: 'absolute',
    ...typography.headingMD,
    fontFamily: typography.display,
    fontSize: 18,
    color: colors.text.primary,
  },
});
