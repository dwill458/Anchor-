import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { RitualScaffold } from './RitualScaffold';

// Replaced with dynamic hooks inside component
// const { width } = Dimensions.get('window');
// const ANCHOR_SIZE = Math.min(Math.round(width * 0.58), 264);
// const RING_RADIUS = ANCHOR_SIZE / 2 + 22;
// const RING_STROKE = 6;
// const RING_SIZE = RING_RADIUS * 2 + RING_STROKE * 4;

const RING_STROKE = 6;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type SessionStatus = 'running' | 'paused' | 'completed';

export type FocusSessionProps = {
  intentionText: string;
  anchorImageUri: string;
  durationSeconds: number;
  onComplete: () => void;
  onDismiss: () => void;
  /** Ground Note (Pattern 2): auto-fades after 6s. Only shown when guideMode is on. */
  groundNoteText?: string;
  groundNoteSecondary?: string;
};

type GlassSurfaceProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
};

type ProgressRingProps = {
  radius: number;
  strokeWidth: number;
  progress: SharedValue<number>;
  pausedDim: SharedValue<number>;
  flare: SharedValue<number>;
};

type GlassIconButtonProps = {
  label: string;
  icon: string;
  onPress: () => void;
  testID?: string;
};

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

type AnchorHeroProps = {
  anchorImageUri: string;
  size: number;
};

const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  style,
  intensity = 20,
}) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView tint="dark" intensity={intensity} style={[styles.glassSurface, style]}>
        {children}
      </BlurView>
    );
  }

  return <View style={[styles.glassSurface, styles.androidGlassFallback, style, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>{children}</View>;
};

const GlassIconButton: React.FC<GlassIconButtonProps> = ({
  label,
  icon,
  onPress,
  testID,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={styles.glassIconButton}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={styles.glassIconText}>{icon}</Text>
    </Pressable>
  );
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  testID,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.primaryButton}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const ProgressRing: React.FC<ProgressRingProps> = ({
  radius,
  strokeWidth,
  progress,
  pausedDim,
  flare,
}) => {
  const size = radius * 2 + strokeWidth * 4;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const trackAnimatedProps = useAnimatedProps(() => {
    return {
      opacity: (0.45 + progress.value * 0.1) * pausedDim.value,
      strokeWidth,
    };
  });

  const progressAnimatedProps = useAnimatedProps(() => {
    return {
      strokeDashoffset: circumference * (1 - progress.value),
      opacity: (0.35 + 0.55 * progress.value + flare.value * 0.25) * pausedDim.value,
      strokeWidth: strokeWidth + flare.value * 1.5,
    };
  });

  return (
    <View style={styles.progressRingWrap} pointerEvents="none">
      <Svg width={size} height={size}>
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={`${colors.gold}26`}
          fill="none"
          animatedProps={trackAnimatedProps}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.gold}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
          animatedProps={progressAnimatedProps}
        />
      </Svg>
    </View>
  );
};

const AnchorHero: React.FC<AnchorHeroProps> = ({ anchorImageUri, size }) => {
  const trimmed = anchorImageUri.trim();
  const isSvgXml = trimmed.startsWith('<svg');

  return (
    <View style={[styles.anchorHero, { width: size, height: size, borderRadius: size / 2 }]}>
      {anchorImageUri ? (
        isSvgXml ? (
          <SvgXml xml={anchorImageUri} width={size} height={size} />
        ) : (
          <OptimizedImage
            uri={anchorImageUri}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        )
      ) : (
        <View style={styles.anchorFallbackWrap}>
          <Text style={styles.anchorFallbackText}>*</Text>
        </View>
      )}
    </View>
  );
};

