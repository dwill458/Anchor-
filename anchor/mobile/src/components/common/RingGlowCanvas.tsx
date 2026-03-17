/**
 * RingGlowCanvas — compact Skia glow for the ThreadStrengthBlock ring.
 *
 * Designed for ~76px canvas around a 52px ring. Accepts `color` (hex) and
 * `intensity` (0–1) so the glow can be tinted and scaled to thread strength.
 *
 * Effects: radial halo · pulsing inner glow · 8 rotating dots.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Canvas, Picture, PaintStyle, Skia, TileMode } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

interface RingGlowCanvasProps {
  /** Hint for initial canvas size; actual size measured via onLayout. */
  size: number;
  /** Hex colour string e.g. '#D4AF37'. */
  color: string;
  /** 0–1. At 0 the canvas draws nothing. */
  intensity: number;
  reduceMotionEnabled?: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export const RingGlowCanvas: React.FC<RingGlowCanvasProps> = ({
  size,
  color,
  intensity,
  reduceMotionEnabled = false,
}) => {
  const canvasW = useSharedValue(size);
  const svR = useSharedValue(0);
  const svG = useSharedValue(0);
  const svB = useSharedValue(0);
  const svIntensity = useSharedValue(intensity);

  // Sync colour prop → shared values
  useEffect(() => {
    const [r, g, b] = hexToRgb(color);
    svR.value = r;
    svG.value = g;
    svB.value = b;
  }, [color, svR, svG, svB]);

  // Sync intensity prop → shared value
  useEffect(() => {
    svIntensity.value = intensity;
  }, [intensity, svIntensity]);

  // Initialise colour immediately (avoids one-frame black flash)
  useMemo(() => {
    const [r, g, b] = hexToRgb(color);
    svR.value = r;
    svG.value = g;
    svB.value = b;
    svIntensity.value = intensity;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      canvasW.value = e.nativeEvent.layout.width;
    },
    [canvasW],
  );

  // Pre-allocate Paint objects — zero per-frame allocations
  const paints = useMemo(() => ({
    halo: Skia.Paint(),
    innerGlow: Skia.Paint(),
    dots: Array.from({ length: 8 }, () => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      return p;
    }),
  }), []);

  const time = useSharedValue(0);

  useFrameCallback((info) => {
    if (info.timeSincePreviousFrame != null) {
      time.value += info.timeSincePreviousFrame / 1000;
    }
  }, !reduceMotionEnabled);

  const picture = useDerivedValue(() => {
    const W = canvasW.value;
    const cx = W / 2;
    const cy = W / 2;
    // Scale factor: designed at 76px reference size
    const s = W > 0 ? W / 76 : 1;
    const ity = svIntensity.value;
    const rr = svR.value;
    const gg = svG.value;
    const bb = svB.value;
    const t = time.value;

    const safeW = W > 0 ? W : 1;
    const recorder = Skia.PictureRecorder();
    const cnv = recorder.beginRecording(Skia.XYWHRect(0, 0, safeW, safeW));

    if (ity > 0.01) {
      // ── 1. Outer radial halo ──────────────────────────────────────────────
      {
        const shader = Skia.Shader.MakeRadialGradient(
          { x: cx, y: cy },
          38 * s,
          [
            Skia.Color(`rgba(${rr},${gg},${bb},${0.38 * ity})`),
            Skia.Color(`rgba(${rr},${gg},${bb},${0.14 * ity})`),
            Skia.Color(`rgba(${rr},${gg},${bb},0)`),
          ],
          [0, 0.55, 1],
          TileMode.Clamp,
        );
        const p = paints.halo;
        p.setShader(shader);
        cnv.drawCircle(cx, cy, 38 * s, p);
      }

      // ── 2. Pulsing inner glow ─────────────────────────────────────────────
      {
        const pulse = 0.72 + Math.sin(t * 1.8) * 0.28;
        const rad = 20 * pulse * s;
        const shader = Skia.Shader.MakeRadialGradient(
          { x: cx, y: cy },
          rad,
          [
            Skia.Color(`rgba(${rr},${gg},${bb},${0.65 * pulse * ity})`),
            Skia.Color(`rgba(${rr},${gg},${bb},${0.22 * pulse * ity})`),
            Skia.Color(`rgba(${rr},${gg},${bb},0)`),
          ],
          [0, 0.6, 1],
          TileMode.Clamp,
        );
        const p = paints.innerGlow;
        p.setShader(shader);
        cnv.drawCircle(cx, cy, rad, p);
      }

      // ── 3. 8 rotating dots at ~50% canvas radius ──────────────────────────
      const DEG = 180 / Math.PI;
      cnv.save();
      cnv.translate(cx, cy);
      cnv.rotate(t * 22 * DEG, 0, 0); // ~22 deg/s CW
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const flicker = (0.45 + Math.sin(t * 2.2 + i * 0.9) * 0.55) * ity;
        const p = paints.dots[i];
        p.setColor(Skia.Color(`rgba(${rr},${gg},${bb},${flicker})`));
        cnv.drawCircle(Math.cos(a) * 28 * s, Math.sin(a) * 28 * s, 1.8 * s, p);
      }
      cnv.restore();
    }

    return recorder.finishRecordingAsPicture();
  });

  return (
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
