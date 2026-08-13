/**
 * NarrativeOnboardingScreen — visual goal setting introduction
 *
 * Six-screen Anchor 1.5 onboarding flow.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { useAuthStore } from '@/stores/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types';
import { colors, typography } from '@/theme';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';
import { getOnboardingProgressPercent } from '@/utils/onboardingProgress';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useFirstAnchorFlowStore, type OnboardingUseCase } from '@/stores/firstAnchorFlowStore';
import { ForgeDemo } from '@/components/onboarding/ForgeDemo';
import { generateTrueSigil } from '@/utils/sigil/traditional-generator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Welcome'>;

const EASE_IN_OUT = Easing.inOut(Easing.ease);
const LABEL_FONT_SIZE = typography.fontSize.xs - 2;
const DETAIL_FONT_SIZE = typography.fontSize.xs - 1;
const MICRO_FONT_SIZE = typography.fontSize.xs - 3;
const BODY_FONT_SIZE = typography.fontSize.md + 1;
const BUTTON_FONT_SIZE = typography.fontSize.xs + 1;
const palette = colors.anchor15;
const LEGACY_FINAL_ANCHOR = generateTrueSigil('Deep work for 4 hours', undefined, 'balanced').svg;

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
  visual: 'orbits' | 'signal' | 'personalize' | 'forge' | 'practice' | 'final';
  cta: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 0,
    label: 'The Problem',
    headline: 'Your brain has **unfinished business.**',
    body: 'Every intention you keep carrying competes for your attention. Anchor gives it somewhere to live.',
    visual: 'orbits',
    cta: 'NEXT',
  },
  {
    id: 1,
    label: 'The Gap',
    headline: 'You have the **will.** Not the trigger.',
    body: 'The intention is there. What’s missing is a cue you can return to — on command.',
    visual: 'signal',
    cta: 'NEXT',
  },
  {
    id: 2,
    label: 'Make it yours',
    headline: 'Let’s build something **specific to you.**',
    body: '',
    visual: 'personalize',
    cta: 'CONTINUE',
  },
  {
    id: 3,
    label: 'The Mechanism',
    headline: 'A symbol becomes a **command.**',
    body: 'Anchor turns your intention into a distinct visual cue.\n\nReturning to it strengthens the association between the symbol and the direction you’ve chosen.',
    visual: 'forge',
    cta: 'NEXT',
  },
  {
    id: 4,
    label: 'The Practice',
    headline: '10 seconds. **Every time.**',
    body: 'Return before the moment that matters — or whenever you need to reconnect with where you’re going.',
    visual: 'practice',
    cta: 'NEXT',
  },
  {
    id: 5,
    label: 'Ready',
    headline: 'Forge your first **anchor.**',
    body: 'Set your intention and seal it.',
    visual: 'final',
    cta: 'FORGE YOUR FIRST ANCHOR →',
  },
];

const PERSONALIZATION_OPTIONS: Array<{
  value: OnboardingUseCase;
  label: string;
  tags: string;
  forgeLabel: string;
}> = [
  { value: 'deep_work', label: 'FOCUS', tags: 'Work · Study · Create', forgeLabel: 'Focus' },
  { value: 'physical', label: 'PERFORMANCE', tags: 'Train · Compete · Execute', forgeLabel: 'Performance' },
  { value: 'high_stakes', label: 'GROWTH', tags: 'Build · Progress · Achieve', forgeLabel: 'Growth' },
  { value: 'personal', label: 'PERSONAL', tags: 'Something uniquely yours', forgeLabel: 'Personal' },
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
          <Stop offset="0%" stopColor={palette.steel} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={palette.ink} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#narrative-onboarding-ambient-bleed)" />
    </Svg>
  </View>
);

// ---------------------------------------------------------------------------
// Visual sub-components
// ---------------------------------------------------------------------------

/** The same restrained geometric mark used by the HTML reference. */
const SigilMark: React.FC<{ size?: number; color?: string }> = ({
  size = 80,
  color = colors.anchor15.gilt,
}) => (
  <Svg width={size} height={size} viewBox="0 0 200 200" fill="none" accessible={false}>
    {[20, 35, 50, 65, 80].map((radius) => (
      <Circle key={radius} cx="100" cy="100" r={radius} stroke={color} strokeWidth="0.8" opacity={0.3} />
    ))}
    <Path
      d="M58 62 L142 62 L72 148"
      stroke={color}
      strokeWidth="6.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M58 62 Q62 74 66 84" stroke={color} strokeWidth="3" strokeLinecap="round" opacity={0.7} />
    <Circle cx="100" cy="100" r="13" stroke={color} strokeWidth="1.8" opacity={0.5} />
  </Svg>
);

