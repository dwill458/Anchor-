/**
 * Onboarding Screen 3 — "What matters most to you right now?"
 *
 * The first participation moment. It is mounted beneath Screen 2 before Continue is pressed
 * (so the runner plate and card art are decoded), then revealed by the shared handoff clock:
 * environment first, then the question, then the cards.
 *
 * The choice is onboarding context only. It never sets the first Anchor's category, which
 * is still detected from the intention the user writes later.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
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
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Check, ChevronRight, X } from "lucide-react-native";
import type { AnchorCategory } from "@/types";
import {
  MORE_FOCUS_AREAS,
  PRIMARY_FOCUS_AREAS,
  focusAreaLabel,
  type FocusAreaId,
} from "@/constants/v2/onboarding";
import { colors, getCategoryColor } from "@/theme/v2";
import { v2Haptics } from "@/hooks/v2";
import {
  CAMERA,
  HERO_BLEED_LEFT,
  SCREEN3_METRICS,
  Screen3Hero,
  solveScreen3Layout,
} from "./screen3Hero";
import { easeInOutCubic, easeOutCubic, handoffTimeline, seg, type Window } from "./openingHandoff";
import type { OutcomeHandoffTimeline, OutcomeOriginFrame } from "./outcomeHandoff";

const CARD_ART: Record<FocusAreaId, ImageSourcePropType> = {
  health: require("@/assets/onboarding/screen3/category-health.png"),
  career: require("@/assets/onboarding/screen3/category-career.png"),
  relationships: require("@/assets/onboarding/screen3/category-relationships.png"),
  something_else: require("@/assets/onboarding/screen3/category-something-else.png"),
};

const CREAM = colors.background;
const INK = "#14162B";
const NEUTRAL_ACCENT = "#3A3C4A";
const CARD_BORDER = "rgba(20, 22, 43, 0.07)";
const PRIMARY_IDS = new Set<string>(["health", "career", "relationships"]);

type Props = {
  clock: SharedValue<number>;
  /** "handoff": revealed beneath Screen 2. "direct": entered on its own (restore, back). */
  entry: "handoff" | "direct";
  /** False while Screen 2 still owns the screen. */
  active: boolean;
  reduceMotion: boolean;
  selected?: AnchorCategory;
  onSelect: (category: AnchorCategory) => void;
  /** Screen 3 → 4 handoff clock and timeline: drives this screen's own leaving animation. */
  outcomeClock: SharedValue<number>;
  outcomeTimeline: OutcomeHandoffTimeline;
  /** Called once the selected card's frame has been measured (or measurement failed). */
  onContinue: (originFrame: OutcomeOriginFrame | null) => void;
  onSheetChange?: (open: boolean) => void;
  onHeroReady?: () => void;
};

/** Fades a layer in over `inWindow`, then back out over `outWindow` as Screen 4 is entered. */
function revealThenHide(
  inT: number,
  inWindow: Window,
  outT: number,
  outWindow: Window,
  reduceMotion: boolean,
  rise = 12,
) {
  "worklet";
  const inP = easeOutCubic(seg(inT, inWindow));
  const outP = easeOutCubic(seg(outT, outWindow));
  return {
    opacity: inP * (1 - outP),
    transform: [{ translateY: (reduceMotion ? 6 : rise) * (1 - inP) - (reduceMotion ? 4 : 10) * outP }],
  };
}

