import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';
import { ForgeDemo } from '@/components/onboarding/ForgeDemo';
const anchorLogoImg = require('../../../assets/anchor-logo-official.jpg');
import { UseCaseCard } from '@/components/onboarding/UseCaseCard';
import type { UseCaseItem } from '@/components/onboarding/UseCaseCard';

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
    headline: 'The goal isn\'t the problem. **The trigger is.**',
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

/** Splits on **bold** markers and renders the inner segment in gold. */
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

/** Slide 0: three concentric orbit rings with floating word fragments. */
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
          Animated.delay(4000 - 800 * i > 0 ? 4000 - 800 * i : 400),
        ])
      ).start();
    });
  }, [rot1, rot2, rot3, wordAnims]);

  const spin = (val: Animated.Value) =>
    val.interpolate({ inputRange: [-1, 1], outputRange: ['-360deg', '360deg'] });

  const POSITIONS = [
    { top: '10%', left: '5%' },
    { top: '20%', right: '8%' },
    { bottom: '28%', left: '6%' },
    { bottom: '18%', right: '6%' },
    { top: '48%', left: '0%' },
  ];

  return (
    <View style={visual.orbits.container}>
      {/* Rings */}
      {[
        { size: 220, anim: rot1, opacity: 0.5 },
        { size: 180, anim: rot2, opacity: 0.4 },
        { size: 140, anim: rot3, opacity: 0.3 },
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
          {/* Dot at top of ring */}
          <View style={visual.orbits.dot} />
        </Animated.View>
      ))}

      {/* Center anchor image */}
      <View style={visual.orbits.center}>
        <Image
          source={anchorLogoImg}
          style={{ width: 64, height: 64 }}
          resizeMode="contain"
        />
      </View>

      {/* Floating word fragments */}
      {words.map((word, i) => (
        <Animated.Text
          key={word}
          style={[
            visual.orbits.word,
            POSITIONS[i] as object,
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

/** Slide 1: signal pulse lines + "NO TRIGGER" center. */
const SignalVisual: React.FC = () => {
  const lines = useRef([0, 1, 2, 3].map(() => ({
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }))).current;

  const ringRot = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    lines.forEach(({ scale, opacity }, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 1500, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.6, duration: 750, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0, duration: 1500, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 750, useNativeDriver: true }),
          ]),
          Animated.delay(1200),
        ])
      ).start();
    });

    Animated.loop(
      Animated.timing(ringRot, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [lines, ringRot]);

  const spin = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const LINE_CONFIGS = [
    { width: '100%', left: '0%' },
    { width: '80%', left: '10%' },
    { width: '90%', left: '5%' },
    { width: '70%', left: '15%' },
  ];
  const LINE_TOPS = ['25%', '40%', '55%', '70%'];

  return (
    <View style={visual.signal.container}>
      {/* Signal lines */}
      {lines.map(({ scale, opacity }, i) => (
        <Animated.View
          key={i}
          style={[
            visual.signal.line,
            { top: LINE_TOPS[i], width: LINE_CONFIGS[i].width, left: LINE_CONFIGS[i].left, opacity, transform: [{ scaleX: scale }] },
          ]}
        />
      ))}

      {/* Center circle */}
      <View style={visual.signal.centerWrap}>
        <Animated.View style={[visual.signal.dashRing, { transform: [{ rotate: spin }] }]} />
        <View style={visual.signal.center}>
          <Text style={visual.signal.centerText}>{'NO\nTRIGGER'}</Text>
        </View>
      </View>
    </View>
  );
};

