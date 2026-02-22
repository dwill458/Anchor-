import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LetterDistillation'>;
  route: RouteProp<RootStackParamList, 'LetterDistillation'>;
};

type StageStyle = 'sentence' | 'spaced' | 'large' | 'glyph';

interface Stage {
  phase: string;
  label: string;
  subtitle: string;
  text: string;
  style: StageStyle;
  duration: number;
  typeSpeed: number;
}

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export default function LetterDistillationScreen({ route, navigation }: Props) {
  const { intentionText, distilledLetters, category } = route.params;
  const { user, anchorCount } = useAuthStore((state) => ({
    user: state.user,
    anchorCount: state.anchorCount,
  }));

  const normalizedLetters = useMemo(
    () => distilledLetters.map((letter) => letter.toUpperCase()),
    [distilledLetters]
  );
  const consonants = useMemo(
    () => normalizedLetters.filter((letter) => !VOWELS.has(letter)),
    [normalizedLetters]
  );

  const stages = useMemo<Stage[]>(
    () => [
      {
        phase: 'Intention',
        label: 'YOUR INTENTION',
        subtitle: 'What you seek to anchor',
        text: intentionText.toUpperCase(),
        style: 'sentence',
        duration: 1600,
        typeSpeed: 20,
      },
      {
        phase: 'Removing the Inessential',
        label: 'UNIQUE LETTERS',
        subtitle: 'Each letter, once',
        text: normalizedLetters.join(' '),
        style: 'spaced',
        duration: 1200,
        typeSpeed: 30,
      },
      {
        phase: 'Distilling Consonants',
        label: 'CONSONANTS REMAIN',
        subtitle: 'Vowels dissolve into silence',
        text: consonants.join(' '),
        style: 'spaced',
        duration: 1200,
        typeSpeed: 40,
      },
      {
        phase: 'Converging Symbol',
        label: 'THE SEED LETTERS',
        subtitle: 'Your anchor takes form',
        text: consonants.join(' '),
        style: 'large',
        duration: 1400,
        typeSpeed: 55,
      },
      {
        phase: 'Crystallising',
        label: 'FORGING',
        subtitle: 'Letters becoming form',
        text: '✦',
        style: 'glyph',
        duration: 0,
        typeSpeed: 180,
      },
    ],
    [consonants, intentionText, normalizedLetters]
  );

  const [currentStage, setCurrentStage] = useState(0);
  const [displayedText, setDisplayedText] = useState('');

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);

  const orb1TranslateY = useRef(new Animated.Value(0)).current;
  const orb2TranslateY = useRef(new Animated.Value(0)).current;
  const orb3Scale = useRef(new Animated.Value(1)).current;

  const isReturningUser = (user?.totalAnchorsCreated ?? anchorCount ?? 0) > 0;
  const showSkip = isReturningUser && currentStage < stages.length - 1;

  const clearStageTimers = useCallback(() => {
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }
    if (stageTimer.current) {
      clearTimeout(stageTimer.current);
      stageTimer.current = null;
    }
  }, []);

  const navigateToSelection = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }

    hasNavigatedRef.current = true;
    clearStageTimers();

    navigation.navigate('SigilSelection', {
      intentionText,
      category,
      distilledLetters: normalizedLetters,
    });
  }, [category, clearStageTimers, intentionText, navigation, normalizedLetters]);

  const goToStage = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= stages.length || idx === currentStage) {
        return;
      }

      clearStageTimers();

      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setCurrentStage(idx);
        setDisplayedText('');

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start();
      });
    },
    [clearStageTimers, currentStage, fadeAnim, stages.length]
  );

  const skipAll = useCallback(() => {
    goToStage(stages.length - 1);
  }, [goToStage, stages.length]);

  useEffect(() => {
    const orb1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb1TranslateY, {
          toValue: 14,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb1TranslateY, {
          toValue: -14,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const orb2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb2TranslateY, {
          toValue: -10,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb2TranslateY, {
          toValue: 10,
          duration: 9000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const orb3Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orb3Scale, {
          toValue: 1.3,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orb3Scale, {
          toValue: 1,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    orb1Loop.start();
    orb2Loop.start();
    orb3Loop.start();

    return () => {
      orb1Loop.stop();
      orb2Loop.stop();
      orb3Loop.stop();
    };
  }, [orb1TranslateY, orb2TranslateY, orb3Scale]);

  useEffect(() => {
    clearStageTimers();
    setDisplayedText('');

    const stage = stages[currentStage];
    let index = 0;

    const typeNext = () => {
      if (index <= stage.text.length) {
        setDisplayedText(stage.text.slice(0, index));
        index += 1;
        typingTimer.current = setTimeout(typeNext, stage.typeSpeed);
        return;
      }

      if (currentStage === stages.length - 1) {
        stageTimer.current = setTimeout(navigateToSelection, 1200);
        return;
      }

      stageTimer.current = setTimeout(() => {
        goToStage(currentStage + 1);
      }, stage.duration);
    };

    typeNext();

    return clearStageTimers;
  }, [clearStageTimers, currentStage, goToStage, navigateToSelection, stages]);

  useEffect(() => clearStageTimers, [clearStageTimers]);

  const activeStage = stages[currentStage];

  const textStyle = (() => {
    switch (activeStage.style) {
      case 'spaced':
        return styles.textSpaced;
      case 'large':
        return styles.textLarge;
      case 'glyph':
        return styles.textGlyph;
      case 'sentence':
      default:
        return styles.textSentence;
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a0c14', '#100f1f', '#0a0c14']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbOne,
            {
              transform: [{ translateY: orb1TranslateY }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbTwo,
            {
              transform: [{ translateY: orb2TranslateY }],
            },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.orbThree,
            {
              transform: [{ scale: orb3Scale }],
            },
          ]}
        />

        {showSkip ? (
          <TouchableOpacity
            style={styles.skipButton}
            onPress={skipAll}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Skip to final stage"
          >
            <Text style={styles.skipText}>Skip ›</Text>
          </TouchableOpacity>
        ) : null}

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.topZone}>
            <Text style={styles.stepCounter}>
              Step {currentStage + 1} of {stages.length}
            </Text>
            <Text style={styles.phaseName}>{activeStage.phase}</Text>
            <View style={styles.phaseDivider} />
          </View>

          <View style={styles.centerZone}>
            <Text style={styles.stageLabel}>{activeStage.label}</Text>
            <Text style={[styles.mainTextBase, textStyle]}>{displayedText}</Text>
            <Text style={styles.stageSubtitle}>{activeStage.subtitle}</Text>
          </View>

          <View style={styles.bottomZone}>
            <View style={styles.dots}>
              {stages.map((_, index) => {
                const isActive = index === currentStage;
                const isPassed = index < currentStage;

                return (
                  <TouchableOpacity
                    key={`dot-${index}`}
                    onPress={() => goToStage(index)}
                    style={[
                      styles.dot,
                      isActive && styles.dotActive,
                      isPassed && styles.dotPassed,
                      !isActive && !isPassed && styles.dotFuture,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to stage ${index + 1}`}
                  />
                );
              })}
            </View>
            <Text style={styles.settleText}>
              {currentStage < stages.length - 1 ? 'Let it settle' : 'Your anchor awaits'}
            </Text>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0c14',
  },
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0a0c14',
  },
  content: {
    flex: 1,
    paddingTop: 70,
    paddingBottom: 44,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 28,
    zIndex: 10,
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  skipText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(212,175,55,0.55)',
    textTransform: 'uppercase',
  },
  topZone: {
    alignItems: 'center',
  },
  stepCounter: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 6,
    color: colors.gold,
    textTransform: 'uppercase',
    opacity: 0.65,
    marginBottom: 10,
  },
  phaseName: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 21,
    letterSpacing: 0.5,
    color: '#e8e0d4',
  },
  phaseDivider: {
    width: 40,
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.5,
    marginTop: 14,
  },
  centerZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  stageLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 5,
    color: colors.gold,
    textTransform: 'uppercase',
    opacity: 0.55,
  },
  mainTextBase: {
    textAlign: 'center',
  },
  textSentence: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 14,
    letterSpacing: 3,
    color: '#c8bfb3',
    lineHeight: 28,
    maxWidth: 300,
  },
  textSpaced: {
    fontFamily: 'Courier',
    fontSize: 22,
    letterSpacing: 8,
    color: '#e8e0d4',
  },
  textLarge: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 34,
    letterSpacing: 16,
    color: '#D4AF37',
  },
  textGlyph: {
    fontSize: 80,
    color: '#D4AF37',
    letterSpacing: 0,
  },
  stageSubtitle: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 14,
    letterSpacing: 1,
    color: '#8a7f74',
    marginTop: 8,
    textAlign: 'center',
  },
  bottomZone: {
    alignItems: 'center',
    gap: 18,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    width: 6,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#D4AF37',
  },
  dotPassed: {
    backgroundColor: 'rgba(212,175,55,0.35)',
  },
  dotFuture: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  settleText: {
    fontFamily: 'CrimsonPro-Italic',
    fontSize: 13,
    letterSpacing: 2,
    color: '#5a5450',
    textAlign: 'center',
  },
  orbOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -60,
    right: -70,
    backgroundColor: 'rgba(62,44,91,0.5)',
  },
  orbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 80,
    left: -60,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  orbThree: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: '50%',
    left: '50%',
    marginTop: -80,
    marginLeft: -80,
    backgroundColor: 'rgba(212,175,55,0.04)',
  },
});
