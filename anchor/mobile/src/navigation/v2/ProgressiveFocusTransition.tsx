import React, { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2';
import { circularAnchorArtworkShare, type CircularAnchorAppearance } from '@/components/v2/anchor';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { colors } from '@/theme/v2';
import type { Anchor } from '@/types';

/**
 * Anchor 2.0 shared-object transition.
 *
 * One Anchor travels through the product: Home -> Details -> Practice setup ->
 * Session. The screens change around it; the Anchor itself is a single overlay
 * copy that moves from the rect it occupies on the screen being left to the
 * rect it will occupy on the screen being entered, then hands over to the real
 * artwork on the frame it lands.
 *
 * - Every screen that holds the Anchor exposes it as a *place*: a registered,
 *   measurable view. A source is measured once, at the tap; a destination once
 *   it lays out. Nothing is measured per frame.
 * - Travel begins at once toward a predicted rect. When the destination reports
 *   its real rect the copy glides onto it (the target lives in shared values),
 *   so a late measurement never shows as a jump.
 * - All motion is translate / scale / opacity on the UI thread, driven by
 *   `exitProgress` (source UI leaving), `progress` (eased travel),
 *   `revealProgress` (destination UI arriving) and `dissolve`. React state
 *   changes only at a flight's milestones, never per frame.
 * - One flight at a time. While one is pending or in the air, touches are
 *   absorbed and every further start is refused.
 */

export type AnchorWindowRect = { x: number; y: number; width: number; height: number };
/** Where an Anchor rests and can be measured. */
export type AnchorTransitionDestination =
  | 'details'
  | 'practice'
  | 'practiceSetup'
  | 'focusSession'
  | 'deepFocusSession'
  | 'visualizeSession';
/** A destination, or Home (which measures its own carousel disc). */
export type AnchorTransitionPlace = 'home' | AnchorTransitionDestination;
export type AnchorTransitionAppearance = CircularAnchorAppearance;
type MovingAnchor = Pick<Anchor, 'id' | 'localId' | 'baseSigilSvg' | 'reinforcedSigilSvg' | 'enhancedImageUrl' | 'category' | 'classifierMeta'>;

type TimingProfile = {
  /** Source UI fades out over this long, from the moment the copy is on screen. */
  exitMs: number;
  /** When the destination is mounted beneath the copy. */
  navigateAtMs: number;
  travelDelayMs: number;
  travelMs: number;
  /** Destination UI reveal. 0 means travel progress reveals it (Details). */
  revealDelayMs: number;
  revealMs: number;
  /** For a destination with no Anchor of its own: the copy dissolves once it arrives. */
  dissolveMs: number;
};

/**
 * Every duration of the motion language, in one place. Home -> Details keeps
 * the values it shipped with; the later hops use the same easing so they read
 * as one family. Totals: Details ~436ms, Practice ~500ms, Session ~620ms
 * (Visualize then lets the Anchor dissolve into the Vision).
 */
export const ANCHOR_TRANSITION_TIMING = {
  details: { exitMs: 120, navigateAtMs: 120, travelDelayMs: 16, travelMs: 420, revealDelayMs: 0, revealMs: 0, dissolveMs: 0 },
  practice: { exitMs: 120, navigateAtMs: 130, travelDelayMs: 80, travelMs: 400, revealDelayMs: 200, revealMs: 300, dissolveMs: 0 },
  session: { exitMs: 220, navigateAtMs: 220, travelDelayMs: 60, travelMs: 500, revealDelayMs: 280, revealMs: 340, dissolveMs: 0 },
  visualize: { exitMs: 220, navigateAtMs: 220, travelDelayMs: 60, travelMs: 500, revealDelayMs: 280, revealMs: 340, dissolveMs: 420 },
  /** Details -> Home: Details leaves, then Home returns under the travelling copy. */
  back: { exitMs: 150, navigateAtMs: 120, travelDelayMs: 16, travelMs: 420, revealDelayMs: 0, revealMs: 0, dissolveMs: 0 },
  backReturnMs: 300,
  /** Reduce Motion, Home <-> Details: a short cross-dissolve in place. Other hops use the route's own fade. */
  reduced: { exitMs: 90, navigateAtMs: 90, crossfadeMs: 140 },
  /** A destination measured after travel has ended is reached this quickly. */
  settleMs: 140,
  /**
   * A destination that has not reported this long after travel ended (it
   * painted something else first, e.g. Practice still loading its
   * recommendation) is not waited for: the copy fades rather than hover.
   * Details, the heaviest mount, keeps waiting as it always has.
   */
  unclaimedMs: 400,
  unclaimedFadeMs: 180,
  /** Grace past a flight's planned end before everything is force-reset. */
  watchdogMs: 900,
} as const;

/** Time a session has between mounting and the Anchor landing in it. */
export const ANCHOR_SESSION_ENTRY_MS =
  ANCHOR_TRANSITION_TIMING.session.revealDelayMs + ANCHOR_TRANSITION_TIMING.session.revealMs - ANCHOR_TRANSITION_TIMING.session.navigateAtMs;

type DestinationPreset = {
  timing: TimingProfile;
  appearance: AnchorTransitionAppearance;
  /** The source darkens to this instead of fading, so the next screen's ground is already there. */
  backdrop: string | null;
  /** `dissolve`: the destination draws no Anchor of its own. */
  settle: 'handoff' | 'dissolve';
  /** The destination draws the stored structure without its kept expression. */
  plainMark: boolean;
};

const DESTINATIONS: Record<AnchorTransitionDestination, DestinationPreset> = {
  details: { timing: ANCHOR_TRANSITION_TIMING.details, appearance: 'paper', backdrop: null, settle: 'handoff', plainMark: false },
  practice: { timing: ANCHOR_TRANSITION_TIMING.practice, appearance: 'bare', backdrop: null, settle: 'handoff', plainMark: false },
  practiceSetup: { timing: ANCHOR_TRANSITION_TIMING.practice, appearance: 'paper', backdrop: null, settle: 'handoff', plainMark: false },
  // Focus keeps its own dark treatment and draws the stored structure only.
  focusSession: { timing: ANCHOR_TRANSITION_TIMING.session, appearance: 'dark', backdrop: colors.ink.base, settle: 'handoff', plainMark: true },
  deepFocusSession: { timing: ANCHOR_TRANSITION_TIMING.session, appearance: 'tinted', backdrop: null, settle: 'handoff', plainMark: false },
  visualizeSession: { timing: ANCHOR_TRANSITION_TIMING.visualize, appearance: 'dark', backdrop: colors.ink.deep, settle: 'dissolve', plainMark: false },
};

type Flight = {
  id: number;
  anchor: MovingAnchor;
  direction: 'forward' | 'back';
  source: AnchorWindowRect;
  sourceAppearance: AnchorTransitionAppearance;
  sourcePlace: AnchorTransitionPlace;
  predicted: AnchorWindowRect;
  /** The destination's measured rect, once known. */
  destination: AnchorWindowRect | null;
  destinationAppearance: AnchorTransitionAppearance;
  /** The destination draws the stored structure without its kept expression. */
  destinationPlainMark: boolean;
  targetPlace: AnchorTransitionPlace;
  timing: TimingProfile;
  backdrop: string | null;
  settle: 'handoff' | 'dissolve';
  /** Home <-> Details under Reduce Motion: cross-dissolve, no travel. */
  reduced: boolean;
};

type PlaceEntry = {
  token: object;
  anchorId: string | undefined;
  ref: React.RefObject<View | null>;
  appearance: AnchorTransitionAppearance;
  /** Diameter of the artwork inside the measured view, when that view is larger than it. */
  artSize?: number;
  /** The place draws the stored structure without its kept expression. */
  plainMark?: boolean;
  rect: AnchorWindowRect | null;
};

export type AnchorTransitionTarget = {
  target: AnchorTransitionDestination;
  /** Predicted rect, so travel can begin before the destination has mounted. */
  rect?: AnchorWindowRect | null;
  appearance?: AnchorTransitionAppearance;
};

export type StartAnchorTransition = {
  anchor: MovingAnchor;
  /** A registered place (measured now), or a rect the caller already measured. */
  from: AnchorTransitionDestination | { rect: AnchorWindowRect; appearance: AnchorTransitionAppearance; place: AnchorTransitionPlace };
  to: AnchorTransitionTarget;
  /**
   * Mounts the destination. `withHero` is false when no flight runs (Reduce
   * Motion, nothing measurable): the caller then navigates as it normally
   * would, with the route's own animation.
   */
  onNavigate: (withHero: boolean) => void;
};

type FocusTransitionContextValue = {
  progress: SharedValue<number>;
  exitProgress: SharedValue<number>;
  revealProgress: SharedValue<number>;
  copyReady: SharedValue<boolean>;
  copyMounted: boolean;
  active: boolean;
  direction: 'forward' | 'back' | null;
  sourcePlace: AnchorTransitionPlace | null;
  targetPlace: AnchorTransitionPlace | null;
  backdrop: string | null;
  flightAnchor: MovingAnchor | null;
  reduceMotion: boolean;
  /** Home -> Details (Home measures its own disc). */
  openAnchor: (anchor: MovingAnchor, source: AnchorWindowRect, predicted: AnchorWindowRect, navigate: () => void) => boolean;
  /** Details -> Home, reversing the flight that opened Details. */
  closeAnchor: (anchorId: string, navigate: () => void) => boolean;
  /** Any other hop. False when refused because another flight owns the Anchor. */
  startAnchorTransition: (request: StartAnchorTransition) => boolean;
  registerPlace: (place: AnchorTransitionDestination, entry: PlaceEntry) => void;
  unregisterPlace: (place: AnchorTransitionDestination, token: object) => void;
  measurePlace: (place: AnchorTransitionDestination, token: object) => void;
  reset: () => void;
};

const FocusTransitionContext = createContext<FocusTransitionContextValue | null>(null);
const HERO_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const GLIDE_EASE = Easing.out(Easing.quad);

function isUsableRect(rect: AnchorWindowRect | null | undefined): rect is AnchorWindowRect {
  return Boolean(rect) && [rect!.x, rect!.y, rect!.width, rect!.height].every(Number.isFinite) && rect!.width > 0 && rect!.height > 0;
}

function sameAnchor(anchor: MovingAnchor, anchorId: string | undefined): boolean {
  // `localId` is optional: two undefined ids must never match.
  return Boolean(anchorId) && (anchorId === anchor.id || (Boolean(anchor.localId) && anchorId === anchor.localId));
}

/** The mark's own diameter inside a disc of `width`. */
function markSize(anchor: MovingAnchor, width: number, appearance: AnchorTransitionAppearance): number {
  const image = typeof anchor.enhancedImageUrl === 'string' && anchor.enhancedImageUrl.length > 0;
  return width * circularAnchorArtworkShare(appearance, width, image);
}

function centeredRect(rect: AnchorWindowRect, size: number | undefined): AnchorWindowRect {
  if (!size) return rect;
  return { x: rect.x + (rect.width - size) / 2, y: rect.y + (rect.height - size) / 2, width: size, height: size };
}

/**
 * Mounted beside the navigator so the artwork survives a route push. A nested
 * navigator's provider defers to the outer one: a flight may leave one stack
 * (Details, inside the daily shell) for another (Practice, on the root stack),
 * and only a layer above both stays on top the whole way.
 */
export function ProgressiveFocusTransitionProvider({ children }: { children: React.ReactNode }) {
  const parent = useContext(FocusTransitionContext);
  if (parent) return <>{children}</>;
  return <RootTransitionProvider>{children}</RootTransitionProvider>;
}

function RootTransitionProvider({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReduceMotionEnabled();
  const progress = useSharedValue(1);
  const exitProgress = useSharedValue(0);
  const revealProgress = useSharedValue(1);
  const dissolve = useSharedValue(0);
  const copyReady = useSharedValue(false);
  // Centre and mark diameter the copy is heading for.
  const targetX = useSharedValue(0);
  const targetY = useSharedValue(0);
  const targetMark = useSharedValue(0);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [locked, setLocked] = useState(false);
  const [copyMounted, setCopyMounted] = useState(false);
  const flightRef = useRef<Flight | null>(null);
  const lastCompletedFlightRef = useRef<Flight | null>(null);
  const busyRef = useRef(false);
  const navigateRef = useRef<((withHero: boolean) => void) | null>(null);
  const navigatedRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unclaimedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef({ startedAt: 0, travelDone: false, revealDone: false, gliding: false, settling: false });
  const flightIdRef = useRef(0);
  const placesRef = useRef<Partial<Record<AnchorTransitionDestination, PlaceEntry>>>({});

  const clearTimers = useCallback(() => {
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = null;
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    navigationTimerRef.current = null;
    if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
    measureTimerRef.current = null;
    if (unclaimedTimerRef.current) clearTimeout(unclaimedTimerRef.current);
    unclaimedTimerRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const reset = useCallback(() => {
    const completed = flightRef.current;
    if (completed?.direction === 'forward' && completed.sourcePlace === 'home' && completed.targetPlace === 'details' && completed.destination) {
      lastCompletedFlightRef.current = completed;
    }
    clearTimers();
    cancelAnimation(progress);
    cancelAnimation(exitProgress);
    cancelAnimation(revealProgress);
    cancelAnimation(dissolve);
    cancelAnimation(targetX);
    cancelAnimation(targetY);
    cancelAnimation(targetMark);
    progress.value = 1;
    exitProgress.value = 0;
    revealProgress.value = 1;
    dissolve.value = 0;
    copyReady.value = false;
    busyRef.current = false;
    flightRef.current = null;
    navigateRef.current = null;
    navigatedRef.current = false;
    phaseRef.current = { startedAt: 0, travelDone: false, revealDone: false, gliding: false, settling: false };
    setFlight(null);
    setLocked(false);
    setCopyMounted(false);
  }, [clearTimers, copyReady, dissolve, exitProgress, progress, revealProgress, targetMark, targetX, targetY]);

  const navigateOnce = useCallback((withHero: boolean) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigateRef.current?.(withHero);
  }, []);

  const maybeFinish = useCallback((id: number) => {
    const current = flightRef.current;
    const phase = phaseRef.current;
    if (!current || current.id !== id || phase.settling) return;
    if (!phase.travelDone || !phase.revealDone || phase.gliding) return;
    if (current.settle === 'handoff' && !current.destination) return; // the destination has not reported yet
    if (current.settle === 'dissolve') {
      phase.settling = true;
      dissolve.value = withTiming(1, { duration: current.timing.dissolveMs, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(reset)();
      });
      return;
    }
    reset();
  }, [dissolve, reset]);

  const finishTravel = useCallback((id: number) => {
    const current = flightRef.current;
    if (current?.id !== id) return;
    phaseRef.current.travelDone = true;
    if (current.settle === 'handoff' && !current.destination && current.targetPlace !== 'details') {
      unclaimedTimerRef.current = setTimeout(() => {
        unclaimedTimerRef.current = null;
        const pending = flightRef.current;
        if (pending?.id !== id || pending.destination || phaseRef.current.settling) return;
        phaseRef.current.settling = true;
        dissolve.value = withTiming(1, { duration: ANCHOR_TRANSITION_TIMING.unclaimedFadeMs }, (finished) => {
          if (finished) runOnJS(reset)();
        });
      }, ANCHOR_TRANSITION_TIMING.unclaimedMs);
    }
    maybeFinish(id);
  }, [dissolve, maybeFinish, reset]);

  const finishReveal = useCallback((id: number) => {
    if (flightRef.current?.id !== id) return;
    phaseRef.current.revealDone = true;
    maybeFinish(id);
  }, [maybeFinish]);

  const finishGlide = useCallback((id: number) => {
    if (flightRef.current?.id !== id) return;
    phaseRef.current.gliding = false;
    maybeFinish(id);
  }, [maybeFinish]);

  /** Points the copy at `rect`: at once, or as a glide that reports back when it lands. */
  const aimAt = useCallback((current: Flight, rect: AnchorWindowRect, appearance: AnchorTransitionAppearance, durationMs: number) => {
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const mark = markSize(current.anchor, rect.width, appearance);
    if (durationMs <= 0) {
      targetX.value = x;
      targetY.value = y;
      targetMark.value = mark;
      return;
    }
    const config = { duration: durationMs, easing: GLIDE_EASE };
    const id = current.id;
    targetX.value = withTiming(x, config);
    targetY.value = withTiming(y, config);
    targetMark.value = withTiming(mark, config, (finished) => {
      if (finished) runOnJS(finishGlide)(id);
    });
  }, [finishGlide, targetMark, targetX, targetY]);

  const armWatchdog = useCallback((current: Flight) => {
    const t = current.timing;
    const plannedEnd = Math.max(t.navigateAtMs, t.travelDelayMs + t.travelMs, t.revealDelayMs + t.revealMs) + t.dissolveMs;
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(() => {
      watchdogRef.current = null;
      if (flightRef.current?.id !== current.id) return;
      // Never strand the person: whatever is pending, the destination opens and the layer goes.
      navigateOnce(false);
      reset();
    }, plannedEnd + ANCHOR_TRANSITION_TIMING.watchdogMs);
  }, [navigateOnce, reset]);

  const launch = useCallback((next: Omit<Flight, 'id'>, navigate: (withHero: boolean) => void) => {
    const current: Flight = { ...next, id: ++flightIdRef.current };
    flightRef.current = current;
    navigateRef.current = navigate;
    navigatedRef.current = false;
    phaseRef.current = { startedAt: 0, travelDone: false, revealDone: current.timing.revealMs === 0, gliding: false, settling: false };
    progress.value = 0;
    exitProgress.value = 0;
    revealProgress.value = current.timing.revealMs === 0 ? 1 : 0;
    dissolve.value = 0;
    copyReady.value = false;
    aimAt(current, current.destination ?? current.predicted, current.destinationAppearance, 0);
    setCopyMounted(false);
    setLocked(true);
    setFlight(current);
    armWatchdog(current);
  }, [aimAt, armWatchdog, copyReady, dissolve, exitProgress, progress, revealProgress]);

  const openAnchor = useCallback((anchor: MovingAnchor, source: AnchorWindowRect, predicted: AnchorWindowRect, navigate: () => void) => {
    if (busyRef.current) return false;
    if (!isUsableRect(source)) {
      navigate();
      return true;
    }
    busyRef.current = true;
    lastCompletedFlightRef.current = null;
    launch({
      anchor,
      direction: 'forward',
      source,
      sourceAppearance: 'paper',
      sourcePlace: 'home',
      predicted,
      destination: null,
      destinationAppearance: DESTINATIONS.details.appearance,
      destinationPlainMark: false,
      targetPlace: 'details',
      timing: DESTINATIONS.details.timing,
      backdrop: null,
      settle: 'handoff',
      reduced: reduceMotion,
    }, () => navigate());
    return true;
  }, [launch, reduceMotion]);

  const closeAnchor = useCallback((anchorId: string, navigate: () => void) => {
    if (busyRef.current) {
      if (flightRef.current?.direction === 'back') return true;
      reset();
      return false;
    }
    const previous = lastCompletedFlightRef.current;
    if (!previous?.destination || previous.anchor.id !== anchorId) return false;
    busyRef.current = true;
    launch({
      anchor: previous.anchor,
      direction: 'back',
      source: previous.destination,
      sourceAppearance: previous.destinationAppearance,
      sourcePlace: 'details',
      predicted: previous.source,
      destination: previous.source,
      destinationAppearance: previous.sourceAppearance,
      destinationPlainMark: false,
      targetPlace: 'home',
      timing: ANCHOR_TRANSITION_TIMING.back,
      backdrop: null,
      settle: 'handoff',
      reduced: reduceMotion,
    }, () => navigate());
    return true;
  }, [launch, reduceMotion, reset]);

  const startAnchorTransition = useCallback(({ anchor, from, to, onNavigate }: StartAnchorTransition) => {
    if (busyRef.current) return false;
    if (reduceMotion) {
      onNavigate(false);
      return true;
    }
    const preset = DESTINATIONS[to.target];
    busyRef.current = true;
    setLocked(true);
    const fallback = () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
      measureTimerRef.current = null;
      busyRef.current = false;
      setLocked(false);
      onNavigate(false);
    };
    const begin = (source: AnchorWindowRect, sourceAppearance: AnchorTransitionAppearance, sourcePlace: AnchorTransitionPlace) => {
      if (!isUsableRect(source)) {
        fallback();
        return;
      }
      const registered = placesRef.current[to.target];
      const known = registered && sameAnchor(anchor, registered.anchorId) && isUsableRect(registered.rect) ? registered : null;
      launch({
        anchor,
        direction: 'forward',
        source,
        sourceAppearance,
        sourcePlace,
        predicted: known?.rect ?? (isUsableRect(to.rect) ? to.rect : source),
        destination: known?.rect ?? null,
        destinationAppearance: known?.appearance ?? to.appearance ?? preset.appearance,
        destinationPlainMark: known ? known.plainMark === true : preset.plainMark,
        targetPlace: to.target,
        timing: preset.timing,
        backdrop: preset.backdrop,
        settle: preset.settle,
        reduced: false,
      }, onNavigate);
    };

    if (typeof from !== 'string') {
      begin(from.rect, from.appearance, from.place);
      return true;
    }
    const entry = placesRef.current[from];
    const node = entry?.ref.current;
    if (!entry || !sameAnchor(anchor, entry.anchorId) || !node || typeof node.measureInWindow !== 'function') {
      fallback();
      return true;
    }
    // Measured at the tap: the source may have scrolled since it laid out.
    // A view that never answers must not hold the lock.
    measureTimerRef.current = setTimeout(fallback, 250);
    node.measureInWindow((x, y, width, height) => {
      if (!measureTimerRef.current) return;
      clearTimeout(measureTimerRef.current);
      measureTimerRef.current = null;
      begin(centeredRect({ x, y, width, height }, entry.artSize), entry.appearance, from);
    });
    return true;
  }, [launch, reduceMotion]);

  const acceptDestination = useCallback((rect: AnchorWindowRect, appearance: AnchorTransitionAppearance, plainMark: boolean) => {
    const current = flightRef.current;
    // Too late: the copy is already fading out, unclaimed.
    if (!current || (!current.reduced && phaseRef.current.settling)) return;
    const unchanged = current.destination
      && Math.abs(current.destination.x - rect.x) <= 0.5
      && Math.abs(current.destination.y - rect.y) <= 0.5
      && Math.abs(current.destination.width - rect.width) <= 0.5
      && current.destinationAppearance === appearance
      && current.destinationPlainMark === plainMark;
    if (unchanged) return;
    const next = { ...current, destination: rect, destinationAppearance: appearance, destinationPlainMark: plainMark };
    flightRef.current = next;
    setFlight(next);
    if (current.reduced) {
      aimAt(next, rect, appearance, 0);
      if (!copyReady.value) return;
      progress.value = withTiming(1, { duration: ANCHOR_TRANSITION_TIMING.reduced.crossfadeMs, easing: HERO_EASE }, (finished) => {
        if (finished) runOnJS(reset)();
      });
      return;
    }
    const phase = phaseRef.current;
    if (unclaimedTimerRef.current) clearTimeout(unclaimedTimerRef.current);
    unclaimedTimerRef.current = null;
    const t = current.timing;
    const remaining = t.travelDelayMs + t.travelMs - (phase.startedAt ? Date.now() - phase.startedAt : 0);
    // Still travelling: re-aim over what is left of the journey. Already
    // resting on the prediction: glide the last few points, then hand over.
    phase.gliding = true;
    aimAt(next, rect, appearance, phase.travelDone || remaining < 60 ? ANCHOR_TRANSITION_TIMING.settleMs : remaining);
  }, [aimAt, copyReady, progress, reset]);

  const registerPlace = useCallback((place: AnchorTransitionDestination, entry: PlaceEntry) => {
    placesRef.current[place] = entry;
  }, []);

  const unregisterPlace = useCallback((place: AnchorTransitionDestination, token: object) => {
    if (placesRef.current[place]?.token === token) delete placesRef.current[place];
  }, []);

  const measurePlace = useCallback((place: AnchorTransitionDestination, token: object) => {
    const entry = placesRef.current[place];
    const node = entry?.ref.current;
    if (!entry || entry.token !== token || !node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, width, height) => {
      if (placesRef.current[place]?.token !== token) return;
      const rect = centeredRect({ x, y, width, height }, entry.artSize);
      if (!isUsableRect(rect)) return;
      entry.rect = rect;
      const current = flightRef.current;
      if (current?.direction === 'forward' && current.targetPlace === place && sameAnchor(current.anchor, entry.anchorId)) {
        acceptDestination(rect, entry.appearance, entry.plainMark === true);
      }
    });
  }, [acceptDestination]);

  const onCopyLayout = useCallback(() => {
    const current = flightRef.current;
    if (!current || copyReady.value) return;
    copyReady.value = true;
    setCopyMounted(true);
    phaseRef.current.startedAt = Date.now();
    const id = current.id;
    const goingBack = current.direction === 'back';

    if (current.reduced) {
      const reduced = ANCHOR_TRANSITION_TIMING.reduced;
      exitProgress.value = withTiming(1, { duration: reduced.exitMs });
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        navigateOnce(true);
        if (goingBack) reset();
        // Forward: the cross-dissolve starts once Details reports where it rests.
      }, reduced.navigateAtMs);
      return;
    }

    const t = current.timing;
    exitProgress.value = withTiming(1, { duration: t.exitMs });
    progress.value = withDelay(t.travelDelayMs, withTiming(1, { duration: t.travelMs, easing: HERO_EASE }, (finished) => {
      if (finished) runOnJS(finishTravel)(id);
    }));
    if (t.revealMs > 0) {
      revealProgress.value = withDelay(t.revealDelayMs, withTiming(1, { duration: t.revealMs, easing: GLIDE_EASE }, (finished) => {
        if (finished) runOnJS(finishReveal)(id);
      }));
    }
    navigationTimerRef.current = setTimeout(() => {
      navigationTimerRef.current = null;
      navigateOnce(true);
      if (goingBack) {
        exitProgress.value = 1;
        exitProgress.value = withTiming(0, { duration: ANCHOR_TRANSITION_TIMING.backReturnMs });
      }
    }, t.navigateAtMs);
  }, [copyReady, exitProgress, finishReveal, finishTravel, navigateOnce, progress, reset, revealProgress]);

  const value = useMemo<FocusTransitionContextValue>(() => ({
    progress,
    exitProgress,
    revealProgress,
    copyReady,
    copyMounted,
    active: flight !== null,
    direction: flight?.direction ?? null,
    sourcePlace: flight?.sourcePlace ?? null,
    targetPlace: flight?.targetPlace ?? null,
    backdrop: flight?.backdrop ?? null,
    flightAnchor: flight?.anchor ?? null,
    reduceMotion,
    openAnchor,
    closeAnchor,
    startAnchorTransition,
    registerPlace,
    unregisterPlace,
    measurePlace,
    reset,
  }), [progress, exitProgress, revealProgress, copyReady, copyMounted, flight, reduceMotion, openAnchor, closeAnchor, startAnchorTransition, registerPlace, unregisterPlace, measurePlace, reset]);

  return <FocusTransitionContext.Provider value={value}>
    {children}
    {locked ? <View
      testID="v2-anchor-transition-lock"
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    /> : null}
    {flight ? <AnchorTransitionLayer
      flight={flight}
      progress={progress}
      dissolve={dissolve}
      targetX={targetX}
      targetY={targetY}
      targetMark={targetMark}
      onLayout={onCopyLayout}
    /> : null}
  </FocusTransitionContext.Provider>;
}

