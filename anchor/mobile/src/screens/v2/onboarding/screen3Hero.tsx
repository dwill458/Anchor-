/**
 * Screen 3 hero: the locked runner plate, composed for a phone viewport.
 *
 * The plate (1536 × 2732) is taller in proportion than the Screen 3 mockup's hero, so at
 * full-bleed width her body would fill ~50% of a 19.5:9 screen and push the question and
 * grid off the bottom. Instead of cropping her, the plate is scaled so hair → shoes fits
 * above the question, and the few points it no longer spans on the left are filled with a
 * softened, mirrored continuation of the plate's own foliage edge. The seam is feathered,
 * so it reads as out-of-focus foreground rather than an image boundary.
 *
 * Everything here is static; the camera moves the whole canvas as one layer.
 */
import React from "react";
import {
  Blur,
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient as SkiaLinearGradient,
  Mask,
  Rect,
  useImage,
  vec,
} from "@shopify/react-native-skia";

export const screen3Runner = require("@/assets/onboarding/screen3/runner.jpg");

// --- Plate landmarks (runner.jpg pixels) -----------------------------------------------
const PLATE_W = 1536;
const PLATE_H = 2732;
const HAIR_TOP = 460;
const SHOE_BOTTOM = 2000;
const BODY = SHOE_BOTTOM - HAIR_TOP;
/** Left edge of her hair; everything left of `EDGE_BAND` is foliage and trail only. */
const HAIR_LEFT = 124;
const EDGE_BAND = 110;
/** A soft block of upscaled sky at the very top of the plate; kept under a haze. */
const TOP_ARTIFACT = 175;

/** Her hair must start right of the back button (16pt inset + 38pt button + a little air). */
const HEAD_CLEAR_X = 62;

/** Canvas bleed on each side so the camera can travel without exposing an edge. */
export const HERO_BLEED_LEFT = 48;
export const HERO_BLEED_RIGHT = 16;
/** Camera travel: entrance offset and idle drift (points). */
export const CAMERA = {
  enterX: 32,
  enterScale: 1.04,
  settledScale: 1.02,
  driftX: -8,
  driftScale: 0.005,
  driftMs: 9000,
} as const;

export type Screen3Layout = {
  cardW: number;
  cardH: number;
  gaps: { grid: number; cta: number; rule: number };
  headlineTop: number;
  hero: {
    /** Plate scale (points per plate pixel). */
    scale: number;
    /** Plate frame in screen points. */
    left: number;
    top: number;
    width: number;
    height: number;
    /** Screen y of the shoe line; the cream dissolve begins just below it. */
    shoeY: number;
    hairY: number;
    /** Points of mirrored foliage on the left (0 when the plate covers the width). */
    extension: number;
    /** Height of the canvas: everything below is cream. */
    canvasHeight: number;
  };
};

export const SCREEN3_METRICS = {
  sidePad: 22,
  gridGap: 12,
  ctaHeight: 56,
  headlineLine: 33,
  supportLine: 20,
  ruleHeight: 2,
  headerHeight: 48,
} as const;

/**
 * Solves the Screen 3 composition from the viewport. Order of concessions on short screens:
 * vertical gaps first, then card height, then the foliage extension, and only then does
 * the runner rise toward the header. She is never cropped.
 */
export function solveScreen3Layout(
  width: number,
  height: number,
  insets: { top: number; bottom: number },
): Screen3Layout {
  const m = SCREEN3_METRICS;
  const cardW = (width - m.sidePad * 2 - m.gridGap) / 2;
  const idealCardH = Math.min(Math.round(cardW * 0.58), 116);
  const minCardH = Math.max(80, Math.round(cardW * 0.5));
  const bottom = Math.max(insets.bottom, 16) + 8;
  // Her hair sits just under the progress row, clear of the back button.
  const idealHair = insets.top + m.headerHeight - 14;
  let maxExtension = width * 0.2;

  const headlineTopFor = (cardH: number, gaps: Screen3Layout["gaps"]) =>
    height -
    bottom -
    m.ctaHeight -
    gaps.cta -
    (cardH * 2 + m.gridGap) -
    gaps.grid -
    m.supportLine -
    (gaps.rule * 2 + m.ruleHeight) -
    m.headlineLine * 2;

  const spacious = { grid: 20, cta: 16, rule: 11 };
  const compact = { grid: 14, cta: 12, rule: 8 };
  // Absolute floor for her hair on very short screens: tucked under the status bar, never cut.
  const hairFloor = Math.max(4, insets.top * 0.35);

  const solve = (cardH: number, gaps: Screen3Layout["gaps"]) => {
    const headlineTop = headlineTopFor(cardH, gaps);
    const shoeY = headlineTop - 8;
    let scale = (shoeY - idealHair) / BODY;
    let extension = width + HERO_BLEED_RIGHT / 2 - PLATE_W * scale;
    if (extension > maxExtension) {
      // Short screen: cap the extension; she rises toward the header instead.
      extension = maxExtension;
      scale = (width + HERO_BLEED_RIGHT / 2 - extension) / PLATE_W;
    } else if (width + HERO_BLEED_RIGHT / 2 - extension < PLATE_W * scale || HAIR_LEFT * scale + extension < HEAD_CLEAR_X) {
      // Tall screen: she would grow past the width. Hold the scale that keeps her head clear
      // of the back button and let the extra height fall above her instead.
      const covered = (width + HERO_BLEED_RIGHT / 2 - HEAD_CLEAR_X) / (PLATE_W - HAIR_LEFT);
      scale = Math.min(scale, covered);
      extension = Math.max(0, width + HERO_BLEED_RIGHT / 2 - PLATE_W * scale);
    }
    return { headlineTop, shoeY, scale, extension, hairY: shoeY - BODY * scale };
  };
  const fits = (r: ReturnType<typeof solve>) => r.extension < maxExtension && r.hairY >= idealHair - 0.5;

  let gaps = spacious;
  let cardH = idealCardH;
  let result = solve(cardH, gaps);
  if (!fits(result)) {
    gaps = compact;
    result = solve(cardH, gaps);
  }
  while (!fits(result) && cardH > minCardH) {
    cardH -= 2;
    result = solve(cardH, gaps);
  }
  // Last resort on very short (16:9) screens: more foliage, then smaller cards, before her
  // head would leave the screen.
  if (result.hairY < hairFloor) {
    maxExtension = width * 0.3;
    result = solve(cardH, gaps);
  }
  while (result.hairY < hairFloor && cardH > 68) {
    cardH -= 2;
    result = solve(cardH, gaps);
  }
  const { headlineTop, shoeY, scale, extension } = result;
  const hairY = shoeY - BODY * scale;
  const top = hairY - HAIR_TOP * scale;
  const plateHeight = PLATE_H * scale;
  return {
    cardW,
    cardH,
    gaps,
    headlineTop,
    hero: {
      scale,
      left: extension,
      top,
      width: PLATE_W * scale,
      height: plateHeight,
      shoeY,
      hairY,
      extension,
      canvasHeight: Math.min(top + plateHeight, shoeY + 140),
    },
  };
}

