import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import type { PracticeStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

import { RitualScaffold } from '@/screens/rituals/components/RitualScaffold';
import { RitualTopBar } from '@/screens/rituals/components/RitualTopBar';
import { InstructionGlassCard } from '@/screens/rituals/components/InstructionGlassCard';

type StabilizeRouteProp = RouteProp<PracticeStackParamList, 'StabilizeRitual'>;
type StabilizeNavProp = StackNavigationProp<PracticeStackParamList, 'StabilizeRitual'>;

type StabilizePhase = 'arrive' | 'hold' | 'seal' | 'complete';

const { width } = Dimensions.get('window');
const SYMBOL_SIZE = Math.min(width * 0.58, 248);
const RING_RADIUS = SYMBOL_SIZE / 2 + 22;
const RING_STROKE = 4;
const RING_SIZE = RING_RADIUS * 2 + RING_STROKE * 4;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const StabilizeRitualScreen: React.FC = () => {
  const navigation = useNavigation<StabilizeNavProp>();
  const route = useRoute<StabilizeRouteProp>();
  const reduceMotionEnabled = useReduceMotionEnabled();

  const { anchorId } = route.params;
  const { getAnchorById } = useAnchorStore();
  const recordStabilize = useAuthStore((state) => state.recordStabilize);

  const anchor = getAnchorById(anchorId);

  const [phase, setPhase] = useState<StabilizePhase>('arrive');
  const [breathCue, setBreathCue] = useState<'Breathe in' | 'Breathe out'>('Breathe in');
  const [completionMessage, setCompletionMessage] = useState<string>('');

  const ringProgress = useSharedValue(0);
  const pulse = useSharedValue(0);
  const sealActive = useSharedValue(0);
  const isMountedRef = useRef(true);
  const didSealHapticRef = useRef(false);

  const circumference = useMemo(() => 2 * Math.PI * RING_RADIUS, []);

  useEffect(() => {
    isMountedRef.current = true;
    if (!anchor) {
      Alert.alert('Anchor Not Found', 'Choose an anchor to stabilize.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return () => {
        isMountedRef.current = false;
      };
    }

    setPhase('arrive');
    setCompletionMessage('');
    didSealHapticRef.current = false;

    const tHold = setTimeout(() => setPhase('hold'), 5000);
    const tSeal = setTimeout(() => setPhase('seal'), 20000);
    const tComplete = setTimeout(async () => {
      setPhase('complete');

      try {
        const flags = await recordStabilize(anchorId);
        if (!isMountedRef.current) return;

        const msg = flags.sameDay
          ? 'State reinforced.'
          : flags.reset
            ? 'Welcome back. Begin again.'
            : 'Flame extended.';

        setCompletionMessage(msg);
      } catch (_error) {
        // Local state is still considered complete.
      }
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearTimeout(tHold);
      clearTimeout(tSeal);
      clearTimeout(tComplete);
      cancelAnimation(ringProgress);
      cancelAnimation(pulse);
    };
  }, [anchor, anchorId, navigation, recordStabilize, ringProgress, pulse]);

  useEffect(() => {
    if (phase !== 'arrive') return;
    setBreathCue('Breathe in');
    const t = setTimeout(() => setBreathCue('Breathe out'), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'hold') return;

    sealActive.value = 0;
    pulse.value = 0;

    ringProgress.value = 0;
    if (reduceMotionEnabled) {
      ringProgress.value = 1;
      return;
    }

    ringProgress.value = withTiming(1, {
      duration: 15000,
      easing: Easing.linear,
    });
  }, [phase, reduceMotionEnabled, ringProgress, pulse, sealActive]);

  useEffect(() => {
    if (phase !== 'seal') {
      sealActive.value = 0;
      pulse.value = 0;
      didSealHapticRef.current = false;
      cancelAnimation(pulse);
      return;
    }

    sealActive.value = 1;

    if (!didSealHapticRef.current) {
      didSealHapticRef.current = true;
      safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    }

    if (reduceMotionEnabled) {
      pulse.value = 0;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [phase, pulse, reduceMotionEnabled, sealActive]);

  const trackAnimatedProps = useAnimatedProps(() => ({
    opacity: 0.22 + ringProgress.value * 0.18,
  }));

  const progressAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ringProgress.value),
    opacity: 0.25 + 0.75 * ringProgress.value,
  }));

  const sealRingAnimatedProps = useAnimatedProps(() => ({
    opacity: (0.28 + pulse.value * 0.18) * sealActive.value,
  }));

  const symbolAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + sealActive.value * (0.012 + pulse.value * 0.018);
    return {
      transform: [{ scale }],
    };
  });

  const ringAnimatedStyle = useAnimatedStyle(() => {
    const scale = 1 + sealActive.value * (pulse.value * 0.01);
    return {
      transform: [{ scale }],
    };
  });

  const phaseLabel = phase === 'complete'
    ? 'Complete'
    : phase === 'arrive'
      ? 'Arrive'
      : phase === 'hold'
        ? 'Hold'
        : 'Seal';

  const handleBack = () => {
    if (phase === 'complete') {
      navigation.goBack();
      return;
    }

    Alert.alert('Exit Stabilize?', 'You can return any time.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <RitualScaffold showOrbs overlayOpacity={0.52} contentStyle={styles.safeArea}>
      <RitualTopBar onBack={handleBack} phaseLabel={phaseLabel} disableBack={false} />

      <View style={styles.content}>
        <View style={styles.symbolStage}>
          <Animated.View style={[styles.ringWrap, ringAnimatedStyle]} pointerEvents="none">
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={`${colors.gold}22`}
                strokeWidth={RING_STROKE}
                fill="none"
                animatedProps={trackAnimatedProps}
              />

              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.gold}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeDasharray={circumference}
                strokeLinecap="round"
                rotation="-90"
                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                animatedProps={progressAnimatedProps}
              />

              {/* Seal shimmer ring */}
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS + 10}
                stroke={`${colors.gold}55`}
                strokeWidth={1.5}
                fill="none"
                animatedProps={sealRingAnimatedProps}
              />
            </Svg>
          </Animated.View>

          <Animated.View style={[styles.symbolWrap, symbolAnimatedStyle]}>
            {anchor?.enhancedImageUrl ? (
              <OptimizedImage
                uri={anchor.enhancedImageUrl}
                style={styles.symbolImage}
                resizeMode="cover"
              />
            ) : anchor?.baseSigilSvg ? (
              <SvgXml
                xml={anchor.baseSigilSvg}
                width={SYMBOL_SIZE}
                height={SYMBOL_SIZE}
              />
            ) : (
              <View style={styles.symbolFallback}>
                <Text style={styles.symbolFallbackText}>◈</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {phase !== 'complete' ? (
          <Animated.View
            key={phase}
            entering={FadeInDown.duration(320)}
            exiting={FadeOutDown.duration(220)}
            style={styles.instructionWrap}
          >
            {phase === 'arrive' ? (
              <>
                <Text style={styles.breathCue}>{breathCue}</Text>
                <InstructionGlassCard text="Return to center." emphasized />
              </>
            ) : phase === 'hold' ? (
              <InstructionGlassCard
                text="Let this symbol mean: I am here."
                emphasized
              />
            ) : (
              <InstructionGlassCard text="State locked." emphasized />
            )}
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeIn.duration(360)}
            exiting={FadeOut.duration(200)}
            style={styles.completionWrap}
          >
            <View style={styles.rewardRow}>
              <View style={styles.rewardChip}>
                <Text style={styles.rewardChipText}>Calm +1</Text>
              </View>
              <View style={styles.completeBadge}>
                <Text style={styles.completeBadgeText}>✓</Text>
              </View>
            </View>

            {completionMessage ? (
              <Text style={styles.completionMessage}>{completionMessage}</Text>
            ) : null}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={styles.doneButton}
            >
              <LinearGradient
                colors={[colors.gold, colors.bronze]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.doneGradient}
              >
                <Text style={styles.doneText}>Done</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  symbolStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  ringWrap: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolWrap: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SYMBOL_SIZE / 2,
    overflow: 'hidden',
  },
  symbolImage: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
  },
  symbolFallback: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.18)',
  },
  symbolFallbackText: {
    fontSize: 72,
    color: `${colors.gold}AA`,
    fontFamily: typography.fonts.heading,
  },
  instructionWrap: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  breathCue: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  completionWrap: {
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rewardChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  rewardChipText: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  completeBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  completeBadgeText: {
    fontSize: 16,
    fontFamily: typography.fonts.bodyBold,
    color: colors.bone,
  },
  completionMessage: {
    fontSize: 14,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.95,
  },
  doneButton: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  doneGradient: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 16,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
    letterSpacing: 0.6,
  },
});

