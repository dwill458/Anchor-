/**
 * Onboarding Screen 5 — "Keep what matters in sight."
 *
 * The moment Screen 4's answer turns into what Anchor will do with it: SEE → REINFORCE →
 * MOVE. It is mounted beneath Screen 4 well before Continue is pressed and revealed by the
 * shared handoff clock. The category illustration is the same object Screen 4 showed; it
 * rises and shrinks into place here rather than being replaced.
 *
 * The three pieces share one grid and one label baseline, but not one container: SEE is an
 * open, feathered vignette; REINFORCE keeps the Anchor's circle; MOVE keeps the Chart's
 * open, upward silhouette. None of them is tappable — this is an explanation, not a menu.
 */
import React from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { focusAreaLabel } from "@/constants/v2/onboarding";
import { colors } from "@/theme/v2";
import { MOVE_ART, accentFor, anchorArtFor, heroArtFor, seeArtFor } from "./onboardingArt";
import { SCREEN5_TYPE, screen5LabelDescGap, solveOutcomeHero, solveScreen5Layout, type Frame } from "./screen5Layout";
import {
  easeInOutCubic,
  easeOutCubic,
  seg,
  systemHandoffTimeline,
  systemPieceWindows,
  type Window,
} from "./systemHandoff";

const CREAM = colors.background;
const INK = "#14162B";
const MUTED = "#5E5A55";
/** Deep enough to read as text on cream; the lighter brand gold is kept for the rule. */
const GOLD_TEXT = "#A87A2C";
const GOLD_RULE = "#D4AF6A";

const PIECES: ReadonlyArray<{ key: "see" | "reinforce" | "move"; label: string; copy: string }> = [
  { key: "see", label: "SEE", copy: "Your future\nclearly." },
  { key: "reinforce", label: "REINFORCE", copy: "Keep your\nintention strong." },
  { key: "move", label: "MOVE", copy: "Take the\nnext step." },
];

type Props = {
  clock: SharedValue<number>;
  /** "handoff": revealed beneath Screen 4. "direct": entered on its own (restore, back). */
  entry: "handoff" | "direct";
  /** False while Screen 4 still owns the screen, including during the handoff. */
  active: boolean;
  reduceMotion: boolean;
  category: AnchorCategory;
  outcome?: string;
  onContinue: () => void;
};

function reveal(t: number, window: Window, reduceMotion: boolean, rise = 12) {
  "worklet";
  const p = easeOutCubic(seg(t, window));
  return { opacity: p, transform: [{ translateY: (reduceMotion ? 0 : rise) * (1 - p) }] };
}

/**
 * SEE: the Vision collage as an open vignette. It is feathered into the cream on every
 * side along an ellipse wider than it is tall, so it reads as a glimpse rather than a card.
 */
