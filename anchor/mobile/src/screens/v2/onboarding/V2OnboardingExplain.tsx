/**
 * Onboarding Screen 2 — "What does Anchor actually do?"
 *
 * One screen, one continuous transformation:
 *   thought → written intention → reduction → fragments → visual Anchor.
 *
 * The notebook arrives blank. A pen writes the intention stroke by stroke (the nib leads each
 * stroke). The finished sentence holds, then loosens and leaves the page as its own strokes,
 * letter-sized pieces that travel, turn and fade into the mark. Each of the mark's guide
 * strokes starts where its pieces land, and the textured mark is painted in along those
 * guides — it is never swapped in whole. Only then does the gold centre lock and the mark
 * settle, hold, and hand over to the copy and CTA.
 *
 * The phases are internal animation states, not pages; the user stays on 2 / 8 throughout.
 * Every layer reads a single time-based clock (ms) on the UI thread, so the sequence runs at
 * the same speed on iOS and Android and nothing re-renders per frame. The timeline and the
 * ink plan live in screen2Timeline.ts.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
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
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group,
  Image as SkiaImage,
  Mask,
  Path as SkiaPath,
  Rect as SkiaRect,
  useImage,
} from "@shopify/react-native-skia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ArrowRight } from "lucide-react-native";
import { Screen2Backdrop } from "./screen2Backdrop";
import { easeInOutCubic, easeOutCubic as handoffEaseOut, handoffTimeline, seg as handoffSeg } from "./openingHandoff";
import { HANDWRITING_LINES } from "./handwritingStrokes";
import {
  CTA_READY_MS,
  EM_PAGE_PX,
  LINE_ORIGINS,
  MARK,
  MARK_H,
  MARK_STROKES,
  MARK_W,
  NB_H,
  NB_W,
  PAGE_E1,
  PAGE_E2,
  PAGE_ORIGIN,
  RM,
  RM_CTA_READY_MS,
  T,
  planInk,
  pointAlong,
  polylineToSvg,
  type Point,
  type Window,
} from "./screen2Timeline";

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

const INK = "#1B1F2A";
const GOLD = "#E4C48A";
/** Brush width (mark pixels) that paints the textured mark in along its guides. */
const BRUSH_WIDTH = 92;
/** Guide stroke width (mark pixels). */
const GUIDE_WIDTH = 4;

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
/** A hand's pace along one stroke: a soft start and finish, never a stall. */
function penPace(p: number): number {
  "worklet";
  return 0.7 * p + 0.3 * (0.5 - 0.5 * Math.cos(Math.PI * p));
}
function bezier(a: number, c: number, b: number, p: number): number {
  "worklet";
  const q = 1 - p;
  return q * q * a + 2 * q * p * c + p * p * b;
}
/** The notebook sinks away once the writing has left it; pieces still on the page ride along. */
function notebookSink(t: number): number {
  "worklet";
  return 14 * easeInOut(seg(t, T.notebookDim));
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

// --- Handwriting: written ink, then the same ink breaking away ---------------------------

type ScreenStroke = {
  write: Window;
  length: number;
  /** Screen-space polyline as flat x,y pairs, with cumulative lengths, for the nib. */
  xy: number[];
  cumulative: number[];
};

type ScreenPiece = {
  key: string;
  d: string;
  centroid: Point;
  ctrl: Point;
  dest: Point;
  lift: Point;
  spin: number;
  flight: Window;
  write: Window;
  strokeLength: number;
  offset: number;
  length: number;
};

/**
 * One letter-sized piece of the handwriting. It is drawn by the pen during its stroke's write
 * window (trimmed from the pen's current position), holds, then loosens, lifts, turns and
 * travels to the part of the mark it becomes, shrinking and fading as it arrives.
 */
function InkPiece({
  piece,
  clock,
  strokeWidth,
  reduceMotion,
}: {
  piece: ScreenPiece;
  clock: SharedValue<number>;
  strokeWidth: number;
  reduceMotion: boolean;
}) {
  const end = useDerivedValue(() => {
    if (reduceMotion) return 1;
    const drawn = piece.strokeLength * penPace(seg(clock.value, piece.write));
    return Math.min(1, Math.max(0, (drawn - piece.offset) / piece.length));
  });
  const opacity = useDerivedValue(() => {
    const t = clock.value;
    if (reduceMotion) return seg(t, RM.notebookIn) * (1 - seg(t, RM.dissolve));
    if (end.value <= 0) return 0; // An untraced round cap would still paint a dot.
    const p = seg(t, piece.flight);
    return 0.9 * (1 - easeInOut(Math.max(0, (p - 0.62) / 0.38)));
  });
  const transform = useDerivedValue(() => {
    if (reduceMotion) return [{ translateX: 0 }];
    const t = clock.value;
    const p = seg(t, piece.flight);
    // Loosen: the stroke lifts off the page before it travels.
    const loosen = easeOut(Math.min(1, p / 0.22));
    const travel = easeInOut(Math.max(0, (p - 0.12) / 0.88));
    const hold = 1 - travel;
    const { centroid, ctrl, dest, lift } = piece;
    const x = bezier(centroid.x, ctrl.x, dest.x, travel) - centroid.x + lift.x * loosen * hold;
    const y =
      bezier(centroid.y, ctrl.y, dest.y, travel) - centroid.y + lift.y * loosen * hold + notebookSink(t) * hold;
    return [
      { translateX: x },
      { translateY: y },
      { rotate: piece.spin * (0.12 * loosen + travel) },
      { scale: 1 + 0.08 * loosen * hold - 0.55 * travel },
    ];
  });
  return (
    <SkiaPath
      path={piece.d}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
      strokeJoin="round"
      color={INK}
      start={0}
      end={end}
      opacity={opacity}
      origin={piece.centroid}
      transform={transform}
    />
  );
}

/** The pen's nib: leads every stroke, lifts between strokes, and rests where the pen lies. */
function PenNib({
  strokes,
  clock,
  size,
}: {
  strokes: ScreenStroke[];
  clock: SharedValue<number>;
  size: number;
}) {
  const nib = useDerivedValue(() => {
    const t = clock.value;
    let x = 0;
    let y = 0;
    let down = 0;
    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      if (t < s.write[0]) {
        if (i === 0) {
          x = s.xy[0];
          y = s.xy[1];
        } else {
          // Pen lifted, travelling to the next stroke.
          const prev = strokes[i - 1];
          const n = prev.xy.length;
          const f = easeInOut(seg(t, [prev.write[1], s.write[0]]));
          x = prev.xy[n - 2] + (s.xy[0] - prev.xy[n - 2]) * f;
          y = prev.xy[n - 1] + (s.xy[1] - prev.xy[n - 1]) * f - 3 * Math.sin(Math.PI * f);
        }
        break;
      }
      if (t <= s.write[1] || i === strokes.length - 1) {
        const drawn = s.length * penPace(seg(t, s.write));
        const c = s.cumulative;
        let j = 1;
        while (j < c.length - 1 && c[j] < drawn) j++;
        const span = c[j] - c[j - 1];
        const f = span > 0 ? Math.min(1, Math.max(0, (drawn - c[j - 1]) / span)) : 1;
        x = s.xy[2 * (j - 1)] + (s.xy[2 * j] - s.xy[2 * (j - 1)]) * f;
        y = s.xy[2 * (j - 1) + 1] + (s.xy[2 * j + 1] - s.xy[2 * (j - 1) + 1]) * f;
        down = t <= s.write[1] ? 1 : 0;
        break;
      }
    }
    const visible = seg(t, [T.nib[0], T.nib[0] + 200]) * (1 - seg(t, [T.nib[1] - 300, T.nib[1]]));
    return { x, y, down, visible };
  });
  const cx = useDerivedValue(() => nib.value.x);
  const cy = useDerivedValue(() => nib.value.y);
  const tipOpacity = useDerivedValue(() => nib.value.visible * (0.45 + 0.5 * nib.value.down));
  const glowOpacity = useDerivedValue(() => nib.value.visible * (0.25 + 0.35 * nib.value.down));
  return (
    <Group>
      <SkiaCircle cx={cx} cy={cy} r={size * 3.2} color={GOLD} opacity={glowOpacity}>
        <BlurMask blur={size * 2.2} style="normal" />
      </SkiaCircle>
      <SkiaCircle cx={cx} cy={cy} r={size * 0.95} color={INK} opacity={tipOpacity} />
    </Group>
  );
}

