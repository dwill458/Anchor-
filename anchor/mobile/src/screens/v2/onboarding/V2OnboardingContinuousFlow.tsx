/**
 * Anchor 2.0 Continuous Onboarding Flow (Screens 4–8)
 *
 * Implements Screens 4, 5, 6, 7, and 8 as one continuous motion sequence.
 * - Screen 4: Desired Outcome ("What would changing this give you?")
 * - Screen 5: Emotional Meaning ("Why does this matter to you now?")
 * - Screen 6: Friction ("What usually gets in the way?")
 * - Screen 7: How Anchor Works ("Keep what matters in sight." / SEE → REINFORCE → MOVE)
 * - Screen 8: Final Handoff ("You know what matters. Now give it a shape.")
 *
 * Persistent elements:
 * - Uniform cream background (#FBF8F2)
 * - Category flower illustration stays persistent across 4, 5, 6, reduces into Screen 7 hero, and fades on Screen 8.
 * - Personalized pill evolves (CATEGORY -> CATEGORY · OUTCOME) and stays persistent across 4, 5, 6, 7.
 * - Center Anchor in REINFORCE (Screen 7) smoothly expands and translates to become the hero Anchor of Screen 8!
 */
import React, { useEffect, useMemo } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import {
  Canvas,
  Image as SkiaImage,
  Mask,
  RadialGradient,
  Rect,
  useImage,
  vec,
} from "@shopify/react-native-skia";
import type { AnchorCategory } from "@/types";
import {
  focusAreaLabel,
  outcomeQuestionOptionsFor,
  whyQuestionOptionsFor,
  frictionQuestionOptionsFor,
  type OnboardingStep,
} from "@/constants/v2/onboarding";
import { colors } from "@/theme/v2";
import { v2Haptics } from "@/hooks/v2";
import { isCompactPhoneViewport, isShortPhoneViewport } from "@/utils/layout";
import {
  MOVE_ART,
  accentFor,
  anchorArtFor,
  heroArtFor,
  seeArtFor,
} from "./onboardingArt";
import {
  ONBOARDING_METRICS,
  SCREEN5_TYPE,
  screen5LabelDescGap,
  solveOutcomeHero,
  solveScreen5Layout,
  solveScreen8Layout,
  type Frame,
} from "./screen5Layout";
import { easeOutCubic, seg, type OutcomeOriginFrame, type OutcomeHandoffTimeline } from "./outcomeHandoff";
import { ContinuousChoiceRow } from "./ContinuousChoiceRow";

const CREAM = colors.background;
const INK = "#14162B";
const MUTED = "#5E5A55";
const GOLD_TEXT = "#A87A2C";
const GOLD_RULE = "#D4AF6A";
const M = ONBOARDING_METRICS;
const revealSegment = (value: number, start: number, end: number) => {
  "worklet";
  return Math.min(1, Math.max(0, (value - start) / (end - start)));
};

export type ContinuousStepNumber = 4 | 5 | 6 | 7 | 8;

interface Props {
  step: OnboardingStep;
  category: AnchorCategory;
  selectedOutcome?: string;
  selectedWhy?: string;
  selectedFriction?: string;
  onSelectOutcome: (outcome: string) => void;
  onSelectWhy: (why: string) => void;
  onSelectFriction: (friction: string) => void;
  onStepChange: (step: OnboardingStep) => void;
  onCreateAnchor: () => void;
  outcomeClock: SharedValue<number>;
  outcomeTimeline: OutcomeHandoffTimeline;
  originFrame?: OutcomeOriginFrame | null;
  entry: "handoff" | "direct";
  reduceMotion: boolean;
  stepProgress: SharedValue<number>;
  transitionClock: SharedValue<number>;
}

