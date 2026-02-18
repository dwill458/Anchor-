import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Canvas, Circle, Group, BlurMask } from '@shopify/react-native-skia';
import { useNavigation } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { RitualScaffold } from './RitualScaffold';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';
import { safeHaptics } from '@/utils/haptics';
import { colors, spacing, typography } from '@/theme';

type CommitStatus = 'pending' | 'success' | 'error';
type OverlayState = 'animating' | 'syncing' | 'success' | 'error';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIGIL_SIZE = Math.min(320, SCREEN_WIDTH * 0.7);
const TOTAL_DURATION_MS = 4000;

const IGNITION_END = 0.15; // 0.6s
const CATCH_END = 0.45; // 1.8s
const DISSOLVE_END = 0.8; // 3.2s
const RELEASE_END = 1;

const EMBER_COLOR = '#E68B2E';
const ASH_COLOR = '#E9E6DF';

export type BurnCommitFn = () => Promise<void>;

export interface BurnAnimationOverlayProps {
  sigilSvg: string;
  enhancedImageUrl?: string;
  onCommitBurn: BurnCommitFn;
  onReturnToSanctuary: () => void;
  onReturnToAnchor?: () => void;
}

interface EmberSeed {
  id: number;
  x: number;
  y: number;
  rise: number;
  driftX: number;
  radius: number;
  start: number;
  end: number;
}

interface AshSeed {
  id: number;
  x: number;
  y: number;
  rise: number;
  driftX: number;
  driftY: number;
  radius: number;
  start: number;
  end: number;
}

interface Point {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number): number => {
  'worklet';
  return Math.min(max, Math.max(min, value));
};

const seeded = (seed: number): number => {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Couldn't complete release. Try again.";
};

const getNormalizedPhase = (progress: number, start: number, end: number): number => {
  'worklet';
  if (end <= start) return 1;
  return clamp((progress - start) / (end - start), 0, 1);
};

const extractSvgPoints = (sigilSvg: string): Point[] => {
  const points: Point[] = [];
  const pathRegex = /<path[^>]*d=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  let match: RegExpExecArray | null = pathRegex.exec(sigilSvg);

  while (match) {
    const d = match[1] ?? match[2] ?? '';
    const raw = d.match(/-?\d*\.?\d+/g);

    if (raw && raw.length >= 2) {
      for (let index = 0; index < raw.length - 1; index += 2) {
        const x = Number(raw[index]);
        const y = Number(raw[index + 1]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          points.push({
            x: clamp(x, 0, 100),
            y: clamp(y, 0, 100),
          });
        }
      }
    }

    match = pathRegex.exec(sigilSvg);
  }

  if (points.length >= 3) {
    return points;
  }

  const fallback: Point[] = [];
  for (let index = 0; index < 36; index += 1) {
    const angle = (index / 36) * Math.PI * 2;
    fallback.push({
      x: 50 + Math.cos(angle) * 22,
      y: 50 + Math.sin(angle) * 22,
    });
  }
  return fallback;
};

const buildAshSeeds = (sigilSvg: string, count: number): AshSeed[] => {
  const points = extractSvgPoints(sigilSvg);
  const lastPointIndex = Math.max(points.length - 1, 1);
  const seeds: AshSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    const sequence = (index / Math.max(count - 1, 1)) * lastPointIndex;
    const baseIndex = Math.floor(sequence);
    const t = sequence - baseIndex;
    const pointA = points[baseIndex];
    const pointB = points[Math.min(baseIndex + 1, points.length - 1)];
    const rawX = pointA.x + (pointB.x - pointA.x) * t;
    const rawY = pointA.y + (pointB.y - pointA.y) * t;
    const jitterAmount = (seeded(index + 91) - 0.5) * 4.6;
    const jitterAmountY = (seeded(index + 193) - 0.5) * 4.6;

    seeds.push({
      id: index,
      x: ((rawX + jitterAmount) / 100 - 0.5) * SIGIL_SIZE * 0.88,
      y: ((rawY + jitterAmountY) / 100 - 0.5) * SIGIL_SIZE * 0.88,
      rise: 52 + seeded(index + 377) * 86,
      driftX: (seeded(index + 587) - 0.5) * 34,
      driftY: (seeded(index + 811) - 0.5) * 24,
      radius: 0.75 + seeded(index + 991) * 1.95,
      start: 0.46 + seeded(index + 1297) * 0.08,
      end: 0.86 + seeded(index + 1451) * 0.1,
    });
  }

  return seeds;
};

