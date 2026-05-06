import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Canvas, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import Svg, { Path } from 'react-native-svg';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { OptimizedImage, PremiumAnchorGlow, SigilSvg } from '@/components/common';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAudio } from '@/hooks/useAudio';
import { useNotificationController } from '@/hooks/useNotificationController';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, spacing, typography } from '@/theme';
import type { RootStackParamList } from '@/types';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SYMBOL_SIZE = Math.min(SCREEN_WIDTH * 0.65, 256);
const RING_ONE_SIZE = SYMBOL_SIZE + 48;
const RING_TWO_SIZE = SYMBOL_SIZE + 96;
const THREAD_TRACK_WIDTH = 120;

type FirstPrimeCompleteRouteProp = RouteProp<RootStackParamList, 'FirstPrimeComplete'>;
type FirstPrimeCompleteNavigationProp = StackNavigationProp<
  RootStackParamList,
  'FirstPrimeComplete'
>;

const FadeUp: React.FC<{
  animation: Animated.Value;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ animation, children, style }) => {
  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

  return (
    <Animated.View style={[style, { opacity: animation, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
};

export const FirstPrimeCompleteScreen: React.FC = () => {
  const navigation = useNavigation<FirstPrimeCompleteNavigationProp>();
  const { navigateToPractice } = useTabNavigation();
  const route = useRoute<FirstPrimeCompleteRouteProp>();
  const { anchorId, sessionCount, threadStrength, durationSeconds, returnTo } = route.params;

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const updateAnchor = useAnchorStore((state) => state.updateAnchor);
  const incrementTotalPrimes = useAnchorStore((state) => state.incrementTotalPrimes);
  const recordPrimeSession = useAnchorStore((state) => state.recordPrimeSession);
  const recordSession = useSessionStore((state) => state.recordSession);
  const primeSessionAudio = useSettingsStore((state) => state.primeSessionAudio ?? 'silent');
  const { playSound } = useAudio();
  const { handlePrimeComplete } = useNotificationController();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const anchor = getAnchorById(anchorId);
  const hasRecordedRef = useRef(false);

  const glowBreath = useRef(new Animated.Value(0)).current;
  const ringSpinA = useRef(new Animated.Value(0)).current;
  const ringSpinB = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const footerBlink = useRef(new Animated.Value(0.4)).current;
  const threadFill = useRef(new Animated.Value(0)).current;

  const checkAnim = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const symbolAnim = useRef(new Animated.Value(0)).current;
  const pillAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const dividerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  const symbolSvg = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg ?? '';
  const intentionText = anchor?.intentionText?.trim() || 'Your anchor is set.';
  const targetFillPercent = Math.min(100, Math.max(8, threadStrength * 8));
  const targetFillWidth = (THREAD_TRACK_WIDTH * targetFillPercent) / 100;

  const ringRotateA = ringSpinA.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const ringRotateB = ringSpinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });
  const pulseScale = ringPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });
  const pulseOpacity = ringPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.45, 0.04, 0.45],
  });
  const glowOneStyle = useMemo(
    () => ({
      opacity: glowBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.52, 0.9, 0.52],
      }),
      transform: [
        {
          scale: glowBreath.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 1.06, 1],
          }),
        },
      ],
    }),
    [glowBreath]
  );
  const glowTwoStyle = useMemo(
    () => ({
      opacity: glowBreath.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.18, 0.34, 0.18],
      }),
      transform: [
        {
          scale: glowBreath.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.98, 1.05, 0.98],
          }),
        },
      ],
    }),
    [glowBreath]
  );

  useEffect(() => {
    if (!hasRecordedRef.current) {
      hasRecordedRef.current = true;

      // Count the very first priming session toward lifetime Total Primes
      const currentActivationCount = useAnchorStore.getState().getAnchorById(anchorId)?.activationCount ?? 0;
      updateAnchor(anchorId, {
        activationCount: currentActivationCount + 1,
        lastActivatedAt: new Date(),
      });
      incrementTotalPrimes();
      recordPrimeSession();

      recordSession({
        anchorId,
        type: 'reinforce',
        durationSeconds,
        mode: primeSessionAudio,
        completedAt: new Date().toISOString(),
      });
      void handlePrimeComplete();
      AnalyticsService.track('first_prime_completed', {
        anchor_id: anchorId,
        intention_id: anchor?.id ?? anchorId,
        session_count: sessionCount,
        timestamp: new Date().toISOString(),
      });
    }

    const entranceAnimations = [
      Animated.timing(checkAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headlineAnim, {
        toValue: 1,
        duration: 700,
        delay: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(symbolAnim, {
        toValue: 1,
        duration: 800,
        delay: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pillAnim, {
        toValue: 1,
        duration: 600,
        delay: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(barAnim, {
        toValue: 1,
        duration: 600,
        delay: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dividerAnim, {
        toValue: 1,
        duration: 500,
        delay: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 700,
        delay: 1350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 600,
        delay: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ];

    Animated.parallel(entranceAnimations).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowBreath, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowBreath, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const spinLoopA = Animated.loop(
      Animated.timing(ringSpinA, {
        toValue: 1,
        duration: 40000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const spinLoopB = Animated.loop(
      Animated.timing(ringSpinB, {
        toValue: 1,
        duration: 60000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const footerBlinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(footerBlink, {
          toValue: 0.14,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(footerBlink, {
          toValue: 0.4,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();
    spinLoopA.start();
    spinLoopB.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ringPulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseTimer = setTimeout(() => {
      pulseLoop.start();
    }, 1000);

    const barTimer = setTimeout(() => {
      Animated.timing(threadFill, {
        toValue: targetFillWidth,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 1300);

    const footerBlinkTimer = setTimeout(() => {
      footerBlinkLoop.start();
    }, 2500);

    const soundTimer = setTimeout(() => {
      playSound('prime-complete');
    }, 2500);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(barTimer);
      clearTimeout(footerBlinkTimer);
      clearTimeout(soundTimer);
      glowLoop.stop();
      spinLoopA.stop();
      spinLoopB.stop();
      pulseLoop.stop();
      footerBlinkLoop.stop();
    };
  }, [
    anchor?.id,
    anchorId,
    barAnim,
    cardAnim,
    checkAnim,
    primeSessionAudio,
    dividerAnim,
    durationSeconds,
    footerAnim,
    footerBlink,
    glowBreath,
    headlineAnim,
    incrementTotalPrimes,
    pillAnim,
    playSound,
    handlePrimeComplete,
    recordPrimeSession,
    recordSession,
    ringPulse,
    ringSpinA,
    ringSpinB,
    sessionCount,
    symbolAnim,
    targetFillWidth,
    threadFill,
    updateAnchor,
  ]);

  const handleDismiss = () => {
    if (returnTo === 'practice') {
      const nav = navigation as unknown as { popToTop?: () => void };
      nav.popToTop?.();
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      navigation.replace('AnchorDetail', { anchorId });
      return;
    }

    // First-time flow: gate unauthenticated users through trial sign-up
    if (!isAuthenticated) {
      navigation.replace('TrialSignUp');
      return;
    }

    navigateToVaultDestination(navigation, 'replace');
  };

  if (!anchor) {
    return (
      <SafeAreaView style={styles.fallbackSafeArea} edges={['top', 'bottom']}>
        <Pressable style={styles.fallbackContainer} onPress={handleDismiss}>
          <Text style={styles.fallbackText}>Saved to Sanctuary.</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#3E2C5B', '#1A1228', '#080C10']}
        locations={[0, 0.38, 0.76]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.glowOne, glowOneStyle]} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={800} height={800}>
            <RadialGradient
              c={vec(400, 400)}
              r={400}
              colors={['rgba(62,44,91,0.85)', 'rgba(62,44,91,0.3)', 'rgba(62,44,91,0)']}
            />
          </Rect>
        </Canvas>
      </Animated.View>
      <Animated.View style={[styles.glowTwo, glowTwoStyle]} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={500} height={500}>
            <RadialGradient
              c={vec(250, 250)}
              r={250}
              colors={['rgba(212,175,55,0.45)', 'rgba(212,175,55,0.1)', 'rgba(212,175,55,0)']}
            />
          </Rect>
        </Canvas>
      </Animated.View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Pressable style={styles.pressable} onPress={handleDismiss}>
          <FadeUp animation={checkAnim} style={styles.checkBlock}>
            <View style={styles.checkCircle}>
              <Animated.View
                pointerEvents="none"
                style={[styles.checkPulseRing, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
              />
              <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
                <Path
                  d="M4.5 10.5L8.5 14.5L15.5 6.5"
                  stroke={colors.gold}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </FadeUp>

          <FadeUp animation={headlineAnim} style={styles.headlineBlock}>
            <Text style={styles.headline}>First thread laid.</Text>
            <Text style={styles.subhead}>
              Repetition carves the groove.{'\n'}
              Return tomorrow. The pattern builds.
            </Text>
          </FadeUp>

          <FadeUp animation={symbolAnim} style={styles.symbolSection}>
            <View style={styles.symbolWrap}>
              <Animated.View
                pointerEvents="none"
                style={[styles.dashedRing, styles.dashedRingInner, { transform: [{ rotate: ringRotateA }] }]}
              />
              <Animated.View
                pointerEvents="none"
                style={[styles.dashedRing, styles.dashedRingOuter, { transform: [{ rotate: ringRotateB }] }]}
              />
              <View style={styles.symbolDisc}>
                <View style={styles.symbolGlow}>
                  <PremiumAnchorGlow
                    size={SYMBOL_SIZE}
                    state="charged"
                    variant="ritual"
                    reduceMotionEnabled={false}
                  />
                </View>
                {anchor.enhancedImageUrl ? (
                  <OptimizedImage
                    uri={anchor.enhancedImageUrl}
                    style={styles.symbolImage}
                    resizeMode="cover"
                  />
                ) : (
                  <SigilSvg xml={symbolSvg} width={SYMBOL_SIZE * 0.78} height={SYMBOL_SIZE * 0.78} />
                )}
              </View>
            </View>
          </FadeUp>

          <FadeUp animation={pillAnim} style={styles.sessionPill}>
            <Text style={styles.sessionLabel}>Thread Strength</Text>
            <View style={styles.sessionDot} />
            <Text style={styles.sessionCount}>Session {sessionCount}</Text>
          </FadeUp>

          <FadeUp animation={barAnim} style={styles.threadWrap}>
            <View style={styles.threadTrack}>
              <Animated.View
                style={[
                  styles.threadFill,
                  {
                    width: threadFill,
                  },
                ]}
              />
            </View>
            <Text style={styles.threadLabel}>The imprint has begun</Text>
          </FadeUp>

          <FadeUp animation={dividerAnim} style={styles.dividerWrap}>
            <View style={styles.divider} />
          </FadeUp>

          <FadeUp animation={cardAnim} style={styles.card}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardEyebrow}>Your Anchor</Text>
            <Text style={styles.cardIntention} numberOfLines={3}>
              "{intentionText}"
            </Text>
          </FadeUp>

          <FadeUp animation={footerAnim} style={styles.footer}>
            <Text style={styles.footerText}>Saved to Sanctuary.</Text>
            <Animated.Text style={[styles.footerHint, { opacity: footerBlink }]}>
              Tap anywhere to continue
            </Animated.Text>
          </FadeUp>
        </Pressable>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  safeArea: {
    flex: 1,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  glowOne: {
    position: 'absolute',
    top: -150,
    alignSelf: 'center',
    width: 800,
    height: 800,
  },
  glowTwo: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: 500,
    height: 500,
  },
  checkBlock: {
    marginTop: 24,
  },
  checkCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkPulseRing: {
    position: 'absolute',
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  headlineBlock: {
    marginTop: 16,
    alignItems: 'center',
  },
  headline: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    lineHeight: 34,
    color: colors.bone,
    letterSpacing: 1.12,
    textAlign: 'center',
  },
  subhead: {
    marginTop: 10,
    maxWidth: 270,
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(245,245,220,0.55)',
    letterSpacing: 0.32,
    textAlign: 'center',
  },
  symbolSection: {
    marginTop: 24,
  },
  symbolWrap: {
    width: RING_TWO_SIZE,
    height: RING_TWO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  dashedRingInner: {
    width: RING_ONE_SIZE,
    height: RING_ONE_SIZE,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  dashedRingOuter: {
    width: RING_TWO_SIZE,
    height: RING_TWO_SIZE,
    borderColor: 'rgba(212,175,55,0.08)',
  },
  symbolDisc: {
    width: SYMBOL_SIZE,
    height: SYMBOL_SIZE,
    borderRadius: SYMBOL_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(10, 8, 20, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  symbolGlow: {
    position: 'absolute',
    width: SYMBOL_SIZE * 1.5,
    height: SYMBOL_SIZE * 1.5,
  },
  symbolImage: {
    width: SYMBOL_SIZE * 0.78,
    height: SYMBOL_SIZE * 0.78,
    borderRadius: (SYMBOL_SIZE * 0.78) / 2,
  },
  sessionPill: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionLabel: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 10,
    color: 'rgba(212,175,55,0.5)',
    letterSpacing: 1.9,
    textTransform: 'uppercase',
  },
  sessionDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 8,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },
  sessionCount: {
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  threadWrap: {
    marginTop: 10,
    width: THREAD_TRACK_WIDTH,
    alignItems: 'center',
  },
  threadTrack: {
    width: THREAD_TRACK_WIDTH,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(212,175,55,0.1)',
    overflow: 'hidden',
  },
  threadFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.gold,
  },
  threadLabel: {
    marginTop: 6,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(212,175,55,0.35)',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  dividerWrap: {
    marginTop: 24,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  card: {
    marginTop: 16,
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.14)',
    backgroundColor: 'rgba(212,175,55,0.03)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },
  cardEyebrow: {
    marginBottom: 10,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 9,
    color: 'rgba(212,175,55,0.4)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  cardIntention: {
    fontFamily: typography.fonts.bodySerifItalic,
    fontSize: 19,
    lineHeight: 28,
    color: colors.bone,
    textAlign: 'center',
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 24,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: typography.fonts.bodySerif,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(245,245,220,0.3)',
    letterSpacing: 0.65,
  },
  footerHint: {
    marginTop: 16,
    fontFamily: typography.fonts.heading,
    fontSize: 9,
    color: 'rgba(212,175,55,0.25)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  fallbackSafeArea: {
    flex: 1,
    backgroundColor: colors.black,
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fallbackText: {
    color: colors.bone,
    fontFamily: typography.fonts.bodySerif,
    fontSize: 18,
    textAlign: 'center',
  },
});
