/**
 * PrimeAnchorCanvas — single-pass Skia hero for the Prime (ChargeSetup) screen.
 *
 * Draws in one GPU pass with zero per-frame JS allocations:
 *   • Pulsing radial aura
 *   • Concentric rings (solid + dashed + accent)
 *   • Floating ember particles
 *   • Sigil: dual-layer glow (broad σ20 outer + sharp σ5 filament) + solid stroke
 *
 * All animation runs on the UI thread via Reanimated useDerivedValue.
 * Paints are pre-allocated in useMemo; particles use deterministic arithmetic.
 *
 * Burn/release integration: pass trimStart/trimEnd SharedValues to drive a
 * TrimPathEffect that "burns away" the sigil lines from end → start.
 */
import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  BlurStyle,
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import type { PerformanceTier } from '@/hooks/usePerformanceTier';

// ── Palette ──────────────────────────────────────────────────────────────────
const GR = 212;
const GG = 175;
const GB = 55; // #D4AF37 gold

// ── Constants ─────────────────────────────────────────────────────────────────
const PARTICLE_COUNT = Platform.OS === 'android' ? 22 : 34;
const DASHED_SEGMENTS = 44; // must be even

// Concentric ring radii as fraction of (size / 2)
const RING_FRACS = [0.72, 0.86, 1.0, 1.14, 1.28];

interface ParticleInit {
  normX: number;   // position relative to canvas center, −0.4..0.4
  speed: number;   // px/s
  radius: number;
  phase: number;   // time start offset
  flicker: number; // unique frequency
}

export interface PrimeAnchorCanvasProps {
  /** Side length of the square canvas in logical pixels. */
  size: number;
  /**
   * SVG path 'd' strings extracted from the sigil SVG.
   * Pass [] when showing an enhanced image instead.
   */
  sigilPaths?: string[];
  /** ViewBox from the sigil SVG, defaults to { x:0, y:0, w:240, h:240 }. */
  viewBox?: { x: number; y: number; w: number; h: number };
  /**
   * Vertical drift offset (Reanimated SharedValue, px).
   * Drives the gentle float animation on the sigil + rings.
   */
  drift?: SharedValue<number>;
  reduceMotionEnabled?: boolean;
  tier?: PerformanceTier;
  /**
   * Path-trim range for the burn/disintegrate animation.
   * Animate trimEnd from 1 → 0 while spawning ember particles to match.
   * Default: trimStart=0, trimEnd=1 (full path, no effect).
   */
  trimStart?: SharedValue<number>;
  trimEnd?: SharedValue<number>;
}

