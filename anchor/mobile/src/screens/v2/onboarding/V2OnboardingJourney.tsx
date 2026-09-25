import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  TrendingUp,
} from "lucide-react-native";
import { useFirstRunStore } from "@/stores/v2/firstRunStore";
import {
  LIFE_CHANGES,
  ONBOARDING_STEPS,
  PRIMARY_NEEDS,
  type OnboardingStep,
} from "@/constants/v2/onboarding";
import { colors } from "@/theme/v2";
import { useV2ReduceMotion, v2Haptics } from "@/hooks/v2";
import type { AnchorCategory } from "@/types";
import { V2OnboardingExplain } from "./V2OnboardingExplain";
import { V2OnboardingFocusArea } from "./V2OnboardingFocusArea";
import { V2OnboardingOutcome } from "./V2OnboardingOutcome";
import { OpeningProgressHeader } from "./OpeningProgressHeader";
import { handoffTimeline } from "./openingHandoff";
import { outcomeHandoffTimeline, type OutcomeOriginFrame } from "./outcomeHandoff";
import { Screen2Backdrop } from "./screen2Backdrop";

/** Screen 3 mounts beneath Screen 2 this long after Screen 2 starts, so it is decoded before Continue. */
const FOCUS_PRELOAD_DELAY_MS = 600;
/** If the runner plate never reports ready (e.g. decode failure), don't hold Screen 2's CTA forever. */
const FOCUS_READY_FALLBACK_MS = 3000;
/** Screen 4 mounts beneath Screen 3 this long after Screen 3 is reached. It reuses Screen 3's
 * own card art, already decoded, so this only needs to clear the mount past the entrance. */
const OUTCOME_PRELOAD_DELAY_MS = 250;

const panorama = require("@/assets/onboarding/welcome-panorama.png");
const desk = require("@/assets/onboarding/creation-desk.png");
const brandMark = require("@/assets/home/anchor-brand-mark.png");
const lightMark = require("@/assets/home/anchor-brand-mark-light.png");

type Props = { onSignIn: () => void; onCreate: () => void };

function Cta({
  label,
  onPress,
  dark = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  dark?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.cta, dark && styles.ctaDark, disabled && styles.disabled]}
    >
      <Text style={[styles.ctaText, dark && styles.ctaTextLight]}>{label}</Text>
      <ArrowRight
        size={19}
        color={dark ? colors.surface : colors.text.primary}
      />
    </Pressable>
  );
}