/** Hair left edge in screen points; used to keep her clear of the back button. */
export function runnerHairLeft(layout: Screen3Layout): number {
  return layout.hero.left + HAIR_LEFT * layout.hero.scale;
}

export function Screen3Hero({
  layout,
  width,
  onReady,
}: {
  layout: Screen3Layout;
  width: number;
  onReady?: () => void;
}) {
  const image = useImage(screen3Runner);
  const readyReported = React.useRef(false);
  React.useEffect(() => {
    if (image && !readyReported.current) {
      readyReported.current = true;
      onReady?.();
    }
  }, [image, onReady]);

  const { hero } = layout;
  const canvasW = width + HERO_BLEED_LEFT + HERO_BLEED_RIGHT;
  const canvasH = hero.canvasHeight;
  // Canvas-local x of the plate's left edge.
  const seam = HERO_BLEED_LEFT + hero.left;
  // Wide feather + warm vignette: the extension reads as out-of-focus foreground foliage.
  const feather = 40;
  const artifactBottom = hero.top + TOP_ARTIFACT * hero.scale;
  // Mirror the foliage band about a line just inside the plate, so it also sits under the
  // feathered seam, stretched to reach the canvas edge.
  const bandWidth = EDGE_BAND * hero.scale;
  const axis = seam + feather;
  const stretch = Math.max(1, (axis + feather) / bandWidth);

  if (!image) return null;
  const plate = { x: seam, y: hero.top, width: hero.width, height: hero.height };
  return (
    <Canvas style={{ width: canvasW, height: canvasH }} pointerEvents="none">
      {seam > 0 ? (
        <Group clip={{ x: 0, y: 0, width: seam + feather, height: canvasH }}>
          <Group transform={[{ translateX: axis }, { scaleX: -stretch }, { translateX: -seam }]}>
            <SkiaImage image={image} fit="fill" {...plate}>
              <Blur blur={8} mode="clamp" />
            </SkiaImage>
          </Group>
        </Group>
      ) : null}
      <Mask
        mode="alpha"
        mask={
          <Rect x={0} y={0} width={canvasW} height={canvasH}>
            <SkiaLinearGradient
              start={vec(seam, 0)}
              end={vec(seam + (seam > 0 ? feather : 0.01), 0)}
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
            />
          </Rect>
        }
      >
        <SkiaImage image={image} fit="fill" {...plate} />
      </Mask>
      {seam > 0 ? (
        <Rect x={0} y={0} width={seam + feather} height={canvasH}>
          <SkiaLinearGradient
            start={vec(0, 0)}
            end={vec(seam + feather, 0)}
            colors={["rgba(18,12,8,0.35)", "rgba(18,12,8,0)"]}
          />
        </Rect>
      ) : null}
      {artifactBottom > 0 ? (
        // Haze over the soft block at the plate's top edge; ramps in horizontally too so it
        // never draws its own vertical edge near the seam.
        <Mask
          mode="alpha"
          mask={
            <Rect x={0} y={0} width={canvasW} height={Math.max(1, artifactBottom + 24)}>
              <SkiaLinearGradient
                start={vec(seam + feather, 0)}
                end={vec(seam + feather + 48, 0)}
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)"]}
              />
            </Rect>
          }
        >
          <Mask
            mode="alpha"
            mask={
              <Rect x={0} y={0} width={canvasW} height={Math.max(1, artifactBottom + 24)}>
                <SkiaLinearGradient
                  start={vec(0, artifactBottom - 6)}
                  end={vec(0, artifactBottom + 22)}
                  colors={["rgba(0,0,0,1)", "rgba(0,0,0,0)"]}
                />
              </Rect>
            }
          >
            <SkiaImage image={image} fit="fill" {...plate}>
              <Blur blur={10} mode="clamp" />
            </SkiaImage>
          </Mask>
        </Mask>
      ) : null}
    </Canvas>
  );
}
