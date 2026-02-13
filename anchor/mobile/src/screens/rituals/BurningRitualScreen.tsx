/**
 * Anchor App - Burn & Release Ritual Screen
 *
 * Final ceremonial animation sequence:
 * Phase 1 (0–1.5s):  Sigil glow intensifies — warm amber accent
 * Phase 2 (1–3s):    Amber ember particles rise and drift upward
 * Phase 3 (3–4.5s):  Sigil dissolves inward; ash particles burst outward
 * Phase 4 (4.5–5.5s): Calm empty center; "Released" text fades in
 *
 * After animation: all amber gone; theme returns to navy + bone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { post } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { safeHaptics } from '@/utils/haptics';
import * as Haptics from 'expo-haptics';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIGIL_SIZE = SCREEN_WIDTH * 0.6;

// Amber accent — used ONLY during burn animation, fades to zero by Phase 4
const EMBER_COLOR = '#E8650A';
const ASH_COLOR = '#E8E8E0';

const EMBER_COUNT = 20;
const ASH_COUNT = 12;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const toast = useToast();
  const reducedMotion = useReducedMotion();

  const { anchorId, intention, sigilSvg, enhancedImageUrl } = route.params;
  const { removeAnchor } = useAnchorStore();

  const [showReleasedText, setShowReleasedText] = useState(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);

  // Animation values
  const titleOpacity = useSharedValue(0.6);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.4);
  const sigilOpacity = useSharedValue(1);
  const sigilScale = useSharedValue(1);
  const ritualProgress = useSharedValue(0);
  const ashProgress = useSharedValue(0);
  const backgroundAmber = useSharedValue(0);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    startRitual();
  }, []);

  const completeRitual = useCallback(async () => {
    setShowLoadingIndicator(false);
    const loadingTimer = setTimeout(() => setShowLoadingIndicator(true), 2000);

    try {
      await post(`/api/anchors/${anchorId}/burn`, {});
      removeAnchor(anchorId);
      AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });
    } catch (error) {
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Unknown error during anchor burn'),
        { screen: 'BurningRitualScreen' }
      );
      toast.error('Ritual completed, but failed to sync. Anchor removed locally.');
      removeAnchor(anchorId);
    } finally {
      clearTimeout(loadingTimer);
      setShowLoadingIndicator(false);
    }

    navigation.setOptions({ gestureEnabled: true });
    setTimeout(() => navigation.navigate('Vault'), 1500);
  }, [anchorId]);

  const startRitual = useCallback(() => {
    if (reducedMotion) {
      titleOpacity.value = 0;
      sigilOpacity.value = 0;
      sigilScale.value = 0;
      ringOpacity.value = 0;
      ringScale.value = 0;
      void completeRitual();
      return;
    }

    // Phase 1: medium haptic + title fade + ring pulse
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    titleOpacity.value = withTiming(0, { duration: 1500 });

    ringScale.value = withRepeat(
      withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 3000 }),
        withTiming(0.2, { duration: 3000 })
      ),
      -1,
      true
    );

    // Subtle amber overlay: peaks at 6% opacity mid-animation then fades out
    backgroundAmber.value = withSequence(
      withTiming(1, { duration: 3000 }),
      withDelay(0, withTiming(0, { duration: 1500 }))
    );

    // Light haptic pulses every 500ms during phases 1–2 (0–3s)
    const scheduleHaptics = (delay: number, stopAt: number) => {
      if (delay >= stopAt) return;
      setTimeout(() => {
        void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
        scheduleHaptics(delay + 500, stopAt);
      }, delay);
    };
    scheduleHaptics(500, 3000);

    // Drives ember particle animation
    ritualProgress.value = withTiming(1, {
      duration: 5500,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(completeRitual)();
    });

    // Phase 3 (3s): sigil + ring collapse inward
    sigilOpacity.value = withDelay(3000, withTiming(0, { duration: 1500 }));
    sigilScale.value = withDelay(3000, withTiming(0.15, { duration: 1500 }));
    ringOpacity.value = withDelay(3000, withTiming(0, { duration: 1500 }));
    ringScale.value = withDelay(3000, withTiming(0.05, { duration: 1500 }));

    // Phase 3 ash burst at 3.5s
    ashProgress.value = withDelay(3500, withTiming(1, { duration: 1000 }));

    // Phase 4 (4.5s): success haptic + "Released" text
    setTimeout(() => {
      void safeHaptics.notification(Haptics.NotificationFeedbackType.Success);
      setShowReleasedText(true);
    }, 4500);

    // FUTURE: Spatial audio — requires adding expo-av
    // import { Audio } from 'expo-av';
    // const { sound } = await Audio.Sound.createAsync(require('@/assets/sounds/burn.mp3'));
    // await sound.playAsync();
  }, [reducedMotion, completeRitual]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));
  const sigilStyle = useAnimatedStyle(() => ({
    opacity: sigilOpacity.value,
    transform: [{ scale: sigilScale.value }],
  }));
  const amberOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backgroundAmber.value, [0, 0.5, 1], [0, 0.06, 0]),
  }));

  const embers = Array.from({ length: EMBER_COUNT }).map((_, i) => (
    <EmberParticle key={`e${i}`} index={i} progress={ritualProgress} />
  ));
  const ashes = Array.from({ length: ASH_COUNT }).map((_, i) => (
    <AshParticle key={`a${i}`} index={i} progress={ashProgress} />
  ));

  return (
    <SafeAreaView style={styles.container}>
      {/* Amber warm tint — only during phases 1–3, fully fades by Phase 4 */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.amberOverlay, amberOverlayStyle]}
        pointerEvents="none"
      />

      <View style={styles.content}>
        <Animated.Text style={[styles.title, titleStyle]}>
          Burn & Release
        </Animated.Text>

        <View style={styles.ritualContainer}>
          <Animated.View style={[styles.ring, ringStyle]} />

          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {embers}
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {ashes}
          </View>

          <Animated.View style={[styles.sigilContainer, sigilStyle]}>
            {enhancedImageUrl ? (
              <OptimizedImage
                uri={enhancedImageUrl}
                style={[styles.enhancedImage, { width: SIGIL_SIZE, height: SIGIL_SIZE }]}
                resizeMode="cover"
              />
            ) : (
              <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
            )}
          </Animated.View>
        </View>

        {/* "Released" in bone/ivory — not gold — theme returns to calm */}
        {showReleasedText && (
          <Animated.Text entering={FadeIn.duration(800)} style={styles.releasedText}>
            Released
          </Animated.Text>
        )}

        {showLoadingIndicator && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loadingContainer}>
            <ActivityIndicator color={colors.gold} size="small" />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};

