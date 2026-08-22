import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { PerformanceTier } from '@/hooks/usePerformanceTier';
import type { VisualizePresentationPhase } from './visualizePresentation';
import { VisualizationAnchorLens } from './VisualizationPrimitives';

interface VisualizeAnchorFieldProps {
  phase: VisualizePresentationPhase;
  phaseProgress?: number;
  totalProgress?: number;
  active?: boolean;
  paused?: boolean;
  reduceMotion?: boolean;
  performanceTier?: PerformanceTier;
  heroSize?: number;
  sigilSize?: number;
  compact?: boolean;
  imageUrl?: string;
  sigilSvg?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const MOTES = Array.from({ length: 12 }).map((_, i) => ({
  id: i,
  leftPct: `${((i * 47 + 6) % 96)}%`,
  bottomPct: `${22 + (i % 4) * 12}%`,
  duration: 13_000 + (i % 5) * 2_400,
  delay: ((i * 900) % 11_000),
}));

export const VisualizeFieldBackground: React.FC<{
  phase?: VisualizePresentationPhase;
  paused?: boolean;
  reduceMotion?: boolean;
}> = React.memo(({ phase = 'arrive', paused = false, reduceMotion = false }) => {
  const horizonBreathe = useRef(new Animated.Value(0)).current;
  const orb1Drift = useRef(new Animated.Value(0)).current;
  const orb2Drift = useRef(new Animated.Value(0)).current;
  const moteAnims = useRef(MOTES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion || paused) {
      horizonBreathe.stopAnimation();
      orb1Drift.stopAnimation();
      orb2Drift.stopAnimation();
      moteAnims.forEach((anim) => anim.stopAnimation());
      return;
    }

    const horizonLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(horizonBreathe, {
          toValue: 1,
          duration: 6_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(horizonBreathe, {
          toValue: 0,
          duration: 6_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const orb1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Drift, {
          toValue: 1,
          duration: 17_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb1Drift, {
          toValue: 0,
          duration: 17_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const orb2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Drift, {
          toValue: 1,
          duration: 19_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb2Drift, {
          toValue: 0,
          duration: 19_000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    horizonLoop.start();
    orb1Loop.start();
    orb2Loop.start();

    const moteLoops = moteAnims.map((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(MOTES[i].delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: MOTES[i].duration,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      horizonLoop.stop();
      orb1Loop.stop();
      orb2Loop.stop();
      moteLoops.forEach((loop) => loop.stop());
    };
  }, [horizonBreathe, moteAnims, orb1Drift, orb2Drift, paused, reduceMotion]);

  const horizonScaleY = horizonBreathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.08],
  });
  const horizonOpacity = horizonBreathe.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 0.95],
  });

  const orb1TranslateX = orb1Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const orb1TranslateY = orb1Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });
  const orb1Scale = orb1Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  const orb2TranslateX = orb2Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });
  const orb2TranslateY = orb2Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const orb2Scale = orb2Drift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base rich sapphire gradient background */}
      <LinearGradient
        colors={['#1c2f57', '#132244', '#0c152b', '#04060c']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0.1 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Left Glowing Sapphire Orb with Soft Radial Fade */}
      <Animated.View
        style={[
          styles.orb1,
          {
            transform: [
              { translateX: orb1TranslateX },
              { translateY: orb1TranslateY },
              { scale: orb1Scale },
            ],
          },
        ]}
      >
        <Svg width={420} height={420}>
          <Defs>
            <RadialGradient id="field-orb1-grad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#2954a8" stopOpacity={0.75} />
              <Stop offset="45%" stopColor="#1e3e7e" stopOpacity={0.45} />
              <Stop offset="75%" stopColor="#142850" stopOpacity={0.15} />
              <Stop offset="100%" stopColor="#04060c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={420} height={420} fill="url(#field-orb1-grad)" />
        </Svg>
      </Animated.View>

      {/* Bottom Right Soft Golden Orb with Soft Radial Fade */}
      <Animated.View
        style={[
          styles.orb2,
          {
            transform: [
              { translateX: orb2TranslateX },
              { translateY: orb2TranslateY },
              { scale: orb2Scale },
            ],
          },
        ]}
      >
        <Svg width={380} height={380}>
          <Defs>
            <RadialGradient id="field-orb2-grad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#d4af37" stopOpacity={0.24} />
              <Stop offset="50%" stopColor="#a38228" stopOpacity={0.1} />
              <Stop offset="100%" stopColor="#04060c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={380} height={380} fill="url(#field-orb2-grad)" />
        </Svg>
      </Animated.View>

      {/* Atmospheric Horizon Glow with Soft Elliptical Radial Fade */}
      <Animated.View
        style={[
          styles.horizon,
          {
            opacity: horizonOpacity,
            transform: [{ scaleY: horizonScaleY }],
          },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="field-horizon-grad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#3d72d1" stopOpacity={0.32} />
              <Stop offset="30%" stopColor="#22488f" stopOpacity={0.18} />
              <Stop offset="65%" stopColor="#102244" stopOpacity={0.05} />
              <Stop offset="100%" stopColor="#04060c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={400} height={240} fill="url(#field-horizon-grad)" />
        </Svg>
      </Animated.View>

      {/* Floating Motes */}
      {!reduceMotion &&
        MOTES.map((mote, i) => {
          const anim = moteAnims[i];
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, -260],
          });
          const opacity = anim.interpolate({
            inputRange: [0, 0.15, 0.85, 1],
            outputRange: [0, 0.7, 0.5, 0],
          });
          return (
            <Animated.View
              key={mote.id}
              style={[
                styles.mote,
                {
                  left: mote.leftPct as any,
                  bottom: mote.bottomPct as any,
                  opacity,
                  transform: [{ translateY }],
                },
              ]}
            />
          );
        })}

      {/* Phase-specific subtle tint overlay */}
      {phase === 'adapt' ? (
        <View style={[StyleSheet.absoluteFill, styles.adaptTint]} />
      ) : phase === 'build' ? (
        <View style={[StyleSheet.absoluteFill, styles.buildTint]} />
      ) : null}

      {/* Cinematic Letterbox Gradients */}
      <LinearGradient
        colors={['rgba(3,2,6,0.4)', 'transparent']}
        style={styles.letterboxTop}
      />
      <LinearGradient
        colors={['transparent', 'rgba(3,2,6,0.55)']}
        style={styles.letterboxBot}
      />
    </View>
  );
});