export function useProgressiveFocusTransition(): FocusTransitionContextValue {
  const value = useContext(FocusTransitionContext);
  if (!value) throw new Error('ProgressiveFocusTransitionProvider is required for this screen.');
  return value;
}

/** For surfaces that also render outside the V2 navigator (tests, galleries). */
export function useOptionalAnchorTransition(): FocusTransitionContextValue | null {
  return useContext(FocusTransitionContext);
}

/** The static artwork a copy draws, memoised so travel never re-renders the Anchor tree. */
const TransitionArtwork = memo(function TransitionArtwork({ anchor, size, appearance, plainMark = false }: { anchor: MovingAnchor; size: number; appearance: AnchorTransitionAppearance; plainMark?: boolean }) {
  const art = useMemo(() => {
    const props = anchorRenderProps(anchor);
    return plainMark ? { ...props, expression: undefined } : props;
  }, [anchor, plainMark]);
  return <CircularAnchorRenderer {...art} size={size} appearance={appearance} />;
});

/**
 * Two copies share one path. The departing copy wears the source's surface;
 * the arriving copy is drawn at the destination's own size and surface, so on
 * the last frame it is identical to the artwork it hands over to. Both are
 * scaled so the *mark* (not its disc) keeps a single size between them, and
 * the arriving surface fades in over the departing one before that one leaves.
 *
 * A copy scaled up past its drawn size goes soft (iOS rasterises SVG at layout
 * size), so when the Anchor grows the arriving copy - only ever scaled down -
 * takes over early; when it shrinks, the departing copy holds until late.
 */