// --- The mark, built from its own strokes -------------------------------------------------

/** One guide stroke of the mark (pencil-thin), traced as its fragments land. */
function GuideStroke({ d, window, clock }: { d: string; window: Window; clock: SharedValue<number> }) {
  const end = useDerivedValue(() => easeInOut(seg(clock.value, window)));
  const opacity = useDerivedValue(() => (end.value > 0 ? 0.82 * (1 - seg(clock.value, T.guidesOut)) : 0));
  return (
    <SkiaPath
      path={d}
      style="stroke"
      strokeWidth={GUIDE_WIDTH}
      strokeCap="round"
      strokeJoin="round"
      color={INK}
      start={0}
      end={end}
      opacity={opacity}
    />
  );
}

/** A wide brush along the same guide: where it has passed, the textured mark shows. */
function BrushStroke({ d, window, clock }: { d: string; window: Window; clock: SharedValue<number> }) {
  const end = useDerivedValue(() => easeInOut(seg(clock.value, [window[0] + T.brushLag, window[1] + T.brushLag])));
  const opacity = useDerivedValue(() => (end.value > 0 ? 1 : 0));
  return (
    <SkiaPath
      path={d}
      style="stroke"
      strokeWidth={BRUSH_WIDTH}
      strokeCap="round"
      strokeJoin="round"
      color="white"
      start={0}
      end={end}
      opacity={opacity}
    />
  );
}

