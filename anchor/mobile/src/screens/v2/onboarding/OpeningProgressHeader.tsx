/**
 * Navigation chrome shared by Screens 2–3. It stays mounted across every handoff rather than
 * arriving as a new header with each page.
 *
 * Its tone follows the surface beneath it: light over Screen 2's photography, ink over
 * the cream of the question, blending as the surface changes.
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";

const TONE = {
  backFill: ["rgba(20, 22, 32, 0.32)", "rgba(122, 98, 60, 0.10)"],
  backBorder: ["rgba(255, 255, 255, 0.34)", "rgba(20, 22, 43, 0.10)"],
} as const;
const INK = "#14162B";
function seg(t: number, window: readonly [number, number]): number {
  "worklet";
  return Math.min(1, Math.max(0, (t - window[0]) / (window[1] - window[0])));
}

type Props = {
  topInset: number;
  onBack: () => void;
  /** Developer skip callback. */
  onSkip?: () => void;
  /** Disables and recedes the chrome, e.g. while a sheet is open or during the handoff. */
  interactive: boolean;
  dimmed?: boolean;
  /** 0 over photography, 1 over cream. Omitted: always photography. */
  paper?: SharedValue<number>;
  /** The header leaves with the question: this clock and window fade the whole header away. */
  exit?: { clock: SharedValue<number>; window: readonly [number, number] };
};

type Tone = SharedValue<number> | undefined;
const toneOf = (paper: Tone) => {
  "worklet";
  return paper ? paper.value : 0;
};

export function OpeningProgressHeader({
  topInset,
  onBack,
  onSkip,
  interactive,
  dimmed = false,
  paper,
  exit,
}: Props) {
  const appear = useSharedValue(0);
  const dim = useSharedValue(dimmed ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [appear]);
  useEffect(() => {
    dim.value = withTiming(dimmed ? 1 : 0, { duration: 220, reduceMotion: ReduceMotion.Never });
  }, [dim, dimmed]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: appear.value * (1 - 0.6 * dim.value) * (exit ? 1 - seg(exit.clock.value, exit.window) : 1),
  }));
  const backStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.backFill]),
    borderColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.backBorder]),
  }));
  const lightIcon = useAnimatedStyle(() => ({ opacity: 1 - toneOf(paper) }));
  const inkIcon = useAnimatedStyle(() => ({ opacity: toneOf(paper) }));
  const skipTextTone = useAnimatedStyle(() => ({ color: toneOf(paper) ? INK : "#FFFFFF" }));
  return (
    <Animated.View
      style={[styles.root, { paddingTop: Math.max(topInset, 16) }, rootStyle]}
      pointerEvents={interactive ? "box-none" : "none"}
    >
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} hitSlop={10}>
          <Animated.View style={[styles.back, backStyle]}>
            <Animated.View style={[styles.icon, lightIcon]}>
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2} />
            </Animated.View>
            <Animated.View style={[styles.icon, inkIcon]}>
              <ChevronLeft size={20} color={INK} strokeWidth={2} />
            </Animated.View>
          </Animated.View>
        </Pressable>
        {__DEV__ && onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dev skip onboarding"
            onPress={onSkip}
            hitSlop={8}
            style={styles.devSkipButton}
          >
            <Animated.Text style={[styles.devSkipText, skipTextTone]}>Skip</Animated.Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0 },
  row: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 22, 32, 0.32)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.34)",
  },
  icon: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  devSkipButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    marginLeft: "auto",
  },
  devSkipText: {
    fontSize: 11,
    fontFamily: "Inter-SemiBold",
  },
});
