import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Canvas, Picture, PaintStyle, Skia, TileMode } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '@/theme';
import type { PerformanceTier } from '@/hooks/usePerformanceTier';

const clamp01 = (v: number): number => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

const TAU = Math.PI * 2;

interface DivineSigilAuraProps {
  size: number;
  enabled: boolean;
  reduceMotionEnabled?: boolean;
  breath?: SharedValue<number>;
  /**
   * Rendering budget. `'low'` disables the canvas (use BakedGlow in the
   * parent instead). `'medium'` keeps the SkPicture but halts spin/pulse
   * animations so the GPU renders once on layout and then sleeps.
   */
  tier?: PerformanceTier;
}

interface RaySeed {
  angle: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
}

interface ParticleSeed {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  opacity: number;
  drift: number;
  driftSpeed: number;
  sparkle: boolean;
}

interface StreakSeed {
  angle: number;
  radius: number;
  length: number;
  offset: number;
}

const seeded = (seed: number): number => {
  const value = Math.sin(seed * 43758.5453123) * 143758.5453;
  return value - Math.floor(value);
};

const buildRaySeeds = (count: number): RaySeed[] =>
  Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * TAU,
    length: 0.58 + seeded(i + 11) * 0.34,
    width: 0.8 + seeded(i + 31) * 1.8,
    speed: 0.08 + seeded(i + 71) * 0.16,
    opacity: 0.36 + seeded(i + 107) * 0.44,
  }));

const buildParticles = (count: number): ParticleSeed[] =>
  Array.from({ length: count }, (_, i) => ({
    angle: seeded(i + 17) * TAU,
    radius: 0.22 + seeded(i + 41) * 0.34,
    speed: 0.35 + seeded(i + 97) * 0.9,
    size: 0.8 + seeded(i + 199) * 2.1,
    opacity: 0.3 + seeded(i + 283) * 0.7,
    drift: seeded(i + 353) * TAU,
    driftSpeed: 0.4 + seeded(i + 421) * 1.25,
    sparkle: seeded(i + 557) > 0.74,
  }));

const buildStreaks = (count: number): StreakSeed[] =>
  Array.from({ length: count }, (_, i) => ({
    angle: seeded(i + 211) * TAU,
    radius: 0.32 + seeded(i + 263) * 0.16,
    length: 10 + seeded(i + 317) * 14,
    offset: seeded(i + 401),
  }));

