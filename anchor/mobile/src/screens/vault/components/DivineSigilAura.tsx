import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, Circle, Group, Line } from '@shopify/react-native-skia';
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

const TAU = Math.PI * 2;

interface DivineSigilAuraProps {
  size: number;
  enabled: boolean;
  reduceMotionEnabled?: boolean;
  breath?: SharedValue<number>;
}

interface RaySeed {
  id: number;
  angle: number;
  length: number;
  width: number;
  speed: number;
  opacity: number;
}

interface ParticleSeed {
  id: number;
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
  id: number;
  angle: number;
  radius: number;
  length: number;
  offset: number;
}

const seeded = (seed: number): number => {
  const value = Math.sin(seed * 43758.5453123) * 143758.5453;
  return value - Math.floor(value);
};

const buildRaySeeds = (count: number): RaySeed[] => {
  const seeds: RaySeed[] = [];
  for (let index = 0; index < count; index += 1) {
    seeds.push({
      id: index,
      angle: (index / count) * TAU,
      length: 0.58 + seeded(index + 11) * 0.34,
      width: 0.8 + seeded(index + 31) * 1.8,
      speed: 0.08 + seeded(index + 71) * 0.16,
      opacity: 0.36 + seeded(index + 107) * 0.44,
    });
  }
  return seeds;
};

const buildParticles = (count: number): ParticleSeed[] => {
  const seeds: ParticleSeed[] = [];
  for (let index = 0; index < count; index += 1) {
    seeds.push({
      id: index,
      angle: seeded(index + 17) * TAU,
      radius: 0.22 + seeded(index + 41) * 0.34,
      speed: 0.35 + seeded(index + 97) * 0.9,
      size: 0.8 + seeded(index + 199) * 2.1,
      opacity: 0.3 + seeded(index + 283) * 0.7,
      drift: seeded(index + 353) * TAU,
      driftSpeed: 0.4 + seeded(index + 421) * 1.25,
      sparkle: seeded(index + 557) > 0.74,
    });
  }
  return seeds;
};

const buildStreaks = (count: number): StreakSeed[] => {
  const seeds: StreakSeed[] = [];
  for (let index = 0; index < count; index += 1) {
    seeds.push({
      id: index,
      angle: seeded(index + 211) * TAU,
      radius: 0.32 + seeded(index + 263) * 0.16,
      length: 10 + seeded(index + 317) * 14,
      offset: seeded(index + 401),
    });
  }
  return seeds;
};

interface SacredRayProps {
  seed: RaySeed;
  center: number;
  radius: number;
  spin: SharedValue<number>;
  pulse: SharedValue<number>;
}

const SacredRay: React.FC<SacredRayProps> = ({ seed, center, radius, spin, pulse }) => {
  const angle = useDerivedValue(() => seed.angle + spin.value * seed.speed * TAU);
  const rayEnd = useDerivedValue(() => ({
    x: center + Math.cos(angle.value) * radius * seed.length,
    y: center + Math.sin(angle.value) * radius * seed.length,
  }));
  const opacity = useDerivedValue(() => {
    const rayPulse = 0.38 + pulse.value * 0.62;
    return seed.opacity * rayPulse;
  });
  const strokeWidth = useDerivedValue(() => seed.width * (0.45 + pulse.value * 0.75));

  return (
    <Line
      p1={{ x: center, y: center }}
      p2={rayEnd as any}
      color="rgba(255, 218, 122, 0.92)"
      opacity={opacity}
      strokeWidth={strokeWidth}
    />
  );
};

interface OrbitDotProps {
  center: number;
  radius: number;
  baseAngle: number;
  dotSize: number;
  baseOpacity: number;
  spin: SharedValue<number>;
  pulse: SharedValue<number>;
}

const OrbitDot: React.FC<OrbitDotProps> = ({
  center,
  radius,
  baseAngle,
  dotSize,
  baseOpacity,
  spin,
  pulse,
}) => {
  const x = useDerivedValue(() => center + Math.cos(baseAngle + spin.value * TAU) * radius);
  const y = useDerivedValue(() => center + Math.sin(baseAngle + spin.value * TAU) * radius);
  const opacity = useDerivedValue(() => baseOpacity * (0.65 + pulse.value * 0.45));

  return <Circle cx={x} cy={y} r={dotSize} color="#FFE07D" opacity={opacity} />;
};

