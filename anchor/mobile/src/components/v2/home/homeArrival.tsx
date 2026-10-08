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
import {
  isFlightlessArrivalKind,
  useHomeArrivalStore,
  type ArrivalGhost,
  type ArrivalRect,
  type HomeArrival,
  type HomeArrivalKind,
} from '@/stores/v2/homeArrivalStore';
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
  /**
   * The whole arrival when a Release ending returns to Home ("Return Home", about 2.2s from the tap).
   * Its first 600ms are the ending fading its own chrome over the cream paper while Home waits
   * underneath; no mark flies, because the released Anchor is gone (see WINDOWS_RELEASE).
   */
  release: 2200,
  /**
   * The whole arrival when an Evolved ending continues to the new Anchor on Home (EV1, about 3.4s). It is
   * the repeat-Anchor arrival without a flight (the ending shows no mark to fly from), plus the released
   * Anchor's artwork lingering behind, the underline drawing and one line (see WINDOWS_EVOLVED).
   */
  evolved: 3400,
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
/** The no-flight arrivals' ease-out (prototype cubic-bezier(.2,.8,.2,1)) and the lower panel's ease in-out. */
const OUT_EASING = Easing.bezierFn(0.2, 0.8, 0.2, 1);
const SLIDE_EASING = Easing.bezierFn(0.7, 0, 0.2, 1);
/** How far below its rest the ink lower panel starts on a release (the prototype's 380px). */
export const LOWER_SLIDE_DISTANCE = 380;
/** Where the hero's art starts on a release; it settles to 1 as the hero arrives. */
export const ART_ARRIVAL_SCALE = 0.94;
/** How far (px) the carousel neighbours travel out to their resting places on a release. */
export const NEIGHBOUR_ARRIVAL_SHIFT = 55;

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

/** Milliseconds on the release arrival's own clock, as a fraction of it. */
const releaseAt = (ms: number) => ms / ARRIVAL_TIMING.release;

/**
 * Return Home (RL1). Prototype timeline, in ms from the tap on Return Home. No mark flies: the Anchor
 * that was released is gone, so the flight and overlay windows below are never read.
 * - 0 to 120 the Return Home button scales .97 and 150 to 600 the ending's ghost, words and buttons
 *   fade (both the ending's own, over its cream paper, which holds until the route changes at 600:
 *   Home is cream too, so there is no frame of anything else).
 * - 400 to 1100 the next Anchor's header, Thread Strength and art arrive. The first 200ms of that are
 *   under the ending's paper, so Home's own window starts where the route changes (600): the same end,
 *   without a first visible frame already partway in.
 * - 550 to 1250 the ink lower panel slides up from 380 below (ease in-out).
 * - 600 to 1200 the carousel neighbours slide out to their resting places and fade in, closing the gap.
 * - 800 to 1200 the counter rolls down by one (only when Home now counts fewer).
 * The art settles from .94 to 1 as the hero arrives. Everything but the lower panel eases out.
 */
const WINDOWS_RELEASE = {
  flight: [0, 1],
  environment: [releaseAt(600), releaseAt(1100)],
  header: [releaseAt(600), releaseAt(1100)],
  hero: [releaseAt(600), releaseAt(1100)],
  overlayOut: [0, 1],
  lower: [releaseAt(550), releaseAt(1250)],
  lowerSlide: LOWER_SLIDE_DISTANCE,
  art: [releaseAt(600), releaseAt(1100)],
  neighbours: [releaseAt(600), releaseAt(1200)],
  counter: [releaseAt(800), releaseAt(1200)],
  easeOut: true,
} as const;

/** Milliseconds on the evolved arrival's own clock, as a fraction of it. */
const evolvedAt = (ms: number) => ms / ARRIVAL_TIMING.evolved;

/**
 * Evolved anchor lands on Home (EV1). Prototype timeline in ms from the start of the arrival: the
 * repeat-Anchor arrival with no flight, so its regions arrive in place (the art and text 150 to 1100,
 * the header 1000 to 1500, the ink panel 500 to 1250) and the counter does not move (one released, one
 * new). Added to it:
 * - the released Anchor's art lingers faintly behind the new one (opacity .22), fading in 1000 to 1400
 *   and dissolving 2100 to 2800;
 * - the underline draws 1300 to 1900;
 * - one line under the intention fades in 2200 to 2800 (ease-out) and stays.
 * Thread Strength starts at day one and there is no wake note: that belongs to the first practice.
 */
const WINDOWS_EVOLVED = {
  flight: [0, 1],
  environment: [0, evolvedAt(150)],
  header: [evolvedAt(1000), evolvedAt(1500)],
  hero: [evolvedAt(150), evolvedAt(1100)],
  overlayOut: [0, 1],
  lower: [evolvedAt(500), evolvedAt(1250)],
  ghostIn: [evolvedAt(1000), evolvedAt(1400)],
  ghostOut: [evolvedAt(2100), evolvedAt(2800)],
  underline: [evolvedAt(1300), evolvedAt(1900)],
  line: [evolvedAt(2200), evolvedAt(2800)],
  easeOut: true,
} as const;

