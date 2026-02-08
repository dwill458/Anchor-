/**
 * Anchor App - Final Release Ritual Screen
 *
 * Zen Architect redesign: transform "burning" into a calm release ritual.
 * Features: Gold ring pulse, upward embers, inward fade.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
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
  Extrapolate,
  FadeIn,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { del } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { useToast } from '@/components/ToastProvider';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIGIL_SIZE = SCREEN_WIDTH * 0.6;
const PARTICLE_COUNT = 15;

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();
  const toast = useToast();

  const { anchorId, intention, sigilSvg } = route.params;
  const { removeAnchor } = useAnchorStore();

  const [isReleased, setIsReleased] = useState(false);
  const [showReleasedText, setShowReleasedText] = useState(false);

  // Animation Values
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.4);
  const sigilOpacity = useSharedValue(1);
  const sigilScale = useSharedValue(1);
  const ritualProgress = useSharedValue(0); // 0 to 1

  useEffect(() => {
    startRitual();
  }, []);

  const startRitual = useCallback(() => {
    // 1. Initial haptic & pulse animation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Slow pulse of gold ring
    ringScale.value = withRepeat(
      withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 3000 }),
        withTiming(0.2, { duration: 3000 })
      ),
      -1,
      true
    );

    // 2. Start overall ritual progression (6 seconds)
    ritualProgress.value = withTiming(1, {
      duration: 5000,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) {
        runOnJS(completeRitual)();
      }
    });

    // 3. Sequential fade inward
    sigilOpacity.value = withDelay(4000, withTiming(0, { duration: 1500 }));
    sigilScale.value = withDelay(4000, withTiming(0.3, { duration: 1500 }));

    // Ring also fades and shrinks inward at the end
    ringOpacity.value = withDelay(4000, withTiming(0, { duration: 1500 }));
    ringScale.value = withDelay(4000, withTiming(0.1, { duration: 1500 }));
  }, []);

  const completeRitual = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowReleasedText(true);

    try {
      // API call & state update
      await del(`/api/anchors/${anchorId}`);
      removeAnchor(anchorId);

      AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });

      // Navigate away after a brief moment
      setTimeout(() => {
        navigation.navigate('Vault');
      }, 1500);
    } catch (error) {
      ErrorTrackingService.captureException(
        error instanceof Error ? error : new Error('Unknown error during anchor release'),
        { screen: 'BurningRitualScreen' }
      );
      toast.error('Ritual completed, but failed to sync. Anchor removed locally.');
      removeAnchor(anchorId);
      navigation.navigate('Vault');
    }
  };

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const sigilStyle = useAnimatedStyle(() => ({
    opacity: sigilOpacity.value,
    transform: [{ scale: sigilScale.value }],
  }));

  // Render particles
  const particles = Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
    <EmberParticle key={i} index={i} progress={ritualProgress} />
  ));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Complete & Release</Text>

        <View style={styles.ritualContainer}>
          {/* Pulsing Gold Ring */}
          <Animated.View style={[styles.ring, ringStyle]} />

          {/* Upward Embers */}
          <View style={StyleSheet.absoluteFill}>
            {particles}
          </View>

          {/* Sigil */}
          <Animated.View style={[styles.sigilContainer, sigilStyle]}>
            <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
          </Animated.View>
        </View>

        {showReleasedText && (
          <Animated.Text entering={FadeIn.duration(800)} style={styles.releasedText}>
            Released
          </Animated.Text>
        )}
      </View>
    </SafeAreaView>
  );
};

interface ParticleProps {
  index: number;
  progress: Animated.SharedValue<number>;
}

const EmberParticle: React.FC<ParticleProps> = ({ index, progress }) => {
  const seed = Math.sin(index * 1337);
  const startX = (seed * SIGIL_SIZE) / 2;
  const horizontalDrift = Math.cos(index * 42) * 40;

  const animatedStyle = useAnimatedStyle(() => {
    // Particles start emerging after 10% progress
    const localProgress = interpolate(
      progress.value,
      [0.2, 0.9],
      [0, 1],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      localProgress,
      [0, 1],
      [0, -SCREEN_HEIGHT * 0.4]
    );

    const translateX = startX + (localProgress * horizontalDrift);

    const opacity = interpolate(
      localProgress,
      [0, 0.2, 0.8, 1],
      [0, 1, 1, 0]
    );

    const scale = interpolate(
      localProgress,
      [0, 0.2, 1],
      [1, 1.5, 0.5]
    );

    return {
      transform: [
        { translateX },
        { translateY },
        { scale },
      ],
      opacity,
    };
  });

  return <Animated.View style={[styles.particle, animatedStyle]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    opacity: 0.6,
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
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
    top: '50%',
    left: '50%',
  },
  releasedText: {
    position: 'absolute',
    bottom: spacing.xxxl,
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.gold,
    letterSpacing: 4,
  },
});