function FocusCard({
  id,
  label,
  accent,
  index,
  selected,
  width,
  height,
  clock,
  reduceMotion,
  onPress,
  accessibilityHint,
  outcomeClock,
  outWindow,
  artHidden,
  cardRef,
}: {
  id: FocusAreaId;
  label: string;
  accent: string;
  index: number;
  selected: boolean;
  width: number;
  height: number;
  clock: SharedValue<number>;
  reduceMotion: boolean;
  onPress: () => void;
  accessibilityHint?: string;
  /** Screen 3 → 4 handoff clock and this card's own leaving window. */
  outcomeClock: SharedValue<number>;
  outWindow: Window;
  /** True the instant this card's artwork has handed off to the travelling clone. */
  artHidden: boolean;
  cardRef?: React.Ref<View>;
}) {
  const timeline = handoffTimeline(reduceMotion);
  const start = timeline.cardsStart + index * timeline.cardStagger;
  const window: Window = [start, start + timeline.cardDuration];
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [on, selected]);

  const enterStyle = useAnimatedStyle(() => {
    const p = easeOutCubic(seg(clock.value, window));
    const outP = easeOutCubic(seg(outcomeClock.value, outWindow));
    return {
      opacity: p * (1 - outP),
      transform: [
        { translateY: (reduceMotion ? 6 : 12) * (1 - p) - (reduceMotion ? 4 : 10) * outP },
        { scale: (reduceMotion ? 1 : 0.985 + 0.015 * p) * press.value },
      ],
    };
  });
  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [CARD_BORDER, accent]),
    borderWidth: 1 + 0.5 * on.value,
  }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: on.value,
    transform: [{ scale: 0.7 + 0.3 * on.value }],
  }));

  const handlePress = () => {
    if (!reduceMotion) {
      press.value = withSequence(
        withTiming(0.97, { duration: 90, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      );
    }
    onPress();
  };

  return (
    <Animated.View ref={cardRef} style={[{ width, height }, enterStyle]}>
      <Pressable
        testID={`focus-card-${id}`}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected, checked: selected }}
        onPress={handlePress}
        style={styles.cardPress}
      >
        <Animated.View style={[styles.card, frameStyle]}>
          <Animated.View pointerEvents="none" style={[styles.cardTint, { backgroundColor: `${accent}0D` }, tintStyle]} />
          <View style={styles.artBox} pointerEvents="none">
            {/* Hidden the instant the handoff starts: the artwork survives as the travelling
             * clone on Screen 4, never doubled here. */}
            <Image
              source={CARD_ART[id]}
              resizeMode="contain"
              style={[styles.art, artHidden && styles.artHidden]}
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
              {label}
            </Text>
            <View style={styles.chevron}>
              <ChevronRight size={15} color={INK} strokeWidth={2.2} />
            </View>
          </View>
          <Animated.View pointerEvents="none" style={[styles.badge, { backgroundColor: accent }, badgeStyle]}>
            <Check size={13} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function MoreSheet({
  open,
  selected,
  bottomInset,
  reduceMotion,
  onChoose,
  onClose,
}: {
  open: boolean;
  selected?: AnchorCategory;
  bottomInset: number;
  reduceMotion: boolean;
  onChoose: (category: AnchorCategory) => void;
  onClose: () => void;
}) {
  const shown = useSharedValue(0);
  // Progressive disclosure: the other areas don't exist on screen until asked for.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    shown.value = withTiming(open ? 1 : 0, {
      duration: open ? 300 : 220,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      reduceMotion: ReduceMotion.Never,
    });
  }, [open, shown]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const panelStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: shown.value }
      : { opacity: Math.min(1, shown.value * 3), transform: [{ translateY: (1 - shown.value) * 380 }] },
  );

  if (!mounted) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) + 12 }, panelStyle]}
        accessibilityViewIsModal
        importantForAccessibility={open ? "yes" : "no-hide-descendants"}
        testID="focus-more-sheet"
      >
        <View style={styles.grabber} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={8}
          style={styles.sheetClose}
          testID="focus-more-close"
        >
          <X size={18} color={INK} strokeWidth={2} />
        </Pressable>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Something else
        </Text>
        <Text style={styles.sheetSupport}>Choose what fits best.</Text>
        <View style={styles.sheetGrid}>
          {MORE_FOCUS_AREAS.map((area) => {
            const isSelected = selected === area.id;
            const tone = getCategoryColor(area.id);
            return (
              <Pressable
                key={area.id}
                testID={`focus-more-${area.id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected, checked: isSelected }}
                onPress={() => onChoose(area.id)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && { borderColor: `${tone}8C`, backgroundColor: `${tone}14` },
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={[styles.optionDot, { backgroundColor: tone }]} />
                <Text style={styles.optionLabel}>{area.label}</Text>
                {isSelected ? (
                  <View style={[styles.optionCheck, { backgroundColor: tone }]}>
                    <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export function V2OnboardingFocusArea({
  clock,
  entry,
  active,
  reduceMotion,
  selected,
  onSelect,
  outcomeClock,
  outcomeTimeline,
  onContinue,
  onSheetChange,
  onHeroReady,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = React.useMemo(() => solveScreen3Layout(W, H, insets), [H, W, insets]);
  const timeline = handoffTimeline(reduceMotion);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Set the instant Continue is pressed: hides that card's art, in favour of the clone that
   * is now travelling to Screen 4. */
  const [departingId, setDepartingId] = useState<FocusAreaId | null>(null);
  const leaving = useRef(false);
  const cardRefs = useRef<Partial<Record<FocusAreaId, View | null>>>({});
  const sheetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drift = useSharedValue(0);
  const ctaOn = useSharedValue(selected ? 1 : 0);

  // Idle camera: a slow drift once the entrance camera has settled. Never under Reduce Motion.
  useEffect(() => {
    if (!active || reduceMotion) return;
    drift.value = 0;
    drift.value = withDelay(
      timeline.s3Camera[1],
      withRepeat(
        withTiming(1, { duration: CAMERA.driftMs, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(drift);
  }, [active, drift, reduceMotion, timeline.s3Camera]);

  useEffect(() => {
    ctaOn.value = withTiming(selected ? 1 : 0, { duration: 240, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [ctaOn, selected]);

  useEffect(() => {
    if (!active) {
      // Back on Screen 2: reset so a later Continue plays the entrance again.
      leaving.current = false;
      setDepartingId(null);
      setSheetOpen(false);
    }
  }, [active]);

  useEffect(() => () => {
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
  }, []);

  useEffect(() => {
    onSheetChange?.(sheetOpen);
    if (!sheetOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSheetOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [onSheetChange, sheetOpen]);

  const cameraStyle = useAnimatedStyle(() => {
    const direct = entry === "direct" ? seg(clock.value, [0, 320]) : 1;
    // Phase B of the 3 → 4 handoff: the runner recedes underneath the departing card.
    const recede = easeInOutCubic(seg(outcomeClock.value, outcomeTimeline.s3EnvOut));
    if (reduceMotion) {
      return { opacity: direct * (1 - recede), transform: [{ translateX: 0 }, { scale: 1 }] };
    }
    const p = easeOutCubic(seg(clock.value, timeline.s3Camera));
    return {
      opacity: direct * (1 - recede),
      transform: [
        { translateX: CAMERA.enterX * (1 - p) + CAMERA.driftX * drift.value },
        { translateY: -16 * recede },
        {
          scale:
            CAMERA.enterScale -
            (CAMERA.enterScale - CAMERA.settledScale) * p +
            CAMERA.driftScale * drift.value +
            0.025 * recede,
        },
      ],
    };
  });

  const questionStyle = useAnimatedStyle(() =>
    revealThenHide(clock.value, timeline.question, outcomeClock.value, outcomeTimeline.s3UiOut, reduceMotion),
  );
  const supportStyle = useAnimatedStyle(() =>
    revealThenHide(clock.value, timeline.support, outcomeClock.value, outcomeTimeline.s3UiOut, reduceMotion),
  );
  const ctaEnterStyle = useAnimatedStyle(() =>
    revealThenHide(clock.value, timeline.cta, outcomeClock.value, outcomeTimeline.s3UiOut, reduceMotion, 10),
  );
  const ctaStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(ctaOn.value, [0, 1], ["#E9E1D3", "#F4DDB8"]),
    shadowOpacity: 0.16 * ctaOn.value,
  }));
  const ctaContentStyle = useAnimatedStyle(() => ({ opacity: 0.42 + 0.58 * ctaOn.value }));

  const select = (category: AnchorCategory) => {
    if (leaving.current) return;
    if (category !== selected) v2Haptics.selection();
    onSelect(category);
  };

  const chooseMore = (category: AnchorCategory) => {
    select(category);
    // Let the chosen row register, then the sheet closes on its own and Screen 3 shows the choice.
    if (sheetTimer.current) clearTimeout(sheetTimer.current);
    sheetTimer.current = setTimeout(() => setSheetOpen(false), reduceMotion ? 120 : 260);
  };

  const handleContinue = () => {
    if (!selected || leaving.current) return;
    leaving.current = true;
    v2Haptics.selection();
    const cardId: FocusAreaId = PRIMARY_IDS.has(selected) ? (selected as FocusAreaId) : "something_else";
    // Hide this card's artwork in the same tick Screen 4's clone starts, so there is never a
    // frame with both visible.
    setDepartingId(cardId);
    let settled = false;
    const proceed = (frame: OutcomeOriginFrame | null) => {
      if (settled) return;
      settled = true;
      onContinue(frame);
    };
    const node = cardRefs.current[cardId];
    if (node?.measureInWindow) {
      node.measureInWindow((x, y, width, height) => proceed({ x, y, width, height }));
      // A real device resolves this within a frame; this guards the rare host environment
      // where the callback never fires, so the handoff can never stall waiting on it.
      setTimeout(() => proceed(null), 80);
    } else {
      proceed(null);
    }
  };

  const onHeroReadyStable = useCallback(() => onHeroReady?.(), [onHeroReady]);

  const { hero, cardW, cardH, gaps } = layout;
  const moreSelected = selected && !PRIMARY_IDS.has(selected) ? selected : undefined;
  const m = SCREEN3_METRICS;
  const fadeTop = hero.shoeY - 4;

  return (
    <View style={styles.root} testID="v2-onboarding-focus" pointerEvents={active ? "auto" : "none"}>
      {/* 1. Runner plate under a restrained camera */}
      <Animated.View
        style={[styles.hero, { left: -HERO_BLEED_LEFT, height: hero.canvasHeight }, cameraStyle]}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel="A runner on a hillside trail at sunrise, heading toward a city."
      >
        <Screen3Hero layout={layout} width={W} onReady={onHeroReadyStable} />
      </Animated.View>

      {/* 2. Atmospheric dissolve into the cream surface, continuing the plate's own fog */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${CREAM}00`, `${CREAM}D9`, CREAM]}
        locations={[0, 0.4, 1]}
        style={[styles.abs, { left: 0, right: 0, top: fadeTop, height: 64 }]}
      />
      <View pointerEvents="none" style={[styles.abs, styles.cream, { top: fadeTop + 63 }]} />
      {/* Status bar legibility over the sky */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(10, 14, 26, 0.42)", "rgba(10, 14, 26, 0)"]}
        style={[styles.abs, { left: 0, right: 0, top: 0, height: insets.top + m.headerHeight + 8 }]}
      />

      {/* 3. Question, choices, CTA */}
      <View style={[styles.content, { top: layout.headlineTop, paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Animated.Text style={[styles.question, questionStyle]} accessibilityRole="header" maxFontSizeMultiplier={1.15}>
          What matters most{"\n"}to you right now?
        </Animated.Text>
        <Animated.View style={[styles.supportBlock, { marginTop: gaps.rule }, supportStyle]}>
          <View style={[styles.rule, { marginBottom: gaps.rule }]} />
          <Text style={styles.support} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>
            Choose what you want to move toward first.
          </Text>
        </Animated.View>

        <View style={[styles.grid, { marginTop: gaps.grid, gap: m.gridGap }]} accessibilityRole="radiogroup">
          {PRIMARY_FOCUS_AREAS.map((area, index) => {
            const isMore = area.id === "something_else";
            const isSelected = isMore ? Boolean(moreSelected) : selected === area.id;
            return (
              <FocusCard
                key={area.id}
                id={area.id}
                index={index}
                label={isMore ? focusAreaLabel(moreSelected) ?? area.label : area.label}
                accent={area.accent ?? NEUTRAL_ACCENT}
                selected={isSelected}
                width={cardW}
                height={cardH}
                clock={clock}
                reduceMotion={reduceMotion}
                accessibilityHint={isMore ? "Shows more areas to choose from" : undefined}
                outcomeClock={outcomeClock}
                outWindow={area.id === departingId ? outcomeTimeline.s3CardShell : outcomeTimeline.s3UiOut}
                artHidden={area.id === departingId}
                cardRef={(node) => {
                  cardRefs.current[area.id] = node;
                }}
                onPress={() => {
                  if (isMore) {
                    if (!leaving.current) setSheetOpen(true);
                  } else {
                    select(area.id as AnchorCategory);
                  }
                }}
              />
            );
          })}
        </View>

        <Animated.View style={[{ marginTop: gaps.cta }, ctaEnterStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !selected }}
            disabled={!selected}
            onPress={handleContinue}
            testID="focus-continue"
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

      <MoreSheet
        open={sheetOpen}
        selected={moreSelected}
        bottomInset={insets.bottom}
        reduceMotion={reduceMotion}
        onChoose={chooseMore}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: CREAM, overflow: "hidden" },
  abs: { position: "absolute" },
  cream: { left: 0, right: 0, bottom: 0, backgroundColor: CREAM },
  hero: { position: "absolute", top: 0 },
  content: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: SCREEN3_METRICS.sidePad, justifyContent: "flex-end" },
  question: {
    color: INK,
    fontFamily: "Inter-SemiBold",
    fontSize: 28,
    lineHeight: SCREEN3_METRICS.headlineLine,
    letterSpacing: -0.7,
    textAlign: "center",
  },
  supportBlock: { alignItems: "center" },
  rule: { width: 30, height: SCREEN3_METRICS.ruleHeight, borderRadius: 1, backgroundColor: "#D2AE6B" },
  support: {
    color: "#5E5A55",
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: SCREEN3_METRICS.supportLine,
    textAlign: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cardPress: { flex: 1 },
  card: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#FCFAF6",
    overflow: "hidden",
    shadowColor: "#5B4A30",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTint: { ...StyleSheet.absoluteFillObject },
  artBox: { position: "absolute", left: 8, right: 8, top: 3, bottom: 25, alignItems: "center", justifyContent: "center" },
  art: { width: "100%", height: "100%" },
  artHidden: { opacity: 0 },
  cardFooter: {
    position: "absolute",
    left: 12,
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: { flex: 1, color: INK, fontFamily: "Inter-Regular", fontSize: 16, letterSpacing: -0.2, marginRight: 6 },
  chevron: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    height: SCREEN3_METRICS.ctaHeight,
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
  scrim: { backgroundColor: "rgba(12, 14, 22, 0.38)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#D8D2C8", marginBottom: 14 },
  sheetClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
  },
  sheetTitle: { color: INK, fontFamily: "Inter-SemiBold", fontSize: 22, letterSpacing: -0.4, textAlign: "center", marginTop: 8 },
  sheetSupport: { color: "#6C6861", fontFamily: "Inter-Regular", fontSize: 15, textAlign: "center", marginTop: 6, marginBottom: 20 },
  optionCheck: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sheetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: {
    width: "48.5%",
    flexGrow: 1,
    flexBasis: "46%",
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FCFAF6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  optionPressed: { opacity: 0.7 },
  optionDot: { width: 8, height: 8, borderRadius: 4 },
  optionLabel: { flex: 1, color: INK, fontFamily: "Inter-Regular", fontSize: 15 },
});