export type ArrivalWindows = Record<keyof typeof WINDOWS, readonly [number, number]> & {
  /** Practice only: Today's card cross-fades to the new recommendation. */
  swap?: readonly [number, number];
  /** Practice only: the complete screen's figure fades out in place. */
  numberOut?: readonly [number, number];
  /** Release only: the hero's art settles from ART_ARRIVAL_SCALE to 1. */
  art?: readonly [number, number];
  /** Release only: the carousel neighbours slide out to their places and fade in. */
  neighbours?: readonly [number, number];
  /** Release only: the counter rolls down by one. */
  counter?: readonly [number, number];
  /** Release only: the lower panel slides up from this far below (px) instead of fading in. */
  lowerSlide?: number;
  /** Evolved only: the released Anchor's art fades in behind the new one, then dissolves. */
  ghostIn?: readonly [number, number];
  ghostOut?: readonly [number, number];
  /** Evolved only: the underline draws. */
  underline?: readonly [number, number];
  /** Evolved only: the lineage line fades in. */
  line?: readonly [number, number];
  /** Release and evolved: the regions ease out (the prototype's cubic-bezier(.2,.8,.2,1)) rather than moving linearly. */
  easeOut?: boolean;
};

/**
 * The window set an arrival plays through. Without a flight, the short crossfade is used for any
 * kind; a first Anchor's flight is stretched over its longer run, a practice has its own, and a
 * release and an evolved arrival each have their own no-flight set (Reduce Motion falls back to the
 * short crossfade).
 */
export function arrivalWindows(kind: HomeArrivalKind, flight: boolean, reduceMotion = false): ArrivalWindows {
  if (kind === 'release') return reduceMotion ? WINDOWS_WITHOUT_FLIGHT : WINDOWS_RELEASE;
  if (kind === 'evolved') return reduceMotion ? WINDOWS_WITHOUT_FLIGHT : WINDOWS_EVOLVED;
  if (!flight) return WINDOWS_WITHOUT_FLIGHT;
  if (kind === 'practice') return WINDOWS_PRACTICE;
  return kind === 'first' ? WINDOWS_FIRST : WINDOWS;
}

/** The whole arrival's length in ms for the flight (or, for a release or evolved arrival, the motion) that is actually played. */
export function arrivalDuration(kind: HomeArrivalKind, withFlight: boolean, reduceMotion = false): number {
  if (kind === 'release') return reduceMotion ? ARRIVAL_TIMING.withoutFlight : ARRIVAL_TIMING.release;
  if (kind === 'evolved') return reduceMotion ? ARRIVAL_TIMING.withoutFlight : ARRIVAL_TIMING.evolved;
  if (!withFlight) return ARRIVAL_TIMING.withoutFlight;
  if (kind === 'first') return ARRIVAL_TIMING.firstWithFlight;
  return kind === 'practice' ? ARRIVAL_TIMING.practice : ARRIVAL_TIMING.withFlight;
}

/**
 * Practice, release and evolved arrivals that have already played in this process. A Home that remounts
 * mid-arrival must land settled rather than start the scene a second time (the coordinator id
 * dedupes the request; this stops the animation itself restarting).
 */
const playedPracticeArrivals = new Set<number>();
export function resetPlayedPracticeArrivalsForTests(): void {
  playedPracticeArrivals.clear();
}

/** The celebration coordinator's id for one arrival. */
export function homeArrivalCelebrationId(arrivalId: number): string {
  return `home-arrival:${arrivalId}`;
}

/**
 * What the regions inside the hero need from a release arrival: the windows they read the shared
 * progress through, and how many Anchors Home counted before. Null for every other arrival.
 */
export type ReleaseArrivalMotion = {
  windows: ArrivalWindows;
  countBefore: number | null;
};

/**
 * What the regions inside the hero need from an evolved arrival: the windows they read the shared
 * progress through, and the released Anchor's artwork for the ghost (null: no ghost). Null for every
 * other arrival, and for Reduce Motion, where the regions sit at their settled values.
 */
export type EvolvedArrivalMotion = {
  windows: ArrivalWindows;
  ghost: ArrivalGhost | null;
};

