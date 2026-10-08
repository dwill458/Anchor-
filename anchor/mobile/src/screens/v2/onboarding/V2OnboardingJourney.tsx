import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ArrowRight } from "lucide-react-native";
import { useFirstRunStore } from "@/stores/v2/firstRunStore";
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/constants/v2/onboarding";
import { colors } from "@/theme/v2";
import { useCreationReduceMotion, v2Haptics } from "@/hooks/v2";
import type { AnchorCategory } from "@/types";
import { V2OnboardingExplain } from "./V2OnboardingExplain";
import { V2OnboardingFocusArea } from "./V2OnboardingFocusArea";
import { OpeningProgressHeader } from "./OpeningProgressHeader";
import { easeInOutCubic, handoffTimeline, seg } from "./openingHandoff";
import { categoryHandoffTimeline } from "./categoryHandoff";
import { Screen2Backdrop } from "./screen2Backdrop";
import { OnboardingAnalytics } from "@/services/v2/onboardingAnalytics";

/** Screen 3 mounts beneath Screen 2 this long after Screen 2 starts, so it is decoded before Continue. */
const FOCUS_PRELOAD_DELAY_MS = 600;
/** If the runner plate never reports ready (e.g. decode failure), don't hold Screen 2's CTA forever. */
const FOCUS_READY_FALLBACK_MS = 3000;
/** Steps from the earlier eight-step onboarding; a draft saved on one resumes at the question. */
const RETIRED_STEPS = new Set<string>(["outcome", "meaning", "friction", "system", "handoff", "life", "need", "summary"]);

/**
 * Screen 1 hero: full-resolution master of the locked panorama (5760 × 1920, about 2.3 source
 * pixels per point at full screen height), rendered as-is with no blur or resize step.
 * welcome-panorama.png is the old 1024 × 341 preview of the same artwork, which is what made
 * the hero soft. Keep PANORAMA_SIZE in sync with the file.
 */
const panorama = require("@/assets/onboarding/welcome-panorama-master.jpg");
const PANORAMA_SIZE = { width: 5760, height: 1920 };
/** One leg of the opening camera move. Long enough to read as a drift, not an animation. */
const HERO_PAN_MS = 36000;
/** The shot opens slightly pushed in, and keeps pushing in by a hair over each leg. */
const HERO_SCALE_START = 1.06;
const HERO_SCALE_DRIFT = 0.035;
const lightMark = require("@/assets/home/anchor-brand-mark-light.png");

type Props = {
  onSignIn: () => void;
  onCreate: () => void;
  onDevSkip?: () => void;
  onDevSeed?: () => void;
};