interface ParticleProps {
  seed: ParticleSeed;
  center: number;
  radius: number;
  spin: SharedValue<number>;
  pulse: SharedValue<number>;
}

const GoldParticle: React.FC<ParticleProps> = ({ seed, center, radius, spin, pulse }) => {
  const angle = useDerivedValue(() => seed.angle + spin.value * seed.speed * TAU);
  const drift = useDerivedValue(() => Math.sin(spin.value * TAU * seed.driftSpeed + seed.drift) * 10);
  const x = useDerivedValue(() => center + Math.cos(angle.value) * (radius * seed.radius + drift.value));
  const y = useDerivedValue(() => center + Math.sin(angle.value) * (radius * seed.radius + drift.value));
  const flicker = useDerivedValue(() => 0.35 + Math.abs(Math.sin(spin.value * TAU * 2.4 + seed.angle)) * 0.65);
  const opacity = useDerivedValue(() => seed.opacity * flicker.value * (0.5 + pulse.value * 0.5));
  const sparkleOpacity = useDerivedValue(() => {
    if (!seed.sparkle) return 0;
    return opacity.value > 0.58 ? opacity.value * 0.9 : 0;
  });
  const sparkleHStart = useDerivedValue(() => ({ x: x.value - 4, y: y.value }));
  const sparkleHEnd = useDerivedValue(() => ({ x: x.value + 4, y: y.value }));
  const sparkleVStart = useDerivedValue(() => ({ x: x.value, y: y.value - 4 }));
  const sparkleVEnd = useDerivedValue(() => ({ x: x.value, y: y.value + 4 }));

  return (
    <Group>
      <Circle cx={x} cy={y} r={seed.size} color="#FFE8A3" opacity={opacity} />
      {seed.sparkle && (
        <>
          <Line
            p1={sparkleHStart as any}
            p2={sparkleHEnd as any}
            color="#FFF5CC"
            strokeWidth={0.75}
            opacity={sparkleOpacity}
          />
          <Line
            p1={sparkleVStart as any}
            p2={sparkleVEnd as any}
            color="#FFF5CC"
            strokeWidth={0.75}
            opacity={sparkleOpacity}
          />
        </>
      )}
    </Group>
  );
};

interface AscendingStreakProps {
  seed: StreakSeed;
  center: number;
  radius: number;
  progress: SharedValue<number>;
}

const AscendingStreak: React.FC<AscendingStreakProps> = ({ seed, center, radius, progress }) => {
  const local = useDerivedValue(() => (progress.value + seed.offset) % 1);
  const angle = useDerivedValue(() => seed.angle + local.value * 0.35);
  const startX = useDerivedValue(() => center + Math.cos(angle.value) * radius * seed.radius);
  const startY = useDerivedValue(() => center + Math.sin(angle.value) * radius * seed.radius + radius * 0.16 - local.value * radius * 0.6);
  const endY = useDerivedValue(() => startY.value - seed.length);
  const opacity = useDerivedValue(() => {
    const fadeIn = Math.min(1, local.value / 0.16);
    const fadeOut = local.value > 0.72 ? (1 - local.value) / 0.28 : 1;
    return Math.max(0, fadeIn * fadeOut * 0.85);
  });
  const streakStart = useDerivedValue(() => ({ x: startX.value, y: startY.value }));
  const streakEnd = useDerivedValue(() => ({ x: startX.value, y: endY.value }));

  return (
    <Line
      p1={streakStart as any}
      p2={streakEnd as any}
      color="rgba(255, 228, 156, 0.95)"
      strokeWidth={1.1}
      opacity={opacity}
    />
  );
};