function OrganicVision({ source, frame }: { source: ImageSourcePropType; frame: Frame }) {
  const image = useImage(source as number);
  const { width, height } = frame;
  if (!image) return null;
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

function SystemPiece({
  index,
  frame,
  kind,
  source,
  clock,
  reduceMotion,
}: {
  index: number;
  frame: Frame;
  kind: "see" | "reinforce" | "move";
  source: ImageSourcePropType;
  clock: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const timeline = systemHandoffTimeline(reduceMotion);
  const { art } = systemPieceWindows(timeline, index);

  const style = useAnimatedStyle(() => {
    const p = easeOutCubic(seg(clock.value, art));
    if (reduceMotion) return { opacity: p, transform: [{ translateY: 0 }, { scale: 1 }] };
    if (kind === "see") {
      // Gently expands into place.
      return { opacity: p, transform: [{ translateY: 4 * (1 - p) }, { scale: 0.95 + 0.05 * p }] };
    }
    if (kind === "reinforce") {
      // Stable: barely moves, simply arrives.
      return { opacity: p, transform: [{ translateY: 0 }, { scale: 0.985 + 0.015 * p }] };
    }
    // MOVE settles upward, the direction its path travels. A longer, softer curve.
    const rise = easeInOutCubic(seg(clock.value, art));
    return { opacity: p, transform: [{ translateY: 10 * (1 - rise) }, { scale: 1 }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      testID={`system-art-${kind}`}
      style={[styles.abs, { left: frame.x, top: frame.y, width: frame.width, height: frame.height }, style]}
    >
      {kind === "see" ? (
        <OrganicVision source={source} frame={frame} />
      ) : (
        <Image source={source} resizeMode="contain" style={styles.fill} accessibilityIgnoresInvertColors />
      )}
    </Animated.View>
  );
}

function SystemLabel({
  index,
  label,
  copy,
  column,
  top,
  labelDescGap,
  clock,
  reduceMotion,
}: {
  index: number;
  label: string;
  copy: string;
  column: { x: number; width: number };
  top: number;
  labelDescGap: number;
  clock: SharedValue<number>;
  reduceMotion: boolean;
}) {
  const timeline = systemHandoffTimeline(reduceMotion);
  const window = systemPieceWindows(timeline, index).label;
  const style = useAnimatedStyle(() => reveal(clock.value, window, reduceMotion, 6));
  return (
    <Animated.View style={[styles.abs, styles.labelColumn, { left: column.x, top, width: column.width }, style]}>
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
      <Text style={[styles.copy, { marginTop: labelDescGap }]} numberOfLines={2} maxFontSizeMultiplier={1.15}>
        {copy}
      </Text>
    </Animated.View>
  );
}

export function V2OnboardingSystem({ clock, entry, active, reduceMotion, category, outcome, onContinue }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const timeline = systemHandoffTimeline(reduceMotion);
  const layout = solveScreen5Layout(W, H, insets);
  const origin = solveOutcomeHero(W, H, insets);

  const accent = accentFor(category);
  const categoryLabel = (focusAreaLabel(category) ?? "Custom").toUpperCase();
  const outcomeLabel = (outcome ?? "").trim().toUpperCase();
  const pillText = outcomeLabel ? `${categoryLabel} · ${outcomeLabel}` : categoryLabel;
  const sources = { see: seeArtFor(category), reinforce: anchorArtFor(category), move: MOVE_ART };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: entry === "handoff" ? seg(clock.value, timeline.s5Backdrop) : active ? 1 : 0,
  }));

  const heroStyle = useAnimatedStyle(() => {
    const dest = layout.hero;
    if (entry === "direct") {
      const p = easeOutCubic(seg(clock.value, [timeline.directFrom, timeline.directFrom + 320]));
      return { left: dest.x, top: dest.y, width: dest.width, height: dest.height, opacity: p, transform: [{ scale: 0.99 + 0.01 * p }] };
    }
    // Handoff: Screen 4 stops drawing its artwork on the first frame the clock moves; this is
    // the same artwork, drawn from that frame at exactly Screen 4's position.
    const shown = clock.value > 0 ? 1 : 0;
    if (reduceMotion) {
      // No travel: a cross-fade at the destination.
      const p = easeOutCubic(seg(clock.value, timeline.heroFlight));
      return { left: dest.x, top: dest.y, width: dest.width, height: dest.height, opacity: p * shown, transform: [{ scale: 1 }] };
    }
    const travel = easeInOutCubic(seg(clock.value, timeline.heroFlight));
    const settle = easeOutCubic(seg(clock.value, timeline.heroSettle));
    return {
      left: origin.x + (dest.x - origin.x) * travel,
      top: origin.y + (dest.y - origin.y) * travel,
      width: origin.width + (dest.width - origin.width) * travel,
      height: origin.height + (dest.height - origin.height) * travel,
      opacity: shown,
      transform: [{ scale: 1 + 0.012 * travel * (1 - settle) }],
    };
  });

  const pillStyle = useAnimatedStyle(() => reveal(clock.value, timeline.pill, reduceMotion, 8));
  const headlineStyle = useAnimatedStyle(() => reveal(clock.value, timeline.headline, reduceMotion));
  const supportStyle = useAnimatedStyle(() => reveal(clock.value, timeline.support, reduceMotion));
  const ctaStyle = useAnimatedStyle(() => reveal(clock.value, timeline.cta, reduceMotion, 10));

  const labelDescGap = screen5LabelDescGap(layout);
  const { PILL_H, RULE_H, SUPPORT_LINE } = SCREEN5_TYPE;

  return (
    <View style={styles.root} testID="v2-onboarding-system" pointerEvents={active ? "box-none" : "none"}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.cream, backdropStyle]} />

      <Animated.View
        style={[styles.abs, heroStyle]}
        pointerEvents="none"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Illustration representing ${categoryLabel.toLowerCase()}`}
      >
        <Image source={heroArtFor(category)} resizeMode="contain" style={styles.fill} accessibilityIgnoresInvertColors />
      </Animated.View>

      <View style={[styles.abs, styles.copyColumn, { top: layout.pillTop }]} pointerEvents="none">
        <Animated.View style={[styles.pill, { height: PILL_H, backgroundColor: `${accent}1F` }, pillStyle]}>
          <Text
            style={[styles.pillText, { color: accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.2}
            testID="system-context-pill"
          >
            {pillText}
          </Text>
        </Animated.View>
        <Animated.View style={[{ marginTop: layout.gaps.pillRule, height: RULE_H }, styles.rule, pillStyle]} />
        <Animated.Text
          style={[
            styles.headline,
            { marginTop: layout.gaps.ruleHeadline, fontSize: layout.headline.fontSize, lineHeight: layout.headline.lineHeight },
            headlineStyle,
          ]}
          accessibilityRole="header"
          numberOfLines={2}
          maxFontSizeMultiplier={1.1}
        >
          Keep what matters{"\n"}in sight.
        </Animated.Text>
        <Animated.Text
          style={[styles.support, { marginTop: layout.gaps.headlineSupport, lineHeight: SUPPORT_LINE }, supportStyle]}
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.15}
        >
          See it. Reinforce it. Move toward it.
        </Animated.Text>
      </View>

      <View
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
        accessible
        accessibilityLabel="See your future clearly. Reinforce: keep your intention strong. Move: take the next step."
      >
        {PIECES.map((piece, index) => (
          <SystemPiece
            key={piece.key}
            index={index}
            kind={piece.key}
            frame={layout[piece.key].art}
            source={sources[piece.key]}
            clock={clock}
            reduceMotion={reduceMotion}
          />
        ))}
        {PIECES.map((piece, index) => (
          <SystemLabel
            key={piece.key}
            index={index}
            label={piece.label}
            copy={piece.copy}
            column={layout[piece.key].column}
            top={layout.labelTop}
            labelDescGap={labelDescGap}
            clock={clock}
            reduceMotion={reduceMotion}
          />
        ))}
      </View>

      <Animated.View style={[styles.abs, styles.ctaWrap, { top: layout.ctaTop }, ctaStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue"
          onPress={() => {
            // Not before it has visibly arrived.
            if (clock.value < timeline.cta[0]) return;
            onContinue();
          }}
          testID="system-continue"
        >
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Continue</Text>
            <ArrowRight size={20} color={INK} strokeWidth={2.2} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  cream: { backgroundColor: CREAM },
  abs: { position: "absolute" },
  fill: { width: "100%", height: "100%" },
  copyColumn: { left: 22, right: 22, alignItems: "center" },
  pill: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: "Inter-SemiBold", fontSize: 12, letterSpacing: 1.1 },
  rule: { width: 36, borderRadius: 1, backgroundColor: GOLD_RULE },
  headline: { color: INK, fontFamily: "Inter-SemiBold", letterSpacing: -0.6, textAlign: "center" },
  support: { color: MUTED, fontFamily: "Inter-Regular", fontSize: 15, textAlign: "center" },
  labelColumn: { alignItems: "center", paddingHorizontal: 2 },
  label: { color: GOLD_TEXT, fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: SCREEN5_TYPE.LABEL_LINE, letterSpacing: 0.6 },
  copy: { color: MUTED, fontFamily: "Inter-Regular", fontSize: 13.5, lineHeight: SCREEN5_TYPE.DESC_LINE, textAlign: "center" },
  ctaWrap: { left: 22, right: 22 },
  cta: {
    height: 56,
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
  ctaText: { color: INK, fontFamily: "Inter-SemiBold", fontSize: 16 },
});