const formatTime = (seconds: number): string => {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const FocusSession: React.FC<FocusSessionProps> = ({
  intentionText,
  anchorImageUri,
  durationSeconds,
  onComplete,
  onDismiss,
  groundNoteText,
  groundNoteSecondary,
}) => {
  const { width } = useWindowDimensions();
  const ANCHOR_SIZE = Math.min(Math.round(width * 0.58), 264);
  const RING_RADIUS = ANCHOR_SIZE / 2 + 22;
  const RING_SIZE = RING_RADIUS * 2 + RING_STROKE * 4;

  const totalMs = Math.max(1000, Math.round(durationSeconds * 1000));
  const reduceMotionEnabled = useReduceMotionEnabled();

  const [status, setStatus] = useState<SessionStatus>('running');
  const [secondsRemaining, setSecondsRemaining] = useState(Math.ceil(totalMs / 1000));
  const [groundNoteVisible, setGroundNoteVisible] = useState(!!groundNoteText);
  const groundNoteOpacity = useRef(new Animated.Value(groundNoteText ? 0 : 0)).current;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endAtMsRef = useRef<number>(Date.now() + totalMs);
  const remainingMsRef = useRef<number>(totalMs);
  const renderedSecondsRef = useRef<number>(Math.ceil(totalMs / 1000));
  const completionTriggeredRef = useRef(false);
  const continuePressedRef = useRef(false);

  const progress = useSharedValue(0);
  const breathScale = useSharedValue(1);
  const glowBoost = useSharedValue(0);
  const pausedDim = useSharedValue(1);
  const flare = useSharedValue(0);

  const timerDisplay = useMemo(() => formatTime(secondsRemaining), [secondsRemaining]);

  // Ground Note (Pattern 2): fade in, then auto-fade after 6s
  useEffect(() => {
    if (!groundNoteText) return;
    setGroundNoteVisible(true);
    Animated.timing(groundNoteOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(groundNoteOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setGroundNoteVisible(false));
    }, 6000);
    return () => clearTimeout(timer);
  }, [groundNoteText]);

  const clearTickInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const animateProgressToEnd = useCallback(
    (remainingMs: number) => {
      cancelAnimation(progress);
      if (remainingMs <= 0) {
        progress.value = 1;
        return;
      }

      progress.value = withTiming(1, {
        duration: remainingMs,
        easing: Easing.linear,
      });
    },
    [progress]
  );

  const completeSession = useCallback(() => {
    if (completionTriggeredRef.current) {
      return;
    }

    completionTriggeredRef.current = true;
    clearTickInterval();

    remainingMsRef.current = 0;
    renderedSecondsRef.current = 0;
    setSecondsRemaining(0);
    setStatus('completed');

    pausedDim.value = withTiming(1, { duration: 180 });
    animateProgressToEnd(220);

    if (reduceMotionEnabled) {
      flare.value = 0;
      glowBoost.value = withTiming(0.2, { duration: 260 });
    } else {
      flare.value = withSequence(
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })
      );
      glowBoost.value = withSequence(
        withTiming(0.3, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0.12, { duration: 360, easing: Easing.inOut(Easing.quad) })
      );
    }

    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
  }, [
    animateProgressToEnd,
    clearTickInterval,
    flare,
    glowBoost,
    pausedDim,
    reduceMotionEnabled,
  ]);

  const tickCountdown = useCallback(() => {
    const remainingMs = Math.max(0, endAtMsRef.current - Date.now());
    remainingMsRef.current = remainingMs;

    const nextSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    if (nextSeconds !== renderedSecondsRef.current) {
      renderedSecondsRef.current = nextSeconds;
      setSecondsRemaining(nextSeconds);
    }

    if (remainingMs <= 0) {
      completeSession();
    }
  }, [completeSession]);

  const startTickInterval = useCallback(() => {
    clearTickInterval();
    intervalRef.current = setInterval(tickCountdown, 250);
  }, [clearTickInterval, tickCountdown]);

  const handlePause = useCallback(() => {
    if (status !== 'running') {
      return;
    }

    const remainingMs = Math.max(0, endAtMsRef.current - Date.now());
    remainingMsRef.current = remainingMs;

    clearTickInterval();
    cancelAnimation(progress);
    pausedDim.value = withTiming(0.45, { duration: 180 });
    setStatus('paused');
  }, [clearTickInterval, pausedDim, progress, status]);

  const handleResume = useCallback(() => {
    if (status !== 'paused') {
      return;
    }

    if (remainingMsRef.current <= 0) {
      completeSession();
      return;
    }

    endAtMsRef.current = Date.now() + remainingMsRef.current;
    pausedDim.value = withTiming(1, { duration: 200 });
    setStatus('running');
    animateProgressToEnd(remainingMsRef.current);
    startTickInterval();
  }, [
    animateProgressToEnd,
    completeSession,
    pausedDim,
    startTickInterval,
    status,
  ]);

  const handleContinue = useCallback(() => {
    if (status !== 'completed' || continuePressedRef.current) {
      return;
    }

    continuePressedRef.current = true;
    onComplete();
  }, [onComplete, status]);

  useEffect(() => {
    continuePressedRef.current = false;
    completionTriggeredRef.current = false;

    renderedSecondsRef.current = Math.ceil(totalMs / 1000);
    remainingMsRef.current = totalMs;
    endAtMsRef.current = Date.now() + totalMs;

    setStatus('running');
    setSecondsRemaining(renderedSecondsRef.current);

    progress.value = 0;
    pausedDim.value = 1;
    flare.value = 0;
    glowBoost.value = 0.05;

    animateProgressToEnd(totalMs);
    startTickInterval();

    return () => {
      clearTickInterval();
      cancelAnimation(progress);
      cancelAnimation(breathScale);
      cancelAnimation(flare);
      cancelAnimation(glowBoost);
      cancelAnimation(pausedDim);
    };
  }, [totalMs]);

  useEffect(() => {
    if (reduceMotionEnabled || status !== 'running') {
      cancelAnimation(breathScale);
      breathScale.value = withTiming(1, { duration: 200 });
      return;
    }

    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.02, {
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1, {
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(breathScale);
    };
  }, [breathScale, reduceMotionEnabled, status]);

  const anchorBreathStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: breathScale.value }],
    };
  });

  const bloomStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(progress.value, [0, 1], [0.12, 0.28]);
    const baseScale = interpolate(progress.value, [0, 1], [0.94, 1.18]);
    const completionBoost = glowBoost.value + flare.value * 0.35;

    return {
      opacity: (baseOpacity + completionBoost) * pausedDim.value,
      transform: [{ scale: baseScale + flare.value * 0.09 }],
    };
  });

  const timerChipStyle = useAnimatedStyle(() => {
    return {
      opacity: pausedDim.value,
    };
  });

  return (
    <RitualScaffold>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.topSpacer} />
          <Text style={styles.title}>Focus Session</Text>
          <GlassIconButton
            label="Dismiss focus session"
            icon="X"
            onPress={onDismiss}
            testID="focus-session-dismiss"
          />
        </View>

        <View style={styles.intentionWrap}>
          <View style={styles.intentionLabelChip}>
            <Text style={styles.intentionLabelText}>Intention</Text>
          </View>
          <GlassSurface style={styles.intentionCard} intensity={18}>
            <Text style={styles.intentionText}>{intentionText}</Text>
          </GlassSurface>
        </View>

        <View style={styles.heroSection}>
          <View style={[styles.heroStack, { width: RING_SIZE, height: RING_SIZE + 62 }]}>
            <Animated.View
              style={[
                styles.anchorBloom,
                bloomStyle,
                {
                  top: (RING_SIZE - ANCHOR_SIZE * 1.34) / 2,
                  left: (RING_SIZE - ANCHOR_SIZE * 1.34) / 2,
                  width: ANCHOR_SIZE * 1.34,
                  height: ANCHOR_SIZE * 1.34,
                  borderRadius: (ANCHOR_SIZE * 1.34) / 2,
                }
              ]}
            />
            <ProgressRing
              radius={RING_RADIUS}
              strokeWidth={RING_STROKE}
              progress={progress}
              pausedDim={pausedDim}
              flare={flare}
            />
            <Animated.View
              style={[
                styles.anchorWrap,
                anchorBreathStyle,
                {
                  top: RING_STROKE * 2 + (RING_RADIUS * 2 - ANCHOR_SIZE) / 2,
                  left: (RING_SIZE - ANCHOR_SIZE) / 2,
                }
              ]}
            >
              <AnchorHero anchorImageUri={anchorImageUri} size={ANCHOR_SIZE} />
            </Animated.View>
            <Animated.View style={[styles.timerChipWrap, timerChipStyle]}>
              <GlassSurface style={styles.timerChip} intensity={16}>
                <Text style={styles.timerLabel}>remaining</Text>
                <Text style={styles.timerValue} testID="focus-session-timer">
                  {timerDisplay}
                </Text>
              </GlassSurface>
            </Animated.View>
          </View>
        </View>

        <View style={styles.footer}>
          <GlassSurface style={styles.guidanceCard} intensity={16}>
            <Text style={styles.guidanceText} testID="focus-session-guidance">
              {status === 'completed' ? 'Sealed.' : 'Hold the symbol. Let the words fade.'}
            </Text>
          </GlassSurface>

          {groundNoteVisible && groundNoteText ? (
            <Animated.View style={[styles.groundNoteWrap, { opacity: groundNoteOpacity }]}>
              <Text style={styles.groundNoteText}>{groundNoteText}</Text>
              {groundNoteSecondary ? (
                <Text style={styles.groundNoteSecondary}>{groundNoteSecondary}</Text>
              ) : null}
            </Animated.View>
          ) : null}

          {status === 'running' ? (
            <TouchableOpacity
              onPress={handlePause}
              activeOpacity={0.82}
              style={styles.pauseButton}
              accessibilityRole="button"
              accessibilityLabel="Pause"
              testID="focus-session-pause"
            >
              <Text style={styles.pauseIcon}>||</Text>
              <Text style={styles.pauseText}>Pause</Text>
            </TouchableOpacity>
          ) : null}

          {status === 'paused' ? (
            <View style={styles.pausedWrap}>
              <Text style={styles.pausedText}>Paused</Text>
              <PrimaryButton
                label="Resume"
                onPress={handleResume}
                testID="focus-session-resume"
              />
            </View>
          ) : null}

          {status === 'completed' ? (
            <PrimaryButton
              label="Continue"
              onPress={handleContinue}
              testID="focus-session-continue"
            />
          ) : null}
        </View>
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  topRow: {
    minHeight: 52,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  glassIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ritual.glass,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  glassIconText: {
    color: colors.text.secondary,
    fontFamily: typography.fonts.bodyBold,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  intentionWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  intentionLabelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
    marginBottom: spacing.sm,
  },
  intentionLabelText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
    letterSpacing: 0.4,
  },
  intentionCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  intentionText: {
    color: colors.text.primary,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    lineHeight: typography.lineHeights.body1,
    textAlign: 'center',
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStack: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  progressRingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  anchorBloom: {
    position: 'absolute',
    backgroundColor: `${colors.gold}22`,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.44,
    shadowRadius: 28,
    elevation: 16,
  },
  anchorWrap: {
    position: 'absolute',
  },
  anchorHero: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.gold}2A`,
    backgroundColor: colors.background.secondary,
  },
  anchorFallbackWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  anchorFallbackText: {
    color: colors.gold,
    fontSize: 42,
    lineHeight: 42,
    fontFamily: typography.fonts.heading,
  },
  timerChipWrap: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
  },
  timerChip: {
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    minWidth: 124,
    alignItems: 'center',
  },
  timerLabel: {
    color: colors.text.secondary,
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    textTransform: 'lowercase',
    letterSpacing: 0.45,
  },
  timerValue: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 34,
    lineHeight: 38,
    marginTop: 1,
    letterSpacing: 0.4,
  },
  footer: {
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  guidanceCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  guidanceText: {
    color: colors.text.primary,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },
  pauseButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pauseIcon: {
    color: colors.text.secondary,
    fontFamily: typography.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: -1,
  },
  pauseText: {
    color: colors.text.secondary,
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body2,
    letterSpacing: 0.3,
  },
  pausedWrap: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pausedText: {
    color: colors.text.secondary,
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    letterSpacing: 0.45,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.navy,
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body1,
    letterSpacing: 0.45,
  },
  glassSurface: {
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
    overflow: 'hidden',
  },
  androidGlassFallback: {
    backgroundColor: colors.ritual.glassStrong,
  },
  groundNoteWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groundNoteText: {
    fontSize: 13,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  groundNoteSecondary: {
    fontSize: 12,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