const SHRINKING_WINDOWS = { arriveIn: [0.45, 0.8], departOut: [0.8, 1] } as const;
const GROWING_WINDOWS = { arriveIn: [0.1, 0.45], departOut: [0.45, 0.7] } as const;

function AnchorTransitionLayer({ flight, progress, dissolve, targetX, targetY, targetMark, onLayout }: {
  flight: Flight;
  progress: SharedValue<number>;
  dissolve: SharedValue<number>;
  targetX: SharedValue<number>;
  targetY: SharedValue<number>;
  targetMark: SharedValue<number>;
  onLayout: () => void;
}) {
  const layerRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const { anchor, source, sourceAppearance, destinationAppearance, reduced } = flight;
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height / 2;
  const sourceMark = markSize(anchor, source.width, sourceAppearance);
  const arrivalSize = Math.max(1, Math.round((flight.destination ?? flight.predicted).width));
  const arrivalMark = markSize(anchor, arrivalSize, destinationAppearance);
  const windows = arrivalMark > sourceMark * 1.15 ? GROWING_WINDOWS : SHRINKING_WINDOWS;
  const [arriveFrom, arriveTo] = windows.arriveIn;
  const [departFrom, departTo] = windows.departOut;

  const departingStyle = useAnimatedStyle(() => {
    const t = progress.value;
    if (reduced) return { opacity: 1 - t, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    const mark = sourceMark + (targetMark.value - sourceMark) * t;
    return {
      opacity: interpolate(t, [departFrom, departTo], [1, 0], 'clamp') * (1 - dissolve.value),
      transform: [
        { translateX: (targetX.value - sourceX) * t },
        { translateY: (targetY.value - sourceY) * t },
        { scale: mark / sourceMark },
      ],
    };
  }, [departFrom, departTo, reduced, sourceMark, sourceX, sourceY]);

  const arrivingStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const mark = sourceMark + (targetMark.value - sourceMark) * t;
    return {
      opacity: interpolate(t, [arriveFrom, arriveTo], [0, 1], 'clamp') * (1 - dissolve.value),
      transform: [
        { translateX: (targetX.value - sourceX) * t },
        { translateY: (targetY.value - sourceY) * t },
        { scale: mark / arrivalMark },
      ],
    };
  }, [arriveFrom, arriveTo, arrivalMark, sourceMark, sourceX, sourceY]);

  return <View ref={layerRef} collapsable={false} testID="v2-anchor-transition-layer" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.overlay} onLayout={() => {
    layerRef.current?.measureInWindow((x, y) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      setOrigin({ x, y });
      onLayout();
    });
  }}>
    {origin ? <>
      <Animated.View testID="v2-anchor-transition-copy" style={[styles.copy, { left: source.x - origin.x, top: source.y - origin.y, width: source.width, height: source.height }, departingStyle]}>
        <TransitionArtwork anchor={anchor} size={source.width} appearance={sourceAppearance} />
      </Animated.View>
      {reduced ? null : <Animated.View testID="v2-anchor-transition-arrival" style={[styles.copy, { left: sourceX - origin.x - arrivalSize / 2, top: sourceY - origin.y - arrivalSize / 2, width: arrivalSize, height: arrivalSize }, arrivingStyle]}>
        <TransitionArtwork anchor={anchor} size={arrivalSize} appearance={destinationAppearance} plainMark={flight.destinationPlainMark} />
      </Animated.View>}
    </> : null}
  </View>;
}

