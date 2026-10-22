/**
 * Onboarding Screen 3 — "What matters most to you right now?"
 *
 * The only question onboarding asks. It is deliberately quiet: a cream field, the question in
 * the app's serif, and six rows, each marked by a line glyph drawn like the anchor sigil. The
 * cinema before it carries the picture; this screen carries the words.
 *
 * Choosing an area is the whole interaction: the tap sets the first Anchor's category and
 * starts the handoff into creation. The clock that drives the handoff is owned by the parent.
 * The screen is mounted beneath Screen 2 before Continue is pressed, then revealed by the
 * shared handoff clock: the question first, then the rows.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
import { ChevronRight } from "lucide-react-native";
import type { AnchorCategory } from "@/types";
import {
  FOCUS_AREAS,
  focusAreaById,
  focusAreaForCategory,
  focusHandoffLine,
  type FocusAreaId,
} from "@/constants/v2/focusAreas";
import { colors } from "@/theme/v2";
import { v2Haptics } from "@/hooks/v2";
import { FocusGlyph } from "./FocusGlyph";
import { FOCUS_METRICS, solveFocusLayout } from "./focusAreaLayout";
import { easeOutCubic, handoffTimeline, seg, type Window } from "./openingHandoff";
import type { CategoryHandoffTimeline } from "./categoryHandoff";

const CREAM = colors.background;
const INK = "#14162B";
const NEUTRAL_ACCENT = "#3A3C4A";
const HAIRLINE = "rgba(20, 22, 43, 0.1)";

type Props = {
  /** Screen 2 → 3 clock: reveals this screen. */
  clock: SharedValue<number>;
  /** False while Screen 2 still owns the screen. */
  active: boolean;
  reduceMotion: boolean;
  selected?: AnchorCategory;
  /** The tap. Sets the category and starts the handoff into creation. */
  onChoose: (category: AnchorCategory) => void;
  /** Question → creation clock and timeline: drives this screen's leaving and the closing line. */
  leaveClock: SharedValue<number>;
  leaveTimeline: CategoryHandoffTimeline;
  /** Everything on this screen is local, so it is ready as soon as it mounts. */
  onReady?: () => void;
};

/** Fades a layer in over `inWindow`, then back out over `outWindow` as creation is entered. */
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