const buildEmberSeeds = (count: number): EmberSeed[] => {
  const seeds: EmberSeed[] = [];

  for (let index = 0; index < count; index += 1) {
    seeds.push({
      id: index,
      x: (seeded(index + 71) - 0.5) * SIGIL_SIZE * 0.54,
      y: (seeded(index + 113) - 0.5) * SIGIL_SIZE * 0.22,
      rise: 90 + seeded(index + 167) * 120,
      driftX: (seeded(index + 241) - 0.5) * 42,
      radius: 1.2 + seeded(index + 311) * 2.6,
      start: 0.18 + seeded(index + 401) * 0.19,
      end: 0.56 + seeded(index + 503) * 0.27,
    });
  }

  return seeds;
};

interface ParticleProps<T> {
  seed: T;
  center: number;
  progress: SharedValue<number>;
}

const EmberParticle: React.FC<ParticleProps<EmberSeed>> = ({ seed, center, progress }) => {
  const local = useDerivedValue(() => {
    return getNormalizedPhase(progress.value, seed.start, seed.end);
  });
  const cx = useDerivedValue(() => center + seed.x + seed.driftX * local.value);
  const cy = useDerivedValue(() => center + seed.y - seed.rise * local.value);
  const opacity = useDerivedValue(() => {
    const p = local.value;
    if (p <= 0) return 0;
    if (p <= 0.18) return p / 0.18;
    if (p >= 0.88) return (1 - p) / 0.12;
    return 0.95;
  });
  const radius = useDerivedValue(() => seed.radius * (1 + local.value * 0.2));

  return <Circle cx={cx} cy={cy} r={radius} opacity={opacity} color={EMBER_COLOR} />;
};

const AshParticle: React.FC<ParticleProps<AshSeed>> = ({ seed, center, progress }) => {
  const local = useDerivedValue(() => {
    return getNormalizedPhase(progress.value, seed.start, seed.end);
  });
  const cx = useDerivedValue(() => center + seed.x + seed.driftX * local.value);
  const cy = useDerivedValue(() => center + seed.y - seed.rise * local.value + seed.driftY * local.value);
  const opacity = useDerivedValue(() => {
    const p = local.value;
    if (p <= 0) return 0;
    if (p <= 0.12) return (p / 0.12) * 0.96;
    if (p >= 0.78) return ((1 - p) / 0.22) * 0.85;
    return 0.82;
  });
  const radius = useDerivedValue(() => {
    return seed.radius * (1 - local.value * 0.32);
  });

  return <Circle cx={cx} cy={cy} r={radius} opacity={opacity} color={ASH_COLOR} />;
};