/** Slide 4: pulsing sigil + orbit ring + badge. */
const FinalVisual: React.FC = () => {
  const sigilSvg = React.useMemo(
    () => generateTrueSigil('Deep work for 4 hours', 'balanced').svg,
    []
  );
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
      {/* Glow bg */}
      <View style={visual.final.glow} />

      {/* Orbit ring */}
      <Animated.View style={[visual.final.ring, { transform: [{ rotate: spin }] }]}>
        <View style={visual.final.ringDot} />
      </Animated.View>

      {/* Sigil */}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <SvgXml xml={sigilSvg} width={120} height={120} color="#D4AF37" />
      </Animated.View>

      {/* Badge */}
      <View style={visual.final.badge}>
        <Text style={visual.final.badgeText}>30 SEC TO FORGE</Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Corner accents (L-shaped, all four corners)
// ---------------------------------------------------------------------------
const CornerAccents: React.FC = () => (
  <>
    <View style={[styles.corner, styles.cornerTL]} />
    <View style={[styles.corner, styles.cornerTR]} />
    <View style={[styles.corner, styles.cornerBL]} />
    <View style={[styles.corner, styles.cornerBR]} />
  </>
);

// ---------------------------------------------------------------------------
// Ornament divider (line — ◆ — line)
// ---------------------------------------------------------------------------
const Ornament: React.FC = () => (
  <View style={styles.ornament}>
    <View style={styles.ornamentLine} />
    <View style={styles.ornamentDiamond} />
    <View style={[styles.ornamentLine, styles.ornamentLineRight]} />
  </View>
);

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
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
      // Slide 4 — "Forge Your First Anchor →"
      setShouldRedirectToCreation(true);
      completeOnboarding();
      // @ts-expect-error navigation types
      navigation.replace('Main');
    }
  };

  const handleSkip = () => goToSlide(TOTAL - 1);

  // ---------------------------------------------------------------------------
  // Slide content renderers
  // ---------------------------------------------------------------------------
  const renderVisual = (slide: OnboardingSlide) => {
    switch (slide.visual) {
      case 'orbits':
        return <OrbitsVisual />;
      case 'signal':
        return <SignalVisual />;
      case 'forge':
        return <ForgeDemo isActive={currentSlide === 2} />;
      case 'usecases':
        return (
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
      case 'final':
        return <FinalVisual />;
    }
  };

  const slide = SLIDES[currentSlide];

  return (
    <SafeAreaView style={styles.container}>
      {/* Background radial overlay */}
      <LinearGradient
        colors={['rgba(62,44,91,0.4)', 'transparent']}
        style={styles.radialOverlay}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <CornerAccents />

      {/* Skip button — hidden on last slide */}
      {currentSlide < TOTAL - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipText}>SKIP</Text>
        </TouchableOpacity>
      )}

      {/* Slide content */}
      <Animated.View style={[styles.slideContent, { opacity: slideOpacity }]}>
        {/* Visual area */}
        <View style={styles.visualArea}>
          {renderVisual(slide)}
        </View>

        {/* Text area */}
        <View style={styles.textArea}>
          <Ornament />
          <Text style={styles.label}>{slide.label}</Text>
          <Text style={styles.headline}>
            {renderHeadline(slide.headline)}
          </Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>
      </Animated.View>

      {/* Navigation footer */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={[styles.dot, i === currentSlide ? styles.dotActive : styles.dotInactive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
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
    container: {
      width: 260,
      height: 260,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    } as const,
    ring: {
      position: 'absolute',
      borderWidth: 1,
      borderColor: '#D4AF37',
    } as const,
    dot: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#D4AF37',
      top: -3,
      left: '50%',
      marginLeft: -3,
      shadowColor: '#D4AF37',
      shadowOpacity: 0.8,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
    } as const,
    center: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    } as const,
    word: {
      position: 'absolute',
      fontFamily: 'Cinzel-Regular',
      fontSize: 11,
      color: '#D4AF37',
      letterSpacing: 1.5,
    } as const,
  }),

  signal: StyleSheet.create({
    container: {
      width: 280,
      height: 280,
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    } as const,
    line: {
      position: 'absolute',
      height: 1,
      backgroundColor: '#D4AF37',
    } as const,
    centerWrap: {
      width: 110,
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    } as const,
    dashRing: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      borderWidth: 1,
      borderColor: 'rgba(212,175,55,0.2)',
      borderStyle: 'dashed',
    } as const,
    center: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 1,
      borderColor: 'rgba(212,175,55,0.3)',
      backgroundColor: 'rgba(62,44,91,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    } as const,
    centerText: {
      fontFamily: 'Cinzel-Regular',
      fontSize: 10,
      letterSpacing: 2,
      color: '#D4AF37',
      textAlign: 'center',
      lineHeight: 16,
      opacity: 0.8,
    } as const,
  }),

  final: StyleSheet.create({
    container: {
      width: 220,
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    } as const,
    glow: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(212,175,55,0.08)',
    } as const,
    ring: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: 'rgba(212,175,55,0.2)',
    } as const,
    ringDot: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#D4AF37',
      top: -4,
      left: '50%',
      marginLeft: -4,
      shadowColor: '#D4AF37',
      shadowOpacity: 0.9,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
    } as const,
    badge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(62,44,91,0.9)',
      borderWidth: 1,
      borderColor: 'rgba(212,175,55,0.3)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
    } as const,
    badgeText: {
      fontFamily: 'Cinzel-Regular',
      fontSize: 9,
      letterSpacing: 1.5,
      color: '#D4AF37',
    } as const,
  }),
};

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  radialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  // Corner L-shapes
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    opacity: 0.3,
    zIndex: 5,
  },
  cornerTL: {
    top: 60,
    left: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#D4AF37',
  },
  cornerTR: {
    top: 60,
    right: 20,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D4AF37',
  },
  cornerBL: {
    bottom: 120,
    left: 20,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#D4AF37',
  },
  cornerBR: {
    bottom: 120,
    right: 20,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D4AF37',
  },
  skipBtn: {
    position: 'absolute',
    top: 54,
    right: 28,
    zIndex: 20,
  },
  skipText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 11,
    letterSpacing: 2,
    color: '#C0C0C0',
    opacity: 0.6,
  },
  slideContent: {
    flex: 1,
    paddingTop: 44,
  },
  visualArea: {
    height: 340,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    flex: 1,
    paddingHorizontal: 36,
  },
  useCasesWrapper: {
    width: SCREEN_WIDTH - 72,
    gap: 10,
  },
  // Ornament
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  ornamentLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'transparent',
    // gradient achieved via pseudo-approach: just use semi-transparent gold
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.3)',
  },
  ornamentLineRight: {
    // same — both sides look symmetric
  },
  ornamentDiamond: {
    width: 5,
    height: 5,
    backgroundColor: '#D4AF37',
    opacity: 0.6,
    transform: [{ rotate: '45deg' }],
  },
  // Text
  label: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 10,
    letterSpacing: 2.5,
    color: '#D4AF37',
    textTransform: 'uppercase',
    marginBottom: 14,
    opacity: 0.8,
  },
  headline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 24,
    color: '#F5F5DC',
    lineHeight: 32,
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  headlineGold: {
    color: '#D4AF37',
    fontFamily: 'Cinzel-SemiBold',
  },
  body: {
    fontFamily: 'CrimsonPro-Regular',
    fontSize: 17,
    color: '#C0C0C0',
    lineHeight: 27,
    letterSpacing: 0.2,
  },
  // Footer
  footer: {
    paddingHorizontal: 36,
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
    alignItems: 'center',
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#D4AF37',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ctaBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#D4AF37',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 13,
    letterSpacing: 2,
    color: '#0F1419',
    textTransform: 'uppercase',
  },
});
