import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, RadialGradient as SvgRadialGradient, Stop } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/types';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { buildDistillationRenderWords } from '@/utils/sigil/distillation';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { colors, typography } from '@/theme';
import { BackChevronIcon, CloseIcon } from '@/components/icons';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LetterDistillation'>;
  route: RouteProp<RootStackParamList, 'LetterDistillation'>;
};

/**
 * The reduction plays as three readable passes: vowels drop, then repeated letters drop,
 * then the surviving letters resolve on their own and the flow advances itself.
 */
type Stage = 'full' | 'vowels' | 'duplicates' | 'settled';

const STAGE_ORDER: Record<Stage, number> = {
  full: 0,
  vowels: 1,
  duplicates: 2,
  settled: 3,
};

const STEP_LABELS = ['Removing Vowels', 'Removing Repeated Letters', 'Essential Letters'];

const gilt = colors.anchor15.gilt;
const giltBright = colors.anchor15.giltBright;
const ash = colors.anchor15.ash;
const bone = colors.anchor15.bone;
const boneSoft = 'rgba(244, 239, 230, 0.68)';
const boneFaint = 'rgba(244, 239, 230, 0.42)';
const goldLine = colors.anchor15.goldLine;
const hairlineGold = colors.anchor15.hairlineGold;

/** Beat before the first pass starts, so the phrase is readable in full. */
const FIRST_STEP_DELAY_MS = 700;
/** Beat after a pass finishes, so the intermediate result is readable. */
const STEP_HOLD_MS = 900;
const CHAR_STAGGER_MS = 26;
/** Long intentions compress their stagger so a pass never outstays its welcome. */
const MAX_STEP_STAGGER_SPAN_MS = 620;
const CHAR_REDUCTION_DURATION_MS = 460;
const REDUCED_MOTION_STEP_MS = 260;
/** How long the essential letters hold before the flow advances itself. */
const AUTO_PROCEED_DELAY_MS = 3000;

function HeroGlow() {
  return (
    <View pointerEvents="none" style={styles.heroGlowWrap}>
      <Svg width={280} height={280}>
        <Defs>
          <SvgRadialGradient id="distillHeroGlow" cx="50%" cy="45%" r="55%">
            <Stop offset="0%" stopColor={gilt} stopOpacity={0.12} />
            <Stop offset="68%" stopColor={gilt} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Circle cx={140} cy={140} r={140} fill="url(#distillHeroGlow)" />
      </Svg>
    </View>
  );
}

function TopGlow() {
  return (
    <View pointerEvents="none" style={styles.topGlowWrap}>
      <Svg width={340} height={340}>
        <Defs>
          <SvgRadialGradient id="distillTopGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={gilt} stopOpacity={0.09} />
            <Stop offset="68%" stopColor={gilt} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Circle cx={170} cy={170} r={170} fill="url(#distillTopGlow)" />
      </Svg>
    </View>
  );
}

function DistillChar({
  char,
  removalStep,
  delayMs,
  stage,
  reduceMotion,
}: {
  char: string;
  removalStep: 1 | 2 | null;
  delayMs: number;
  stage: Stage;
  reduceMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const keep = removalStep === null;
  // Removed characters animate when their own pass arrives; survivors light up at the end.
  const active = keep ? stage === 'settled' : removalStep <= STAGE_ORDER[stage];

  useEffect(() => {
    if (!active) {
      progress.setValue(0);
      return;
    }

    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 200 : CHAR_REDUCTION_DURATION_MS,
      delay: reduceMotion ? 0 : delayMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [active, delayMs, progress, reduceMotion]);

  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, keep ? 1 : 0.14],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, reduceMotion ? 1 : keep ? 1.08 : 0.82],
  });
  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [boneSoft, keep ? giltBright : boneSoft],
  });

  return (
    <Animated.Text
      style={[
        styles.distillChar,
        { opacity, color, transform: [{ scale }] },
      ]}
    >
      {char}
    </Animated.Text>
  );
}

function HowSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Dismiss">
        <Pressable style={{ width: '100%' }} onPress={(event) => event.stopPropagation()}>
          <LinearGradient colors={['#1A222B', '#10151B']} style={[styles.sheet, { paddingBottom: 40 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={styles.sheetClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <CloseIcon size={12} color={boneFaint} />
            </Pressable>
            <Text style={styles.sheetTitle}>How Distillation Works</Text>

            <View style={[styles.sheetItem, styles.sheetItemFirst]}>
              <Text style={styles.sheetItemTitle}>
                Anchor reduces your written intention by removing repeated elements and simplifying the
                phrase into a smaller set of letters.
              </Text>
            </View>
            <View style={styles.sheetItem}>
              <Text style={styles.sheetItemTitle}>
                Those letters become the raw material used to build your structure.
              </Text>
            </View>

            <View style={styles.sheetExample}>
              <View style={styles.sheetExampleRow}>
                <Text style={styles.sheetExTagGood}>Example</Text>
                <Text style={styles.sheetExTextGood}>CONFIDENCE &rarr; C &middot; N &middot; F &middot; D</Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.sheetDismiss, pressed && styles.nextBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={styles.sheetDismissText}>Got it</Text>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function LetterDistillationScreen({ route, navigation }: Props) {
  const { intentionText, distilledLetters, category } = route.params;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();

  const [stage, setStage] = useState<Stage>('full');
  const [sheetOpen, setSheetOpen] = useState(false);

  const renderWords = useMemo(() => buildDistillationRenderWords(intentionText), [intentionText]);

  useEffect(() => {
    useFirstAnchorFlowStore.getState().updateDraft({
      originalIntention: intentionText,
      distilledLetters,
    });
  }, [distilledLetters, intentionText]);

  /**
   * Per-character stagger delays plus the wall-clock moment each pass begins. Both passes are
   * staggered independently so a vowel late in a long phrase does not inherit a huge delay from
   * the characters before it, and the span of each pass is capped for very long intentions.
   */
  const timeline = useMemo(() => {
    let vowelCount = 0;
    let duplicateCount = 0;
    for (const word of renderWords) {
      for (const char of word.chars) {
        if (char.removalStep === 1) vowelCount += 1;
        else if (char.removalStep === 2) duplicateCount += 1;
      }
    }

    const staggerFor = (count: number) =>
      count > 1 ? Math.min(CHAR_STAGGER_MS, MAX_STEP_STAGGER_SPAN_MS / (count - 1)) : 0;
    const vowelStagger = staggerFor(vowelCount);
    const duplicateStagger = staggerFor(duplicateCount);

    let vowelIndex = 0;
    let duplicateIndex = 0;
    const words = renderWords.map((word) => ({
      chars: word.chars.map((char) => {
        if (char.removalStep === 1) {
          return { ...char, delayMs: vowelIndex++ * vowelStagger };
        }
        if (char.removalStep === 2) {
          return { ...char, delayMs: duplicateIndex++ * duplicateStagger };
        }
        return { ...char, delayMs: 0 };
      }),
    }));

    const stepDuration = (count: number, staggerMs: number) =>
      count === 0 ? 0 : (count - 1) * staggerMs + CHAR_REDUCTION_DURATION_MS;

    const vowelsAt = FIRST_STEP_DELAY_MS;
    const duplicatesAt = vowelsAt + stepDuration(vowelCount, vowelStagger) + STEP_HOLD_MS;
    const settledAt =
      duplicatesAt + stepDuration(duplicateCount, duplicateStagger) + STEP_HOLD_MS;

    return { words, vowelsAt, duplicatesAt, settledAt };
  }, [renderWords]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (reduceMotion) {
      setStage('vowels');
      timers.push(setTimeout(() => setStage('duplicates'), REDUCED_MOTION_STEP_MS));
      timers.push(setTimeout(() => setStage('settled'), REDUCED_MOTION_STEP_MS * 2));
    } else {
      timers.push(setTimeout(() => setStage('vowels'), timeline.vowelsAt));
      timers.push(setTimeout(() => setStage('duplicates'), timeline.duplicatesAt));
      timers.push(
        setTimeout(() => {
          setStage('settled');
          void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        }, timeline.settledAt)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, [reduceMotion, timeline]);

  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const entranceTranslateX = useRef(new Animated.Value(reduceMotion ? 0 : 26)).current;

  useEffect(() => {
    if (reduceMotion) {
      entranceTranslateX.setValue(0);
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.bezier(0.22, 0.82, 0.44, 1),
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslateX, {
        toValue: 0,
        duration: 360,
        easing: Easing.bezier(0.22, 0.82, 0.44, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceOpacity, entranceTranslateX, reduceMotion]);

  const phraseLayerOpacity = useRef(new Animated.Value(1)).current;
  const resultLayerOpacity = useRef(new Animated.Value(0)).current;
  const eyebrowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = reduceMotion ? 300 : 550;
    const settled = stage === 'settled';

    Animated.timing(phraseLayerOpacity, {
      toValue: settled ? 0 : 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    Animated.timing(resultLayerOpacity, {
      toValue: settled ? 1 : 0,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    Animated.timing(eyebrowOpacity, {
      toValue: settled ? 1 : 0,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [eyebrowOpacity, phraseLayerOpacity, reduceMotion, resultLayerOpacity, stage]);

  const currentStep = stage === 'duplicates' ? 2 : stage === 'settled' ? 3 : 1;
  const stepLabelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    stepLabelOpacity.setValue(0);
    const anim = Animated.timing(stepLabelOpacity, {
      toValue: 1,
      duration: reduceMotion ? 120 : 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [currentStep, reduceMotion, stepLabelOpacity]);

  const proceededRef = useRef(false);

  const handleChooseStructure = useCallback(() => {
    if (proceededRef.current) {
      return;
    }
    proceededRef.current = true;

    navigation.navigate('StructureForge', {
      intentionText,
      category,
      distilledLetters,
    });
  }, [category, distilledLetters, intentionText, navigation]);

  // Step 3 holds the essential letters, then advances on its own. The countdown is suspended
  // while the "How does this work?" sheet is open so the flow never moves under the reader.
  const autoProceedPending = stage === 'settled' && !sheetOpen;

  useEffect(() => {
    if (!autoProceedPending) {
      return;
    }

    const timer = setTimeout(handleChooseStructure, AUTO_PROCEED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoProceedPending, handleChooseStructure]);

  const autoProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!autoProceedPending) {
      autoProgress.setValue(0);
      return;
    }

    const anim = Animated.timing(autoProgress, {
      toValue: 1,
      duration: AUTO_PROCEED_DELAY_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [autoProceedPending, autoProgress]);

  const autoProgressWidth = autoProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.anchor15.creationTop, colors.anchor15.creationBottom, colors.anchor15.navy]}
        locations={[0, 0.44, 1]}
        style={StyleSheet.absoluteFill}
      />
      <TopGlow />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          testID="distill-content"
          style={[
            styles.content,
            { opacity: entranceOpacity, transform: [{ translateX: entranceTranslateX }] },
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <BackChevronIcon size={16} color={boneSoft} />
            </Pressable>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.topEyebrow}>Your Intention</Text>

            <View style={styles.quoteCard}>
              <Text style={styles.quoteText}>&ldquo;{intentionText}&rdquo;</Text>
            </View>

            <View style={styles.textZone}>
              <Text style={styles.title}>
                Distilling Your <Text style={styles.titleEm}>Intention</Text>
              </Text>
              <Text style={styles.body}>
                We remove repetition and reduce your intention to its essential letters. These become the
                foundation of your Anchor.
              </Text>
            </View>

            <View style={styles.heroSection}>
              <View style={styles.stepper} testID="distill-stepper">
                <View style={styles.stepPips}>
                  {[1, 2, 3].map((step) => (
                    <View
                      key={`pip-${step}`}
                      style={[
                        styles.stepPip,
                        step === currentStep && styles.stepPipCurrent,
                        step < currentStep && styles.stepPipDone,
                      ]}
                    />
                  ))}
                </View>
                <Animated.Text
                  style={[
                    styles.stepLabel,
                    currentStep === 3 && styles.stepLabelFinal,
                    { opacity: stepLabelOpacity },
                  ]}
                  accessibilityLiveRegion="polite"
                >
                  Step {currentStep} of 3 &middot; {STEP_LABELS[currentStep - 1]}
                </Animated.Text>
              </View>

              <View style={styles.hero}>
                <HeroGlow />

                <Animated.View
                  pointerEvents={stage === 'settled' ? 'none' : 'auto'}
                  accessibilityElementsHidden={stage === 'settled'}
                  importantForAccessibility={stage === 'settled' ? 'no-hide-descendants' : 'auto'}
                  style={[styles.heroLayer, { opacity: phraseLayerOpacity }]}
                  testID="distill-phrase-layer"
                >
                  <View style={styles.phrase}>
                    {timeline.words.map((word, wi) => (
                      <View style={styles.word} key={`word-${wi}`}>
                        {word.chars.map((c, ci) => (
                          <DistillChar
                            key={`char-${wi}-${ci}`}
                            char={c.char}
                            removalStep={c.removalStep}
                            delayMs={c.delayMs}
                            stage={stage}
                            reduceMotion={reduceMotion}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </Animated.View>

                <Animated.View
                  pointerEvents={stage === 'settled' ? 'auto' : 'none'}
                  accessibilityElementsHidden={stage !== 'settled'}
                  importantForAccessibility={stage !== 'settled' ? 'no-hide-descendants' : 'auto'}
                  style={[styles.heroLayer, { opacity: resultLayerOpacity }]}
                  testID="distill-result-layer"
                >
                  <View style={styles.letters}>
                    {distilledLetters.map((ch, i) => (
                      <React.Fragment key={`letter-${i}`}>
                        {i > 0 && <Text style={styles.dot}>&middot;</Text>}
                        <Text style={styles.letter}>{ch}</Text>
                      </React.Fragment>
                    ))}
                  </View>
                </Animated.View>
              </View>

              <Animated.Text style={[styles.eyebrowResult, { opacity: eyebrowOpacity }]}>
                The Essential Form
              </Animated.Text>
            </View>

            <View style={styles.aboutRow}>
              <Pressable
                onPress={() => setSheetOpen(true)}
                style={styles.aboutToggle}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel="How does this work?"
              >
                <Text style={styles.aboutToggleText}>How does this work?</Text>
                <View style={styles.principlesQ}>
                  <Text style={styles.principlesQText}>?</Text>
                </View>
              </Pressable>
            </View>
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: 24 + insets.bottom }]}>
            <Text style={styles.nextHint}>
              {stage === 'settled'
                ? 'Continuing to your structure…'
                : 'Next, choose how these letters become a structure.'}
            </Text>
            <Pressable
              onPress={handleChooseStructure}
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Choose Your Structure"
            >
              <Animated.View
                pointerEvents="none"
                testID="distill-auto-progress"
                style={[styles.nextBtnProgress, { width: autoProgressWidth }]}
              />
              <Text style={styles.nextBtnText}>Choose Your Structure &rarr;</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>

      <HowSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  topGlowWrap: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 340,
    height: 340,
  },
  content: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    borderColor: goldLine,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  topEyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: ash,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 4,
  },
  quoteCard: {
    marginTop: 14,
    marginHorizontal: 28,
    padding: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 239, 230, 0.035)',
    borderWidth: 1,
    borderColor: hairlineGold,
  },
  quoteText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 19,
    lineHeight: 26.6,
    color: bone,
    textAlign: 'center',
  },
  textZone: {
    paddingHorizontal: 28,
    marginTop: 22,
  },
  title: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 27,
    lineHeight: 34,
    color: bone,
    letterSpacing: 0.15,
    marginBottom: 14,
  },
  titleEm: {
    fontFamily: typography.fontFamily.voice,
    fontStyle: 'normal',
    color: giltBright,
  },
  body: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 16,
    color: boneSoft,
    lineHeight: 25.6,
  },
  heroSection: {
    paddingHorizontal: 28,
    marginTop: 22,
  },
  stepper: {
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  stepPips: {
    flexDirection: 'row',
    gap: 6,
  },
  stepPip: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(244, 239, 230, 0.16)',
  },
  stepPipDone: {
    backgroundColor: 'rgba(217, 179, 108, 0.4)',
  },
  stepPipCurrent: {
    width: 28,
    backgroundColor: giltBright,
  },
  stepLabel: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.9,
    color: ash,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  stepLabelFinal: {
    color: giltBright,
  },
  hero: {
    position: 'relative',
    height: 196,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 20, 25, 0.55)',
    borderWidth: 1,
    borderColor: hairlineGold,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlowWrap: {
    position: 'absolute',
    top: -18,
    left: '50%',
    marginLeft: -140,
  },
  heroLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  phrase: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 280,
    rowGap: 9,
  },
  word: {
    flexDirection: 'row',
    marginRight: 5,
  },
  distillChar: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.28,
    color: boneSoft,
  },
  letters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    maxWidth: 300,
    columnGap: 3,
    rowGap: 6,
  },
  letter: {
    fontFamily: typography.fontFamily.ritual,
    fontWeight: '500',
    fontSize: 32,
    letterSpacing: 0.96,
    color: giltBright,
  },
  dot: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 17,
    color: ash,
    opacity: 0.65,
  },
  eyebrowResult: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2.4,
    color: ash,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  aboutToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aboutToggleText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 11,
    color: ash,
  },
  principlesQ: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principlesQText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    color: gilt,
  },
  bottomBar: {
    paddingHorizontal: 28,
    paddingTop: 18,
    alignItems: 'center',
    gap: 16,
  },
  nextHint: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: ash,
    textAlign: 'center',
    lineHeight: 18.2,
  },
  nextBtn: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  nextBtnProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(217, 179, 108, 0.14)',
  },
  nextBtnPressed: {
    backgroundColor: 'rgba(217, 179, 108, 0.16)',
    borderColor: 'rgba(217, 179, 108, 0.48)',
  },
  nextBtnText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2.52,
    color: giltBright,
    textTransform: 'uppercase',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(6, 9, 13, 0.7)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: goldLine,
    paddingHorizontal: 26,
    paddingTop: 14,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(244, 239, 230, 0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    letterSpacing: 2.42,
    textTransform: 'uppercase',
    color: ash,
    textAlign: 'center',
    marginBottom: 18,
  },
  sheetItem: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: hairlineGold,
  },
  sheetItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  sheetItemTitle: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22.7,
    color: bone,
  },
  sheetExample: {
    marginTop: 4,
    gap: 8,
  },
  sheetExampleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  sheetExTagGood: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.63,
    textTransform: 'uppercase',
    color: gilt,
    width: 56,
  },
  sheetExTextGood: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 14,
    color: giltBright,
    flex: 1,
  },
  sheetDismiss: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    marginTop: 22,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDismissText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 2.08,
    color: giltBright,
    textTransform: 'uppercase',
  },
});

