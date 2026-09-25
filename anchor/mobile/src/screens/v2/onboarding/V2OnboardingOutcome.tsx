/**
 * Onboarding Screen 4 — "What would changing this give you?"
 *
 * The reflection screen: calmer and more personal than Screen 3. It is mounted beneath
 * Screen 3 well before Continue is pressed, then revealed by the shared handoff clock. The
 * illustration the user picked on Screen 3 is the transition object — it detaches from its
 * card and travels to the hero position here; nothing new is drawn in its place.
 *
 * The outcome choice is onboarding context only, stored alongside Screen 3's focus area. It
 * never becomes an Anchor, never starts AI generation, and never begins a trial.
 */
import React, { useEffect } from "react";
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
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";
import type { AnchorCategory } from "@/types";
import { PRIMARY_FOCUS_AREAS, focusAreaLabel, outcomeOptionsFor } from "@/constants/v2/onboarding";
import { colors, getCategoryColor } from "@/theme/v2";
import { v2Haptics } from "@/hooks/v2";
import { isCompactPhoneViewport, isShortPhoneViewport } from "@/utils/layout";
import {
  easeOutCubic,
  outcomeHandoffTimeline,
  seg,
  type OutcomeHandoffTimeline,
  type OutcomeOriginFrame,
  type Window,
} from "./outcomeHandoff";

const PRIMARY_ART: Partial<Record<AnchorCategory, ImageSourcePropType>> = {
  health: require("@/assets/onboarding/screen3/category-health.png"),
  career: require("@/assets/onboarding/screen3/category-career.png"),
  relationships: require("@/assets/onboarding/screen3/category-relationships.png"),
};
/** The eight categories reached through "Something else" have no dedicated illustration of
 * their own — the same treatment Screen 3 already gives them in its fourth card slot. */
const FALLBACK_ART: ImageSourcePropType = require("@/assets/onboarding/screen3/category-something-else.png");
const heroArtFor = (category: AnchorCategory): ImageSourcePropType => PRIMARY_ART[category] ?? FALLBACK_ART;

/** The three primary areas keep Screen 3's own accents; every other category falls back to
 * the shared category palette, exactly like Screen 3's "Something else" sheet does. */
const PRIMARY_ACCENTS = PRIMARY_FOCUS_AREAS.reduce<Partial<Record<AnchorCategory, string>>>((acc, area) => {
  if (area.accent && area.id !== "something_else") acc[area.id as AnchorCategory] = area.accent;
  return acc;
}, {});
const accentFor = (category: AnchorCategory): string => PRIMARY_ACCENTS[category] ?? getCategoryColor(category);

const CREAM = colors.background;
const INK = "#14162B";
const ROW_BORDER = "rgba(20, 22, 43, 0.07)";
const M = { sidePad: 22, headerHeight: 48, ctaHeight: 56 };

export type { OutcomeOriginFrame };

type Props = {
  clock: SharedValue<number>;
  /** "handoff": revealed beneath Screen 3. "direct": entered on its own (restore, back). */
  entry: "handoff" | "direct";
  /** False while Screen 3 still owns the screen. */
  active: boolean;
  reduceMotion: boolean;
  category: AnchorCategory;
  selected?: string;
  onSelect: (outcome: string) => void;
  onContinue: () => void;
  /** The selected Screen 3 card's measured window frame, or null if it couldn't be measured. */
  originFrame?: OutcomeOriginFrame | null;
};

function reveal(t: number, window: Window, reduceMotion: boolean, rise = 12) {
  "worklet";
  const p = easeOutCubic(seg(t, window));
  return { opacity: p, transform: [{ translateY: (reduceMotion ? 6 : rise) * (1 - p) }] };
}