function Welcome({
  onStart,
  onSignIn,
  onCreate,
  onDevSkip,
  onDevSeed,
  reduceMotion,
}: {
  onStart: () => void;
  onSignIn: () => void;
  onCreate?: () => void;
  onDevSkip?: () => void;
  onDevSeed?: () => void;
  reduceMotion: boolean;
}) {
  const windowDim = useWindowDimensions();
  const screenDim = Dimensions.get("window");
  const width = windowDim.width || screenDim.width || 390;
  const height = windowDim.height || screenDim.height || 844;
  const insets = useSafeAreaInsets();

  // The supplied locked panoramic artwork (3:1 aspect ratio) owns the entire screen.
  // The device is a vertical camera window looking into a wider cinematic world.
  const PANORAMA_ASPECT = PANORAMA_SIZE.width / PANORAMA_SIZE.height;
  const panoramaHeight = height;
  const panoramaWidth = panoramaHeight * PANORAMA_ASPECT;
  const maxTravel = Math.max(0, panoramaWidth - width);
  // Pan across the entire panoramic artwork from the opening room to the horizon and runner.
  const panDistance = maxTravel;

  const pan = useSharedValue(0);
  const push = useSharedValue(0);
  const dive = useSharedValue(0);
  const wash = useSharedValue(0);
  const uiOut = useSharedValue(0);
  const travel = useSharedValue(panDistance);
  useEffect(() => {
    travel.value = panDistance;
  }, [panDistance, travel]);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Opening shot: continuous sine drift back and forth across the full panorama.
  // Using direct withRepeat with ReduceMotion.Never to ensure reliable playback on Android.
  useEffect(() => {
    if (reduceMotion) {
      pan.value = 0;
      push.value = 0;
      return;
    }
    pan.value = withRepeat(
      withTiming(1, {
        duration: HERO_PAN_MS,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    push.value = withRepeat(
      withTiming(1, {
        duration: HERO_PAN_MS,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(pan);
      cancelAnimation(push);
    };
  }, [reduceMotion, pan, push]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -travel.value * pan.value }],
  }));
  // Scale is applied around the screen centre (not the far wider image's centre), so the
  // push-in crops evenly and the pan range stays inside the artwork.
  const pushStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : -12 * dive.value },
      { scale: reduceMotion ? 1 : HERO_SCALE_START + HERO_SCALE_DRIFT * push.value + 0.085 * dive.value },
    ],
  }));

  const washStyle = useAnimatedStyle(() => ({ opacity: wash.value }));
  const uiOutStyle = useAnimatedStyle(() => ({
    opacity: 1 - uiOut.value,
    transform: [{ translateY: -6 * uiOut.value }],
  }));

  const start = () => {
    if (transitioning) return;
    setTransitioning(true);
    // UI steps back first, the panorama keeps drifting left, and Screen 2's own
    // environment dissolves in over it. Screen 2's first frame is that same backdrop.
    // Reduce Motion still gets a crossfade, never a hard cut, so bypass Reanimated's system skip.
    uiOut.value = withTiming(1, { duration: reduceMotion ? 160 : 320, reduceMotion: ReduceMotion.Never });
    if (!reduceMotion) {
      dive.value = withTiming(1, { duration: 680, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never });
      const forwardDrift = panDistance > 0 ? Math.min(0.04, 28 / panDistance) : 0;
      pan.value = withTiming(Math.min(1, pan.value + forwardDrift), {
        duration: 900,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      });
    }
    wash.value = withDelay(
      reduceMotion ? 0 : 120,
      withTiming(1, { duration: reduceMotion ? 260 : 520, reduceMotion: ReduceMotion.Never }),
    );
    transitionTimer.current = setTimeout(onStart, reduceMotion ? 280 : 660);
  };

  return (
    <View style={styles.fullBleed} testID="v2-onboarding-welcome">
      <StatusBar style="light" translucent backgroundColor="transparent" />
      {/* 1. PANORAMIC ENVIRONMENTAL ARTWORK — full detail, never blurred; the only
          readability treatment is the graded overlay below. */}
      <Animated.View style={[StyleSheet.absoluteFill, pushStyle]} pointerEvents="none">
        <Animated.Image
          source={panorama}
          resizeMode="cover"
          resizeMethod="scale"
          fadeDuration={0}
          style={[
            styles.panorama,
            {
              width: panoramaWidth,
              height: panoramaHeight,
            },
            panStyle,
          ]}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/* Top subtle vignette to guarantee crisp contrast behind the white brand lockup */}
      <LinearGradient
        colors={[
          "rgba(8, 11, 20, 0.62)",
          "rgba(8, 11, 20, 0.28)",
          "transparent",
        ]}
        locations={[0, 0.16, 0.34]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 2. NATURAL DARK GRADIENT OVERLAY (Grounds lower copy & CTA without darkening the sky) */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(10, 15, 24, 0.0)",
          "rgba(10, 15, 24, 0.38)",
          "rgba(10, 15, 24, 0.74)",
          "rgba(10, 15, 24, 0.94)",
        ]}
        locations={[0, 0.4, 0.62, 0.82, 1.0]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* 3. STATIC UI OVERLAY */}
      <Animated.View
        style={[
          styles.welcomeContentContainer,
          {
            paddingTop: Math.max(insets.top, 16) + 14,
            paddingBottom: Math.max(insets.bottom, 16) + 12,
          },
          uiOutStyle,
        ]}
      >
        {/* Confident, luminous Anchor 2.0 Brand Lockup */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(600)}
          style={styles.welcomeCenter}
        >
          <Image
            source={lightMark}
            resizeMode="contain"
            style={styles.brandMark}
            accessibilityLabel="Anchor brand mark"
          />
          <Text style={styles.wordmark}>ANCHOR</Text>
          <Text style={styles.brandSub}>VISUAL GOAL SETTING</Text>
        </Animated.View>

        {/* Editorial Copy & Primary CTA */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(380).duration(700)}
          style={styles.welcomeBottom}
        >
          <Text style={styles.welcomeTitle}>
            Turn intention{"\n"}into movement.
          </Text>
          <Text style={styles.welcomeBody}>
            A visual goal setting system to help you see it, reinforce it, and move toward what matters.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            disabled={transitioning}
            onPress={start}
            style={[styles.welcomeCta, transitioning && styles.disabled]}
          >
            <Text style={styles.welcomeCtaText}>Get started</Text>
            <ArrowRight size={20} color="#14162B" strokeWidth={2.2} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Already use Anchor? Sign in"
            onPress={() => { OnboardingAnalytics.cta("welcome", "sign_in"); onSignIn(); }}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>
              Already use Anchor?{" "}
              <Text style={styles.signInUnderline}>Sign in</Text>
            </Text>
          </Pressable>

          {__DEV__ ? (
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", marginTop: 14 }}>
              {onCreate ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dev open creation flow"
                  onPress={() => { OnboardingAnalytics.cta("welcome", "create"); onCreate(); }}
                  style={styles.devWelcomePill}
                >
                  <Text style={styles.devWelcomePillText}>Dev: Creation Flow</Text>
                </Pressable>
              ) : null}
              {onDevSeed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dev seed demo anchor"
                  onPress={onDevSeed}
                  style={styles.devWelcomePill}
                >
                  <Text style={styles.devWelcomePillText}>Dev: Seed Demo</Text>
                </Pressable>
              ) : null}
              {onDevSkip ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dev skip onboarding"
                  onPress={onDevSkip}
                  style={styles.devWelcomePill}
                >
                  <Text style={styles.devWelcomePillText}>Dev: Skip</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>

      {/* Handoff: Screen 2's environment, mounted from the start so it is decoded before it shows */}
      <Animated.View pointerEvents="none" style={[styles.transitionWash, washStyle]}>
        <Screen2Backdrop width={width} height={height} />
      </Animated.View>
    </View>
  );
}

