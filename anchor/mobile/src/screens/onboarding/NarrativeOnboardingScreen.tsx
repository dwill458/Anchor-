/**
 * NarrativeOnboardingScreen — v1.1 "Industrial Magic"
 *
 * 5-screen Cognitive Priming Utility onboarding flow.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuthStore } from '@/stores/authStore';
import { ForgeDemo } from '@/components/onboarding/ForgeDemo';
import { UseCaseCard } from '@/components/onboarding/UseCaseCard';
import type { UseCaseItem } from '@/components/onboarding/UseCaseCard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, typography } from '@/theme';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const anchorLogoOfficial = require('../../../assets/anchor-gold.png') as number;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EASE_IN_OUT = Easing.inOut(Easing.ease);
const LABEL_FONT_SIZE = typography.fontSize.xs - 2;
const DETAIL_FONT_SIZE = typography.fontSize.xs - 1;
const MICRO_FONT_SIZE = typography.fontSize.xs - 3;
const BODY_FONT_SIZE = typography.fontSize.md + 1;
const BUTTON_FONT_SIZE = typography.fontSize.xs + 1;

const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;
  const value = parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface OnboardingSlide {
  id: number;
  label: string;
  headline: string;
  body: string;
  visual: 'orbits' | 'signal' | 'forge' | 'usecases' | 'final';
  cta: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 0,
    label: '01 / The Problem',
    headline: 'Your brain has **unfinished business.**',
    body: "Every intention that hasn't been locked down is running in the background — draining your focus before you begin.",
    visual: 'orbits',
    cta: 'Next',
  },
  {
    id: 1,
    label: '02 / The Gap',
    headline: "The goal isn't the problem. **The trigger is.**",
    body: "You know what you want. You don't have something to snap you into it — something your brain recognizes instantly, before doubt can form.",
    visual: 'signal',
    cta: 'Next',
  },
  {
    id: 2,
    label: '03 / The Mechanism',
    headline: 'Anchor **forges** your intention into a visual trigger.',
    body: 'In seconds, your words become a symbol your brain recognizes before conscious thought kicks in.',
    visual: 'forge',
    cta: 'Next',
  },
  {
    id: 3,
    label: '04 / The Practice',
    headline: 'Used before the moments **that matter.**',
    body: 'Not a reminder. A primer. The 10 seconds that change your next 4 hours.',
    visual: 'usecases',
    cta: 'Next',
  },
  {
    id: 4,
    label: '05 / Begin',
    headline: 'Forge your first anchor **now.**',
    body: 'It takes 30 seconds. Set it as your lock screen. See what happens today.',
    visual: 'final',
    cta: 'Forge Your First Anchor →',
  },
];

const USE_CASES: UseCaseItem[] = [
  { label: 'Deep Work', description: 'Before a 4-hour coding block', iconType: 'code' },
  { label: 'Physical', description: 'Before hitting a new PR at the gym', iconType: 'lift' },
  { label: 'High Stakes', description: 'Before a pitch, presentation, or interview', iconType: 'pitch' },
];

const TOTAL = SLIDES.length;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderHeadline(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1
      ? <Text key={i} style={styles.headlineGold}>{part}</Text>
      : <Text key={i}>{part}</Text>
  );
}

const AmbientBleed: React.FC = () => (
  <View pointerEvents="none" style={styles.ambientBleed}>
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id="narrative-onboarding-ambient-bleed" cx="50%" cy="38%" r="60%">
          <Stop offset="0%" stopColor={colors.deepPurple} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.deepPurple} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#narrative-onboarding-ambient-bleed)" />
    </Svg>
  </View>
);

// ---------------------------------------------------------------------------
// Visual sub-components
// ---------------------------------------------------------------------------

const OrbitsVisual: React.FC = () => {
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;
  const words = ['FOCUS', 'POWER', 'CLARITY', 'DRIVE', 'WILL'];
  const wordAnims = useRef(words.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    const makeOrbit = (val: Animated.Value, dur: number, reverse = false) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: reverse ? -1 : 1,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

    makeOrbit(rot1, 18000);
    makeOrbit(rot2, 12000, true);
    makeOrbit(rot3, 8000);

    wordAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 800),
          Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.delay(Math.max(400, 4000 - 800 * i)),
        ])
      ).start();
    });
  }, [rot1, rot2, rot3, wordAnims]);

  const spin = (val: Animated.Value) =>
    val.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  const POSITIONS: Array<object> = [
    { top: '10%', left: '5%' },
    { top: '20%', right: '8%' },
    { bottom: '28%', left: '6%' },
    { bottom: '18%', right: '6%' },
    { top: '48%', left: '0%' },
  ];

  return (
    <View style={visual.orbits.container}>
      {[
        { size: 300, anim: rot1, opacity: 0.5 },
        { size: 248, anim: rot2, opacity: 0.4 },
        { size: 190, anim: rot3, opacity: 0.3 },
      ].map(({ size, anim, opacity }, i) => (
        <Animated.View
          key={i}
          style={[
            visual.orbits.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity,
              transform: [{ rotate: spin(anim) }],
            },
          ]}
        >
          <View style={visual.orbits.dot} />
        </Animated.View>
      ))}

      <View style={visual.orbits.center}>
        <Image source={anchorLogoOfficial} style={{ width: 140, height: 140 }} resizeMode="contain" />
      </View>

      {words.map((word, i) => (
        <Animated.Text
          key={word}
          style={[
            visual.orbits.word,
            POSITIONS[i],
            {
              opacity: wordAnims[i],
              transform: [
                {
                  translateY: wordAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12],
                  }),
                },
              ],
            },
          ]}
        >
          {word}
        </Animated.Text>
      ))}
    </View>
  );
};

const SignalVisual: React.FC = () => {
  const haloOpacity = useRef(new Animated.Value(0.5)).current;
  const outerOrbitRotation = useRef(new Animated.Value(0)).current;
  const innerOrbitRotation = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.85)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const coronaScale = useRef(new Animated.Value(0.9)).current;
  const coronaOpacity = useRef(new Animated.Value(0.3)).current;
  const seedOpacity = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(haloOpacity, { toValue: 1, duration: 3000, easing: EASE_IN_OUT, useNativeDriver: true }),
          Animated.timing(haloOpacity, { toValue: 0.5, duration: 3000, easing: EASE_IN_OUT, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.timing(outerOrbitRotation, { toValue: 1, duration: 50000, easing: Easing.linear, useNativeDriver: true })
      ),
      Animated.loop(
        Animated.timing(innerOrbitRotation, { toValue: 1, duration: 70000, easing: Easing.linear, useNativeDriver: true })
      ),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowScale, { toValue: 1.2, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 1, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowScale, { toValue: 0.85, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.6, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
          ]),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(coronaScale, { toValue: 1.1, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
            Animated.timing(coronaOpacity, { toValue: 0.7, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(coronaScale, { toValue: 0.9, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
            Animated.timing(coronaOpacity, { toValue: 0.3, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
          ]),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(seedOpacity, { toValue: 1, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
          Animated.timing(seedOpacity, { toValue: 0.4, duration: 2500, easing: EASE_IN_OUT, useNativeDriver: true }),
        ])
      ),
    ];

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, []);

  const outerSpin = outerOrbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerSpin = innerOrbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={visual.signal.container}>
      <Animated.View style={[visual.signal.ambientHalo, { opacity: haloOpacity }]}>
        <Svg width="100%" height="100%" viewBox="0 0 380 380">
          <Defs>
            <RadialGradient id="narrative-onboarding-void-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.deepPurple} stopOpacity={0.07} />
              <Stop offset="100%" stopColor={colors.deepPurple} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="380" height="380" fill="url(#narrative-onboarding-void-halo)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[visual.signal.outerOrbit, { transform: [{ rotate: outerSpin }] }]}>
        <View style={visual.signal.outerOrbitDot} />
      </Animated.View>

      <Animated.View style={[visual.signal.innerOrbit, { transform: [{ rotate: innerSpin }] }]} />

      <View style={visual.signal.voidShell}>
        <View style={visual.signal.voidClip}>
          <Svg style={visual.signal.gradientFill} width="100%" height="100%" viewBox="0 0 218 218">
            <Defs>
              <RadialGradient id="narrative-onboarding-void-body" cx="50%" cy="50%" r="62%">
                <Stop offset="0%" stopColor={colors.deepPurple} stopOpacity={0.12} />
                <Stop offset="55%" stopColor={colors.deepPurple} stopOpacity={0.5} />
                <Stop offset="100%" stopColor={colors.background.primary} stopOpacity={0.92} />
              </RadialGradient>
            </Defs>
            <Rect width="218" height="218" fill="url(#narrative-onboarding-void-body)" />
          </Svg>

          <Animated.View
            pointerEvents="none"
            style={[
              visual.signal.glowBloom,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          >
            <Svg style={visual.signal.gradientFill} width="100%" height="100%" viewBox="0 0 90 90">
              <Defs>
                <RadialGradient id="narrative-onboarding-void-glow" cx="50%" cy="45%" r="60%">
                  <Stop offset="0%" stopColor={colors.gold} stopOpacity={0.12} />
                  <Stop offset="35%" stopColor={colors.deepPurple} stopOpacity={0.15} />
                  <Stop offset="60%" stopColor={colors.deepPurple} stopOpacity={0.08} />
                  <Stop offset="100%" stopColor={colors.deepPurple} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width="90" height="90" fill="url(#narrative-onboarding-void-glow)" />
            </Svg>
            <BlurView intensity={24} tint="dark" style={visual.signal.glowBlur} />
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              visual.signal.corona,
              {
                opacity: coronaOpacity,
                transform: [{ scale: coronaScale }],
              },
            ]}
          />

          <Animated.View pointerEvents="none" style={[visual.signal.seed, { opacity: seedOpacity }]} />
        </View>
      </View>
    </View>
  );
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const successAnchor = require('../../../assets/success anchor onboarding.png') as number;

const FinalVisual: React.FC = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  const ringRot = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [pulse, ringRot]);

  const spin = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={visual.final.container}>
      <View style={visual.final.glow} />
      <Animated.View style={[visual.final.ring, { transform: [{ rotate: spin }] }]}>
        <View style={visual.final.ringDot} />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image source={successAnchor} style={{ width: 200, height: 200, borderRadius: 100 }} resizeMode="contain" />
      </Animated.View>
      <View style={visual.final.badge}>
        <Text style={visual.final.badgeText}>30 SEC TO FORGE</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Corner accents + ornament
// ---------------------------------------------------------------------------

const CornerAccents: React.FC = () => (
  <>
    <View style={[styles.corner, styles.cornerTL]} />
    <View style={[styles.corner, styles.cornerTR]} />
    <View style={[styles.corner, styles.cornerBL]} />
    <View style={[styles.corner, styles.cornerBR]} />
  </>
);

const Ornament: React.FC = () => (
  <View style={styles.ornament}>
    <View style={styles.ornamentLine} />
    <View style={styles.ornamentDiamond} />
    <View style={styles.ornamentLine} />
  </View>
);

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export const NarrativeOnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { completeOnboarding, setShouldRedirectToCreation } = useAuthStore();

  const [currentSlide, setCurrentSlide] = useState(0);
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const transitioning = useRef(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (transitioning.current || index === currentSlide) return;
      transitioning.current = true;

      Animated.timing(slideOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(index);
        Animated.timing(slideOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          transitioning.current = false;
        });
      });
    },
    [currentSlide, slideOpacity]
  );

  const handleCTA = () => {
    if (currentSlide < TOTAL - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Slide 4 — complete onboarding, redirect to create flow
      setShouldRedirectToCreation(true);
      completeOnboarding();
      // RootNavigator switches to Main automatically on hasCompletedOnboarding change
    }
  };

  const handleSkip = () => goToSlide(TOTAL - 1);

  const renderVisual = (slide: OnboardingSlide) => {
    switch (slide.visual) {
      case 'orbits':    return <OrbitsVisual />;
      case 'signal':    return <SignalVisual />;
      case 'forge':     return <ForgeDemo isActive={currentSlide === 2} />;
      case 'usecases':  return (
        <View style={styles.useCasesWrapper}>
          {USE_CASES.map((item, i) => (
            <UseCaseCard
              key={item.label}
              item={item}
              index={i}
              isActive={currentSlide === 3}
            />
          ))}
        </View>
      );
      case 'final':     return <FinalVisual />;
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBleed />

      <CornerAccents />

      {/* Returning-user sign-in — only visible on the very first slide */}
      {currentSlide === 0 && (
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => navigation.navigate('Login')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      )}

      {currentSlide < TOTAL - 1 && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.slideContent, { opacity: slideOpacity }]}>
        <View style={styles.visualArea}>
          {renderVisual(slide)}
        </View>

        <View style={styles.textArea}>
          <Ornament />
          <Text style={styles.label}>{slide.label}</Text>
          <Text style={styles.headline}>
            {renderHeadline(slide.headline)}
          </Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.dot, i === currentSlide ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={handleCTA} activeOpacity={0.85}>
          <Text style={styles.ctaText}>{slide.cta}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Visual sub-styles