export type AnchorTransitionPlaceBinding = {
  ref: React.RefObject<View | null>;
  onLayout: () => void;
  /** True while the travelling copy stands in for this artwork. */
  hidden: boolean;
};

function isPlaceHidden(ctx: FocusTransitionContextValue | null, place: AnchorTransitionPlace, anchorId: string | undefined): boolean {
  if (!ctx?.flightAnchor || !sameAnchor(ctx.flightAnchor, anchorId)) return false;
  if (ctx.sourcePlace === place) return ctx.copyMounted;
  // Under Reduce Motion, Details shows its own Anchor while the copy dissolves over it.
  if (ctx.targetPlace === place && ctx.direction === 'forward') return !(ctx.reduceMotion && place === 'details');
  return false;
}

/**
 * Registers the view that holds an Anchor as a transition place. Put `ref`
 * and `onLayout` on the artwork's view (or on a box centred on it, passing
 * `artSize`), and hide the artwork while `hidden`.
 *
 * `measureDelayMs` waits before measuring: a freshly pushed native screen on
 * Android moves beneath the status bar after its first layout pass.
 */
export function useAnchorTransitionPlace(
  place: AnchorTransitionDestination,
  anchorId: string | undefined,
  appearance: AnchorTransitionAppearance,
  options: { artSize?: number; measureDelayMs?: number; plainMark?: boolean } = {},
): AnchorTransitionPlaceBinding {
  const ctx = useContext(FocusTransitionContext);
  const ref = useRef<View>(null);
  const tokenRef = useRef<object>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { artSize, measureDelayMs = 0, plainMark = false } = options;
  const registerPlace = ctx?.registerPlace;
  const unregisterPlace = ctx?.unregisterPlace;
  const measurePlace = ctx?.measurePlace;

  // A layout effect, so the place exists before its first layout event arrives.
  useLayoutEffect(() => {
    if (!registerPlace || !unregisterPlace) return undefined;
    const token = {};
    tokenRef.current = token;
    registerPlace(place, { token, anchorId, ref, appearance, artSize, plainMark, rect: null });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      unregisterPlace(place, token);
    };
  }, [anchorId, appearance, artSize, place, plainMark, registerPlace, unregisterPlace]);

  const onLayout = useCallback(() => {
    if (!measurePlace) return;
    const token = tokenRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (measureDelayMs <= 0) {
      measurePlace(place, token);
      return;
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      measurePlace(place, token);
    }, measureDelayMs);
  }, [measureDelayMs, measurePlace, place]);

  return { ref, onLayout, hidden: isPlaceHidden(ctx, place, anchorId) };
}