export const VisualizeAnchorField: React.FC<VisualizeAnchorFieldProps> = ({
  phase,
  phaseProgress = 0,
  totalProgress = 0,
  active = true,
  paused = false,
  reduceMotion = false,
  heroSize = 330,
  sigilSize = 228,
  compact = false,
  imageUrl,
  sigilSvg,
  style,
  children,
}) => {
  // Continuous Breathing Animations
  const heroBreathAnim = useRef(new Animated.Value(0)).current;
  const auraAnim = useRef(new Animated.Value(0)).current;
  const lensAnim = useRef(new Animated.Value(0)).current;
  const breathRingAnim = useRef(new Animated.Value(0)).current;

  // Adapt Tremor Animation
  const tremorAnim = useRef(new Animated.Value(0)).current;

  // Phase transition interpolated values
  const { sigilScale, sigilOpacity, frameOpacity, apertureOpacity } = useMemo(() => {
    switch (phase) {
      case 'arrive':
        return {
          sigilScale: 1.02,
          sigilOpacity: 1,
          frameOpacity: 1,
          apertureOpacity: 0.18,
        };
      case 'build':
        return {
          sigilScale: 0.96,
          sigilOpacity: 1,
          frameOpacity: 0.95,
          apertureOpacity: 0.35,
        };
      case 'rehearse':
        return {
          sigilScale: 0.90,
          sigilOpacity: 0.88,
          frameOpacity: 0.75,
          apertureOpacity: 0.20,
        };
      case 'adapt':
        return {
          sigilScale: 0.90,
          sigilOpacity: 0.85,
          frameOpacity: 0.75,
          apertureOpacity: 0.45,
        };
      case 'return':
        return {
          sigilScale: 1.02,
          sigilOpacity: 1,
          frameOpacity: 1,
          apertureOpacity: 0.25,
        };
      default:
        return {
          sigilScale: 1,
          sigilOpacity: 1,
          frameOpacity: 1,
          apertureOpacity: 0.2,
        };
    }
  }, [phase]);

  // Trigger Adapt Tremor on Adapt Phase Entry
  useEffect(() => {
    if (phase === 'adapt' && !reduceMotion && !paused) {
      Animated.sequence([
        Animated.timing(tremorAnim, {
          toValue: -3,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(tremorAnim, {
          toValue: 3,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(tremorAnim, {
          toValue: -2,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(tremorAnim, {
          toValue: 2,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(tremorAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase, paused, reduceMotion, tremorAnim]);

  // Run Ambient Breathing Loops
  useEffect(() => {
    if (reduceMotion || paused) {
      heroBreathAnim.stopAnimation();
      auraAnim.stopAnimation();
      lensAnim.stopAnimation();
      breathRingAnim.stopAnimation();
      return;
    }

    const heroBreathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroBreathAnim, {
          toValue: 1,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroBreathAnim, {
          toValue: 0,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, {
          toValue: 1,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraAnim, {
          toValue: 0,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const lensLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(lensAnim, {
          toValue: 1,
          duration: 5_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(lensAnim, {
          toValue: 0,
          duration: 5_500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const breathRingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathRingAnim, {
          toValue: 1,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathRingAnim, {
          toValue: 0,
          duration: 4_200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    heroBreathLoop.start();
    auraLoop.start();
    lensLoop.start();
    breathRingLoop.start();

    return () => {
      heroBreathLoop.stop();
      auraLoop.stop();
      lensLoop.stop();
      breathRingLoop.stop();
    };
  }, [auraAnim, breathRingAnim, heroBreathAnim, lensAnim, paused, reduceMotion]);

  const heroBreathScale = heroBreathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.05],
  });

  const auraScale = auraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const auraOpacity = auraAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.95],
  });

  const lensScaleY = lensAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.02],
  });
  const lensOpacity = lensAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.85],
  });

  const breathRingScale = breathRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.10],
  });
  const breathRingOpacity = breathRingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  const stageSize = heroSize;
  const auraSize = Math.round(sigilSize * 1.25);
  const apertureSize = Math.round(sigilSize * 1.32);
  const breathRingSize = sigilSize + 24;
  const lensWidth = Math.min(stageSize - 20, Math.round(sigilSize * 1.35));
  const lensHeight = Math.round(sigilSize * 0.95);

  return (
    <View style={[styles.stageWrapper, style]}>
      <Animated.View
        style={[
          styles.stage,
          {
            width: stageSize,
            height: stageSize,
            opacity: frameOpacity,
            transform: [
              { scale: compact ? 0.92 : 1 },
              { translateX: tremorAnim },
            ],
          },
        ]}
      >
        {/* Frame Outer Container with Rounded Border & Gradient */}
        <View style={styles.frame}>
          <LinearGradient
            colors={['rgba(34,64,122,0.34)', 'rgba(8,14,30,0.10)', 'transparent']}
            locations={[0, 0.6, 0.78]}
            start={{ x: 0.5, y: 0.42 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* 4 Corner Accents */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* Breathing Aura with Smooth Radial Fade */}
        <Animated.View
          style={[
            styles.aura,
            {
              width: auraSize,
              height: auraSize,
              opacity: auraOpacity,
              transform: [{ scale: auraScale }],
            },
          ]}
        >
          <Svg width={auraSize} height={auraSize}>
            <Defs>
              <RadialGradient id="stage-aura-grad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#d4af37" stopOpacity={0.25} />
                <Stop offset="60%" stopColor="#d4af37" stopOpacity={0.08} />
                <Stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={auraSize} height={auraSize} fill="url(#stage-aura-grad)" />
          </Svg>
        </Animated.View>

        {/* Lens Ring */}
        <Animated.View
          style={[
            styles.lens,
            {
              width: lensWidth,
              height: lensHeight,
              borderRadius: lensHeight / 2,
              opacity: lensOpacity,
              transform: [{ scaleY: lensScaleY }],
            },
          ]}
        />

        {/* Aperture Phase Glow with Smooth Radial Fade */}
        <Animated.View
          style={[
            styles.aperture,
            {
              width: apertureSize,
              height: apertureSize,
              opacity: apertureOpacity,
            },
          ]}
        >
          <Svg width={apertureSize} height={apertureSize}>
            <Defs>
              <RadialGradient id="stage-aperture-grad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#3468be" stopOpacity={0.32} />
                <Stop offset="65%" stopColor="#3468be" stopOpacity={0.1} />
                <Stop offset="100%" stopColor="#3468be" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x={0} y={0} width={apertureSize} height={apertureSize} fill="url(#stage-aperture-grad)" />
          </Svg>
        </Animated.View>

        {/* Continuous Breath Ring */}
        <Animated.View
          style={[
            styles.breathRing,
            {
              width: breathRingSize,
              height: breathRingSize,
              borderRadius: breathRingSize / 2,
              opacity: breathRingOpacity,
              transform: [{ scale: reduceMotion || paused ? 1 : breathRingScale }],
            },
          ]}
        />

        {/* Sigil Outer Wrapper */}
        <Animated.View
          style={[
            styles.sigilOuter,
            {
              opacity: sigilOpacity,
              transform: [{ scale: sigilScale }],
            },
          ]}
        >
          {/* Hero Breathing Animated Wrapper */}
          <Animated.View
            style={[
              styles.heroBreatheWrap,
              {
                transform: [{ scale: reduceMotion || paused ? 1 : heroBreathScale }],
              },
            ]}
          >
            <VisualizationAnchorLens
              size={sigilSize}
              imageUrl={imageUrl}
              svg={sigilSvg}
              still={paused}
            />
          </Animated.View>
        </Animated.View>

        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  stageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  cornerTL: {
    top: 5,
    left: 5,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopLeftRadius: 34,
  },
  cornerTR: {
    top: 5,
    right: 5,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderTopRightRadius: 34,
  },
  cornerBL: {
    bottom: 5,
    left: 5,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderBottomLeftRadius: 34,
  },
  cornerBR: {
    bottom: 5,
    right: 5,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomRightRadius: 34,
  },
  lens: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
  },
  aura: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aperture: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  sigilOuter: {
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBreatheWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb1: {
    position: 'absolute',
    width: 420,
    height: 420,
    top: -120,
    left: -100,
  },
  orb2: {
    position: 'absolute',
    width: 380,
    height: 380,
    bottom: 10,
    right: -100,
  },
  horizon: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: '50%',
    height: 240,
    marginTop: -120,
  },
  mote: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(245,240,232,0.6)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  adaptTint: {
    backgroundColor: 'rgba(150,90,40,0.1)',
  },
  buildTint: {
    backgroundColor: 'rgba(52,104,190,0.08)',
  },
  letterboxTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 130,
    zIndex: 3,
  },
  letterboxBot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 130,
    zIndex: 3,
  },
});
