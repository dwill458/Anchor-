/**
 * Onboarding Screen 2 — "What does Anchor actually do?"
 *
 * One screen, one continuous shot: ESTABLISH → INTENTION → DISTILL → FORM → EXPLAIN.
 * The phases are internal animation states, not pages; the user stays on 2 / 8 throughout.
 *
 * Every layer reads a single time-based clock (ms) on the UI thread, so the sequence runs at
 * the same speed on iOS and Android and nothing re-renders per frame.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Allison_400Regular } from "@expo-google-fonts/allison";
import { ArrowRight } from "lucide-react-native";
import { Screen2Backdrop } from "./screen2Backdrop";
import { easeInOutCubic, easeOutCubic as handoffEaseOut, handoffTimeline, seg as handoffSeg } from "./openingHandoff";

const notebook = require("@/assets/onboarding/screen2/notebook.png");
const markInk = require("@/assets/onboarding/screen2/anchor-mark-ink.png");
const markDiamond = require("@/assets/onboarding/screen2/anchor-mark-diamond.png");

const FRAGMENT_ART = {
  paperA: { source: require("@/assets/onboarding/screen2/fragments/paper-a.png"), w: 300, h: 284 },
  paperB: { source: require("@/assets/onboarding/screen2/fragments/paper-b.png"), w: 179, h: 280 },
  shardA: { source: require("@/assets/onboarding/screen2/fragments/shard-a.png"), w: 61, h: 90 },
  shardB: { source: require("@/assets/onboarding/screen2/fragments/shard-b.png"), w: 62, h: 110 },
  shardC: { source: require("@/assets/onboarding/screen2/fragments/shard-c.png"), w: 50, h: 110 },
  shardD: { source: require("@/assets/onboarding/screen2/fragments/shard-d.png"), w: 61, h: 77 },
  inkA: { source: require("@/assets/onboarding/screen2/fragments/ink-a.png"), w: 121, h: 240 },
  inkB: { source: require("@/assets/onboarding/screen2/fragments/ink-b.png"), w: 142, h: 210 },
  inkC: { source: require("@/assets/onboarding/screen2/fragments/ink-c.png"), w: 88, h: 100 },
  inkD: { source: require("@/assets/onboarding/screen2/fragments/ink-d.png"), w: 105, h: 110 },
  inkE: { source: require("@/assets/onboarding/screen2/fragments/ink-e.png"), w: 145, h: 150 },
  goldA: { source: require("@/assets/onboarding/screen2/fragments/gold-a.png"), w: 118, h: 180 },
  goldB: { source: require("@/assets/onboarding/screen2/fragments/gold-b.png"), w: 58, h: 80 },
} as const;

const HANDWRITING_FONT = "Allison-Regular";
const HANDWRITING_FALLBACK = "EBGaramond-Italic";
const INK = "#1B1F2A";
const GOLD = "#E4C48A";

// --- Timeline (ms) -----------------------------------------------------------------------
const T = {
  notebookIn: [0, 820],
  line1: [860, 1340],
  line2: [1400, 1820],
  // 1820 → 2000: the pause once both lines are written.
  textLift: [2000, 2460],
  notebookDim: [2900, 3800],
  axis: [3000, 3420],
  topBar: [3120, 3520],
  diagonals: [3220, 3680],
  lowerBar: [3340, 3720],
  lowerV: [3400, 3800],
  ring: [3460, 3820],
  nodes: [3560, 3800],
  constructionOut: [3960, 4360],
  markIn: [3650, 4050],
  markScaleUp: [3650, 4000],
  markSettle: [4000, 4260],
  diamondIn: [3960, 4280],
  fragmentsOut: [3860, 4160],
  residualRest: [4000, 4700],
  gradientIn: [3300, 4500],
  headline: [4300, 4800],
  support: [4450, 4950],
  verbs: [4600, 5050],
  cta: [4750, 5200],
  end: 5300,
} as const;
const CTA_READY_MS = 4800;

// Reduce Motion: controlled crossfades only — notebook, brief hold, dissolve to the mark, copy.
const RM = {
  notebookIn: [0, 360],
  dissolve: [1300, 1850],
  gradientIn: [1450, 1950],
  copy: [1800, 2250],
  cta: [1900, 2350],
  end: 2400,
} as const;
const RM_CTA_READY_MS = 1950;


// --- Notebook page geometry (in notebook.png pixels, 1200 × 794) --------------------------
const NB_W = 1200;
const NB_H = 794;
/** Top-left page corner and the page's ruled-line direction (≈ -13.4°). */
const PAGE_ORIGIN = { x: 86, y: 168 };
const PAGE_ANGLE_DEG = -13.4;
const PAGE_E1 = { x: Math.cos((PAGE_ANGLE_DEG * Math.PI) / 180), y: Math.sin((PAGE_ANGLE_DEG * Math.PI) / 180) };
const PAGE_E2 = { x: -PAGE_E1.y, y: PAGE_E1.x };
/** Handwriting lines in page space: start x, baseline y, written length. Line 2 ends at the pen tip. */
const LINES = [
  { text: "A healthier me", x: 84, baseline: 178, length: 510 },
  { text: "A stronger me", x: 100, baseline: 282, length: 444 },
] as const;