type SceneRole = 'idle' | 'exit' | 'veil' | 'reveal' | 'revealDetails';

function sceneRole(ctx: FocusTransitionContextValue | null, place: AnchorTransitionPlace): SceneRole {
  if (!ctx?.active) return 'idle';
  if (ctx.direction === 'back') return ctx.sourcePlace === place ? 'exit' : 'idle';
  if (ctx.sourcePlace === place) return ctx.backdrop ? 'veil' : 'exit';
  if (ctx.targetPlace === place) return place === 'details' ? 'revealDetails' : 'reveal';
  return 'idle';
}

/**
 * The UI around an Anchor place. As a flight's source it fades out (or darkens
 * to the destination's ground); as its destination it fades in beneath the
 * arriving Anchor. Idle otherwise.
 */
export function AnchorTransitionScene({ place, children, style }: { place: AnchorTransitionPlace; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const ctx = useContext(FocusTransitionContext);
  const role = sceneRole(ctx, place);
  const reduceMotion = ctx?.reduceMotion ?? false;
  const idleValue = useSharedValue(0);
  const progress = ctx?.progress ?? idleValue;
  const exitProgress = ctx?.exitProgress ?? idleValue;
  const revealProgress = ctx?.revealProgress ?? idleValue;
  const backdrop = role === 'veil' ? ctx?.backdrop ?? null : null;
  const sceneStyle = useAnimatedStyle(() => {
    switch (role) {
      case 'exit':
        return { opacity: 1 - exitProgress.value };
      case 'reveal':
        return { opacity: interpolate(revealProgress.value, [0, 0.45], [0, 1], 'clamp') };
      case 'revealDetails':
        return { opacity: reduceMotion ? progress.value : interpolate(progress.value, [0, 0.28, 0.86, 1], [0.25, 0.25, 1, 1], 'clamp') };
      default:
        return { opacity: 1 };
    }
  }, [reduceMotion, role]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: exitProgress.value }));
  return <Animated.View style={[styles.scene, style, sceneStyle]}>
    {children}
    {backdrop ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: backdrop }, veilStyle]} /> : null}
  </Animated.View>;
}

