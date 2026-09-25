/**
 * Progress chrome shared by Screen 2 and Screen 3. It stays mounted across the handoff, so
 * the step changes in place — the next segment fills and "02" rolls up into "03" — instead
 * of a new header arriving with a new page.
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";

const TOTAL = 8;
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
};

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

  const rolls = from !== to;
  return (
    <Animated.View
      style={[styles.root, { paddingTop: topInset }, rootStyle]}
      pointerEvents={interactive ? "box-none" : "none"}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={10}
          style={styles.back}
        >
          <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2} />
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
            return (
              <View key={index} style={styles.segment}>
                {done ? <View style={styles.segmentFill} /> : null}
                {filling ? <Animated.View style={[styles.segmentFill, styles.fillOrigin, fill]} /> : null}
              </View>
            );
          })}
        </View>
        <View style={styles.counter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.digits}>
            {rolls ? (
              <>
                <Animated.Text style={[styles.counterText, styles.digitLayer, outgoing]}>{pad(from)}</Animated.Text>
                <Animated.Text style={[styles.counterText, incoming]}>{pad(to)}</Animated.Text>
              </>
            ) : (
              <Text style={styles.counterText}>{pad(from)}</Text>
            )}
          </View>
          <Text style={styles.counterText}> / {pad(TOTAL)}</Text>
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