// --- Brand mark geometry (anchor-mark-*.png pixels, 720 × 801) ----------------------------
const MARK_W = 720;
const MARK_H = 801;
const MARK = {
  ringTop: { x: 355, y: 28 },
  topLeft: { x: 78, y: 227 },
  topRight: { x: 628, y: 227 },
  center: { x: 355, y: 435 },
  lowerLeft: { x: 110, y: 639 },
  lowerRight: { x: 602, y: 640 },
  base: { x: 352, y: 795 },
} as const;
const CONSTRUCTION = [
  { d: "M355 128 L355 792", length: 664, window: T.axis },
  { d: "M78 227 L628 227", length: 550, window: T.topBar },
  { d: "M78 227 L602 640", length: 668, window: T.diagonals },
  { d: "M628 227 L110 639", length: 662, window: T.diagonals },
  { d: "M110 639 L602 640", length: 492, window: T.lowerBar },
  { d: "M110 639 L352 795 L602 640", length: 583, window: T.lowerV },
] as const;
const RING = { cx: 355, cy: 76, r: 50, length: 2 * Math.PI * 50 };

// --- Worklet helpers ----------------------------------------------------------------------
function seg(t: number, window: readonly [number, number]): number {
  "worklet";
  return Math.min(1, Math.max(0, (t - window[0]) / (window[1] - window[0])));
}
function easeOut(p: number): number {
  "worklet";
  return 1 - (1 - p) * (1 - p) * (1 - p);
}
function easeInOut(p: number): number {
  "worklet";
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
function bezier(a: number, c: number, b: number, p: number): number {
  "worklet";
  const q = 1 - p;
  return q * q * a + 2 * q * p * c + p * p * b;
}

/** Explanatory UI: rises 8pt into place, then steps back first when leaving (Phase A). */
function uiReveal(
  t: number,
  handoff: number,
  window: readonly [number, number],
  leaveWindow: readonly [number, number],
  reduceMotion: boolean,
) {
  "worklet";
  const p = easeOut(seg(t, window));
  const leave = easeOut(handoffSeg(handoff, leaveWindow));
  return {
    opacity: p * (1 - leave),
    transform: [{ translateY: (reduceMotion ? 0 : 8 * (1 - p)) - (reduceMotion ? 0 : 10 * leave) }],
  };
}

type Point = { x: number; y: number };
type FragmentSpec = {
  key: keyof typeof FRAGMENT_ART;
  width: number;
  start: Point;
  ctrl: Point;
  end: Point;
  /** Nearly-static resting place after the mark resolves; omitted pieces fade out. */
  rest?: Point;
  flight: readonly [number, number];
  fadeIn: readonly [number, number];
  fadeOut: readonly [number, number];
  rotate: readonly [number, number];
  scale: readonly [number, number];
  /** Extra scale at mid-flight, suggesting the piece lifts toward the viewer. */
  depth: number;
};

function Fragment({
  spec,
  clock,
  idle,
}: {
  spec: FragmentSpec;
  clock: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const art = FRAGMENT_ART[spec.key];
  const height = (spec.width * art.h) / art.w;
  const style = useAnimatedStyle(() => {
    const t = clock.value;
    const p = easeInOut(seg(t, spec.flight));
    let x = bezier(spec.start.x, spec.ctrl.x, spec.end.x, p);
    let y = bezier(spec.start.y, spec.ctrl.y, spec.end.y, p);
    let opacity = seg(t, spec.fadeIn);
    if (spec.rest) {
      const q = easeOut(seg(t, T.residualRest));
      x += (spec.rest.x - spec.end.x) * q;
      y += (spec.rest.y - spec.end.y) * q + (idle.value - 0.5) * 3 * q;
      opacity *= 1 - 0.5 * q;
    } else {
      opacity *= 1 - seg(t, spec.fadeOut);
    }
    const rotate = spec.rotate[0] + (spec.rotate[1] - spec.rotate[0]) * p;
    const scale = spec.scale[0] + (spec.scale[1] - spec.scale[0]) * p + spec.depth * Math.sin(p * Math.PI);
    return {
      opacity,
      transform: [
        { translateX: x - spec.width / 2 },
        { translateY: y - height / 2 },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });
  return (
    <Animated.View style={[styles.fragment, { width: spec.width, height }, style]}>
      <Image source={art.source as ImageSourcePropType} style={styles.fill} resizeMode="contain" />
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ConstructionLine({
  d,
  length,
  window,
  clock,
  strokeWidth,
}: {
  d: string;
  length: number;
  window: readonly [number, number];
  clock: SharedValue<number>;
  strokeWidth: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const p = easeInOut(seg(clock.value, window));
    // Untraced, a round cap would still paint a dot at the path's start.
    return { strokeDashoffset: length * (1 - p), strokeOpacity: p > 0 ? 0.82 : 0 };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={INK}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

function ConstructionRing({ clock, strokeWidth }: { clock: SharedValue<number>; strokeWidth: number }) {
  const animatedProps = useAnimatedProps(() => {
    const p = easeInOut(seg(clock.value, T.ring));
    return { strokeDashoffset: RING.length * (1 - p), strokeOpacity: p > 0 ? 0.82 : 0 };
  });
  return (
    <AnimatedCircle
      cx={RING.cx}
      cy={RING.cy}
      r={RING.r}
      stroke={INK}
      strokeWidth={strokeWidth}
      fill="none"
      strokeDasharray={[RING.length, RING.length]}
      rotation={90}
      origin={`${RING.cx}, ${RING.cy}`}
      animatedProps={animatedProps}
    />
  );
}

function ConstructionNode({ point, gold, clock }: { point: Point; gold?: boolean; clock: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({ opacity: seg(clock.value, T.nodes) }));
  return (
    <AnimatedCircle
      cx={point.x}
      cy={point.y}
      r={gold ? 7 : 5.5}
      fill={gold ? GOLD : INK}
      animatedProps={animatedProps}
    />
  );
}

type Props = {
  /** Optional in-screen header; the journey normally keeps progress in a persistent header. */
  header?: React.ReactNode;
  reduceMotion: boolean;
  /**
   * Shared Screen 2 → 3 handoff clock (ms from Continue). Screen 2 only reads it: its
   * explanatory UI, example Anchor and world each leave on their own window.
   */
  handoff: SharedValue<number>;
  /** Screen 3 is mounted and decoded beneath; Continue waits for it so nothing pops in. */
  nextReady?: boolean;
  /** Called the moment Continue is pressed; the owner starts the handoff clock. */
  onContinue: () => void;
};

export function V2OnboardingExplain({ header, reduceMotion, handoff, nextReady = true, onContinue }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ [HANDWRITING_FONT]: Allison_400Regular });

  const clock = useSharedValue(0);
  const idle = useSharedValue(0.5);
  const lineWidths = [useSharedValue(0), useSharedValue(0)];
  const [ctaReady, setCtaReady] = useState(false);
  const leaving = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Copy block is laid out from the bottom; the hero area takes whatever remains above it.
  const bottomPad = Math.max(insets.bottom, 16) + 12;
  const [copyTop, setCopyTop] = useState(() => H - bottomPad - 300);
  const onCopyLayout = (event: LayoutChangeEvent) => {
    const top = Math.round(event.nativeEvent.layout.y);
    if (Math.abs(top - copyTop) > 1) setCopyTop(top);
  };

  const layout = useMemo(() => {
    const heroTop = insets.top + 54 + 8;
    const heroBottom = Math.max(heroTop + 160, copyTop - 14);
    const heroH = heroBottom - heroTop;
    const markH = Math.min(heroH * 0.9, W * 0.66 * (MARK_H / MARK_W), 330);
    const markW = (markH * MARK_W) / MARK_H;
    const mark = {
      left: (W - markW) / 2,
      top: heroTop + (heroH - markH) / 2,
      width: markW,
      height: markH,
    };

    // The notebook sits in the lower foreground; capped so wide Android screens don't inflate it.
    const nbW = Math.min(W * 1.08, H * 0.56, 470);
    const nbH = (nbW * NB_H) / NB_W;
    const nb = { left: (W - nbW) / 2, top: H * 0.5, width: nbW, height: nbH };
    const k = nbW / NB_W;
    const fontSize = nbW * 0.1;

    const pagePoint = (x: number, y: number): Point => ({
      x: nb.left + (PAGE_ORIGIN.x + x * PAGE_E1.x + y * PAGE_E2.x) * k,
      y: nb.top + (PAGE_ORIGIN.y + x * PAGE_E1.y + y * PAGE_E2.y) * k,
    });
    const onLine = (line: 0 | 1, frac: number): Point =>
      pagePoint(LINES[line].x + LINES[line].length * frac, LINES[line].baseline - fontSize * 0.35 / k);
    const onMark = (p: Point): Point => ({
      x: mark.left + (p.x / MARK_W) * mark.width,
      y: mark.top + (p.y / MARK_H) * mark.height,
    });
    const lerp = (a: Point, b: Point, f: number, dx = 0, dy = 0): Point => ({
      x: a.x + (b.x - a.x) * f + dx,
      y: a.y + (b.y - a.y) * f + dy,
    });
    const textCenter = lerp(onLine(0, 0.5), onLine(1, 0.5), 0.5);
    const heroCenter = onMark(MARK.center);

    const fragments: FragmentSpec[] = [
      // Paper: the written page lifting away. Born on the lines, gone before the mark forms.
      { key: "paperA", width: W * 0.27, start: onLine(0, 0.45), ctrl: lerp(onLine(0, 0.45), heroCenter, 0.55, -W * 0.18), end: onMark({ x: 230, y: 520 }), flight: [2000, 3350], fadeIn: [2000, 2180], fadeOut: [2850, 3300], rotate: [-14, -52], scale: [0.7, 0.32], depth: 0.35 },
      { key: "paperB", width: W * 0.21, start: onLine(1, 0.55), ctrl: lerp(onLine(1, 0.55), heroCenter, 0.6, W * 0.2), end: onMark({ x: 500, y: 380 }), flight: [2060, 3400], fadeIn: [2060, 2240], fadeOut: [2900, 3350], rotate: [16, 64], scale: [0.7, 0.32], depth: 0.35 },
      { key: "shardA", width: W * 0.06, start: onLine(0, 0.15), ctrl: lerp(onLine(0, 0.15), heroCenter, 0.4, -W * 0.22), end: onMark({ x: 150, y: 300 }), flight: [2020, 3200], fadeIn: [2020, 2160], fadeOut: [2700, 3150], rotate: [0, -120], scale: [0.8, 0.6], depth: 0.3 },
      { key: "shardB", width: W * 0.065, start: onLine(0, 0.82), ctrl: lerp(onLine(0, 0.82), heroCenter, 0.5, W * 0.2), end: onMark({ x: 600, y: 300 }), flight: [2080, 3250], fadeIn: [2080, 2220], fadeOut: [2750, 3200], rotate: [20, 140], scale: [0.8, 0.6], depth: 0.3 },
      { key: "shardC", width: W * 0.055, start: onLine(1, 0.2), ctrl: lerp(onLine(1, 0.2), heroCenter, 0.3, -W * 0.26), end: onMark({ x: 120, y: 560 }), flight: [2140, 3300], fadeIn: [2140, 2280], fadeOut: [2800, 3250], rotate: [-30, -160], scale: [0.8, 0.6], depth: 0.25 },
      { key: "shardD", width: W * 0.055, start: onLine(1, 0.9), ctrl: lerp(onLine(1, 0.9), heroCenter, 0.35, W * 0.24), end: onMark({ x: 620, y: 560 }), flight: [2200, 3350], fadeIn: [2200, 2340], fadeOut: [2850, 3300], rotate: [10, 110], scale: [0.8, 0.6], depth: 0.25 },
      // Ink + gold: geometry emerging from the rising paper, each settling on a vertex of the mark.
      { key: "inkA", width: W * 0.1, start: lerp(textCenter, heroCenter, 0.35, -W * 0.14), ctrl: lerp(textCenter, heroCenter, 0.7, -W * 0.3), end: onMark(MARK.topLeft), flight: [2380, 3620], fadeIn: [2380, 2640], fadeOut: T.fragmentsOut, rotate: [-40, -8], scale: [0.7, 0.62], depth: 0.2 },
      { key: "inkB", width: W * 0.095, start: lerp(textCenter, heroCenter, 0.38, W * 0.16), ctrl: lerp(textCenter, heroCenter, 0.72, W * 0.32), end: onMark(MARK.topRight), rest: onMark({ x: MARK.topRight.x + 90, y: MARK.topRight.y - 40 }), flight: [2420, 3660], fadeIn: [2420, 2680], fadeOut: T.fragmentsOut, rotate: [34, 12], scale: [0.7, 0.55], depth: 0.2 },
      { key: "inkC", width: W * 0.055, start: lerp(textCenter, heroCenter, 0.28, -W * 0.08), ctrl: lerp(textCenter, heroCenter, 0.45, -W * 0.34), end: onMark(MARK.lowerLeft), rest: onMark({ x: MARK.lowerLeft.x - 90, y: MARK.lowerLeft.y + 30 }), flight: [2480, 3700], fadeIn: [2480, 2740], fadeOut: T.fragmentsOut, rotate: [-60, -20], scale: [0.8, 0.75], depth: 0.15 },
      { key: "inkD", width: W * 0.06, start: lerp(textCenter, heroCenter, 0.3, W * 0.1), ctrl: lerp(textCenter, heroCenter, 0.5, W * 0.36), end: onMark(MARK.lowerRight), flight: [2520, 3720], fadeIn: [2520, 2780], fadeOut: T.fragmentsOut, rotate: [50, 16], scale: [0.8, 0.7], depth: 0.15 },
      { key: "inkE", width: W * 0.07, start: lerp(textCenter, heroCenter, 0.25), ctrl: lerp(textCenter, heroCenter, 0.35, -W * 0.06), end: onMark(MARK.base), flight: [2560, 3760], fadeIn: [2560, 2820], fadeOut: T.fragmentsOut, rotate: [-20, 30], scale: [0.8, 0.6], depth: 0.15 },
      { key: "goldA", width: W * 0.06, start: lerp(textCenter, heroCenter, 0.42, W * 0.04), ctrl: lerp(textCenter, heroCenter, 0.8, W * 0.12), end: heroCenter, flight: [2600, 3880], fadeIn: [2600, 2860], fadeOut: [3960, 4200], rotate: [-30, 0], scale: [0.8, 0.55], depth: 0.2 },
      { key: "goldB", width: W * 0.036, start: lerp(textCenter, heroCenter, 0.45, -W * 0.02), ctrl: lerp(textCenter, heroCenter, 0.95, -W * 0.16), end: onMark(MARK.ringTop), rest: onMark({ x: MARK.ringTop.x + 110, y: MARK.ringTop.y + 20 }), flight: [2450, 3700], fadeIn: [2450, 2710], fadeOut: T.fragmentsOut, rotate: [20, -10], scale: [0.9, 0.8], depth: 0.15 },
    ];

    return { mark, nb, k, fontSize, fragments };
  }, [H, W, copyTop, insets.top]);

  // Start the single clock. Reduce Motion owns its own crossfade timeline, so the system
  // reduce-motion shortcut in Reanimated (which would jump straight to the end) is bypassed.
  useEffect(() => {
    const end = reduceMotion ? RM.end : T.end;
    clock.value = 0;
    clock.value = withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    if (!reduceMotion) {
      idle.value = withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        -1,
        true,
      );
    }
    // Enabling the CTA is the only JS-side event; animation itself never touches JS.
    const ready = setTimeout(() => setCtaReady(true), reduceMotion ? RM_CTA_READY_MS : CTA_READY_MS);
    timers.current.push(ready);
    return () => {
      cancelAnimation(clock);
      cancelAnimation(idle);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [clock, idle, reduceMotion]);

  const canContinue = ctaReady && nextReady;
  const handleContinue = () => {
    if (!canContinue || leaving.current) return;
    leaving.current = true;
    onContinue();
  };
  const H2 = handoffTimeline(reduceMotion);

  // --- Animated styles ------------------------------------------------------------------
  const plateStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const drift = seg(clock.value, [0, T.end]);
    // The camera keeps travelling left into the handoff: 1.02 → 1.04, a little further left.
    const onward = handoffEaseOut(handoffSeg(handoff.value, H2.s2Drift));
    return {
      transform: [
        { translateX: -4 * drift + (idle.value - 0.5) * 1.5 - 24 * onward },
        { scale: 1 + 0.02 * drift + 0.02 * onward },
      ],
    };
  });

  // Screen 2's world (plate, grade, notebook, fragments, readability gradient) thins over
  // Screen 3's runner, which is already moving beneath it.
  const worldStyle = useAnimatedStyle(() => ({
    opacity: 1 - easeInOutCubic(handoffSeg(handoff.value, H2.s2World)),
  }));
  const worldTopStyle = useAnimatedStyle(() => ({
    opacity: 1 - easeInOutCubic(handoffSeg(handoff.value, H2.s2Ground)),
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: seg(clock.value, [0, 400]) * (1 - handoffSeg(handoff.value, H2.s2Ui)),
  }));

  const notebookStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (reduceMotion) {
      return { opacity: seg(t, RM.notebookIn) };
    }
    const enter = easeOut(seg(t, T.notebookIn));
    const dim = easeInOut(seg(t, T.notebookDim));
    return {
      opacity: enter,
      transform: [
        { translateY: 20 * (1 - enter) + 14 * dim },
        { scale: 0.97 + 0.03 * enter },
      ],
    };
  });

  // Dimming by opacity would reveal the plate's own desk beneath, so the notebook darkens
  // under a silhouette of itself and settles into the readability gradient.
  const notebookShadeStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * easeInOut(seg(clock.value, reduceMotion ? RM.dissolve : T.notebookDim)),
  }));

  const writingStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 - seg(clock.value, RM.dissolve) };
    const lift = easeInOut(seg(clock.value, T.textLift));
    return { opacity: 1 - lift, transform: [{ translateY: -8 * lift }] };
  });

  const line1Style = useAnimatedStyle(() => {
    const full = lineWidths[0].value || layout.fontSize * 4.8;
    const p = reduceMotion ? 1 : easeInOut(seg(clock.value, T.line1));
    return { width: full * p };
  });
  const line2Style = useAnimatedStyle(() => {
    const full = lineWidths[1].value || layout.fontSize * 4.6;
    const p = reduceMotion ? 1 : easeInOut(seg(clock.value, T.line2));
    return { width: full * p };
  });

  const constructionStyle = useAnimatedStyle(() => ({
    opacity: 1 - seg(clock.value, T.constructionOut),
  }));

  // Anchor handoff: the example mark survives into the move — shrinks to .8, lifts ~20pt and
  // fades — bridging understanding into personalization. It is gone before the question.
  const handoffMarkStyle = useAnimatedStyle(() => {
    const p = handoffSeg(handoff.value, H2.anchor);
    if (reduceMotion) return { opacity: 1 - p };
    return {
      opacity: 1 - easeInOutCubic(p),
      transform: [{ translateY: -20 * handoffEaseOut(p) }, { scale: 1 - 0.2 * handoffEaseOut(p) }],
    };
  });

  const markStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (reduceMotion) {
      return { opacity: seg(t, RM.dissolve) };
    }
    const up = easeOut(seg(t, T.markScaleUp));
    const settle = easeInOut(seg(t, T.markSettle));
    return {
      opacity: easeOut(seg(t, T.markIn)),
      transform: [{ scale: 0.9 + 0.12 * up - 0.02 * settle }],
    };
  });

  const diamondStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (reduceMotion) {
      return { opacity: seg(t, RM.dissolve) };
    }
    const p = easeOut(seg(t, T.diamondIn));
    return { opacity: p, transform: [{ scale: 0.72 + 0.28 * p }] };
  });

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: seg(clock.value, reduceMotion ? RM.gradientIn : T.gradientIn),
  }));

  // Shared values are read directly in each style so every platform tracks them as inputs.
  const headlineStyle = useAnimatedStyle(() =>
    uiReveal(clock.value, handoff.value, reduceMotion ? RM.copy : T.headline, H2.s2Ui, reduceMotion),
  );
  const supportStyle = useAnimatedStyle(() =>
    uiReveal(clock.value, handoff.value, reduceMotion ? RM.copy : T.support, H2.s2Ui, reduceMotion),
  );
  const verbsStyle = useAnimatedStyle(() =>
    uiReveal(clock.value, handoff.value, reduceMotion ? RM.copy : T.verbs, H2.s2Ui, reduceMotion),
  );
  const ctaStyle = useAnimatedStyle(() =>
    uiReveal(clock.value, handoff.value, reduceMotion ? RM.cta : T.cta, H2.s2Ui, reduceMotion),
  );

  const { mark, nb, k, fontSize, fragments } = layout;
  const handwriting = fontsLoaded ? HANDWRITING_FONT : HANDWRITING_FALLBACK;
  const lineHeight = fontSize * 1.45;
  const swashPad = fontSize * 0.3;
  const strokeWidth = Math.max(2.4, (1.3 * MARK_W) / mark.width);
  const lineStyles = [line1Style, line2Style];

  return (
    <View style={styles.screen} testID="v2-onboarding-bridge" pointerEvents="box-none">
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* Measures each handwritten line once so the reveal ends exactly where the ink does. */}
      <View style={styles.measureHost} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        {LINES.map((line, index) => (
          <Text
            key={line.text}
            accessible={false}
            style={[styles.handwriting, styles.measure, { fontFamily: handwriting, fontSize, lineHeight }]}
            onLayout={(event) => {
              lineWidths[index].value = event.nativeEvent.layout.width + swashPad * 1.6;
            }}
          >
            {line.text}
          </Text>
        ))}
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.world, worldStyle]} pointerEvents="none">
      {/* 1–2. Locked environment + cinematic grade */}
      <Screen2Backdrop width={W} height={H} plateStyle={plateStyle} />

      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel="A written intention breaks into fragments that come together as an example Anchor symbol."
      >
        {/* 3–4. Notebook + native handwriting */}
        <Animated.View style={[styles.abs, nb, notebookStyle]}>
          <Image source={notebook} style={styles.fill} resizeMode="contain" />
          <Animated.View
            style={[
              styles.page,
              {
                left: PAGE_ORIGIN.x * k,
                top: PAGE_ORIGIN.y * k,
                width: 760 * k,
                height: 420 * k,
                transform: [{ rotate: `${PAGE_ANGLE_DEG}deg` }],
              },
            ]}
          >
            <Animated.View style={[styles.fill, writingStyle]}>
            {LINES.map((line, index) => (
              <Animated.View
                key={line.text}
                style={[
                  styles.lineClip,
                  {
                    left: line.x * k - swashPad,
                    top: line.baseline * k - lineHeight * 0.8,
                    height: lineHeight + fontSize * 0.4,
                  },
                  lineStyles[index],
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.handwriting,
                    { fontFamily: handwriting, fontSize, lineHeight, width: fontSize * 7, paddingLeft: swashPad },
                  ]}
                >
                  {line.text}
                </Text>
              </Animated.View>
            ))}
            </Animated.View>
          </Animated.View>
          <Animated.Image source={notebook} style={[styles.notebookShade, notebookShadeStyle]} resizeMode="contain" />
        </Animated.View>

        {/* 5. Fragments (none under Reduce Motion) */}
        {reduceMotion
          ? null
          : fragments.map((spec) => <Fragment key={spec.key} spec={spec} clock={clock} idle={idle} />)}

        {/* 6. Construction geometry, drawn on the mark's own structure */}
        {reduceMotion ? null : (
          <Animated.View style={[styles.abs, mark, constructionStyle]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${MARK_W} ${MARK_H}`}>
              {CONSTRUCTION.map((line) => (
                <ConstructionLine key={line.d} {...line} clock={clock} strokeWidth={strokeWidth} />
              ))}
              <ConstructionRing clock={clock} strokeWidth={strokeWidth} />
              {[MARK.topLeft, MARK.topRight, MARK.lowerLeft, MARK.lowerRight, MARK.base].map((point) => (
                <ConstructionNode key={`${point.x}-${point.y}`} point={point} clock={clock} />
              ))}
              <ConstructionNode point={MARK.center} gold clock={clock} />
            </Svg>
          </Animated.View>
        )}

      </View>
      </Animated.View>

      {/* 7. The supplied brand mark: ink geometry, then the gold centre locks in.
          Outside the world layer so it survives briefly into the handoff. */}
      <Animated.View style={[styles.abs, mark, handoffMarkStyle]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, markStyle]}>
          <Image source={markInk} style={styles.fill} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, diamondStyle]}>
          <Image source={markDiamond} style={styles.fill} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      {/* 8. Readability gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, worldTopStyle]} pointerEvents="none">
        <Animated.View
          pointerEvents="none"
          style={[styles.abs, { left: 0, right: 0, top: copyTop - 140, bottom: 0 }, gradientStyle]}
        >
          <LinearGradient
            colors={["rgba(9, 11, 18, 0)", "rgba(9, 11, 18, 0.62)", "rgba(8, 10, 16, 0.9)", "#07090F"]}
            locations={[0, 0.28, 0.58, 1]}
            style={styles.fill}
          />
        </Animated.View>
      </Animated.View>

      {/* Progress: 2 / 8 for the whole sequence (the journey normally owns this header) */}
      {header ? (
        <Animated.View style={[styles.header, { paddingTop: insets.top }, headerStyle]}>{header}</Animated.View>
      ) : null}

      {/* 9–10. Explanatory UI + CTA */}
      <View style={[styles.copy, { paddingBottom: bottomPad }]} onLayout={onCopyLayout}>
        <Animated.Text style={[styles.headline, headlineStyle]} accessibilityRole="header">
          Give what matters{"\n"}a <Text style={styles.headlineGold}>shape.</Text>
        </Animated.Text>
        <Animated.Text style={[styles.support, supportStyle]}>
          Anchor turns an intention into a visual you can return to, reinforce, and act on.
        </Animated.Text>
        <Animated.View style={[styles.verbsBlock, verbsStyle]}>
          <View style={styles.rule} />
          <Text style={styles.verbs} accessibilityLabel="See, reinforce, move">
            SEE · REINFORCE · MOVE
          </Text>
        </Animated.View>
        <Animated.View style={ctaStyle} pointerEvents={canContinue ? "auto" : "none"}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !canContinue }}
            disabled={!canContinue}
            onPress={handleContinue}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Continue</Text>
            <ArrowRight size={20} color="#14162B" strokeWidth={2.2} />
          </Pressable>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: Screen 3 is mounted beneath and shows through as the world layer thins.
  screen: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  world: { backgroundColor: "#0E151C" },
  abs: { position: "absolute" },
  fill: { width: "100%", height: "100%" },
  fragment: { position: "absolute", left: 0, top: 0 },
  page: { position: "absolute", transformOrigin: "left top" },
  handwriting: { color: INK, opacity: 0.9 },
  notebookShade: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", tintColor: "#07090F" },
  measureHost: { position: "absolute", left: 0, top: 0, width: 2000, opacity: 0 },
  measure: { alignSelf: "flex-start" },
  lineClip: { position: "absolute", overflow: "hidden" },
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  copy: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 28, alignItems: "stretch" },
  headline: {
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  headlineGold: { color: GOLD, fontFamily: "Inter-SemiBold" },
  support: {
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
    alignSelf: "center",
    maxWidth: 320,
  },
  verbsBlock: { alignItems: "center", marginTop: 18, marginBottom: 24 },
  rule: { width: 36, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(228, 196, 138, 0.55)", marginBottom: 14 },
  verbs: {
    color: "rgba(255, 255, 255, 0.58)",
    fontFamily: "Inter-SemiBold",
    fontSize: 11,
    letterSpacing: 2.4,
  },
  cta: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F4DDB8",
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: { color: "#14162B", fontFamily: "Inter-SemiBold", fontSize: 16 },
});