function ConstructionNode({ point, gold, clock }: { point: Point; gold?: boolean; clock: SharedValue<number> }) {
  const opacity = useDerivedValue(() => seg(clock.value, T.nodes) * (1 - seg(clock.value, T.guidesOut)));
  return <SkiaCircle cx={point.x} cy={point.y} r={gold ? 8 : 6.5} color={gold ? GOLD : INK} opacity={opacity} />;
}

const MARK_PARTS = MARK_STROKES.map((part, index) => ({
  window: T.guides[index],
  paths: part.map(polylineToSvg),
}));

function MarkBuild({
  width,
  height,
  clock,
  reduceMotion,
}: {
  width: number;
  height: number;
  clock: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const ink = useImage(markInk);
  const fill = useDerivedValue(() => (reduceMotion ? 1 : easeInOut(seg(clock.value, T.markComplete))));
  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  const scale = width / MARK_W;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Group transform={[{ scale }]}>
        <Mask
          mode="alpha"
          mask={
            <Group>
              {reduceMotion
                ? null
                : MARK_PARTS.flatMap((part, index) =>
                    part.paths.map((d) => <BrushStroke key={`${index}-${d}`} d={d} window={part.window} clock={clock} />),
                  )}
              <SkiaRect x={0} y={0} width={MARK_W} height={MARK_H} color="white" opacity={fill} />
            </Group>
          }
        >
          {ink ? <SkiaImage image={ink} fit="contain" x={0} y={0} width={MARK_W} height={MARK_H} /> : null}
        </Mask>
        {reduceMotion ? null : (
          <Group>
            {MARK_PARTS.flatMap((part, index) =>
              part.paths.map((d) => <GuideStroke key={`${index}-${d}`} d={d} window={part.window} clock={clock} />),
            )}
            {[MARK.topLeft, MARK.topRight, MARK.lowerLeft, MARK.lowerRight, MARK.base].map((point) => (
              <ConstructionNode key={`${point.x}-${point.y}`} point={point} clock={clock} />
            ))}
            <ConstructionNode point={MARK.center} gold clock={clock} />
          </Group>
        )}
      </Group>
    </Canvas>
  );
}

