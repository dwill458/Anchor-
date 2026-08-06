/**
 * NarrativeOnboardingScreen — visual goal setting introduction
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuthStore } from '@/stores/authStore';
import { ForgeDemo } from '@/components/onboarding/ForgeDemo';
import { UseCaseCard } from '@/components/onboarding/UseCaseCard';
import type { UseCaseItem } from '@/components/onboarding/UseCaseCard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';
import { getOnboardingProgressPercent } from '@/utils/onboardingProgress';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const anchorLogoOfficial = require('../../assets/images/anchor-visual-goal-setting-logo.png') as number;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

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
    label: '01 / THE PROBLEM',
    headline: 'YOUR GOALS GET\n**LOST IN THE NOISE.**',
    body: 'Even a clear intention can fade once the day begins. Without something visible to return to, distraction takes over.',
    visual: 'orbits',
    cta: 'Next',
  },
  {
    id: 1,
    label: '02 / THE GAP',
    headline: 'THE GOAL ISN’T THE\nPROBLEM. **THE CUE IS.**',
    body: 'You know what you want. What’s missing is a visual cue you can return to before doubt or distraction takes over.',
    visual: 'signal',
    cta: 'Next',
  },
  {
    id: 2,
    label: '03 / THE MECHANISM',
    headline: 'ANCHOR TURNS YOUR\nINTENTION INTO A\nPERSONAL **VISUAL CUE.**',
    body: 'This is visual goal setting made personal. Your words become a unique symbol you can return to at a glance.',
    visual: 'forge',
    cta: 'Next',
  },
  {
    id: 3,
    label: '04 / THE PRACTICE',
    headline: 'USE IT BEFORE THE\n**MOMENTS THAT MATTER.**',
    body: 'Not a reminder. A primer. Return to your Anchor before deep work, training, or any moment that demands your full attention.',
    visual: 'usecases',
    cta: 'Next',
  },
  {
    id: 4,
    label: '05 / BEGIN',
    headline: 'CREATE YOUR FIRST\n**ANCHOR NOW.**',
    body: 'Start with one intention. Turn it into a visual anchor you can practice with and return to throughout your day.',
    visual: 'final',
    cta: 'CREATE YOUR FIRST ANCHOR →',
  },
];

const USE_CASES: UseCaseItem[] = [
  { label: 'DEEP WORK', description: 'Before a focused work session', iconType: 'code' },
  { label: 'PHYSICAL', description: 'Before training or pursuing a new personal best', iconType: 'lift' },
  { label: 'HIGH STAKES', description: 'Before a pitch, presentation, or interview', iconType: 'pitch' },
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

const OrbitsVisual: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;
  const logoLight = useRef(new Animated.Value(0.55)).current;
  const words = ['CLARITY', 'DRIVE'];
  const wordAnims = useRef(words.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    if (reduceMotion) {
      rot1.setValue(0);
      rot2.setValue(0);
      rot3.setValue(0);
      logoLight.setValue(0.7);
      wordAnims.forEach((animation) => animation.setValue(0.1));
      return undefined;
    }

    const makeOrbit = (val: Animated.Value, dur: number, reverse = false) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: reverse ? -1 : 1,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

    const animations: Animated.CompositeAnimation[] = [
      makeOrbit(rot1, 24000),
      makeOrbit(rot2, 18000, true),
      makeOrbit(rot3, 14000),
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoLight, { toValue: 1, duration: 2200, easing: EASE_IN_OUT, useNativeDriver: true }),
          Animated.timing(logoLight, { toValue: 0.5, duration: 2200, easing: EASE_IN_OUT, useNativeDriver: true }),
        ])
      ),
    ];

    wordAnims.forEach((anim, i) => {
      animations.push(Animated.loop(
        Animated.sequence([
          Animated.delay(i * 800),
          Animated.timing(anim, { toValue: 0.13, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.04, duration: 1800, useNativeDriver: true }),
          Animated.delay(1800),
        ])
      ));
    });

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [logoLight, reduceMotion, rot1, rot2, rot3, wordAnims]);

  const spin = (val: Animated.Value) =>
    val.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  const POSITIONS: Array<object> = [
    { top: '14%', left: '7%' },
    { bottom: '22%', right: '8%' },
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
          accessible={false}
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
        <View style={visual.orbits.logoAtmosphere} />
        <Image
          source={anchorLogoOfficial}
          style={visual.orbits.logo}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Anchor visual goal setting logo"
        />
        <Animated.View pointerEvents="none" style={[visual.orbits.logoLight, { opacity: logoLight }]} />
      </View>

      {words.map((word, i) => (
        <Animated.Text
          key={word}
          accessible={false}
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

const SignalVisual: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const haloOpacity = useRef(new Animated.Value(0.5)).current;
  const outerOrbitRotation = useRef(new Animated.Value(0)).current;
  const innerOrbitRotation = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.85)).current;
  const glowOpacity = useRef(new Animated.Value(0.6)).current;
  const coronaScale = useRef(new Animated.Value(0.9)).current;
  const coronaOpacity = useRef(new Animated.Value(0.3)).current;
  const seedOpacity = useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    if (reduceMotion) {
      haloOpacity.setValue(0.7);
      outerOrbitRotation.setValue(0);
      innerOrbitRotation.setValue(0);
      glowScale.setValue(1);
      glowOpacity.setValue(0.7);
      coronaScale.setValue(1);
      coronaOpacity.setValue(0.45);
      seedOpacity.setValue(0.75);
      return undefined;
    }

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

    return () => animations.forEach((animation) => animation.stop());
  }, [coronaOpacity, coronaScale, glowOpacity, glowScale, haloOpacity, innerOrbitRotation, outerOrbitRotation, reduceMotion, seedOpacity]);

  const outerSpin = outerOrbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerSpin = innerOrbitRotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={visual.signal.container} accessible={false}>
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
const successAnchor = require('../../../assets/success_anchor_onboarding.png') as number;

const FinalVisual: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const ringRot = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      ringRot.setValue(0);
      return undefined;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const ringAnimation = Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 28000, easing: Easing.linear, useNativeDriver: true })
    );
    pulseAnimation.start();
    ringAnimation.start();
    return () => {
      pulseAnimation.stop();
      ringAnimation.stop();
    };
  }, [pulse, reduceMotion, ringRot]);

  const spin = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={visual.final.container} accessible={false}>
      <View style={visual.final.glow} />
      <Animated.View style={[visual.final.ring, { transform: [{ rotate: spin }] }]}>
        <View style={visual.final.ringDot} />
      </Animated.View>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image source={successAnchor} style={{ width: 200, height: 200, borderRadius: 100 }} resizeMode="contain" accessible={false} />
      </Animated.View>
      <View style={visual.final.badge}>
        <Text style={visual.final.badgeText}>1 INTENTION → 1 ANCHOR</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Corner accents + ornament
// ---------------------------------------------------------------------------

const CornerAccents: React.FC<{ topOffset: number; bottomOffset: number }> = ({
  topOffset,
  bottomOffset,
}) => (
  <>
    <View style={[styles.corner, styles.cornerTL, { top: topOffset }]} />
    <View style={[styles.corner, styles.cornerTR, { top: topOffset }]} />
    <View style={[styles.corner, styles.cornerBL, { bottom: bottomOffset }]} />
    <View style={[styles.corner, styles.cornerBR, { bottom: bottomOffset }]} />
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
  const { completeOnboarding, setShouldRedirectToCreation, setIsGuest } = useAuthStore();
  const reduceMotion = useReduceMotionEnabled();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isShortScreen = isShortPhoneViewport(height);
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const contentWidth = Math.min(width - (isCompactLayout ? 48 : 72), 360);
  const compactVisualScale = Math.max(0.76, Math.min(0.94, (height * 0.31) / 320));
  const visualScale = isCompactLayout ? compactVisualScale : 1;
  const visualAreaHeight = isCompactLayout ? Math.round(height * (isShortScreen ? 0.34 : 0.37)) : 370;

  const [currentSlide, setCurrentSlide] = useState(0);
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const transitioning = useRef(false);

  const goToSlide = useCallback(
    (index: number) => {
      if (transitioning.current || index === currentSlide) return;
      transitioning.current = true;

      Animated.timing(slideOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(index);
        Animated.timing(slideOpacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : 200,
          useNativeDriver: true,
        }).start(() => {
          transitioning.current = false;
        });
      });
    },
    [currentSlide, reduceMotion, slideOpacity]
  );

  const handleCTA = () => {
    if (currentSlide < TOTAL - 1) {
      goToSlide(currentSlide + 1);
    } else {
      // Slide 4 — complete onboarding, redirect to first anchor creation
      setShouldRedirectToCreation(true);
      completeOnboarding();
      // RootNavigator switches to Main automatically on hasCompletedOnboarding change
    }
  };

  const handleSkip = () => goToSlide(TOTAL - 1);

  const handleDevSkipToHome = () => {
    // Dev-build only: jump straight to Home with no account, bypassing onboarding entirely.
    setIsGuest(true);
    setShouldRedirectToCreation(false);
    completeOnboarding();
  };

  const renderVisual = (slide: OnboardingSlide) => {
    const scaledSize = Math.round(visualScale * 320);
    const wrapSmall = (child: React.ReactNode): React.ReactNode =>
      isCompactLayout ? (
        <View style={{ width: scaledSize, height: scaledSize, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={{ transform: [{ scale: visualScale }] }}>
            {child}
          </View>
        </View>
      ) : child;

    switch (slide.visual) {
      case 'orbits':    return wrapSmall(<OrbitsVisual reduceMotion={reduceMotion} />);
      case 'signal':    return wrapSmall(<SignalVisual reduceMotion={reduceMotion} />);
      case 'forge':     return <ForgeDemo isActive={currentSlide === 2} />;
      case 'usecases':  return (
        <View style={[styles.useCasesWrapper, { width: contentWidth }]}>
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
      case 'final':     return wrapSmall(<FinalVisual reduceMotion={reduceMotion} />);
    }
  };

  const slide = SLIDES[currentSlide];
  const slideProgressPercent = getOnboardingProgressPercent(currentSlide, TOTAL);

  return (
    <SafeAreaView style={styles.container}>
      <AmbientBleed />

      <CornerAccents
        topOffset={insets.top + 68}
        bottomOffset={insets.bottom + 104}
      />

      {/* Returning-user sign-in — only visible on the very first slide */}
      {currentSlide === 0 && (
        <TouchableOpacity
          style={styles.signInBtn}
          onPress={() => navigation.navigate('Login')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Sign in to Anchor"
        >
          <Text style={styles.signInBtnText} maxFontSizeMultiplier={1.3}>Sign In</Text>
        </TouchableOpacity>
      )}

      {currentSlide < TOTAL - 1 && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={styles.skipText} maxFontSizeMultiplier={1.3}>SKIP</Text>
        </TouchableOpacity>
      )}

      {/* Dev-build only bypass — jumps straight to Home, no account created */}
      {__DEV__ && currentSlide === 0 && (
        <TouchableOpacity
          style={styles.devSkipBtn}
          onPress={handleDevSkipToHome}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.devSkipBtnText}>DEV: SKIP TO HOME</Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[
          styles.slideContent,
          isCompactLayout && styles.slideContentCompact,
          isShortScreen && styles.slideContentShort,
          { opacity: slideOpacity },
        ]}
      >
        <View style={[styles.visualArea, { height: visualAreaHeight }]}>
          {renderVisual(slide)}
        </View>

        <View style={[styles.textArea, isCompactLayout && styles.textAreaCompact]}>
          <Ornament />
          <Text style={styles.label}>{slide.label}</Text>
          <Text
            style={[
              styles.headline,
              isCompactLayout && styles.headlineCompact,
            ]}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
          >
            {renderHeadline(slide.headline)}
          </Text>
          <Text style={[styles.body, isCompactLayout && styles.bodyCompact]}>
            {slide.body}
          </Text>
        </View>
      </Animated.View>

      <View
        style={[
          styles.footer,
          isCompactLayout && styles.footerShort,
          isCompactLayout && styles.footerCompact,
        ]}
      >
        <View
          style={styles.progressGroup}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: TOTAL,
            now: currentSlide + 1,
            text: `Slide ${currentSlide + 1} of ${TOTAL}`,
          }}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${slideProgressPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            SLIDE {currentSlide + 1} OF {TOTAL}
          </Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => goToSlide(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Go to slide ${i + 1}: ${SLIDES[i].label.replace(/^\d+\s\/\s/, '')}`}
              accessibilityState={{ selected: i === currentSlide }}
            >
              <View style={[styles.dot, i === currentSlide ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={handleCTA}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={slide.cta}
        >
          <Text
            style={styles.ctaText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {slide.cta}
          </Text>
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
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 176, height: 176 } as const,
    logoAtmosphere: { position: 'absolute', width: 166, height: 166, borderRadius: 83, backgroundColor: withAlpha(colors.deepPurple, 0.52), shadowColor: colors.deepPurple, shadowOpacity: 0.85, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 4 } as const,
    logo: { width: 160, height: 160, zIndex: 1 } as const,
    logoLight: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold, zIndex: 2, shadowColor: colors.gold, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 } as const,
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
    badge: { position: 'absolute', bottom: -3, alignSelf: 'center', backgroundColor: withAlpha(colors.deepPurple, 0.9), borderWidth: 1, borderColor: withAlpha(colors.gold, 0.3), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as const,
    badgeText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.1, color: colors.gold } as const,
  }),
};

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  ambientBleed: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', zIndex: 0 },
  corner: { position: 'absolute', width: 24, height: 24, opacity: 0.26, zIndex: 5 },
  cornerTL: { left: 36, borderTopWidth: 1, borderLeftWidth: 1, borderColor: withAlpha(colors.gold, 0.8) },
  cornerTR: { right: 36, borderTopWidth: 1, borderRightWidth: 1, borderColor: withAlpha(colors.gold, 0.8) },
  cornerBL: { left: 36, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: withAlpha(colors.gold, 0.8) },
  cornerBR: { right: 36, borderBottomWidth: 1, borderRightWidth: 1, borderColor: withAlpha(colors.gold, 0.8) },
  signInBtn: { position: 'absolute', top: 54, left: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(colors.gold, 0.55), backgroundColor: withAlpha(colors.gold, 0.08) },
  signInBtnText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 1.8, color: colors.gold },
  skipBtn: { position: 'absolute', top: 54, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(colors.bone, 0.18), backgroundColor: withAlpha(colors.bone, 0.05) },
  skipText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 2, color: colors.silver },
  devSkipBtn: { position: 'absolute', top: 92, alignSelf: 'center', zIndex: 20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,90,90,0.5)', backgroundColor: 'rgba(255,90,90,0.08)' },
  devSkipBtnText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.5, color: '#FF5A5A' },
  slideContent: { flex: 1, paddingTop: 44 },
  slideContentCompact: { paddingTop: 32 },
  slideContentShort: { paddingTop: 28 },
  visualArea: { height: 370, alignItems: 'center', justifyContent: 'center' },
  textArea: { flex: 1, paddingHorizontal: 36, paddingBottom: 4 },
  textAreaCompact: { paddingHorizontal: 24 },
  useCasesWrapper: { gap: 10, alignSelf: 'center' },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ornamentLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.gold, 0.3) },
  ornamentDiamond: { width: 5, height: 5, backgroundColor: colors.gold, opacity: 0.6, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: typography.fonts.heading, fontSize: LABEL_FONT_SIZE, letterSpacing: 2.5, color: colors.gold, textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 },
  headline: { fontFamily: typography.fonts.headingSemiBold, fontSize: typography.sizes.h2, color: colors.bone, lineHeight: typography.lineHeights.h2, marginBottom: 18, letterSpacing: -0.2 },
  headlineCompact: { fontSize: 26, lineHeight: 32, marginBottom: 12 },
  headlineGold: { color: colors.gold, fontFamily: typography.fonts.headingSemiBold },
  body: { fontFamily: typography.fontFamily.sans, fontSize: BODY_FONT_SIZE, color: colors.silver, lineHeight: 27, letterSpacing: 0.2 },
  bodyCompact: { fontSize: BODY_FONT_SIZE, lineHeight: 24 },
  footer: { paddingHorizontal: 36, paddingBottom: Platform.OS === 'android' ? 24 : 12, alignItems: 'center', gap: 24 },
  footerShort: { paddingBottom: Platform.OS === 'android' ? 16 : 12, gap: 16 },
  footerCompact: { paddingHorizontal: 24, gap: 18 },
  progressGroup: { width: '100%', gap: 7 },
  progressTrack: { width: '100%', height: 3, borderRadius: 2, backgroundColor: withAlpha(colors.bone, 0.14), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.gold },
  progressText: { alignSelf: 'center', fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.8, color: withAlpha(colors.bone, 0.5) },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: colors.gold },
  dotInactive: { width: 6, backgroundColor: withAlpha(colors.bone, 0.2) },
  ctaBtn: { width: '100%', height: 56, backgroundColor: colors.gold, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: colors.gold, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaText: { fontFamily: typography.fonts.headingSemiBold, fontSize: BUTTON_FONT_SIZE, letterSpacing: 2, color: colors.navy, textTransform: 'uppercase' },
});