export const DivineSigilAura: React.FC<DivineSigilAuraProps> = ({
  size,
  enabled,
  reduceMotionEnabled = false,
  breath,
  tier = 'high',
}) => {
  const tierSuppressed = tier === 'low';
  const tierFrozen = tier === 'medium';
  const fallbackBreath = useSharedValue(0);
  const spinSlow = useSharedValue(0);
  const spinFast = useSharedValue(0);
  const ascendProgress = useSharedValue(0);
  const pulse = breath ?? fallbackBreath;

  // Keep iOS below the old 48-particle budget so scroll-driven compositing on
  // AnchorDetail has more GPU headroom while preserving the same aura shape.
  const particleCount = Platform.OS === 'android' ? 24 : 36;
  const rayCount = Platform.OS === 'android' ? 8 : 12;

  const rays = useMemo(() => buildRaySeeds(rayCount), [rayCount]);
  const particles = useMemo(() => buildParticles(particleCount), [particleCount]);
  const streaks = useMemo(() => buildStreaks(5), []);

  const animationsEnabled =
    enabled &&
    !reduceMotionEnabled &&
    !tierFrozen &&
    !tierSuppressed &&
    process.env.NODE_ENV !== 'test';
  const center = size / 2;
  const maxRadius = size * 0.48;

  // ── Pre-allocate all Paint objects — zero per-frame allocations ────────────
  const paints = useMemo(() => {
    const fill = () => Skia.Paint();
    const stroke = () => {
      const p = Skia.Paint();
      p.setStyle(PaintStyle.Stroke);
      return p;
    };
    const aa = () => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      return p;
    };
    const aaStroke = () => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setStyle(PaintStyle.Stroke);
      return p;
    };
    return {
      haloOuter: fill(),
      haloInner: fill(),
      rays: Array.from({ length: rays.length }, stroke),
      outerDots: Array.from({ length: 24 }, aa),
      innerDots: Array.from({ length: 16 }, aa),
      particles: Array.from({ length: particleCount }, aa),
      sparkles: Array.from({ length: particleCount }, aaStroke),
      streaks: Array.from({ length: 5 }, stroke),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rays.length, particleCount]);

  // ── Pre-allocate color buffers — avoids Skia.Color() calls inside worklets ─
  // Calling Skia.Color() inside useDerivedValue corrupts the JSI Float32Array
  // buffer on the worklet thread (RNSkia 2.x). Pre-cache here; mutate only
  // the alpha component ([3]) in the worklet, matching ChargedGlowCanvas.
  const cachedColors = useMemo(() => ({
    haloOuter: [Skia.Color(`${colors.gold}55`), Skia.Color('rgba(0,0,0,0)')],
    haloInner: [Skia.Color('rgba(255,220,110,0.9)'), Skia.Color('rgba(0,0,0,0)')],
    rays: Array.from({ length: rays.length }, () => Skia.Color('rgba(255,218,122,1)')),
    outerDots: Array.from({ length: 24 }, () => Skia.Color('rgba(255,224,125,1)')),
    innerDots: Array.from({ length: 16 }, () => Skia.Color('rgba(255,224,125,1)')),
    particles: Array.from({ length: particleCount }, () => Skia.Color('rgba(255,232,163,1)')),
    sparkles: Array.from({ length: particleCount }, () => Skia.Color('rgba(255,245,204,1)')),
    streaks: Array.from({ length: 5 }, () => Skia.Color('rgba(255,228,156,1)')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rays.length, particleCount]);

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || reduceMotionEnabled || tierSuppressed || process.env.NODE_ENV === 'test') {
      cancelAnimation(spinSlow);
      cancelAnimation(spinFast);
      cancelAnimation(ascendProgress);
      spinSlow.value = 0;
      spinFast.value = 0;
      ascendProgress.value = 0;
      if (!breath) {
        cancelAnimation(fallbackBreath);
        fallbackBreath.value = 0;
      }
      return;
    }

    if (tierFrozen) {
      cancelAnimation(spinSlow);
      cancelAnimation(spinFast);
      cancelAnimation(ascendProgress);
      if (!breath) {
        cancelAnimation(fallbackBreath);
      }
      return;
    }

    if (!breath) {
      fallbackBreath.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
    }

    spinSlow.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.linear }),
      -1,
      false
    );
    spinFast.value = withRepeat(
      withTiming(1, { duration: 15000, easing: Easing.linear }),
      -1,
      false
    );
    ascendProgress.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(spinSlow);
      cancelAnimation(spinFast);
      cancelAnimation(ascendProgress);
      if (!breath) {
        cancelAnimation(fallbackBreath);
        fallbackBreath.value = 0;
      }
    };
  }, [animationsEnabled, breath, fallbackBreath, spinSlow, spinFast, ascendProgress]);

  // ── Single SkPicture worklet — replaces 100+ individual React components ──
  // rays/particles/streaks/cachedColors are serialized to worklet thread once.
  // paints and cachedColors are Skia JSI HostObjects transferred safely.
  // Alpha is mutated on pre-cached Float32Array buffers (no Skia.Color() in
  // the worklet) to avoid JSI buffer corruption on RNSkia 2.x worklet threads.
  const picture = useDerivedValue(() => {
    const sl = spinSlow.value * TAU;
    const sf = spinFast.value * TAU;
    const ap = ascendProgress.value;
    const p = pulse.value;

    const recorder = Skia.PictureRecorder();
    const cnv = recorder.beginRecording(
      Skia.XYWHRect(0, 0, size > 0 ? size : 1, size > 0 ? size : 1)
    );

    // 1. Outer halo
    {
      const opacity = clamp01(0.22 + p * 0.22);
      const shader = Skia.Shader.MakeRadialGradient(
        { x: center, y: center },
        maxRadius,
        cachedColors.haloOuter,
        [0, 1],
        TileMode.Clamp
      );
      const paint = paints.haloOuter;
      paint.setShader(shader);
      paint.setAlphaf(opacity);
      cnv.drawCircle(center, center, maxRadius, paint);
    }

    // 2. Inner pulsing halo
    {
      const opacity = clamp01(0.3 + p * 0.34);
      const innerRadius = maxRadius * (0.35 + p * 0.23);
      const shader = Skia.Shader.MakeRadialGradient(
        { x: center, y: center },
        innerRadius > 0 ? innerRadius : 1,
        cachedColors.haloInner,
        [0, 1],
        TileMode.Clamp
      );
      const paint = paints.haloInner;
      paint.setShader(shader);
      paint.setAlphaf(opacity);
      cnv.drawCircle(center, center, innerRadius > 0 ? innerRadius : 1, paint);
    }

    // 3. Sacred rays
    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];
      const angle = ray.angle + sl * ray.speed;
      const rayPulse = 0.38 + p * 0.62;
      const strokeWidth = ray.width * (0.45 + p * 0.75);
      const x2 = center + Math.cos(angle) * maxRadius * ray.length;
      const y2 = center + Math.sin(angle) * maxRadius * ray.length;
      const c = cachedColors.rays[i];
      c[3] = clamp01(ray.opacity * rayPulse);
      const paint = paints.rays[i];
      paint.setStrokeWidth(strokeWidth);
      paint.setColor(c);
      cnv.drawLine(center, center, x2, y2, paint);
    }

    // 4. Outer ring — 24 dots, CW
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * TAU + sl * 0.24;
      const dotX = center + Math.cos(angle) * maxRadius * 0.84;
      const dotY = center + Math.sin(angle) * maxRadius * 0.84;
      const c = cachedColors.outerDots[i];
      c[3] = clamp01(0.45 * (0.65 + p * 0.45));
      const paint = paints.outerDots[i];
      paint.setColor(c);
      cnv.drawCircle(dotX, dotY, 2.25, paint);
    }

    // 5. Inner ring — 16 dots, CCW
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * TAU - sf * 0.35;
      const dotX = center + Math.cos(angle) * maxRadius * 0.64;
      const dotY = center + Math.sin(angle) * maxRadius * 0.64;
      const c = cachedColors.innerDots[i];
      c[3] = clamp01(0.5 * (0.65 + p * 0.45));
      const paint = paints.innerDots[i];
      paint.setColor(c);
      cnv.drawCircle(dotX, dotY, 1.9, paint);
    }

    // 6. Floating particles
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const angle = pt.angle + sf * pt.speed;
      const drift = Math.sin(sf * pt.driftSpeed + pt.drift) * 10;
      const r = maxRadius * pt.radius + drift;
      const px = center + Math.cos(angle) * r;
      const py = center + Math.sin(angle) * r;
      const flicker = 0.35 + Math.abs(Math.sin(sf * 2.4 + pt.angle)) * 0.65;
      const opacity = clamp01(pt.opacity * flicker * (0.5 + p * 0.5));
      const cp = cachedColors.particles[i];
      cp[3] = opacity;
      const paint = paints.particles[i];
      paint.setColor(cp);
      cnv.drawCircle(px, py, pt.size, paint);

      if (pt.sparkle && opacity > 0.58) {
        const cs = cachedColors.sparkles[i];
        cs[3] = clamp01(opacity * 0.9);
        const sp = paints.sparkles[i];
        sp.setStrokeWidth(0.75);
        sp.setColor(cs);
        cnv.drawLine(px - 4, py, px + 4, py, sp);
        cnv.drawLine(px, py - 4, px, py + 4, sp);
      }
    }

    // 7. Ascending light streaks
    for (let i = 0; i < streaks.length; i++) {
      const streak = streaks[i];
      const local = (ap + streak.offset) % 1;
      const angle = streak.angle + local * 0.35;
      const startX = center + Math.cos(angle) * maxRadius * streak.radius;
      const startY =
        center + Math.sin(angle) * maxRadius * streak.radius +
        maxRadius * 0.16 -
        local * maxRadius * 0.6;
      const endY = startY - streak.length;
      const fadeIn = local / 0.16 < 1 ? local / 0.16 : 1;
      const fadeOut = local > 0.72 ? (1 - local) / 0.28 : 1;
      const opacity = clamp01(fadeIn * fadeOut * 0.85);
      if (opacity > 0.01) {
        const c = cachedColors.streaks[i];
        c[3] = opacity;
        const paint = paints.streaks[i];
        paint.setStrokeWidth(1.1);
        paint.setColor(c);
        cnv.drawLine(startX, startY, startX, endY, paint);
      }
    }

    return recorder.finishRecordingAsPicture();
  });

  if (!enabled || tierSuppressed) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
