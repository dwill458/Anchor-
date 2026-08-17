/**
 * SelectedChipGlowRing — Skia pulsing glow ring for the active AnchorStack chip.
 *
 * RingGlowCanvas (used in ThreadStrengthBlock) is a soft ambient halo tuned
 * for a ring with a partly-transparent center; against AnchorStack's fully
 * opaque 60px chip that halo mostly hides behind the chip itself and reads
 * as invisible. This draws an explicit blurred+core stroke circle just
 * outside the chip's edge so the pulse is unmistakable at a glance.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurStyle, Canvas, PaintStyle, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

interface SelectedChipGlowRingProps {
  /** Side length of the square canvas in logical px. */
  size: number;
  /** Radius (in canvas px) the ring pulses around. */
  ringRadius: number;
  /** Hex colour, e.g. '#F2DFA8'. */
  color: string;
  reduceMotionEnabled?: boolean;
  /**
   * 0–1 multiplier on alpha, stroke width, and pulse reach. Lets a caller tie
   * the ring's prominence to something like Thread Strength. A floor keeps it
   * from fully disappearing at 0. Defaults to 1 (full strength).
   */
  intensity?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const SelectedChipGlowRing: React.FC<SelectedChipGlowRingProps> = ({
  size,
  ringRadius,
  color,
  reduceMotionEnabled = false,
  intensity = 1,
}) => {
  // 0.25 floor keeps the ring from disappearing entirely at intensity 0.
  const strengthFactor = 0.25 + 0.75 * Math.min(Math.max(intensity, 0), 1);
  const [r, g, b] = useMemo(() => hexToRgb(color), [color]);
  const time = useSharedValue(0);

  useFrameCallback((info) => {
    if (!reduceMotionEnabled && info.timeSincePreviousFrame != null) {
      time.value += info.timeSincePreviousFrame / 1000;
    }
  }, !reduceMotionEnabled);

  // Pre-allocated paints — zero per-frame allocations
  const paints = useMemo(() => {
    const glow = Skia.Paint();
    glow.setStyle(PaintStyle.Stroke);
    glow.setAntiAlias(true);
    glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 5, false));

    const core = Skia.Paint();
    core.setStyle(PaintStyle.Stroke);
    core.setAntiAlias(true);

    return { glow, core };
  }, []);

  const picture = useDerivedValue(() => {
    const t = reduceMotionEnabled ? 0.5 : time.value;
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5; // 0..1 breathing
    const cx = size / 2;
    const cy = size / 2;
    const rad = ringRadius + pulse * 4 * strengthFactor;

    const recorder = Skia.PictureRecorder();
    const cnv = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));

    paints.glow.setColor(Skia.Color(`rgba(${r},${g},${b},${(0.45 + pulse * 0.45) * strengthFactor})`));
    paints.glow.setStrokeWidth((6 + pulse * 4) * strengthFactor);
    cnv.drawCircle(cx, cy, rad, paints.glow);

    paints.core.setColor(Skia.Color(`rgba(${r},${g},${b},${(0.65 + pulse * 0.35) * strengthFactor})`));
    paints.core.setStrokeWidth(1 + strengthFactor);
    cnv.drawCircle(cx, cy, rad, paints.core);

    return recorder.finishRecordingAsPicture();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
};
