/**
 * ChargedGlowCanvas — Skia GPU per-frame gold glow for charged anchors.
 *
 * Exact port of ChargedAnchorCard.jsx web canvas animation via
 * @shopify/react-native-skia.  useFrameCallback advances a shared-value
 * timer each frame; useDerivedValue records a new SkPicture with every tick.
 *
 * Layers (in paint order):
 *   1. Outer heavenly halo          — radial gradient
 *   2. Inner divine glow            — radial gradient, radius + opacity pulse
 *   3. 12 sacred rays               — linear gradient stroke, per-ray flicker
 *   4. Outer ring 24 dots           — CW at 0.3 rad/s, per-dot sin glow
 *   5. Inner ring 16 dots           — CCW at 0.5 rad/s, per-dot sin glow
 *   6. 60 floating gold particles   — individual angle/drift/speed/size/opacity
 *      └ sparkle cross if size>1.8 && flicker>0.6
 *   7. 5 ascending light streaks    — sin(phase·π) alpha envelope
 *
 * All geometry is scaled by size/280 to match the 280×280 reference canvas.
 */
import React, { useCallback, useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Picture,
  PaintStyle,
  Skia,
  TileMode,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

interface ChargedGlowCanvasProps {
  /** Hint for initial draw size; actual size is measured via onLayout. */
  size: number;
  reduceMotionEnabled?: boolean;
}

export const ChargedGlowCanvas: React.FC<ChargedGlowCanvasProps> = ({
  size,
  reduceMotionEnabled = false,
}) => {
  // Actual measured canvas width — updated by onLayout so cx/cy are exact.
  // Initialised from the hint so the first frame is already correct.
  const canvasW = useSharedValue(size);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      canvasW.value = e.nativeEvent.layout.width;
    },
    [canvasW],
  );

  // ── One-time particle initialisation (runs on mount) ─────────────────────
  const particlesInit = useMemo(
    () =>
      Array.from({ length: 60 }, () => ({
        angle:      Math.random() * Math.PI * 2,
        radius:     60 + Math.random() * 60,
        // Convert from "radians per frame at 60fps" → radians per second
        speed:      (0.002 + Math.random() * 0.004) * 60,
        size:       0.8  + Math.random() * 2.2,
        opacity:    0.3  + Math.random() * 0.7,
        drift:      Math.random() * Math.PI * 2,
        driftSpeed: (0.01 + Math.random() * 0.02) * 60,
      })),
    [],
  );

  const raysInit = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        angle: Math.random() * Math.PI * 2,
        len:   80 + Math.random() * 50,
        width: 1  + Math.random() * 2,
        speed: (0.003 + Math.random() * 0.003) * 60,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  // ── Time shared value — incremented each frame by useFrameCallback ────────
  const time = useSharedValue(0);

  useFrameCallback((info) => {
    if (info.timeSincePreviousFrame != null) {
      time.value += info.timeSincePreviousFrame / 1000; // ms → s
    }
  }, !reduceMotionEnabled);

  // ── Per-frame SkPicture — re-recorded whenever time advances ─────────────
  const picture = useDerivedValue(() => {
    const t  = time.value;
    // Use the live-measured width so cx/cy are always exact, even if the
    // computed hint differed from the actual layout by a border pixel or two.
    const W  = canvasW.value;
    const s  = W > 0 ? W / 280 : 1;  // scale: reference canvas was 280×280
    const cx = W / 2;
    const cy = W / 2;
    const PI = Math.PI;
    const DEG = 180 / PI;   // multiply radians → degrees for Skia rotate()

    const recorder = Skia.PictureRecorder();
    // Record into the exact measured bounds so nothing is clipped or shifted.
    const cnv = recorder.beginRecording(Skia.XYWHRect(0, 0, W > 0 ? W : 1, W > 0 ? W : 1));

    // ── 1. Outer heavenly halo (drawn twice for additive intensity) ──────────
    for (let pass = 0; pass < 2; pass++) {
      const shader = Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy },
        160 * s,
        [
          Skia.Color('rgba(255,215,80,0.42)'),
          Skia.Color('rgba(255,180,30,0.20)'),
          Skia.Color('rgba(255,150,0,0)'),
        ],
        [0, 0.5, 1],
        TileMode.Clamp,
      );
      const p = Skia.Paint();
      p.setShader(shader);
      cnv.drawCircle(cx, cy, 160 * s, p);
    }

    // ── 2. Pulsing inner divine glow ──────────────────────────────────────
    {
      const pulse  = 0.7 + Math.sin(t * 1.8) * 0.3;
      const r      = 105 * pulse * s;
      const shader = Skia.Shader.MakeRadialGradient(
        { x: cx, y: cy },
        r,
        [
          Skia.Color(`rgba(255,245,130,${0.72 * pulse})`),
          Skia.Color(`rgba(255,210,60,${0.45  * pulse})`),
          Skia.Color(`rgba(255,170,0,${0.18   * pulse})`),
          Skia.Color('rgba(255,120,0,0)'),
        ],
        [0, 0.4, 0.8, 1],
        TileMode.Clamp,
      );
      const p = Skia.Paint();
      p.setShader(shader);
      cnv.drawCircle(cx, cy, r, p);
    }

    // ── 3. Sacred rays — linear gradient stroke, per-ray phase flicker ────
    raysInit.forEach((ray) => {
      const rayPulse = 0.4 + Math.sin(t * 1.2 + ray.phase) * 0.6;
      const angle    = ray.angle + t * ray.speed;
      const x2       = cx + Math.cos(angle) * ray.len * s;
      const y2       = cy + Math.sin(angle) * ray.len * s;

      const shader = Skia.Shader.MakeLinearGradient(
        { x: cx, y: cy },
        { x: x2, y: y2 },
        [
          Skia.Color(`rgba(255,235,110,${0.85 * rayPulse})`),
          Skia.Color(`rgba(255,205,55,${0.45  * rayPulse})`),
          Skia.Color('rgba(255,170,0,0)'),
        ],
        [0, 0.55, 1],
        TileMode.Clamp,
      );
      const p = Skia.Paint();
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(ray.width * rayPulse * s * 1.6);
      p.setShader(shader);
      cnv.drawLine(cx, cy, x2, y2, p);
    });

    // ── 4. Outer rotating ring: 24 dots — CW 0.3 rad/s ───────────────────
    cnv.save();
    cnv.translate(cx, cy);
    cnv.rotate(t * 0.3 * DEG, 0, 0);
    for (let i = 0; i < 24; i++) {
      const a    = (i / 24) * PI * 2;
      const glow = 0.5 + Math.sin(t * 2 + i * 0.5) * 0.5;
      const p    = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(`rgba(255,225,90,${glow})`));
      cnv.drawCircle(Math.cos(a) * 118 * s, Math.sin(a) * 118 * s, 3.5 * s, p);
    }
    cnv.restore();

    // ── 5. Inner counter-rotating ring: 16 dots — CCW 0.5 rad/s ──────────
    cnv.save();
    cnv.translate(cx, cy);
    cnv.rotate(-t * 0.5 * DEG, 0, 0);
    for (let i = 0; i < 16; i++) {
      const a    = (i / 16) * PI * 2;
      const glow = 0.55 + Math.sin(t * 3 + i * 0.8) * 0.45;
      const p    = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(`rgba(255,245,130,${glow})`));
      cnv.drawCircle(Math.cos(a) * 88 * s, Math.sin(a) * 88 * s, 2.5 * s, p);
    }
    cnv.restore();

    // ── 6. 60 floating gold particles ─────────────────────────────────────
    particlesInit.forEach((pt) => {
      const angle   = pt.angle + pt.speed * t;
      const drift   = pt.drift + pt.driftSpeed * t;
      const wobble  = Math.sin(drift) * 8 * s;
      const r       = pt.radius * s + wobble;
      const px      = cx + Math.cos(angle) * r;
      const py      = cy + Math.sin(angle) * r;
      const flicker = 0.4 + Math.abs(Math.sin(t * 2 + angle * 3)) * 0.6;
      const alpha   = Math.min(1, pt.opacity * flicker * 1.4);

      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(`rgba(255,235,110,${alpha})`));
      cnv.drawCircle(px, py, pt.size * s * 1.35, p);

      // Sparkle cross on larger, brighter particles
      if (pt.size > 1.8 && flicker > 0.55) {
        const spark = 5 * s;
        const sp    = Skia.Paint();
        sp.setStyle(PaintStyle.Stroke);
        sp.setStrokeWidth(0.8 * s);
        sp.setColor(Skia.Color(`rgba(255,255,200,${alpha})`));
        cnv.drawLine(px - spark, py,        px + spark, py,        sp);
        cnv.drawLine(px,         py - spark, px,        py + spark, sp);
      }
    });

    // ── 7. Ascending light streaks ─────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      const streakPhase = (t * 0.4 + i * 0.7) % 1;
      const streakAngle = (i / 5) * PI * 2 + t * 0.1;
      const streakR     = (70 + i * 10) * s;
      const sx          = cx + Math.cos(streakAngle) * streakR;
      const sy          = cy + Math.sin(streakAngle) * streakR;
      const alpha       = Math.sin(streakPhase * PI) * 0.9;

      if (alpha > 0.01) {
        const len20  = 28 * s;
        const yTop   = sy - len20 * streakPhase;
        const yBot   = sy + len20 * (1 - streakPhase);
        const shader = Skia.Shader.MakeLinearGradient(
          { x: sx, y: yTop },
          { x: sx, y: yBot },
          [
            Skia.Color('rgba(255,245,150,0)'),
            Skia.Color(`rgba(255,235,110,${alpha})`),
            Skia.Color('rgba(255,200,60,0)'),
          ],
          [0, 0.5, 1],
          TileMode.Clamp,
        );
        const p = Skia.Paint();
        p.setStyle(PaintStyle.Stroke);
        p.setStrokeWidth(2.5 * s);
        p.setShader(shader);
        cnv.drawLine(sx, sy - len20, sx, sy + len20, p);
      }
    }

    return recorder.finishRecordingAsPicture();
  });

  return (
    // onLayout measures the actual rendered size so the worklet cx/cy are exact.
    // Both the wrapper and Canvas use absoluteFill — no explicit w/h needed.
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={handleLayout}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
};