const OrbitsVisual: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const rot1 = useRef(new Animated.Value(0)).current;
  const rot2 = useRef(new Animated.Value(0)).current;
  const rot3 = useRef(new Animated.Value(0)).current;
  const words = ['CLARITY', 'DRIVE'];
  const wordAnims = useRef(words.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    if (reduceMotion) {
      rot1.setValue(0);
      rot2.setValue(0);
      rot3.setValue(0);
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
  }, [reduceMotion, rot1, rot2, rot3, wordAnims]);

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
        <SigilMark size={92} />
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
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.72)).current;

  React.useEffect(() => {
    if (reduceMotion) {
      rotation.setValue(0);
      pulse.setValue(0.82);
      return undefined;
    }

    const rotate = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: EASE_IN_OUT, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.72, duration: 1800, easing: EASE_IN_OUT, useNativeDriver: true }),
      ])
    );
    rotate.start();
    breathe.start();
    return () => {
      rotate.stop();
      breathe.stop();
    };
  }, [pulse, reduceMotion, rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={visual.signal.container} accessible={false}>
      <Animated.View style={[visual.signal.ring, { transform: [{ rotate: spin }] }]}>
        <View style={visual.signal.ringDot} />
      </Animated.View>
      <Animated.View style={[visual.signal.innerRing, { opacity: pulse }]} />
      <View style={visual.signal.core}>
        <Text style={visual.signal.coreText}>{'THE\nTRIGGER'}</Text>
      </View>
    </View>
  );
};

const getForgeLabel = (useCase?: OnboardingUseCase): string =>
  PERSONALIZATION_OPTIONS.find((option) => option.value === useCase)?.forgeLabel ?? 'Focus';

const getForgeIntention = (useCase?: OnboardingUseCase): string => {
  switch (useCase) {
    case 'physical': return 'Execute under pressure';
    case 'high_stakes': return 'Build the next version';
    case 'personal': return 'Come back to myself';
    case 'deep_work':
    default: return 'Deep work for 4 hours';
  }
};