// ---------------------------------------------------------------------------

const visual = {
  orbits: StyleSheet.create({
    container: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' } as const,
    ring: { position: 'absolute', borderWidth: 1, borderColor: colors.gold } as const,
    dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold, top: -3, left: '50%', marginLeft: -3, shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } as const,
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 155, height: 155 } as const,
    anchorGlowRing: { position: 'absolute', width: 162, height: 162, borderRadius: 81, backgroundColor: 'transparent', borderWidth: 1, borderColor: withAlpha(colors.gold, 0.45), shadowColor: colors.gold, shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12 } as const,
    word: { position: 'absolute', fontFamily: typography.fonts.heading, fontSize: DETAIL_FONT_SIZE, color: colors.gold, letterSpacing: 1.5 } as const,
  }),
  signal: StyleSheet.create({
    container: { width: 320, height: 320, position: 'relative', alignItems: 'center', justifyContent: 'center' } as const,
    ambientHalo: { position: 'absolute', width: 380, height: 380, borderRadius: 190 } as const,
    outerOrbit: { position: 'absolute', width: 296, height: 296, borderRadius: 148, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(colors.gold, 0.14), alignItems: 'center' } as const,
    outerOrbitDot: { position: 'absolute', top: -2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.gold, shadowColor: colors.gold, shadowRadius: 6, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 }, elevation: 4 } as const,
    innerOrbit: { position: 'absolute', width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.05) } as const,
    voidShell: { width: 218, height: 218, borderRadius: 109, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.1), shadowColor: colors.charcoal, shadowOffset: { width: 0, height: 30 }, shadowOpacity: 0.5, shadowRadius: 70, elevation: 12 } as const,
    voidClip: { flex: 1, borderRadius: 109, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.background.primary, 0.82) } as const,
    gradientFill: { ...StyleSheet.absoluteFillObject } as const,
    glowBloom: { position: 'absolute', width: 90, height: 90, borderRadius: 45, overflow: 'hidden' } as const,
    glowBlur: { ...StyleSheet.absoluteFillObject, borderRadius: 45 } as const,
    corona: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.1) } as const,
    seed: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.gold, 0.5), shadowColor: colors.gold, shadowRadius: 10, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 0 }, elevation: 2 } as const,
  }),
  final: StyleSheet.create({
    container: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' } as const,
    glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: withAlpha(colors.gold, 0.08) } as const,
    ring: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.2) } as const,
    ringDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold, top: -4, left: '50%', marginLeft: -4, shadowColor: colors.gold, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } as const,
    badge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: withAlpha(colors.deepPurple, 0.9), borderWidth: 1, borderColor: withAlpha(colors.gold, 0.3), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as const,
    badgeText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.5, color: colors.gold } as const,
  }),
};

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  ambientBleed: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', zIndex: 0 },
  corner: { position: 'absolute', width: 20, height: 20, opacity: 0.3, zIndex: 5 },
  cornerTL: { top: 96, left: 20, borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.gold },
  cornerTR: { top: 96, right: 20, borderTopWidth: 1, borderRightWidth: 1, borderColor: colors.gold },
  cornerBL: { bottom: 120, left: 20, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: colors.gold },
  cornerBR: { bottom: 120, right: 20, borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.gold },
  signInBtn: { position: 'absolute', top: 54, left: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.55), backgroundColor: withAlpha(colors.gold, 0.08) },
  signInBtnText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 1.8, color: colors.gold },
  skipBtn: { position: 'absolute', top: 54, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(colors.bone, 0.18), backgroundColor: withAlpha(colors.bone, 0.05) },
  skipText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 2, color: colors.silver },
  slideContent: { flex: 1, paddingTop: 44 },
  visualArea: { height: 370, alignItems: 'center', justifyContent: 'center' },
  textArea: { flex: 1, paddingHorizontal: 36 },
  useCasesWrapper: { width: SCREEN_WIDTH - 72, gap: 10 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ornamentLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.gold, 0.3) },
  ornamentDiamond: { width: 5, height: 5, backgroundColor: colors.gold, opacity: 0.6, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: typography.fonts.heading, fontSize: LABEL_FONT_SIZE, letterSpacing: 2.5, color: colors.gold, textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 },
  headline: { fontFamily: typography.fonts.headingSemiBold, fontSize: typography.sizes.h2, color: colors.bone, lineHeight: typography.lineHeights.h2, marginBottom: 18, letterSpacing: -0.2 },
  headlineGold: { color: colors.gold, fontFamily: typography.fonts.headingSemiBold },
  body: { fontFamily: typography.fontFamily.sans, fontSize: BODY_FONT_SIZE, color: colors.silver, lineHeight: 27, letterSpacing: 0.2 },
  footer: { paddingHorizontal: 36, paddingBottom: Platform.OS === 'android' ? 24 : 12, alignItems: 'center', gap: 24 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: colors.gold },
  dotInactive: { width: 6, backgroundColor: withAlpha(colors.bone, 0.2) },
  ctaBtn: { width: '100%', height: 56, backgroundColor: colors.gold, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaText: { fontFamily: typography.fonts.headingSemiBold, fontSize: BUTTON_FONT_SIZE, letterSpacing: 2, color: colors.navy, textTransform: 'uppercase' },
});