type ArrivalContextValue = {
  /** True while an arrival is posed or playing for the Anchor Home is showing. */
  active: boolean;
  phase: HomeArrival['phase'] | null;
  /** The release arrival's motion, once it is active (and playing its own timeline, not the crossfade). */
  release: ReleaseArrivalMotion | null;
  /** The evolved arrival's motion, once it is active (and playing its own timeline, not the crossfade). */
  evolved: EvolvedArrivalMotion | null;
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
  // A release has no Anchor of its own to name: Home arrives on whichever Anchor it now selects.
  const active = Boolean(arrival && (arrival.kind === 'release'
    ? selectedAnchorIds.some(Boolean)
    : selectedAnchorIds.some((id) => id && id === arrival.anchorId)));
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
    // Nothing lands on a release, so there is nothing to measure: Home is ready the moment it is posed.
    if (isFlightlessArrivalKind(arrival.kind)) {
      useHomeArrivalStore.getState().reportReady(id, null);
      return;
    }
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
    if (kind === 'practice' || kind === 'release' || kind === 'evolved') {
      // A practice, release or evolved arrival starts once per process. A Home that remounts while it is playing
      // lands settled instead of starting it again (and must not leave the celebration entry behind).
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
    const windows = arrivalWindows(kind, flight, reduceMotion);
    // Length and celebration level both follow the flight that is actually played.
    const withFlight = Boolean(flight && arrival.targetRect);
    const duration = arrivalDuration(kind, withFlight, reduceMotion);
    // Reduced motion is decided by the app (the flight is skipped above); the OS animator
    // scale must not silently collapse the arrival into a jump.
    progress.value = withTiming(1, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    const id = arrival.id;
    const celebrationId = homeArrivalCelebrationId(id);

    // A finished image travels as itself: the overlay stays over the hero until the hero has the
    // same image on screen, so Home never shows the hero empty or falling back to raw geometry.
    // Bounded: past when the overlay would have faded, it waits at most heroImageHold more.
    // A practice returns to a hero Home has already drawn with that image, so it never waits for a load.
    const mustHold = kind !== 'practice' && !isFlightlessArrivalKind(kind) && Boolean(arrival.imageUrl) && heroLoadedFor.current !== id;
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
    // to Home, a release returning to Home, and any crossfade such as Reduce Motion's, is a reinforcement
    // (level 2). An arrival is a state change, so it plays
    // whatever the answer; a 'deferred' entry is released when it ends (finish above and in the
    // cleanup), so no stale queue entry remains.
    // The evolved ending's arrival is a milestone (level 3, skippable) unless Reduce Motion shortens it to a crossfade.
    const level = kind === 'first' && withFlight ? 4 : kind === 'evolved' && !reduceMotion ? 3 : 2;
    const outcome = useCelebrationStore.getState().request(level, celebrationId, { durationMs: duration, onSkip });
    trace(`arrival celebration ${outcome}`);

    return () => {
      clearTimeout(done);
      if (holdTimer) clearTimeout(holdTimer);
      useCelebrationStore.getState().finish(celebrationId);
    };
  }, [active, arrival, flight, overlayHold, progress, reduceMotion, releaseHold]);

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

  const windows = arrivalWindows(arrival?.kind ?? 'repeat', flight, reduceMotion);
  const easeOut = Boolean(windows.easeOut);
  const fadeIn = (range: readonly [number, number], lift = 0) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const linear = interpolate(progress.value, [range[0], range[1]], [0, 1], 'clamp');
      const t = easeOut ? OUT_EASING(linear) : linear;
      return lift ? { opacity: t, transform: [{ translateY: (1 - t) * lift }] } : { opacity: t };
    }, [range[0], range[1], lift, easeOut]);

  const headerStyle = fadeIn(windows.header, -6);
  const environmentStyle = fadeIn(windows.environment);
  const heroStyle = fadeIn(windows.hero);
  // The release's ink panel rises from far below (ease in-out) rather than fading in; every other
  // arrival keeps its fade and short lift.
  const lowerSlide = windows.lowerSlide ?? 0;
  const [lowerStart, lowerEnd] = windows.lower;
  const lowerStyle = useAnimatedStyle(() => {
    const linear = interpolate(progress.value, [lowerStart, lowerEnd], [0, 1], 'clamp');
    if (lowerSlide) return { opacity: 1, transform: [{ translateY: (1 - SLIDE_EASING(linear)) * lowerSlide }] };
    return { opacity: linear, transform: [{ translateY: (1 - linear) * 36 }] };
  }, [lowerStart, lowerEnd, lowerSlide]);

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

  // Only a release that plays its own timeline carries motion for the hero's regions (the counter, the
  // neighbours, the art); under Reduce Motion they sit at their settled values and the region fades.
  const releaseMotion = useMemo<ReleaseArrivalMotion | null>(
    () => (active && arrival?.kind === 'release' && windows.neighbours
      ? { windows, countBefore: arrival.countBefore ?? null }
      : null),
    // `windows` is one of a few module constants; the arrival's id is what changes between arrivals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, arrival?.id, arrival?.kind, arrival?.countBefore, windows],
  );
  const evolvedMotion = useMemo<EvolvedArrivalMotion | null>(
    () => (active && arrival?.kind === 'evolved' && windows.line
      ? { windows, ghost: arrival.ghost ?? null }
      : null),
    // `windows` is one of a few module constants; the arrival's id is what changes between arrivals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, arrival?.id, arrival?.kind, arrival?.ghost, windows],
  );
  const context = useMemo<ArrivalContextValue>(
    () => ({ active, phase: active ? arrival?.phase ?? null : null, release: releaseMotion, evolved: evolvedMotion, progress, reportTarget, reportHeroImageLoaded, overlayHold }),
    [active, arrival?.phase, evolvedMotion, overlayHold, progress, releaseMotion, reportHeroImageLoaded, reportTarget],
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

/** A window's progress (0 to 1) on the release arrival's ease-out. Runs on the UI thread. */
export function releaseWindowProgress(progress: number, start: number, end: number): number {
  'worklet';
  return OUT_EASING(interpolate(progress, [start, end], [0, 1], 'clamp'));
}

/** The release windows the hero's art reads, as plain numbers a worklet can close over. */
export function releaseArtParams(motion: ReleaseArrivalMotion | null) {
  const art = motion?.windows.art;
  const neighbours = motion?.windows.neighbours;
  return {
    on: Boolean(art && neighbours),
    artStart: art?.[0] ?? 0,
    artEnd: art?.[1] ?? 1,
    nbStart: neighbours?.[0] ?? 0,
    nbEnd: neighbours?.[1] ?? 1,
  };
}

/**
 * What a release arrival does to one carousel item's art: the centre Anchor settles from .94 to 1; a
 * neighbour (slot -1 or 1) slides out from NEIGHBOUR_ARRIVAL_SHIFT closer to the centre to its resting
 * place while it fades in, which is how the gap the released Anchor left closes. Runs on the UI thread.
 */
export function releaseArtFactors(
  progress: number,
  params: ReturnType<typeof releaseArtParams>,
  slot: -1 | 0 | 1,
): { opacity: number; scale: number; x: number } {
  'worklet';
  if (slot === 0) {
    const t = releaseWindowProgress(progress, params.artStart, params.artEnd);
    return { opacity: 1, scale: ART_ARRIVAL_SCALE + (1 - ART_ARRIVAL_SCALE) * t, x: 0 };
  }
  const t = releaseWindowProgress(progress, params.nbStart, params.nbEnd);
  return { opacity: t, scale: 1, x: -slot * NEIGHBOUR_ARRIVAL_SHIFT * (1 - t) };
}

/** The released Anchor's art lingers behind the new one at this opacity (EV1). */
export const EVOLVED_GHOST_OPACITY = 0.22;
/** How much larger than the hero's disc the ghost is, so a ring of it shows around the new art. */
export const EVOLVED_GHOST_SCALE = 1.33;

/** The evolved windows the hero's extras read, as plain numbers a worklet can close over. */
export function evolvedParams(motion: EvolvedArrivalMotion | null) {
  const w = motion?.windows;
  return {
    on: Boolean(w?.line),
    ghostInStart: w?.ghostIn?.[0] ?? 0,
    ghostInEnd: w?.ghostIn?.[1] ?? 1,
    ghostOutStart: w?.ghostOut?.[0] ?? 1,
    ghostOutEnd: w?.ghostOut?.[1] ?? 1,
    underlineStart: w?.underline?.[0] ?? 0,
    underlineEnd: w?.underline?.[1] ?? 1,
    lineStart: w?.line?.[0] ?? 0,
    lineEnd: w?.line?.[1] ?? 1,
  };
}

/** The ghost's opacity: in over its first window, out over its second. Zero once the arrival has settled. Runs on the UI thread. */
export function evolvedGhostOpacity(progress: number, params: ReturnType<typeof evolvedParams>): number {
  'worklet';
  const into = interpolate(progress, [params.ghostInStart, params.ghostInEnd], [0, 1], 'clamp');
  const out = interpolate(progress, [params.ghostOutStart, params.ghostOutEnd], [0, 1], 'clamp');
  return EVOLVED_GHOST_OPACITY * into * (1 - out);
}

/** How much of the underline is drawn (0 to 1), eased out. Runs on the UI thread. */
export function evolvedUnderlineProgress(progress: number, params: ReturnType<typeof evolvedParams>): number {
  'worklet';
  return releaseWindowProgress(progress, params.underlineStart, params.underlineEnd);
}

/** The lineage line's opacity (0 to 1), eased out. Runs on the UI thread. */
export function evolvedLineProgress(progress: number, params: ReturnType<typeof evolvedParams>): number {
  'worklet';
  return releaseWindowProgress(progress, params.lineStart, params.lineEnd);
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