function OrganicVision({ source, frame }: { source: ImageSourcePropType; frame: Frame }) {
  const image = useImage(source as number);
  const { width, height } = frame;
  if (!image) {
    return (
      <Image
        source={source}
        resizeMode="cover"
        style={{ width, height, borderRadius: Math.min(width, height) / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const cx = width / 2;
  const cy = height / 2;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Mask
        mode="alpha"
        mask={
          <Rect x={0} y={0} width={width} height={height}>
            <RadialGradient
              c={vec(cx, cy)}
              r={width / 2}
              colors={["rgba(0,0,0,1)", "rgba(0,0,0,1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
              positions={[0, 0.52, 0.8, 1]}
              transform={[{ translateY: cy }, { scaleY: height / width }, { translateY: -cy }]}
            />
          </Rect>
        }
      >
        <SkiaImage image={image} fit="cover" x={0} y={0} width={width} height={height} />
      </Mask>
    </Canvas>
  );
}

function ChoiceEntrance({
  phase, index, progress, transition, clock, timeline, entry, reduceMotion, children,
}: {
  phase: 4 | 5 | 6;
  index: number;
  progress: SharedValue<number>;
  transition: SharedValue<number>;
  clock: SharedValue<number>;
  timeline: OutcomeHandoffTimeline;
  entry: "handoff" | "direct";
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ translateY: 0 }] };
    const reveal = phase === 4
      ? entry === "handoff"
        ? easeOutCubic(seg(clock.value, [timeline.choicesStart + index * timeline.choiceStagger, timeline.choicesStart + index * timeline.choiceStagger + timeline.choiceDuration]))
        : 1
      : progress.value >= phase ? 1 : revealSegment(transition.value, 0.52 + index * 0.075, 0.74 + index * 0.075);
    return { opacity: reveal, transform: [{ translateY: 8 * (1 - reveal) }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function V2OnboardingContinuousFlow({
  step,
  category,
  selectedOutcome,
  selectedWhy,
  selectedFriction,
  onSelectOutcome,
  onSelectWhy,
  onSelectFriction,
  onStepChange,
  onCreateAnchor,
  outcomeClock,
  outcomeTimeline,
  originFrame,
  entry,
  reduceMotion,
  stepProgress,
  transitionClock,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = isCompactPhoneViewport(W, H) || isShortPhoneViewport(H);

  const accent = accentFor(category);
  const categoryLabel = (focusAreaLabel(category) ?? "Custom").toUpperCase();
  const heroArt = heroArtFor(category);
  const anchorArt = anchorArtFor(category);
  const seeArt = seeArtFor(category);

  // Compute exact layout frames
  const outcomeHero = solveOutcomeHero(W, H, insets, 4);
  const s7Layout = solveScreen5Layout(W, H, insets);
  const s8Layout = solveScreen8Layout(W, H, insets);

  const rowHeight = compact ? 56 : 64;
  const rowGap = compact ? 8 : 10;

  // Options
  const outcomeOptions = useMemo(() => outcomeQuestionOptionsFor(category), [category]);
  const whyOptions = useMemo(() => whyQuestionOptionsFor(category), [category]);
  const frictionOptions = useMemo(() => frictionQuestionOptionsFor(category), [category]);

  const targetStepNumber: ContinuousStepNumber =
    step === "meaning" ? 5 :
    step === "friction" ? 6 :
    step === "system" ? 7 :
    step === "handoff" ? 8 : 4;
  const systemReveal = useSharedValue(targetStepNumber >= 7 ? 1 : 0);
  const ctaPress = useSharedValue(1);

  // Hold warm paper inside an ink atmosphere, then let the scene turn toward
  // dusk as the system and finished Anchor come into view.
  const creamSceneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stepProgress.value, [4, 6, 7, 8], [1, 1, 0.75, 0.12], "clamp"),
  }));
  const atmosphereStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stepProgress.value, [4, 5, 6, 7, 8], [0.72, 0.48, 0.5, 0.72, 0.98], "clamp"),
  }));
  const s7InkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(stepProgress.value, [7, 8], [INK, "#F4F1E9"]),
  }));
  const s7MutedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(stepProgress.value, [7, 8], [MUTED, "rgba(244,241,233,0.72)"]),
  }));
  const s7LabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(stepProgress.value, [7, 8], [GOLD_TEXT, "#D4AF6A"]),
  }));
  const s8InkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(stepProgress.value, [7.4, 8], [INK, "#F4F1E9"]),
  }));
  const s8MutedStyle = useAnimatedStyle(() => ({
    color: interpolateColor(stepProgress.value, [7.4, 8], [MUTED, "rgba(244,241,233,0.72)"]),
  }));

  useEffect(() => {
    if (targetStepNumber === 7) {
      systemReveal.value = reduceMotion ? 1 : withTiming(1, {
        duration: 1150,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      });
    } else if (targetStepNumber <= 6) {
      systemReveal.value = 0;
    }
  }, [targetStepNumber, reduceMotion, systemReveal]);

  // The preloaded cream scene stays invisible until Screen 3 starts handing over its world.
  const rootStyle = useAnimatedStyle(() => ({
    opacity: step === "motivation"
      ? entry === "handoff" ? easeOutCubic(seg(outcomeClock.value, outcomeTimeline.s3EnvOut)) : 0
      : 1,
  }));

  // Synchronize stepProgress with active step
  useEffect(() => {
    if (reduceMotion) {
      stepProgress.value = targetStepNumber;
      transitionClock.value = 1;
      return;
    }
    const current = Math.round(stepProgress.value);
    const target = targetStepNumber;
    if (Math.abs(current - target) > 0.05) {
      const isLargeJump = Math.abs(current - target) > 1;
      const duration =
        target === 8 ? 950 :
        target === 7 ? 700 :
        isLargeJump ? 400 : 450;
      transitionClock.value = 0;
      transitionClock.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never });
      stepProgress.value = withTiming(target, {
        duration,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      });
    }
  }, [targetStepNumber, reduceMotion, stepProgress, transitionClock]);

  // Pill label computation: smoothly extends from CATEGORY to CATEGORY · OUTCOME
  const outcomeLabel = (selectedOutcome ?? "").trim().toUpperCase();
  const fullPillText = outcomeLabel ? `${categoryLabel} · ${outcomeLabel}` : categoryLabel;

  // -------------------------------------------------------------
  // ANIMATED STYLES FOR PERSISTENT ELEMENTS
  // -------------------------------------------------------------

  // 1. Category Flower Hero
  const flowerHeroStyle = useAnimatedStyle(() => {
    // Arrival from Screen 3
    if (entry === "handoff" && originFrame && outcomeClock.value < outcomeTimeline.end) {
      const travel = easeOutCubic(seg(outcomeClock.value, outcomeTimeline.heroFlight));
      const settle = easeOutCubic(seg(outcomeClock.value, outcomeTimeline.heroSettle));
      return {
        left: originFrame.x + (outcomeHero.x - originFrame.x) * travel,
        top: originFrame.y + (outcomeHero.y - originFrame.y) * travel,
        width: originFrame.width + (outcomeHero.width - originFrame.width) * travel,
        height: originFrame.height + (outcomeHero.height - originFrame.height) * travel,
        opacity: 1,
        transform: [{ scale: 1.02 - 0.02 * settle }],
      };
    }

    const p = stepProgress.value;
    // Between Step 4, 5, 6: in outcomeHero position
    if (p <= 6) {
      return {
        left: outcomeHero.x,
        top: outcomeHero.y,
        width: outcomeHero.width,
        height: outcomeHero.height,
        opacity: 1,
        transform: [{ scale: 1 }],
      };
    }
    // Between Step 6 and 7: smoothly shrinks & drifts up to Screen 7 hero frame
    if (p <= 7) {
      const t = p - 6;
      const x = outcomeHero.x + (s7Layout.hero.x - outcomeHero.x) * t;
      const y = outcomeHero.y + (s7Layout.hero.y - outcomeHero.y) * t;
      const width = outcomeHero.width + (s7Layout.hero.width - outcomeHero.width) * t;
      const height = outcomeHero.height + (s7Layout.hero.height - outcomeHero.height) * t;
      return {
        left: x,
        top: y,
        width,
        height,
        opacity: 1,
        transform: [{ scale: 1 }],
      };
    }
    // Step 7 -> 8: Flower completely disappears
    const fadeOut = Math.max(0, 1 - (p - 7) * 4); // Fades to 0 by 7.25
    return {
      left: s7Layout.hero.x,
      top: s7Layout.hero.y,
      width: s7Layout.hero.width,
      height: s7Layout.hero.height,
      opacity: fadeOut,
      transform: [{ scale: 1 - 0.08 * (p - 7) }],
    };
  });

  // 2. Persistent Context Pill
  const pillStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    // Top position: beneath hero
    const baseTop = outcomeHero.y + outcomeHero.height + (compact ? 12 : 18);
    const targetTop = s7Layout.pillTop;
    const top = p <= 6 ? baseTop : baseTop + (targetTop - baseTop) * Math.min(1, p - 6);

    // Fade out entirely on Screen 8
    const opacity = (p >= 7 ? Math.max(0, 1 - (p - 7) * 3) : 1) *
      (entry === "handoff" ? easeOutCubic(seg(outcomeClock.value, outcomeTimeline.category)) : 1);

    return {
      top,
      opacity,
      transform: [{ translateY: 0 }],
    };
  });

  // 3. Question Blocks (4, 5, 6)
  const questionContentTop = outcomeHero.y + outcomeHero.height + (compact ? 12 : 18) + 28 + (compact ? 12 : 16);

  // Screen 4 Question & Choices
  const s4ContentStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    const intro = entry === "handoff" ? easeOutCubic(seg(outcomeClock.value, outcomeTimeline.question)) : 1;
    if (p <= 4) return { opacity: intro, transform: [{ translateY: 8 * (1 - intro) }] };
    const out = Math.min(1, Math.max(0, (p - 4) / 0.32));
    return {
      opacity: intro * (1 - out),
      transform: [{ translateY: -14 * out }],
    };
  });

  // Screen 5 Question & Choices
  const s5ContentStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 4.42 || p > 5.32) return { opacity: 0, transform: [{ translateY: p < 5 ? 14 : -14 }] };
    if (p <= 5) {
      const enter = Math.min(1, Math.max(0, (p - 4.42) / 0.48));
      return {
        opacity: enter,
        transform: [{ translateY: 14 * (1 - enter) }],
      };
    }
    const leave = Math.min(1, Math.max(0, (p - 5) / 0.32));
    return {
      opacity: 1 - leave,
      transform: [{ translateY: -14 * leave }],
    };
  });

  // Screen 6 Question & Choices
  const s6ContentStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 5.42 || p > 6.32) return { opacity: 0, transform: [{ translateY: p < 6 ? 14 : -14 }] };
    if (p <= 6) {
      const enter = Math.min(1, Math.max(0, (p - 5.42) / 0.48));
      return {
        opacity: enter,
        transform: [{ translateY: 14 * (1 - enter) }],
      };
    }
    const leave = Math.min(1, Math.max(0, (p - 6) / 0.32));
    return {
      opacity: 1 - leave,
      transform: [{ translateY: 14 * leave }],
    };
  });

  // 4. Screen 7 System Components (SEE / REINFORCE / MOVE)
  const s7TextContainerStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 6.42) return { opacity: 0, transform: [{ translateY: 16 }] };
    if (p <= 7) {
      const t = (p - 6.42) / 0.58;
      return {
        opacity: t,
        transform: [{ translateY: 16 * (1 - t) }],
      };
    }
    // Fades out on Screen 8
    const out = Math.min(1, (p - 7) * 3);
    return {
      opacity: 1 - out,
      transform: [{ translateY: -10 * out }],
    };
  });
  const seeLabelStyle = useAnimatedStyle(() => ({
    opacity: revealSegment(systemReveal.value, 0.17, 0.32),
    transform: [{ translateY: 6 * (1 - revealSegment(systemReveal.value, 0.17, 0.32)) }],
  }));
  const reinforceLabelStyle = useAnimatedStyle(() => ({
    opacity: revealSegment(systemReveal.value, 0.43, 0.58),
    transform: [{ translateY: 6 * (1 - revealSegment(systemReveal.value, 0.43, 0.58)) }],
  }));
  const moveLabelStyle = useAnimatedStyle(() => ({
    opacity: revealSegment(systemReveal.value, 0.7, 0.85),
    transform: [{ translateY: 6 * (1 - revealSegment(systemReveal.value, 0.7, 0.85)) }],
  }));
  const systemSupportStyle = useAnimatedStyle(() => ({ opacity: revealSegment(systemReveal.value, 0.82, 1) }));

  const s7SeeArtStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 6.34) return { opacity: 0, transform: [{ translateX: 24 }] };
    if (p <= 7) {
      const t = (p - 6.34) / 0.66;
      return {
        opacity: t * revealSegment(systemReveal.value, 0, 0.17),
        transform: [{ translateX: 20 * (1 - t) }, { scale: 0.94 + 0.06 * t }],
      };
    }
    // Fades and drifts outward to the left on Screen 8
    const out = Math.min(1, p - 7);
    return {
      opacity: Math.max(0, 1 - out * 2),
      transform: [{ translateX: -40 * out }],
    };
  });

  const s7MoveArtStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 6.34) return { opacity: 0, transform: [{ translateX: -24 }] };
    if (p <= 7) {
      const t = (p - 6.34) / 0.66;
      return {
        opacity: t * revealSegment(systemReveal.value, 0.54, 0.7),
        transform: [{ translateX: -20 * (1 - t) }, { scale: 0.94 + 0.06 * t }],
      };
    }
    // Fades and drifts outward to the right on Screen 8
    const out = Math.min(1, p - 7);
    return {
      opacity: Math.max(0, 1 - out * 2),
      transform: [{ translateX: 40 * out }],
    };
  });

  // 5. Center Anchor (The Hero of Screen 7 -> 8!)
  const centerAnchorStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 6.34) {
      return {
        opacity: 0,
        left: s7Layout.reinforce.art.x,
        top: s7Layout.reinforce.art.y,
        width: s7Layout.reinforce.art.width,
        height: s7Layout.reinforce.art.height,
        transform: [{ scale: 0.9 }],
      };
    }
    if (p <= 7) {
      const t = (p - 6.34) / 0.66;
      return {
        opacity: t * revealSegment(systemReveal.value, 0.28, 0.45),
        left: s7Layout.reinforce.art.x,
        top: s7Layout.reinforce.art.y,
        width: s7Layout.reinforce.art.width,
        height: s7Layout.reinforce.art.height,
        transform: [{ scale: 0.92 + 0.08 * t }],
      };
    }
    // Screen 7 -> 8: Interpolates smoothly from REINFORCE position to Screen 8 hero position!
    const t = Math.min(1, Math.max(0, p - 7));
    const smoothT = easeOutCubic(t);
    const x = s7Layout.reinforce.art.x + (s8Layout.anchor.x - s7Layout.reinforce.art.x) * smoothT;
    const y = s7Layout.reinforce.art.y + (s8Layout.anchor.y - s7Layout.reinforce.art.y) * smoothT;
    const width = s7Layout.reinforce.art.width + (s8Layout.anchor.width - s7Layout.reinforce.art.width) * smoothT;
    const height = s7Layout.reinforce.art.height + (s8Layout.anchor.height - s7Layout.reinforce.art.height) * smoothT;

    return {
      left: x,
      top: y,
      width,
      height,
      opacity: 1,
      transform: [{ scale: ctaPress.value }],
    };
  });

  // 6. Screen 8 Copy
  const s8ContentStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    if (p < 7.4) return { opacity: 0, transform: [{ translateY: 16 }] };
    const t = Math.min(1, (p - 7.4) / 0.6);
    return {
      opacity: t,
      transform: [{ translateY: 16 * (1 - t) }],
    };
  });
  const ctaStyle = useAnimatedStyle(() => {
    const p = stepProgress.value;
    const arrival = p <= 7.08 ? 1 : p < 7.38 ? 1 - (p - 7.08) / 0.3 : p < 7.72 ? 0 : revealSegment(p, 7.72, 8);
    return {
      opacity: (reduceMotion ? 1 : arrival) *
        (entry === "handoff" && p <= 4 ? easeOutCubic(seg(outcomeClock.value, outcomeTimeline.cta)) : 1),
      transform: [{ scale: ctaPress.value * (p > 7 && !reduceMotion ? 0.98 + 0.02 * arrival : 1) }],
    };
  });
  const continueLabelStyle = useAnimatedStyle(() => ({ opacity: 1 - revealSegment(stepProgress.value, 7.08, 7.38) }));
  const createLabelStyle = useAnimatedStyle(() => ({ opacity: revealSegment(stepProgress.value, 7.72, 8) }));

  // 7. Dynamic Bottom CTA
  const isS4Active = targetStepNumber === 4;
  const isS5Active = targetStepNumber === 5;
  const isS6Active = targetStepNumber === 6;
  const isS7Active = targetStepNumber === 7;
  const isS8Active = targetStepNumber === 8;

  const hasS4Selection = !!selectedOutcome;
  const hasS5Selection = !!selectedWhy;
  const hasS6Selection = !!selectedFriction;

  const isCurrentCtaEnabled =
    isS4Active ? hasS4Selection :
    isS5Active ? hasS5Selection :
    isS6Active ? hasS6Selection : true;

  const ctaLabel = isS8Active ? "Create My Anchor" : "Continue";
  const ctaTestId =
    isS4Active ? "outcome-continue" :
    isS5Active ? "meaning-continue" :
    isS6Active ? "friction-continue" :
    isS7Active ? "system-continue" : "handoff-create-anchor";

  const handleCtaPress = () => {
    if (!isCurrentCtaEnabled) return;
    v2Haptics.selection();
    if (isS4Active) onStepChange("meaning");
    else if (isS5Active) onStepChange("friction");
    else if (isS6Active) onStepChange("system");
    else if (isS7Active) onStepChange("handoff");
    else if (isS8Active) onCreateAnchor();
  };

  const labelDescGap = screen5LabelDescGap(s7Layout);
  const { PILL_H, RULE_H, SUPPORT_LINE } = SCREEN5_TYPE;

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      pointerEvents={step === "motivation" ? "none" : "auto"}
      testID={
        isS4Active ? "v2-onboarding-outcome" :
        isS5Active ? "v2-onboarding-meaning" :
        isS6Active ? "v2-onboarding-friction" :
        isS7Active ? "v2-onboarding-system" : "v2-onboarding-handoff"
      }
    >
      {/* Cream paper held within a soft ink environment. */}
      <View style={[StyleSheet.absoluteFillObject, styles.inkUnderlay]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.cream, creamSceneStyle]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFillObject, atmosphereStyle]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(11,24,39,0.30)", "rgba(11,24,39,0.02)", "rgba(11,24,39,0.02)", "rgba(11,24,39,0.34)"]}
          locations={[0, 0.22, 0.72, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={["rgba(11,24,39,0.20)", "rgba(11,24,39,0)", "rgba(11,24,39,0)", "rgba(11,24,39,0.20)"]}
          locations={[0, 0.2, 0.8, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* 2. Persistent Category Flower Illustration */}
      <Animated.View
        style={[styles.abs, flowerHeroStyle]}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Illustration representing ${categoryLabel.toLowerCase()}`}
      >
        <Image source={heroArt} resizeMode="contain" style={[styles.fill, styles.heroExposure]} accessibilityIgnoresInvertColors />
      </Animated.View>

      {/* 3. Persistent Context Pill (Screens 4, 5, 6, 7) */}
      <Animated.View
        style={[styles.abs, styles.pillWrap, pillStyle]}
        pointerEvents="none"
      >
        <View style={[styles.pill, { backgroundColor: `${accent}1F` }]}>
          <Text
            style={[styles.pillText, { color: accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.2}
            testID="system-context-pill"
          >
            {fullPillText}
          </Text>
        </View>
      </Animated.View>

      {/* -------------------------------------------------------- */}
      {/* 4. QUESTIONS ZONE: Screens 4, 5, 6                      */}
      {/* -------------------------------------------------------- */}

      {/* Screen 4: Outcome */}
      <Animated.View
        style={[styles.abs, styles.questionZone, { top: questionContentTop }, s4ContentStyle]}
        pointerEvents={isS4Active ? "auto" : "none"}
      >
        <Text style={styles.question} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          What would changing{"\n"}this give you?
        </Text>
        <Text style={styles.support} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
          Choose what feels closest.
        </Text>
        <View style={[styles.rows, { marginTop: compact ? 16 : 22, gap: rowGap }]} accessibilityRole="radiogroup">
          {outcomeOptions.map((opt, index) => (
            <ChoiceEntrance key={opt.id} phase={4} index={index} progress={stepProgress} transition={transitionClock} clock={outcomeClock} timeline={outcomeTimeline} entry={entry} reduceMotion={reduceMotion}>
            <ContinuousChoiceRow
              index={index}
              testID={`outcome-row-${index}`}
              label={opt.label}
              accent={accent}
              selected={selectedOutcome === opt.label}
              hasSelection={hasS4Selection}
              height={rowHeight}
              reduceMotion={reduceMotion}
              onPress={() => onSelectOutcome(opt.label)}
            />
            </ChoiceEntrance>
          ))}
        </View>
      </Animated.View>

      {/* Screen 5: Emotional Meaning */}
      <Animated.View
        style={[styles.abs, styles.questionZone, { top: questionContentTop }, s5ContentStyle]}
        pointerEvents={isS5Active ? "auto" : "none"}
      >
        <Text style={styles.question} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          Why does this matter{"\n"}to you now?
        </Text>
        <Text style={styles.support} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
          Choose what feels most true.
        </Text>
        <View style={[styles.rows, { marginTop: compact ? 16 : 22, gap: rowGap }]} accessibilityRole="radiogroup">
          {whyOptions.map((opt, index) => (
            <ChoiceEntrance key={opt.id} phase={5} index={index} progress={stepProgress} transition={transitionClock} clock={outcomeClock} timeline={outcomeTimeline} entry={entry} reduceMotion={reduceMotion}>
            <ContinuousChoiceRow
              index={index}
              testID={`meaning-row-${index}`}
              label={opt.label}
              accent={accent}
              selected={selectedWhy === opt.label}
              hasSelection={hasS5Selection}
              height={rowHeight}
              reduceMotion={reduceMotion}
              onPress={() => onSelectWhy(opt.label)}
            />
            </ChoiceEntrance>
          ))}
        </View>
      </Animated.View>

      {/* Screen 6: Friction */}
      <Animated.View
        style={[styles.abs, styles.questionZone, { top: questionContentTop }, s6ContentStyle]}
        pointerEvents={isS6Active ? "auto" : "none"}
      >
        <Text style={styles.question} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          What usually gets{"\n"}in the way?
        </Text>
        <Text style={styles.support} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
          Choose the one you recognize most.
        </Text>
        <View style={[styles.rows, { marginTop: compact ? 16 : 22, gap: rowGap }]} accessibilityRole="radiogroup">
          {frictionOptions.map((opt, index) => (
            <ChoiceEntrance key={opt.id} phase={6} index={index} progress={stepProgress} transition={transitionClock} clock={outcomeClock} timeline={outcomeTimeline} entry={entry} reduceMotion={reduceMotion}>
            <ContinuousChoiceRow
              index={index}
              testID={`friction-row-${index}`}
              label={opt.label}
              accent={accent}
              selected={selectedFriction === opt.label}
              hasSelection={hasS6Selection}
              height={rowHeight}
              reduceMotion={reduceMotion}
              onPress={() => onSelectFriction(opt.label)}
            />
            </ChoiceEntrance>
          ))}
        </View>
      </Animated.View>

      {/* -------------------------------------------------------- */}
      {/* 5. SCREEN 7: HOW ANCHOR WORKS                           */}
      {/* -------------------------------------------------------- */}
      <Animated.View
        style={[styles.abs, styles.copyColumn, { top: s7Layout.pillTop + 32 }, s7TextContainerStyle]}
        pointerEvents="none"
      >
        <View style={[{ height: RULE_H, width: 36, borderRadius: 1, backgroundColor: GOLD_RULE }]} />
        <Animated.Text
          style={[
            styles.s7Headline,
            { marginTop: s7Layout.gaps.ruleHeadline, fontSize: s7Layout.headline.fontSize, lineHeight: s7Layout.headline.lineHeight },
            s7InkStyle,
          ]}
          accessibilityRole="header"
          numberOfLines={2}
          maxFontSizeMultiplier={1.1}
        >
          Keep what matters{"\n"}in sight.
        </Animated.Text>
        <Animated.Text
          style={[styles.s7Support, { marginTop: s7Layout.gaps.headlineSupport, lineHeight: SUPPORT_LINE }, s7MutedStyle, systemSupportStyle]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          maxFontSizeMultiplier={1.1}
        >
          Anchor turns what matters to you into a system you can see, reinforce, and move on.
        </Animated.Text>
      </Animated.View>

      {/* Screen 7 Vignettes (SEE & MOVE) */}
      <Animated.View
        testID="system-art-see"
        pointerEvents="none"
        style={[styles.abs, { left: s7Layout.see.art.x, top: s7Layout.see.art.y, width: s7Layout.see.art.width, height: s7Layout.see.art.height }, s7SeeArtStyle]}
      >
        <OrganicVision source={seeArt} frame={s7Layout.see.art} />
      </Animated.View>

      <Animated.View
        testID="system-art-move"
        pointerEvents="none"
        style={[styles.abs, { left: s7Layout.move.art.x, top: s7Layout.move.art.y, width: s7Layout.move.art.width, height: s7Layout.move.art.height }, s7MoveArtStyle]}
      >
        <Image source={MOVE_ART} resizeMode="contain" style={styles.fill} accessibilityIgnoresInvertColors />
      </Animated.View>

      {/* Screen 7 Labels */}
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, styles.s7LabelLayer, s7TextContainerStyle]}
      >
        <Animated.View style={[styles.abs, styles.labelCol, { left: s7Layout.see.column.x, top: s7Layout.labelTop, width: s7Layout.see.column.width }, seeLabelStyle]}>
          <Animated.Text style={[styles.s7PieceLabel, s7LabelStyle]}>SEE</Animated.Text>
          <Animated.Text style={[styles.s7PieceDesc, { marginTop: labelDescGap }, s7MutedStyle, systemSupportStyle]}>Picture where you’re going.</Animated.Text>
        </Animated.View>
        <Animated.View style={[styles.abs, styles.labelCol, { left: s7Layout.reinforce.column.x, top: s7Layout.labelTop, width: s7Layout.reinforce.column.width }, reinforceLabelStyle]}>
          <Animated.Text style={[styles.s7PieceLabel, s7LabelStyle]}>REINFORCE</Animated.Text>
          <Animated.Text style={[styles.s7PieceDesc, { marginTop: labelDescGap }, s7MutedStyle, systemSupportStyle]}>Return to your Anchor to keep the intention present.</Animated.Text>
        </Animated.View>
        <Animated.View style={[styles.abs, styles.labelCol, { left: s7Layout.move.column.x, top: s7Layout.labelTop, width: s7Layout.move.column.width }, moveLabelStyle]}>
          <Animated.Text style={[styles.s7PieceLabel, s7LabelStyle]}>MOVE</Animated.Text>
          <Animated.Text style={[styles.s7PieceDesc, { marginTop: labelDescGap }, s7MutedStyle, systemSupportStyle]}>Turn that clarity into your next step.</Animated.Text>
        </Animated.View>
      </Animated.View>

      {/* -------------------------------------------------------- */}
      {/* 6. CENTER ANCHOR (REINFORCE -> HERO SCREEN 8)            */}
      {/* -------------------------------------------------------- */}
      <Animated.View
        testID="system-art-reinforce"
        pointerEvents="none"
        style={[styles.abs, centerAnchorStyle]}
      >
        <Image
          source={anchorArt}
          resizeMode="contain"
          style={styles.fill}
          accessibilityIgnoresInvertColors
          testID="handoff-hero-anchor"
        />
      </Animated.View>

      {/* -------------------------------------------------------- */}
      {/* 7. SCREEN 8 CONTENT (Culmination & Handoff)              */}
      {/* -------------------------------------------------------- */}
      <Animated.View
        style={[styles.abs, styles.s8Content, { top: s8Layout.contentTop }, s8ContentStyle]}
        pointerEvents={isS8Active ? "box-none" : "none"}
      >
        <Animated.Text style={[styles.s8Headline, s8InkStyle]} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          You know what matters.{"\n"}Now give it a shape.
        </Animated.Text>
        <Animated.Text style={[styles.s8Support, s8MutedStyle]} maxFontSizeMultiplier={1.15}>
          Create a visual Anchor for what you want to keep moving toward.
        </Animated.Text>
        <Animated.Text style={[styles.s8SmallTag, s8MutedStyle]}>Built around what matters to you.</Animated.Text>
      </Animated.View>

      {/* -------------------------------------------------------- */}
      {/* 8. DYNAMIC CONTINUOUS CTA                                */}
      {/* -------------------------------------------------------- */}
      <Animated.View
        style={[
          styles.abs,
          styles.ctaWrap,
          { bottom: Math.max(insets.bottom, 16) + 8 },
          ctaStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !isCurrentCtaEnabled }}
          disabled={!isCurrentCtaEnabled}
          onPress={handleCtaPress}
          onPressIn={() => { ctaPress.value = withTiming(0.98, { duration: 85, reduceMotion: ReduceMotion.Never }); }}
          onPressOut={() => { ctaPress.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }); }}
          testID={ctaTestId}
        >
          <View style={[styles.cta, !isCurrentCtaEnabled && styles.ctaDisabled]}>
            <View style={styles.ctaLabelStack}>
              <Animated.Text style={[styles.ctaText, !isCurrentCtaEnabled && styles.ctaTextDisabled, continueLabelStyle]}>Continue</Animated.Text>
              <Animated.Text style={[styles.ctaText, styles.ctaCreateLabel, createLabelStyle]}>Create My Anchor</Animated.Text>
            </View>
            <ArrowRight size={20} color={isCurrentCtaEnabled ? INK : "rgba(20,22,43,0.35)"} strokeWidth={2.2} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  inkUnderlay: { backgroundColor: "#0E151C" },
  cream: { backgroundColor: CREAM },
  heroExposure: { opacity: 0.94 },
  abs: { position: "absolute" },
  fill: { width: "100%", height: "100%" },
  pillWrap: { left: 0, right: 0, alignItems: "center" },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: "Inter-SemiBold", fontSize: 12, letterSpacing: 1.1 },
  questionZone: { left: 0, right: 0, paddingHorizontal: M.sidePad },
  question: {
    color: INK,
    fontFamily: "Inter-SemiBold",
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  support: {
    marginTop: 8,
    color: MUTED,
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  rows: { flexDirection: "column" },
  copyColumn: { left: 22, right: 22, alignItems: "center" },
  s7Headline: { color: INK, fontFamily: "Inter-SemiBold", letterSpacing: -0.6, textAlign: "center" },
  s7Support: { color: MUTED, fontFamily: "Inter-Regular", fontSize: 15, textAlign: "center" },
  s7LabelLayer: { ...StyleSheet.absoluteFillObject },
  labelCol: { alignItems: "center", paddingHorizontal: 2 },
  s7PieceLabel: { color: GOLD_TEXT, fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: SCREEN5_TYPE.LABEL_LINE, letterSpacing: 0.6 },
  s7PieceDesc: { color: MUTED, fontFamily: "Inter-Regular", fontSize: 13.5, lineHeight: SCREEN5_TYPE.DESC_LINE, textAlign: "center" },
  s8Content: { left: 22, right: 22, alignItems: "center" },
  s8Headline: {
    color: INK,
    fontFamily: "Inter-SemiBold",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  s8Support: {
    marginTop: 10,
    color: MUTED,
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  s8SmallTag: {
    marginTop: 8,
    color: MUTED,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  ctaWrap: { left: 22, right: 22 },
  cta: {
    height: M.ctaHeight,
    borderRadius: 28,
    backgroundColor: "#F4DDB8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 24,
    paddingRight: 22,
    shadowColor: "#8A6A33",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  ctaDisabled: {
    backgroundColor: "#EFE8DC",
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaText: { color: INK, fontFamily: "Inter-SemiBold", fontSize: 16 },
  ctaLabelStack: { flex: 1, justifyContent: "center" },
  ctaCreateLabel: { position: "absolute", left: 0 },
  ctaTextDisabled: { color: "rgba(20, 22, 43, 0.35)" },
});