function FocusRow({
  id,
  label,
  accent,
  index,
  selected,
  height,
  isLast,
  clock,
  reduceMotion,
  onPress,
  leaveClock,
  outWindow,
}: {
  id: FocusAreaId;
  label: string;
  accent: string;
  index: number;
  selected: boolean;
  height: number;
  isLast: boolean;
  clock: SharedValue<number>;
  reduceMotion: boolean;
  onPress: () => void;
  leaveClock: SharedValue<number>;
  outWindow: Window;
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
    const outP = easeOutCubic(seg(leaveClock.value, outWindow));
    return {
      opacity: p * (1 - outP),
      transform: [
        { translateY: (reduceMotion ? 6 : 12) * (1 - p) - (reduceMotion ? 4 : 10) * outP },
        { scale: press.value },
      ],
    };
  });
  const tintStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [`${accent}00`, `${accent}14`]),
  }));

  const handlePress = () => {
    if (!reduceMotion) {
      press.value = withSequence(
        withTiming(0.985, { duration: 80, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 140, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never }),
      );
    }
    onPress();
  };

  return (
    <Animated.View style={[{ height }, enterStyle]}>
      <Pressable
        testID={`focus-card-${id}`}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected, checked: selected }}
        onPress={handlePress}
        style={styles.rowPress}
      >
        <Animated.View style={[styles.row, !isLast && styles.rowDivider, tintStyle]}>
          <View style={styles.glyph} pointerEvents="none">
            <FocusGlyph id={id} color={INK} />
          </View>
          <Text style={styles.rowLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
          <ChevronRight size={17} color={INK} strokeWidth={1.6} style={styles.chevron} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export function V2OnboardingFocusArea({
  clock,
  active,
  reduceMotion,
  selected,
  onChoose,
  leaveClock,
  leaveTimeline,
  onReady,
}: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = useMemo(() => solveFocusLayout(W, H, insets), [H, W, insets]);
  const timeline = handoffTimeline(reduceMotion);
  const leaving = useRef(false);

  const selectedArea = focusAreaForCategory(selected);

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    if (!active) leaving.current = false;
  }, [active]);

  const questionStyle = useAnimatedStyle(() =>
    revealThenHide(clock.value, timeline.question, leaveClock.value, leaveTimeline.uiOut, reduceMotion),
  );
  const messageStyle = useAnimatedStyle(() => {
    const inP = easeOutCubic(seg(leaveClock.value, leaveTimeline.messageIn));
    const outP = easeOutCubic(seg(leaveClock.value, leaveTimeline.messageOut));
    return {
      opacity: inP * (1 - outP),
      transform: [{ translateY: reduceMotion ? 0 : 8 * (1 - inP) - 6 * outP }],
    };
  });
  // The chosen row is held a beat longer than the rest.
  const chosenOut: Window = [leaveTimeline.uiOut[0] + 120, leaveTimeline.uiOut[1] + 120];

  const choose = useCallback(
    (id: FocusAreaId) => {
      if (leaving.current) return;
      leaving.current = true;
      v2Haptics.selection();
      onChoose(focusAreaById(id).category);
    },
    [onChoose],
  );

  return (
    <View style={styles.root} testID="v2-onboarding-focus" pointerEvents={active ? "auto" : "none"}>
      <Animated.Text
        style={[styles.question, { top: layout.questionTop }, questionStyle]}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.15}
      >
        What matters most{"\n"}to you right now?
      </Animated.Text>

      <View style={[styles.list, { top: layout.listTop }]} accessibilityRole="radiogroup">
        {FOCUS_AREAS.map((area, index) => (
          <FocusRow
            key={area.id}
            id={area.id}
            index={index}
            label={area.label}
            accent={area.accent ?? NEUTRAL_ACCENT}
            selected={selectedArea?.id === area.id}
            height={layout.rowH}
            isLast={index === FOCUS_AREAS.length - 1}
            clock={clock}
            reduceMotion={reduceMotion}
            leaveClock={leaveClock}
            outWindow={selectedArea?.id === area.id ? chosenOut : leaveTimeline.uiOut}
            onPress={() => choose(area.id)}
          />
        ))}
      </View>

      {/* The line that follows the tap; the screen is otherwise empty cream by now. */}
      <Animated.View pointerEvents="none" style={[styles.message, messageStyle]} accessibilityLiveRegion="polite">
        {selectedArea ? (
          <>
            <Text style={styles.messageText} maxFontSizeMultiplier={1.2}>
              {focusHandoffLine(selectedArea)}
            </Text>
            <View style={styles.messageRule} />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: CREAM, overflow: "hidden" },
  question: {
    position: "absolute",
    left: FOCUS_METRICS.sidePad,
    right: FOCUS_METRICS.sidePad,
    color: INK,
    fontFamily: "EBGaramond-Medium",
    fontSize: 32,
    lineHeight: FOCUS_METRICS.questionLine,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  list: { position: "absolute", left: FOCUS_METRICS.sidePad, right: FOCUS_METRICS.sidePad },
  rowPress: { flex: 1 },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, borderRadius: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: HAIRLINE },
  glyph: { width: 40, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowLabel: { flex: 1, color: INK, fontFamily: "EBGaramond-Regular", fontSize: 23, letterSpacing: -0.2 },
  chevron: { opacity: 0.45 },
  message: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  messageText: {
    color: INK,
    fontFamily: "EBGaramond-Regular",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  messageRule: { width: 30, height: 2, borderRadius: 1, backgroundColor: "#D2AE6B", marginTop: 18 },
});