export const BurnAnimationOverlay: React.FC<BurnAnimationOverlayProps> = ({
  sigilSvg,
  enhancedImageUrl,
  onCommitBurn,
  onReturnToSanctuary,
  onReturnToAnchor,
}) => {
  const navigation = useNavigation<any>();
  const reduceMotionEnabled = useReduceMotionEnabled();

  const [overlayState, setOverlayState] = useState<OverlayState>('animating');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  const timeline = useSharedValue(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isMountedRef = useRef(true);
  const completionHapticTriggeredRef = useRef(false);
  const animationCompleteRef = useRef(false);
  const commitStatusRef = useRef<CommitStatus>('pending');
  const isLockedRef = useRef(true);

  const emberCount = Platform.OS === 'android' ? 18 : 24;
  const ashCount = Platform.OS === 'android' ? 150 : 210;

  const emberSeeds = useMemo(() => buildEmberSeeds(emberCount), [emberCount]);
  const ashSeeds = useMemo(() => buildAshSeeds(sigilSvg, ashCount), [sigilSvg, ashCount]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const queueTimer = useCallback((fn: () => void, delay: number): void => {
    const timer = setTimeout(fn, delay);
    timersRef.current.push(timer);
  }, []);

  const triggerCompletionHaptic = useCallback(() => {
    if (completionHapticTriggeredRef.current) return;
    completionHapticTriggeredRef.current = true;
    void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
  }, []);

  const transitionToSuccess = useCallback(() => {
    if (!isMountedRef.current) return;
    setOverlayState('success');
    setErrorMessage('');
    triggerCompletionHaptic();
  }, [triggerCompletionHaptic]);

  const transitionToError = useCallback((message: string) => {
    if (!isMountedRef.current) return;
    setOverlayState('error');
    setErrorMessage(message);
  }, []);

  const handleAnimationFinish = useCallback(() => {
    animationCompleteRef.current = true;

    if (commitStatusRef.current === 'success') {
      transitionToSuccess();
      return;
    }

    if (commitStatusRef.current === 'error') {
      transitionToError(errorMessage || "Couldn't complete release. Try again.");
      return;
    }

    if (isMountedRef.current) {
      setOverlayState('syncing');
    }
  }, [errorMessage, transitionToError, transitionToSuccess]);

  const runCommit = useCallback(async () => {
    commitStatusRef.current = 'pending';

    try {
      await onCommitBurn();
      commitStatusRef.current = 'success';

      if (animationCompleteRef.current) {
        transitionToSuccess();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      commitStatusRef.current = 'error';

      if (animationCompleteRef.current) {
        transitionToError(message);
      } else if (isMountedRef.current) {
        setErrorMessage(message);
      }
    }
  }, [onCommitBurn, transitionToError, transitionToSuccess]);

  const startSequence = useCallback(() => {
    Keyboard.dismiss();
    clearTimers();
    cancelAnimation(timeline);
    completionHapticTriggeredRef.current = false;
    animationCompleteRef.current = false;
    commitStatusRef.current = 'pending';

    setOverlayState('animating');
    setErrorMessage('');

    const duration = reduceMotionEnabled ? 700 : TOTAL_DURATION_MS;
    timeline.value = 0;
    timeline.value = withTiming(
      RELEASE_END,
      {
        duration,
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) {
          runOnJS(handleAnimationFinish)();
        }
      }
    );

    queueTimer(() => {
      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    }, reduceMotionEnabled ? 180 : 600);

    void runCommit();
  }, [clearTimers, handleAnimationFinish, queueTimer, reduceMotionEnabled, runCommit, timeline]);

  useEffect(() => {
    isMountedRef.current = true;
    startSequence();

    return () => {
      isMountedRef.current = false;
      clearTimers();
      cancelAnimation(timeline);
    };
  }, [clearTimers, startSequence, timeline]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });

    const beforeRemoveUnsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (!isLockedRef.current) return;
      event.preventDefault();
    });

    const hardwareBackSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return isLockedRef.current;
    });

    return () => {
      beforeRemoveUnsubscribe();
      hardwareBackSubscription.remove();
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation]);

  const vignetteStyle = useAnimatedStyle(() => {
    const ignition = getNormalizedPhase(timeline.value, 0, IGNITION_END);
    const catchPhase = getNormalizedPhase(timeline.value, IGNITION_END, CATCH_END);
    const releasePhase = getNormalizedPhase(timeline.value, DISSOLVE_END, RELEASE_END);
    const opacity = clamp(ignition * 0.55 + catchPhase * 0.25 - releasePhase * 0.7, 0, 0.5);

    return { opacity };
  });

  const sigilBloomStyle = useAnimatedStyle(() => {
    const ignition = getNormalizedPhase(timeline.value, 0, IGNITION_END);
    const catchPhase = getNormalizedPhase(timeline.value, IGNITION_END, CATCH_END);
    const dissolvePhase = getNormalizedPhase(timeline.value, CATCH_END, DISSOLVE_END);
    return {
      opacity: clamp(ignition * 0.8 + catchPhase * 0.55 - dissolvePhase * 0.95, 0, 0.85),
      transform: [{ scale: interpolate(ignition, [0, 1], [1, 1.08]) }],
    };
  });

  const sigilSolidStyle = useAnimatedStyle(() => {
    const dissolvePhase = getNormalizedPhase(timeline.value, CATCH_END, DISSOLVE_END);
    return {
      opacity: clamp(1 - dissolvePhase * 1.3, 0, 1),
      transform: [
        { translateY: interpolate(dissolvePhase, [0, 1], [0, -10]) },
        { scale: interpolate(dissolvePhase, [0, 1], [1, 0.93]) },
      ],
    };
  });

  const underlayStyle = useAnimatedStyle(() => {
    const dissolvePhase = getNormalizedPhase(timeline.value, CATCH_END, DISSOLVE_END);
    return {
      opacity: clamp(0.24 - dissolvePhase * 0.24, 0, 0.24),
    };
  });

  const hazeOpacity = useDerivedValue(() => {
    const releasePhase = getNormalizedPhase(timeline.value, DISSOLVE_END, RELEASE_END);
    return clamp(0.35 * (1 - releasePhase), 0, 0.35);
  });

  const hazeRadius = useDerivedValue(() => {
    const releasePhase = getNormalizedPhase(timeline.value, DISSOLVE_END, RELEASE_END);
    return SIGIL_SIZE * (0.24 + releasePhase * 0.2);
  });

  const title = overlayState === 'error' ? "Couldn't complete release." : 'Released';
  const subtitle = overlayState === 'error' ? errorMessage : 'The loop is closed.';

  const handleReturnToSanctuaryPress = useCallback(() => {
    isLockedRef.current = false;
    navigation.setOptions({ gestureEnabled: true });
    onReturnToSanctuary();
  }, [navigation, onReturnToSanctuary]);

  const handleReturnToAnchorPress = useCallback(() => {
    isLockedRef.current = false;
    navigation.setOptions({ gestureEnabled: true });
    if (onReturnToAnchor) {
      onReturnToAnchor();
      return;
    }
    onReturnToSanctuary();
  }, [navigation, onReturnToAnchor, onReturnToSanctuary]);

  const handleRetryPress = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setErrorMessage('');

    try {
      await onCommitBurn();
      commitStatusRef.current = 'success';
      transitionToSuccess();
    } catch (error) {
      const message = getErrorMessage(error);
      commitStatusRef.current = 'error';
      transitionToError(message);
    } finally {
      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, [isRetrying, onCommitBurn, transitionToError, transitionToSuccess]);

  return (
    <RitualScaffold showOrbs={true} overlayOpacity={0.34}>
      <View style={styles.container}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.vignette, vignetteStyle]} />

        <View style={styles.centerStage}>
          <View style={styles.sigilFrame}>
            <Animated.View pointerEvents="none" style={[styles.sigilBloom, sigilBloomStyle]} />

            {enhancedImageUrl && (
              <Animated.View pointerEvents="none" style={[styles.underlayContainer, underlayStyle]}>
                <OptimizedImage
                  uri={enhancedImageUrl}
                  style={styles.underlayImage}
                  resizeMode="cover"
                />
              </Animated.View>
            )}

            <Animated.View style={[styles.solidSigilLayer, sigilSolidStyle]}>
              <SvgXml xml={sigilSvg} width={SIGIL_SIZE * 0.9} height={SIGIL_SIZE * 0.9} color={colors.gold} />
            </Animated.View>

            {!reduceMotionEnabled && (
              <Canvas style={styles.canvas} pointerEvents="none">
                <Group>
                  {emberSeeds.map((seed) => (
                    <EmberParticle key={`ember-${seed.id}`} seed={seed} center={SIGIL_SIZE / 2} progress={timeline} />
                  ))}
                  {ashSeeds.map((seed) => (
                    <AshParticle key={`ash-${seed.id}`} seed={seed} center={SIGIL_SIZE / 2} progress={timeline} />
                  ))}
                </Group>
                <Circle
                  cx={SIGIL_SIZE / 2}
                  cy={SIGIL_SIZE / 2}
                  r={hazeRadius}
                  color={ASH_COLOR}
                  opacity={hazeOpacity}
                >
                  <BlurMask blur={22} style="normal" />
                </Circle>
              </Canvas>
            )}
          </View>
        </View>

        {overlayState === 'animating' || overlayState === 'syncing' ? (
          <View style={styles.statusContainer}>
            <Text style={styles.statusTitle}>Releasing...</Text>
            {overlayState === 'syncing' && (
              <View style={styles.spinnerRow}>
                <ActivityIndicator color={colors.gold} size="small" />
                <Text style={styles.syncText}>Finalizing ritual</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>{title}</Text>
            <Text style={styles.resultSubtitle}>{subtitle}</Text>

            {overlayState === 'success' ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleReturnToSanctuaryPress}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Return to Sanctuary"
              >
                <Text style={styles.primaryButtonText}>Return to Sanctuary</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, isRetrying && styles.primaryButtonDisabled]}
                  onPress={handleRetryPress}
                  disabled={isRetrying}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                >
                  {isRetrying ? (
                    <ActivityIndicator color={colors.background.primary} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Try again</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleReturnToAnchorPress}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Return to Anchor"
                >
                  <Text style={styles.secondaryButtonText}>Return to Anchor</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  vignette: {
    backgroundColor: 'rgba(8, 10, 18, 0.92)',
  },
  centerStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilFrame: {
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'rgba(10, 14, 20, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sigilBloom: {
    position: 'absolute',
    width: SIGIL_SIZE * 0.92,
    height: SIGIL_SIZE * 0.92,
    borderRadius: (SIGIL_SIZE * 0.92) / 2,
    shadowColor: colors.gold,
    shadowOpacity: 0.65,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  underlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  underlayImage: {
    width: SIGIL_SIZE * 0.88,
    height: SIGIL_SIZE * 0.88,
    borderRadius: (SIGIL_SIZE * 0.88) / 2,
  },
  solidSigilLayer: {
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  statusContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    minHeight: 140,
  },
  statusTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.bone,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  spinnerRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  syncText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
  resultContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    minHeight: 220,
  },
  resultTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.bone,
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  resultSubtitle: {
    marginTop: spacing.sm,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    marginTop: spacing.xl,
    minWidth: SCREEN_WIDTH * 0.72,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    letterSpacing: 0.8,
  },
  secondaryButton: {
    marginTop: spacing.md,
    minWidth: SCREEN_WIDTH * 0.72,
    paddingVertical: spacing.md,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: 'rgba(15, 20, 25, 0.66)',
  },
  secondaryButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
  },
});