export function V2OnboardingJourney({ onSignIn, onCreate, onDevSkip, onDevSeed }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useCreationReduceMotion();
  const { draft, setStep, setFocusCategory } = useFirstRunStore();
  // A draft saved on a retired step resumes at the question: the cinema has been seen.
  const savedStep = draft.currentStep;
  const step: OnboardingStep = ONBOARDING_STEPS.includes(savedStep as OnboardingStep)
    ? (savedStep as OnboardingStep)
    : RETIRED_STEPS.has(savedStep)
      ? "motivation"
      : "welcome";
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // --- Screen 2 → Screen 3 handoff ---------------------------------------------------------
  // One clock (ms from Continue) drives Screen 2 leaving, Screen 3 arriving and the progress
  // roll, all on the UI thread. Screen 3 is mounted beneath Screen 2 ahead of time.
  const handoff = useSharedValue(0);
  const handoffStarted = useRef(false);
  const [focusEntry, setFocusEntry] = useState<"handoff" | "direct">("direct");
  const [focusMounted, setFocusMounted] = useState(step === "motivation");
  const [focusReady, setFocusReady] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const timeline = handoffTimeline(reduceMotion);

  // --- Question → creation handoff ---------------------------------------------------------
  // Answering is a single tap. The same clock fades the question away, rolls the header to
  // 04, holds one line ("Health. Good — let's give it a shape.") and then opens creation.
  const leaveClock = useSharedValue(0);
  const [leaving, setLeaving] = useState(false);
  const leaveTimeline = categoryHandoffTimeline(reduceMotion);

  // Header tone: light over Screen 2's photography, ink on the question's cream. During the
  // 2 → 3 handoff it turns with Screen 2's dark ground as that thins away.
  const paper = useDerivedValue(
    () => (step === "bridge" ? easeInOutCubic(seg(handoff.value, timeline.s2Ground)) : 1),
    [step, timeline],
  );

  const resetHandoff = () => {
    cancelAnimation(handoff);
    handoff.value = 0;
    handoffStarted.current = false;
  };

  useEffect(() => {
    if (step !== "bridge" || focusMounted) return;
    const timer = setTimeout(() => setFocusMounted(true), FOCUS_PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [focusMounted, step]);

  useEffect(() => {
    if (!focusMounted || focusReady) return;
    const timer = setTimeout(() => setFocusReady(true), FOCUS_READY_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [focusMounted, focusReady]);

  // Arriving on Screen 3 any other way (restore, back from creation) plays its own entrance.
  useEffect(() => {
    if (step !== "motivation" || handoffStarted.current) return;
    setFocusEntry("direct");
    handoff.value = 0;
    handoff.value = withTiming(timeline.end, { duration: timeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    handoffStarted.current = true;
  }, [handoff, step, timeline.end]);

  const startHandoff = () => {
    if (handingOff) return;
    v2Haptics.selection();
    handoffStarted.current = true;
    setFocusMounted(true);
    setFocusEntry("handoff");
    setHandingOff(true);
    handoff.value = 0;
    handoff.value = withTiming(timeline.end, { duration: timeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    // Screen 2 unmounts only once every one of its layers is transparent.
    advanceTimer.current = setTimeout(() => {
      setStep("motivation");
      setHandingOff(false);
    }, timeline.commitStep);
  };

  const choose = useCallback(
    (category: AnchorCategory) => {
      if (leaving) return;
      OnboardingAnalytics.categorySelected(category);
      setFocusCategory(category);
      setLeaving(true);
      leaveClock.value = 0;
      leaveClock.value = withTiming(leaveTimeline.end, { duration: leaveTimeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
      // Creation mounts only once every layer of the question is transparent.
      advanceTimer.current = setTimeout(() => {
        setStep("creation");
        setLeaving(false);
        leaveClock.value = 0;
      }, leaveTimeline.commitStep);
    },
    [leaveClock, leaveTimeline, leaving, setFocusCategory, setStep],
  );

  const back = () => {
    if (leaving) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (stepNumber <= 1) return;
    const previous = ONBOARDING_STEPS[stepNumber - 2];
    // Screen 3's entrance must be hidden again before its screen reappears.
    if (previous === "bridge") resetHandoff();
    v2Haptics.selection();
    setStep(previous);
  };

  const onFocusReady = useCallback(() => setFocusReady(true), []);

  if (step === "welcome")
    return (
      <View style={styles.screen}>
        <View key="prepared-bridge" style={StyleSheet.absoluteFill} pointerEvents="none">
          <V2OnboardingExplain active={false} reduceMotion={reduceMotion} handoff={handoff} nextReady={false} onContinue={startHandoff} onSkipAnimation={(ms) => OnboardingAnalytics.bridgeSkipped(ms)} />
        </View>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Welcome
          onStart={() => { OnboardingAnalytics.cta("welcome", "start"); setStep("bridge"); }}
          onSignIn={onSignIn}
          onCreate={onCreate}
          onDevSkip={onDevSkip}
          onDevSeed={onDevSeed}
          reduceMotion={reduceMotion}
        />
      </View>
    );

  return (
    <View style={[styles.screen, styles.openingScreen]} testID={step === "motivation" ? "v2-onboarding-motivation" : undefined}>
      <StatusBar style={step === "motivation" ? "dark" : "light"} translucent backgroundColor="transparent" />
      {/* Screen 3 stays mounted while it is the current step, so back navigation from a
          restored later step always has a screen to land on. */}
      {focusMounted || step === "motivation" ? (
        <V2OnboardingFocusArea
          key="focus-area"
          clock={handoff}
          active={step === "motivation" || handingOff}
          reduceMotion={reduceMotion}
          selected={draft.focusCategory}
          onChoose={choose}
          leaveClock={leaveClock}
          leaveTimeline={leaveTimeline}
          onReady={onFocusReady}
        />
      ) : null}
      {step === "bridge" ? (
        <View key="prepared-bridge" style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <V2OnboardingExplain
            active
            reduceMotion={reduceMotion}
            handoff={handoff}
            nextReady={focusMounted && focusReady}
            onContinue={startHandoff}
            onSkipAnimation={(ms) => OnboardingAnalytics.bridgeSkipped(ms)}
          />
        </View>
      ) : null}
      <OpeningProgressHeader
        key="progress"
        topInset={insets.top}
        onBack={back}
        onSkip={onDevSkip}
        interactive={!handingOff && !leaving}
        paper={paper}
        exit={leaving ? { clock: leaveClock, window: leaveTimeline.uiOut } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  openingScreen: { backgroundColor: colors.ink.deep, overflow: "hidden" },
  paperScreen: { backgroundColor: colors.background },
  darkScreen: { backgroundColor: colors.ink.base },
  fullBleed: { flex: 1, backgroundColor: "#0E151C", overflow: "hidden" },
  panorama: { position: "absolute", top: 0, left: 0 },
  transitionWash: { ...StyleSheet.absoluteFillObject, zIndex: 5 },
  welcomeContentContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
  },
  welcomeCenter: {
    alignItems: "center",
    alignSelf: "center",
  },
  brandMark: {
    // The opening brand moment of the entire experience: generous presence with breathing room
    width: 60,
    height: 78,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  wordmark: {
    color: "#FFFFFF",
    fontSize: 24,
    letterSpacing: 9,
    fontFamily: "Inter-SemiBold",
    marginTop: 14,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  brandSub: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 10.5,
    letterSpacing: 3.5,
    fontFamily: "Inter-SemiBold",
    marginTop: 7,
    textShadowColor: "rgba(0, 0, 0, 0.45)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  welcomeBottom: {
    alignSelf: "stretch",
    alignItems: "stretch",
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Inter-SemiBold",
    letterSpacing: -0.6,
    textAlign: "left",
  },
  welcomeBody: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter-Regular",
    textAlign: "left",
    marginTop: 12,
    marginBottom: 26,
    maxWidth: 340,
  },
  welcomeCta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F4DDB8",
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  welcomeCtaText: {
    color: "#14162B",
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
  },
  signIn: {
    alignSelf: "center",
    paddingTop: 16,
    paddingBottom: 4,
  },
  signInText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 13.5,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  signInUnderline: {
    color: "#F4DDB8",
    fontFamily: "Inter-SemiBold",
    textDecorationLine: "underline",
  },
  header: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 22,
  },
  back: { width: 36, height: 44, justifyContent: "center" },
  progressTrack: {
    height: 5,
    flex: 1,
    backgroundColor: "#C9C8C2",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressTrackDark: { backgroundColor: "#3A4248" },
  progressFill: {
    height: 5,
    backgroundColor: colors.ink.base,
    borderRadius: 8,
  },
  progressFillDark: { backgroundColor: "#E9D5AB" },
  counter: {
    width: 38,
    textAlign: "right",
    color: colors.text.primary,
    fontSize: 13,
  },
  lightText: { color: colors.surface },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 27,
    paddingTop: 18,
    paddingBottom: 22,
  },
  headingBlock: { alignItems: "center", marginBottom: 21 },
  title: {
    color: colors.text.primary,
    fontFamily: "EBGaramond-Regular",
    fontSize: 31,
    lineHeight: 33,
    textAlign: "center",
  },
  titleLight: { color: colors.surface },
  support: {
    color: "#4F4C48",
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
  },
  supportLight: { color: "#E0DDD5" },
  list: { gap: 3 },
  row: {
    minHeight: 49,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#DCD6CC",
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  rowDark: { borderColor: "#39434B" },
  rowSelected: {
    backgroundColor: "rgba(211,171,105,0.14)",
    borderRadius: 8,
    borderColor: "#B99661",
  },
  rowIndex: { width: 26, fontSize: 13, fontFamily: "Inter-SemiBold" },
  rowLabel: {
    flex: 1,
    color: colors.text.primary,
    fontSize: 14,
    lineHeight: 19,
  },
  rowLabelDark: { color: colors.surface },
  check: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: colors.ink.base,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDark: { backgroundColor: "#E9D5AB" },
  emptyCheck: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#87847E",
  },
  footer: { paddingHorizontal: 27, paddingTop: 9, paddingBottom: 12 },
  cta: {
    height: 52,
    borderRadius: 28,
    backgroundColor: "#F4DDB8",
    paddingHorizontal: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaDark: { backgroundColor: colors.ink.base },
  ctaText: {
    color: colors.text.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    textAlign: "center",
    flex: 1,
  },
  ctaTextLight: { color: colors.surface },
  disabled: { opacity: 0.45 },
  summary: { borderTopWidth: 1, borderColor: "#CFC6B8", marginTop: 4 },
  summaryLine: {
    borderBottomWidth: 1,
    borderColor: "#D8D0C3",
    paddingVertical: 12,
  },
  summaryLabel: { color: "#756E65", fontSize: 12 },
  summaryLabelDark: { color: "#E9D5AB" },
  summaryValue: {
    color: colors.text.primary,
    fontSize: 17,
    lineHeight: 23,
    marginTop: 3,
  },
  summaryValueDark: { color: colors.surface },
  reflection: {
    color: colors.text.primary,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 8,
    textAlign: "center",
    marginBottom: 2,
  },
  statement: {
    color: colors.text.primary,
    fontFamily: "EBGaramond-Italic",
    fontSize: 22,
    lineHeight: 27,
    textAlign: "center",
    marginTop: 30,
    paddingHorizontal: 10,
  },
  diagram: { marginHorizontal: -27, paddingHorizontal: 27, marginTop: 9, minHeight: 215, justifyContent: "center", overflow: "hidden" },
  diagramWash: { ...StyleSheet.absoluteFillObject, top: -18 },
  stages: { flexDirection: "row", gap: 8 },
  stage: { flex: 1, alignItems: "center" },
  stageArt: {
    width: 68,
    height: 64,
    borderBottomWidth: 1,
    borderColor: "#BB9D67",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  stageVerb: { color: "#E9D5AB", fontSize: 10, letterSpacing: 1.4 },
  stageName: {
    color: colors.surface,
    fontFamily: "EBGaramond-Regular",
    fontSize: 20,
    marginTop: 3,
  },
  stageText: {
    color: "#E0DDD5",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 7,
  },
  lineTrack: { height: 2, marginTop: 18, backgroundColor: "#303B44" },
  lineFill: { height: 2, backgroundColor: "#D1B27D" },
  progressLayer: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginTop: 14,
  },
  progressName: { color: "#E9D5AB", fontSize: 11, letterSpacing: 1 },
  progressCopy: { color: "#DADAD6", fontSize: 12, marginTop: 3 },
  handoffShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,14,19,0.19)",
  },
  handoffScroll: { justifyContent: "space-between" },
  handoffBrand: { alignItems: "center", marginTop: 28 },
  handoffWordmark: { color: "#FAF3E8", fontSize: 27, letterSpacing: 8 },
  handoffBrandSub: { color: "#FAF3E8", fontSize: 9, letterSpacing: 3 },
  handoffMessage: { alignItems: "center", marginTop: 35 },
  handoffTitle: {
    color: "#FFF7E9",
    fontFamily: "EBGaramond-Regular",
    fontSize: 34,
    textAlign: "center",
  },
  handoffSupport: {
    color: "#FFF7E9",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 290,
  },
  handwriting: {
    color: "#1D2020",
    fontFamily: "EBGaramond-Italic",
    fontSize: 30,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: "25%",
  },
  headingBlockCompact: { marginBottom: 10 },
  titleCompact: { fontSize: 25, lineHeight: 26 },
  supportCompact: { fontSize: 12, lineHeight: 16, marginTop: 7 },
  rowCompact: { minHeight: 44 },
  connectorTrack: {
    position: "absolute",
    left: "13%",
    right: "13%",
    top: 33,
    height: 2,
    backgroundColor: "#334049",
  },
  connectorNode: {
    position: "absolute",
    top: -4,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRadius: 5,
    backgroundColor: "#E9D5AB",
  },
  stageArtMasked: { backgroundColor: colors.ink.base, zIndex: 1 },
  stageImage: { width: 78, height: 66, borderWidth: 1, borderColor: '#8B7756' },
  practiceMiniature: { width: 68, height: 66, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8B7756', backgroundColor: '#19232B' },
  practiceMark: { width: 36, height: 50 },
  devWelcomePill: {
    backgroundColor: "rgba(20, 22, 43, 0.75)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  devWelcomePillText: {
    color: "#E9D5AB",
    fontSize: 12,
    fontWeight: "600",
  },
});
