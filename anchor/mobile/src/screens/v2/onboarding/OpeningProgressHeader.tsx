/**
 * Progress chrome shared by Screens 2–5. It stays mounted across every handoff, so the step
 * changes in place — the next segment fills and "02" rolls up into "03" — instead of a new
 * header arriving with a new page.
 *
 * Its tone follows the surface beneath it: light over the Screen 2/3 photography, ink over
 * the cream of Screens 4 and 5, blending as the surface changes.
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

const TOTAL = 8;

/** [over photography, over cream] */
const TONE = {
  backFill: ["rgba(20, 22, 32, 0.32)", "rgba(122, 98, 60, 0.10)"],
  backBorder: ["rgba(255, 255, 255, 0.34)", "rgba(20, 22, 43, 0.10)"],
  track: ["rgba(255, 255, 255, 0.34)", "rgba(20, 22, 43, 0.12)"],
  fill: ["#E4C48A", "#CFA862"],
  text: ["rgba(255, 255, 255, 0.86)", "rgba(20, 22, 43, 0.78)"],
} as const;
const INK = "#14162B";
const pad = (n: number) => String(n).padStart(2, "0");

function seg(t: number, window: readonly [number, number]): number {
  "worklet";
  return Math.min(1, Math.max(0, (t - window[0]) / (window[1] - window[0])));
}

type Props = {
  topInset: number;
  /** Step shown before the roll and after it. Equal values render a static counter. */
  from: number;
  to: number;
  /** The step the user is on, for assistive tech (the roll itself is decorative). */
  current: number;
  /** Clock (ms) and the window in which the roll happens. */
  clock: SharedValue<number>;
  window: readonly [number, number];
  reduceMotion: boolean;
  onBack: () => void;
  /** Disables and recedes the chrome, e.g. while a sheet is open or during the handoff. */
  interactive: boolean;
  dimmed?: boolean;
  /** 0 over photography, 1 over cream. Omitted: always photography. */
  paper?: SharedValue<number>;
};

type Tone = SharedValue<number> | undefined;
const toneOf = (paper: Tone) => {
  "worklet";
  return paper ? paper.value : 0;
};

function Segment({ done, filling, fill, paper }: { done: boolean; filling: boolean; fill: object; paper: Tone }) {
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.track]),
  }));
  const fillColor = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.fill]),
  }));
  return (
    <Animated.View style={[styles.segment, trackStyle]}>
      {done ? <Animated.View style={[styles.segmentFill, fillColor]} /> : null}
      {filling ? <Animated.View style={[styles.segmentFill, styles.fillOrigin, fillColor, fill]} /> : null}
    </Animated.View>
  );
}

export function OpeningProgressHeader({
  topInset,
  from,
  to,
  current,
  clock,
  window,
  reduceMotion,
  onBack,
  interactive,
  dimmed = false,
  paper,
}: Props) {
  const appear = useSharedValue(0);
  const dim = useSharedValue(dimmed ? 1 : 0);
  useEffect(() => {
    appear.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never });
  }, [appear]);
  useEffect(() => {
    dim.value = withTiming(dimmed ? 1 : 0, { duration: 220, reduceMotion: ReduceMotion.Never });
  }, [dim, dimmed]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: appear.value * (1 - 0.6 * dim.value) }));
  const outgoing = useAnimatedStyle(() => {
    const p = seg(clock.value, window);
    return { opacity: 1 - p, transform: [{ translateY: reduceMotion ? 0 : -8 * p }] };
  });
  const incoming = useAnimatedStyle(() => {
    const p = seg(clock.value, window);
    return { opacity: p, transform: [{ translateY: reduceMotion ? 0 : 8 * (1 - p) }] };
  });
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: seg(clock.value, window) }] }));
  const backStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.backFill]),
    borderColor: interpolateColor(toneOf(paper), [0, 1], [...TONE.backBorder]),
  }));
  const lightIcon = useAnimatedStyle(() => ({ opacity: 1 - toneOf(paper) }));
  const inkIcon = useAnimatedStyle(() => ({ opacity: toneOf(paper) }));
  const textTone = useAnimatedStyle(() => ({ color: interpolateColor(toneOf(paper), [0, 1], [...TONE.text]) }));

  const rolls = from !== to;
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
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${current} of ${TOTAL}`}
          accessibilityValue={{ min: 1, max: TOTAL, now: current }}
        >
          {Array.from({ length: TOTAL }, (_, index) => {
            const done = index < from;
            const filling = rolls && index === from;
            return <Segment key={index} done={done} filling={filling} fill={fill} paper={paper} />;
          })}
        </View>
        <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.digits}>
            {rolls ? (
              <>
                <Animated.Text style={[styles.counterText, styles.digitLayer, textTone, outgoing]}>{pad(from)}</Animated.Text>
                <Animated.Text style={[styles.counterText, textTone, incoming]}>{pad(to)}</Animated.Text>
              </>
            ) : (
              <Animated.Text style={[styles.counterText, textTone]}>{pad(from)}</Animated.Text>
            )}
          </View>
          <Animated.Text style={[styles.counterText, textTone]}> / {pad(TOTAL)}</Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, left: 0, right: 0 },
  row: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 16 },
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
  track: { flex: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10 },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.34)",
    overflow: "hidden",
  },
  segmentFill: { ...StyleSheet.absoluteFillObject, backgroundColor: "#E4C48A" },
  fillOrigin: { transformOrigin: "left" },
  counter: { flexDirection: "row", alignItems: "center", minWidth: 54, justifyContent: "flex-end" },
  digits: { overflow: "hidden", height: 18, justifyContent: "center" },
  digitLayer: { position: "absolute", right: 0 },
  counterText: {
    color: "rgba(255, 255, 255, 0.86)",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
});