function OutcomeChoiceRow({
  index,
  label,
  accent,
  selected,
  height,
  clock,
  timeline,
  reduceMotion,
  onPress,
}: {
  index: number;
  label: string;
  accent: string;
  selected: boolean;
  height: number;
  clock: SharedValue<number>;
  timeline: OutcomeHandoffTimeline;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const start = timeline.choicesStart + index * timeline.choiceStagger;
  const window: Window = [start, start + timeline.choiceDuration];
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [on, selected]);

  const enterStyle = useAnimatedStyle(() => {
    const p = easeOutCubic(seg(clock.value, window));
    return {
      opacity: p,
      transform: [
        { translateY: (reduceMotion ? 6 : 12) * (1 - p) },
        { scale: (reduceMotion ? 1 : 0.985 + 0.015 * p) * press.value },
      ],
    };
  });
  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [ROW_BORDER, accent]),
    borderWidth: 1 + 0.5 * on.value,
    backgroundColor: interpolateColor(on.value, [0, 1], ["#FCFAF6", `${accent}0F`]),
  }));
  const accentBarStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const radioRingStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], ["#C7C1B6", accent]),
  }));
  const radioFillStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: 0.4 + 0.6 * on.value }],
  }));

  const handlePress = () => {
    if (!reduceMotion) {
      press.value = withSequence(
        withTiming(0.985, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      );
    }
    onPress();
  };

  return (
    <Animated.View style={[{ height }, enterStyle]}>
      <Pressable
        testID={`outcome-row-${index}`}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected, checked: selected }}
        onPress={handlePress}
        style={styles.rowPress}
      >
        <Animated.View style={[styles.row, frameStyle]}>
          <Animated.View pointerEvents="none" style={[styles.rowAccent, { backgroundColor: accent }, accentBarStyle]} />
          <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
          <View style={styles.radioOuter}>
            <Animated.View style={[styles.radioRing, radioRingStyle]} />
            <Animated.View pointerEvents="none" style={[styles.radioFill, { backgroundColor: accent }, radioFillStyle]} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function V2OnboardingOutcome({
  clock,
  entry,
  active,
  reduceMotion,
  category,
  selected,
  onSelect,
  onContinue,
  originFrame,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const timeline = outcomeHandoffTimeline(reduceMotion);
  const compact = isCompactPhoneViewport(W, H) || isShortPhoneViewport(H);

  const options = outcomeOptionsFor(category);
  const accent = accentFor(category);
  const categoryLabel = (focusAreaLabel(category) ?? "Custom").toUpperCase();
  const art = heroArtFor(category);

  // Hero destination: the upper third of the content area, never more than a fixed cap so it
  // stays substantial without crowding the choices on a short device.
  const heroHeight = Math.min(H * (compact ? 0.26 : 0.32), compact ? 176 : 224);
  const heroWidth = Math.min(W - M.sidePad * 2, heroHeight * 1.05);
  const heroTop = insets.top + M.headerHeight + (compact ? 10 : 18);
  const heroLeft = (W - heroWidth) / 2;
  const rowHeight = compact ? 56 : 64;
  const rowGap = compact ? 8 : 10;

  const ctaOn = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    ctaOn.value = withTiming(selected ? 1 : 0, { duration: 240, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [ctaOn, selected]);

  const heroStyle = useAnimatedStyle(() => {
    const dest = { left: heroLeft, top: heroTop, width: heroWidth, height: heroHeight };

    if (reduceMotion) {
      // No lateral or scale travel under Reduce Motion: settle at the destination with a fade.
      const p = easeOutCubic(seg(clock.value, timeline.heroSettle));
      return { ...dest, opacity: p, transform: [{ scale: 0.99 + 0.01 * p }] };
    }
    if (entry === "handoff" && originFrame) {
      const travel = easeOutCubic(seg(clock.value, timeline.heroFlight));
      const settle = easeOutCubic(seg(clock.value, timeline.heroSettle));
      return {
        left: originFrame.x + (dest.left - originFrame.x) * travel,
        top: originFrame.y + (dest.top - originFrame.y) * travel,
        width: originFrame.width + (dest.width - originFrame.width) * travel,
        height: originFrame.height + (dest.height - originFrame.height) * travel,
        opacity: 1,
        // A slight overshoot settles down once the artwork has essentially arrived.
        transform: [{ scale: 1.02 - 0.02 * settle }],
      };
    }
    if (entry === "handoff") {
      // Handoff started but no measured frame to fly from: appear immediately, matching the
      // instant the original card's artwork was hidden.
      return { ...dest, opacity: 1, transform: [{ scale: 1 }] };
    }
    // Direct entry (restore, back): a quick local fade/scale, independent of the handoff's
    // mid-timeline settle window.
    const p = easeOutCubic(seg(clock.value, [0, 320]));
    return { ...dest, opacity: p, transform: [{ scale: 0.99 + 0.01 * p }] };
  });

  const categoryStyle = useAnimatedStyle(() => reveal(clock.value, timeline.category, reduceMotion, 8));
  const questionStyle = useAnimatedStyle(() => reveal(clock.value, timeline.question, reduceMotion));
  const supportStyle = useAnimatedStyle(() => reveal(clock.value, timeline.support, reduceMotion));
  const ctaEnterStyle = useAnimatedStyle(() => reveal(clock.value, timeline.cta, reduceMotion, 10));
  const ctaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ctaOn.value, [0, 1], ["#E9E1D3", "#F4DDB8"]),
    shadowOpacity: 0.16 * ctaOn.value,
  }));
  const ctaContentStyle = useAnimatedStyle(() => ({ opacity: 0.42 + 0.58 * ctaOn.value }));

  const select = (option: string) => {
    if (option !== selected) v2Haptics.selection();
    onSelect(option);
  };

  return (
    <View style={styles.root} testID="v2-onboarding-outcome" pointerEvents={active ? "auto" : "none"}>
      <Animated.View
        style={[styles.hero, heroStyle]}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Illustration representing ${categoryLabel.toLowerCase()}`}
      >
        <Image source={art} resizeMode="contain" style={styles.heroImage} accessibilityIgnoresInvertColors />
      </Animated.View>

      <View
        style={[
          styles.content,
          { paddingTop: heroTop + heroHeight + (compact ? 14 : 22), paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        <Animated.View style={[styles.categoryPill, { backgroundColor: `${accent}1F` }, categoryStyle]}>
          <Text style={[styles.categoryPillText, { color: accent }]}>{categoryLabel}</Text>
        </Animated.View>

        <Animated.Text style={[styles.question, questionStyle]} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          What would changing{"\n"}this give you?
        </Animated.Text>
        <Animated.Text style={[styles.support, supportStyle]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
          Choose what feels closest.
        </Animated.Text>

        <View style={[styles.rows, { marginTop: compact ? 18 : 24, gap: rowGap }]} accessibilityRole="radiogroup">
          {options.map((option, index) => (
            <OutcomeChoiceRow
              key={option}
              index={index}
              label={option}
              accent={accent}
              selected={selected === option}
              height={rowHeight}
              clock={clock}
              timeline={timeline}
              reduceMotion={reduceMotion}
              onPress={() => select(option)}
            />
          ))}
        </View>

        <Animated.View style={[{ marginTop: compact ? 16 : 22 }, ctaEnterStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !selected }}
            disabled={!selected}
            onPress={() => {
              if (!selected) return;
              onContinue();
            }}
            testID="outcome-continue"
          >
            <Animated.View style={[styles.cta, ctaStyle]}>
              <Animated.View style={[styles.ctaInner, ctaContentStyle]}>
                <Text style={styles.ctaText}>Continue</Text>
                <ArrowRight size={20} color={INK} strokeWidth={2.2} />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: CREAM, overflow: "hidden" },
  hero: { position: "absolute" },
  heroImage: { width: "100%", height: "100%" },
  content: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, paddingHorizontal: M.sidePad },
  categoryPill: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 14,
  },
  categoryPillText: { fontFamily: "Inter-SemiBold", fontSize: 12, letterSpacing: 1.2 },
  question: {
    color: INK,
    fontFamily: "Inter-SemiBold",
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  support: {
    marginTop: 8,
    color: "#5E5A55",
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  rows: { flexDirection: "column" },
  rowPress: { flex: 1 },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#FCFAF6",
    paddingHorizontal: 18,
    overflow: "hidden",
    shadowColor: "#5B4A30",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  rowAccent: { position: "absolute", left: 0, top: "22%", bottom: "22%", width: 3, borderRadius: 2 },
  rowLabel: { flex: 1, color: INK, fontFamily: "Inter-Regular", fontSize: 17, letterSpacing: -0.2, marginRight: 10 },
  radioOuter: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  radioRing: { position: "absolute", width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  radioFill: { width: 12, height: 12, borderRadius: 6 },
  cta: {
    height: M.ctaHeight,
    borderRadius: 28,
    shadowColor: "#8A6A33",
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 24,
    paddingRight: 22,
  },
  ctaText: { color: INK, fontFamily: "Inter-SemiBold", fontSize: 16 },
});
