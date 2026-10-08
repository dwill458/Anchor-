import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, type View } from 'react-native';
import { Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { VISION_HOME_RETURN, visionHomeReturnCelebrationId, type VisionReturnParams } from '@/constants/v2/visionHomeReturn';
import { playCreationSound } from '@/services/CreationSounds';
import { useCelebrationStore } from '@/stores/v2/celebrationStore';
import { measureTeachingTarget, scrollToTarget, type TeachingScroll } from '@/components/v2/teaching/scrollToTarget';
import { safeHaptics } from '@/utils/haptics';

/**
 * Home's side of the first Vision image (celebration scene V1, the part after the pin).
 *
 * The Vision screen asks for it with an optional `visionReturn` param on the Home route. Home does not fly the print
 * in from the board (that provider lives on the Vision screen); the newly pinned print settles into its place in the
 * Vision section instead, with the label, the soft tick and a Light haptic. Home is shown scrolled to that section and
 * eases back to the top. The scene is a level 4 scene through the central coordinator, skippable, and a Skip lands it on
 * the settled page.
 */
type Request = { request: VisionReturnParams | null; consume: () => void };
const noop = () => undefined;
const RequestContext = createContext<Request>({ request: null, consume: noop });

/** Carries the Home route's `visionReturn` param to Home, and clears it once Home has taken it. */
export function VisionHomeReturnProvider({ request, consume, children }: Request & { children: React.ReactNode }) {
  const value = useMemo(() => ({ request, consume }), [request, consume]);
  return <RequestContext.Provider value={value}>{children}</RequestContext.Provider>;
}

export const useVisionHomeReturnRequest = () => useContext(RequestContext);

type Options = {
  /** The id and localId of the Anchor Home is centred on. */
  selectedAnchorIds: Array<string | undefined>;
  /** The Anchor's first image is readable in Home's Vision section. */
  visionReady: boolean;
  refreshVision: () => Promise<void> | void;
  /** Home is in front and its transition has settled. */
  homeReady: boolean;
  /** The celebration Reduce Motion source: a short crossfade instead of the scroll and the settle. */
  reduceMotion: boolean;
  scrollRef: React.RefObject<TeachingScroll | null>;
  scrollY: SharedValue<number>;
  maxScroll: SharedValue<number>;
  viewportRef: React.RefObject<View | null>;
  visionRef: React.RefObject<View | null>;
};

type Live = { id: string; settle: () => void; end: () => void };

export function useVisionHomeReturn(options: Options) {
  const { request, consume } = useVisionHomeReturnRequest();
  const { reduceMotion } = options;
  const latest = useRef(options); latest.current = options;
  // Both start settled: a Home that is not receiving a return sits at 1.
  const print = useSharedValue(1), label = useSharedValue(1);
  const [pending, setPending] = useState<number | null>(null);
  const [refreshed, setRefreshed] = useState<number | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const handled = useRef<number | null>(null), played = useRef<number | null>(null);
  const live = useRef<Live | null>(null), giveUp = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSection = useCallback(() => {
    cancelAnimation(print); cancelAnimation(label);
    print.value = 1; label.value = 1;
  }, [label, print]);

  // Take the request: pose the section hidden, and read the Vision again so the new image is there to show.
  useEffect(() => {
    if (!request || handled.current === request.nonce) return;
    handled.current = request.nonce;
    consume();
    // Only the Anchor that was just pinned has anything to show.
    if (!latest.current.selectedAnchorIds.some(id => id && id === request.anchorId)) return;
    const nonce = request.nonce;
    print.value = 0; label.value = 0;
    setPending(nonce);
    // If the image never becomes readable, the section simply appears as it always does.
    giveUp.current = setTimeout(() => { giveUp.current = null; showSection(); setPending(current => current === nonce ? null : current); }, VISION_HOME_RETURN.giveUpMs);
    void Promise.resolve(latest.current.refreshVision()).catch(() => undefined).finally(() => setRefreshed(nonce));
  }, [request, consume, label, print, showSection]);

  const start = useCallback((nonce: number) => {
    const config = VISION_HOME_RETURN;
    const reduced = latest.current.reduceMotion;
    // The image is here: the give-up no longer applies.
    if (giveUp.current) { clearTimeout(giveUp.current); giveUp.current = null; }
    const id = visionHomeReturnCelebrationId(nonce);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let ticked = false, ended = false, running = false;
    const toTop = (animated: boolean) => latest.current.scrollRef.current?.scrollTo?.({ y: 0, animated });
    // The pin's acknowledgement: a soft tick and a Light haptic, exactly once per scene.
    const tick = () => {
      if (ticked) return;
      ticked = true;
      playCreationSound('formTick'); void safeHaptics.impact(ImpactFeedbackStyle.Light);
    };
    const stop = () => { timers.forEach(clearTimeout); timers.length = 0; if (giveUp.current) { clearTimeout(giveUp.current); giveUp.current = null; } };
    // Lands the page: the section shown, the cue given if it was not yet, the page back at the top.
    const settle = () => {
      if (ended) return;
      ended = true; stop(); showSection(); tick(); toTop(false);
      live.current = null; setSceneId(null); setPending(null);
    };
    const end = () => {
      settle();
      useCelebrationStore.getState().finish(id);
    };
    live.current = { id, settle, end };
    setSceneId(id);

    const play = () => {
      if (ended || running) return;
      running = true;
      const crossfade = reduced ? config.reducedFadeMs : config.printMs;
      print.value = withTiming(1, { duration: crossfade, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
      label.value = withDelay(reduced ? 0 : config.labelDelayMs, withTiming(1, { duration: reduced ? config.reducedFadeMs : config.labelMs, reduceMotion: ReduceMotion.Never }));
      timers.push(setTimeout(tick, reduced ? config.reducedFadeMs : config.tickMs));
      if (!reduced) timers.push(setTimeout(() => toTop(true), config.scrollBackMs));
      timers.push(setTimeout(end, (reduced ? config.reducedTotalMs : config.totalMs) + config.releaseMarginMs));
    };
    const begin = () => {
      const { scrollRef, scrollY, maxScroll, viewportRef, visionRef } = latest.current;
      // Home is shown at the Vision section first; the move is a jump, never a visible travel. A measurement that never
      // answers does not hold the scene.
      void (async () => {
        try {
          const viewport = await measureTeachingTarget(viewportRef.current);
          await scrollToTarget(visionRef, scrollRef, () => ({ y: scrollY.value, max: maxScroll.value, viewportTop: viewport?.y ?? 0 }), true);
        } catch { /* the scene still plays from wherever Home is */ }
        play();
      })();
    };
    const level = reduced ? 2 : 4;
    const durationMs = reduced ? config.reducedTotalMs : config.totalMs;
    const outcome = useCelebrationStore.getState().request(level, id, { durationMs, onStart: begin, onSkip: settle });
    if (outcome === 'play') begin();
  }, [label, print, showSection]);

  // Play once the new image is readable, Home is in front and settled, and the Vision has been read again.
  useEffect(() => {
    if (pending === null || played.current === pending || refreshed !== pending || !options.visionReady || !options.homeReady) return;
    played.current = pending;
    start(pending);
  }, [pending, refreshed, options.visionReady, options.homeReady, start]);

  // Leaving Home mid-scene lands it; it never resumes half-drawn.
  useEffect(() => {
    if (!options.homeReady && live.current) live.current.end();
  }, [options.homeReady]);
  useEffect(() => () => { live.current?.end(); if (giveUp.current) clearTimeout(giveUp.current); }, []);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: print.value,
    transform: reduceMotion ? [] : [{ translateY: (1 - print.value) * 14 }, { scale: 1.04 - 0.04 * print.value }],
  }), [reduceMotion]);
  const labelStyle = useAnimatedStyle(() => ({ opacity: label.value }));
  const arrival = useMemo(() => ({ label: labelStyle, body: bodyStyle }), [bodyStyle, labelStyle]);
  return { active: pending !== null || sceneId !== null, sceneId, arrival };
}

/** Only while the return is a skippable scene: a tap lands it on its settled page. */
export function VisionHomeReturnSkip({ sceneId }: { sceneId: string | null }) {
  const skippable = useCelebrationStore(state => Boolean(sceneId && state.active?.id === sceneId && state.active.skippable));
  if (!skippable) return null;
  return <Pressable testID="v2-home-vision-return-skip" accessible accessibilityRole="button" accessibilityLabel="Skip"
    style={StyleSheet.absoluteFill} onPress={() => { useCelebrationStore.getState().skip(); }} />;
}