function Header({
  step,
  onBack,
  dark,
}: {
  step: number;
  onBack: () => void;
  dark: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        hitSlop={12}
        style={styles.back}
      >
        <ArrowLeft
          size={22}
          color={dark ? colors.surface : colors.text.primary}
        />
      </Pressable>
      <View
        style={[styles.progressTrack, dark && styles.progressTrackDark]}
        accessibilityLabel={`Step ${step} of 8`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 8, now: step }}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${(step / 8) * 100}%` },
            dark && styles.progressFillDark,
          ]}
        />
      </View>
      <Text style={[styles.counter, dark && styles.lightText]}>{step} / 8</Text>
    </View>
  );
}

function ChoiceRow({
  label,
  selected,
  onPress,
  multi = false,
  dark = false,
  compact = false,
  accent,
  index,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  dark?: boolean;
  compact?: boolean;
  accent?: string;
  index?: number;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={[
        styles.row,
        compact && styles.rowCompact,
        dark && styles.rowDark,
        selected && styles.rowSelected,
      ]}
    >
      {index != null ? (
        <Text
          style={[styles.rowIndex, { color: accent ?? colors.text.secondary }]}
        >
          {String(index + 1).padStart(2, "0")}
        </Text>
      ) : null}
      <Text style={[styles.rowLabel, dark && styles.rowLabelDark]}>
        {label}
      </Text>
      {selected ? (
        <View style={[styles.check, dark && styles.checkDark]}>
          <Check
            size={15}
            strokeWidth={3}
            color={dark ? colors.ink.base : colors.surface}
          />
        </View>
      ) : multi ? (
        <View style={styles.emptyCheck} />
      ) : (
        <ChevronRight
          size={17}
          color={dark ? colors.surface : colors.text.secondary}
        />
      )}
    </Pressable>
  );
}

function SectionHeading({
  title,
  support,
  dark = false,
  compact = false,
}: {
  title: string;
  support: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.headingBlock, compact && styles.headingBlockCompact]}>
      <Text
        style={[
          styles.title,
          compact && styles.titleCompact,
          dark && styles.titleLight,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.support,
          compact && styles.supportCompact,
          dark && styles.supportLight,
        ]}
      >
        {support}
      </Text>
    </View>
  );
}

function Welcome({
  onStart,
  onSignIn,
  reduceMotion,
}: {
  onStart: () => void;
  onSignIn: () => void;
  reduceMotion: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // The supplied locked panoramic artwork (3:1 aspect ratio) owns the entire screen.
  // The device is a vertical camera window looking into a wider cinematic world.
  const PANORAMA_ASPECT = 1024 / 341;
  const panoramaHeight = height;
  const panoramaWidth = panoramaHeight * PANORAMA_ASPECT;
  const maxTravel = Math.max(0, panoramaWidth - width);
  // Subtle atmospheric GTA-style camera pan revealing Real World -> Illustrated transition
  const panDistance = Math.min(maxTravel, Math.max(220, width * 0.55));

  const pan = useSharedValue(0);
  const wash = useSharedValue(0);
  const uiOut = useSharedValue(0);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      pan.value = 0;
      return;
    }
    pan.value = withRepeat(
      withTiming(1, {
        duration: 10000,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [reduceMotion, pan]);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const panStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -panDistance * pan.value }],
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
      const maxPan = panDistance > 0 ? maxTravel / panDistance : 0;
      pan.value = withTiming(Math.min(maxPan, pan.value + 0.12), {
        duration: 900,
        easing: Easing.out(Easing.cubic),
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
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      {/* 1. PANORAMIC ENVIRONMENTAL ARTWORK */}
      <Animated.Image
        source={panorama}
        resizeMode="cover"
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
        {/* Stationary Anchor 2.0 Deep Ink Brand Mark & Wordmark */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(600)}
          style={styles.welcomeCenter}
        >
          <Image
            source={brandMark}
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
            onPress={onSignIn}
            style={styles.signIn}
          >
            <Text style={styles.signInText}>
              Already use Anchor?{" "}
              <Text style={styles.signInUnderline}>Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Handoff: Screen 2's environment, mounted from the start so it is decoded before it shows */}
      <Animated.View pointerEvents="none" style={[styles.transitionWash, washStyle]}>
        <Screen2Backdrop width={width} height={height} />
      </Animated.View>
    </View>
  );
}

function SystemDiagram({ reduceMotion }: { reduceMotion: boolean }) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withDelay(750, withTiming(1, { duration: 2100 }));
  }, [progress, reduceMotion]);
  const lineStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const stages = [
    {
      verb: "SEE",
      name: "Vision",
      text: "See what you're moving toward.",
    },
    {
      verb: "REINFORCE",
      name: "Practice",
      text: "Keep it present through focused sessions.",
    },
    {
      verb: "MOVE",
      name: "Chart",
      text: "Turn it into a path with clear next steps.",
    },
  ];
  return (
    <View
      style={styles.diagram}
      accessibilityLabel="See with Vision, reinforce with Practice, move with Chart. Progress shows the movement you are making."
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10,20,29,0)", "rgba(10,20,29,0.90)", colors.ink.base]}
        locations={[0, 0.42, 1]}
        style={styles.diagramWash}
      />
      <View style={styles.stages}>
        <View style={styles.connectorTrack}>
          <Animated.View style={[styles.lineFill, lineStyle]} />
          <View style={[styles.connectorNode, { left: "33.3%" }]} />
          <View style={[styles.connectorNode, { left: "66.6%" }]} />
        </View>
        {stages.map(({ verb, name, text }, index) => (
          <Animated.View
            entering={
              reduceMotion ? undefined : FadeIn.delay(350 + index * 1050).duration(420)
            }
            key={name}
            style={styles.stage}
          >
            <View style={[styles.stageArt, styles.stageArtMasked]}>
              {name === "Vision" ? <Image source={require("@/assets/vision/vision-future-window-wide.jpg")} resizeMode="cover" style={styles.stageImage} /> : null}
              {name === "Practice" ? <View style={styles.practiceMiniature}><Image source={lightMark} resizeMode="contain" style={styles.practiceMark} /></View> : null}
              {name === "Chart" ? <Image source={require("@/assets/anchor-details/chart-empty-card.jpg")} resizeMode="cover" style={styles.stageImage} /> : null}
            </View>
            <Text style={styles.stageVerb}>{verb}</Text>
            <Text style={styles.stageName}>{name}</Text>
            <Text style={styles.stageText}>{text}</Text>
          </Animated.View>
        ))}
      </View>
      <View style={styles.lineTrack}>
        <Animated.View style={[styles.lineFill, lineStyle]} />
      </View>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.delay(3150).duration(400)}
        style={styles.progressLayer}
      >
        <TrendingUp size={21} color="#E9D5AB" />
        <View>
          <Text style={styles.progressName}>PROGRESS</Text>
          <Text style={styles.progressCopy}>
            See the movement you're making.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function V2OnboardingJourney({ onSignIn, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const {
    draft,
    setStep,
    setFocusCategory,
    setDesiredOutcome,
    toggleLifeChange,
    setPrimaryNeed,
    markAnswersComplete,
  } = useFirstRunStore();
  const step = ONBOARDING_STEPS.includes(draft.currentStep as OnboardingStep)
    ? (draft.currentStep as OnboardingStep)
    : "welcome";
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;
  const dark = step === "need";
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);
  const setNext = (next: OnboardingStep) => {
    v2Haptics.selection();
    setStep(next);
  };
  // --- Screen 2 → Screen 3 handoff ---------------------------------------------------------
  // One clock (ms from Continue) drives Screen 2 leaving, Screen 3 arriving and the progress
  // roll, all on the UI thread. Screen 3 is mounted beneath Screen 2 ahead of time.
  const handoff = useSharedValue(0);
  const handoffStarted = useRef(false);
  const [focusEntry, setFocusEntry] = useState<"handoff" | "direct">("direct");
  const [focusMounted, setFocusMounted] = useState(step === "motivation");
  const [focusReady, setFocusReady] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const timeline = handoffTimeline(reduceMotion);

  // --- Screen 3 → Screen 4 handoff ---------------------------------------------------------
  // Same pattern, one step later: the selected category illustration is the transition
  // object, travelling from its measured Screen 3 card frame to the Screen 4 hero position.
  const outcomeClock = useSharedValue(0);
  const outcomeHandoffStarted = useRef(false);
  const [outcomeEntry, setOutcomeEntry] = useState<"handoff" | "direct">("direct");
  const [outcomeMounted, setOutcomeMounted] = useState(step === "outcome");
  const [handingOffToOutcome, setHandingOffToOutcome] = useState(false);
  const [outcomeOriginFrame, setOutcomeOriginFrame] = useState<OutcomeOriginFrame | null>(null);
  const outcomeTimeline = outcomeHandoffTimeline(reduceMotion);

  const resetHandoff = () => {
    cancelAnimation(handoff);
    handoff.value = 0;
    handoffStarted.current = false;
  };
  const resetOutcomeHandoff = () => {
    cancelAnimation(outcomeClock);
    outcomeClock.value = 0;
    outcomeHandoffStarted.current = false;
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

  // Screen 4 reuses Screen 3's own card art (already decoded), so it mounts as soon as
  // Screen 3 is reachable — no separate readiness gate is needed.
  useEffect(() => {
    if (step !== "motivation" || outcomeMounted) return;
    const timer = setTimeout(() => setOutcomeMounted(true), OUTCOME_PRELOAD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [outcomeMounted, step]);

  // Arriving on Screen 3 any other way (restore, back from Screen 4) plays its own entrance.
  useEffect(() => {
    if (step !== "motivation" || handoffStarted.current) return;
    setFocusEntry("direct");
    handoff.value = 0;
    handoff.value = withTiming(timeline.end, { duration: timeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    handoffStarted.current = true;
  }, [handoff, step, timeline.end]);

  // Arriving on Screen 4 any other way (restore, back from Screen 5) plays its own entrance.
  useEffect(() => {
    if (step !== "outcome" || outcomeHandoffStarted.current) return;
    setOutcomeEntry("direct");
    outcomeClock.value = 0;
    outcomeClock.value = withTiming(outcomeTimeline.end, { duration: outcomeTimeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    outcomeHandoffStarted.current = true;
  }, [outcomeClock, step, outcomeTimeline.end]);

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

  const startOutcomeHandoff = (originFrame: OutcomeOriginFrame | null) => {
    if (handingOffToOutcome) return;
    v2Haptics.selection();
    outcomeHandoffStarted.current = true;
    setOutcomeOriginFrame(originFrame);
    setOutcomeMounted(true);
    setOutcomeEntry("handoff");
    setHandingOffToOutcome(true);
    outcomeClock.value = 0;
    outcomeClock.value = withTiming(outcomeTimeline.end, { duration: outcomeTimeline.end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    // Screen 3 unmounts only once every one of its layers is transparent.
    advanceTimer.current = setTimeout(() => {
      setStep("outcome");
      setHandingOffToOutcome(false);
    }, outcomeTimeline.commitStep);
  };

  const back = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (stepNumber <= 1) return;
    const previous = ONBOARDING_STEPS[stepNumber - 2];
    // Screen 3's entrance must be hidden again before its screen reappears.
    if (previous === "bridge" || previous === "motivation") resetHandoff();
    if (previous === "motivation" || previous === "outcome") resetOutcomeHandoff();
    setStep(previous);
  };
  const onHeroReady = useCallback(() => setFocusReady(true), []);
  const selectFocus = useCallback((category: AnchorCategory) => setFocusCategory(category), [setFocusCategory]);
  const selectOutcome = useCallback((outcome: string) => setDesiredOutcome(outcome), [setDesiredOutcome]);

  // Legacy drafts may still carry a free-text motivation; new drafts carry a focus area.
  const motivation = (draft.motivation ?? "").trim();
  const effectiveChange = (draft.desiredOutcome ?? "").trim();
  // Screen 4's hero and outcome choices follow the Screen 3 choice directly.
  const screen4Category: AnchorCategory = draft.focusCategory ?? "custom";
  const footer = (label: string, next: () => void, disabled = false) => (
    <View style={styles.footer}>
      <Cta label={label} onPress={next} dark={!dark} disabled={disabled} />
    </View>
  );

  if (step === "welcome")
    return (
      <View style={styles.screen}>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Welcome
          onStart={() => setNext("bridge")}
          onSignIn={onSignIn}
          reduceMotion={reduceMotion}
        />
      </View>
    );

  if (step === "bridge" || step === "motivation" || step === "outcome") {
    const rolls = step === "bridge" || focusEntry === "handoff";
    // The shared header represents whichever handoff is currently in flight (or, at rest,
    // the screen the user is actually on): 2 → 3, then 3 → 4, one clock at a time.
    const header = handingOffToOutcome
      ? { from: 3, to: 4, current: 3, clock: outcomeClock, window: outcomeTimeline.progress }
      : step === "outcome"
        ? { from: 4, to: 4, current: 4, clock: outcomeClock, window: outcomeTimeline.progress }
        : { from: rolls ? 2 : 3, to: 3, current: step === "bridge" ? 2 : 3, clock: handoff, window: timeline.progress };
    return (
      <View style={[styles.screen, styles.openingScreen]} testID={step === "motivation" ? "v2-onboarding-motivation" : undefined}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        {focusMounted ? (
          <V2OnboardingFocusArea
            key="focus-area"
            clock={handoff}
            entry={focusEntry}
            active={step === "motivation" || handingOff}
            reduceMotion={reduceMotion}
            selected={draft.focusCategory}
            onSelect={selectFocus}
            outcomeClock={outcomeClock}
            outcomeTimeline={outcomeTimeline}
            onContinue={startOutcomeHandoff}
            onSheetChange={setSheetOpen}
            onHeroReady={onHeroReady}
          />
        ) : null}
        {step === "bridge" ? (
          <V2OnboardingExplain
            key="explain"
            reduceMotion={reduceMotion}
            handoff={handoff}
            nextReady={focusMounted && focusReady}
            onContinue={startHandoff}
          />
        ) : null}
        {outcomeMounted ? (
          <V2OnboardingOutcome
            key="outcome"
            clock={outcomeClock}
            entry={outcomeEntry}
            active={step === "outcome" || handingOffToOutcome}
            reduceMotion={reduceMotion}
            category={screen4Category}
            selected={draft.desiredOutcome}
            onSelect={selectOutcome}
            onContinue={() => setNext("life")}
            originFrame={outcomeOriginFrame}
          />
        ) : null}
        <OpeningProgressHeader
          key="progress"
          topInset={insets.top}
          from={header.from}
          to={header.to}
          current={header.current}
          clock={header.clock}
          window={header.window}
          reduceMotion={reduceMotion}
          onBack={back}
          interactive={!handingOff && !handingOffToOutcome && !sheetOpen}
          dimmed={sheetOpen}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        dark ? styles.darkScreen : styles.paperScreen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
      testID={`v2-onboarding-${step}`}
    >
      <StatusBar
        style={dark ? "light" : "dark"}
        translucent
        backgroundColor="transparent"
      />
      {step === "handoff" ? (
        <ImageBackground
          source={desk}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        >
          <View style={styles.handoffShade} />
        </ImageBackground>
      ) : null}
      <Header step={stepNumber} onBack={back} dark={dark} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          step === "handoff" && styles.handoffScroll,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === "life" && (
          <>
            <SectionHeading
              compact
              title={"Picture this working out.\nWhat changes first?"}
              support="Select all that apply."
            />
            <View style={styles.list}>
              {LIFE_CHANGES.map((change, index) => (
                <ChoiceRow
                  key={change}
                  label={change}
                  index={index}
                  compact
                  multi
                  selected={draft.lifeChanges?.includes(change) ?? false}
                  onPress={() => {
                    toggleLifeChange(change);
                    v2Haptics.selection();
                    AccessibilityInfo.announceForAccessibility(
                      `${change} ${draft.lifeChanges?.includes(change) ? "deselected" : "selected"}`,
                    );
                  }}
                />
              ))}
            </View>
          </>
        )}
        {step === "need" && (
          <>
            <SectionHeading
              compact
              dark
              title={"What matters most\nright now?"}
              support={"What would make the biggest\ndifference for you?"}
            />
            <View style={styles.list}>
              {PRIMARY_NEEDS.map((need, index) => (
                <ChoiceRow
                  key={need}
                  label={need}
                  index={index}
                  compact
                  dark
                  accent="#E9D5AB"
                  selected={draft.primaryNeed === need}
                  onPress={() => {
                    setPrimaryNeed(need);
                    v2Haptics.selection();
                  }}
                />
              ))}
            </View>
          </>
        )}
        {step === "summary" && (
          <>
            <SectionHeading title="Your path, connected." support="See it clearly. Reinforce it daily. Move toward it with clarity." />
            <Text style={styles.reflection}>
              {personalizedReflection(
                motivation,
                draft.customDesiredChange ?? "",
                effectiveChange,
                draft.lifeChanges ?? [],
                draft.primaryNeed ?? "",
              )}
            </Text>
            <SystemDiagram reduceMotion={reduceMotion} />
          </>
        )}
        {step === "handoff" && (
          <>
            <View style={styles.handoffBrand}>
              <Text style={styles.handoffWordmark}>ANCHOR</Text>
              <Text style={styles.handoffBrandSub}>VISUAL GOAL SETTING</Text>
            </View>
            <View style={styles.handoffMessage}>
              <Text style={styles.handoffTitle}>Let's give it a form.</Text>
              <Text style={styles.handoffSupport}>
                Turn what you discovered into a present-tense intention about the change you want to see.
              </Text>
            </View>
            <Text style={styles.handwriting}>I...</Text>
          </>
        )}
      </ScrollView>
      {step === "life"
        ? footer("Continue", () => setNext("need"), !draft.lifeChanges?.length)
        : null}
      {step === "need"
        ? footer("Continue", () => setNext("summary"), !draft.primaryNeed)
        : null}
      {step === "summary"
        ? footer("Looks good", () => {
            markAnswersComplete();
            setNext("handoff");
          })
        : null}
      {step === "handoff" ? footer("Create my first Anchor", onCreate) : null}
    </View>
  );
}

function personalizedReflection(
  motivation: string,
  customMotivation: string,
  outcome: string,
  lifeChanges: string[],
  primaryNeed: string,
) {
  const hope = motivation === "Something else" ? customMotivation : motivation;
  const changes = lifeChanges.join(" and ");
  const opening = hope ? `“${hope}.” ` : "";
  return `${opening}You want ${outcome}. First, ${changes.toLowerCase()} shift. ${primaryNeed} would help most.`;
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
    width: 36,
    height: 46,
    tintColor: "#14162B",
  },
  wordmark: {
    color: "#14162B",
    fontSize: 18,
    letterSpacing: 7.5,
    fontFamily: "Inter-SemiBold",
    marginTop: 6,
  },
  brandSub: {
    color: "rgba(20, 22, 43, 0.72)",
    fontSize: 8.5,
    letterSpacing: 2.8,
    fontFamily: "Inter-SemiBold",
    marginTop: 3,
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
});