const CycleVisual: React.FC<{ reduceMotion: boolean; useCase?: OnboardingUseCase }> = ({
  reduceMotion,
  useCase,
}) => {
  const rotation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    rotation.setValue(0);
    if (reduceMotion) return undefined;

    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={visual.practice.container} accessible={false}>
      <Animated.View style={[visual.practice.orbit, { transform: [{ rotate: spin }] }]}>
        <View style={visual.practice.orbitDot} />
      </Animated.View>
      <View style={visual.practice.ring} />
      <Text style={[visual.practice.label, visual.practice.labelTop]}>Create</Text>
      <Text style={[visual.practice.label, visual.practice.labelLeft]}>Return</Text>
      <Text style={[visual.practice.label, visual.practice.labelRight]}>Reinforce</Text>
      <View style={visual.practice.core}>
        <SigilMark size={58} />
        <Text style={visual.practice.coreTag}>{getForgeLabel(useCase)}</Text>
      </View>
    </View>
  );
};

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
        <SvgXml xml={LEGACY_FINAL_ANCHOR} width={154} height={154} color={palette.gilt} />
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
  const [name, setName] = useState(
    () => useFirstAnchorFlowStore.getState().draft?.onboardingName ?? ''
  );
  const [selectedUseCase, setSelectedUseCase] = useState<OnboardingUseCase | undefined>(
    () => useFirstAnchorFlowStore.getState().draft?.onboardingUseCase
  );
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
    if (currentSlide === 2 && (!name.trim() || !selectedUseCase)) return;

    if (currentSlide < TOTAL - 1) {
      goToSlide(currentSlide + 1);
    } else {
      useFirstAnchorFlowStore.getState().updateDraft({
        onboardingName: name.trim() || undefined,
        onboardingUseCase: selectedUseCase,
      });
      // Complete onboarding and redirect to canonical first-anchor creation.
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
      case 'personalize': return (
        <View style={[styles.personalizeCard, { width: contentWidth }]}>
          <Text style={styles.personalizeLabel}>YOUR NAME</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              useFirstAnchorFlowStore.getState().updateDraft({ onboardingName: value.trim() || undefined });
            }}
            placeholder="Enter your name…"
            placeholderTextColor="rgba(135, 147, 157, 0.72)"
            maxLength={48}
            autoCapitalize="words"
            accessibilityLabel="Your name"
            style={styles.nameInput}
          />
          <Text style={styles.personalizeLabel}>WHAT WILL YOU USE ANCHOR FOR?</Text>
          <View accessibilityRole="radiogroup" style={styles.useCaseChoices}>
            {PERSONALIZATION_OPTIONS.map(({ value, label, tags }) => {
              const useCase = value;
              const selected = selectedUseCase === useCase;
              return (
                <TouchableOpacity
                  key={useCase}
                  onPress={() => {
                    setSelectedUseCase(useCase);
                    useFirstAnchorFlowStore.getState().updateDraft({ onboardingUseCase: useCase });
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  style={[styles.useCaseChoice, selected && styles.useCaseChoiceSelected]}
                >
                  <Text style={[styles.useCaseChoiceLabel, selected && styles.useCaseChoiceLabelSelected]}>{label}</Text>
                  <Text style={[styles.useCaseChoiceTags, selected && styles.useCaseChoiceTagsSelected]}>{tags}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
      case 'forge':     return <ForgeDemo isActive={currentSlide === 3} intention={getForgeIntention(selectedUseCase)} />;
      case 'practice':  return <CycleVisual reduceMotion={reduceMotion} useCase={selectedUseCase} />;
      case 'final':     return wrapSmall(<FinalVisual reduceMotion={reduceMotion} />);
    }
  };

  const slide = SLIDES[currentSlide];
  const displayName = name.trim() || 'You';
  const isCTAUnavailable = currentSlide === 2 && (!name.trim() || !selectedUseCase);
  const displayedBody = slide.body
    ? currentSlide === 3 || currentSlide === 4
      ? `${displayName}, ${slide.body}`
      : currentSlide === TOTAL - 1 && selectedUseCase
        ? `${getForgeLabel(selectedUseCase)} — ${slide.body.charAt(0).toLowerCase()}${slide.body.slice(1)}`
        : slide.body
    : '';
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
            {currentSlide === TOTAL - 1
              ? <><Text>{displayName},{`\n`}</Text>{renderHeadline(slide.headline)}</>
              : renderHeadline(slide.headline)}
          </Text>
          {displayedBody ? (
            <Text style={[styles.body, isCompactLayout && styles.bodyCompact]}>
              {displayedBody}
            </Text>
          ) : null}
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
          style={[styles.ctaBtn, isCTAUnavailable && styles.ctaBtnDisabled]}
          onPress={handleCTA}
          disabled={isCTAUnavailable}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={slide.cta}
        >
          <Text
            style={[styles.ctaText, isCTAUnavailable && styles.ctaTextDisabled]}
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
    ring: { position: 'absolute', borderWidth: 1, borderColor: palette.gilt } as const,
    dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: palette.gilt, top: -3, left: '50%', marginLeft: -3, shadowColor: palette.gilt, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } } as const,
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 176, height: 176 } as const,
    logoAtmosphere: { position: 'absolute', width: 166, height: 166, borderRadius: 83, backgroundColor: withAlpha(palette.steel, 0.62), shadowColor: palette.ink, shadowOpacity: 0.7, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 4 } as const,
    word: { position: 'absolute', fontFamily: typography.fonts.heading, fontSize: DETAIL_FONT_SIZE, color: palette.gilt, letterSpacing: 1.5 } as const,
  }),
  signal: StyleSheet.create({
    container: { width: 320, height: 320, position: 'relative', alignItems: 'center', justifyContent: 'center' } as const,
    ring: { position: 'absolute', width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(palette.gilt, 0.18), alignItems: 'center' } as const,
    ringDot: { position: 'absolute', top: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.gilt, shadowColor: palette.gilt, shadowRadius: 6, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 }, elevation: 4 } as const,
    innerRing: { position: 'absolute', width: 228, height: 228, borderRadius: 114, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.12) } as const,
    core: { width: 142, height: 142, borderRadius: 71, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.22), backgroundColor: withAlpha(palette.veil, 0.92), alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 8 } as const,
    coreText: { fontFamily: typography.fonts.heading, fontSize: DETAIL_FONT_SIZE - 1, letterSpacing: 2.1, lineHeight: 16, color: palette.giltBright, textAlign: 'center' } as const,
  }),
  practice: StyleSheet.create({
    container: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' } as const,
    orbit: { position: 'absolute', width: 256, height: 256, borderRadius: 128, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.18), alignItems: 'center' } as const,
    orbitDot: { position: 'absolute', top: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: palette.gilt, shadowColor: palette.gilt, shadowOpacity: 0.8, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 4 } as const,
    ring: { position: 'absolute', width: 192, height: 192, borderRadius: 96, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.12) } as const,
    label: { position: 'absolute', fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 1.4, color: withAlpha(palette.giltBright, 0.82), textTransform: 'uppercase' } as const,
    labelTop: { top: 20 } as const,
    labelLeft: { left: 14, top: 155 } as const,
    labelRight: { right: 8, top: 155 } as const,
    core: { width: 118, height: 118, borderRadius: 59, backgroundColor: withAlpha(palette.veil, 0.94), borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.22), alignItems: 'center', justifyContent: 'center' } as const,
    coreTag: { marginTop: 2, fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.3, color: palette.gilt, textTransform: 'uppercase' } as const,
  }),
  final: StyleSheet.create({
    container: { width: 320, height: 320, alignItems: 'center', justifyContent: 'center', position: 'relative' } as const,
    glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: withAlpha(palette.gilt, 0.06) } as const,
    ring: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.2) } as const,
    ringDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: palette.gilt, top: -4, left: '50%', marginLeft: -4, shadowColor: palette.gilt, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } } as const,
    badge: { position: 'absolute', bottom: -3, alignSelf: 'center', backgroundColor: withAlpha(palette.steel, 0.96), borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.3), borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 } as const,
    badgeText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.1, color: palette.gilt } as const,
  }),
};

