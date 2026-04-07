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
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { ForgeDemo } from '@/components/onboarding/ForgeDemo';
import { UseCaseCard } from '@/components/onboarding/UseCaseCard';
import type { UseCaseItem } from '@/components/onboarding/UseCaseCard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const anchorLogoOfficial = require('../../../assets/anchor-gold.png') as number;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

const SIG_W = 320;
const SIG_LINE_CONFIGS = [
  { width: SIG_W,                               left: 0 },
  { width: Math.round(SIG_W * 0.82), left: Math.round(SIG_W * 0.09) },
  { width: Math.round(SIG_W * 0.91), left: Math.round(SIG_W * 0.045) },
  { width: Math.round(SIG_W * 0.72), left: Math.round(SIG_W * 0.14) },
];
const SIG_LINE_TOPS = [80, 128, 176, 224];

const SignalVisual: React.FC = () => {
  const sweeps = useRef(SIG_LINE_CONFIGS.map(() => new Animated.Value(0))).current;
  const sweepOpacities = useRef(SIG_LINE_CONFIGS.map(() => new Animated.Value(0))).current;
  const ringRot = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const DURATION = 3000;
    sweeps.forEach((sweep, i) => {
      const opacity = sweepOpacities[i];
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.parallel([
            Animated.timing(sweep, { toValue: 1, duration: DURATION, easing: Easing.linear, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 0.7, duration: 450, easing: Easing.linear, useNativeDriver: true }),
              Animated.delay(DURATION - 900),
              Animated.timing(opacity, { toValue: 0, duration: 450, easing: Easing.linear, useNativeDriver: true }),
            ]),
          ]),
        ])
      ).start();
    });
    Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [sweeps, sweepOpacities, ringRot]);

  const spin = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={visual.signal.container}>
      {SIG_LINE_CONFIGS.map(({ width, left }, i) => {
        const translateX = sweeps[i].interpolate({
          inputRange: [0, 1],
          outputRange: [-width, width],
        });
        return (
          <View
            key={i}
            style={{ position: 'absolute', top: SIG_LINE_TOPS[i], left, width, height: 2, overflow: 'hidden' }}
          >
            <Animated.View
              style={{ width, height: 2, opacity: sweepOpacities[i], transform: [{ translateX }] }}
            >
              <LinearGradient
                colors={['transparent', '#D4AF37', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        );
      })}

      <View style={visual.signal.centerWrap}>
        <Animated.View style={[visual.signal.dashRing, { transform: [{ rotate: spin }] }]}>
          <View style={visual.signal.dashDot} />
        </Animated.View>
        <View style={visual.signal.center}>
          <Text style={visual.signal.centerText}>{'NO\nTRIGGER'}</Text>
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

export const NarrativeOnboardingScreen: React.FC<Props> = () => {
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
      <LinearGradient
        colors={['rgba(62,44,91,0.4)', 'transparent']}
        style={styles.radialOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <CornerAccents />

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
    ring: { position: 'absolute', borderWidth: 1, borderColor: '#D4AF37' } as const,
    dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4AF37', top: -3, left: '50%', marginLeft: -3, shadowColor: '#D4AF37', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } as const,
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 155, height: 155 } as const,
    anchorGlowRing: { position: 'absolute', width: 162, height: 162, borderRadius: 81, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(212,175,55,0.45)', shadowColor: '#F7D66A', shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12 } as const,
    word: { position: 'absolute', fontFamily: 'Cinzel-Regular', fontSize: 11, color: '#D4AF37', letterSpacing: 1.5 } as const,
  }),
  signal: StyleSheet.create({
    container: { width: 320, height: 320, position: 'relative', alignItems: 'center', justifyContent: 'center' } as const,
    centerWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' } as const,
    dashRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderStyle: 'dashed' } as const,
    dashDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#D4AF37', top: -3, left: '50%', marginLeft: -3, shadowColor: '#D4AF37', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } as const,
    center: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(62,44,91,0.7)', alignItems: 'center', justifyContent: 'center' } as const,
    centerText: { fontFamily: 'Cinzel-Regular', fontSize: 13, letterSpacing: 2, color: '#D4AF37', textAlign: 'center', lineHeight: 20, opacity: 0.8 } as const,
  }),
  final: StyleSheet.create({
    container: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' } as const,
    glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(212,175,55,0.08)' } as const,
    ring: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' } as const,
    ringDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4AF37', top: -4, left: '50%', marginLeft: -4, shadowColor: '#D4AF37', shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } as const,
    badge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(62,44,91,0.9)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as const,
    badgeText: { fontFamily: 'Cinzel-Regular', fontSize: 9, letterSpacing: 1.5, color: '#D4AF37' } as const,
  }),
};

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1419' },
  radialOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  corner: { position: 'absolute', width: 20, height: 20, opacity: 0.3, zIndex: 5 },
  cornerTL: { top: 60, left: 20, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#D4AF37' },
  cornerTR: { top: 60, right: 20, borderTopWidth: 1, borderRightWidth: 1, borderColor: '#D4AF37' },
  cornerBL: { bottom: 120, left: 20, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: '#D4AF37' },
  cornerBR: { bottom: 120, right: 20, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#D4AF37' },
  skipBtn: { position: 'absolute', top: 54, right: 28, zIndex: 20 },
  skipText: { fontFamily: 'Cinzel-Regular', fontSize: 11, letterSpacing: 2, color: '#C0C0C0', opacity: 0.6 },
  slideContent: { flex: 1, paddingTop: 44 },
  visualArea: { height: 370, alignItems: 'center', justifyContent: 'center' },
  textArea: { flex: 1, paddingHorizontal: 36 },
  useCasesWrapper: { width: SCREEN_WIDTH - 72, gap: 10 },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ornamentLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.3)' },
  ornamentDiamond: { width: 5, height: 5, backgroundColor: '#D4AF37', opacity: 0.6, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: 'Cinzel-Regular', fontSize: 10, letterSpacing: 2.5, color: '#D4AF37', textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 },
  headline: { fontFamily: 'Cinzel-SemiBold', fontSize: 24, color: '#F5F5DC', lineHeight: 32, marginBottom: 18, letterSpacing: -0.2 },
  headlineGold: { color: '#D4AF37', fontFamily: 'Cinzel-SemiBold' },
  body: { fontFamily: 'CrimsonPro-Regular', fontSize: 17, color: '#C0C0C0', lineHeight: 27, letterSpacing: 0.2 },
  footer: { paddingHorizontal: 36, paddingBottom: Platform.OS === 'android' ? 24 : 12, alignItems: 'center', gap: 24 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: '#D4AF37' },
  dotInactive: { width: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
  ctaBtn: { width: '100%', height: 56, backgroundColor: '#D4AF37', borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#D4AF37', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaText: { fontFamily: 'Cinzel-SemiBold', fontSize: 13, letterSpacing: 2, color: '#0F1419', textTransform: 'uppercase' },
});
