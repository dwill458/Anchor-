/**
 * Anchor App - Practice Complete Screen (Anchor 1.5)
 *
 * Restrained Thread Strength reveal screen acting as the finale of the practice flow.
 * Visual acknowledgment that practice reinforced this specific Anchor without gamification.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { PracticeStackParamList, RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { useChartPracticeReturn } from '@/hooks/useChartPracticeReturn';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { AnalyticsService } from '@/services/AnalyticsService';
import { SigilSvg, OptimizedImage } from '@/components/common';
import { colors, typography } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_SIZE = Math.min(SCREEN_WIDTH * 0.48, 198);

type NavigationProp = NativeStackNavigationProp<PracticeStackParamList, 'PracticeComplete'>;
type RouteProps = RouteProp<PracticeStackParamList, 'PracticeComplete'>;

interface ReminderTimeOption {
  label: 'Morning' | 'Evening' | 'Custom';
  time: string;
  display: string;
}

const REMINDER_TIME_OPTIONS: ReminderTimeOption[] = [
  { label: 'Morning', time: '08:00', display: 'Morning (8:00 AM)' },
  { label: 'Evening', time: '20:00', display: 'Evening (8:00 PM)' },
  { label: 'Custom', time: '15:00', display: 'Afternoon (3:00 PM)' },
];

export const PracticeCompleteScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionEnabled();

  const {
    anchorId,
    practiceMode,
    previousThreadStrength,
    newThreadStrength,
    previousStage,
    newStage,
    didCrossStage,
    isFirstPractice,
    returnTo,
    returnTarget,
    source,
    chartContext,
  } = route.params;

  const anchor = useAnchorStore((state) => state.getAnchorById(anchorId));
  const returnToChart = useChartPracticeReturn(navigation);
  const {
    navigateToPractice,
    navigateToVault,
    navigateToSanctuary: canonicalNavigateToSanctuary,
    returnToAnchorDetail: canonicalReturnToAnchorDetail,
  } = useTabNavigation();
  const navigateToSanctuary = canonicalNavigateToSanctuary ?? (() => navigateToVault());
  const returnToAnchorDetail =
    canonicalReturnToAnchorDetail ??
    ((id: string) => navigateToVault('AnchorDetail', { anchorId: id }));

  const {
    canOfferFirstAnchorReminder,
    setDailyPrimeReminder,
    markReminderPromptShown,
    completeReminderPrompt,
  } = useNotificationController();

  // Scenario determination
  const isTransition = !isFirstPractice && didCrossStage;
  const fromVal = isFirstPractice ? 0 : previousThreadStrength;
  const toVal = newThreadStrength;

  // Step progression (0 to 4)
  const [step, setStep] = useState(reduceMotion ? 4 : 0);
  const [displayCount, setDisplayCount] = useState(fromVal);
  const [isReminderEligible, setIsReminderEligible] = useState(false);
  const [reminderExpanded, setReminderExpanded] = useState(false);
  const [selectedReminderOption, setSelectedReminderOption] = useState<ReminderTimeOption>(
    REMINDER_TIME_OPTIONS[0],
  );
  const [reminderConfirmedStatus, setReminderConfirmedStatus] = useState<
    'set' | 'skipped' | null
  >(null);
  const [isSettingReminder, setIsSettingReminder] = useState(false);

  // Animated values
  const screenFadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const heroPulseScale = useRef(new Animated.Value(1)).current;
  const heroPulseOpacity = useRef(new Animated.Value(0)).current;
  const heroHaloScale = useRef(new Animated.Value(1)).current;
  const heroGlowPeakAnim = useRef(new Animated.Value(reduceMotion ? 0.32 : 0)).current;
  const threadSweepRotation = useRef(new Animated.Value(0)).current;
  const threadSweepOpacity = useRef(new Animated.Value(0)).current;
  const labelFadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const labelTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 6)).current;
  const progressBarAnim = useRef(new Animated.Value(fromVal)).current;
  const statusFadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const stageNameTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 4)).current;
  const reminderFadeAnim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const reminderTranslateY = useRef(new Animated.Value(reduceMotion ? 0 : 10)).current;
  const actionsFadeAnim = useRef(new Animated.Value(1)).current;

  // Track initial view and check reminder eligibility
  useEffect(() => {
    AnalyticsService.track('practice_complete_viewed', {
      anchor_id: anchorId,
      practice_mode: practiceMode,
      previous_thread_strength: previousThreadStrength,
      new_thread_strength: newThreadStrength,
      is_first_practice: isFirstPractice,
      did_cross_stage: didCrossStage,
      new_stage: newStage,
    });

    if (didCrossStage && !isFirstPractice) {
      AnalyticsService.track('thread_strength_stage_crossed', {
        anchor_id: anchorId,
        previous_stage: previousStage,
        new_stage: newStage,
      });
    }

    if (isFirstPractice) {
      canOfferFirstAnchorReminder().then((eligible) => {
        setIsReminderEligible(eligible);
        if (eligible) {
          void markReminderPromptShown('first_anchor');
          AnalyticsService.track('practice_reminder_prompt_viewed', {
            anchor_id: anchorId,
          });
        }
      });
    }
  }, [
    anchorId,
    canOfferFirstAnchorReminder,
    didCrossStage,
    isFirstPractice,
    markReminderPromptShown,
    newStage,
    newThreadStrength,
    practiceMode,
    previousStage,
    previousThreadStrength,
  ]);

  // Accessibility Announcement
  useEffect(() => {
    let message = `Practice complete. Thread Strength increased from ${fromVal} to ${toVal}. Reinforced.`;
    if (isFirstPractice) {
      message = `Practice complete. Your thread has begun. Thread Strength is now ${toVal}.`;
    } else if (isTransition) {
      message = `Practice complete. Thread Strength increased from ${fromVal} to ${toVal}. New stage: ${newStage}.`;
    }

    const timer = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(message);
    }, 600);

    return () => clearTimeout(timer);
  }, [fromVal, isFirstPractice, isTransition, newStage, toVal]);

  // Animation Sequence
  useEffect(() => {
    if (reduceMotion) {
      setStep(4);
      setDisplayCount(toVal);
      progressBarAnim.setValue(toVal);
      return;
    }

    // Step 0: Fade screen in
    Animated.timing(screenFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Halo breathing animation (ambient loop)
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroHaloScale, {
          toValue: 1.05,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroHaloScale, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    haloLoop.start();

    // Timers for staged sequence
    const t1 = setTimeout(() => {
      // Step 1: Anchor pulse & glow peak
      setStep(1);

      // Pulse ring expansion
      heroPulseScale.setValue(0.94);
      heroPulseOpacity.setValue(0.55);
      Animated.parallel([
        Animated.timing(heroPulseScale, {
          toValue: 1.24,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(heroPulseOpacity, {
          toValue: 0,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(heroGlowPeakAnim, {
            toValue: 0.9,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(heroGlowPeakAnim, {
            toValue: isTransition ? 0.5 : 0.32,
            duration: 600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(threadSweepOpacity, {
            toValue: 0.85,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(threadSweepOpacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(threadSweepRotation, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }, 550);

    const t2 = setTimeout(() => {
      // Step 2: Labels and initial numbers appear
      setStep(2);
      Animated.parallel([
        Animated.timing(labelFadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 950);

    const t3 = setTimeout(() => {
      // Step 3: Progress bar moves from fromVal to toVal
      setStep(3);

      // Smooth number count-up
      const startTime = Date.now();
      const countDuration = 800;
      const countInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / countDuration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentNum = Math.round(fromVal + (toVal - fromVal) * eased);
        setDisplayCount(currentNum);

        if (progress >= 1) {
          clearInterval(countInterval);
          setDisplayCount(toVal);
        }
      }, 16);

      Animated.timing(progressBarAnim, {
        toValue: toVal,
        duration: 900,
        easing: Easing.bezier(0.22, 0.61, 0.36, 1),
        useNativeDriver: false,
      }).start(() => {
        clearInterval(countInterval);
        setDisplayCount(toVal);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isTransition) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        AnalyticsService.track('thread_strength_reveal_completed', {
          anchor_id: anchorId,
          new_thread_strength: toVal,
        });
      });
    }, 1450);

    const t4 = setTimeout(() => {
      // Step 4: Status and reminders appear
      setStep(4);
      Animated.parallel([
        Animated.timing(statusFadeAnim, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(stageNameTranslateY, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(reminderFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(reminderTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      haloLoop.stop();
    };
  }, [
    anchorId,
    fromVal,
    heroGlowPeakAnim,
    heroHaloScale,
    heroPulseOpacity,
    heroPulseScale,
    isTransition,
    labelFadeAnim,
    labelTranslateY,
    progressBarAnim,
    reduceMotion,
    reminderFadeAnim,
    reminderTranslateY,
    screenFadeAnim,
    stageNameTranslateY,
    statusFadeAnim,
    threadSweepOpacity,
    threadSweepRotation,
    toVal,
  ]);

  // Reminder interactions
  const handleOpenReminder = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminderExpanded(true);
    AnalyticsService.track('practice_reminder_prompt_opened', {
      anchor_id: anchorId,
    });
  }, [anchorId]);

  const handleSetReminder = useCallback(async () => {
    if (isSettingReminder) return;
    setIsSettingReminder(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const outcome = await setDailyPrimeReminder(
        selectedReminderOption.time,
        'first_anchor',
      );
      if (outcome === 'granted') {
        setReminderConfirmedStatus('set');
        void completeReminderPrompt('first_anchor');
        AnalyticsService.track('practice_reminder_set', {
          anchor_id: anchorId,
          time: selectedReminderOption.time,
        });
      } else {
        setReminderConfirmedStatus('skipped');
        void completeReminderPrompt('first_anchor');
        AnalyticsService.track('practice_reminder_dismissed', {
          anchor_id: anchorId,
          reason: 'permission_denied',
        });
      }
    } catch {
      setReminderConfirmedStatus('skipped');
    } finally {
      setIsSettingReminder(false);
    }
  }, [
    anchorId,
    completeReminderPrompt,
    isSettingReminder,
    selectedReminderOption.time,
    setDailyPrimeReminder,
  ]);

  const handleSkipReminder = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReminderConfirmedStatus('skipped');
    void completeReminderPrompt('first_anchor');
    AnalyticsService.track('practice_reminder_dismissed', {
      anchor_id: anchorId,
      reason: 'user_skipped',
    });
  }, [anchorId, completeReminderPrompt]);

  // Done button navigation (canonical return routing)
  const handleDone = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (
      returnToChart({
        returnTo,
        anchorId,
        chartContext,
        practiceReturn: {
          outcome: 'completed',
          practiceSessionId: route.params.chartContext?.waypointId ?? anchorId,
          practiceMode: (practiceMode === 'release' ? 'focus' : practiceMode) as any,
          anchorId,
        },
      })
    ) {
      return;
    }

    if (returnTarget?.kind === 'anchorDetail') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      returnToAnchorDetail(returnTarget.anchorId);
      return;
    }

    if (returnTo === 'practice') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      returnToAnchorDetail(anchorId);
      return;
    }

    if (returnTo === 'vault' || returnTarget?.kind === 'sanctuary') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      navigateToSanctuary();
      return;
    }

    if (typeof navigation.popToTop === 'function') {
      navigation.popToTop();
    }
    navigateToSanctuary();
  }, [
    anchorId,
    chartContext,
    navigateToPractice,
    navigateToSanctuary,
    navigation,
    practiceMode,
    returnTarget,
    returnTo,
    returnToAnchorDetail,
    returnToChart,
    route.params.chartContext?.waypointId,
  ]);

  const sigilXml = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const statusText = isFirstPractice
    ? null
    : isTransition
      ? 'THREAD STRENGTHENED'
      : 'REINFORCED';

  const threadSweepRotationInterpolate = threadSweepRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '300deg'],
  });

  const progressBarWidthInterpolate = progressBarAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'bottom']}>
      {/* Deep atmospheric backdrop */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={['#161E27', '#101620', '#0F1419']}
          locations={[0, 0.42, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.bgGlow} />
      </View>

      <Animated.View style={[styles.mainLayout, { opacity: screenFadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>PRACTICE COMPLETE</Text>
        </View>

        {/* Body content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Anchor with restrained effects */}
          <View style={styles.heroWrap}>
            {/* Ambient breathing halo */}
            <Animated.View
              style={[
                styles.heroHalo,
                { transform: [{ scale: reduceMotion ? 1 : heroHaloScale }] },
              ]}
            />

            {/* Single entrance pulse ring */}
            {!reduceMotion && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: heroPulseScale }],
                    opacity: heroPulseOpacity,
                  },
                ]}
              />
            )}

            {/* Core Anchor Circle Lens */}
            <View
              style={[
                styles.anchorRing,
                isTransition && styles.anchorRingTransition,
              ]}
            >
              {anchor?.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={styles.anchorImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.sigilWrap}>
                  <SigilSvg
                    xml={sigilXml}
                    width={HERO_SIZE * 0.72}
                    height={HERO_SIZE * 0.72}
                    color={colors.anchor15.gilt}
                  />
                </View>
              )}

              {/* Inner ambient glow layer */}
              <Animated.View
                style={[
                  styles.innerGlow,
                  { opacity: heroGlowPeakAnim },
                ]}
              />

              {/* Circular light sweep */}
              {!reduceMotion && (
                <Animated.View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      opacity: threadSweepOpacity,
                      transform: [{ rotate: threadSweepRotationInterpolate }],
                    },
                  ]}
                  pointerEvents="none"
                >
                  <Svg width={HERO_SIZE} height={HERO_SIZE} viewBox="0 0 200 200">
                    <Defs>
                      <SvgLinearGradient
                        id="threadSweepGrad"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <Stop offset="0%" stopColor="#F2DFA8" stopOpacity="0" />
                        <Stop offset="50%" stopColor="#F2DFA8" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#D9B36C" stopOpacity="0" />
                      </SvgLinearGradient>
                    </Defs>
                    <Circle
                      cx="100"
                      cy="100"
                      r="96"
                      fill="none"
                      stroke="url(#threadSweepGrad)"
                      strokeWidth="1.6"
                      strokeDasharray="40 560"
                      strokeLinecap="round"
                    />
                  </Svg>
                </Animated.View>
              )}
            </View>
          </View>

          {/* Module */}
          <View style={styles.module}>
            {/* First Practice Teaching Banner */}
            {isFirstPractice && (
              <Animated.View
                style={[
                  styles.firstPracticeHead,
                  {
                    opacity: labelFadeAnim,
                    transform: [{ translateY: labelTranslateY }],
                  },
                ]}
              >
                <Text style={styles.firstPracticeTitle}>YOUR THREAD HAS BEGUN</Text>
                <Text style={styles.firstPracticeSub}>
                  Practice strengthens your connection to this Anchor. Thread Strength grows as you return to it over time.
                </Text>
              </Animated.View>
            )}

            {/* Thread Strength Label */}
            <Animated.View
              style={[
                styles.tsLabelWrap,
                {
                  opacity: labelFadeAnim,
                  transform: [{ translateY: labelTranslateY }],
                },
              ]}
            >
              <Text style={styles.tsLabel}>THREAD STRENGTH</Text>
            </Animated.View>

            {/* Numeric Readout: fromVal → currentCount */}
            <Animated.View
              style={[
                styles.tsNumbers,
                {
                  opacity: labelFadeAnim,
                  transform: [{ translateY: labelTranslateY }],
                },
              ]}
            >
              <Text style={styles.tsPrev}>{fromVal}</Text>
              <Text style={styles.tsArrow}>→</Text>
              <Text style={styles.tsCurr}>
                {reduceMotion ? toVal : displayCount}
              </Text>
            </Animated.View>

            {/* 2-3px Progress Line */}
            <Animated.View
              style={[
                styles.progressBarWrap,
                {
                  opacity: labelFadeAnim,
                  transform: [{ translateY: labelTranslateY }],
                },
              ]}
            >
              <View style={styles.progressBarTrack}>
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: reduceMotion
                        ? `${toVal}%`
                        : progressBarWidthInterpolate,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#D9B36C', '#F2DFA8']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View
                    style={[
                      styles.progressBarDot,
                      isTransition && styles.progressBarDotTransition,
                    ]}
                  />
                </Animated.View>
              </View>
            </Animated.View>

            {/* Status Text & Stage Label */}
            {statusText && (
              <Animated.View
                style={[
                  styles.statusWrap,
                  { opacity: statusFadeAnim },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isTransition && styles.statusTextTransition,
                  ]}
                >
                  {statusText}
                </Text>
              </Animated.View>
            )}

            {isTransition && (
              <Animated.View
                style={[
                  styles.stageNameWrap,
                  {
                    opacity: statusFadeAnim,
                    transform: [{ translateY: stageNameTranslateY }],
                  },
                ]}
              >
                <Text style={styles.stageNameText}>{newStage}</Text>
              </Animated.View>
            )}
          </View>

          {/* First Practice Reminder Opportunity */}
          {isFirstPractice && isReminderEligible && (
            <Animated.View
              style={[
                styles.reminderSection,
                {
                  opacity: reminderFadeAnim,
                  transform: [{ translateY: reminderTranslateY }],
                },
              ]}
            >
              {!reminderExpanded ? (
                <View style={styles.reminderCollapsed}>
                  <Text style={styles.reminderTitle}>KEEP BUILDING THE THREAD</Text>
                  <TouchableOpacity
                    onPress={handleOpenReminder}
                    activeOpacity={0.75}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Set a practice reminder"
                    testID="practice-reminder-link"
                  >
                    <Text style={styles.reminderLink}>Set a practice reminder ›</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.reminderExpanded}>
                  <Text style={styles.reminderTitle}>KEEP BUILDING THE THREAD</Text>

                  {reminderConfirmedStatus === null ? (
                    <>
                      <View style={styles.timeOptionsRow}>
                        {REMINDER_TIME_OPTIONS.map((option) => {
                          const isSelected =
                            selectedReminderOption.label === option.label;
                          return (
                            <TouchableOpacity
                              key={option.label}
                              style={[
                                styles.timeOptionPill,
                                isSelected && styles.timeOptionPillActive,
                              ]}
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setSelectedReminderOption(option);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={option.display}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text
                                style={[
                                  styles.timeOptionText,
                                  isSelected && styles.timeOptionTextActive,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <TouchableOpacity
                        style={styles.setReminderBtn}
                        onPress={handleSetReminder}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityLabel="Set Practice Reminder"
                        testID="set-practice-reminder-button"
                      >
                        <LinearGradient
                          colors={['#F2DFA8', '#D9B36C', '#B99247']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.setReminderBtnGradient}
                        >
                          <Text style={styles.setReminderBtnText}>
                            {isSettingReminder ? 'SAVING...' : 'SET PRACTICE REMINDER'}
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.notNowBtn}
                        onPress={handleSkipReminder}
                        activeOpacity={0.65}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Not now"
                        testID="reminder-not-now-button"
                      >
                        <Text style={styles.notNowText}>Not now</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.reminderConfirmedText}>
                      {reminderConfirmedStatus === 'set'
                        ? `Reminder set — ${selectedReminderOption.display}.`
                        : 'You can set this anytime in Settings.'}
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <Animated.View style={[styles.bottomActions, { opacity: actionsFadeAnim }]}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Done"
            testID="practice-complete-done-button"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  bgGlow: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(217, 179, 108, 0.07)',
  },
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.5,
    color: 'rgba(244, 239, 230, 0.56)',
    textTransform: 'uppercase',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 18,
  },
  heroWrap: {
    position: 'relative',
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  heroHalo: {
    position: 'absolute',
    width: HERO_SIZE * 1.4,
    height: HERO_SIZE * 1.4,
    borderRadius: (HERO_SIZE * 1.4) / 2,
    backgroundColor: 'rgba(217, 179, 108, 0.08)',
  },
  pulseRing: {
    position: 'absolute',
    width: HERO_SIZE + 12,
    height: HERO_SIZE + 12,
    borderRadius: (HERO_SIZE + 12) / 2,
    borderWidth: 1,
    borderColor: 'rgba(242, 223, 168, 0.55)',
  },
  anchorRing: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.3)',
    backgroundColor: '#161D25',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D9B36C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  anchorRingTransition: {
    borderColor: 'rgba(242, 223, 168, 0.5)',
    shadowColor: '#F2DFA8',
    shadowOpacity: 0.32,
    shadowRadius: 32,
  },
  sigilWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorImage: {
    width: '100%',
    height: '100%',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: HERO_SIZE / 2,
    backgroundColor: 'rgba(242, 223, 168, 0.16)',
    pointerEvents: 'none',
  },
  module: {
    width: '100%',
    maxWidth: 290,
    alignItems: 'center',
    gap: 8,
  },
  firstPracticeHead: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
    marginBottom: 8,
  },
  firstPracticeTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: '#F2DFA8',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  firstPracticeSub: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(244, 239, 230, 0.62)',
    textAlign: 'center',
    maxWidth: 260,
  },
  tsLabelWrap: {
    marginTop: 4,
  },
  tsLabel: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    color: 'rgba(217, 179, 108, 0.72)',
    textTransform: 'uppercase',
  },
  tsNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 2,
  },
  tsPrev: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 16,
    color: 'rgba(244, 239, 230, 0.38)',
    fontVariant: ['tabular-nums'],
  },
  tsArrow: {
    fontSize: 14,
    color: 'rgba(244, 239, 230, 0.38)',
  },
  tsCurr: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 30,
    fontWeight: '600',
    color: '#F2DFA8',
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
  },
  progressBarWrap: {
    width: '100%',
    maxWidth: 220,
    marginTop: 4,
  },
  progressBarTrack: {
    position: 'relative',
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 239, 230, 0.1)',
    overflow: 'visible',
  },
  progressBarFill: {
    position: 'relative',
    height: '100%',
    borderRadius: 2,
  },
  progressBarDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F2DFA8',
    shadowColor: '#F2DFA8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  progressBarDotTransition: {
    width: 9,
    height: 9,
    top: -3,
    right: -4,
    borderRadius: 4.5,
    shadowRadius: 10,
  },
  statusWrap: {
    marginTop: 6,
  },
  statusText: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 1.8,
    color: '#D9B36C',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statusTextTransition: {
    color: '#F2DFA8',
  },
  stageNameWrap: {
    marginTop: -2,
  },
  stageNameText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    color: 'rgba(242, 223, 168, 0.82)',
    textAlign: 'center',
  },
  reminderSection: {
    width: '100%',
    maxWidth: 280,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(217, 179, 108, 0.15)',
    alignItems: 'center',
  },
  reminderCollapsed: {
    alignItems: 'center',
    gap: 6,
  },
  reminderExpanded: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  reminderTitle: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 2.2,
    color: 'rgba(244, 239, 230, 0.68)',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  reminderLink: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    color: '#D9B36C',
  },
  timeOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 2,
  },
  timeOptionPill: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.14)',
    backgroundColor: 'rgba(244, 239, 230, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOptionPillActive: {
    borderColor: 'rgba(217, 179, 108, 0.55)',
    backgroundColor: 'rgba(217, 179, 108, 0.12)',
  },
  timeOptionText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12.5,
    fontWeight: '500',
    color: 'rgba(244, 239, 230, 0.62)',
  },
  timeOptionTextActive: {
    color: '#F2DFA8',
    fontWeight: '600',
  },
  setReminderBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: '#D9B36C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },
  setReminderBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setReminderBtnText: {
    fontFamily: typography.fontFamily.serif,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1.6,
    color: '#0B1015',
    textTransform: 'uppercase',
  },
  notNowBtn: {
    paddingVertical: 4,
  },
  notNowText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12.5,
    color: 'rgba(244, 239, 230, 0.38)',
  },
  reminderConfirmedText: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontSize: 14,
    color: 'rgba(244, 239, 230, 0.65)',
    textAlign: 'center',
    paddingVertical: 6,
  },
  bottomActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  doneButton: {
    minWidth: 120,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244, 239, 230, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 239, 230, 0.03)',
  },
  doneButtonText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(244, 239, 230, 0.75)',
  },
});