/** Arrival windows (share of the reveal) for groups inside a destination, in order. */
const REVEAL_WINDOWS: readonly (readonly [number, number])[] = [[0, 0.45], [0.15, 0.6], [0.3, 0.8], [0.45, 1]];
const REVEAL_RISE = 6;

/**
 * Stages one group of a destination's UI behind the Anchor: opacity and a few
 * points of rise, no per-child choreography. Idle outside a flight into `place`.
 *
 * Pass `rise: false` for a group that contains the Anchor's own place: it is
 * measured while hidden, and a transform there would move the landing point.
 */
export function useAnchorTransitionReveal(place: AnchorTransitionPlace, order: 0 | 1 | 2 | 3, { rise = true }: { rise?: boolean } = {}) {
  const ctx = useContext(FocusTransitionContext);
  const revealing = sceneRole(ctx, place) === 'reveal';
  const idleValue = useSharedValue(1);
  const revealProgress = ctx?.revealProgress ?? idleValue;
  const [start, end] = REVEAL_WINDOWS[order];
  const travel = rise ? REVEAL_RISE : 0;
  return useAnimatedStyle(() => {
    if (!revealing) return { opacity: 1, transform: [{ translateY: 0 }] };
    const local = interpolate(revealProgress.value, [start, end], [0, 1], 'clamp');
    return { opacity: local, transform: [{ translateY: (1 - local) * travel }] };
  }, [end, revealing, start, travel]);
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  copy: { position: 'absolute' },
});