// ── Ember Particle ────────────────────────────────────────────────────────────

interface ParticleProps {
  index: number;
  progress: Animated.SharedValue<number>;
}

const EmberParticle: React.FC<ParticleProps> = ({ index, progress }) => {
  const seed = Math.sin(index * 1337);
  const startX = (seed * SIGIL_SIZE) / 2;
  const horizontalDrift = Math.cos(index * 42) * 60;
  const particleSize = 3 + Math.abs(Math.sin(index * 73)) * 4;

  const animatedStyle = useAnimatedStyle(() => {
    const local = interpolate(progress.value, [0.2, 0.9], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: startX + local * horizontalDrift },
        { translateY: interpolate(local, [0, 1], [0, -SCREEN_HEIGHT * 0.55]) },
        { scale: interpolate(local, [0, 0.2, 1], [1, 1.5, 0.5]) },
      ],
      opacity: interpolate(local, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        styles.ember,
        { width: particleSize, height: particleSize, borderRadius: particleSize / 2 },
        animatedStyle,
      ]}
    />
  );
};

// ── Ash Particle ──────────────────────────────────────────────────────────────

const AshParticle: React.FC<ParticleProps> = ({ index, progress }) => {
  const angle = (index / ASH_COUNT) * Math.PI * 2;
  const distance = 30 + Math.abs(Math.sin(index * 97)) * 40;
  const size = 2 + Math.abs(Math.cos(index * 53)) * 3;

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: interpolate(p, [0, 0.1, 0.7, 1], [0, 0.8, 0.5, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [0, Math.cos(angle) * distance]) },
        { translateY: interpolate(p, [0, 1], [0, Math.sin(angle) * distance - 20]) },
        { scale: interpolate(p, [0, 0.2, 1], [0.5, 1, 0.3], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.ash,
        { width: size, height: size, borderRadius: size / 2 },
        animatedStyle,
      ]}
    />
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  amberOverlay: {
    backgroundColor: EMBER_COLOR,
    zIndex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
    zIndex: 2,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    letterSpacing: 2,
  },
  ritualContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIGIL_SIZE,
    height: SIGIL_SIZE,
    borderRadius: SIGIL_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  sigilContainer: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  enhancedImage: {
    borderRadius: SIGIL_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  ember: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: EMBER_COLOR,
  },
  ash: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: ASH_COLOR,
  },
  releasedText: {
    position: 'absolute',
    bottom: spacing.xxxl,
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.bone,   // bone/ivory — NOT gold
    letterSpacing: 4,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: spacing.xxxl + spacing.xxl,
  },
});