// ---------------------------------------------------------------------------
// Main styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  ambientBleed: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', zIndex: 0 },
  corner: { position: 'absolute', width: 24, height: 24, opacity: 0.26, zIndex: 5 },
  cornerTL: { left: 36, borderTopWidth: 1, borderLeftWidth: 1, borderColor: withAlpha(palette.gilt, 0.8) },
  cornerTR: { right: 36, borderTopWidth: 1, borderRightWidth: 1, borderColor: withAlpha(palette.gilt, 0.8) },
  cornerBL: { left: 36, borderBottomWidth: 1, borderLeftWidth: 1, borderColor: withAlpha(palette.gilt, 0.8) },
  cornerBR: { right: 36, borderBottomWidth: 1, borderRightWidth: 1, borderColor: withAlpha(palette.gilt, 0.8) },
  signInBtn: { position: 'absolute', top: 54, left: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(palette.gilt, 0.55), backgroundColor: withAlpha(palette.gilt, 0.08) },
  signInBtnText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 1.8, color: palette.gilt },
  skipBtn: { position: 'absolute', top: 54, right: 20, zIndex: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: withAlpha(palette.bone, 0.18), backgroundColor: withAlpha(palette.bone, 0.05) },
  skipText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE + 1, letterSpacing: 2, color: palette.ash },
  devSkipBtn: { position: 'absolute', top: 92, alignSelf: 'center', zIndex: 20, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: withAlpha(palette.ash, 0.36), backgroundColor: withAlpha(palette.ash, 0.06) },
  devSkipBtnText: { fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.5, color: palette.ash },
  slideContent: { flex: 1, paddingTop: 44 },
  slideContentCompact: { paddingTop: 32 },
  slideContentShort: { paddingTop: 28 },
  visualArea: { height: 370, alignItems: 'center', justifyContent: 'center' },
  textArea: { flex: 1, paddingHorizontal: 36, paddingBottom: 4 },
  textAreaCompact: { paddingHorizontal: 24 },
  personalizeCard: {
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.20)',
    backgroundColor: 'rgba(15, 20, 25, 0.72)',
    padding: 18,
    gap: 11,
  },
  personalizeLabel: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.ritual, fontSize: 9, letterSpacing: 1.65 },
  nameInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.13)',
    color: colors.anchor15.bone,
    backgroundColor: 'rgba(244, 239, 230, 0.035)',
    fontFamily: typography.fontFamily.voice,
    fontSize: 18,
  },
  useCaseChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  useCaseChoice: {
    width: '48%',
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.12)',
    backgroundColor: 'rgba(244, 239, 230, 0.025)',
  },
  useCaseChoiceSelected: { borderColor: 'rgba(242, 223, 168, 0.58)', backgroundColor: 'rgba(217, 179, 108, 0.12)' },
  useCaseChoiceLabel: { color: colors.anchor15.gilt, fontFamily: typography.fontFamily.ritual, fontSize: 10, letterSpacing: 1.4, marginBottom: 6 },
  useCaseChoiceLabelSelected: { color: colors.anchor15.giltBright },
  useCaseChoiceTags: { color: colors.anchor15.ash, fontFamily: typography.fontFamily.voiceItalic, fontSize: 12, lineHeight: 15 },
  useCaseChoiceTagsSelected: { color: colors.anchor15.giltBright },
  ornament: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  ornamentLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: withAlpha(palette.gilt, 0.3) },
  ornamentDiamond: { width: 5, height: 5, backgroundColor: palette.gilt, opacity: 0.6, transform: [{ rotate: '45deg' }] },
  label: { fontFamily: typography.fonts.heading, fontSize: LABEL_FONT_SIZE, letterSpacing: 2.5, color: palette.gilt, textTransform: 'uppercase', marginBottom: 14, opacity: 0.8 },
  headline: { fontFamily: typography.fonts.headingSemiBold, fontSize: typography.sizes.h2, color: palette.bone, lineHeight: typography.lineHeights.h2, marginBottom: 18, letterSpacing: -0.2 },
  headlineCompact: { fontSize: 26, lineHeight: 32, marginBottom: 12 },
  headlineGold: { color: palette.giltBright, fontFamily: typography.fonts.headingSemiBold },
  body: { fontFamily: typography.fontFamily.sans, fontSize: BODY_FONT_SIZE, color: palette.ash, lineHeight: 27, letterSpacing: 0.2 },
  bodyCompact: { fontSize: BODY_FONT_SIZE, lineHeight: 24 },
  footer: { paddingHorizontal: 36, paddingBottom: Platform.OS === 'android' ? 24 : 12, alignItems: 'center', gap: 24 },
  footerShort: { paddingBottom: Platform.OS === 'android' ? 16 : 12, gap: 16 },
  footerCompact: { paddingHorizontal: 24, gap: 18 },
  progressGroup: { width: '100%', gap: 7 },
  progressTrack: { width: '100%', height: 3, borderRadius: 2, backgroundColor: withAlpha(palette.bone, 0.14), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: palette.gilt },
  progressText: { alignSelf: 'center', fontFamily: typography.fonts.heading, fontSize: MICRO_FONT_SIZE, letterSpacing: 1.8, color: withAlpha(palette.bone, 0.5) },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 24, backgroundColor: palette.gilt },
  dotInactive: { width: 6, backgroundColor: withAlpha(palette.bone, 0.2) },
  ctaBtn: { width: '100%', height: 56, backgroundColor: palette.gilt, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: palette.gilt, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  ctaBtnDisabled: { backgroundColor: withAlpha(palette.bone, 0.04), borderWidth: 1, borderColor: withAlpha(palette.bone, 0.12), shadowOpacity: 0, elevation: 0 },
  ctaText: { fontFamily: typography.fonts.headingSemiBold, fontSize: BUTTON_FONT_SIZE, letterSpacing: 2, color: palette.ink, textTransform: 'uppercase' },
  ctaTextDisabled: { color: withAlpha(palette.ash, 0.56) },
});