export const DivineSigilAura: React.FC<DivineSigilAuraProps> = ({
  size,
  enabled,
  reduceMotionEnabled = false,
  breath,
}) => {
  const fallbackBreath = useSharedValue(0);
  const spinSlow = useSharedValue(0);
  const spinFast = useSharedValue(0);
  const ascendProgress = useSharedValue(0);
  const pulse = breath ?? fallbackBreath;

  const particleCount = Platform.OS === 'android' ? 36 : 60;
  const rayCount = Platform.OS === 'android' ? 10 : 12;

  const rays = useMemo(() => buildRaySeeds(rayCount), [rayCount]);
  const particles = useMemo(() => buildParticles(particleCount), [particleCount]);
  const streaks = useMemo(() => buildStreaks(5), []);

  const animationsEnabled = enabled && !reduceMotionEnabled && process.env.NODE_ENV !== 'test';
  const center = size / 2;
  const maxRadius = size * 0.48;

  useEffect(() => {
    if (breath || !animationsEnabled) {
      if (!breath) {
        cancelAnimation(fallbackBreath);
        fallbackBreath.value = 0;
      }
      return;
    }

    fallbackBreath.value = withRepeat(
      withTiming(1, {
        duration: 1600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(fallbackBreath);
      fallbackBreath.value = 0;
    };
  }, [animationsEnabled, breath, fallbackBreath]);

  useEffect(() => {
    if (!animationsEnabled) {
      cancelAnimation(spinSlow);
      cancelAnimation(spinFast);
      cancelAnimation(ascendProgress);
      spinSlow.value = 0;
      spinFast.value = 0;
      ascendProgress.value = 0;
      return;
    }

    spinSlow.value = withRepeat(
      withTiming(1, {
        duration: 22000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    spinFast.value = withRepeat(
      withTiming(1, {
        duration: 15000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    ascendProgress.value = withRepeat(
      withTiming(1, {
        duration: 5200,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(spinSlow);
      cancelAnimation(spinFast);
      cancelAnimation(ascendProgress);
      spinSlow.value = 0;
      spinFast.value = 0;
      ascendProgress.value = 0;
    };
  }, [animationsEnabled, ascendProgress, spinFast, spinSlow]);

  const haloOuterOpacity = useDerivedValue(() => 0.22 + pulse.value * 0.22);
  const haloInnerOpacity = useDerivedValue(() => 0.3 + pulse.value * 0.34);
  const haloInnerRadius = useDerivedValue(() => maxRadius * (0.35 + pulse.value * 0.23));
  const ringSlowRotation = useDerivedValue(() => spinSlow.value * 0.24);
  const ringFastRotation = useDerivedValue(() => -spinFast.value * 0.35);

  if (!enabled) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={maxRadius} color={`${colors.gold}66`} opacity={haloOuterOpacity}>
          <BlurMask blur={48} style="normal" />
        </Circle>

        <Circle cx={center} cy={center} r={haloInnerRadius} color="rgba(255, 220, 110, 0.9)" opacity={haloInnerOpacity}>
          <BlurMask blur={30} style="normal" />
        </Circle>

        {rays.map((ray) => (
          <SacredRay key={`ray-${ray.id}`} seed={ray} center={center} radius={maxRadius} spin={spinSlow} pulse={pulse} />
        ))}

        {Array.from({ length: 24 }, (_, index) => (
          <OrbitDot
            key={`ring-a-${index}`}
            center={center}
            radius={maxRadius * 0.84}
            baseAngle={(index / 24) * TAU}
            dotSize={2.25}
            baseOpacity={0.45}
            spin={ringSlowRotation}
            pulse={pulse}
          />
        ))}

        {Array.from({ length: 16 }, (_, index) => (
          <OrbitDot
            key={`ring-b-${index}`}
            center={center}
            radius={maxRadius * 0.64}
            baseAngle={(index / 16) * TAU}
            dotSize={1.9}
            baseOpacity={0.5}
            spin={ringFastRotation}
            pulse={pulse}
          />
        ))}

        <Group>
          {particles.map((particle) => (
            <GoldParticle
              key={`particle-${particle.id}`}
              seed={particle}
              center={center}
              radius={maxRadius}
              spin={spinFast}
              pulse={pulse}
            />
          ))}
        </Group>

        {streaks.map((streak) => (
          <AscendingStreak
            key={`streak-${streak.id}`}
            seed={streak}
            center={center}
            radius={maxRadius}
            progress={ascendProgress}
          />
        ))}
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