// --- Supplied fragment artwork: torn paper, shards, ink and gold ----------------------------

type FragmentSpec = {
  key: keyof typeof FRAGMENT_ART;
  width: number;
  start: Point;
  ctrl: Point;
  end: Point;
  /** Nearly-static resting place after the mark resolves; omitted pieces fade out. */
  rest?: Point;
  flight: Window;
  fadeIn: Window;
  fadeOut: Window;
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

type Props = {
  /** Optional in-screen header; the journey normally keeps progress in a persistent header. */
  header?: React.ReactNode;
  reduceMotion: boolean;
  /** Mount the notebook behind Welcome without starting its writing clock. */
  active?: boolean;
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

const INK_PLAN = planInk();

export function V2OnboardingExplain({ header, reduceMotion, active = true, handoff, nextReady = true, onContinue }: Props) {
  const windowDim = useWindowDimensions();
  const screenDim = Dimensions.get("window");
  const W = windowDim.width || screenDim.width || 390;
  const H = windowDim.height || screenDim.height || 844;
  const insets = useSafeAreaInsets();

  const clock = useSharedValue(0);
  const idle = useSharedValue(0.5);
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
    const lockupH = 46;
    const lockupGap = 12;
    const headlineGap = 36;
    const maxMarkBottom = Math.max(heroTop + 140, copyTop - headlineGap - lockupH - lockupGap);
    const availableHeroH = maxMarkBottom - heroTop;
    const markH = Math.min(availableHeroH, W * 0.54 * (MARK_H / MARK_W), 240);
    const markW = (markH * MARK_W) / MARK_H;
    const markTop = heroTop + (availableHeroH - markH) / 2;
    const mark = {
      left: (W - markW) / 2,
      top: markTop,
      width: markW,
      height: markH,
    };

    // The notebook sits in the lower foreground; capped so wide Android screens don't inflate it.
    const nbW = Math.min(W * 1.08, H * 0.56, 470);
    const nbH = (nbW * NB_H) / NB_W;
    const nb = { left: (W - nbW) / 2, top: H * 0.5, width: nbW, height: nbH };
    const k = nbW / NB_W;
    const em = EM_PAGE_PX * k;

    const pagePoint = (p: Point): Point => ({
      x: nb.left + (PAGE_ORIGIN.x + p.x * PAGE_E1.x + p.y * PAGE_E2.x) * k,
      y: nb.top + (PAGE_ORIGIN.y + p.x * PAGE_E1.y + p.y * PAGE_E2.y) * k,
    });
    const onLine = (line: 0 | 1, frac: number): Point =>
      pagePoint({
        x: LINE_ORIGINS[line].x + HANDWRITING_LINES[line].width * EM_PAGE_PX * frac,
        y: LINE_ORIGINS[line].baseline - 0.3 * EM_PAGE_PX,
      });
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

    // Pen strokes in screen space, for the nib.
    const strokes: ScreenStroke[] = INK_PLAN.strokes.map((stroke) => {
      const points = stroke.points.map(pagePoint);
      const cumulative = [0];
      for (let i = 1; i < points.length; i++) {
        cumulative.push(cumulative[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
      }
      return {
        write: stroke.write,
        length: cumulative[cumulative.length - 1],
        xy: points.flatMap((p) => [p.x, p.y]),
        cumulative,
      };
    });

    // The written pieces, each landing along the part of the mark it becomes.
    const pieces: ScreenPiece[] = INK_PLAN.chunks.map((chunk, index) => {
      const points = chunk.points.map(pagePoint);
      const centroid = points.reduce((acc, p) => ({ x: acc.x + p.x / points.length, y: acc.y + p.y / points.length }), { x: 0, y: 0 });
      const part = MARK_STROKES[chunk.target];
      const along = part.length > 1 ? chunk.landing * part.length : chunk.landing;
      const polyline = part[Math.min(part.length - 1, Math.floor(along))];
      const dest = onMark(pointAlong(polyline, part.length > 1 ? along % 1 : along));
      const ctrl = lerp(centroid, dest, 0.45, chunk.jitter * W * 0.16, -H * 0.06 - Math.abs(chunk.jitter) * H * 0.03);
      return {
        key: `ink-${index}`,
        d: polylineToSvg(points),
        centroid,
        ctrl,
        dest,
        lift: { x: chunk.jitter * 7, y: -7 - Math.abs(chunk.jitter) * 5 },
        spin: chunk.jitter * 0.55,
        flight: chunk.flight,
        write: INK_PLAN.strokes[chunk.stroke].write,
        // The page → screen map is a rotation and a uniform scale, so lengths scale by k.
        strokeLength: INK_PLAN.strokes[chunk.stroke].length * k,
        offset: chunk.offset * k,
        length: chunk.length * k,
      };
    });

    // Supplied artwork travelling with the writing: torn paper and shards leave the written
    // lines as they break, ink and gold pieces converge on the vertices the guides pass through.
    const B = T.breakStart;
    const fragments: FragmentSpec[] = [
      { key: "paperA", width: W * 0.27, start: onLine(0, 0.45), ctrl: lerp(onLine(0, 0.45), heroCenter, 0.55, -W * 0.18), end: onMark({ x: 230, y: 520 }), flight: [B, B + 1350], fadeIn: [B, B + 180], fadeOut: [B + 850, B + 1300], rotate: [-14, -52], scale: [0.7, 0.32], depth: 0.35 },
      { key: "paperB", width: W * 0.21, start: onLine(1, 0.55), ctrl: lerp(onLine(1, 0.55), heroCenter, 0.6, W * 0.2), end: onMark({ x: 500, y: 380 }), flight: [B + 60, B + 1400], fadeIn: [B + 60, B + 240], fadeOut: [B + 900, B + 1350], rotate: [16, 64], scale: [0.7, 0.32], depth: 0.35 },
      { key: "shardA", width: W * 0.06, start: onLine(0, 0.15), ctrl: lerp(onLine(0, 0.15), heroCenter, 0.4, -W * 0.22), end: onMark({ x: 150, y: 300 }), flight: [B + 20, B + 1200], fadeIn: [B + 20, B + 160], fadeOut: [B + 700, B + 1150], rotate: [0, -120], scale: [0.8, 0.6], depth: 0.3 },
      { key: "shardB", width: W * 0.065, start: onLine(0, 0.82), ctrl: lerp(onLine(0, 0.82), heroCenter, 0.5, W * 0.2), end: onMark({ x: 600, y: 300 }), flight: [B + 80, B + 1250], fadeIn: [B + 80, B + 220], fadeOut: [B + 750, B + 1200], rotate: [20, 140], scale: [0.8, 0.6], depth: 0.3 },
      { key: "shardC", width: W * 0.055, start: onLine(1, 0.2), ctrl: lerp(onLine(1, 0.2), heroCenter, 0.3, -W * 0.26), end: onMark({ x: 120, y: 560 }), flight: [B + 140, B + 1300], fadeIn: [B + 140, B + 280], fadeOut: [B + 800, B + 1250], rotate: [-30, -160], scale: [0.8, 0.6], depth: 0.25 },
      { key: "shardD", width: W * 0.055, start: onLine(1, 0.9), ctrl: lerp(onLine(1, 0.9), heroCenter, 0.35, W * 0.24), end: onMark({ x: 620, y: 560 }), flight: [B + 200, B + 1350], fadeIn: [B + 200, B + 340], fadeOut: [B + 850, B + 1300], rotate: [10, 110], scale: [0.8, 0.6], depth: 0.25 },
      { key: "inkA", width: W * 0.1, start: lerp(textCenter, heroCenter, 0.35, -W * 0.14), ctrl: lerp(textCenter, heroCenter, 0.7, -W * 0.3), end: onMark(MARK.topLeft), flight: [B + 380, B + 1620], fadeIn: [B + 380, B + 640], fadeOut: T.fragmentsOut, rotate: [-40, -8], scale: [0.7, 0.62], depth: 0.2 },
      { key: "inkB", width: W * 0.095, start: lerp(textCenter, heroCenter, 0.38, W * 0.16), ctrl: lerp(textCenter, heroCenter, 0.72, W * 0.32), end: onMark(MARK.topRight), rest: onMark({ x: MARK.topRight.x + 90, y: MARK.topRight.y - 40 }), flight: [B + 420, B + 1660], fadeIn: [B + 420, B + 680], fadeOut: T.fragmentsOut, rotate: [34, 12], scale: [0.7, 0.55], depth: 0.2 },
      { key: "inkC", width: W * 0.055, start: lerp(textCenter, heroCenter, 0.28, -W * 0.08), ctrl: lerp(textCenter, heroCenter, 0.45, -W * 0.34), end: onMark(MARK.lowerLeft), rest: onMark({ x: MARK.lowerLeft.x - 90, y: MARK.lowerLeft.y + 30 }), flight: [B + 480, B + 1900], fadeIn: [B + 480, B + 740], fadeOut: T.fragmentsOut, rotate: [-60, -20], scale: [0.8, 0.75], depth: 0.15 },
      { key: "inkD", width: W * 0.06, start: lerp(textCenter, heroCenter, 0.3, W * 0.1), ctrl: lerp(textCenter, heroCenter, 0.5, W * 0.36), end: onMark(MARK.lowerRight), flight: [B + 520, B + 1920], fadeIn: [B + 520, B + 780], fadeOut: T.fragmentsOut, rotate: [50, 16], scale: [0.8, 0.7], depth: 0.15 },
      { key: "inkE", width: W * 0.07, start: lerp(textCenter, heroCenter, 0.25), ctrl: lerp(textCenter, heroCenter, 0.35, -W * 0.06), end: onMark(MARK.base), flight: [B + 560, B + 1960], fadeIn: [B + 560, B + 820], fadeOut: T.fragmentsOut, rotate: [-20, 30], scale: [0.8, 0.6], depth: 0.15 },
      // The gold centre: arrives last, and hands straight over to the diamond.
      { key: "goldA", width: W * 0.06, start: lerp(textCenter, heroCenter, 0.42, W * 0.04), ctrl: lerp(textCenter, heroCenter, 0.8, W * 0.12), end: heroCenter, flight: [B + 900, B + 2950], fadeIn: [B + 900, B + 1160], fadeOut: [B + 2950, B + 3200], rotate: [-30, 0], scale: [0.8, 0.55], depth: 0.2 },
      { key: "goldB", width: W * 0.036, start: lerp(textCenter, heroCenter, 0.45, -W * 0.02), ctrl: lerp(textCenter, heroCenter, 0.95, -W * 0.16), end: onMark(MARK.ringTop), rest: onMark({ x: MARK.ringTop.x + 110, y: MARK.ringTop.y + 20 }), flight: [B + 450, B + 1700], fadeIn: [B + 450, B + 710], fadeOut: T.fragmentsOut, rotate: [20, -10], scale: [0.9, 0.8], depth: 0.15 },
    ];

    return { mark, nb, k, em, strokes, pieces, fragments };
  }, [H, W, copyTop, insets.top]);

  // Start the single clock. Reduce Motion owns its own crossfade timeline, so the system
  // reduce-motion shortcut in Reanimated (which would jump straight to the end) is bypassed.
  useEffect(() => {
    if (!active) {
      cancelAnimation(clock);
      cancelAnimation(idle);
      clock.value = 0;
      setCtaReady(false);
      return;
    }
    const end = reduceMotion ? RM.end : T.end;
    cancelAnimation(clock);
    cancelAnimation(idle);
    clock.value = 0;
    clock.value = withTiming(end, { duration: end, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    if (!reduceMotion) {
      idle.value = withRepeat(
        withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
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
  }, [active, clock, idle, reduceMotion]);

  const canContinue = active && ctaReady && nextReady;
  const handleContinue = () => {
    if (!canContinue || leaving.current) return;
    leaving.current = true;
    onContinue();
  };
  // Lets a returning or impatient user tap past the transformation instead of waiting it out.
  const handleSkip = () => {
    if (!active || ctaReady || leaving.current) return;
    cancelAnimation(clock);
    clock.value = reduceMotion ? RM.end : T.end;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setCtaReady(true);
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
    return {
      opacity: enter,
      transform: [{ translateY: 20 * (1 - enter) + notebookSink(t) }, { scale: 0.97 + 0.03 * enter }],
    };
  });

  // Dimming by opacity would reveal the plate's own desk beneath, so the notebook darkens
  // under a silhouette of itself and settles into the readability gradient.
  const notebookShadeStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * easeInOut(seg(clock.value, reduceMotion ? RM.dissolve : T.notebookDim)),
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

  // The mark gathers itself as it is built, swells slightly as the centre locks, and settles.
  const markStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (reduceMotion) {
      return { opacity: seg(t, RM.dissolve) };
    }
    const build = easeOut(seg(t, T.build));
    const up = easeInOut(seg(t, T.settleUp));
    const down = easeInOut(seg(t, T.settleDown));
    return { opacity: 1, transform: [{ scale: 0.97 + 0.03 * build + 0.025 * up - 0.025 * down }] };
  });

  const diamondStyle = useAnimatedStyle(() => {
    const t = clock.value;
    if (reduceMotion) {
      return { opacity: seg(t, RM.dissolve) };
    }
    const p = easeOut(seg(t, T.diamondIn));
    return { opacity: p, transform: [{ scale: 0.6 + 0.4 * p }] };
  });

  const gradientStyle = useAnimatedStyle(() => ({
    opacity: seg(clock.value, reduceMotion ? RM.gradientIn : T.gradientIn),
  }));

  // Brand identity: reveals beneath the settled mark, ANCHOR first then VISUAL GOAL SETTING
  // just after it, and leaves with the mark itself during the Screen 2 → 3 handoff.
  const brandWordmarkStyle = useAnimatedStyle(() => {
    const p = easeOut(seg(clock.value, reduceMotion ? RM.brandWordmark : T.brandWordmark));
    const leave = easeInOutCubic(handoffSeg(handoff.value, H2.anchor));
    return {
      opacity: p * (1 - leave),
      transform: [{ translateY: (reduceMotion ? 0 : 8 * (1 - p)) - (reduceMotion ? 0 : 20 * leave) }],
    };
  });
  const brandSubStyle = useAnimatedStyle(() => {
    const p = easeOut(seg(clock.value, reduceMotion ? RM.brandSub : T.brandSub));
    const leave = easeInOutCubic(handoffSeg(handoff.value, H2.anchor));
    return {
      opacity: p * (1 - leave),
      transform: [{ translateY: (reduceMotion ? 0 : 6 * (1 - p)) - (reduceMotion ? 0 : 20 * leave) }],
    };
  });

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

  const { mark, nb, em, strokes, pieces, fragments } = layout;
  const penWidth = Math.max(1.3, em * 0.058);

  return (
    <Pressable
      style={styles.screen}
      testID="v2-onboarding-bridge"
      onPress={handleSkip}
      disabled={!active || ctaReady}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <Animated.View style={[StyleSheet.absoluteFill, styles.world, worldStyle]} pointerEvents="none">
      {/* 1–2. Locked environment + cinematic grade */}
      <Screen2Backdrop width={W} height={H} plateStyle={plateStyle} />

      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel="An intention is handwritten in a notebook, breaks into fragments, and those fragments build an example Anchor symbol."
      >
        {/* 3. Notebook, arriving blank */}
        <Animated.View style={[styles.abs, nb, notebookStyle]}>
          <Image source={notebook} style={styles.fill} resizeMode="contain" />
          <Animated.Image source={notebook} style={[styles.notebookShade, notebookShadeStyle]} resizeMode="contain" />
        </Animated.View>

        {/* 4. The intention: written by the pen, then broken into its own strokes, which
            travel to the mark. Same ink throughout — nothing is swapped. */}
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          {pieces.map((piece) => (
            <InkPiece key={piece.key} piece={piece} clock={clock} strokeWidth={penWidth} reduceMotion={reduceMotion} />
          ))}
          {reduceMotion ? null : <PenNib strokes={strokes} clock={clock} size={penWidth} />}
        </Canvas>

        {/* 5. Supplied fragment artwork (none under Reduce Motion) */}
        {reduceMotion
          ? null
          : fragments.map((spec) => <Fragment key={spec.key} spec={spec} clock={clock} idle={idle} />)}
      </View>
      </Animated.View>

      {/* 6. The Anchor, built from guide strokes and painted in along them; then the gold
          centre locks in. Outside the world layer so it survives briefly into the handoff. */}
      <Animated.View style={[styles.abs, mark, handoffMarkStyle]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, markStyle]}>
          <MarkBuild width={mark.width} height={mark.height} clock={clock} reduceMotion={reduceMotion} />
          <Animated.View style={[StyleSheet.absoluteFill, diamondStyle]}>
            <Image source={markDiamond} style={styles.fill} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* 7. Readability gradient */}
      <Animated.View style={[StyleSheet.absoluteFill, worldTopStyle]} pointerEvents="none">
        <Animated.View
          pointerEvents="none"
          style={[styles.abs, { left: 0, right: 0, top: copyTop - 140, bottom: 0 }, gradientStyle]}
        >
          <LinearGradient
            colors={["rgba(9, 11, 18, 0)", "rgba(9, 11, 18, 0.74)", "rgba(8, 10, 16, 0.96)", "#07090F"]}
            locations={[0, 0.28, 0.58, 1]}
            style={styles.fill}
          />
        </Animated.View>
      </Animated.View>

      {/* 6b. Brand identity, directly beneath the settled mark: ANCHOR, then VISUAL GOAL
          SETTING just after it. Above the readability gradient so it stays luminous and crisp. */}
      <View
        style={[styles.abs, { left: 0, right: 0, top: mark.top + mark.height + 12 }, styles.brandLockup]}
        pointerEvents="none"
        accessible
        accessibilityLabel="Anchor. Visual goal setting."
      >
        <Animated.Text style={[styles.brandWordmark, brandWordmarkStyle]}>ANCHOR</Animated.Text>
        <Animated.Text style={[styles.brandSub, brandSubStyle]}>VISUAL GOAL SETTING</Animated.Text>
      </View>

      {/* Progress: 2 / 8 for the whole sequence (the journey normally owns this header) */}
      {header ? (
        <Animated.View style={[styles.header, { paddingTop: insets.top }, headerStyle]}>{header}</Animated.View>
      ) : null}

      {/* 8–9. Explanatory UI + CTA */}
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

    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Transparent: Screen 3 is mounted beneath and shows through as the world layer thins.
  screen: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  world: { backgroundColor: "#0E151C" },
  abs: { position: "absolute" },
  fill: { width: "100%", height: "100%" },
  fragment: { position: "absolute", left: 0, top: 0 },
  notebookShade: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%", tintColor: "#07090F" },
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
  brandLockup: { alignItems: "center" },
  brandWordmark: {
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 22,
    letterSpacing: 9,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 1 },
  },
  brandSub: {
    color: "rgba(255, 255, 255, 0.78)",
    fontFamily: "Inter-SemiBold",
    fontSize: 10.5,
    letterSpacing: 3.2,
    marginTop: 6,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
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