// ── SVG parsing helper ────────────────────────────────────────────────────────
/** Extracts all <path d="..."> strings and the viewBox from an SVG string. */
export function parseSigilSvg(svgString: string): {
  viewBox: { x: number; y: number; w: number; h: number };
  pathDs: string[];
} {
  const vbMatch = svgString.match(/viewBox=["']([^"']+)["']/);
  const vb = vbMatch ? vbMatch[1].split(/[\s,]+/).map(Number) : [0, 0, 240, 240];

  const pathDs: string[] = [];
  // Match both d="..." and d='...'
  const re = /<path[^>]+\sd=["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svgString)) !== null) {
    pathDs.push(m[1]);
  }
  return {
    viewBox: { x: vb[0] ?? 0, y: vb[1] ?? 0, w: vb[2] ?? 240, h: vb[3] ?? 240 },
    pathDs,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export const PrimeAnchorCanvas: React.FC<PrimeAnchorCanvasProps> = ({
  size,
  sigilPaths = [],
  viewBox = { x: 0, y: 0, w: 240, h: 240 },
  drift,
  reduceMotionEnabled = false,
  tier = 'high',
  trimStart,
  trimEnd,
}) => {
  const frozen = tier === 'medium' || reduceMotionEnabled;
  const suppressed = tier === 'low';

  // Internal fallback SharedValues — used when props are omitted
  const _drift = useSharedValue(0);
  const _trimStart = useSharedValue(0);
  const _trimEnd = useSharedValue(1);
  const activeDrift = drift ?? _drift;
  const activeTrimStart = trimStart ?? _trimStart;
  const activeTrimEnd = trimEnd ?? _trimEnd;

  // Keep fallback trim values current if props arrive later
  useEffect(() => { if (!trimStart) _trimStart.value = 0; }, [trimStart, _trimStart]);
  useEffect(() => { if (!trimEnd) _trimEnd.value = 1; }, [trimEnd, _trimEnd]);

  // ── Sigil paths (viewBox coords — canvas transform applied at draw time) ────
  // Stable for the component's lifetime (same anchor never swaps paths mid-mount).
  const skPaths = useMemo(() => {
    if (!sigilPaths.length) return [];
    return sigilPaths.flatMap((d) => {
      const p = Skia.Path.MakeFromSVGString(d);
      return p ? [p] : [];
    });
  }, [sigilPaths]);

  // Canvas-space transform for sigil: centre it and fill 72% of the canvas.
  // Plain object — serialised to UI thread once when useDerivedValue is created.
  const sigilXform = useMemo(() => {
    if (!sigilPaths.length) return null;
    const s = Math.min(size / viewBox.w, size / viewBox.h) * 0.72;
    return {
      tx: (size - viewBox.w * s) / 2 - viewBox.x * s,
      ty: (size - viewBox.h * s) / 2 - viewBox.y * s,
      scale: s,
    };
  }, [sigilPaths.length, size, viewBox.w, viewBox.h, viewBox.x, viewBox.y]);

  // ── Pre-bake dashed ring (Skia Path, created once) ───────────────────────
  const dashedRingPath = useMemo(() => {
    const r = (size / 2) * RING_FRACS[1];
    const cx = size / 2;
    const cy = size / 2;
    const path = Skia.Path.Make();
    for (let i = 0; i < DASHED_SEGMENTS; i += 2) {
      const startDeg = (i / DASHED_SEGMENTS) * 360;
      const sweepDeg = (0.55 / DASHED_SEGMENTS) * 360;
      path.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), startDeg, sweepDeg);
    }
    return path;
  }, [size]);

  // ── Stable particle seed data ─────────────────────────────────────────────
  const particlesInit = useMemo<ParticleInit[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        normX: (Math.random() - 0.5) * 0.8,
        speed: 18 + Math.random() * 26,
        radius: 1.1 + Math.random() * 2.0,
        phase: Math.random() * 90,
        flicker: 2.2 + Math.random() * 2.2,
      })),
    // Intentional empty deps: seed data must never change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Pre-allocate all Paint objects ────────────────────────────────────────
  const paints = useMemo(() => {
    const ring = Skia.Paint();
    ring.setStyle(PaintStyle.Stroke);
    ring.setStrokeWidth(1);
    ring.setAntiAlias(true);

    const ringAccent = Skia.Paint();
    ringAccent.setStyle(PaintStyle.Stroke);
    ringAccent.setStrokeWidth(1.2);
    ringAccent.setAntiAlias(true);

    const aura = Skia.Paint();
    aura.setAntiAlias(true);

    const embers = Array.from({ length: PARTICLE_COUNT }, () => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      return p;
    });

    // Sigil Layer A — broad outer glow (σ=20, respectCTM=false → fixed screen px)
    const sigilOuter = Skia.Paint();
    sigilOuter.setStyle(PaintStyle.Stroke);
    sigilOuter.setStrokeWidth(10);
    sigilOuter.setAntiAlias(true);
    sigilOuter.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 20, false));

    // Sigil Layer B — tight filament glow (σ=5)
    const sigilInner = Skia.Paint();
    sigilInner.setStyle(PaintStyle.Stroke);
    sigilInner.setStrokeWidth(4);
    sigilInner.setAntiAlias(true);
    sigilInner.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 5, false));

    // Sigil Layer C — solid visible stroke
    const sigilSolid = Skia.Paint();
    sigilSolid.setStyle(PaintStyle.Stroke);
    sigilSolid.setStrokeWidth(2);
    sigilSolid.setAntiAlias(true);

    return { ring, ringAccent, aura, embers, sigilOuter, sigilInner, sigilSolid };
  }, []);

  // ── Animation clock ────────────────────────────────────────────────────────
  const time = useSharedValue(0);
  useFrameCallback((info) => {
    if (info.timeSincePreviousFrame != null) {
      time.value += info.timeSincePreviousFrame / 1000;
    }
  }, !frozen && !suppressed);

  // ── Master draw pass (UI thread) ──────────────────────────────────────────
  const picture = useDerivedValue(() => {
    const t = time.value;
    const W = size;
    const cx = W / 2;
    const cy = W / 2;
    const driftY = activeDrift.value;
    const tS = activeTrimStart.value;
    const tE = activeTrimEnd.value;

    const recorder = Skia.PictureRecorder();
    const cnv = recorder.beginRecording(Skia.XYWHRect(0, 0, W, W));

    // 1 ── Radial aura (slow pulse) ────────────────────────────────────────────
    {
      const pulse = 0.7 + Math.sin(t * 0.68) * 0.3;
      const auraR = W * 0.5 * pulse;
      const shader = Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy + driftY * 0.25 },
        auraR,
        [
          Skia.Color(`rgba(${GR},${GG},${GB},${(0.17 * pulse).toFixed(3)})`),
          Skia.Color(`rgba(${GR},${GG},${GB},${(0.07 * pulse).toFixed(3)})`),
          Skia.Color(`rgba(${GR},${GG},${GB},0)`),
        ],
        [0, 0.5, 1],
        TileMode.Clamp,
      );
      paints.aura.setShader(shader);
      cnv.drawCircle(cx, cy + driftY * 0.25, auraR, paints.aura);
    }

    // 2 ── Concentric rings ────────────────────────────────────────────────────
    const ringCY = cy + driftY * 0.5;
    for (let i = 0; i < RING_FRACS.length; i++) {
      const r = (W / 2) * RING_FRACS[i];
      if (i === 1) {
        // Dashed ring
        paints.ring.setColor(Skia.Color(`rgba(${GR},${GG},${GB},0.14)`));
        cnv.save();
        cnv.translate(0, driftY * 0.5);
        cnv.drawPath(dashedRingPath, paints.ring);
        cnv.restore();
      } else if (i === 2) {
        // Accent ring — pulses slightly
        const alpha = (0.16 + Math.sin(t * 1.1) * 0.06).toFixed(3);
        paints.ringAccent.setColor(Skia.Color(`rgba(${GR},${GG},${GB},${alpha})`));
        cnv.drawCircle(cx, ringCY, r, paints.ringAccent);
      } else {
        paints.ring.setColor(Skia.Color(`rgba(${GR},${GG},${GB},0.10)`));
        cnv.drawCircle(cx, ringCY, r, paints.ring);
      }
    }

    // 3 ── Ember particles (float upward, fade out) ────────────────────────────
    const travelH = W * 0.62;
    const originY = cy + W * 0.22 + driftY;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particlesInit[i];
      const elapsed = ((t + p.phase) * p.speed) % travelH;
      const normT = elapsed / travelH;
      // Sharp fade-in, gentle fade-out
      const alpha = Math.min(normT * 6, 1) * Math.max(1 - normT * 1.25, 0);
      if (alpha < 0.015) continue;
      const flickerAlpha = alpha * (0.5 + Math.sin(t * p.flicker + p.phase) * 0.5);
      paints.embers[i].setColor(
        Skia.Color(`rgba(240,203,85,${flickerAlpha.toFixed(3)})`),
      );
      const px = cx + p.normX * W + Math.sin(t * 0.42 + i * 0.63) * 8;
      const py = originY - elapsed;
      cnv.drawCircle(px, py, p.radius, paints.embers[i]);
    }

    // 4 ── Sigil (dual-layer glow + solid stroke) ──────────────────────────────
    if (skPaths.length > 0 && sigilXform !== null) {
      const glowPulse = 0.5 + Math.sin(t * 0.88) * 0.5;
      const isTrimmed = tS > 0.001 || tE < 0.999;

      // Apply trim path-effect only during burn animation (allocates, so guarded)
      if (isTrimmed) {
        // @ts-expect-error MakeTrim missing from installed Skia version types
        const fx = Skia.PathEffect.MakeTrim(tS, tE, false);
        paints.sigilOuter.setPathEffect(fx);
        paints.sigilInner.setPathEffect(fx);
        paints.sigilSolid.setPathEffect(fx);
      } else {
        paints.sigilOuter.setPathEffect(null);
        paints.sigilInner.setPathEffect(null);
        paints.sigilSolid.setPathEffect(null);
      }

      cnv.save();
      // Map viewBox coords → canvas space + vertical drift
      cnv.translate(sigilXform.tx, sigilXform.ty + driftY);
      cnv.scale(sigilXform.scale, sigilXform.scale);

      for (let pi = 0; pi < skPaths.length; pi++) {
        const path = skPaths[pi];

        // Layer A — broad outer glow
        paints.sigilOuter.setColor(
          Skia.Color(`rgba(${GR},${GG},${GB},${(glowPulse * 0.52).toFixed(3)})`),
        );
        cnv.drawPath(path, paints.sigilOuter);

        // Layer B — tight filament glow
        paints.sigilInner.setColor(
          Skia.Color(`rgba(240,203,85,${(glowPulse * 0.92).toFixed(3)})`),
        );
        cnv.drawPath(path, paints.sigilInner);

        // Layer C — solid visible stroke (bone/silver, always legible)
        paints.sigilSolid.setColor(
          Skia.Color(`rgba(245,245,220,${(0.42 + glowPulse * 0.48).toFixed(3)})`),
        );
        cnv.drawPath(path, paints.sigilSolid);
      }

      cnv.restore();
    }

    return recorder.finishRecordingAsPicture();
  });

  if (suppressed) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
};
